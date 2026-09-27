// Offline fictional service/CAS proof only. No runtime, client or Redis socket imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { createRedisRepository, CAS_LUA, digest } from '../server/athleteAcademyV1/repository.js';
import { createAcademyService } from '../server/athleteAcademyV1/service.js';
import { createCoachingService } from '../server/athleteAcademyV1/coaching/service.js';
import { initialCoachState } from '../server/athleteAcademyV1/coaching/state.js';
import { hash } from '../server/athleteAcademyV1/coaching/bundle.js';
import { MAIN_APA_REFERENCE_CODEC_CONTRACT } from '../server/athleteAcademyV1/coaching/currentApa.js';
import { continuityView, confirmApaCommand, prepareApaCommand, publishApaCommand, apaDraftKey, APA_BOXES } from '../src/athleteAcademyV1/coach/currentApaUi.js';

const clone = value => structuredClone(value);
const MESSAGE = '11111111-1111-4111-8111-111111111111';
const BOS_VERSION = '22222222-2222-4222-8222-222222222222';
const APA_VERSION = '33333333-3333-4333-8333-333333333333';
const OTHER_MESSAGE = '44444444-4444-4444-8444-444444444444';
const AT = Date.parse('2026-09-27T18:01:00.000Z');
const SOURCE_TEXT = 'My priority is Make calm passing choices. Review on October 3, 2026 and plan through December 1, 2026. Tuesday practice is shorter now.';
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function memoryCas() {
  const values = new Map();
  const redis = {
    beforeEval: null,
    afterEval: null,
    async get(key) { return values.get(key) ?? null; },
    async eval(script, count, ...args) {
      assert.equal(script, CAS_LUA);
      const keys = args.slice(0, count), prior = args.slice(count, count * 2), next = args.slice(count * 2);
      assert.equal(next.length, count);
      if (redis.beforeEval) await redis.beforeEval({ keys, prior, next, values });
      if (keys.some((key, index) => (values.get(key) ?? '') !== prior[index])) return 0;
      for (const [index, key] of keys.entries()) if (next[index] !== '') values.set(key, next[index]);
      if (redis.afterEval) await redis.afterEval({ keys, prior, next, values });
      return 1;
    },
  };
  return { redis, values, repo: createRedisRepository({ redis, prefix: 'more:athlete-academy:{test-apa-service}' }) };
}
function typedResponse(request) {
  const packet = JSON.parse(request.input);
  assert.equal(packet.contract, 'athlete_academy_current_apa_composition_packet_v1');
  assert.equal(packet.selected_athlete.slug, undefined);
  assert.equal(packet.selected_athlete.synthetic, false);
  assert.equal(request.store, false);
  return { status: 'completed', model: 'gpt-5.6-sol', usage: { total_tokens: 0 }, output_text: JSON.stringify({
    contract: MAIN_APA_REFERENCE_CODEC_CONTRACT, binding: packet.delta_binding, domains: [], futures: [], candidates: [],
    narratives: [
      { field: 'confirmation.priority', value: 'Make calm passing choices', cite_confirmed_update: true },
      { field: 'confirmation.review_date', value: '2026-10-03', cite_confirmed_update: true },
      { field: 'confirmation.horizon_date', value: '2026-12-01', cite_confirmed_update: true },
    ],
  }) };
}
async function fixture({ enabled = true, providerEnabled = true, transportHook = null, failReceiptOnce = false } = {}) {
  const memory = memoryCas(), actorId = 'fictional-canonical-account', mm = 'MM-FICTIONAL-SERVICE-ALPHA';
  let clock = AT, requestSequence = 0;
  const replace = value => JSON.parse(JSON.stringify(value).replaceAll(nia.person.mm, mm).replaceAll('Nia', 'Mira Fictional'));
  const bos = replace(nia.bos), apa = replace(nia.apa), source = replace(nia.bos_source);
  bos.mm = mm; bos.synthetic = false; bos.subject.age = 18;
  delete bos.artifact_sha256; bos.artifact_sha256 = hash(bos);
  apa.mm = mm; apa.synthetic = false; apa.identity.age = 18;
  apa.identity.reading_sha256 = hash(bos); apa.bos_sha256 = hash(bos);
  delete apa.artifact_sha256; apa.artifact_sha256 = hash(apa);
  const person = { mm, name: 'Mira Fictional', dateOfBirth: '2008-02-01', age: 18, sport: 'Volleyball' };
  source.person = { ...source.person, ...person };
  const account = { id: actorId, mm, verified: true, sessionVersion: 1, role: 'participant' };
  const dossier = { mm, ownerId: actorId, synthetic: false, archived: false, revision: 0, person,
    entitlements: { bos: true, apa: true, coach: true },
    participation: { athleteAccepted: true, status: 'self_authorized', policyVersion: 'offline-policy-v1' },
    reports: { bos: { currentVersionId: BOS_VERSION, artifactHash: bos.artifact_sha256 },
      apa: { currentVersionId: APA_VERSION, artifactHash: apa.artifact_sha256, bosVersionId: BOS_VERSION } },
    jobs: [], events: [], intake: { bos: {}, apa: {} } };
  const reportKeys = [`report:${mm}:bos:${BOS_VERSION}`, `report:${mm}:apa:${APA_VERSION}`];
  const docs = { [`account:${actorId}`]: account, [`dossier:${mm}`]: dossier,
    [reportKeys[0]]: { artifact: bos, input: { subject: source } },
    [reportKeys[1]]: { artifact: apa, input: { source: { mm } } } };
  await memory.repo.transact(Object.keys(docs), () => ({ writes: docs, result: true }));
  if (failReceiptOnce) {
    const immutable = memory.repo.putImmutable; let lost = false;
    memory.repo = Object.freeze({ ...memory.repo, async putImmutable(key, value) {
      if (!lost && key.startsWith('coach-apa-evidence:') && key.endsWith(':receipt')) {
        lost = true; throw new Error('OFFLINE_SYNTHETIC_RECEIPT_ACK_LOST');
      }
      return immutable(key, value);
    } });
  }
  const config = { currentApaEnabled: enabled, providerEnabled, realYouthEnabled: false,
    syntheticPreview: true, reviewedPolicyVersion: 'offline-policy-v1' };
  const now = () => clock, calls = [];
  const transport = async (request, options) => {
    calls.push({ request, options });
    assert.equal(options.maxRetries, 0);
    return transportHook ? transportHook(request, options) : typedResponse(request);
  };
  const auth = { event: (type, actor, extra = {}) => ({ type, actor, ...extra, at: new Date(clock).toISOString() }) };
  const academy = createAcademyService({ repo: memory.repo, config, auth, transport, now });
  const service = createCoachingService({ repo: memory.repo, config, academy, transport, now });
  const bundle = await service.bundle(account, { mm }), state = initialCoachState(bundle);
  state.status = 'active';
  state.messages = [{ id: MESSAGE, role: 'user', speaker: 'athlete', actorId, mm, text: SOURCE_TEXT, at: '2026-09-27T18:00:00.000Z', sessionId: state.sessionId }];
  state.plan = { id: OTHER_MESSAGE, title: 'Saved athlete-owned plan', why: 'Already accepted independently',
    steps: [{ action: 'Notice one calm pass.', when: 'Next practice', notice: 'One observation', owner: 'athlete' }],
    review: 'At my next chosen review', accepted_at: '2026-09-26T18:00:00.000Z' };
  state.learning = [{ id: OTHER_MESSAGE, text: 'I prefer one short reminder.', confirmed_by: 'athlete' }];
  const key = `coach:${mm}`;
  await memory.repo.transact([key], () => ({ writes: { [key]: state }, result: true }));
  const original = { reports: await Promise.all(reportKeys.map(key => memory.repo.read(key))), dossier: clone(dossier), plan: clone(state.plan), learning: clone(state.learning), source: clone(state.messages) };
  const raw = () => memory.repo.read(key);
  const command = async (value, overrides = {}) => ({ requestId: `offline-request-${++requestSequence}`, mm,
    revision: (await raw()).revision, command: value, ...overrides });
  const action = async (value, overrides = {}) => service.action(account, await command(value, overrides));
  const patch = async (docKey, change) => memory.repo.transact([docKey], saved => { const next = clone(saved[docKey]); change(next); return { writes: { [docKey]: next }, result: true }; });
  const confirm = async () => {
    await action({ action: 'confirm_fact', source_message_id: MESSAGE, reason: 'I reviewed my saved current reality.', kind: 'reality', supersedes: [] });
    return (await raw()).apaConfirmedChanges.at(-1);
  };
  const prepare = async () => {
    const confirmation = await confirm();
    await action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: (await raw()).currentApa?.version || 0 });
    return (await raw()).apaDraft;
  };
  const publishCommand = draft => ({ action: 'publish_apa', id: draft.id, hash: draft.hash,
    expected_version: draft.expectedVersion, artifact_hash: draft.previewRecord.artifact.artifact_sha256,
    confirmation_id: draft.confirmedChange.id, source_id: draft.source_id });
  const originalsUnchanged = async () => {
    assert.deepEqual(await Promise.all(reportKeys.map(key => memory.repo.read(key))), original.reports);
    const current = await raw(); assert.deepEqual(current.plan, original.plan); assert.deepEqual(current.learning, original.learning);
  };
  return { ...memory, config, account, dossier, mm, key, bundle, academy, service, calls, raw, action, command,
    patch, confirm, prepare, publishCommand, original, originalsUnchanged, now, advance: ms => { clock += ms; } };
}
async function lostReceiptFixture() {
  const f = await fixture({ failReceiptOnce: true }), confirmation = await f.confirm();
  await f.action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 });
  const before = await f.raw();
  assert.equal(before.status, 'unknown'); assert.ok(before.pendingAttempt); assert.equal(before.apaDraft, null);
  assert.equal(before.currentApa, null); assert.equal(f.calls.length, 1);
  return f;
}

test('default-off continuity has no capability/proposal/publication and no injected dispatch', async () => {
  const f = await fixture({ enabled: false }), result = await f.service.state(f.account, { mm: f.mm });
  assert.equal(result.state.continuity, undefined); assert.equal(result.state.capabilities?.currentApa, undefined);
  for (const action of ['confirm_fact', 'update_apa', 'publish_apa', 'discard_apa'])
    await assert.rejects(f.action({ action }), /CURRENT_APA_NOT_ACTIVE/u);
  assert.equal(f.calls.length, 0); await f.originalsUnchanged();
});

test('manual confirmation stages only private review; exact separate publication preserves original BOS/APA/CONFIRM/plan/learning', async () => {
  const f = await fixture(), confirmation = await f.confirm();
  assert.equal(f.calls.length, 0); assert.equal((await f.raw()).currentApa, null);
  assert.equal(confirmation.actorId, f.account.id); assert.equal(confirmation.mm, f.mm); assert.equal(confirmation.confirmed_by, 'athlete');
  await f.action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 });
  const staged = await f.raw(), draft = staged.apaDraft;
  assert.equal(f.calls.length, 1); assert.equal(staged.currentApa, null); assert.equal(staged.status, 'active');
  assert.equal(draft.expectedVersion, 0); assert.equal(draft.confirmedChange.id, confirmation.id);
  assert.equal(draft.previewRecord.version, 1); await f.originalsUnchanged();
  const reviewed = await f.service.state(f.account, { mm: f.mm });
  assert.equal(reviewed.state.continuity.current_version, 0); assert.equal(reviewed.state.continuity.draft.id, draft.id);
  await f.action(f.publishCommand(draft));
  const saved = await f.raw(), current = saved.currentApa;
  assert.equal(saved.apaDraft, null); assert.equal(current.version, 1); assert.equal(current.artifact.synthetic, false);
  assert.equal(current.artifact.actorId, f.account.id); assert.equal(current.artifact.confirmation.priority, 'Make calm passing choices');
  assert.equal(current.artifact.confirmation.review_date, '2026-10-03'); assert.equal(current.artifact.confirmation.horizon_date, '2026-12-01');
  assert.equal(current.artifact.confirmation.assessment_date, f.bundle.apa.confirmation.assessment_date);
  assert.deepEqual(current.artifact.identity, f.bundle.apa.identity); assert.deepEqual(current.artifact.bos_sources, f.bundle.apa.bos_sources);
  assert.deepEqual(current.artifact.report.coach_view, f.bundle.apa.report.coach_view);
  assert.deepEqual(current.artifact.sources.find(source => source.id === 'CONFIRM'), f.bundle.apa.sources.find(source => source.id === 'CONFIRM'));
  assert.equal(current.receipts[0].source_message_id, MESSAGE); assert.equal(current.receipts[0].prior_version, 0);
  assert.equal(current.receipts[0].prior_artifact_sha256, f.bundle.apa.artifact_sha256);
  assert.equal(f.calls.length, 1); await f.originalsUnchanged();
});

test('immutable private composition evidence retains exact first results and rejects overwrite', async () => {
  const f = await fixture(); await f.prepare();
  const keys = [...f.values.keys()].filter(key => key.includes(':coach-apa-evidence:'));
  assert.equal(keys.length, 3);
  assert.deepEqual(keys.map(key => JSON.parse(f.values.get(key)).kind).sort(), ['receipt', 'request', 'response']);
  assert.ok(keys.every(key => key.includes(`coach-apa-evidence:${f.mm}:`)));
  const physical = keys.find(key => key.endsWith(':response')), logical = physical.slice(f.repo.prefix.length + 1);
  const before = f.values.get(physical), evidence = await f.repo.read(logical);
  await f.repo.putImmutable(logical, evidence);
  await assert.rejects(f.repo.putImmutable(logical, { ...evidence, forged: true }), /IMMUTABLE_RECORD_CONFLICT/u);
  assert.equal(f.values.get(physical), before); assert.equal(f.calls.length, 1); await f.originalsUnchanged();
});

test('same request replay never dispatches or republishes; conflicting body cannot reuse an operation', async () => {
  const f = await fixture(), confirmation = await f.confirm();
  const request = await f.command({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 });
  await f.service.action(f.account, request); const before = await f.raw();
  await f.service.action(f.account, request); assert.equal(f.calls.length, 1); assert.deepEqual(await f.raw(), before);
  await assert.rejects(f.service.action(f.account, { ...request, command: { ...request.command, expected_version: 1 } }), /REQUEST_ID_CONFLICT/u);
  const publication = await f.command(f.publishCommand(before.apaDraft));
  await f.service.action(f.account, publication); const published = await f.raw();
  await f.service.action(f.account, publication); assert.deepEqual(await f.raw(), published);
  assert.equal(published.currentApa.receipts.length, 1); assert.equal(f.calls.length, 1);
});

test('private update requires explicit confirmation, current version and enabled connection', async () => {
  const f = await fixture();
  await assert.rejects(f.action({ action: 'update_apa', confirmation_id: OTHER_MESSAGE, expected_version: 0 }), /CURRENT_APA_STALE_VERSION/u);
  const confirmation = await f.confirm();
  await assert.rejects(f.action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 1 }), /CURRENT_APA_STALE_VERSION/u);
  f.config.providerEnabled = false;
  await assert.rejects(f.action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 }), /COACH_CONNECTION_UNAVAILABLE/u);
  assert.equal(f.calls.length, 0); await f.originalsUnchanged();
});

test('command actor/principal/MM/source spoof is rejected before any state write or composition', async t => {
  for (const key of ['actor', 'actorId', 'speaker', 'subjectActorId', 'mm', 'coachActorId', 'authority', 'principal'])
    await t.test(key, async () => {
      const f = await fixture(), before = await f.raw();
      await assert.rejects(f.action({ action: 'confirm_fact', source_message_id: MESSAGE, reason: 'Reviewed', kind: 'reality', supersedes: [], [key]: 'forged' }), /COACH_ACTOR_SPOOF_DENIED/u);
      assert.deepEqual(await f.raw(), before); assert.equal(f.calls.length, 0);
    });
  const f = await fixture(), before = await f.raw();
  await assert.rejects(f.action({ action: 'confirm_fact', source_message_id: OTHER_MESSAGE, reason: 'Reviewed', kind: 'reality', supersedes: [] }), /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED/u);
  await assert.rejects(f.action({ action: 'confirm_fact', source_message_id: MESSAGE, reason: 'Reviewed', kind: 'reality', supersedes: [], confirmedSource: { text: SOURCE_TEXT } }), /CURRENT_APA_COMMAND_INVALID/u);
  await assert.rejects(f.service.action({ ...f.account, id: 'fictional-other-account' }, await f.command({ action: 'confirm_fact' })), /NOT_FOUND/u);
  await assert.rejects(f.action({ action: 'confirm_fact' }, { mm: 'MM-FICTIONAL-OTHER' }), /NOT_FOUND/u);
  assert.deepEqual(await f.raw(), before); assert.equal(f.calls.length, 0);
});

test('captured Coach, coach speaker and cross-account/message/MM/source-binding evidence cannot be athlete confirmations', async t => {
  const cases = {
    capture: state => { state.messages[0].capture = { source: 'Coach Alex', reviewed: true }; },
    coach: state => { state.messages[0].speaker = 'coach'; },
    assistant: state => { state.messages[0].role = 'assistant'; },
    actor: state => { state.messages[0].actorId = 'fictional-other'; },
    mm: state => { state.messages[0].mm = 'MM-FICTIONAL-OTHER'; },
    binding: state => { state.sourceBinding.apa = 'a'.repeat(64); },
  };
  for (const [name, change] of Object.entries(cases)) await t.test(name, async () => {
    const f = await fixture(); await f.patch(f.key, change); const before = await f.raw();
    await assert.rejects(f.confirm(), /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED|COACH_SOURCES_CHANGED/u);
    assert.deepEqual(await f.raw(), before); assert.equal(f.calls.length, 0); await f.originalsUnchanged();
  });
});

test('pending, working, unknown and stale revisions deny continuity mutations without clearing unresolved evidence', async t => {
  for (const [name, change] of Object.entries({
    pending: state => { state.pendingAttempt = { id: OTHER_MESSAGE, task: 'CHAT', lease: AT + 1000 }; },
    working: state => { state.status = 'working'; }, unknown: state => { state.status = 'unknown'; },
  })) await t.test(name, async () => {
    const f = await fixture(); await f.patch(f.key, change); const before = await f.raw();
    await assert.rejects(f.confirm(), /COACH_OPERATION_PENDING/u);
    assert.deepEqual(await f.raw(), before); assert.equal(f.calls.length, 0);
  });
  const f = await fixture(), before = await f.raw();
  await assert.rejects(f.action({ action: 'confirm_fact', source_message_id: MESSAGE, reason: 'Reviewed', kind: 'reality', supersedes: [] }, { revision: before.revision + 1 }), /STATE_CHANGED_RELOAD/u);
  assert.deepEqual(await f.raw(), before);
});

test('all reviewed draft fields and original canonical message remain exact at manual publication', async t => {
  const f = await fixture(), draft = await f.prepare(), before = await f.raw(), valid = f.publishCommand(draft);
  for (const field of ['id', 'hash', 'expected_version', 'artifact_hash', 'confirmation_id', 'source_id']) await t.test(field, async () => {
    const value = field === 'expected_version' ? 1 : 'forged';
    await assert.rejects(f.action({ ...valid, [field]: value }), /CURRENT_APA_DRAFT_CHANGED/u);
    assert.deepEqual(await f.raw(), before); assert.equal(f.calls.length, 1);
  });
  await f.patch(f.key, state => { state.messages[0].text = 'Different canonical current reality.'; });
  const changed = await f.raw();
  await assert.rejects(f.action(valid), /CURRENT_APA_DRAFT_CHANGED/u);
  assert.deepEqual(await f.raw(), changed); assert.equal((await f.raw()).currentApa, null); await f.originalsUnchanged();
});

test('discard preserves first evidence and originals; another confirmed statement invalidates old exact draft', async () => {
  const f = await fixture(), draft = await f.prepare(), evidence = [...f.values.entries()].filter(([key]) => key.includes(':coach-apa-evidence:'));
  await f.action({ action: 'discard_apa', id: draft.id, hash: draft.hash });
  assert.equal((await f.raw()).apaDraft, null); assert.equal((await f.raw()).currentApa, null);
  assert.deepEqual([...f.values.entries()].filter(([key]) => key.includes(':coach-apa-evidence:')), evidence);
  await assert.rejects(f.action(f.publishCommand(draft)), /CURRENT_APA_DRAFT_CHANGED/u);
  await f.action({ action: 'update_apa', confirmation_id: draft.confirmedChange.id, expected_version: 0 });
  assert.ok((await f.raw()).apaDraft);
  await f.confirm(); assert.equal((await f.raw()).apaDraft, null);
  await f.originalsUnchanged();
});

test('revoked session, withdrawal and unavailable entitlement deny confirmation and private read before provider', async t => {
  for (const [name, mutate, expected] of [
    ['session', f => f.patch(`account:${f.account.id}`, account => { account.sessionVersion++; }), /SESSION_EXPIRED/u],
    ['withdrawal', f => f.patch(`dossier:${f.mm}`, dossier => { dossier.participation.status = 'withdrawn'; }), /PARTICIPATION_WITHDRAWN/u],
    ['entitlement', f => f.patch(`dossier:${f.mm}`, dossier => { dossier.entitlements.coach = false; }), /ACADEMY_ACCESS_REQUIRED/u],
  ]) await t.test(name, async () => {
    const f = await fixture(); await mutate(f); const before = await f.raw();
    await assert.rejects(f.confirm(), expected); await assert.rejects(f.service.state(f.account, { mm: f.mm }), expected);
    assert.deepEqual(await f.raw(), before); assert.equal(f.calls.length, 0);
  });
});

test('post-provider session revocation and withdrawal retain unresolved evidence and cannot disclose or stage a new APA', async t => {
  for (const [name, mutate, expected] of [
    ['session', f => f.patch(`account:${f.account.id}`, account => { account.sessionVersion++; }), /SESSION_EXPIRED/u],
    ['withdrawal', f => f.patch(`dossier:${f.mm}`, dossier => { dossier.participation.status = 'withdrawn'; }), /PARTICIPATION_WITHDRAWN/u],
    ['source version', f => f.patch(`dossier:${f.mm}`, dossier => { dossier.reports.apa.currentVersionId = OTHER_MESSAGE; }), /COACH_SOURCES_CHANGED/u],
  ]) await t.test(name, async () => {
    const started = deferred(), finish = deferred();
    const f = await fixture({ transportHook: async request => { started.resolve(); await finish.promise; return typedResponse(request); } });
    const confirmation = await f.confirm();
    const pending = f.action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 });
    const rejected = assert.rejects(pending, expected);
    await started.promise; await mutate(f); finish.resolve(); await rejected;
    const saved = await f.raw(); assert.equal(saved.status, 'unknown'); assert.ok(saved.pendingAttempt);
    assert.equal(saved.apaDraft, null); assert.equal(saved.currentApa, null); assert.equal(f.calls.length, 1);
    assert.ok([...f.values.keys()].some(key => key.includes(':coach-apa-evidence:'))); await f.originalsUnchanged();
  });
});

test('atomic preflight retries a revoked account/source snapshot and denies composition before injected dispatch', async t => {
  for (const kind of ['session', 'version']) await t.test(kind, async () => {
    const f = await fixture(), confirmation = await f.confirm(); let fired = false;
    f.redis.beforeEval = async ({ keys, next, values }) => {
      if (fired || keys.length !== 3 || next.some(value => value !== '')) return;
      const physical = `${f.repo.prefix}:${f.key}`, state = JSON.parse(values.get(physical));
      if (state.pendingAttempt?.task !== 'APA_UPDATE') return;
      fired = true;
      const key = `${f.repo.prefix}:${kind === 'session' ? `account:${f.account.id}` : `dossier:${f.mm}`}`;
      const doc = JSON.parse(values.get(key));
      if (kind === 'session') doc.sessionVersion++;
      else doc.reports.apa.currentVersionId = OTHER_MESSAGE;
      values.set(key, JSON.stringify(doc));
    };
    await assert.rejects(f.action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 }), kind === 'session' ? /SESSION_EXPIRED/u : /COACH_SOURCES_CHANGED/u);
    assert.equal(fired, true); assert.equal(f.calls.length, 0);
    assert.equal((await f.raw()).apaDraft, null); assert.equal((await f.raw()).currentApa, null);
    const saved = await f.raw(); assert.ok(saved.pendingAttempt); assert.equal(saved.status, 'unknown');
    assert.equal(saved.events.at(-1).type, 'current_apa_preflight_rejected'); assert.equal(saved.events.at(-1).noProviderCall, true);
    assert.ok(![...f.values.keys()].some(key => key.includes(':coach-apa-evidence:')));
    await f.originalsUnchanged();
  });
});

test('atomic final private read retries concurrent session revocation instead of disclosing the committed artifact', async () => {
  const f = await fixture(), draft = await f.prepare(); let fired = false;
  f.redis.beforeEval = async ({ keys, next, values }) => {
    if (fired || keys.length !== 3 || next.some(value => value !== '')) return;
    const state = JSON.parse(values.get(`${f.repo.prefix}:${f.key}`));
    if (!state.currentApa) return;
    fired = true;
    const key = `${f.repo.prefix}:account:${f.account.id}`, account = JSON.parse(values.get(key));
    account.sessionVersion++; values.set(key, JSON.stringify(account));
  };
  await assert.rejects(f.action(f.publishCommand(draft)), /SESSION_EXPIRED/u);
  assert.equal(fired, true); assert.equal((await f.raw()).currentApa.version, 1);
  assert.equal((await f.raw()).apaDraft, null); assert.equal(f.calls.length, 1); await f.originalsUnchanged();
});

test('a provider result cannot stage after lease expiry, changed source message or accepted plan', async t => {
  for (const [name, mutate] of [
    ['lease', f => { f.advance(630001); }],
    ['message', f => f.patch(f.key, state => { state.messages[0].text += ' Different current detail.'; })],
    ['plan', f => f.patch(f.key, state => { state.plan.title = 'Independently changed accepted plan'; })],
  ]) await t.test(name, async () => {
    const started = deferred(), finish = deferred();
    const f = await fixture({ transportHook: async request => { started.resolve(); await finish.promise; return typedResponse(request); } });
    const confirmation = await f.confirm(), pending = f.action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 });
    await started.promise; await mutate(f); finish.resolve(); await pending;
    const saved = await f.raw(); assert.equal(saved.status, 'unknown'); assert.ok(saved.pendingAttempt);
    assert.equal(saved.apaDraft, null); assert.equal(saved.currentApa, null); assert.equal(f.calls.length, 1);
    if (name !== 'plan') await f.originalsUnchanged();
  });
});

test('pending operation task/status/source binding cannot be changed into authority for an arriving result', async t => {
  for (const [name, change] of Object.entries({
    task: state => { state.pendingAttempt.task = 'CHAT'; },
    pendingTask: state => { state.pendingTask = 'CHAT'; },
    status: state => { state.status = 'active'; },
    binding: state => { state.pendingAttempt.sourceBinding.apa = 'a'.repeat(64); },
  })) await t.test(name, async () => {
    const started = deferred(), finish = deferred();
    const f = await fixture({ transportHook: async request => { started.resolve(); await finish.promise; return typedResponse(request); } });
    const confirmation = await f.confirm(), pending = f.action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 });
    await started.promise; await f.patch(f.key, change); finish.resolve(); await pending;
    const saved = await f.raw(); assert.equal(saved.status, 'unknown'); assert.equal(saved.pendingAttempt.errorCode, 'COACH_OPERATION_MISMATCH');
    assert.equal(saved.apaDraft, null); assert.equal(saved.currentApa, null); assert.equal(f.calls.length, 1); await f.originalsUnchanged();
  });
});

test('canonical APA reassessment is visible but only explicit source refresh archives previous continuity without altering evidence', async () => {
  const f = await fixture(), draft = await f.prepare(); await f.action(f.publishCommand(draft));
  const before = await f.raw(), changedApa = clone(f.bundle.apa);
  changedApa.report.headline += ' A new fictional reassessment.';
  delete changedApa.artifact_sha256; changedApa.artifact_sha256 = hash(changedApa);
  await f.repo.putImmutable(`report:${f.mm}:apa:${OTHER_MESSAGE}`, { artifact: changedApa, input: { source: { mm: f.mm } } });
  await f.patch(`dossier:${f.mm}`, dossier => { dossier.reports.apa.currentVersionId = OTHER_MESSAGE; dossier.reports.apa.artifactHash = changedApa.artifact_sha256; });
  const read = await f.service.state(f.account, { mm: f.mm });
  assert.equal(read.state.sourceUpdateAvailable, true); assert.equal(read.state.continuity.stale, true);
  assert.equal(read.state.continuity.current, null); assert.equal(read.state.continuity.draft, null);
  assert.deepEqual((await f.raw()).currentApa, before.currentApa);
  await assert.rejects(f.action({ action: 'refresh_sources', confirm: false }), /SOURCE_UPDATE_CONFIRMATION_REQUIRED/u);
  await f.action({ action: 'refresh_sources', confirm: true });
  const saved = await f.raw(); assert.equal(saved.currentApa, null); assert.equal(saved.apaDraft, null);
  assert.deepEqual(saved.apaConfirmedChanges, []); assert.equal(saved.apaSourceArchive.length, 1);
  assert.deepEqual(saved.apaSourceArchive[0].currentApa, before.currentApa);
  assert.deepEqual(saved.apaSourceArchive[0].confirmedChanges, before.apaConfirmedChanges);
  assert.deepEqual(saved.apaSourceArchive[0].sourceBinding, before.sourceBinding);
  assert.equal(saved.sourceBinding.apa, changedApa.artifact_sha256); assert.deepEqual(saved.plan.steps, before.plan.steps);
  assert.equal(saved.plan.title, before.plan.title); assert.deepEqual(saved.learning, before.learning);
  assert.deepEqual(await f.repo.read(`report:${f.mm}:apa:${APA_VERSION}`), f.original.reports[1]);
});

test('superseded operation attempt cannot stage into its replacement and unknown recovery cannot publish it', async () => {
  const started = deferred(), finish = deferred();
  const f = await fixture({ transportHook: async request => { started.resolve(); await finish.promise; return typedResponse(request); } });
  const confirmation = await f.confirm(), pending = f.action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 });
  await started.promise;
  await f.patch(f.key, state => { state.pendingAttempt.id = OTHER_MESSAGE; });
  const before = await f.raw(); finish.resolve(); await pending;
  assert.deepEqual(await f.raw(), before); assert.equal((await f.raw()).apaDraft, null); assert.equal(f.calls.length, 1);
  await f.patch(f.key, state => { state.status = 'unknown'; });
  await assert.rejects(f.action({ action: 'recover' }), /RESULT_NOT_YET_RECOVERABLE/u);
  assert.equal(f.calls.length, 1); await f.originalsUnchanged();
});

test('actual server baseline/draft/published/cold-replay records interoperate with pure UI review commands', async () => {
  const f = await fixture();
  const baseline = (await f.service.state(f.account, { mm: f.mm })).state;
  assert.equal(continuityView(f.bundle, baseline).verified, true);
  const confirm = confirmApaCommand(f.bundle, baseline, { source_message_id: MESSAGE, reason: 'I explicitly reviewed this saved message.', kind: 'reality' });
  const confirmed = (await f.action(confirm)).state, confirmationId = confirmed.continuity.changes.at(-1).id;
  const prepare = prepareApaCommand(f.bundle, confirmed, confirmationId);
  assert.deepEqual(prepare, { action: 'update_apa', confirmation_id: confirmationId, expected_version: 0 });
  const staged = (await f.action(prepare)).state, draft = staged.continuity.draft;
  assert.equal(continuityView(f.bundle, staged).verified, true, 'actual server draft must verify in the client');
  assert.equal(continuityView(f.bundle, staged, { reading: 'preview' }).artifact.artifact_sha256, draft.previewRecord.artifact.artifact_sha256);
  const publication = publishApaCommand(f.bundle, staged, { review: { key: apaDraftKey(draft), boxes: [...APA_BOXES] }, confirmedTiming: true });
  assert.deepEqual(publication, f.publishCommand(draft));
  const published = (await f.action(publication)).state;
  assert.equal(continuityView(f.bundle, published).verified, true); assert.equal(continuityView(f.bundle, published).version, 1);
  const coldService = createCoachingService({ repo: f.repo, config: f.config, academy: f.academy, transport: async () => { throw new Error('OFFLINE_UNEXPECTED_DISPATCH'); }, now: f.now });
  const cold = (await coldService.state(f.account, { mm: f.mm })).state;
  assert.equal(continuityView(f.bundle, clone(cold)).verified, true); assert.deepEqual(cold.continuity.current, published.continuity.current);
  assert.equal(f.calls.length, 1); await f.originalsUnchanged();
});

test('complete stored response after lost receipt recovers a private draft without provider or automatic publication', async () => {
  const f = await lostReceiptFixture(), evidenceBefore = [...f.values.entries()].filter(([key]) => key.includes(':coach-apa-evidence:'));
  const recoveryRequest = await f.command({ action: 'recover' });
  await f.service.action(f.account, recoveryRequest);
  const recovered = await f.raw(); assert.equal(recovered.status, 'active'); assert.equal(recovered.pendingAttempt, undefined);
  assert.ok(recovered.apaDraft); assert.equal(recovered.currentApa, null); assert.equal(recovered.apaDraft.previewRecord.version, 1);
  const event = recovered.events.at(-1); assert.equal(event.type, 'current_apa_response_recovered');
  assert.equal(event.noProviderCall, true); assert.equal(event.publicationPerformed, false);
  assert.deepEqual([...f.values.entries()].filter(([key]) => key.includes(':coach-apa-evidence:')), evidenceBefore);
  assert.equal(f.calls.length, 1); await f.originalsUnchanged();
  await f.action(f.publishCommand(recovered.apaDraft)); assert.equal((await f.raw()).currentApa.version, 1);
  assert.equal(f.calls.length, 1); await f.originalsUnchanged();
});

test('exact recovery request replay is idempotent and cannot dispatch or stage a second draft', async () => {
  const f = await lostReceiptFixture(), request = await f.command({ action: 'recover' });
  await f.service.action(f.account, request); const recovered = await f.raw();
  await f.service.action(f.account, request); assert.deepEqual(await f.raw(), recovered);
  assert.equal(f.calls.length, 1); assert.equal(recovered.events.filter(event => event.type === 'current_apa_response_recovered').length, 1);
  await assert.rejects(f.service.action(f.account, { ...request, command: { action: 'recover', confirm: true } }), /REQUEST_ID_CONFLICT|COACH_COMMAND_INVALID|CURRENT_APA_COMMAND_INVALID/u);
});

test('recovery rejects immutable event/request/actor/hash/response tamper without dispatch or staging', async t => {
  const cases = {
    'request id': { kind: 'request', change: event => { event.id = OTHER_MESSAGE; }, code: /APA_COMPOSITION_RECOVERY_ID_MISMATCH/u },
    'response id': { kind: 'response', change: event => { event.id = OTHER_MESSAGE; }, code: /APA_COMPOSITION_RECOVERY_ID_MISMATCH/u },
    'request hash': { kind: 'request', change: event => { event.basis.request_sha256 = 'a'.repeat(64); }, code: /APA_COMPOSITION_RECOVERY_REQUEST_MISMATCH/u },
    'actor': { kind: 'request', change: event => { event.basis.actorId = 'fictional-other'; }, code: /APA_COMPOSITION_RECOVERY_BASIS_MISMATCH/u },
    'MM': { kind: 'request', change: event => { event.basis.mm = 'MM-FICTIONAL-OTHER'; }, code: /APA_COMPOSITION_RECOVERY_BASIS_MISMATCH/u },
    'packet hash': { kind: 'request', change: event => { event.basis.packet_sha256 = 'a'.repeat(64); }, code: /APA_COMPOSITION_RECOVERY_BASIS_MISMATCH/u },
    'request content rehashed': { kind: 'request', change: event => { event.request.input += ' '; event.basis.request_sha256 = digest(event.request); }, code: /APA_COMPOSITION_RECOVERY_REQUEST_MISMATCH/u },
    'wrong response model': { kind: 'response', change: event => { event.response.model = 'other-model'; }, code: /APA_COMPOSITION_MODEL_MISMATCH/u },
    'incomplete response': { kind: 'response', change: event => { event.response.status = 'incomplete'; }, code: /APA_COMPOSITION_RESPONSE_INCOMPLETE/u },
    'cross-account delta': { kind: 'response', change: event => { const delta = JSON.parse(event.response.output_text); delta.binding.actorId = 'fictional-other'; event.response.output_text = JSON.stringify(delta); }, code: /APA_COMPOSITION_RESPONSE_INVALID/u },
  };
  for (const [name, check] of Object.entries(cases)) await t.test(name, async () => {
    const f = await lostReceiptFixture(), before = await f.raw(), attempt = before.pendingAttempt.id;
    await f.patch(`coach-apa-evidence:${f.mm}:${attempt}:${check.kind}`, check.change);
    const evidence = [...f.values.entries()].filter(([key]) => key.includes(':coach-apa-evidence:'));
    await assert.rejects(f.action({ action: 'recover' }), check.code);
    assert.deepEqual(await f.raw(), before); assert.equal(f.calls.length, 1);
    assert.deepEqual([...f.values.entries()].filter(([key]) => key.includes(':coach-apa-evidence:')), evidence); await f.originalsUnchanged();
  });
});

test('recovery rechecks account, participation, source/version and unresolved attempt before any private stage', async t => {
  const cases = [
    ['revoked account', f => f.patch(`account:${f.account.id}`, account => { account.sessionVersion++; }), /SESSION_EXPIRED/u],
    ['withdrawn', f => f.patch(`dossier:${f.mm}`, dossier => { dossier.participation.status = 'withdrawn'; }), /PARTICIPATION_WITHDRAWN/u],
    ['message drift', f => f.patch(f.key, state => { state.messages[0].text += ' Another reality.'; }), /CURRENT_APA_RESULT_UNAVAILABLE/u],
    ['version', f => f.patch(f.key, state => { state.pendingAttempt.currentVersion = 1; }), /CURRENT_APA_RESULT_UNAVAILABLE/u],
    ['active unexpired', f => f.patch(f.key, state => { state.status = 'working'; }), /ATTEMPT_STILL_ACTIVE/u],
  ];
  for (const [name, change, code] of cases) await t.test(name, async () => {
    const f = await lostReceiptFixture(); await change(f); const before = await f.raw();
    await assert.rejects(f.action({ action: 'recover' }), code);
    assert.deepEqual(await f.raw(), before); assert.equal(f.calls.length, 1);
    assert.equal(before.apaDraft, null); assert.equal(before.currentApa, null); await f.originalsUnchanged();
  });
});

test('unknown pre-commit storage acknowledgement keeps the exact attempt recoverable after expiry with no retry dispatch', async () => {
  const f = await fixture(), confirmation = await f.confirm(); let fired = false;
  f.redis.beforeEval = async ({ keys, next }) => {
    if (fired || keys.length !== 3) return;
    const index = keys.indexOf(`${f.repo.prefix}:${f.key}`);
    if (index < 0 || !next[index]) return;
    const state = JSON.parse(next[index]);
    if (!state.apaDraft || state.pendingAttempt) return;
    fired = true; throw new Error('OFFLINE_UNKNOWN_CAS_ACK');
  };
  await assert.rejects(f.action({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 }), /STORAGE_OUTCOME_UNKNOWN/u);
  const pending = await f.raw(); assert.equal(fired, true); assert.equal(pending.status, 'working');
  assert.ok(pending.pendingAttempt); assert.equal(pending.apaDraft, null); assert.equal(f.calls.length, 1);
  f.advance(630001); const request = await f.command({ action: 'recover' });
  await f.service.action(f.account, request);
  const recovered = await f.raw(); assert.ok(recovered.apaDraft); assert.equal(recovered.currentApa, null);
  assert.equal(recovered.pendingAttempt, undefined); assert.equal(recovered.events.at(-1).noProviderCall, true);
  await f.service.action(f.account, request); assert.deepEqual(await f.raw(), recovered);
  assert.equal(f.calls.length, 1); await f.originalsUnchanged();
});

test('lost post-commit storage acknowledgement is observed by exact request replay without another model or draft', async () => {
  const f = await fixture(), confirmation = await f.confirm(); let fired = false;
  f.redis.afterEval = async ({ keys, next }) => {
    if (fired || keys.length !== 3) return;
    const index = keys.indexOf(`${f.repo.prefix}:${f.key}`);
    if (index < 0 || !next[index]) return;
    const state = JSON.parse(next[index]);
    if (!state.apaDraft || state.pendingAttempt) return;
    fired = true; throw new Error('OFFLINE_UNKNOWN_CAS_ACK');
  };
  const request = await f.command({ action: 'update_apa', confirmation_id: confirmation.id, expected_version: 0 });
  await assert.rejects(f.service.action(f.account, request), /STORAGE_OUTCOME_UNKNOWN/u);
  const durable = await f.raw(); assert.equal(fired, true); assert.ok(durable.apaDraft); assert.equal(durable.currentApa, null);
  await f.service.action(f.account, request); assert.deepEqual(await f.raw(), durable);
  assert.equal(f.calls.length, 1); await f.originalsUnchanged();
});

test('ordinary Coach output cannot publish an APA and future input reads only explicitly published current artifact', async () => {
  const f = await fixture(); let coachCalls = 0,transportFailure;
  const checkTransport = async request => {
    coachCalls++; const input = JSON.parse(request.input);
    const saved = await f.raw(), current = saved.currentApa?.artifact || f.bundle.apa;
    assert.equal(input.full_youth_apa.artifact_sha256, current.artifact_sha256);
    assert.equal(input.apa_currency.version, saved.currentApa?.version || 0);
    assert.equal(input.apa_currency.baseline_apa_sha256, f.bundle.apa.artifact_sha256);
    assert.equal(input.apa_currency.source, saved.currentApa
      ? 'Explicitly athlete-reviewed private publication; original assessment/BOS and accepted plan remain separate.'
      : 'Original saved assessment; no current APA update has been published. Original BOS and accepted plan remain separate.');
    if (saved.apaDraft) assert.notEqual(input.full_youth_apa.artifact_sha256, saved.apaDraft.previewRecord.artifact.artifact_sha256);
    assert.deepEqual(input.full_youth_bos, f.bundle.bos.reading);
    return { status: 'completed', model: 'gpt-5.6-sol', output_text: JSON.stringify({ reply: 'Your saved current picture is available for discussion.', plan: null, plan_change: 'none', retire_draft: false, learning: [], recap: '' }) };
  };
  const transport=async request=>{try{return await checkTransport(request);}catch(e){transportFailure=e;throw e;}};
  const coaching = createCoachingService({ repo: f.repo, config: f.config, academy: f.academy, transport, now: f.now });
  await coaching.action(f.account, await f.command({ action: 'message', text: 'Discuss my original assessment without changing any report.' }));
  if(transportFailure)throw transportFailure;
  assert.equal((await f.raw()).status,'active',(await f.raw()).pendingAttempt?.errorCode);
  assert.equal((await f.raw()).currentApa, null); assert.equal((await f.raw()).apaDraft, null);
  const draft = await f.prepare();
  await coaching.action(f.account, await f.command({ action: 'message', text: 'Discuss only my published picture, not my private unaccepted proposal.' }));
  assert.equal((await f.raw()).currentApa, null); assert.deepEqual((await f.raw()).apaDraft, draft);
  await f.action(f.publishCommand(draft));
  const before = await f.raw();
  await coaching.action(f.account, await f.command({ action: 'message', text: 'Please discuss my current picture without changing my plan.' }));
  const after = await f.raw(); assert.equal(coachCalls, 3); assert.deepEqual(after.currentApa, before.currentApa);
  assert.equal(after.apaDraft, null); assert.deepEqual(after.apaConfirmedChanges, before.apaConfirmedChanges); await f.originalsUnchanged();
});
