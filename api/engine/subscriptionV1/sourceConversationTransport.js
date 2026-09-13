import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { MORE_SOURCE_TOOLS, SOURCE_ACCESS_LIMITS, SOURCE_REFERENCE_BOUNDARY, sourceToolName } from './readOnlySources.js';

const copy = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(new Error(code), { code }); };
const retryable = error => [408, 409, 429].includes(error?.status) || Number(error?.status) >= 500
  || ['ETIMEDOUT', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT'].includes(error?.code);

export async function runSourceEnabledConversation({ request, client, library, timeoutMs, maxTransportRetries,
  parseOutput, researchTrace }) {
  if (!Array.isArray(request.tools) || request.tools.length > 1
    || (request.tools.length === 1 && (request.tools[0]?.type !== 'web_search' || Object.keys(request.tools[0]).length !== 1)) || request.store !== false
    || request.background !== false || request.reasoning?.effort !== 'xhigh' || !Array.isArray(request.input)) fail('MORE_SOURCE_REQUEST_CONTRACT_INVALID');
  const webSearchEnabled = request.tools.length === 1;
  if (!webSearchEnabled && (Object.hasOwn(request, 'max_tool_calls') || Object.hasOwn(request, 'tool_choice')
    || request.include?.some(value => String(value).startsWith('web_search_call')))) fail('MORE_SOURCE_DISABLED_WEB_FIELDS_DENIED');
  if (!library?.info || typeof library.execute !== 'function') fail('MORE_SOURCE_LIBRARY_UNAVAILABLE');
  const started = Date.now(), seenCalls = new Set(), sourceReceipts = [], responseHashes = [], requestHashes = [];
  const researchEvidence = new Map();
  const usage = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
  const retryCap = Math.min(1, Math.max(0, Number.isInteger(maxTransportRetries) ? maxTransportRetries : 0));
  let attempts = 0, retries = 0, localCalls = 0, hostedCalls = 0, step = 0, output;
  let input = [...copy(request.input), { role: 'system', content: SOURCE_REFERENCE_BOUNDARY }];
  while (step < SOURCE_ACCESS_LIMITS.providerSteps) {
    const tools = [
      ...(webSearchEnabled && hostedCalls < SOURCE_ACCESS_LIMITS.hostedCalls ? [{ type: 'web_search' }] : []),
      ...(localCalls < SOURCE_ACCESS_LIMITS.internalCalls ? copy(MORE_SOURCE_TOOLS) : []),
    ];
    const wire = { ...copy(request), input, tools, parallel_tool_calls: false,
      include: [...new Set([...(request.include || []), 'reasoning.encrypted_content'])] };
    if (tools.some(tool => tool.type === 'web_search')) wire.max_tool_calls = SOURCE_ACCESS_LIMITS.hostedCalls - hostedCalls;
    else delete wire.max_tool_calls;
    if (Buffer.byteLength(JSON.stringify(wire)) > SOURCE_ACCESS_LIMITS.requestBytes) fail('MORE_SOURCE_REQUEST_BUDGET_EXCEEDED');
    let response;
    while (true) {
      if (attempts >= SOURCE_ACCESS_LIMITS.providerSteps + retryCap) fail('MORE_SOURCE_PROVIDER_ATTEMPT_LIMIT');
      attempts += 1;
      requestHashes.push(hashCanonicalJson(wire));
      try { response = await client.responses.create(wire, { signal: AbortSignal.timeout(timeoutMs) }); }
      catch (error) {
        if (retryable(error) && retries < retryCap) { retries += 1; continue; }
        throw error;
      }
      responseHashes.push(hashCanonicalJson(response.id));
      for (const key of ['input_tokens', 'output_tokens']) usage[key] += Number(response.usage?.[key] || 0);
      usage.cached_input_tokens += Number(response.usage?.input_tokens_details?.cached_tokens || 0);
      if (response.status !== 'completed') fail('MORE_SOURCE_PROVIDER_INCOMPLETE');
      const external = researchTrace(response, new Date().toISOString());
      if (!webSearchEnabled && external.calls) fail('MORE_SOURCE_DISABLED_WEB_CALL_DENIED');
      hostedCalls += external.calls;
      if (hostedCalls > SOURCE_ACCESS_LIMITS.hostedCalls) fail('MORE_SOURCE_HOSTED_TOOL_LIMIT');
      for (const evidence of external.evidence) researchEvidence.set(evidence.external_evidence_id, evidence);
      const functions = (response.output || []).filter(item => item?.type === 'function_call');
      if (functions.length) break;
      try { output = parseOutput(response); }
      catch (error) {
        // Preserve the baseline single retry for malformed structured output.
        // Do not repeat a hosted search as a hidden format repair.
        if (error?.code === 'SUBSCRIPTION_LIVE_DEMO_STRUCTURED_JSON_INVALID' && retries < retryCap && !external.calls) {
          retries += 1; continue;
        }
        throw error;
      }
      break;
    }
    step += 1;
    const functions = (response.output || []).filter(item => item?.type === 'function_call');
    if (!functions.length) break;
    if (functions.length !== 1 || localCalls >= SOURCE_ACCESS_LIMITS.internalCalls) fail('MORE_SOURCE_INTERNAL_TOOL_LIMIT');
    const call = functions[0];
    if (!sourceToolName(call.name) || !tools.some(tool => tool.name === call.name)
      || typeof call.call_id !== 'string' || call.call_id.length > 200 || !call.call_id
      || seenCalls.has(call.call_id) || typeof call.arguments !== 'string'
      || Buffer.byteLength(call.arguments) > SOURCE_ACCESS_LIMITS.argumentBytes) fail('MORE_SOURCE_TOOL_CALL_DENIED');
    // Stateless reasoning items, including encrypted_content, are returned
    // untouched to the SDK. They are never exposed as source receipts or UI.
    if (!Array.isArray(response.output) || response.output.some(item => !['reasoning', 'message', 'function_call', 'web_search_call'].includes(item?.type))) fail('MORE_SOURCE_CONTINUATION_ITEM_DENIED');
    let result;
    try { result = library.execute(call.name, JSON.parse(call.arguments)); }
    catch { result = { ok: false, code: 'SOURCE_RETRIEVAL_UNAVAILABLE', results: [], customer_truth_override_allowed: false }; }
    if (!result || typeof result.ok !== 'boolean') fail('MORE_SOURCE_RESULT_CONTRACT_INVALID');
    const encoded = JSON.stringify(result);
    if (Buffer.byteLength(encoded) > SOURCE_ACCESS_LIMITS.resultBytes) fail('MORE_SOURCE_RESULT_BUDGET_EXCEEDED');
    const excerpts = result.results || (result.excerpt ? [result] : []);
    sourceReceipts.push({ tool: call.name, status: result.ok ? (result.code || 'SOURCE_READ') : result.code,
      arguments_hash: hashCanonicalJson(call.arguments),
      result_hash: hashCanonicalJson(result), registry_sha256: library.info.registry_sha256,
      sources: excerpts.map(e => ({ source_id: e.source_id, version: e.version, document_sha256: e.document_sha256,
        start_line: e.start_line, end_line: e.end_line, excerpt_sha256: e.excerpt_sha256,
        sections: e.sections, citation: e.citation })),
      retrieved_at: new Date().toISOString(),
      customer_truth_override_allowed: false });
    seenCalls.add(call.call_id); localCalls += 1;
    input = [...input, ...copy(response.output), { type: 'function_call_output', call_id: call.call_id, output: encoded }];
  }
  if (!output) fail('MORE_SOURCE_FINAL_ANSWER_MISSING');
  return { output, request_hash: hashCanonicalJson(requestHashes), response_id_hash: hashCanonicalJson(responseHashes),
    usage, latency_ms: Date.now() - started, attempt_count: attempts,
    estimated_cost_microusd: Math.round(Math.max(0, usage.input_tokens - usage.cached_input_tokens) * 5
      + usage.cached_input_tokens * 0.5 + usage.output_tokens * 30),
    web_search_calls: hostedCalls, external_evidence: [...researchEvidence.values()],
    internal_source_calls: localCalls, internal_source_receipts: sourceReceipts, source_library: library.info,
    transport_trace: { request_hashes: requestHashes, response_id_hashes: responseHashes,
      logical_provider_steps: step, transport_retries: retries, internal_tool_call_limit: SOURCE_ACCESS_LIMITS.internalCalls,
      provider_request_limit: SOURCE_ACCESS_LIMITS.providerSteps + retryCap, hosted_tool_call_limit: webSearchEnabled ? SOURCE_ACCESS_LIMITS.hostedCalls : 0 },
    raw_request_persisted: false, raw_response_persisted: false };
}
