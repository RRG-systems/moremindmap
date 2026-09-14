import OpenAI from 'openai';
import { Buffer } from 'node:buffer';
import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { canonicalJson, hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { scopeFingerprint } from '../../../src/lib/subscriptionV1/contracts.js';
import { parseFullPersonQaManifest, fullPersonQaProfileDigest, fullPersonQaAssessmentDigest } from './fullPersonQaAccess.js';
import { assertSyntheticQaBusinessScope } from './syntheticQaRuntimeInfrastructure.js';
import { createSubscriptionLiveDemoOpenAiTransport } from './liveDemoOpenAiTransport.js';
import { createSubscriptionS2OpenAiTransport } from '../subscriptionS2/openAiTransport.js';
import { createSubscriptionS2GuRuntime } from '../subscriptionS2/guRuntime.js';
import { pinnedSubscriptionSources, pinnedLoanOriginatorSubscriptionSources } from './pinnedSources.js';
import { requirePinnedPaidWinnerAcceptance } from './winnerIntake.js';
import { SYNTHETIC_QA_ALLOCATION, SYNTHETIC_QA_CAMPAIGN, createSyntheticQaProviderBudget } from './syntheticQaProviderBudget.js';

export const SYNTHETIC_QA_PROVIDER_HOLD = 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROVIDER_BUDGET_NOT_AUTHORIZED';
export const SYNTHETIC_QA_GRANT_DOMAIN = 'more-subscription-synthetic-qa-provider-grant-v1';
const GRANT_ENV = 'MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_PROVIDER_GRANT';
const CASES = ['COHORT-V1-LO-A', 'COHORT-V1-LO-B', 'COHORT-V1-RE-A', 'COHORT-V1-RE-B'];
const CANDIDATE_CLOSURE_ROOTS = ['api/internal/subscription-v1-runtime.js'];
const CANDIDATE_EXCLUDED_DYNAMIC_EDGES = [{
  from: 'api/internal/subscription-v1-runtime.js',
  specifier: '../engine/subscriptionS2/demoSubscriberLoader.js',
  reason: 'UNREACHABLE_AFTER_EXACT_SYNTHETIC_QA_AUTHORITY_SELECTION',
}, {
  from: 'api/internal/subscription-v1-runtime.js',
  specifier: '../engine/subscriptionBlindDemo/runtime.js',
  reason: 'NON_SYNTHETIC_QA_ROUTE_BRANCH',
}, {
  from: 'api/internal/subscription-v1-runtime.js',
  specifier: '../engine/subscriptionV1/paidRuntimeComposition.js',
  reason: 'NON_SYNTHETIC_QA_ROUTE_BRANCH',
}];
const REQUIRED_CANDIDATE_PATHS = [
  'api/engine/newBaProductionReadinessV1/canonicalReader.js',
  'api/engine/newBaProductionReadinessV1/stable.js',
  'api/engine/subscriptionV1/internalDevInfrastructure.js',
  'api/engine/subscriptionV1/paidConversationHistory.js',
  'api/engine/subscriptionV1/paidRuntimeHandler.js',
  'api/engine/subscriptionV1/paidRuntimeInfrastructure.js',
  'api/engine/subscriptionV1/paidSubscriberCustody.js',
  'api/engine/subscriptionV1/syntheticQaRuntimeAuth.js',
  'src/lib/subscriptionV1/afw04/doctrine.js',
  'src/lib/subscriptionV1/afw04/index.js',
  'src/lib/subscriptionV1/freeGptV2/catastrophicIntegrity.js',
  'src/lib/subscriptionV1/freeGptV2/contracts.js',
  'src/lib/subscriptionV1/sessionLearning.js',
  'package.json',
  'package-lock.json',
  'vercel.json',
];
const WINNER = '2186522347323e4576b559bf55f7db3904a8a66d3d4ced177c89dfc76a96b9a3';
const STAGES = Object.freeze({
  CONVERSATION: ['subscription_v1_free_gpt_conversation_v2', 16000],
  CANDIDATE_EXTRACTION: ['subscription_v1_post_response_candidate_v1', 12000],
  NATURAL_AUTHORIZATION: ['subscription_v1_natural_authorization_v1', 5000],
  SESSION_CLOSE: ['subscription_flagship_s1_1_session_close_v1', 8000],
  GU: ['subscription_flagship_s2_gu_plan_v1', 6000],
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const exact = (a, b) => canonicalJson(a) === canonicalJson(b);
const equalHash = (a, b) => isHash(a) && isHash(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

export function verifySyntheticQaNativeApproval({ raw, grant, manifest, digestKey }) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 128_000 || sha(raw) !== grant.approval_sha256) fail('SYNTHETIC_QA_NATIVE_APPROVAL_BYTES_REQUIRED');
  const native = JSON.parse(raw);
  if (native.contract !== 'FOUR_SYNTHETIC_NATIVE_GENERATION_APPROVAL_V1' || native.status !== 'APPROVED'
    || native.campaignId !== SYNTHETIC_QA_CAMPAIGN || native.freshAllowanceMicroUsd !== 20_000_000
    || native.coachingReserveMicroUsd !== 8_000_000 || native.freshAllowanceSeparatelyApproved !== true
    || native.model !== 'gpt-5.6-sol' || native.maxCreates !== 88 || native.maxCreatesPerCase !== 22
    || !exact(native.enabledCaseIds, ['COHORT-V1-RE-A', 'COHORT-V1-RE-B', 'COHORT-V1-LO-A', 'COHORT-V1-LO-B'])
    || Date.parse(native.deadlineUtc) !== Date.parse(grant.deadline)
    || !isHash(grant.native_source_manifest_sha256) || native.nativeSourceManifestSha256 !== grant.native_source_manifest_sha256
    || !Array.isArray(native.executionFiles) || !native.executionFiles.length
    || native.executionFiles.some(f => typeof f.path !== 'string' || !f.path || !isHash(f.sha256))
    || hashCanonicalJson(native.executionFiles) !== grant.native_execution_files_sha256
    || typeof native.operatorRoot !== 'string' || !native.operatorRoot.startsWith('/')
    || typeof native.nativeRoot !== 'string' || !native.nativeRoot.startsWith('/')
    || native.campaignDir !== `${native.operatorRoot}/RUN_STATE` || native.sharedSpendDir !== `${native.campaignDir}/SHARED_SPEND`
    || !Array.isArray(native.preparedCases) || !exact(native.preparedCases.map(c => c.caseId).sort(), CASES)
    || new Set(native.preparedCases.map(c => c.profileId)).size !== 4
    || native.preparedCases.some(c => !isHash(c.sha256))) fail('SYNTHETIC_QA_NATIVE_ALLOCATION_OR_CUSTODY_DENIED');
  // Native approval still names exactly the original four. Only reviewed,
  // fully generated manifest entries acquire coaching access.
  for (const entry of manifest.entries) {
    const prepared = native.preparedCases.find(c => c.caseId === entry.case_id);
    if (!isHash(prepared.sha256) || fullPersonQaProfileDigest(prepared.profileId, digestKey) !== entry.profile_digest) fail('SYNTHETIC_QA_NATIVE_COHORT_MISMATCH');
  }
  return true;
}

// This source manifest contains no grant or credentials. A future sealed grant
// must bind its digest, and the actual deployed bytes are checked at each gate.
export function syntheticQaProviderCandidateSha256() {
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'api/engine/subscriptionV1/syntheticQaProviderCandidate.json'), 'utf8'));
  if (manifest.contract !== 'SYNTHETIC_QA_PROVIDER_CANDIDATE_CLOSURE_V3'
    || !exact(manifest.closure_roots, CANDIDATE_CLOSURE_ROOTS)
    || !exact(manifest.excluded_dynamic_edges, CANDIDATE_EXCLUDED_DYNAMIC_EDGES)
    || manifest.generation_method !== 'RECURSIVE_LITERAL_ESM_CLOSURE_WITH_EXACT_NON_QA_ROUTE_EXCLUSIONS_PLUS_HASH_PINNED_RUNTIME_AUTHORITIES_AND_DEPENDENCY_IDENTITY_V2'
    || !Array.isArray(manifest.files)
    || manifest.files.length < 10 || manifest.files.length > 300
    || new Set(manifest.files.map(f => f.path)).size !== manifest.files.length) fail('SYNTHETIC_QA_CANDIDATE_CUSTODY_INVALID');
  const paths = new Set(manifest.files.map(file => file.path));
  if (REQUIRED_CANDIDATE_PATHS.some(path => !paths.has(path))) fail('SYNTHETIC_QA_CANDIDATE_CLOSURE_INCOMPLETE');
  for (const file of manifest.files) {
    if (!(/^(api|src|docs)\/[a-zA-Z0-9_./-]+$/.test(file.path)
        || ['package.json', 'package-lock.json', 'vercel.json'].includes(file.path))
      || file.path.split('/').includes('..')
      || !isHash(file.sha256) || sha(readFileSync(resolve(process.cwd(), file.path))) !== file.sha256) {
      fail('SYNTHETIC_QA_CANDIDATE_BYTES_CHANGED');
    }
  }
  return hashCanonicalJson(manifest);
}

function validateGrant(env, now, winnerAcceptance) {
  const raw = env[GRANT_ENV];
  if (typeof raw !== 'string' || !raw || Buffer.byteLength(raw) > 24_000) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  let envelope; try { envelope = JSON.parse(raw); } catch { fail(SYNTHETIC_QA_PROVIDER_HOLD); }
  const { grant, signature } = envelope || {};
  if (!grant || !exact(Object.keys(envelope).sort(), ['grant', 'signature'])) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  // Reuse the existing server-only QA signing key with a separate HMAC domain.
  // Merely setting an environment boolean or supplying unsigned JSON cannot grant spend.
  const signingKey = env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_SIGNING_KEY;
  if (typeof signingKey !== 'string' || Buffer.byteLength(signingKey) < 32) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  const expected = createHmac('sha256', signingKey).update(SYNTHETIC_QA_GRANT_DOMAIN).update('\0').update(canonicalJson(grant)).digest('hex');
  if (!equalHash(signature, expected)) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  requirePinnedPaidWinnerAcceptance(winnerAcceptance);
  const staged = grant.contract === 'SYNTHETIC_QA_MODEL2_PROVIDER_GRANT_V2';
  if ((!staged && grant.contract !== 'SYNTHETIC_QA_MODEL2_PROVIDER_GRANT_V1') || grant.status !== 'APPROVED'
    || grant.campaign_id !== SYNTHETIC_QA_CAMPAIGN || !isHash(grant.approval_sha256)
    || typeof grant.ledger_initialization_id !== 'string' || !/^[a-f0-9-]{36}$/.test(grant.ledger_initialization_id)
    || grant.model !== 'gpt-5.6-sol' || grant.selection !== 'MODEL2' || grant.reasoning_effort !== 'xhigh'
    || grant.store !== false || grant.web_enabled !== false || grant.winner_acceptance_sha256 !== WINNER
    || !exact(grant.allocation, SYNTHETIC_QA_ALLOCATION)
    || grant.native_approval_sha256 !== grant.approval_sha256
    || grant.pricing_policy !== 'CONSERVATIVE_USAGE_BOUND_10_INPUT_60_OUTPUT_MICROUSD_V1'
    || !Number.isFinite(now) || !Number.isFinite(Date.parse(grant.starts_at)) || !Number.isFinite(Date.parse(grant.deadline))
    || now < Date.parse(grant.starts_at) || now >= Date.parse(grant.deadline)
    || !isHash(grant.candidate_sha256) || grant.candidate_sha256 !== syntheticQaProviderCandidateSha256()) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  const manifest = parseFullPersonQaManifest(env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST);
  verifySyntheticQaNativeApproval({ raw: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_NATIVE_APPROVED_EXECUTION,
    grant, manifest, digestKey: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY });
  const activeCases = manifest.entries.filter(c => c.status === 'active').map(c => c.case_id);
  if (manifest.manifest_sha256 !== grant.manifest_sha256 || !Array.isArray(grant.cohort)
    || grant.cohort.length < 1 || grant.cohort.length > CASES.length
    || !exact(grant.cohort.map(c => c.case_id), staged ? activeCases : CASES)
    || new Set(grant.cohort.map(c => c.scope_sha256)).size !== grant.cohort.length) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  for (const entry of grant.cohort) {
    const authority = manifest.entries.find(c => c.case_id === entry.case_id);
    const source = entry.case_id.includes('-LO-') ? pinnedLoanOriginatorSubscriptionSources() : pinnedSubscriptionSources();
    if (!authority || !isHash(entry.scope_sha256) || authority.status !== 'active' || Date.parse(authority.expires_at) < Date.parse(grant.deadline)
      || fullPersonQaAssessmentDigest(entry.assessment_id, env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY) !== authority.assessment_digest
      || entry.authority_id !== authority.authority_id || entry.custody_sha256 !== authority.custody_sha256
      || entry.vertical_id !== authority.vertical_id || source.info.status !== 'AVAILABLE'
      || entry.source_registry_sha256 !== source.info.registry_sha256) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  }
  return { grant, manifest, grantSha256: hashCanonicalJson(grant) };
}

export function syntheticQaProviderEnabled(env = {}) {
  try { validateGrant(env, Date.now()); return true; } catch { return false; }
}

function wirePolicy(request, stage, source) {
  const policy = STAGES[stage];
  const fields = ['model', 'store', 'background', 'tools', 'reasoning', 'max_output_tokens', 'text', 'input', 'include', 'parallel_tool_calls'];
  if (!policy || request?.model !== 'gpt-5.6-sol' || request.store !== false || request.background !== false
    || !exact(request.reasoning, { effort: 'xhigh' }) || request.max_output_tokens !== policy[1]
    || request.text?.format?.type !== 'json_schema' || request.text.format.strict !== true
    || request.text.format.name !== policy[0] || !Array.isArray(request.input)
    || Object.keys(request).some(k => !fields.includes(k))
    || !Array.isArray(request.tools) || request.tools.length && (stage !== 'CONVERSATION' || !exact(request.tools, source.tools))
    || request.include !== undefined && !exact(request.include, ['reasoning.encrypted_content'])
    || request.parallel_tool_calls !== undefined && request.parallel_tool_calls !== false) fail('SYNTHETIC_QA_PROVIDER_WIRE_DENIED');
  const bytes = Buffer.byteLength(canonicalJson(request));
  if (bytes > 900_000) fail('SYNTHETIC_QA_PROVIDER_REQUEST_TOO_LARGE');
  // Conservative operational bound, reused from native guard. These are not
  // invoice rates; cached input receives no discount. Token limits are unchanged.
  return { inputBound: bytes + 8192, outputBound: policy[1], reserve: (bytes + 8192) * 10 + policy[1] * 60 };
}

export function createSyntheticQaProviderBoundary({ redis, env = {}, winnerAcceptance,
  now = () => Date.now(), providerClientFactory = () => new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 300_000 }) } = {}) {
  // No grant, key, environment credential, provider client, or ledger is read
  // at construction. GET/readiness paths preserve the existing default-off hold.
  let client;
  function prepare(scope) {
    const admitted = validateGrant(env, now(), winnerAcceptance);
    const entry = admitted.grant.cohort.find(c => c.scope_sha256 === scopeFingerprint(scope));
    if (!entry) fail('SYNTHETIC_QA_PROVIDER_SCOPE_DENIED');
    const authority = admitted.manifest.entries.find(c => c.case_id === entry.case_id);
    if (fullPersonQaProfileDigest(scope.profile_id, env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY) !== authority.profile_digest) fail('SYNTHETIC_QA_PROVIDER_PROFILE_CASE_MISMATCH');
    assertSyntheticQaBusinessScope(scope, entry.assessment_id, authority.vertical_binding_sha256, authority.authority_id);
    const source = entry.vertical_id === 'loan_originator' ? pinnedLoanOriginatorSubscriptionSources() : pinnedSubscriptionSources();
    return { ...admitted, entry, source, budget: createSyntheticQaProviderBudget({ redis, ...admitted }) };
  }
  function invocation(scope, stage) {
    const initial = prepare(scope), ids = [], observations = [], retained = new Set(), operationId = randomUUID();
    const guardedClient = { responses: { async create(supplied, options) {
      // Snapshot before the first await: callers cannot mutate an admitted wire.
      const request = JSON.parse(canonicalJson(supplied));
      const current = prepare(scope);
      if (current.grantSha256 !== initial.grantSha256) fail('SYNTHETIC_QA_GRANT_CHANGED');
      const policy = wirePolicy(request, stage, current.source);
      if (stage !== 'CONVERSATION' && observations.length) {
        const previous = observations.at(-1); retained.add(previous.id);
        await initial.budget.retain([previous.id]);
      }
      const id = await initial.budget.reserve({ requestSha256: hashCanonicalJson({ scope: current.entry.scope_sha256, request }),
        operationId, ordinal: ids.length + 1, caseId: current.entry.case_id, stage, reservedMicroUsd: policy.reserve });
      ids.push(id);
      try {
        await initial.budget.confirm(id);
        if (prepare(scope).grantSha256 !== initial.grantSha256 || options?.signal?.aborted) fail('SYNTHETIC_QA_DISPATCH_REVALIDATION_FAILED');
        client ||= providerClientFactory();
        const response = await client.responses.create(request, { ...options, maxRetries: 0 });
        const usage = response?.usage;
        if (response?.status !== 'completed' || !String(response.model || '').match(/^gpt-5\.6-sol(?:-|$)/)
          || response.service_tier !== undefined && response.service_tier !== 'default'
          || !Array.isArray(response.output) || response.output.some(item => !['message', 'reasoning', ...(stage === 'CONVERSATION' ? ['function_call'] : [])].includes(item?.type))
          || !Number.isSafeInteger(usage?.input_tokens) || usage.input_tokens < 0 || usage.input_tokens > policy.inputBound
          || !Number.isSafeInteger(usage?.output_tokens) || usage.output_tokens < 0 || usage.output_tokens > policy.outputBound
          || usage.total_tokens !== undefined && usage.total_tokens !== usage.input_tokens + usage.output_tokens) fail('SYNTHETIC_QA_PROVIDER_USAGE_OR_RESPONSE_UNRESOLVED');
        const observed = { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens };
        observations.push({ id, usage: observed, cost: usage.input_tokens * 10 + usage.output_tokens * 60 });
        return response;
      } catch (error) {
        retained.add(id); await initial.budget.retain([id]); throw error;
      }
    } } };
    return { ...initial, guardedClient, retainAttempts: () => { ids.forEach(id => retained.add(id)); return initial.budget.retain(ids); }, async run(operation) {
      try {
        const result = await operation();
        for (const observation of observations) if (!retained.has(observation.id)) {
          if (!await initial.budget.settle(observation.id, observation.usage, observation.cost)) fail('SYNTHETIC_QA_PROVIDER_RESERVATION_UNRESOLVED');
        }
        return result;
      } catch (error) { await initial.budget.retain(ids); throw error; }
    } };
  }
  return Object.freeze({
    createTransport({ scope, projection, sourceLibrary } = {}) {
      const ready = prepare(scope);
      if (projection?.synthetic_only !== true
        || projection.doctrine_vertical_id !== (ready.entry.vertical_id === 'loan_originator' ? 'LOAN_ORIGINATOR' : 'REAL_ESTATE')
        || !exact(sourceLibrary?.info, ready.source.info)) fail('SYNTHETIC_QA_PROVIDER_SOURCE_SCOPE_DENIED');
      return async (request, { stage }) => {
        const call = invocation(scope, stage);
        const transport = createSubscriptionLiveDemoOpenAiTransport({ client: call.guardedClient, sourceLibrary: call.source,
          maxTransportRetries: 1, timeoutMs: 300_000 });
        return call.run(() => transport(request, { stage }));
      };
    },
    async generateGu({ event, loaded, keys, sessionLearning = null, mapDelta = null, currentExchange = null } = {}) {
      // Run the grant gate before any controller work or credential acquisition.
      const call = invocation(loaded?.scope, 'GU');
      if (loaded?.identity?.synthetic_only !== true || keys?.scope_hash !== call.entry.scope_sha256) fail('SYNTHETIC_QA_GU_SCOPE_DENIED');
      return call.run(async () => {
        const current = loaded.controller.current();
        if (!current.ok) fail('SYNTHETIC_QA_GU_CURRENT_STATE_REQUIRED');
        const existingTransport = createSubscriptionS2OpenAiTransport({ client: call.guardedClient, maxTransportRetries: 1 });
        let generatedAttempts = 0;
        const transport = async request => {
          // A second GU request is the shipped validation repair. Preserve the
          // first rejected output's full reservation before paying for repair.
          if (generatedAttempts++) await call.retainAttempts();
          return existingTransport(request);
        };
        const generated = await createSubscriptionS2GuRuntime({ transport, maxAttempts: 2 }).generate({
          event, packet: loaded.controller.wholeUnderstandingPacket(), publication: current.publication,
          viewModel: current.view_model, sessionLearning, mapDelta, currentExchange, relationshipScopeHash: keys.scope_hash });
        return { ...generated, current };
      });
    },
  });
}
