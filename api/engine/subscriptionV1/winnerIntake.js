import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';

export const PAID_WINNER_ACCEPTANCE_SCHEMA = 'more.subscription.paid-winner-acceptance-capsule/v1';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const PINNED_CAPSULE_SHA256 = '2186522347323e4576b559bf55f7db3904a8a66d3d4ced177c89dfc76a96b9a3';

const PINNED_PAID_WINNER_ACCEPTANCE = deepFreeze({
  schema: PAID_WINNER_ACCEPTANCE_SCHEMA,
  artifact_id: 'TEST02_M2_F09_LOCAL_2026_09_11',
  selection_id: 'MODEL2',
  artifact_raw_sha256: 'c72870338c643e5259cd3c1d489af2c170c2503afb55630f9959c55a02c8b46c',
  artifact_payload_sha256: '1e50a2f06bdef98b96dd9e1ab1756770afe07decb6c461a3182cebfbb580c723',
  digest_clarification_sha256: '0afad0fbc7a6022a4504c17c873fbfd65ff4d46e6a7a645ae45409ac2d840506',
  acceptance: {
    status: 'FINAL_ACCEPTED_FOR_BOUNDED_INTEGRATION_REVIEW',
    actual_provider_proof: true,
    scoped_unresolved_failed_gates: 0,
    historical_failed_rounds_preserved: 1,
    open_release_gate_count: 4,
    unresolved_release_gates_sha256: 'a3b9ee5b113587ce2dbf30462d23e493429b70e3a76a34ff95869c86a20ad51c',
    release_accepted: false,
    production_authority: false,
  },
  authority: {
    authority_id: 'FUTURE_SPOCK_TEST02_M2_F09_BOUNDED_INTEGRATION_REVIEW',
    authority_version: '1',
    decided_at: '2026-09-11T23:58:08.621Z',
    authority_raw_sha256: '4f151448da7b8d37227ec077a014f6b5913f7c6a5f009136b18341ab3b4137bb',
  },
  source: {
    kind: 'local_frozen_source_snapshot',
    product_manifest_sha256: '0a1ce96b97f2fe51d73c90151f8bfb4f4d1f053c5a4b0d2e06bf23958407e5db',
    source_delta_sha256: '7c016f632954328a4b896b29c243dd5bd696d6c7eb1bfb537e55ca7aaaf4c779',
    new_candidate_commit: null,
    new_candidate_tree: null,
    new_candidate_deployment: null,
  },
  groups: {
    assignment_sha256: '7c03ca3179557d9f6cbb8ead922d947c6ac2886dcff9f34484be6a9acf10eebf',
    runtime_policy_sha256: 'e3d0d834fdec5650087c0c4b135feb443294e7fb55843632c58eb659184ceea6',
    coaching_inputs_sha256: '0933aee69fe40e1672991a4760af9395582c6fc78c51f8bdb8b9db26540d1ca7',
  },
});

const CAPSULE_KEYS = Object.freeze([
  'acceptance',
  'artifact_id',
  'artifact_payload_sha256',
  'artifact_raw_sha256',
  'authority',
  'digest_clarification_sha256',
  'groups',
  'schema',
  'selection_id',
  'source',
]);
const ACCEPTANCE_KEYS = Object.freeze([
  'actual_provider_proof',
  'historical_failed_rounds_preserved',
  'open_release_gate_count',
  'production_authority',
  'release_accepted',
  'scoped_unresolved_failed_gates',
  'status',
  'unresolved_release_gates_sha256',
]);
const AUTHORITY_KEYS = Object.freeze([
  'authority_id',
  'authority_raw_sha256',
  'authority_version',
  'decided_at',
]);
const SOURCE_KEYS = Object.freeze([
  'kind',
  'new_candidate_commit',
  'new_candidate_deployment',
  'new_candidate_tree',
  'product_manifest_sha256',
  'source_delta_sha256',
]);
const GROUP_KEYS = Object.freeze([
  'assignment_sha256',
  'coaching_inputs_sha256',
  'runtime_policy_sha256',
]);

export class PaidWinnerAcceptanceError extends Error {
  constructor() {
    super('SUBSCRIPTION_V1_PAID_WINNER_ACCEPTANCE_INVALID');
    this.name = 'PaidWinnerAcceptanceError';
    this.code = 'SUBSCRIPTION_V1_PAID_WINNER_ACCEPTANCE_INVALID';
  }
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function isSha256(value) {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function isPinnedShape(capsule) {
  return hasExactKeys(capsule, CAPSULE_KEYS)
    && hasExactKeys(capsule.acceptance, ACCEPTANCE_KEYS)
    && hasExactKeys(capsule.authority, AUTHORITY_KEYS)
    && hasExactKeys(capsule.source, SOURCE_KEYS)
    && hasExactKeys(capsule.groups, GROUP_KEYS)
    && [
      capsule.artifact_raw_sha256,
      capsule.artifact_payload_sha256,
      capsule.digest_clarification_sha256,
      capsule.acceptance.unresolved_release_gates_sha256,
      capsule.authority.authority_raw_sha256,
      capsule.source.product_manifest_sha256,
      capsule.source.source_delta_sha256,
      capsule.groups.assignment_sha256,
      capsule.groups.coaching_inputs_sha256,
      capsule.groups.runtime_policy_sha256,
    ].every(isSha256);
}

function preservesBoundedAuthority(capsule) {
  return capsule.schema === PAID_WINNER_ACCEPTANCE_SCHEMA
    && capsule.selection_id === 'MODEL2'
    && capsule.acceptance.status === 'FINAL_ACCEPTED_FOR_BOUNDED_INTEGRATION_REVIEW'
    && capsule.acceptance.actual_provider_proof === true
    && capsule.acceptance.scoped_unresolved_failed_gates === 0
    && capsule.acceptance.historical_failed_rounds_preserved === 1
    && capsule.acceptance.open_release_gate_count === 4
    && capsule.acceptance.release_accepted === false
    && capsule.acceptance.production_authority === false
    && capsule.source.kind === 'local_frozen_source_snapshot'
    && capsule.source.new_candidate_commit === null
    && capsule.source.new_candidate_tree === null
    && capsule.source.new_candidate_deployment === null
    && TIMESTAMP_PATTERN.test(capsule.authority.decided_at);
}

/**
 * Server-private compile-time admission gate for the already-selected paid
 * policy. It returns no custody, model, or provider metadata. The optional
 * argument exists only so tests can prove altered custody fails closed.
 */
export function requirePinnedPaidWinnerAcceptance(capsule = PINNED_PAID_WINNER_ACCEPTANCE) {
  if (!isPinnedShape(capsule)
    || !preservesBoundedAuthority(capsule)
    || hashCanonicalJson(capsule) !== PINNED_CAPSULE_SHA256) {
    throw new PaidWinnerAcceptanceError();
  }
  return true;
}
