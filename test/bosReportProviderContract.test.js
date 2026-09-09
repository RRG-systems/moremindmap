import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  assertGovernedReportContent,
  buildBosReportCompletionRequest,
  generateWithGPT,
  usesDefaultBosReportTemperature,
  validateAndProcessGPTOutput,
} from '../api/engine/generateReportContent.js';
import {
  executeFinalInjection,
  executeFirstInjection,
} from '../api/engine/miniV2StagedExecutor.js';

function fakeClient(result) {
  return {
    chat: {
      completions: {
        create: async () => result,
      },
    },
  };
}

function completeProviderOutput() {
  return {
    metadata: {},
    page01_cover: {},
    page02_operating_system_map: {},
    page03_executive_summary: {},
    page04_operating_pattern: {},
    page05_decision_architecture: {},
    page06_communication_style: {},
    page07_system_under_strain: {},
    page08_operating_environment_fit: {},
    page09_facilitator_notes: {},
    page10_full_profile_unlocks: {},
    generation_metadata: {},
  };
}

test('GPT-5 and o-series BOS requests omit unsupported custom temperature', () => {
  for (const model of ['gpt-5.5', 'gpt-5.5-2026-04-23', 'o3', 'o4-mini', 'chatgpt-4o-latest']) {
    assert.equal(usesDefaultBosReportTemperature(model), true);
    const request = buildBosReportCompletionRequest({ prompt: 'synthetic', model });
    assert.equal(Object.hasOwn(request, 'temperature'), false);
    assert.equal(request.max_completion_tokens, 16000);
    assert.equal(request.response_format.type, 'json_object');
  }
});

test('temperature-compatible legacy BOS models retain the established 0.3 setting and metadata', async () => {
  const request = buildBosReportCompletionRequest({ prompt: 'synthetic', model: 'gpt-4o-2024-08-06' });
  assert.equal(usesDefaultBosReportTemperature(request.model), false);
  assert.equal(request.temperature, 0.3);
  assert.equal(request.max_completion_tokens, 16000);

  const result = await generateWithGPT('synthetic', {
    apiKey: 'synthetic-test-key',
    model: request.model,
    clientFactory: () => fakeClient({
      model: 'gpt-4o-2024-08-06',
      choices: [{ message: { content: JSON.stringify(completeProviderOutput()) } }],
    }),
  });
  const processed = validateAndProcessGPTOutput(result.output, false, result);
  assert.equal(processed.generation_metadata.model_used, 'gpt-4o-2024-08-06');
  assert.equal(processed.generation_metadata.temperature, 0.3);
});

test('missing BOS provider configuration fails closed without a mock result', async () => {
  await assert.rejects(
    generateWithGPT('synthetic', { apiKey: '', model: 'gpt-5.5' }),
    /BOS_REPORT_PROVIDER_NOT_CONFIGURED/u,
  );
  assert.throws(
    () => buildBosReportCompletionRequest({ prompt: 'synthetic', model: '' }),
    /BOS_REPORT_MODEL_NOT_CONFIGURED/u,
  );
});

test('provider 400, 429, 500, timeout, and generic failures reject without mock output', async () => {
  const originalError = console.error;
  const capturedLogs = [];
  console.error = (...args) => capturedLogs.push(args);
  try {
    for (const failure of [
      { status: 400, code: 'unsupported_value' },
      { status: 429, code: 'rate_limit' },
      { status: 500, code: 'provider_internal' },
      { status: null, code: 'timeout' },
      { status: null, code: null },
    ]) {
      await assert.rejects(
        generateWithGPT('synthetic', {
          apiKey: 'synthetic-test-key',
          model: 'gpt-5.5',
          clientFactory: () => ({
            chat: {
              completions: {
                create: async () => {
                  const error = new Error('provider-detail-must-not-be-logged');
                  if (failure.status) error.status = failure.status;
                  if (failure.code) error.code = `provider-controlled-${failure.code}`;
                  throw error;
                },
              },
            },
          }),
        }),
        (error) => error.message === 'BOS_REPORT_PROVIDER_REQUEST_FAILED'
          && error.cause === undefined,
      );
    }
  } finally {
    console.error = originalError;
  }
  const serializedLogs = JSON.stringify(capturedLogs);
  assert.equal(serializedLogs.includes('provider-detail-must-not-be-logged'), false);
  assert.equal(serializedLogs.includes('provider-controlled-'), false);
  assert.equal(capturedLogs.length, 5);
  for (const [, details] of capturedLogs) {
    assert.deepEqual(Object.keys(details).sort(), ['code', 'status']);
    assert.equal(details.code, 'BOS_REPORT_PROVIDER_REQUEST_FAILED');
    assert.equal(details.status === null || Number.isInteger(details.status), true);
  }
});

test('missing, empty, malformed, and non-object provider responses fail closed', async () => {
  for (const completion of [
    {},
    { choices: [] },
    { choices: [{ message: { content: '' } }] },
    { choices: [{ message: { content: 'not-json' } }] },
    { model: 'gpt-5.5-actual', choices: [{ message: { content: 'null' } }] },
    { model: 'gpt-5.5-actual', choices: [{ message: { content: '[]' } }] },
    { model: 'gpt-5.5-actual', choices: [{ message: { content: '"scalar"' } }] },
    { model: 'gpt-5.5-actual', choices: [{ message: { content: '42' } }] },
    { model: 'gpt-5.5-actual', choices: [{ message: { content: 'true' } }] },
  ]) {
    await assert.rejects(
      generateWithGPT('synthetic', {
        apiKey: 'synthetic-test-key',
        model: 'gpt-5.5',
        clientFactory: () => fakeClient(completion),
      }),
      /BOS_REPORT_PROVIDER_RESPONSE_INVALID/u,
    );
  }
});

test('accepted provider JSON records the actual model and default-temperature contract', async () => {
  let capturedRequest;
  const output = completeProviderOutput();
  const result = await generateWithGPT('synthetic', {
    apiKey: 'synthetic-test-key',
    model: 'gpt-5.5',
    clientFactory: () => ({
      chat: {
        completions: {
          create: async (request) => {
            capturedRequest = request;
            return {
              model: 'gpt-5.5-provider-snapshot',
              choices: [{ message: { content: JSON.stringify(output) } }],
            };
          },
        },
      },
    }),
  });
  assert.equal(result.generation_mode, 'gpt');
  assert.equal(result.model, 'gpt-5.5-provider-snapshot');
  assert.equal(result.temperature, null);
  assert.equal(Object.hasOwn(capturedRequest, 'temperature'), false);

  const processed = validateAndProcessGPTOutput(result.output, false, result);
  assert.equal(processed.generation_metadata.generation_mode, 'gpt');
  assert.equal(processed.generation_metadata.model_used, 'gpt-5.5-provider-snapshot');
  assert.equal(processed.generation_metadata.temperature, 'provider_default');
  assert.equal(assertGovernedReportContent(processed), processed);
});

test('provider output missing the governed page schema cannot be accepted', () => {
  assert.throws(
    () => validateAndProcessGPTOutput({ metadata: {}, generation_metadata: {} }),
    /Missing required keys/u,
  );
});

test('mock mode and mock markers are rejected by the governed completion contract', () => {
  assert.throws(
    () => assertGovernedReportContent({ generation_metadata: { generation_mode: 'mock' } }),
    /BOS_REPORT_GOVERNED_CONTENT_REQUIRED/u,
  );
  assert.throws(
    () => assertGovernedReportContent({
      generation_metadata: { generation_mode: 'gpt' },
      page01_cover: { body: '[MOCK] synthetic fallback' },
    }),
    /BOS_REPORT_GOVERNED_CONTENT_REQUIRED/u,
  );
});

test('staged injection rejects mock reports before any completion update', async () => {
  const mockJob = {
    job_id: 'synthetic-mock-job',
    diagnostics: {},
    reportContent: {
      generation_metadata: { generation_mode: 'mock' },
      page01_cover: { body: '[MOCK] synthetic fallback' },
    },
  };
  await assert.rejects(
    executeFirstInjection(mockJob),
    /BOS_REPORT_GOVERNED_CONTENT_REQUIRED/u,
  );
  await assert.rejects(
    executeFinalInjection(mockJob),
    /BOS_REPORT_GOVERNED_CONTENT_REQUIRED/u,
  );
});

test('the governed generator source contains no mock report output path', () => {
  const source = fs.readFileSync(new URL('../api/engine/generateReportContent.js', import.meta.url), 'utf8');
  assert.equal(source.includes('generateMockContent'), false);
  assert.equal(/generation_mode:\s*['"]mock['"]/u.test(source), false);
  assert.equal(source.includes("return { generation_mode: 'mock'"), false);
});
