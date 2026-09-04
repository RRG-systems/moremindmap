import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { prepareBlindDemoRequestProof } from '../src/subscriptionV1/blindDemoRequestProof.js'
import { BlindDemoRedis } from './helpers/blindDemoRedis.js'
import { issueDemoSubjectSwitchCsrf, consumeDemoSubjectSwitchCsrf } from '../api/engine/subscriptionV1/internalDevInfrastructure.js'

const blind = { selection: '1', view_token: 'synthetic-current-view', selection_csrf: 'expired-selection-proof-not-consumed' }
const freshSelection = 'synthetic-fresh-selection-proof-000001'
const freshRuntime = 'synthetic-fresh-runtime-proof-0000001'
const bootstrap = () => ({ ok: true, blind_demo: { selection: '1', view_token: blind.view_token, selection_csrf: freshSelection }, csrf_token: freshRuntime, session: { session_id: 'synthetic-session-1' } })
function fixture(body = bootstrap(), status = 200) {
  const calls = []
  return { calls, fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: status === 200, status, json: async () => body } } }
}

test('a stale selection proof is replaced by fresh same-origin read without an action, provider call or state adoption', async () => {
  const x = fixture()
  const before = JSON.stringify(blind)
  assert.equal(await prepareBlindDemoRequestProof({ ...x, blind, kind: 'selection' }), freshSelection)
  assert.equal(JSON.stringify(blind), before)
  assert.deepEqual(x.calls, [{ url: '/api/internal/subscription-v1-runtime', options: { credentials: 'same-origin', cache: 'no-store' } }])
})

test('runtime proof refresh preserves the exact active session and does not use the selection proof', async () => {
  const x = fixture()
  assert.equal(await prepareBlindDemoRequestProof({ ...x, blind, kind: 'runtime', sessionId: 'synthetic-session-1' }), freshRuntime)
  assert.equal(x.calls.length, 1)
})

test('changed server arm or view refuses action rather than adopting fresh foreign authority', async () => {
  for (const change of [{ selection: '2' }, { view_token: 'another-tab-view' }]) {
    const body = bootstrap(); Object.assign(body.blind_demo, change)
    await assert.rejects(prepareBlindDemoRequestProof({ ...fixture(body), blind, kind: 'selection' }), /BLIND_DEMO_VIEW_STALE/)
  }
})

test('changed server session refuses runtime action', async () => {
  const body = bootstrap(); body.session.session_id = 'another-session'
  await assert.rejects(prepareBlindDemoRequestProof({ ...fixture(body), blind, kind: 'runtime', sessionId: 'synthetic-session-1' }), /BLIND_DEMO_SESSION_STALE/)
})

test('missing or non-blind context and arbitrary selections fail before any fetch', async () => {
  for (const value of [null, {}, { ...blind, selection: 'patricia-demo' }, { ...blind, selection: 'canonical' }, { ...blind, view_token: '' }]) {
    const x = fixture()
    await assert.rejects(prepareBlindDemoRequestProof({ ...x, blind: value, kind: 'runtime' }), /BLIND_DEMO_PROOF_CONTEXT_REQUIRED/)
    assert.equal(x.calls.length, 0)
  }
})

test('expired authentication remains fail closed and carries the ordinary re-entry signal', async () => {
  const x = fixture({ ok: false, reentry_required: true }, 401)
  await assert.rejects(prepareBlindDemoRequestProof({ ...x, blind, kind: 'runtime' }), e => e.status === 401 && e.reentryRequired === true)
  assert.equal(x.calls.length, 1)
})

test('missing proof, denied bootstrap, malformed response and network failure never fall back to an expired proof', async () => {
  const noProof = bootstrap(); delete noProof.blind_demo.selection_csrf
  await assert.rejects(prepareBlindDemoRequestProof({ ...fixture(noProof), blind, kind: 'selection' }), /PROOF_UNAVAILABLE/)
  for (const body of [null, { ok: false }, { ok: true }]) await assert.rejects(prepareBlindDemoRequestProof({ ...fixture(body), blind, kind: 'runtime' }))
  let calls = 0
  await assert.rejects(prepareBlindDemoRequestProof({ fetchImpl: async () => { calls++; throw Error('synthetic-network-failure') }, blind, kind: 'selection' }), /synthetic-network-failure/)
  assert.equal(calls, 1)
})

test('only blind demo calls gain refresh; shared authority, TTL and one-time consumption remain unchanged', () => {
  const ui = fs.readFileSync(new URL('../src/subscriptionV1/SubscriptionV1InternalDevApp.jsx', import.meta.url), 'utf8')
  assert.match(ui, /if \(bootstrap\.blind_demo\) \{\s*try \{\s*requestCsrf = await prepareBlindDemoRequestProof/)
  assert.match(ui, /const selectionCsrf = await prepareBlindDemoRequestProof\(\{ blind, kind: 'selection' \}\)/)
  const server = fs.readFileSync(new URL('../api/engine/subscriptionV1/internalDevInfrastructure.js', import.meta.url), 'utf8')
  assert.match(server, /CSRF_TTL_SECONDS = 5 \* 60/)
  assert.match(server, /return await redis\.getdel\(`\$\{PREFIX\}:subject-switch-csrf:/)
  assert.match(server, /return await redis\.getdel\(`\$\{PREFIX\}:runtime-csrf:/)
})

test('after a six-minute turn the real proof primitive denies the old proof and accepts a fresh proof exactly once', async () => {
  class ClockRedis extends BlindDemoRedis {
    now = 0
    expiries = new Map()
    async set(key, value, ...args) {
      const result = await super.set(key, value, ...args)
      const ex = args.indexOf('EX')
      if (result === 'OK' && ex >= 0) this.expiries.set(key, this.now + Number(args[ex + 1]) * 1000)
      return result
    }
    async getdel(key) {
      if ((this.expiries.get(key) ?? Infinity) <= this.now) this.values.delete(key)
      return super.getdel(key)
    }
  }
  const redis = new ClockRedis(), capabilityHash = 'a'.repeat(64)
  const old = await issueDemoSubjectSwitchCsrf({ redis, capabilityHash })
  redis.now = 6 * 60 * 1000
  assert.equal(await consumeDemoSubjectSwitchCsrf({ redis, capabilityHash, proof: old }), false)
  let gets = 0
  const fresh = await prepareBlindDemoRequestProof({ blind, kind: 'selection', fetchImpl: async () => {
    gets++
    const body = bootstrap()
    body.blind_demo.selection_csrf = await issueDemoSubjectSwitchCsrf({ redis, capabilityHash })
    return { ok: true, status: 200, json: async () => body }
  } })
  assert.equal(gets, 1)
  assert.equal(await consumeDemoSubjectSwitchCsrf({ redis, capabilityHash, proof: fresh }), true)
  assert.equal(await consumeDemoSubjectSwitchCsrf({ redis, capabilityHash, proof: fresh }), false)
})
