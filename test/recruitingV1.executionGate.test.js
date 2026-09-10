import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createRecruitingHttpHandler } from '../api/engine/recruitingV1/http.js';

const CANDIDATE_ID = 'candidate-execution-gate-1';

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

async function invoke({ host, forwardedHost, executionDisabled = false }) {
  let preparationInput = null;
  const service = {
    async consumeManagerCsrf(token, csrf) {
      assert.equal(token, 'manager-session');
      assert.equal(csrf, 'csrf-proof');
    },
    async issueManagerCsrf(token) {
      assert.equal(token, 'manager-session');
      return 'csrf-next';
    },
  };
  const handler = createRecruitingHttpHandler({
    service,
    env: {
      RECRUITING_V1_ENABLED: 'true',
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      MINI_V2_EXECUTION_DISABLED: executionDisabled ? 'true' : 'false',
    },
    prepareConsultingResults: async (input) => {
      preparationInput = input;
      return {
        preparation: {
          state: 'BOS_JOB_RESUMING',
          candidate_id: CANDIDATE_ID,
          missing_assessment: null,
          message: 'Saved progress remains closed until canonical activation.',
          retryable: false,
          retry_after_ms: null,
        },
        candidate: { candidate_id: CANDIDATE_ID, consulting_ready: false },
      };
    },
  });
  const res = response();
  await handler({
    method: 'POST',
    headers: {
      host,
      'x-forwarded-host': forwardedHost,
      'x-forwarded-proto': 'https',
      origin: `https://${host}`,
      cookie: '__Host-more_recruiting_manager=manager-session',
      'x-recruiting-csrf': 'csrf-proof',
    },
    body: { action: 'PREPARE_CONSULTING_RESULTS', candidate_id: CANDIDATE_ID },
  }, res);
  assert.equal(res.statusCode, 200);
  return preparationInput;
}

test('spoofed forwarded host cannot open execution on an unaliased Production target', async () => {
  assert.deepEqual(await invoke({
    host: 'release-5-candidate.example.vercel.app',
    forwardedHost: 'moremindmap.com',
  }), {
    sessionToken: 'manager-session',
    candidateId: CANDIDATE_ID,
    allowLegacyDrainStart: false,
    allowBosExecution: false,
    preparationExecutionAllowed: false,
  });
});

test('only the actual canonical Host opens execution and the activation drain', async () => {
  assert.deepEqual(await invoke({
    host: 'moremindmap.com',
    forwardedHost: 'release-5-candidate.example.vercel.app',
  }), {
    sessionToken: 'manager-session',
    candidateId: CANDIDATE_ID,
    allowLegacyDrainStart: true,
    allowBosExecution: true,
    preparationExecutionAllowed: true,
  });
});

test('rollback quarantine disables execution even on the actual canonical Host', async () => {
  assert.deepEqual(await invoke({
    host: 'moremindmap.com',
    forwardedHost: 'moremindmap.com',
    executionDisabled: true,
  }), {
    sessionToken: 'manager-session',
    candidateId: CANDIDATE_ID,
    allowLegacyDrainStart: true,
    allowBosExecution: false,
    preparationExecutionAllowed: false,
  });
});

test('the public BOS status route also derives canonical execution only from Host', () => {
  const source = fs.readFileSync(new URL('../api/moremindmap/status.js', import.meta.url), 'utf8');
  const gate = source.slice(source.indexOf('function canonicalProductionRequest'), source.indexOf('export default async function handler'));
  assert.match(gate, /req\.headers\?\.host/u);
  assert.doesNotMatch(gate, /x-forwarded-host/u);
  assert.match(source, /executionAllowed: miniV2ExecutionAllowed/u);
});
