import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveFutureVersion, createFutureIdentitySet, describeProbabilityChange, normalizeFutureSupport,
  probabilityConfidence, validateCanonicalFutureSet, versionFutureSet } from '../src/lib/intelligenceFabric/index.js';

const scope = { tenant_id: 'tenant_synthetic', business_id: 'business_synthetic', profile_id: 'profile_synthetic', as_of_at: '2026-07-20T12:00:00.000Z' };
const definitions = (probabilities = [.4, .3, .15, .1, .05]) => ['CURRENT', 'MOST_LIKELY_NEXT', 'ALTERNATIVE_1', 'ALTERNATIVE_2', 'ALTERNATIVE_3'].map((slot, i) => ({ slot, name: `Future ${i + 1}`, status: i ? 'ALTERNATIVE_TRAJECTORY' : 'CURRENTLY_ACTIVE', probability: probabilities[i] }));

test('five future identities remain stable while content versions change', () => {
  const ids = createFutureIdentitySet(scope).identities;
  const first = versionFutureSet({ identities: ids, definitions: definitions(), as_of_at: scope.as_of_at });
  const changed = definitions(); changed[0].name = 'Renamed current future';
  const second = versionFutureSet({ identities: ids, definitions: changed, prior_versions: first.versions, as_of_at: '2026-07-21T12:00:00.000Z' });
  assert.deepEqual(second.versions.map((x) => x.stable_future_identity), first.versions.map((x) => x.stable_future_identity));
  assert.equal(second.versions[0].version, 2); assert.equal(second.versions[1].version, 1);
  assert.equal(validateCanonicalFutureSet(second.versions).valid, true);
  assert.equal(archiveFutureVersion(second.versions[0], { as_of_at: '2026-07-22T00:00:00.000Z', reason: 'superseded set' }).previous_version_id, second.versions[0].future_state_id);
});

test('exact-five and tenant boundaries fail closed', () => {
  const ids = createFutureIdentitySet(scope).identities;
  const set = versionFutureSet({ identities: ids, definitions: definitions(), as_of_at: scope.as_of_at }).versions;
  assert.equal(validateCanonicalFutureSet(set.slice(0, 4)).valid, false);
  assert.equal(validateCanonicalFutureSet([...set, { ...set[0], stable_future_identity: 'sixth' }]).valid, false);
  assert.throws(() => versionFutureSet({ identities: ids, definitions: definitions(), prior_versions: [{ ...set[0], tenant_id: 'tenant_attack' }], as_of_at: scope.as_of_at }), /CROSS_TENANT/);
});

test('probability normalization is deterministic, bounded, and separate from confidence', () => {
  const ids = createFutureIdentitySet(scope).identities;
  const raw = ids.map((id, i) => ({ stable_future_identity: id.stable_future_identity, raw_support: [4, 3, 1.5, 1, .5][i] }));
  const a = normalizeFutureSupport(raw); const b = normalizeFutureSupport(raw);
  assert.deepEqual(a, b); assert.equal(a.receipt.probability_sum, 1); assert.equal(a.receipt.calibration_status, 'DETERMINISTIC_REFERENCE_NOT_CALIBRATED');
  assert.equal(probabilityConfidence({ support_count: 1, missing_count: 4 }).level, 'LOW');
  assert.equal(normalizeFutureSupport(raw.slice(1)).ok, false);
  assert.equal(normalizeFutureSupport(raw.map((x, i) => ({ ...x, raw_support: i ? x.raw_support : Number.NaN }))).ok, false);
});

test('suspension redistributes and non-material evidence records non-change', () => {
  const ids = createFutureIdentitySet(scope).identities;
  const normalized = normalizeFutureSupport(ids.map((id, i) => ({ stable_future_identity: id.stable_future_identity, raw_support: 1, suspended: i === 4 })));
  assert.equal(normalized.vector[4].probability, 0); assert.equal(normalized.receipt.probability_sum, 1);
  assert.deepEqual(describeProbabilityChange(.2, .201).reason, ['NO_MATERIAL_EVIDENCE_CHANGE']);
});
