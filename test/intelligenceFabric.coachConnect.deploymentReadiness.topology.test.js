import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNotExecutedDeploymentReceipt,
  validateDeploymentReceipt,
  validateGateRecord,
  aggregateGateRecords,
} from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/activationGates.js';
import { CONTRACT_VERSIONS } from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/constants.js';
import {
  createOfflineTopology,
  topologyDigest,
  validateTopology,
} from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/topology.js';

test('provider-neutral offline topology covers every route and selects initial Vercel target', () => {
  const value = createOfflineTopology();
  assert.equal(validateTopology(value).valid, true);
  assert.equal(value.deployment_adapter_class, 'PROVIDER_SPECIFIC_DEPLOYMENT_ADAPTER');
  assert.equal(value.selected_initial_target, 'VERCEL');
  assert.equal(value.live_inspection_performed, false);
});

test('public alias, incomplete edge protection, preview, and existing public project fail', () => {
  for (const mutation of [
    { public_alias_permitted: true },
    { global_edge_access_required: false },
    { existing_public_project_excluded: false },
    { route_classes: { SPA_ROOT: 'OUTER_ACCESS_DENIED' } },
  ]) assert.equal(validateTopology(createOfflineTopology(mutation)).valid, false);
});

const gate = (overrides = {}) => ({
  gate_record_version: CONTRACT_VERSIONS.gate,
  gate_id: 'gate-offline',
  campaign_id: 'MORE_CAMPAIGN_COACH_CONNECT_DEPLOYMENT_READINESS_V1',
  artifact_sha: 'a'.repeat(64),
  artifact_manifest_sha256: 'b'.repeat(64),
  configuration_digest: 'd'.repeat(64),
  environment_id: 'offline-readiness',
  topology_digest: topologyDigest(createOfflineTopology()),
  evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
  evidence_refs: ['proof-offline'],
  approved_by_roles: [],
  approved_at: '2026-07-25T00:00:00.000Z',
  expires_at: '2099-01-01T00:00:00.000Z',
  state: 'PASS_DEPLOYMENT_SHAPED_OFFLINE',
  limitations: ['INTERNAL_LIVE_PENDING'],
  ...overrides,
});

test('gate records validate but never grant activation', () => {
  assert.equal(validateGateRecord(gate()).valid, true);
  assert.deepEqual(aggregateGateRecords([gate()]), {
    activation_permitted: false,
    state: 'READY_FOR_HUMAN_REVIEW',
    errors: [],
  });
});

test('expired and digest-mismatched gates block', () => {
  assert.equal(validateGateRecord(gate({ expires_at: '2026-01-01T00:00:00.000Z' })).valid, false);
  const result = aggregateGateRecords([gate(), gate({ configuration_digest: 'e'.repeat(64) })]);
  assert.equal(result.activation_permitted, false);
  assert.equal(result.state, 'BLOCKED_AUTHORITY');
});

test('not-executed receipt includes mandatory fields and keeps activation inactive', () => {
  const receipt = createNotExecutedDeploymentReceipt();
  assert.equal(validateDeploymentReceipt(receipt).valid, true);
  for (const field of [
    'deployment_receipt_version', 'deployment_window_id', 'artifact_sha',
    'config_digest', 'environment_id', 'rollback_artifact',
    'rollback_config_digest', 'deployment_operator', 'deployment_started',
    'deployment_completed', 'deployment_result', 'activation_state',
  ]) assert.ok(field in receipt);
  assert.equal(receipt.activation_state, 'INACTIVE_DEFAULT_OFF');
});

test('successful, activated, sensitive, or side-effecting receipts fail', () => {
  for (const mutation of [
    { deployment_result: 'SUCCESS' },
    { activation_state: 'ACTIVE' },
    { provider_call_count: 1 },
    { persistence_write_count: 1 },
    { stripe_call_count: 1 },
    { transcript_record_count: 1 },
    { deployment_operator: 'SUBDEV1' },
    { access_token: 'sensitive-canary' },
  ]) assert.equal(validateDeploymentReceipt(createNotExecutedDeploymentReceipt(mutation)).valid, false);
});
