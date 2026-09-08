import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

async function loadUi(context) {
  const vite = await createServer({ cacheDir: path.join(os.tmpdir(), 'athlete-living-consult-one-shot-ui-test-vite'), server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  context.after(() => vite.close())
  return vite.ssrLoadModule('/src/athleteLivingConsultOneShotV1/App.jsx')
}

test('one-shot Athlete Consult exposes the locked four-room body and additive default-off route', async (context) => {
  await loadUi(context)
  const { ATHLETE_LIVING_CONSULT_ROOMS } = await import('../src/athleteLivingConsultOneShotV1/contract.js')
  const { athleteConsultingRouteEnabled, config } = await import('../middleware.js')
  assert.deepEqual(ATHLETE_LIVING_CONSULT_ROOMS, ['HOME', 'YOU', 'YOUR_SPORT', 'PLAN'])
  const main = await fs.readFile('src/main.jsx', 'utf8')
  assert.match(main, /path="\/athlete-consulting-tool\/demo"/u)
  assert.doesNotMatch(main, /visual-lab\/athlete-(?:living-consult|consulting-tool)/u)
  assert.equal(athleteConsultingRouteEnabled({}), false)
  assert.equal(athleteConsultingRouteEnabled({
    RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true',
    SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true',
    ATHLETE_CONSULTING_DARREN_DEMO_ENABLED: 'true',
  }), true)
  assert.deepEqual(config, { matcher: '/athlete-consulting-tool/demo/:path*' })
})

test('page context is a bounded relevance envelope with de-duplicated object ids', async (context) => {
  await loadUi(context)
  const { createPageContextEnvelope } = await import('../src/athleteLivingConsultOneShotV1/contract.js')
  assert.deepEqual(createPageContextEnvelope('YOUR_SPORT', { destination: 'where', visibleObjectIds: ['A01', 'A01', 'A02'], stateHash: 'state-1' }), {
    contract: 'page-context-envelope-v1', room: 'YOUR_SPORT', destination: 'where', visibleObjectIds: ['A01', 'A02'], stateHash: 'state-1',
  })
  assert.deepEqual(createPageContextEnvelope('YOU'), {
    contract: 'page-context-envelope-v1', room: 'YOU', destination: 'recognition', visibleObjectIds: [], stateHash: null,
  })
})

test('the continuously mounted rail renders one unfiltered cross-room transcript and explicit pre-session start', async (context) => {
  const { OneConversationRail } = await loadUi(context)
  const common = {
    relationship: { relationship_id: 'rel-athlete-1' }, busy: false, postResponseBusy: false, error: '', speaker: 'ATHLETE',
    onSpeaker() {}, onStart() {}, onSend() {}, onEnd() {},
  }
  const pre = renderToStaticMarkup(React.createElement(OneConversationRail, { ...common, preSession: true, session: { coaching_episode_phase: 'IDLE' }, timeline: [], startAction: 'START_MY_FIRST_SESSION' }))
  assert.match(pre, /START MY FIRST SESSION/u)
  assert.match(pre, /data-testid="one-chat-rail"/u)
  assert.doesNotMatch(pre, /<textarea/u)

  const active = renderToStaticMarkup(React.createElement(OneConversationRail, { ...common, preSession: false, session: { session_id: 'session-one', coaching_episode_phase: 'ACTIVE' }, timeline: [
    { turn_id: 'you-1', actor: 'ATHLETE', room: 'YOU', text: 'A BOS pattern.' },
    { turn_id: 'sport-1', actor: 'INSTRUCTOR', room: 'YOUR_SPORT', text: 'I see that in practice.' },
    { turn_id: 'plan-1', actor: 'MORE', room: 'PLAN', text: 'Let us decide what to test.' },
  ], startAction: 'START_SESSION' }))
  assert.match(active, /A BOS pattern\./u)
  assert.match(active, /I see that in practice\./u)
  assert.match(active, /Let us decide what to test\./u)
  assert.match(active, /data-session-id="session-one"/u)
  assert.match(active, /Enter to send · Shift\+Enter for a new line/u)
  assert.match(active, /END SESSION/u)
  assert.doesNotMatch(active, /Who is speaking|alc-shot-speakers/u)

  const ending = renderToStaticMarkup(React.createElement(OneConversationRail, { ...common, preSession: false, session: { session_id: 'session-one', coaching_episode_phase: 'ENDING' }, timeline: [], startAction: 'START_SESSION', closePending: { summary: 'Does this capture where you want to pause?' }, onCloseTogether() {} }))
  assert.match(ending, /What should this relationship carry forward\?/u)
  assert.match(ending, /correct what MORE missed/u)
  assert.match(ending, /close with this understanding/u)
  assert.match(ending, /disabled=""/u)
})

test('authored context callbacks are output-neutral and avoid DOM/text scraping', async () => {
  const [bos, ba, app] = await Promise.all([
    fs.readFile('src/athleteBosV1/App.jsx', 'utf8'),
    fs.readFile('src/lab/baProgressiveDisclosureV1/BusinessTwinApp.jsx', 'utf8'),
    fs.readFile('src/athleteLivingConsultOneShotV1/App.jsx', 'utf8'),
  ])
  assert.match(bos, /artifactOverride/u)
  assert.match(bos, /onContextChange/u)
  assert.match(ba, /onContextChange/u)
  assert.match(app, /AthleteBosV1App customerMode artifactOverride/u)
  assert.match(app, /BusinessTwinApp viewModel=\{viewModel\}/u)
  assert.match(app, /data-testid="governed-apa-unavailable"/u)
  assert.doesNotMatch(app, /ATHLETE_APA_PARITY_V1/u)
  assert.doesNotMatch(app, /querySelector|innerText|textContent/u)
})

test('the UI preserves dual-human agreement and truthful map-change boundaries', async () => {
  const source = await fs.readFile('src/athleteLivingConsultOneShotV1/App.jsx', 'utf8')
  assert.match(source, /`\$\{athleteName\} — I agree`/u)
  assert.match(source, /`\$\{instructorName\} — I agree`/u)
  assert.match(source, /athlete_actor_capability/u)
  assert.match(source, /instructor_actor_capability/u)
  assert.match(source, /One yes is not enough/u)
  assert.match(source, /payload\.gu_plan\?\.event === 'MAP_CHANGE'/u)
  assert.match(source, /payload\.map_delta\?\.committed === true/u)
  assert.match(source, /YOUR MAP JUST CHANGED/u)
  assert.match(source, /data-committed-delta="true"/u)
})

test('a disagreement can visibly revise the same state-bound proposal before two-person agreement', async (context) => {
  const { JointApproval } = await loadUi(context)
  const proposal = {
    proposal_id: 'proposal-1',
    proposal_hash: 'proposal-hash-1',
    expected_prior_publication_version: 4,
    title: 'A shared next step',
    status: 'PENDING',
    proposed_items: [
      { field: 'athlete_plan.intervention', value: 'Use the original cue in four practice sequences.' },
      { field: 'athlete_plan.open_loop_state', value: 'OPEN' },
    ],
    confirmations: [{ actor: 'ATHLETE' }],
  }
  const revisedItems = [
    { field: 'athlete_plan.intervention', value: 'Use the shorter cue in two comparable practice sequences.' },
    { field: 'athlete_plan.open_loop_state', value: 'OPEN' },
  ]
  const original = renderToStaticMarkup(React.createElement(JointApproval, { proposal, proposalEdit: null, busy: false, onConfirm() {} }))
  assert.match(original, /Something changed — adjust before the Plan changes/u)
  assert.match(original, /data-proposal-id="proposal-1"/u)
  assert.match(original, /data-proposal-hash="proposal-hash-1"/u)
  assert.match(original, /data-expected-publication-version="4"/u)

  const revisedProposal = { ...proposal, proposal_id: 'proposal-2', proposal_hash: 'proposal-hash-2', proposed_items: revisedItems, confirmations: [] }
  const revised = renderToStaticMarkup(React.createElement(JointApproval, {
    proposal: revisedProposal,
    proposalEdit: { proposalId: 'proposal-2', actor: 'ATHLETE', items: revisedItems },
    busy: false,
    onConfirm() {},
    onRevise() {},
    athleteName: 'Mika',
    instructorName: 'Coach Ellis',
  }))
  assert.match(revised, /data-testid="revised-state-bound-proposal"/u)
  assert.match(revised, /Use the shorter cue in two comparable practice sequences\./u)
  assert.match(revised, /Mika — I agree/u)
  assert.match(revised, /Coach Ellis — I agree/u)
  assert.match(revised, /Both people must agree to this exact wording\. An earlier yes does not carry over\./u)
})

test('proposal dates read naturally while exact ISO bindings remain available to receipts', async (context) => {
  const { JointApproval } = await loadUi(context)
  const markup = renderToStaticMarkup(React.createElement(JointApproval, {
    proposal: {
      proposal_id: 'proposal-dates', proposal_hash: 'proposal-date-hash', expected_prior_publication_version: 1,
      status: 'PENDING',
      proposed_items: [
        { field: 'athlete_plan.observation_window_start', value: '2026-09-13T04:45:56.593Z' },
        { field: 'athlete_plan.observation_window_end', value: '2026-09-20T04:45:56.593Z' },
      ],
    },
    proposalEdit: null, busy: false, onConfirm() {}, onRevise() {},
  }))
  assert.match(markup, /Sep 13, 2026/u)
  assert.match(markup, /Sep 20, 2026/u)
  assert.match(markup, /data-raw-value="2026-09-13T04:45:56\.593Z"/u)
  assert.doesNotMatch(markup, />2026-09-13T04:45:56\.593Z</u)
})

test('room context is serialized and locks navigation and turns until the governed view is current', async () => {
  const source = await fs.readFile('src/athleteLivingConsultOneShotV1/App.jsx', 'utf8')
  assert.match(source, /pendingContextRef\.current = normalized/u)
  assert.match(source, /while \(pendingContextRef\.current\)/u)
  assert.match(source, /const payload = await post\('SET_PAGE_CONTEXT'/u)
  assert.match(source, /ingest\(payload\)[\s\S]*lastContextSent\.current = key/u)
  assert.match(source, /if \(busy \|\| contextSyncLock\.current \|\| preSession\) return/u)
  assert.match(source, /navigationLocked=\{busy \|\| contextBusy\}/u)
  assert.match(source, /data-context-sync=\{contextBusy \? 'PENDING' : 'SETTLED'\}/u)
  assert.match(source, /stateBindingRef\.current/u)
  assert.match(source, /expected_state_hash: liveBinding\.stateHash/u)
  assert.match(source, /const optimisticEventId = randomId\(\)/u)
  assert.match(source, /if \(!coachDelivered\) setTimeline[\s\S]*item\.event_id !== optimisticEventId/u)
})

test('the synthetic proof controls preserve grant, quorum, close, and exact lineage boundaries', async () => {
  const source = await fs.readFile('src/athleteLivingConsultOneShotV1/App.jsx', 'utf8')
  assert.match(source, /data-testid="grant-presentation-safe-bos"/u)
  assert.match(source, /data-testid="revoke-presentation-safe-bos"/u)
  assert.match(source, /No private detail—or even the existence of one—is shown here/u)
  assert.doesNotMatch(source, /One chat · one RSL|another RSL|Authority before relevance|source-bound attempt/iu)
  assert.match(source, /post\('GRANT_BOS'|setBosGrant\('GRANT_BOS'/u)
  assert.match(source, /setBosGrant\('REVOKE_BOS'/u)
  assert.match(source, /post\('REVISE_PROPOSAL'/u)
  assert.match(source, /expected_proposal_id: proposalId/u)
  assert.match(source, /expected_proposal_hash: proposal\.proposal_hash/u)
  assert.match(source, /decision: 'CONFIRM'/u)
  assert.match(source, /proposal_id: proposalId/u)
  assert.match(source, /expected_prior_publication_version: proposal\.expected_prior_publication_version/u)
  assert.match(source, /post\('REQUEST_CLOSE'/u)
  assert.match(source, /post\('CLOSE_SESSION'/u)
  assert.match(source, /alignment_message: alignmentMessage\.trim\(\)/u)
  assert.doesNotMatch(source, /Yes\. Mika and Coach Ellis agree this is the right place to pause/u)
  assert.match(source, /post\('RECORD_ATTEMPT'/u)
  assert.match(source, /post\('RECORD_OUTCOME'/u)
  assert.match(source, /post\('RECORD_ATTEMPT', \{\s*actor_capability: authorityRef\.current\.athlete_actor_capability/u)
  assert.match(source, /post\('RECORD_OUTCOME', \{\s*actor_capability: authorityRef\.current\.instructor_actor_capability/u)
  assert.match(source, /intervention_lineage_id: interventionLineageId/u)
  assert.match(source, /data-testid="athlete-consult-what-changed"/u)
  assert.match(source, /WHAT WE CAN SAY ABOUT CAUSE/u)
  assert.match(source, /WHAT WOULD MAKE US RETHINK/u)
  assert.match(source, /WHAT ELSE MAY HAVE MATTERED/u)
  assert.match(source, /bundle\.boundaries\?\.frontier_provider_status/u)
  assert.doesNotMatch(source, /No Production, real youth, customer, provider,/u)
  assert.doesNotMatch(source, /nearest.?date/iu)
  const styles = await fs.readFile('src/athleteLivingConsultOneShotV1/styles.css', 'utf8')
  assert.match(styles, /\.s2-gu-first_session_welcome \.s2-gu-block-heading h4\s*\{\s*display:\s*none/u)
  assert.doesNotMatch(source, /Who is speaking|Who is asking for the change|onSpeaker|setSpeaker/u)
  assert.doesNotMatch(styles, /alc-shot-speakers/u)
})

test('browser receipts expose stable session, relationship, RSL, page, and publication bindings', async () => {
  const source = await fs.readFile('src/athleteLivingConsultOneShotV1/App.jsx', 'utf8')
  for (const marker of ['data-rail-instance', 'data-session-id', 'data-session-ordinal', 'data-relationship-id', 'data-rsl-scope-hash', 'data-state-hash', 'data-publication-version', 'data-publication-hash', 'data-page-context', 'data-bos-grant-state', 'data-athlete-confirmed', 'data-instructor-confirmed']) {
    assert.match(source, new RegExp(marker, 'u'))
  }
})
