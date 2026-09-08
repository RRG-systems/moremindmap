import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {
  createAthleteLivingConsultOneShotDemoRuntimeV1,
  createAthleteLivingConsultStructuralQaSeamsV1,
} from '../api/engine/athleteLivingConsultOneShotV1/demoRuntime.js';
import { createAthleteConsultDemoFixtureV1 } from '../api/engine/athleteLivingConsultOneShotV1/demoFixtures.js';
import {
  ATHLETE_CONSULTING_DURABILITY_V1,
  athleteConsultingFixtureBindingV1,
  athleteConsultingSessionKeys,
  createAthleteConsultingSessionEnvelopeV1,
  persistAthleteConsultingSessionEnvelopeV1,
  readAthleteConsultingSessionEnvelopeV1,
  validateAthleteConsultingSessionEnvelopeV1,
  withAthleteConsultingSessionLeaseV1,
} from '../api/engine/athleteLivingConsultOneShotV1/durableInfrastructure.js';
import {
  athleteConsultingDarrenDemoEnabled,
  consumeAthleteConsultingDemoCsrf,
  deriveAthleteConsultingActorCapabilities,
  issueAthleteConsultingDemoCsrf,
} from '../api/engine/leadershipDemo/authority.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

const FIXTURE_PATH = new URL('../api/engine/athleteLivingConsultOneShotV1/fixtures/mika-bos-v1.json', import.meta.url);
const rawBos = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const fixedClock = () => '2026-09-08T12:00:00.000Z';

class FakeRedis {
  constructor() {
    this.values = new Map();
    this.expirations = new Map();
    this.calls = [];
  }

  async get(key) { return this.values.get(key) ?? null; }
  async getdel(key) { const value = this.values.get(key) ?? null; this.values.delete(key); return value; }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
  async set(key, value, ...args) {
    this.calls.push(['set', key, ...args]);
    if (args.includes('NX') && this.values.has(key)) return null;
    if (args.includes('XX') && !this.values.has(key)) return null;
    this.values.set(key, String(value));
    return 'OK';
  }
  async incr(key) { const next = Number(this.values.get(key) || 0) + 1; this.values.set(key, String(next)); return next; }
  async expire(key, seconds) { this.expirations.set(key, Number(seconds)); return 1; }
  async eval(script, keyCount, ...args) {
    const keys = args.slice(0, keyCount);
    const argv = args.slice(keyCount);
    this.calls.push(['eval', script, ...keys]);
    if (script.includes("redis.call('INCR'")) {
      const count = await this.incr(keys[0]);
      if (count === 1) await this.expire(keys[0], argv[0]);
      return count;
    }
    if (script.includes("redis.call('SET',KEYS[2],ARGV[2])")) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      const prior = this.values.get(keys[1]);
      if (argv[2] === '1' && prior != null) {
        this.values.set(keys[2], prior);
        this.expirations.set(keys[2], Number(argv[3]));
      }
      this.values.set(keys[1], argv[1]);
      return 1;
    }
    if (script.includes("redis.call('PEXPIRE'")) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      this.expirations.set(keys[0], Number(argv[1]));
      return 1;
    }
    if (script.includes("redis.call('DEL'")) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      this.values.delete(keys[0]);
      return 1;
    }
    throw new Error('UNEXPECTED_LUA');
  }
}

function fixtureBinding(id) {
  return athleteConsultingFixtureBindingV1(id, createAthleteConsultDemoFixtureV1(id, rawBos));
}

async function structuralRuntime(id, runtimeSnapshot = null) {
  const seams = createAthleteLivingConsultStructuralQaSeamsV1({ clock: fixedClock });
  return createAthleteLivingConsultOneShotDemoRuntimeV1({
    fixture_id: id,
    clock: fixedClock,
    coach_seam: seams.coach,
    candidate_extractor: null,
    close_seam: seams.close,
    gu_generator: null,
    runtime_snapshot: runtimeSnapshot,
  });
}

test('the packaged Mika source is byte-sealed and only two fixed Athlete namespaces can resolve', () => {
  const bytes = fs.readFileSync(FIXTURE_PATH);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '21dad9299058dbdaa935bc89e66a0d3126d9c845c18b599bfa6afda3cd1ce6d0');
  const mika = fixtureBinding('mika');
  const avery = fixtureBinding('avery');
  const keys = [athleteConsultingSessionKeys({ fixtureBinding: mika }), athleteConsultingSessionKeys({ fixtureBinding: avery })];
  assert.notEqual(keys[0].fixture_scope_hash, keys[1].fixture_scope_hash);
  assert.deepEqual(ATHLETE_CONSULTING_DURABILITY_V1.fixtures, ['mika', 'avery']);
  for (const group of keys) {
    assert.match(group.state, /^more:athlete-consulting-demo:v1:[a-f0-9]{64}:state$/u);
    assert.doesNotMatch(JSON.stringify(group), /subscription-v1|patricia|customer|re-mid/iu);
  }
  assert.throws(() => athleteConsultingFixtureBindingV1('patricia', {}), /FIXTURE_(?:NOT_ALLOWED|BINDING_INVALID)/u);
  assert.throws(() => athleteConsultingFixtureBindingV1('mika', { ...createAthleteConsultDemoFixtureV1('mika', rawBos), relationshipId: 'customer-relationship' }), /FIXTURE_BINDING_INVALID/u);
});

test('full runtime envelope survives active-session cold start with bounded compact idempotency', async () => {
  const binding = fixtureBinding('mika');
  let runtime = await structuralRuntime('mika');
  const start = await runtime.dispatch('START_MY_FIRST_SESSION', { idempotency_key: 'durable-start-0001' });
  const turn = await runtime.dispatch('TURN', {
    actor_role: 'PARTICIPANT',
    message: 'What should we understand together?',
    idempotency_key: 'durable-turn-00001',
  });
  assert.equal(turn.ok, true);
  const snapshot = runtime.snapshot();
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot), 'utf8') < 100_000);
  assert.equal(snapshot.conversation.length, 2);
  assert.equal(snapshot.idempotency.length, 2);
  assert.equal(Object.hasOwn(snapshot.idempotency[0], 'response'), false);
  const envelope = createAthleteConsultingSessionEnvelopeV1({ fixtureBinding: binding, runtimeSnapshot: snapshot, now: new Date(fixedClock()) });
  assert.equal(validateAthleteConsultingSessionEnvelopeV1(envelope, { fixtureBinding: binding }).valid, true);
  runtime = await structuralRuntime('mika', snapshot);
  const rehydrated = runtime.bootstrap();
  assert.equal(rehydrated.state_hash, turn.state_hash);
  assert.equal(rehydrated.revision, turn.revision);
  assert.deepEqual(rehydrated.conversation, turn.conversation);
  assert.equal(rehydrated.current_map.publication_hash, turn.current_map.publication_hash);
  const replay = await runtime.dispatch('TURN', {
    actor_role: 'PARTICIPANT',
    message: 'What should we understand together?',
    idempotency_key: 'durable-turn-00001',
  });
  assert.equal(replay.code, 'ATHLETE_IDEMPOTENT_REPLAY');
  assert.equal(replay.original_result_state_hash, turn.state_hash);
  assert.equal(start.ok, true);
});

test('envelope tampering and oversize writes fail closed before Redis state changes', async () => {
  const redis = new FakeRedis();
  const binding = fixtureBinding('mika');
  const keys = athleteConsultingSessionKeys({ fixtureBinding: binding });
  const runtime = await structuralRuntime('mika');
  const envelope = createAthleteConsultingSessionEnvelopeV1({ fixtureBinding: binding, runtimeSnapshot: runtime.snapshot(), now: new Date(fixedClock()) });
  const tampered = structuredClone(envelope);
  tampered.fixture_binding.subject_id = 'customer-subject';
  assert.equal(validateAthleteConsultingSessionEnvelopeV1(tampered, { fixtureBinding: binding }).valid, false);
  await redis.set(keys.state, JSON.stringify(tampered));
  await assert.rejects(() => readAthleteConsultingSessionEnvelopeV1({ redis, keys, fixtureBinding: binding }), /FIXTURE_BINDING_INVALID|HASH_INVALID/u);

  redis.values.delete(keys.state);
  const oversized = structuredClone(envelope);
  oversized.padding = 'x'.repeat(4 * 1024 * 1024);
  const body = { ...oversized };
  delete body.envelope_hash;
  oversized.envelope_hash = hashCanonicalJson(body);
  await withAthleteConsultingSessionLeaseV1({
    redis,
    keys,
    operation: (lease) => assert.rejects(() => persistAthleteConsultingSessionEnvelopeV1({ redis, keys, fixtureBinding: binding, lease, envelope: oversized }), /TOO_LARGE/u),
  });
  assert.equal(redis.values.has(keys.state), false);
});

test('successful state commit is readable, rotates one stable backup, and refuses a stale owner', async () => {
  const redis = new FakeRedis();
  const binding = fixtureBinding('mika');
  const keys = athleteConsultingSessionKeys({ fixtureBinding: binding });
  const runtime = await structuralRuntime('mika');
  const initial = createAthleteConsultingSessionEnvelopeV1({
    fixtureBinding: binding,
    runtimeSnapshot: runtime.snapshot(),
    now: new Date(fixedClock()),
  });
  await withAthleteConsultingSessionLeaseV1({
    redis,
    keys,
    operation: (lease) => persistAthleteConsultingSessionEnvelopeV1({ redis, keys, fixtureBinding: binding, lease, envelope: initial }),
  });
  await runtime.dispatch('START_MY_FIRST_SESSION', { idempotency_key: 'backup-start-0001' });
  const advanced = createAthleteConsultingSessionEnvelopeV1({
    fixtureBinding: binding,
    runtimeSnapshot: runtime.snapshot(),
    priorEnvelope: initial,
    now: new Date(fixedClock()),
  });
  await withAthleteConsultingSessionLeaseV1({
    redis,
    keys,
    operation: (lease) => persistAthleteConsultingSessionEnvelopeV1({
      redis, keys, fixtureBinding: binding, lease, envelope: advanced, rotateBackup: true,
    }),
  });
  const read = await readAthleteConsultingSessionEnvelopeV1({ redis, keys, fixtureBinding: binding });
  assert.equal(read.envelope.envelope_hash, advanced.envelope_hash);
  assert.equal(JSON.parse(await redis.get(keys.backup)).envelope_hash, initial.envelope_hash);
  const before = await redis.get(keys.state);
  const staleLease = { key: keys.lock, owner: 'stale-owner', lease_ms: 30_000, lost: false };
  await assert.rejects(() => persistAthleteConsultingSessionEnvelopeV1({
    redis, keys, fixtureBinding: binding, lease: staleLease, envelope: advanced,
  }), /DURABLE_LOCK_LOST/u);
  assert.equal(await redis.get(keys.state), before);
});

test('renewable owner-checked lease rejects same-fixture collision and permits cross-fixture work', async () => {
  const redis = new FakeRedis();
  const mikaKeys = athleteConsultingSessionKeys({ fixtureBinding: fixtureBinding('mika') });
  const averyKeys = athleteConsultingSessionKeys({ fixtureBinding: fixtureBinding('avery') });
  let release;
  const held = withAthleteConsultingSessionLeaseV1({
    redis,
    keys: mikaKeys,
    leaseMs: 30,
    renewEveryMs: 5,
    operation: async (lease) => {
      await new Promise((resolve) => { release = resolve; });
      await lease.assertOwned();
      return 'mika-complete';
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 8));
  await assert.rejects(() => withAthleteConsultingSessionLeaseV1({ redis, keys: mikaKeys, operation: async () => null }), /REQUEST_IN_FLIGHT/u);
  assert.equal(await withAthleteConsultingSessionLeaseV1({ redis, keys: averyKeys, operation: async () => 'avery-complete' }), 'avery-complete');
  await new Promise((resolve) => setTimeout(resolve, 20));
  release();
  assert.equal(await held, 'mika-complete');
  assert.ok(redis.calls.some((call) => call[0] === 'eval' && String(call[1]).includes('PEXPIRE')));
});

test('Athlete feature gate, actor controls, and multiple one-time state-bound CSRF proofs are isolated', async () => {
  const redis = new FakeRedis();
  const enabled = {
    RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true',
    SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true',
    ATHLETE_CONSULTING_DARREN_DEMO_ENABLED: 'true',
  };
  assert.equal(athleteConsultingDarrenDemoEnabled({ ...enabled, SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'false' }), false);
  assert.equal(athleteConsultingDarrenDemoEnabled(enabled), true);
  const binding = fixtureBinding('mika');
  const keys = athleteConsultingSessionKeys({ fixtureBinding: binding });
  const args = {
    redis,
    capabilityHash: 'a'.repeat(64),
    fixtureScopeHash: keys.fixture_scope_hash,
    runtimeStateHash: 'b'.repeat(64),
    resetEpoch: 0,
  };
  const first = await issueAthleteConsultingDemoCsrf(args);
  const second = await issueAthleteConsultingDemoCsrf(args);
  assert.notEqual(first, second);
  assert.equal(await consumeAthleteConsultingDemoCsrf({ ...args, proof: first }), true);
  assert.equal(await consumeAthleteConsultingDemoCsrf({ ...args, proof: first }), false);
  assert.equal(await consumeAthleteConsultingDemoCsrf({ ...args, proof: second, runtimeStateHash: 'c'.repeat(64) }), false);
  const authority = deriveAthleteConsultingActorCapabilities({ capabilityToken: 'd'.repeat(43), fixtureId: 'mika' });
  assert.equal(new Set(Object.values(authority)).size, 4);
  assert.doesNotMatch(JSON.stringify([...redis.values.values()]), new RegExp(authority.athlete, 'u'));
});
