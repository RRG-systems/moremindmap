// Fictional-only actual service/CAS integration. No network, runtime, Redis socket or provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { createRedisRepository, CAS_LUA, digest } from '../server/athleteAcademyV1/repository.js';
import { createAcademyService } from '../server/athleteAcademyV1/service.js';
import { createCoachingService } from '../server/athleteAcademyV1/coaching/service.js';
import { createCoachNotesService } from '../server/athleteAcademyV1/coaching/coachNotes.js';
import { COACH_NOTES_POLICY_VERSION, COACH_NOTES_PURPOSE, claimedNoteIds } from '../server/athleteAcademyV1/coaching/coachNotesPolicy.js';
import { initialCoachState } from '../server/athleteAcademyV1/coaching/state.js';
import { hash } from '../server/athleteAcademyV1/coaching/bundle.js';

const clone = value => structuredClone(value);
const AT = Date.parse('2026-09-27T18:01:00.000Z');
const BOS_VERSION = '22222222-2222-4222-8222-222222222222';
const APA_VERSION = '33333333-3333-4333-8333-333333333333';
const NOTE_TEXT = 'Fictional-only observation: steadier passing before the water break. Ask the athlete what they noticed; do not rewrite their APA.';
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function coachResponse(task, overrides = {}) {
  return { status: 'completed', model: 'gpt-5.6-sol', usage: { total_tokens: 0 },
    output_text: JSON.stringify({ reply: 'We can discuss what you noticed without changing your saved reports.',
      plan: null, plan_change: 'none', retire_draft: false, learning: [],
      recap: task === 'CLOSE' ? 'Discussion only. No new plan, learning or assessment was accepted.' : '', ...overrides }) };
}
async function fixture({ enabled = true, failReceiptOnce = false, transportHook = null } = {}) {
  const values = new Map();
  const redis = { beforeEval: null, afterEval: null,
    async get(key) { return values.get(key) ?? null; },
    async eval(script, count, ...args) {
      assert.equal(script, CAS_LUA);
      const keys = args.slice(0, count), prior = args.slice(count, count * 2), next = args.slice(count * 2);
      assert.equal(next.length, count);
      if (redis.beforeEval) await redis.beforeEval({ keys, prior, next, values });
      if (keys.some((key, index) => (values.get(key) ?? '') !== prior[index])) return 0;
      keys.forEach((key, index) => { if (next[index] !== '') values.set(key, next[index]); });
      if (redis.afterEval) await redis.afterEval({ keys, prior, next, values });
      return 1;
    } };
  const baseRepo = createRedisRepository({ redis, prefix: 'more:athlete-academy:{test-note-continuity}' });
  let clock = AT, requestSequence = 0, noteSequence = 0, lost = false;
  const repo = failReceiptOnce ? Object.freeze({ ...baseRepo, async putImmutable(key, value) {
    if (!lost && key.startsWith('coach-evidence:') && key.endsWith(':receipt')) {
      lost = true; throw new Error('OFFLINE_FICTIONAL_RECEIPT_ACK_LOST');
    }
    return baseRepo.putImmutable(key, value);
  } }) : baseRepo;
  const mm = 'MM-FICTIONAL-NOTE-REPLAY', actorId = 'fictional-note-owner';
  const replace = value => JSON.parse(JSON.stringify(value).replaceAll(nia.person.mm, mm).replaceAll('Nia', 'Mira Fictional'));
  const bos = replace(nia.bos), apa = replace(nia.apa), source = replace(nia.bos_source);
  bos.mm = mm; bos.synthetic = false; bos.subject.age = 18;
  delete bos.artifact_sha256; bos.artifact_sha256 = hash(bos);
  apa.mm = mm; apa.synthetic = false; apa.identity.age = 18;
  apa.identity.reading_sha256 = hash(bos); apa.bos_sha256 = hash(bos);
  delete apa.artifact_sha256; apa.artifact_sha256 = hash(apa);
  const person = { mm, name: 'Mira Fictional', dateOfBirth: '2008-02-01', age: 18, sport: 'Volleyball' };
  source.person = { ...source.person, ...person };
  const owner = { id: actorId, mm, email: 'mira@test.invalid', displayName: 'Mira Fictional', verified: true, sessionVersion: 1, role: 'participant' };
  const observer = { id: 'fictional-coach-observer', mm: 'MM-FICTIONAL-OBSERVER', email: 'observer@test.invalid',
    displayName: 'Coach Fictional Alex', verified: true, sessionVersion: 1, role: 'participant' };
  const other = { id: 'fictional-unrelated-account', mm: 'MM-FICTIONAL-OTHER', email: 'other@test.invalid',
    displayName: 'Other Fictional', verified: true, sessionVersion: 1, role: 'participant' };
  const config = { currentApaEnabled: true, providerEnabled: true, coachNotesEnabled: enabled,
    coachNotesPolicyVersion: COACH_NOTES_POLICY_VERSION, realYouthEnabled: false,
    syntheticPreview: true, reviewedPolicyVersion: 'offline-note-continuity-v1' };
  const dossier = { mm, ownerId: actorId, synthetic: false, archived: false, revision: 0, person,
    entitlements: { bos: true, apa: true, coach: true },
    participation: { athleteAccepted: true, status: 'self_authorized', policyVersion: config.reviewedPolicyVersion },
    reports: { bos: { currentVersionId: BOS_VERSION, artifactHash: bos.artifact_sha256 },
      apa: { currentVersionId: APA_VERSION, artifactHash: apa.artifact_sha256, bosVersionId: BOS_VERSION } },
    jobs: [], events: [], intake: { bos: {}, apa: {} } };
  const reportKeys = [`report:${mm}:bos:${BOS_VERSION}`, `report:${mm}:apa:${APA_VERSION}`];
  const docs = { [`account:${owner.id}`]: owner, [`account:${observer.id}`]: observer, [`account:${other.id}`]: other,
    [`email:${digest(observer.email)}`]: { id: observer.id }, [`email:${digest(other.email)}`]: { id: other.id },
    [`dossier:${mm}`]: dossier, [reportKeys[0]]: { artifact: bos, input: { subject: source } },
    [reportKeys[1]]: { artifact: apa, input: { source: { mm } } } };
  await repo.transact(Object.keys(docs), () => ({ writes: docs, result: true }));
  const now = () => clock, calls = [];
  const transport = async (request, options) => {
    const packet = JSON.parse(request.input);
    assert.equal(request.store, false); assert.equal(options.maxRetries, 0);
    calls.push({ request, options, packet });
    return transportHook ? transportHook(request, options, packet) : coachResponse(packet.task);
  };
  const auth = { event: (type, actor, extra = {}) => ({ type, actor, ...extra, at: new Date(clock).toISOString() }) };
  const academy = createAcademyService({ repo, config, auth, transport, now });
  const notesService = createCoachNotesService({ repo, config, academy, now,
    makeId: () => `${(++noteSequence).toString(16).padStart(8, '0')}-1111-4111-8111-111111111111` });
  const service = createCoachingService({ repo, config, academy, notes: notesService, transport, now });
  const bundle = await service.bundle(owner, { mm }), state = initialCoachState(bundle);
  state.plan = { id: '44444444-4444-4444-8444-444444444444', title: 'Previously accepted private plan',
    why: 'The athlete separately chose this.', steps: [{ action: 'Notice one calm pass.', when: 'Next practice', notice: 'One observation', owner: 'athlete' }],
    review: 'At the next chosen review', accepted_at: '2026-09-26T18:00:00.000Z' };
  state.learning = [{ id: '55555555-5555-4555-8555-555555555555', text: 'I prefer one short reminder.', confirmed_by: 'athlete' }];
  const key = `coach:${mm}`, boxKey = `coach-notes:${mm}`;
  await repo.transact([key], () => ({ writes: { [key]: state }, result: true }));
  const original = { reports: await Promise.all(reportKeys.map(key => repo.read(key))), dossier: clone(dossier),
    plan: clone(state.plan), learning: clone(state.learning), currentApa: state.currentApa, apaDraft: state.apaDraft,
    confirmedChanges: state.apaConfirmedChanges, sourceBinding: clone(state.sourceBinding) };
  const raw = () => repo.read(key), box = () => repo.read(boxKey);
  const body = fields => ({ requestId: `offline-note-replay-${++requestSequence}`, ...fields });
  const command = async (value, overrides = {}) => body({ mm, revision: (await raw()).revision, command: value, ...overrides });
  const action = async (value, overrides = {}) => service.action(owner, await command(value, overrides));
  const patch = (docKey, change) => repo.transact([docKey], saved => {
    const next = clone(saved[docKey]); change(next); return { writes: { [docKey]: next }, result: true };
  });
  const invite = () => notesService.invite(owner, body({ mm, recipient_email: observer.email,
    purpose: COACH_NOTES_PURPOSE, policy_version: COACH_NOTES_POLICY_VERSION, next_opening_context: true,
    expires_at: new Date(clock + 86400000).toISOString() }));
  const accept = g => notesService.accept(observer, body({ mm, grant_id: g.terms.id, grant_version: g.version,
    terms_hash: g.terms_hash, policy_version: COACH_NOTES_POLICY_VERSION, accepted: true }));
  const append = g => notesService.append(observer, body({ mm, grant_id: g.terms.id, grant_version: g.version,
    text: NOTE_TEXT, reviewed: true }));
  const ready = async () => {
    const pending = (await invite()).invitation;
    assert.equal(pending.status, 'pending');
    const grant = (await accept(pending)).grant;
    const note = (await append(grant)).receipt;
    return { grant, note };
  };
  const revoke = g => notesService.revoke(owner, body({ mm, grant_id: g.terms.id, grant_version: g.version }));
  const immutableEvidence = () => [...values.entries()].filter(([key]) => key.includes(':coach-evidence:'));
  const originalsUnchanged = async ({ dossierChanged = false } = {}) => {
    assert.deepEqual(await Promise.all(reportKeys.map(key => repo.read(key))), original.reports);
    if (!dossierChanged) assert.deepEqual(await repo.read(`dossier:${mm}`), original.dossier);
    const saved = await raw();
    assert.deepEqual(saved.plan, original.plan); assert.deepEqual(saved.learning, original.learning);
    assert.deepEqual(saved.currentApa, original.currentApa); assert.deepEqual(saved.apaDraft, original.apaDraft);
    assert.deepEqual(saved.apaConfirmedChanges, original.confirmedChanges);
  };
  return { repo, redis, values, owner, observer, other, config, academy, notesService, service, bundle, mm, key, boxKey,
    original, raw, box, body, command, action, patch, invite, accept, append, ready, revoke,
    immutableEvidence, originalsUnchanged, calls, now, advance: ms => { clock += ms; } };
}
async function unknownFixture() {
  const f = await fixture({ failReceiptOnce: true });
  const ready = await f.ready(); await f.action({ action: 'start' });
  const saved = await f.raw();
  assert.equal(saved.status, 'unknown'); assert.equal(saved.pendingTask, 'OPENING');
  assert.ok(saved.pendingAttempt.coachNoteReservation);
  assert.equal(f.calls.length, 1, `Expected injected call; saved code ${saved.pendingAttempt?.errorCode || 'none'}`);
  assert.equal((await f.box()).attempts[0].status, 'dispatched');
  await f.originalsUnchanged(); return { ...f, ...ready };
}
async function unadmittedFixture() {
  const f = await fixture(), ready = await f.ready(); let stopped = false;
  f.redis.beforeEval = async ({ next, values }) => {
    if (stopped || next.some(value => value !== '')) return;
    const state = JSON.parse(values.get(`${f.repo.prefix}:${f.key}`));
    if (state.pendingTask !== 'OPENING' || !state.pendingAttempt?.coachNoteReservation) return;
    stopped = true; throw new Error('OFFLINE_FICTIONAL_PREFLIGHT_UNAVAILABLE');
  };
  await f.action({ action: 'start' }); f.redis.beforeEval = null;
  const state = await f.raw(), box = await f.box();
  assert.equal(stopped, true); assert.equal(f.calls.length, 0);
  assert.equal(state.status, 'unknown'); assert.equal(state.pendingTask, 'OPENING');
  assert.equal(state.pendingAttempt.coachNoteEvidenceId, undefined);
  assert.equal(box.attempts[0].status, 'reserved');
  assert.equal(box.attempts[0].evidence_id, null); assert.equal(box.attempts[0].dispatched_at, null);
  assert.deepEqual(f.immutableEvidence(), []); await f.originalsUnchanged();
  return { ...f, ...ready };
}

test('default-off note integration exposes no capability or observation packet and performs no note mutation', async () => {
  const f = await fixture({ enabled: false });
  await assert.rejects(f.invite(), /COACH_NOTES_NOT_ACTIVE/u);
  const result = await f.service.state(f.owner, { mm: f.mm });
  assert.equal(result.state.capabilities?.coachNotes, undefined);
  const opened = await f.action({ action: 'start' });
  assert.equal(opened.state.capabilities?.coachNotes, undefined);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].packet.reviewed_coach_observations, undefined);
  assert.equal(await f.box(), null); await f.originalsUnchanged();
});

test('exact owner invitation and recipient reviewed-send feeds actual OPENING once with durable receipt and no owner ack prerequisite', async () => {
  const f = await fixture(), { grant, note } = await f.ready();
  assert.equal(grant.status, 'active'); assert.equal(grant.version, 2);
  assert.equal((await f.box()).reviews.length, 0);
  assert.equal(note.review_status, 'reviewed-send'); assert.equal(note.reviewed_by, f.observer.id);
  assert.equal(note.owner_acknowledged, false); assert.equal(note.status, 'queued');
  const request = await f.command({ action: 'start' });
  const opened = await f.service.action(f.owner, request);
  assert.equal(opened.state.capabilities.coachNotes, true);
  const saved = await f.raw(), box = await f.box();
  assert.equal(f.calls.length, 1, `Expected injected call; saved code ${saved.pendingAttempt?.errorCode || 'none'}`);
  const packet = f.calls[0].packet;
  assert.equal(packet.task, 'OPENING');
  assert.equal(packet.athlete.actorId, f.owner.id); assert.equal(packet.athlete.mm, f.mm);
  assert.equal(f.config.currentApaEnabled, true);
  assert.equal(packet.apa_currency.contract, 'athlete_academy_current_apa_v1');
  assert.equal(packet.apa_currency.version, 0);
  assert.equal(packet.apa_currency.baseline_apa_sha256, f.bundle.apa.artifact_sha256);
  assert.equal(packet.apa_currency.current_apa_sha256, f.bundle.apa.artifact_sha256);
  assert.equal(packet.full_youth_apa.artifact_sha256, f.bundle.apa.artifact_sha256);
  assert.equal(packet.apa_currency.source, 'Original saved assessment; no current APA update has been published. Original BOS and accepted plan remain separate.');
  assert.equal(packet.reviewed_coach_observations.length, 1);
  const observation = packet.reviewed_coach_observations[0];
  assert.equal(observation.id, note.id); assert.equal(observation.author_id, f.observer.id);
  assert.equal(observation.author_name, f.observer.displayName); assert.equal(observation.text, NOTE_TEXT);
  assert.match(observation.interpretation, /unverified observation.*no BOS, APA, learning or plan authority/u);
  assert.equal(packet.conversation.some(message => message.text === NOTE_TEXT), false);
  assert.equal(saved.messages.some(message => message.text === NOTE_TEXT || message.capture), false);
  assert.equal(saved.status, 'active'); assert.equal(saved.pendingAttempt, undefined);
  assert.equal(box.attempts.length, 1); assert.equal(box.attempts[0].status, 'delivered');
  assert.deepEqual(box.attempts[0].reservation.note_ids, [note.id]); assert.ok(box.attempts[0].evidence_id);
  const event = saved.events.find(event => event.type === 'reviewed_coach_observations_delivered');
  assert.deepEqual(event.note_ids, [note.id]); assert.equal(event.noApaPlanOrLearningChange, true);
  await f.service.action(f.owner, request);
  assert.equal(f.calls.length, 1); assert.deepEqual(await f.box(), box); assert.deepEqual(await f.raw(), saved);
  await f.originalsUnchanged();
});

test('CHAT and CLOSE do not reinsert delivered observations into request/history or change original reports/accepted choices', async () => {
  const f = await fixture(); await f.ready(); await f.action({ action: 'start' });
  const delivered = await f.box();
  await f.action({ action: 'message', text: 'Discuss today without changing my APA, accepted plan or learning.' });
  await f.action({ action: 'close' });
  assert.deepEqual(f.calls.map(call => call.packet.task), ['OPENING', 'CHAT', 'CLOSE']);
  for (const { packet } of f.calls.slice(1)) {
    assert.equal(packet.reviewed_coach_observations, undefined);
    assert.equal(packet.conversation.some(message => message.text === NOTE_TEXT || message.capture), false);
  }
  assert.deepEqual(await f.box(), delivered);
  assert.equal((await f.raw()).events.filter(event => event.type === 'reviewed_coach_observations_delivered').length, 1);
  await f.originalsUnchanged();
});

test('new session cannot deliver an already consumed note a second time', async () => {
  const f = await fixture(); await f.ready(); await f.action({ action: 'start' });
  const delivered = await f.box();
  await f.action({ action: 'reset' }); await f.action({ action: 'start' });
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].packet.reviewed_coach_observations, undefined);
  assert.deepEqual(await f.box(), delivered); await f.originalsUnchanged();
});

test('a note reviewed and sent during an active session waits for the next OPENING and excludes previously delivered notes', async () => {
  const f = await fixture(), { grant, note: first } = await f.ready();
  await f.action({ action: 'start' });
  const second = (await f.append(grant)).receipt;
  assert.notEqual(second.id, first.id);
  await f.action({ action: 'message', text: 'Only discuss this message; do not adopt notes as choices.' });
  await f.action({ action: 'close' });
  assert.equal(f.calls[1].packet.reviewed_coach_observations, undefined);
  assert.equal(f.calls[2].packet.reviewed_coach_observations, undefined);
  assert.equal((await f.box()).attempts.length, 1);
  await f.action({ action: 'reset' }); await f.action({ action: 'start' });
  assert.deepEqual(f.calls[3].packet.reviewed_coach_observations.map(note => note.id), [second.id]);
  const box = await f.box();
  assert.equal(box.attempts.length, 2); assert.ok(box.attempts.every(attempt => attempt.status === 'delivered'));
  assert.deepEqual(box.attempts.map(attempt => attempt.reservation.note_ids), [[first.id], [second.id]]);
  await f.originalsUnchanged();
});

test('observer and unrelated actor cannot Start My Session or read this athlete private state', async () => {
  const f = await fixture(); await f.ready(); const before = await f.raw(), box = await f.box();
  for (const actor of [f.observer, f.other]) {
    await assert.rejects(f.service.action(actor, await f.command({ action: 'start' })), /NOT_FOUND/u);
    await assert.rejects(f.service.state(actor, { mm: f.mm }), /NOT_FOUND/u);
  }
  assert.equal(f.calls.length, 0); assert.deepEqual(await f.raw(), before); assert.deepEqual(await f.box(), box);
  await f.originalsUnchanged();
});

test('expired or revoked relationship before opening preserves note metadata but excludes note from model input', async t => {
  for (const name of ['revoked', 'expired']) await t.test(name, async () => {
    const f = await fixture(), { grant } = await f.ready();
    if (name === 'revoked') await f.revoke(grant); else f.advance(86400000);
    await f.action({ action: 'start' });
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].packet.reviewed_coach_observations, undefined);
    const box = await f.box(); assert.equal(box.notes.length, 1); assert.equal(box.attempts.length, 0);
    await f.originalsUnchanged();
  });
});

test('atomic OPENING preflight rejects revocation, recipient unavailability, owner session and source-version races before transport', async t => {
  for (const kind of ['revoked', 'recipient', 'session', 'source']) await t.test(kind, async () => {
    const f = await fixture(); await f.ready(); let fired = false;
    f.redis.beforeEval = async ({ next, values }) => {
      if (fired || next.some(value => value !== '')) return;
      const state = JSON.parse(values.get(`${f.repo.prefix}:${f.key}`));
      if (state.pendingTask !== 'OPENING' || state.pendingAttempt?.coachNoteEvidenceId) return;
      fired = true;
      const key = `${f.repo.prefix}:${kind === 'revoked' ? f.boxKey : kind === 'recipient' ? `account:${f.observer.id}`
        : kind === 'session' ? `account:${f.owner.id}` : `dossier:${f.mm}`}`;
      const value = JSON.parse(values.get(key));
      if (kind === 'revoked') { value.grants[0].status = 'revoked'; value.grants[0].version++;
        value.grants[0].revoked = { owner_id: f.owner.id, at: new Date(f.now()).toISOString() }; }
      else if (kind === 'recipient') value.verified = false;
      else if (kind === 'session') value.sessionVersion++;
      else value.reports.apa.currentVersionId = '66666666-6666-4666-8666-666666666666';
      values.set(key, JSON.stringify(value));
    };
    const pending = f.action({ action: 'start' });
    if (kind === 'session' || kind === 'source') await assert.rejects(pending, kind === 'session' ? /SESSION_EXPIRED/u : /COACH_SOURCES_CHANGED/u);
    else await pending;
    assert.equal(fired, true); assert.equal(f.calls.length, 0);
    assert.equal((await f.raw()).status, 'unknown'); assert.equal((await f.box()).attempts[0].status, 'reserved');
    await f.originalsUnchanged({ dossierChanged: kind === 'source' });
  });
});

test('revocation immediately after immutable request evidence but before dispatch is rechecked without provider admission', async () => {
  const f = await fixture(); await f.ready(); let fired = false;
  f.redis.afterEval = async ({ keys, next, values }) => {
    if (fired || !keys.some((key, index) => key.includes(':coach-evidence:') && key.endsWith(':request') && next[index])) return;
    fired = true;
    const key = `${f.repo.prefix}:${f.boxKey}`, box = JSON.parse(values.get(key));
    box.grants[0].status = 'revoked'; box.grants[0].version++;
    box.grants[0].revoked = { owner_id: f.owner.id, at: new Date(f.now()).toISOString() };
    values.set(key, JSON.stringify(box));
  };
  await f.action({ action: 'start' });
  assert.equal(fired, true); assert.equal(f.calls.length, 0);
  const saved = await f.raw(); assert.equal(saved.status, 'unknown');
  assert.equal(saved.pendingAttempt.coachNoteEvidenceId, undefined);
  assert.equal((await f.box()).attempts[0].status, 'reserved');
  assert.ok(f.immutableEvidence().some(([key]) => key.endsWith(':request')));
  assert.equal(f.immutableEvidence().some(([key]) => key.endsWith(':response')), false);
  await f.originalsUnchanged();
});

test('complete saved response after lost receipt recovers once with no provider rerun, no evidence replacement and durable delivered-once metadata', async () => {
  const f = await unknownFixture(), evidence = f.immutableEvidence(), request = await f.command({ action: 'recover' });
  const cold = createCoachingService({ repo: f.repo, config: f.config, academy: f.academy, notes: f.notesService,
    now: f.now, transport: async () => { throw new Error('OFFLINE_UNEXPECTED_PROVIDER_RERUN'); } });
  const recoveredResponse = await cold.action(f.owner, request);
  assert.equal(recoveredResponse.state.capabilities.coachNotes, true);
  const recovered = await f.raw(), delivered = await f.box();
  assert.equal(recovered.status, 'active'); assert.equal(recovered.pendingAttempt, undefined);
  assert.equal(delivered.attempts[0].status, 'delivered'); assert.equal(delivered.attempts.length, 1);
  assert.equal(recovered.events.at(-1).type, 'coach_response_recovered');
  assert.equal(recovered.events.at(-1).noProviderCall, true);
  assert.equal(recovered.events.filter(event => event.type === 'reviewed_coach_observations_delivered').length, 1);
  assert.equal(f.calls.length, 1); assert.deepEqual(f.immutableEvidence(), evidence);
  await cold.action(f.owner, request);
  assert.deepEqual(await f.raw(), recovered); assert.deepEqual(await f.box(), delivered);
  assert.equal(f.calls.length, 1); await f.originalsUnchanged();
});

test('unknown response cannot recover after relationship/session/participation/source fences change', async t => {
  const cases = [
    ['revoked', async f => f.revoke(f.grant), /COACH_NOTE_GRANT_UNAVAILABLE/u],
    ['expired', async f => f.advance(86400000), /COACH_NOTE_GRANT_UNAVAILABLE/u],
    ['recipient', f => f.patch(`account:${f.observer.id}`, account => { account.verified = false; }), /COACH_NOTE_RECIPIENT_UNAVAILABLE/u],
    ['session', f => f.patch(`account:${f.owner.id}`, account => { account.sessionVersion++; }), /SESSION_EXPIRED/u],
    ['withdrawn', f => f.patch(`dossier:${f.mm}`, dossier => { dossier.participation.status = 'withdrawn'; }), /PARTICIPATION_WITHDRAWN/u],
    ['source', f => f.patch(`dossier:${f.mm}`, dossier => { dossier.reports.apa.artifactHash = 'a'.repeat(64); }), /COACH_SOURCES_CHANGED/u],
  ];
  for (const [kind, mutate, expected] of cases) await t.test(kind, async () => {
    const f = await unknownFixture(); await mutate(f);
    const before = await f.raw(), box = await f.box(), evidence = f.immutableEvidence();
    await assert.rejects(f.action({ action: 'recover' }), expected);
    assert.deepEqual(await f.raw(), before); assert.deepEqual(await f.box(), box);
    assert.deepEqual(f.immutableEvidence(), evidence); assert.equal(f.calls.length, 1);
    await f.originalsUnchanged({ dossierChanged: ['withdrawn', 'source'].includes(kind) });
  });
});

test('saved response recovery rejects changed note/athlete/artifact request and evidence identity even if a request record is rehashed', async t => {
  const changes = {
    observation: event => { const packet = JSON.parse(event.request.input); packet.reviewed_coach_observations = [];
      event.request.input = JSON.stringify(packet); event.record.request_sha256 = digest(event.request); },
    athlete: event => { const packet = JSON.parse(event.request.input); packet.athlete.mm = 'MM-FICTIONAL-OTHER';
      event.request.input = JSON.stringify(packet); event.record.request_sha256 = digest(event.request); },
    artifact: event => { const packet = JSON.parse(event.request.input); packet.full_youth_apa.artifact_sha256 = 'a'.repeat(64);
      event.request.input = JSON.stringify(packet); event.record.request_sha256 = digest(event.request); },
    identity: event => { event.id = '88888888-8888-4888-8888-888888888888'; },
  };
  for (const [kind, change] of Object.entries(changes)) await t.test(kind, async () => {
    const f = await unknownFixture(), before = await f.raw(), box = await f.box();
    await f.patch(`coach-evidence:${f.mm}:${before.pendingAttempt.id}:request`, change);
    const evidence = f.immutableEvidence();
    await assert.rejects(f.action({ action: 'recover' }), /RECOVERED_RESULT_MISMATCH/u);
    assert.deepEqual(await f.raw(), before); assert.deepEqual(await f.box(), box);
    assert.deepEqual(f.immutableEvidence(), evidence); assert.equal(f.calls.length, 1);
    await f.originalsUnchanged();
  });
});

test('post-dispatch revocation preserves first response but cannot acknowledge note delivery or mutate reports', { timeout: 2000 }, async () => {
  const started = deferred(), finish = deferred();
  const f = await fixture({ transportHook: async (_request, _options, packet) => {
    started.resolve(); await finish.promise; return coachResponse(packet.task);
  } });
  const { grant } = await f.ready(), pending = f.action({ action: 'start' });
  try {
    const admitted = await Promise.race([started.promise.then(() => true), pending.then(() => false)]);
    assert.equal(admitted, true, `Expected admitted fictional transport; saved code ${(await f.raw()).pendingAttempt?.errorCode || 'none'}`);
    await f.revoke(grant);
  } finally { finish.resolve(); await pending; }
  assert.equal(f.calls.length, 1); assert.equal((await f.raw()).status, 'unknown');
  assert.equal((await f.box()).attempts[0].status, 'dispatched');
  assert.ok(f.immutableEvidence().some(([key]) => key.endsWith(':response')));
  await assert.rejects(f.action({ action: 'recover' }), /COACH_NOTE_GRANT_UNAVAILABLE/u);
  assert.equal(f.calls.length, 1); await f.originalsUnchanged();
});

test('note-bearing OPENING cannot automatically adopt model-offered plan, learning or retire an athlete draft', async () => {
  const offered = { title: 'Unaccepted model proposal', why: 'Not an athlete agreement',
    steps: [{ action: 'Do an unaccepted activity.', when: 'Tomorrow', notice: 'A possibility', owner: 'athlete' }], review: 'Unchosen date' };
  const f = await fixture({ transportHook: async (_request, _options, packet) => coachResponse(packet.task,
    { plan: offered, plan_change: 'replace', retire_draft: true, learning: ['Unconfirmed observation-derived inference.'] }) });
  const draft = { ...clone(f.original.plan), id: '77777777-7777-4777-8777-777777777777', approvals: [], source: 'manual', visibility: 'private' };
  await f.patch(f.key, state => { state.draft = clone(draft); });
  await f.ready(); await f.action({ action: 'start' });
  assert.equal(f.calls.length, 1);
  const saved = await f.raw();
  assert.deepEqual(saved.draft, draft); assert.deepEqual(saved.suggestedLearning, []);
  await f.originalsUnchanged();
});

test('late admitted OPENING stays unresolved after lease/status change until explicit cold recovery with zero extra calls', async t => {
  for (const kind of ['expired lease', 'unknown state']) await t.test(kind, { timeout: 2000 }, async () => {
    const started = deferred(), finish = deferred();
    const lateReply = 'Exact fictional saved late opening; release only through explicit recovery.';
    const f = await fixture({ transportHook: async (_request, _options, packet) => {
      started.resolve(); await finish.promise; return coachResponse(packet.task, { reply: lateReply });
    } });
    const { note } = await f.ready(), pending = f.action({ action: 'start' });
    try {
      const admitted = await Promise.race([started.promise.then(() => true), pending.then(() => false)]);
      assert.equal(admitted, true, `Expected admitted fictional opening; saved code ${(await f.raw()).pendingAttempt?.errorCode || 'none'}`);
      assert.equal((await f.box()).attempts[0].status, 'dispatched');
      if (kind === 'expired lease') f.advance(210001);
      else await f.patch(f.key, state => { state.status = 'unknown'; state.revision++; });
    } finally { finish.resolve(); }
    const returned = await pending, unresolved = await f.raw(), box = await f.box();
    assert.equal(returned.state.capabilities.coachNotes, true);
    assert.equal(f.calls.length, 1); assert.equal(f.config.currentApaEnabled, true);
    const packet = f.calls[0].packet;
    assert.equal(packet.apa_currency.version, 0);
    assert.equal(packet.apa_currency.baseline_apa_sha256, f.bundle.apa.artifact_sha256);
    assert.equal(packet.apa_currency.current_apa_sha256, f.bundle.apa.artifact_sha256);
    assert.equal(packet.full_youth_apa.artifact_sha256, f.bundle.apa.artifact_sha256);
    assert.equal(unresolved.status, 'unknown'); assert.equal(returned.state.status, 'unknown');
    assert.ok(unresolved.pendingAttempt); assert.equal(unresolved.opening, null);
    assert.equal(returned.state.opening, null);
    assert.equal(unresolved.messages.some(message => message.text === lateReply), false);
    assert.equal(returned.state.messages.some(message => message.text === lateReply), false);
    assert.equal(unresolved.events.some(event => event.type === 'reviewed_coach_observations_delivered'), false);
    assert.equal(box.attempts[0].status, 'dispatched'); assert.equal(box.attempts[0].completed_at, null);
    const receipt = (await f.notesService.receipts(f.observer)).receipts.find(receipt => receipt.id === note.id);
    assert.equal(receipt.status, 'dispatched'); assert.equal(receipt.completed_at, null);
    const evidence = f.immutableEvidence();
    assert.ok(evidence.some(([key]) => key.endsWith(':response')));
    await f.originalsUnchanged();
    const cold = createCoachingService({ repo: f.repo, config: f.config, academy: f.academy,
      notes: f.notesService, now: f.now, transport: async () => { throw new Error('OFFLINE_UNEXPECTED_PROVIDER_RERUN'); } });
    const request = await f.command({ action: 'recover' }), recoveredResponse = await cold.action(f.owner, request);
    assert.equal(recoveredResponse.state.capabilities.coachNotes, true);
    const recovered = await f.raw(), delivered = await f.box();
    assert.equal(recovered.status, 'active'); assert.equal(recovered.pendingAttempt, undefined);
    assert.equal(recovered.opening, lateReply); assert.equal(recoveredResponse.state.opening, lateReply);
    assert.equal(delivered.attempts[0].status, 'delivered'); assert.equal(delivered.attempts.length, 1);
    assert.deepEqual(delivered.attempts[0].reservation.note_ids, [note.id]);
    assert.equal(recovered.events.filter(event => event.type === 'reviewed_coach_observations_delivered').length, 1);
    assert.equal(recovered.events.at(-1).type, 'coach_response_recovered');
    assert.equal(recovered.events.at(-1).noProviderCall, true);
    assert.deepEqual(f.immutableEvidence(), evidence); assert.equal(f.calls.length, 1);
    await cold.action(f.owner, request);
    assert.deepEqual(await f.raw(), recovered); assert.deepEqual(await f.box(), delivered);
    assert.equal(f.calls.length, 1); await f.originalsUnchanged();
  });
});

test('note capability metadata survives ordinary current-APA replies and explicit own-source confirmation without activating default-off notes', async t => {
  for (const enabled of [true, false]) await t.test(enabled ? 'notes enabled' : 'notes disabled', async () => {
    const f = await fixture({ enabled });
    if (enabled) await f.ready();
    assert.equal(f.config.currentApaEnabled, true);
    const expected = enabled ? true : undefined;
    const initial = await f.service.state(f.owner, { mm: f.mm });
    assert.equal(initial.state.capabilities?.coachNotes, expected);
    const opened = await f.action({ action: 'start' });
    assert.equal(opened.state.capabilities?.coachNotes, expected);
    const chatted = await f.action({ action: 'message',
      text: 'My priority is Make calm passing choices. Review on October 3, 2026 and plan through December 1, 2026. Tuesday practice is shorter now.' });
    assert.equal(chatted.state.capabilities?.coachNotes, expected);
    assert.equal(chatted.state.capabilities.currentApa, true);
    const before = await f.raw(), box = await f.box(), savedMessage = before.messages.findLast(message => message.role === 'user');
    assert.equal(savedMessage.actorId, f.owner.id);
    const confirmed = await f.action({ action: 'confirm_fact', source_message_id: savedMessage.id,
      reason: 'I reviewed my own saved current priority and timing.', kind: 'reality', supersedes: [] });
    assert.equal(confirmed.state.capabilities?.coachNotes, expected);
    assert.equal(confirmed.state.capabilities.currentApa, true);
    assert.equal(f.calls.length, 2, 'Explicit confirmation must not dispatch another model call.');
    const after = await f.raw(), change = after.apaConfirmedChanges.at(-1);
    assert.equal(change.source_message_id, savedMessage.id); assert.equal(change.actorId, f.owner.id);
    assert.equal(change.mm, f.mm); assert.equal(change.confirmed_by, 'athlete');
    assert.deepEqual(after.currentApa, before.currentApa); assert.deepEqual(after.apaDraft, before.apaDraft);
    assert.deepEqual(after.plan, f.original.plan); assert.deepEqual(after.learning, f.original.learning);
    assert.deepEqual(await f.repo.read(`report:${f.mm}:bos:${BOS_VERSION}`), f.original.reports[0]);
    assert.deepEqual(await f.repo.read(`report:${f.mm}:apa:${APA_VERSION}`), f.original.reports[1]);
    assert.deepEqual(await f.repo.read(`dossier:${f.mm}`), f.original.dossier);
    assert.deepEqual(await f.box(), box);
  });
});

test('only explicit audited pre-admission abandonment releases a reserved note for a later separately requested OPENING', async () => {
  const f = await unadmittedFixture(), unresolved = await f.raw(), reserved = await f.box();
  const evidence = f.immutableEvidence();
  assert.equal(claimedNoteIds(reserved).has(f.note.id), true);
  await assert.rejects(f.action({ action: 'start' }), /PREVIOUS_RESPONSE_NEEDS_REVIEW/u);
  await assert.rejects(f.action({ action: 'abandon_response' }), /RECOVERY_CONFIRMATION_REQUIRED/u);
  assert.deepEqual(await f.raw(), unresolved); assert.deepEqual(await f.box(), reserved);
  assert.equal(f.calls.length, 0);
  const command = await f.command({ action: 'abandon_response', confirm: true });
  const abandonedResponse = await f.service.action(f.owner, command), abandoned = await f.box(), closed = await f.raw();
  assert.equal(abandonedResponse.state.capabilities.coachNotes, true);
  assert.equal(closed.status, 'ready'); assert.equal(closed.pendingAttempt, undefined);
  assert.equal(closed.pendingTask, undefined); assert.equal(closed.opening, null);
  const event = closed.events.at(-1);
  assert.equal(event.type, 'coach_attempt_closed'); assert.deepEqual(event.attempt, unresolved.pendingAttempt);
  assert.equal(event.reason, 'participant_continued_without_unfinished_response');
  assert.equal(event.actorId, f.owner.id); assert.equal(event.noProviderCall, true);
  assert.deepEqual(abandoned.notes, reserved.notes); assert.deepEqual(abandoned.grants, reserved.grants);
  assert.deepEqual(abandoned.reviews, reserved.reviews); assert.equal(abandoned.attempts.length, 1);
  const attempt = abandoned.attempts[0];
  assert.equal(attempt.status, 'abandoned_before_dispatch');
  assert.deepEqual(attempt.reservation, reserved.attempts[0].reservation);
  assert.equal(attempt.evidence_id, null); assert.equal(attempt.dispatched_at, null); assert.equal(attempt.completed_at, null);
  const { abandonment_sha256, ...audit } = attempt.abandoned;
  assert.equal(abandonment_sha256, digest(audit)); assert.equal(audit.owner_id, f.owner.id);
  assert.equal(audit.reason, 'participant_abandoned_before_dispatch');
  assert.equal(audit.reservation_sha256, digest(attempt.reservation)); assert.equal(audit.no_provider_admission, true);
  assert.equal(claimedNoteIds(abandoned).has(f.note.id), false);
  assert.equal((await f.notesService.receipts(f.observer)).receipts[0].status, 'abandoned_before_dispatch');
  assert.deepEqual(f.immutableEvidence(), evidence); assert.equal(f.calls.length, 0);
  await f.service.action(f.owner, command);
  assert.deepEqual(await f.raw(), closed); assert.deepEqual(await f.box(), abandoned); assert.equal(f.calls.length, 0);
  await f.service.state(f.owner, { mm: f.mm });
  assert.deepEqual(await f.box(), abandoned); assert.equal(f.calls.length, 0);
  f.advance(1); await f.action({ action: 'start' });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].packet.reviewed_coach_observations.map(note => note.id), [f.note.id]);
  const delivered = await f.box();
  assert.deepEqual(delivered.notes, reserved.notes); assert.equal(delivered.attempts.length, 2);
  assert.deepEqual(delivered.attempts[0], attempt); assert.equal(delivered.attempts[1].status, 'delivered');
  assert.notEqual(delivered.attempts[1].reservation.attempt_id, attempt.reservation.attempt_id);
  assert.deepEqual(delivered.attempts[1].reservation.note_ids, [f.note.id]);
  assert.equal((await f.raw()).events.filter(value => value.type === 'reviewed_coach_observations_delivered').length, 1);
  await f.originalsUnchanged();
});

test('altered or absent abandonment audit cannot authorize a later note replay', async t => {
  for (const kind of ['absent audit', 'altered audit', 'wrong owner with recomputed hash']) await t.test(kind, async () => {
    const f = await unadmittedFixture(); await f.action({ action: 'abandon_response', confirm: true });
    await f.patch(f.boxKey, box => {
      const attempt = box.attempts[0];
      if (kind === 'absent audit') delete attempt.abandoned;
      else if (kind === 'altered audit') attempt.abandoned.no_provider_admission = false;
      else {
        attempt.abandoned.owner_id = f.other.id;
        const { abandonment_sha256: _priorHash, ...body } = attempt.abandoned;
        attempt.abandoned.abandonment_sha256 = digest(body);
      }
    });
    const before = await f.raw(), box = await f.box(), evidence = f.immutableEvidence();
    await assert.rejects(f.action({ action: 'start' }), /COACH_NOTE_(?:RESERVATION|ABANDONMENT)_INVALID/u);
    assert.deepEqual(await f.raw(), before); assert.deepEqual(await f.box(), box);
    assert.deepEqual(f.immutableEvidence(), evidence); assert.equal(f.calls.length, 0);
    await f.originalsUnchanged();
  });
});

test('lost grant or recipient after an unadmitted reservation permits coach closure without releasing its claim', async t => {
  for (const kind of ['revoked grant', 'expired grant', 'unavailable recipient']) await t.test(kind, async () => {
    const f = await unadmittedFixture();
    if (kind === 'revoked grant') await f.revoke(f.grant);
    else if (kind === 'expired grant') f.advance(86400000);
    else await f.patch(`account:${f.observer.id}`, account => { account.verified = false; });
    const before = await f.raw(), box = await f.box(), evidence = f.immutableEvidence();
    const command = await f.command({ action: 'abandon_response', confirm: true });
    await f.service.action(f.owner, command);
    const closed = await f.raw();
    assert.equal(closed.status, 'ready'); assert.equal(closed.pendingAttempt, undefined);
    assert.equal(closed.events.at(-1).type, 'coach_attempt_closed');
    assert.deepEqual(closed.events.at(-1).attempt, before.pendingAttempt);
    assert.equal(closed.events.at(-1).noProviderCall, true);
    assert.deepEqual(await f.box(), box); assert.equal(box.attempts[0].status, 'reserved');
    assert.equal(box.attempts[0].abandoned, undefined); assert.equal(claimedNoteIds(box).has(f.note.id), true);
    assert.deepEqual(f.immutableEvidence(), evidence); assert.equal(f.calls.length, 0);
    await f.service.action(f.owner, command);
    assert.deepEqual(await f.raw(), closed); assert.deepEqual(await f.box(), box); assert.equal(f.calls.length, 0);
    await f.originalsUnchanged();
  });
});

test('unknown already-dispatched response abandonment preserves evidence and never requeues its note', async () => {
  const f = await unknownFixture(), before = await f.raw(), dispatched = await f.box(), evidence = f.immutableEvidence();
  await f.action({ action: 'abandon_response', confirm: true });
  const closed = await f.raw();
  assert.equal(closed.status, 'ready'); assert.equal(closed.pendingAttempt, undefined);
  assert.equal(closed.events.at(-1).type, 'coach_attempt_closed');
  assert.deepEqual(closed.events.at(-1).attempt, before.pendingAttempt);
  assert.equal(closed.events.at(-1).noProviderCall, true);
  assert.deepEqual(await f.box(), dispatched); assert.equal(dispatched.attempts[0].abandoned, undefined);
  assert.equal(claimedNoteIds(dispatched).has(f.note.id), true);
  assert.deepEqual(f.immutableEvidence(), evidence); assert.equal(f.calls.length, 1);
  await f.action({ action: 'start' });
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1].packet.reviewed_coach_observations, undefined);
  assert.deepEqual(await f.box(), dispatched);
  for (const [key, value] of evidence) assert.equal(f.values.get(key), value);
  assert.equal((await f.raw()).events.some(event => event.type === 'reviewed_coach_observations_delivered'), false);
  await f.originalsUnchanged();
});

test('in-flight dispatched OPENING cannot be abandoned while active or requeued after lease-expired abandonment', { timeout: 2000 }, async () => {
  const started = deferred(), finish = deferred();
  const f = await fixture({ transportHook: async (_request, _options, packet) => {
    started.resolve(); await finish.promise; return coachResponse(packet.task);
  } });
  const { note } = await f.ready(), pending = f.action({ action: 'start' });
  let admitted;
  try {
    admitted = await Promise.race([started.promise.then(() => true), pending.then(() => false)]);
    assert.equal(admitted, true);
    const working = await f.raw(), dispatched = await f.box(), evidence = f.immutableEvidence();
    assert.equal(dispatched.attempts[0].status, 'dispatched');
    await assert.rejects(f.action({ action: 'abandon_response', confirm: true }), /ATTEMPT_STILL_ACTIVE/u);
    assert.deepEqual(await f.raw(), working); assert.deepEqual(await f.box(), dispatched);
    f.advance(210001); await f.action({ action: 'abandon_response', confirm: true });
    assert.equal((await f.raw()).pendingAttempt, undefined); assert.equal((await f.raw()).status, 'ready');
    assert.equal((await f.raw()).events.at(-1).noProviderCall, true);
    assert.deepEqual(await f.box(), dispatched); assert.equal(claimedNoteIds(dispatched).has(note.id), true);
    assert.deepEqual(f.immutableEvidence(), evidence); assert.equal(f.calls.length, 1);
  } finally { finish.resolve(); await pending; }
  assert.equal(admitted, true); assert.equal(f.calls.length, 1);
  const delivered = await f.box(); assert.equal(delivered.attempts[0].status, 'dispatched');
  assert.equal(delivered.attempts[0].abandoned, undefined);
  assert.ok(f.immutableEvidence().some(([key]) => key.endsWith(':response')));
  await f.action({ action: 'start' });
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1].packet.reviewed_coach_observations, undefined);
  assert.deepEqual(await f.box(), delivered); await f.originalsUnchanged();
});

test('delivered note cannot be released by an irrelevant abandon command or repeated session', async () => {
  const f = await fixture(), { note } = await f.ready(); await f.action({ action: 'start' });
  const before = await f.raw(), delivered = await f.box(), evidence = f.immutableEvidence();
  await assert.rejects(f.action({ action: 'abandon_response', confirm: true }), /ATTEMPT_STILL_ACTIVE/u);
  assert.deepEqual(await f.raw(), before); assert.deepEqual(await f.box(), delivered);
  assert.deepEqual(f.immutableEvidence(), evidence); assert.equal(f.calls.length, 1);
  assert.equal(claimedNoteIds(delivered).has(note.id), true); assert.equal(delivered.attempts[0].abandoned, undefined);
  await f.action({ action: 'reset' }); await f.action({ action: 'start' });
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1].packet.reviewed_coach_observations, undefined);
  assert.deepEqual(await f.box(), delivered); await f.originalsUnchanged();
});
