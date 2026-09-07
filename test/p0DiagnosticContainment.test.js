import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createNewBosProductionRouteHandler } from '../api/engine/newBosProductionReadinessV1/routeHandler.js';
import { formatJobResponse, JOB_STATUS } from '../api/engine/miniV2JobManager.js';
import {
  NEW_BOS_PRODUCTION_ENVIRONMENT_CONTRACT,
  readNewBosProductionConfig,
} from '../api/engine/newBosProductionReadinessV1/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const reported25 = Object.freeze([
  'api/diagnostic-repair.js',
  'api/diagnostic.js',
  'api/diagnostic/dump-job.js',
  'api/diagnostic/get-latest-profile.js',
  'api/diagnostic/get-profile-by-job.js',
  'api/diagnostic/get-vault-profile.js',
  'api/diagnostic/inspect-vault-save.js',
  'api/diagnostic/list-all-profiles.js',
  'api/diagnostic/list-recent-jobs.js',
  'api/diagnostic/redis-vault-check.js',
  'api/diagnostic/retrieve-by-email.js',
  'api/diagnostic/seed-selected-archetypes.js',
  'api/diagnostic/test-vault-keys-endpoint.js',
  'api/diagnostic/test-vault-keys.js',
  'api/get-raw-job.js',
  ...Array.from({ length: 6 }, (_, index) => `api/moremindmap/start-test${index ? index + 1 : ''}.js`),
  'api/ping-test.js',
  'api/test-redis.js',
  'api/test-update-job.js',
  'api/test.js',
]);

const adjacent5 = Object.freeze([
  'api/moremindmap/inspect-job.js',
  'api/moremindmap/mini-profile-v2.js',
  'api/moremindmap/ping.js',
  'api/engine/testMiniProfileGenerator.js',
  'api/engine/testScore.js',
]);

function quarantinePath(relative) {
  if (relative.startsWith('api/diagnostic/')) return relative.replace(/^api\//u, 'quarantined-api-source/');
  if (relative === 'api/engine/testMiniProfileGenerator.js') return 'quarantined-api-source/engine-testMiniProfileGenerator.js';
  if (relative === 'api/engine/testScore.js') return 'quarantined-api-source/engine-testScore.js';
  if (relative.startsWith('api/moremindmap/')) return relative.replace(/^api\//u, 'quarantined-api-source/');
  return relative.replace(/^api\//u, 'quarantined-api-source/');
}

function responseDouble() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('the exact reported 25 and five adjacent non-production handlers are outside the deployable api tree', () => {
  assert.equal(reported25.length, 25);
  assert.equal(adjacent5.length, 5);
  for (const relative of [...reported25, ...adjacent5]) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, relative);
    assert.equal(fs.existsSync(path.join(root, quarantinePath(relative))), true, quarantinePath(relative));
  }
  assert.equal(fs.existsSync(path.join(root, 'quarantined-api-source/README.md')), true);
});

test('deployable source cannot import the quarantined HTTP handlers', () => {
  const deployableFiles = execFileSync('git', ['ls-files', 'api'], { cwd: root, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  for (const relative of deployableFiles) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.doesNotMatch(source, /quarantined-api-source/u, relative);
  }
});

test('legitimate internal diagnostic and vault libraries remain deployable', () => {
  for (const relative of [
    'api/engine/newBosProductionReadinessV1/diagnostics.js',
    'api/engine/newBaProductionReadinessV1/diagnostics.js',
    'api/engine/vault/saveCanonicalProfile.js',
    'api/engine/vault/getCanonicalProfile.js',
  ]) assert.equal(fs.existsSync(path.join(root, relative)), true, relative);
});

test('active vault source cannot log or return Redis connection material', () => {
  const source = fs.readFileSync(path.join(root, 'api/engine/vault/saveCanonicalProfile.js'), 'utf8');
  assert.doesNotMatch(source, /redis_url_env|redis_url_host_extracted/u);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^\n]*REDIS_URL/u);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^\n]*redisUrl/u);
});

test('the retained Product Profile route no longer projects storage-key or raw-error diagnostics', () => {
  const source = fs.readFileSync(path.join(root, 'api/moremindmap/retrieve-profile.js'), 'utf8');
  assert.doesNotMatch(source, /_debug_key_attempts|Full error details|stack_sample/u);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^\n]*(?:lowercaseKey|uppercaseKey|profileData)/u);
  assert.doesNotMatch(source, /message:\s*error\.message/u);
});

test('the retained Product job-status projection excludes internal diagnostics, storage keys, and raw failures', () => {
  const complete = formatJobResponse({
    status: JOB_STATUS.COMPLETE,
    job_id: 'synthetic-job',
    result_html: '<main>synthetic</main>',
    result_metadata: { pages_rendered: 10 },
    diagnostics: { storage_key: 'vault:profile:synthetic', provider: 'internal' },
    canonical_diagnostics: { vault_keys_created: ['vault:profile:synthetic'] },
    canonical_profile_id: 'mm-20990101-demo0001',
    canonical_company_name: 'Synthetic Company',
    created_at: '2099-01-01T00:00:00.000Z',
    updated_at: '2099-01-01T00:01:00.000Z',
  });
  assert.deepEqual(Object.keys(complete).sort(), [
    'canonical_profile_id', 'created_at', 'html', 'job_id', 'metadata', 'status', 'success', 'updated_at',
  ]);
  assert.doesNotMatch(JSON.stringify(complete), /diagnostic|vault:|Synthetic Company|provider/u);

  const failed = formatJobResponse({
    status: JOB_STATUS.FAILED,
    job_id: 'synthetic-job',
    error: 'provider_secret_internal_failure',
    stage: 'failed',
    created_at: '2099-01-01T00:00:00.000Z',
    updated_at: '2099-01-01T00:01:00.000Z',
  });
  assert.equal(failed.error, 'Generation failed. Please try again.');
  assert.doesNotMatch(JSON.stringify(failed), /provider_secret_internal_failure/u);
});

test('tracked non-test source contains no authenticated Redis URI', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((relative) => relative && !relative.startsWith('test/') && !relative.startsWith('quarantined-api-source/'));
  const credentialPattern = /rediss?:\/\/[^\s"'`]*@/u;
  for (const relative of tracked) {
    let source;
    try { source = fs.readFileSync(path.join(root, relative), 'utf8'); } catch { continue; }
    assert.doesNotMatch(source, credentialPattern, relative);
  }
});

test('a matching public deployment Host never grants New BOS operator authority', async () => {
  const seen = [];
  const authority = 'synthetic-platform-authority-secret-1234567890';
  const handler = createNewBosProductionRouteHandler({
    config: {
      staged: true,
      canaryEnabled: true,
      customerActive: false,
      platformAuthoritySecret: authority,
    },
    serviceFactory: async () => ({
      inspectResumable: async (input) => { seen.push(input); return { ok: true }; },
    }),
  });
  const request = {
    method: 'GET',
    headers: {
      host: 'candidate.vercel.app',
      'x-new-bos-canary-token': 'wrong',
      'x-more-platform-authority': 'x'.repeat(authority.length),
    },
    query: { diagnostic: 'resumable-state', id: 'MM-20990101-DEMO0001' },
  };
  await handler(request, responseDouble());
  assert.equal(seen[0].platformProtected, false);
  await handler({ ...request, headers: { ...request.headers, 'x-more-platform-authority': authority } }, responseDouble());
  assert.equal(seen[1].platformProtected, true);

  const emptyAuthorityHandler = createNewBosProductionRouteHandler({
    config: { staged: true, canaryEnabled: true, customerActive: false, platformAuthoritySecret: '' },
    serviceFactory: async () => ({
      inspectResumable: async (input) => { seen.push(input); return { ok: true }; },
    }),
  });
  await emptyAuthorityHandler({ ...request, headers: { host: 'candidate.vercel.app' } }, responseDouble());
  assert.equal(seen[2].platformProtected, false);
});

test('New BOS platform authority is server-configured and declared in the environment contract', () => {
  const authority = 'synthetic-platform-authority-secret-1234567890';
  const configured = readNewBosProductionConfig({
    NEW_BOS_PRODUCTION_STAGED: 'true',
    NEW_BOS_CANARY_ENABLED: 'true',
    NEW_BOS_PLATFORM_AUTHORITY_SECRET: authority,
  });
  assert.equal(configured.platformAuthoritySecret, authority);
  assert.equal(NEW_BOS_PRODUCTION_ENVIRONMENT_CONTRACT.includes('NEW_BOS_PLATFORM_AUTHORITY_SECRET'), true);
  assert.equal(readNewBosProductionConfig({}).platformAuthoritySecret, '');
});
