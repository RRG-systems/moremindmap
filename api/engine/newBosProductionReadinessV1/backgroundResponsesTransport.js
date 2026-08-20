import crypto from 'node:crypto';

const ACTIVE_STATUSES = new Set(['queued', 'in_progress']);
const FAILURE_STATUSES = new Set(['failed', 'cancelled', 'incomplete']);

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function buildNewBosBackgroundExecutionRequest(scientificRequest) {
  if (!scientificRequest || typeof scientificRequest !== 'object') {
    throw new Error('new_bos_background_scientific_request_required');
  }
  return Object.freeze({ ...scientificRequest, background: true });
}

export function inspectNewBosBackgroundTransportDiff({ scientificRequest, executionRequest } = {}) {
  const reconstructedScientificRequest = { ...executionRequest };
  delete reconstructedScientificRequest.background;
  const failures = [];
  if (executionRequest?.background !== true) failures.push('background_execution_not_enabled');
  if (scientificRequest?.store !== false || executionRequest?.store !== false) {
    failures.push('store_false_not_preserved');
  }
  if (JSON.stringify(scientificRequest) !== JSON.stringify(reconstructedScientificRequest)) {
    failures.push('scientific_request_changed');
  }
  return Object.freeze({
    valid: failures.length === 0,
    failures: Object.freeze(failures),
    scientific_request_sha256: sha256Json(scientificRequest),
    execution_request_sha256: sha256Json(executionRequest),
    field_diff: Object.freeze([Object.freeze({
      path: 'background',
      scientific_request: 'ABSENT',
      execution_request: true,
      classification: 'transport_only',
    })]),
  });
}

function eventFor(response, eventType, pollCount, transportInspection) {
  return Object.freeze({
    event_type: eventType,
    observed_at: new Date().toISOString(),
    provider_response_id: response?.id || null,
    provider_request_id: response?._request_id || null,
    status: response?.status || null,
    poll_count: pollCount,
    scientific_request_sha256: transportInspection.scientific_request_sha256,
    execution_request_sha256: transportInspection.execution_request_sha256,
  });
}

export async function executeNewBosBackgroundResponse({
  client,
  scientificRequest,
  pollIntervalMs = 5_000,
  maxWaitMs = 1_800_000,
  sleep = wait,
  onEvent = async () => {},
} = {}) {
  if (typeof client?.responses?.create !== 'function'
    || typeof client?.responses?.retrieve !== 'function') {
    throw new Error('new_bos_background_client_invalid');
  }
  const executionRequest = buildNewBosBackgroundExecutionRequest(scientificRequest);
  const transportInspection = inspectNewBosBackgroundTransportDiff({
    scientificRequest,
    executionRequest,
  });
  if (!transportInspection.valid) {
    throw new Error(`new_bos_background_request_invalid:${transportInspection.failures.join(',')}`);
  }

  const startedAt = Date.now();
  let pollCount = 0;
  let response = await client.responses.create(executionRequest);
  if (!response?.id) {
    throw Object.assign(new Error('new_bos_background_response_id_missing'), {
      code: 'background_response_id_missing',
    });
  }
  const responseId = response.id;
  await onEvent(eventFor(response, 'background_submitted', pollCount, transportInspection));

  while (ACTIVE_STATUSES.has(response.status)) {
    if (Date.now() - startedAt >= maxWaitMs) {
      throw Object.assign(new Error('new_bos_background_poll_timeout'), {
        code: 'background_poll_timeout',
        responseId,
        pollCount,
      });
    }
    await sleep(pollIntervalMs);
    response = await client.responses.retrieve(responseId);
    pollCount += 1;
    if (response?.id !== responseId) {
      throw Object.assign(new Error('new_bos_background_response_id_changed'), {
        code: 'background_response_id_changed',
        responseId,
        observedResponseId: response?.id || null,
        pollCount,
      });
    }
    await onEvent(eventFor(response, 'background_polled', pollCount, transportInspection));
  }

  if (FAILURE_STATUSES.has(response.status)) {
    throw Object.assign(new Error(`new_bos_background_terminal_failure:${response.status}`), {
      code: 'background_terminal_failure',
      responseId,
      status: response.status,
      pollCount,
      providerResponse: response,
    });
  }
  if (response.status !== 'completed') {
    throw Object.assign(new Error(`new_bos_background_unknown_terminal_status:${response.status || 'missing'}`), {
      code: 'background_unknown_terminal_status',
      responseId,
      status: response.status || null,
      pollCount,
      providerResponse: response,
    });
  }

  return Object.freeze({
    response,
    transport_evidence: Object.freeze({
      mode: 'background',
      submit_count: 1,
      poll_count: pollCount,
      provider_response_id: responseId,
      final_status: response.status,
      ...transportInspection,
    }),
  });
}

export async function resumeNewBosBackgroundResponse({
  client,
  responseId,
  scientificRequest,
  pollIntervalMs = 5_000,
  maxWaitMs = 7_200_000,
  sleep = wait,
  onEvent = async () => {},
} = {}) {
  if (typeof client?.responses?.retrieve !== 'function') {
    throw new Error('new_bos_background_resume_client_invalid');
  }
  if (!responseId || typeof responseId !== 'string') {
    throw new Error('new_bos_background_resume_response_id_required');
  }
  const executionRequest = buildNewBosBackgroundExecutionRequest(scientificRequest);
  const transportInspection = inspectNewBosBackgroundTransportDiff({
    scientificRequest,
    executionRequest,
  });
  if (!transportInspection.valid) {
    throw new Error(`new_bos_background_resume_request_invalid:${transportInspection.failures.join(',')}`);
  }

  const startedAt = Date.now();
  let pollCount = 0;
  let response = await client.responses.retrieve(responseId);
  pollCount += 1;
  if (response?.id !== responseId) {
    throw Object.assign(new Error('new_bos_background_resume_response_id_changed'), {
      code: 'background_response_id_changed',
      responseId,
      observedResponseId: response?.id || null,
      pollCount,
    });
  }
  await onEvent(eventFor(response, 'background_resume_retrieved', pollCount, transportInspection));

  while (ACTIVE_STATUSES.has(response.status)) {
    if (Date.now() - startedAt >= maxWaitMs) {
      throw Object.assign(new Error('new_bos_background_resume_poll_timeout'), {
        code: 'background_resume_poll_timeout',
        responseId,
        pollCount,
      });
    }
    await sleep(pollIntervalMs);
    response = await client.responses.retrieve(responseId);
    pollCount += 1;
    if (response?.id !== responseId) {
      throw Object.assign(new Error('new_bos_background_resume_response_id_changed'), {
        code: 'background_response_id_changed',
        responseId,
        observedResponseId: response?.id || null,
        pollCount,
      });
    }
    await onEvent(eventFor(response, 'background_resume_polled', pollCount, transportInspection));
  }

  if (FAILURE_STATUSES.has(response.status)) {
    throw Object.assign(new Error(`new_bos_background_resume_terminal_failure:${response.status}`), {
      code: 'background_terminal_failure',
      responseId,
      status: response.status,
      pollCount,
      providerResponse: response,
    });
  }
  if (response.status !== 'completed') {
    throw Object.assign(new Error(`new_bos_background_resume_unknown_terminal_status:${response.status || 'missing'}`), {
      code: 'background_unknown_terminal_status',
      responseId,
      status: response.status || null,
      pollCount,
      providerResponse: response,
    });
  }

  return Object.freeze({
    response,
    transport_evidence: Object.freeze({
      mode: 'background_resume_existing',
      submit_count: 0,
      original_submit_count: 1,
      poll_count: pollCount,
      provider_response_id: responseId,
      final_status: response.status,
      ...transportInspection,
    }),
  });
}
