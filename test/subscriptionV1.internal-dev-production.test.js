import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  RedisLivingRelationshipStore,
  authenticateInternalDevRequest,
  consumeEntryCsrf,
  consumeRuntimeCsrf,
  createInternalSyntheticEntitlement,
  exactJordanCode,
  internalDevKeys,
  issueEntryCsrf,
  issueInternalDevCapability,
  issueRuntimeCsrf,
  withDurableAllowanceLedger,
} from '../api/engine/subscriptionV1/internalDevInfrastructure.js';
import { ensureActiveSession } from '../api/internal/subscription-v1-runtime.js';
import { proveSyntheticSubscriberLoaderGeneralization } from '../api/engine/subscriptionV1/internalDevSubscriberLoader.js';
import { parseSubscriptionStructuredOutput } from '../api/engine/subscriptionV1/liveDemoOpenAiTransport.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1 } from '../src/lib/subscriptionV1/freeGptV2/contracts.js';
import { FREE_GPT_V2_COACHING_MISSION, FREE_GPT_V2_RUNTIME_POLICY } from '../src/lib/subscriptionV1/freeGptV2/constants.js';
import { createSyntheticLivingRelationshipLab } from '../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';

class FakeRedis {
  constructor() { this.values = new Map(); this.lists = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async getdel(key) { const value = this.values.get(key) ?? null; this.values.delete(key); return value; }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, String(value));
    return 'OK';
  }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
  async incr(key) { const value = Number(this.values.get(key) || 0) + 1; this.values.set(key, String(value)); return value; }
  async expire() { return 1; }
  async lpush(key, value) { const list = this.lists.get(key) || []; list.unshift(value); this.lists.set(key, list); return list.length; }
  async ltrim(key, start, end) { this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1)); return 'OK'; }
  async lrange(key, start, end) { return (this.lists.get(key) || []).slice(start, end + 1); }
  async eval(_script, keyCount, ...parts) {
    const keys = parts.slice(0, keyCount);
    const args = parts.slice(keyCount);
    if (keyCount === 1) {
      if (this.values.get(keys[0]) !== args[0]) return 0;
      this.values.delete(keys[0]);
      return 1;
    }
    if (keyCount === 3) {
      if (this.values.get(keys[0]) !== args[0]) return 0;
      const prior = this.values.get(keys[1]);
      if (prior) this.values.set(keys[2], prior);
      this.values.set(keys[1], args[1]);
      return 1;
    }
    throw new Error('Unexpected fake Redis script');
  }
}

const req = (cookie = '') => ({
  method: 'POST',
  headers: {
    host: 'moremindmap.com',
    origin: 'https://moremindmap.com',
    'x-forwarded-proto': 'https',
    'x-forwarded-for': '203.0.113.7',
    'user-agent': 'Subscription V1 test browser',
    cookie,
  },
  socket: {},
});

test('internal Leadership entitlement uses one-time CSRF, exact human code, opaque cookies, and synthetic-only binding', async () => {
  const redis = new FakeRedis();
  const request = req();
  const accessCode = 'synthetic-private-access-code-at-least-32-characters';
  const proof = await issueEntryCsrf({ redis, req: request });
  assert.equal(await consumeEntryCsrf({ redis, req: request, proof }), true);
  assert.equal(await consumeEntryCsrf({ redis, req: request, proof }), false);
  assert.equal(exactJordanCode(accessCode, { SUBSCRIPTION_V1_INTERNAL_ACCESS_CODE: accessCode }), true);
  assert.equal(exactJordanCode(`${accessCode}x`, { SUBSCRIPTION_V1_INTERNAL_ACCESS_CODE: accessCode }), false);
  assert.equal(exactJordanCode(accessCode, {}), false);
  assert.equal(exactJordanCode('too-short', { SUBSCRIPTION_V1_INTERNAL_ACCESS_CODE: 'too-short' }), false);
  const issued = await issueInternalDevCapability({ redis, req: request });
  assert.equal(issued.capability.subject_key, 're-mid');
  assert.equal(issued.capability.synthetic_only, true);
  assert.equal(issued.capability.billing_evidence, false);
  assert.equal(issued.capability.stripe_subscription_created, false);
  assert.equal(issued.cookies.every((value) => /HttpOnly; Secure; SameSite=Strict/u.test(value)), true);
  assert.equal(issued.cookies.some((value) => value.includes(accessCode)), false);
  const runtimeCsrf = await issueRuntimeCsrf({ redis, capabilityHash: 'a'.repeat(64) });
  assert.equal(await consumeRuntimeCsrf({ redis, capabilityHash: 'a'.repeat(64), proof: runtimeCsrf }), true);
  assert.equal(await consumeRuntimeCsrf({ redis, capabilityHash: 'a'.repeat(64), proof: runtimeCsrf }), false);
});

test('internal entitlement rejection preserves fail-closed authority while classifying recoverable re-entry boundaries', async () => {
  const redis = new FakeRedis();
  const now = new Date('2026-09-03T02:12:42.209Z');
  const request = req();
  const missing = await authenticateInternalDevRequest({ redis, req: request, env: { SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true' }, now });
  assert.equal(missing.code, 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_REQUIRED');
  assert.equal(missing.failure_class, 'CAPABILITY_COOKIE_MISSING');

  const issued = await issueInternalDevCapability({ redis, req: request, now });
  const cookie = issued.cookies.map((value) => value.split(';')[0]).join('; ');
  const valid = await authenticateInternalDevRequest({ redis, req: req(cookie), env: { SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true' }, now: new Date('2026-09-03T04:45:05.965Z') });
  assert.equal(valid.ok, true);

  const changedNetwork = req(cookie);
  changedNetwork.headers['x-forwarded-for'] = '203.0.113.8';
  const bindingMismatch = await authenticateInternalDevRequest({ redis, req: changedNetwork, env: { SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true' }, now: new Date('2026-09-03T04:46:16.080Z') });
  assert.equal(bindingMismatch.code, 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_INVALID');
  assert.equal(bindingMismatch.failure_class, 'CAPABILITY_BROWSER_BINDING_MISMATCH');

  const capabilityKey = [...redis.values.keys()].find((key) => key.includes(':capability:'));
  const originalCapability = redis.values.get(capabilityKey);
  redis.values.delete(capabilityKey);
  const missingState = await authenticateInternalDevRequest({ redis, req: req(cookie), env: { SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true' }, now: new Date('2026-09-03T04:46:16.080Z') });
  assert.equal(missingState.failure_class, 'CAPABILITY_STATE_MISSING');
  redis.values.set(capabilityKey, '{malformed');
  const malformedState = await authenticateInternalDevRequest({ redis, req: req(cookie), env: { SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true' }, now: new Date('2026-09-03T04:46:16.080Z') });
  assert.equal(malformedState.failure_class, 'CAPABILITY_STATE_MALFORMED');
  redis.values.set(capabilityKey, originalCapability);

  const expired = await authenticateInternalDevRequest({ redis, req: req(cookie), env: { SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true' }, now: new Date('2026-09-03T10:12:42.210Z') });
  assert.equal(expired.failure_class, 'CAPABILITY_EXPIRED');
  assert.equal(Object.hasOwn(bindingMismatch, 'capability'), false);
  assert.equal(Object.hasOwn(bindingMismatch, 'capability_hash'), false);
});

test('internal entitlement reuses the frozen four-session and approximate-30-minute accounting contract', async () => {
  const redis = new FakeRedis();
  const keys = internalDevKeys({ relationship_key: 'rel_aaaaaaaaaaaaaaaaaaaa', subject_key: 're-mid' });
  const lab = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', relationship_key: 'rel_aaaaaaaaaaaaaaaaaaaa' });
  const entitlement = createInternalSyntheticEntitlement({ scope: lab.scope, asOf: new Date('2026-08-20T12:00:00.000Z') });
  const first = await withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => {
    const cycle = ledger.createCycle(entitlement);
    const reserved = ledger.reserve({ ledger_id: cycle.ledger.ledger_id, scope: lab.scope, session_class: 'ONBOARDING_INCLUDED', idempotency_key: 'first', now: '2026-08-20T12:00:00.000Z' });
    const active = ledger.activate({ session_id: reserved.session.session_id, scope: lab.scope, now: '2026-08-20T12:01:00.000Z' });
    const charged = ledger.recordFirstValidResponse({ session_id: active.session.session_id, scope: lab.scope, response_hash: hashCanonicalJson({ answer: true }), now: '2026-08-20T12:02:00.000Z' });
    return { cycle: charged.ledger, session: charged.session, timing: ledger.timingPolicy };
  }});
  assert.equal(first.cycle.standard_slots_total, 4);
  assert.equal(first.cycle.standard_slots_consumed, 0);
  assert.equal(first.cycle.onboarding_consumed, true);
  assert.equal(first.timing.active_hard_cap_seconds, 1800);
  assert.equal(first.timing.active_hard_cap_enforced, false);
  const replay = await withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => ledger.inspect({ ledger_id: first.cycle.ledger_id, scope: lab.scope, now: '2026-08-20T12:03:00.000Z' }) });
  assert.equal(replay.ok, true);
  assert.equal(replay.sessions.length, 1);
  assert.equal(replay.sessions[0].charge_point_reached, true);
});

test('the approximate 30-minute cue never auto-terminates an active coaching session', async () => {
  const redis = new FakeRedis();
  const keys = internalDevKeys({ relationship_key: 'rel_nohardcap000000000', subject_key: 're-mid' });
  const lab = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', relationship_key: 'rel_nohardcap000000000' });
  const entitlement = createInternalSyntheticEntitlement({ scope: lab.scope, asOf: new Date('2026-08-20T12:00:00.000Z') });
  const started = await withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => {
    const cycle = ledger.createCycle(entitlement);
    const reserved = ledger.reserve({ ledger_id: cycle.ledger.ledger_id, scope: lab.scope, session_class: 'ONBOARDING_INCLUDED', idempotency_key: 'no-hard-cap', now: '2026-08-20T12:00:00.000Z' });
    const active = ledger.activate({ session_id: reserved.session.session_id, scope: lab.scope, now: '2026-08-20T12:01:00.000Z' });
    return ledger.recordFirstValidResponse({ session_id: active.session.session_id, scope: lab.scope, response_hash: hashCanonicalJson({ answer: true }), now: '2026-08-20T12:02:00.000Z' });
  }});
  assert.equal(started.session.hard_expires_at, null);
  const fourHoursLater = await withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => ledger.inspect({ ledger_id: started.ledger.ledger_id, scope: lab.scope, now: '2026-08-20T16:01:00.000Z' }) });
  assert.equal(fourHoursLater.sessions[0].state, 'ACTIVE');
  assert.equal(fourHoursLater.sessions[0].ended_at, null);
  const closed = await withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => ledger.complete({ session_id: started.session.session_id, scope: lab.scope, now: '2026-08-20T16:02:00.000Z' }) });
  assert.equal(closed.session.state, 'CONSUMED');
  assert.equal(closed.code, 'SESSION_COMPLETED');
});

test('an exhausted synthetic allowance preserves read-only relationship access without opening a fifth session', async () => {
  const redis = new FakeRedis();
  const relationshipKey = 'rel_allowanceboundary00';
  const keys = internalDevKeys({ relationship_key: relationshipKey, subject_key: 're-mid' });
  const lab = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', relationship_key: relationshipKey });
  const now = new Date('2026-08-25T18:00:00.000Z');
  const entitlement = createInternalSyntheticEntitlement({ scope: lab.scope, asOf: now });
  await withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => {
    const cycle = ledger.createCycle(entitlement, { onboarding_consumed: true });
    for (let index = 0; index < 4; index += 1) {
      const minute = index * 3;
      const reservedAt = new Date(now.getTime() + minute * 60_000).toISOString();
      const activeAt = new Date(now.getTime() + (minute + 1) * 60_000).toISOString();
      const completedAt = new Date(now.getTime() + (minute + 2) * 60_000).toISOString();
      const reserved = ledger.reserve({ ledger_id: cycle.ledger.ledger_id, scope: lab.scope, session_class: 'STANDARD', idempotency_key: `exhaust-${index}`, now: reservedAt });
      const active = ledger.activate({ session_id: reserved.session.session_id, scope: lab.scope, now: activeAt });
      ledger.recordFirstValidResponse({ session_id: active.session.session_id, scope: lab.scope, response_hash: hashCanonicalJson({ index }), now: activeAt });
      ledger.complete({ session_id: active.session.session_id, scope: lab.scope, now: completedAt });
    }
  }});
  const boundary = await ensureActiveSession({ redis, keys, scope: lab.scope, capabilityHash: 'b'.repeat(64), now: new Date('2026-08-25T19:00:00.000Z') });
  assert.equal(boundary.ok, false);
  assert.equal(boundary.code, 'STANDARD_ALLOWANCE_EXHAUSTED');
  assert.equal(boundary.allowance.standard_slots_consumed, 4);
  assert.equal(boundary.allowance.standard_slots_available, 0);
});

test('Redis durability adapter preserves an accepted AFW-05 mutation across runtime reconstruction', async () => {
  const redis = new FakeRedis();
  const keys = internalDevKeys({ relationship_key: 'rel_bbbbbbbbbbbbbbbbbbbb', subject_key: 're-mid' });
  const store = await RedisLivingRelationshipStore.open({ redis, keys });
  const first = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', relationship_key: 'rel_bbbbbbbbbbbbbbbbbbbb', store });
  const turn = await first.controller.send({ message: 'Help me complete the two open plan ways.' });
  assert.equal(turn.ok, true);
  assert.equal(turn.confirmation_required, true);
  const decided = await first.controller.decide({ proposal_id: turn.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'durability-proof' });
  assert.equal(decided.mutation_performed, true);
  const reconstructedStore = await RedisLivingRelationshipStore.open({ redis, keys });
  const later = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', relationship_key: 'rel_bbbbbbbbbbbbbbbbbbbb', store: reconstructedStore });
  const current = later.controller.current();
  assert.equal(current.ok, true);
  assert.equal(current.publication.publication_version, 2);
  assert.equal(reconstructedStore.readPersonalRsl({ scope: later.scope }).records.length, 1);
});

test('a pending proposal survives Redis runtime reconstruction and exact natural authorization publishes it', async () => {
  const redis = new FakeRedis();
  const keys = internalDevKeys({ relationship_key: 'rel_cccccccccccccccccccc', subject_key: 're-mid' });
  const transport = async (request, { stage }) => {
    if (stage === 'CONVERSATION') return { output: { customer_message: 'I understand the exact request.' }, usage: {}, latency_ms: 1 };
    if (stage === 'CANDIDATE_EXTRACTION') return {
      output: {
        candidate: {
          candidate_type: 'PERSONAL_RSL_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
          summary: 'Remember the customer’s durable communication preference.',
          items: [{ field: 'evidence.communication_preference', value: 'Lead with the risk, then recommend, then ask one question.' }],
          reason: 'The customer explicitly asked MORE to remember this new preference.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true,
          generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
        },
      },
      usage: {}, latency_ms: 1,
    };
    const input = JSON.parse(request.input[1].content);
    return {
      output: { decision: 'CONFIRM', proposal_hash: input.pending_proposal.proposal_hash, effective_items: [], unambiguous: true, reason: 'The customer explicitly confirmed the exact pending proposal.' },
      usage: {}, latency_ms: 1,
    };
  };
  const firstStore = await RedisLivingRelationshipStore.open({ redis, keys });
  const first = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', relationship_key: 'rel_cccccccccccccccccccc', store: firstStore, transport, seed_weekly_fixture: false });
  const proposed = await first.controller.send({ message: 'Please remember this new durable communication preference.' });
  assert.equal(proposed.confirmation_required, true);
  assert.equal(proposed.proposal.status, 'AWAITING_CUSTOMER_DECISION');
  const reconstructedStore = await RedisLivingRelationshipStore.open({ redis, keys });
  const reconstructed = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', relationship_key: 'rel_cccccccccccccccccccc', store: reconstructedStore, transport, seed_weekly_fixture: false });
  const confirmed = await reconstructed.controller.send({ message: 'I confirm the exact pending proposal. Update my map with it.' });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.mutation_performed, true);
  assert.equal(confirmed.code, 'FREE_GPT_V2_NATURAL_AUTHORIZATION_TURN_COMPLETE');
  assert.equal(reconstructed.controller.current().publication.publication_version, 2);
  assert.equal(reconstructedStore.readPersonalRsl({ scope: reconstructed.scope }).records.length, 1);
  const stageCalls = [];
  const recallTransport = async (_request, { stage }) => {
    stageCalls.push(stage);
    return stage === 'CONVERSATION'
      ? { output: { customer_message: 'I remember the durable preference.' }, usage: {}, latency_ms: 1 }
      : { output: { candidate: null }, usage: {}, latency_ms: 1 };
  };
  const laterStore = await RedisLivingRelationshipStore.open({ redis, keys });
  const later = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', relationship_key: 'rel_cccccccccccccccccccc', store: laterStore, transport: recallTransport, seed_weekly_fixture: false });
  const recall = await later.controller.send({ message: 'What preference did I ask you to remember?' });
  assert.equal(recall.ok, true);
  assert.deepEqual(stageCalls, ['CONVERSATION', 'CANDIDATE_EXTRACTION']);
  assert.equal(recall.customer_message, 'I remember the durable preference.');
});

test('Jordan and a second synthetic Real Estate subject use the exact same production-intended loader without cross-scope leakage', async () => {
  const redis = new FakeRedis();
  const proof = await proveSyntheticSubscriberLoaderGeneralization({ redis, env: { OPENAI_API_KEY: 'unused-in-proof' } });
  assert.equal(proof.ok, true);
  assert.equal(proof.same_runtime, true);
  assert.equal(proof.cross_scope_isolated, true);
  assert.notEqual(proof.jordan_profile_id, proof.elena_profile_id);
  assert.equal(proof.provider_calls, 0);
});

test('North Star and first-session responsibility are explicit context without deterministic coaching scaffolding', () => {
  assert.match(FREE_GPT_V2_COACHING_MISSION, /MORE seeks first to understand the person, the business, what they want/iu);
  assert.match(FREE_GPT_V2_COACHING_MISSION, /first-ever Subscription relationship session/iu);
  assert.match(FREE_GPT_V2_COACHING_MISSION, /order is not fixed/iu);
  assert.doesNotMatch(FREE_GPT_V2_COACHING_MISSION, /conversation mode|framework selector|question quota|phase router|ten-question counter/iu);
});

test('public Subscription shell exposes no profile selector, API secret, canary route, or real-customer retrieval', () => {
  const ui = fs.readFileSync(new URL('../src/subscriptionV1/SubscriptionV1InternalDevApp.jsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/lab/subscriptionLivingBusinessRelationshipV1/styles.css', import.meta.url), 'utf8');
  const runtime = fs.readFileSync(new URL('../api/internal/subscription-v1-runtime.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /profile picker|Choose synthetic Founder subject|OPENAI_API_KEY|canary/iu);
  assert.doesNotMatch(runtime, /retrieve-profile|MM-\d{8}-[A-Z0-9]{8}/u);
  assert.match(runtime, /subject_key: auth\.capability\.subject_key/u);
  assert.match(runtime, /SUBSCRIPTION_V1_RUNTIME_\$\{action\}_REJECTED/u);
  assert.match(runtime, /SUBSCRIPTION_V1_RUNTIME_AUTH_REJECTED/u);
  assert.match(runtime, /failure_class/u);
  assert.match(runtime, /capability_material_logged:\s*false/u);
  assert.match(runtime, /customer_evidence_logged:\s*false/u);
  assert.match(runtime, /configured_max_output_tokens/u);
  assert.match(runtime, /sanitized_stage/u);
  assert.match(ui, /MORE • LIVE/u);
  assert.doesNotMatch(ui, /MORE [·•] LIVE GPT-5\.6 SOL/u);
  assert.match(ui, /data-synthetic-only="true"/u);
  assert.match(ui, /coaching_available === false/u);
  assert.match(ui, /failure\.status === 401 && failure\.reentryRequired/u);
  assert.match(ui, /onEntitlementLost/u);
  assert.match(ui, /Your Business Twin is current\./u);
  assert.match(runtime, /SUBSCRIPTION_V1_RELATIONSHIP_READY_ALLOWANCE_EXHAUSTED/u);
  assert.match(styles, /\.living-relationship-app \.drawer-layer \{ right: 0; bottom: 0; z-index: 50; \}/u);
  assert.match(styles, /body\.drawer-open \.living-relationship-app \.living-twin-column \{ position: relative; z-index: 50; \}/u);
  assert.doesNotMatch(styles, /\.drawer-layer \{ bottom: max\(46vh, 360px\); \}/u);
});

test('production Subscription runtime has a bounded provider envelope larger than the generic function ceiling', () => {
  const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const loader = fs.readFileSync(new URL('../api/engine/subscriptionV1/internalDevSubscriberLoader.js', import.meta.url), 'utf8');
  assert.equal(vercel.functions['api/internal/subscription-v1-runtime.js'].maxDuration, 800);
  assert.equal(vercel.functions['api/**/*.js'].maxDuration, 180);
  assert.match(loader, /timeoutMs:\s*300_000/u);
  assert.match(loader, /maxTransportRetries:\s*1/u);
});

test('customer-message output is not lexically truncated and malformed structured output fails closed for bounded retry', () => {
  const contracts = fs.readFileSync(new URL('../src/lib/subscriptionV1/freeGptV2/contracts.js', import.meta.url), 'utf8');
  const catastrophic = fs.readFileSync(new URL('../src/lib/subscriptionV1/freeGptV2/catastrophicIntegrity.js', import.meta.url), 'utf8');
  assert.doesNotMatch(contracts, /customer_message[^\n]+maxLength/u);
  assert.doesNotMatch(catastrophic, /message\.length\s*>/u);
  assert.deepEqual(parseSubscriptionStructuredOutput({ output_text: JSON.stringify({ customer_message: 'A natural response may use the space its answer actually needs.' }) }), {
    customer_message: 'A natural response may use the space its answer actually needs.',
  });
  assert.throws(
    () => parseSubscriptionStructuredOutput({ output_text: '{"customer_message":"cut off' }),
    (error) => error?.code === 'SUBSCRIPTION_LIVE_DEMO_STRUCTURED_JSON_INVALID',
  );
});

test('candidate-or-null extraction has proven xhigh reasoning headroom without changing authorization budget', () => {
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.candidate_max_output_tokens, 12000);
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.authorization_max_output_tokens, 5000);
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.conversation_max_output_tokens, 16000);
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.reasoning_effort, 'xhigh');
  assert.equal(DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1.schema.properties.candidate.anyOf[0].type, 'object');
  assert.equal(DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1.schema.properties.candidate.anyOf[1].type, 'null');
  const seams = fs.readFileSync(new URL('../src/lib/subscriptionV1/freeGptV2/providerSeams.js', import.meta.url), 'utf8');
  assert.match(seams, /communication preference maps to PERSONAL_RSL_CANDIDATE/u);
  assert.match(seams, /same semantic preference already appears in current_durable_relationship_state/u);
  assert.match(seams, /expected pre-proposal condition/u);
  assert.match(DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1.schema.properties.candidate.description, /Return the candidate object/u);
  assert.match(seams, /requires later exact customer confirmation/u);
});
