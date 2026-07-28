import test from 'node:test';
import assert from 'node:assert/strict';

class OfflineAtomicWinnerModel {
  constructor() {
    this.results = new Map();
    this.effects = new Map();
    this.queue = Promise.resolve();
  }

  execute({ key, fingerprint, effect }) {
    const run = async () => {
      const prior = this.results.get(key);
      if (prior) {
        return prior.fingerprint === fingerprint
          ? { ...prior.result, idempotent_replay: true }
          : { ok: false, code: 'IDEMPOTENCY_FINGERPRINT_CONFLICT' };
      }
      if (this.effects.has(effect)) return { ok: false, code: 'REQUEST_REPLAY_DETECTED' };
      this.effects.set(effect, 1);
      const result = { ok: true, committed: true, idempotent_replay: false };
      this.results.set(key, { fingerprint, result });
      return result;
    };
    const pending = this.queue.then(run, run);
    this.queue = pending.then(() => undefined, () => undefined);
    return pending;
  }
}

test('concurrent exact command retries yield one effect and one durable replay', async () => {
  const model = new OfflineAtomicWinnerModel();
  const commands = Array.from({ length: 32 }, () => model.execute({
    key: 'idempotency_fixture',
    fingerprint: 'fingerprint_fixture',
    effect: 'entitlement_session_fixture',
  }));
  const results = await Promise.all(commands);
  assert.equal(results.filter((result) => result.ok).length, 32);
  assert.equal(results.filter((result) => result.idempotent_replay === false).length, 1);
  assert.equal(results.filter((result) => result.idempotent_replay === true).length, 31);
  assert.equal(model.effects.get('entitlement_session_fixture'), 1);
});

test('same idempotency key with divergent fingerprint fails closed', async () => {
  const model = new OfflineAtomicWinnerModel();
  const [first, second] = await Promise.all([
    model.execute({ key: 'same_key', fingerprint: 'alpha', effect: 'session_fixture' }),
    model.execute({ key: 'same_key', fingerprint: 'beta', effect: 'session_fixture_other' }),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.code, 'IDEMPOTENCY_FINGERPRINT_CONFLICT');
  assert.equal(model.effects.size, 1);
});

test('different CSRF commands targeting one entitlement yield one winner', async () => {
  const model = new OfflineAtomicWinnerModel();
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) => model.execute({
    key: `csrf_attempt_${index}`,
    fingerprint: `fingerprint_${index}`,
    effect: 'one_active_entitlement_per_session_scope',
  })));
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.code === 'REQUEST_REPLAY_DETECTED').length, 19);
});

