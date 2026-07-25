import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_RUNBOOK_IDS } from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/constants.js';
import {
  createOfflineRunbookManifest,
  validateRunbookManifest,
  validateRunbookSet,
} from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/runbooks.js';

const titles = Object.fromEntries(REQUIRED_RUNBOOK_IDS.map((id) => [id, id.replaceAll('_', ' ')]));

test('all eleven offline runbook manifests validate', () => {
  const manifests = REQUIRED_RUNBOOK_IDS.map((id) => createOfflineRunbookManifest(id, titles[id]));
  assert.deepEqual(validateRunbookSet(manifests), { valid: true, missing: [], invalid: [] });
});

test('credentials, production actions, and missing stop gates fail', () => {
  for (const mutation of [
    { credential_required: true },
    { production_action_required: true },
    { stop_conditions: [] },
    { access_token: 'sensitive-canary' },
  ]) assert.equal(validateRunbookManifest(createOfflineRunbookManifest('deploy', 'deploy', mutation)).valid, false);
});

test('all eleven documents contain governed offline sections', () => {
  const root = path.resolve('docs/runbooks/coach_connect/deployment_readiness');
  for (const id of REQUIRED_RUNBOOK_IDS) {
    const body = fs.readFileSync(path.join(root, `${id}.md`), 'utf8');
    for (const heading of [
      'Authority', 'Prerequisites', 'Stop conditions', 'Ordered procedure',
      'Verification', 'Evidence outputs', 'Rollback and escalation', 'Prohibited actions',
    ]) assert.match(body, new RegExp(`## ${heading}`));
    assert.match(body, /No deployment or platform action is authorized/u);
    assert.doesNotMatch(body, /physical deletion of the local JSONL/u);
  }
});

test('missing or duplicate runbook blocks the set', () => {
  const manifests = REQUIRED_RUNBOOK_IDS.slice(1).map((id) => createOfflineRunbookManifest(id, titles[id]));
  assert.equal(validateRunbookSet(manifests).valid, false);
  assert.deepEqual(validateRunbookSet(manifests).missing, ['deploy']);
});
