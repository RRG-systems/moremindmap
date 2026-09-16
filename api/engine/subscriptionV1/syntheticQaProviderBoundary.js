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
import { SYNTHETIC_QA_ALLOCATION, SYNTHETIC_QA_CAMPAIGN, createSyntheticQaProviderBudget,
  syntheticQaBudgetGrantSha256 } from './syntheticQaProviderBudget.js';

export const SYNTHETIC_QA_PROVIDER_HOLD = 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROVIDER_BUDGET_NOT_AUTHORIZED';
export const SYNTHETIC_QA_GRANT_DOMAIN = 'more-subscription-synthetic-qa-provider-grant-v1';
export const SYNTHETIC_QA_COACHING_RENEWAL_DOMAIN = 'more-subscription-synthetic-qa-casey-coaching-renewal-v1';
export const SYNTHETIC_QA_COACHING_SECOND_RENEWAL_DOMAIN = 'more-subscription-synthetic-qa-casey-coaching-renewal-v2';
const GRANT_ENV = 'MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_PROVIDER_GRANT';
const RENEWAL_ENV = 'MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_COACHING_RENEWAL';
const SECOND_RENEWAL_ENV = 'MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_COACHING_RENEWAL_V2';
const RENEWAL_APPROVED_AT = '2026-09-15T21:49:52.000Z';
const RENEWAL_EXPIRES_AT = '2026-09-16T21:49:52.000Z';
const SECOND_RENEWAL_APPROVED_AT = '2026-09-16T22:59:44.502Z';
const SECOND_RENEWAL_EXPIRES_AT = '2026-09-17T22:59:44.000Z';
const SECOND_RENEWAL_RECEIPT_FILE_SHA256 = 'a3e1918761116d6b261eede363bf9af6a8f9f5bf30ef2b6b78cf54fd1639bb19';
const SECOND_RENEWAL_RECEIPT_CANONICAL_SHA256 = '9f15080df57c963eb5cb24fc5f9eae6b28716d151cab475db7005012aa5f2406';
const PREVIOUS_STAGE_GRANT_SHA256 = '2b2e867c6003a3732630e85a09f169d7809a4318271f461788f2ac66444c19e2';
const PREVIOUS_CANDIDATE_SHA256 = 'c994624fabd9f048df9525e17b052212609b7b5207848d89de05827e658525d9';
export const SYNTHETIC_QA_RENEWAL_CONTINUITY = Object.freeze({
  authorizationReceiptCanonicalSha256: 'e7c17053ff3d7c927de68c81a24ab7fe19957f83d92cca4a1fe2347b184e6912',
  authorizationReceiptFileSha256: '69585b12685bf61d1e59beb96dbbd0eb6b8febfc69feeffcc048b13fd775e31a',
  budgetGrantSha256: 'acbb68bba4bd4fd8a6a02ac04abc7b55ec7d3ba90dc64b2b792d51651cdce36a',
  caseyKeysetSha256: 'ef55a9808616d0fd89df68fe4cb282cdde3339ba5af3f739a1d2c56473c098e0',
  caseyPairSha256: '521a4d05fb0e70483e68fedaee461501e37d7bbc7200a51ffdceeec351d81f1b',
  originalApprovalSha256: '248e70e0806420be62eb9f167e8899de2431c71db533c0d24fd14daea2d30b42',
  previousDeadline: '2026-09-15T21:37:44.954Z',
  priorCandidateSha256: 'd70ad658ea29ceed9aa752dd398bbd2d8a535757b94b1ed786c51374cde3ac81',
  priorManifestSha256: '2100eda676edb07a695762d7a0cfc9b4b5d548eb3cb258b88fa9d9c32385096a',
  priorStageGrantSha256: 'd850eaed97e59d046b416971374b66e221e7a3b3607fec5f3d1854a5a37fad72',
});
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

function validateCoachingRenewal({ env, now, grant, grantSha256, manifest, signingKey, continuity }) {
  const continuityKeys = ['authorizationReceiptCanonicalSha256', 'authorizationReceiptFileSha256', 'budgetGrantSha256',
    'caseyKeysetSha256', 'caseyPairSha256', 'originalApprovalSha256', 'previousDeadline', 'priorCandidateSha256',
    'priorManifestSha256', 'priorStageGrantSha256'];
  if (!continuity || !exact(Object.keys(continuity).sort(), continuityKeys)
    || !continuityKeys.filter(key => key !== 'previousDeadline').every(key => isHash(continuity[key]))
    || !Number.isFinite(Date.parse(continuity.previousDeadline))
    || new Date(continuity.previousDeadline).toISOString() !== continuity.previousDeadline) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  if (env[SECOND_RENEWAL_ENV] !== undefined) {
    return validateSecondCoachingRenewal({ env, now, grant, grantSha256, manifest, signingKey, continuity });
  }
  const raw = env[RENEWAL_ENV];
  if (typeof raw !== 'string' || !raw || Buffer.byteLength(raw) > 24_000) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  let envelope; try { envelope = JSON.parse(raw); } catch { fail(SYNTHETIC_QA_PROVIDER_HOLD); }
  const { renewal, signature } = envelope || {};
  if (!renewal || !exact(Object.keys(envelope).sort(), ['renewal', 'signature'])) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  const expected = createHmac('sha256', signingKey).update(SYNTHETIC_QA_COACHING_RENEWAL_DOMAIN)
    .update('\0').update(canonicalJson(renewal)).digest('hex');
  if (!equalHash(signature, expected)) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  const keys = ['additional_budget', 'additional_budget_micro_usd', 'approval_sha256', 'approved_at', 'authority_id',
    'authorization_receipt_canonical_sha256', 'authorization_receipt_file_sha256', 'budget_grant_sha256',
    'budget_reset', 'campaign_id', 'candidate_sha256',
    'case_id', 'coaching_cap_micro_usd', 'contract', 'custody_sha256', 'expires_at', 'ledger_initialization_id',
    'manifest_sha256', 'native_regeneration', 'previous_deadline', 'prior_stage_grant_sha256',
    'prior_candidate_sha256', 'prior_casey_keyset_sha256', 'prior_casey_pair_sha256', 'prior_manifest_sha256',
    'provider_assignment_changed', 'scope_sha256', 'stage_grant_sha256', 'status', 'total_cap_micro_usd'];
  const authority = manifest.entries.find(entry => entry.case_id === 'COHORT-V1-LO-A');
  const approvedAt = Date.parse(renewal?.approved_at), expiresAt = Date.parse(renewal?.expires_at);
  if (!exact(Object.keys(renewal || {}).sort(), keys.sort())
    || grant.contract !== 'SYNTHETIC_QA_MODEL2_PROVIDER_GRANT_V2'
    || grant.cohort.length !== 1 || grant.cohort[0].case_id !== 'COHORT-V1-LO-A'
    || renewal.contract !== 'SYNTHETIC_QA_CASEY_COACHING_RENEWAL_V1' || renewal.status !== 'APPROVED'
    || renewal.campaign_id !== SYNTHETIC_QA_CAMPAIGN || renewal.case_id !== grant.cohort[0].case_id
    || !isHash(renewal.scope_sha256) || renewal.scope_sha256 !== grant.cohort[0].scope_sha256
    || renewal.authority_id !== grant.cohort[0].authority_id
    || !isHash(renewal.custody_sha256) || renewal.custody_sha256 !== grant.cohort[0].custody_sha256
    || renewal.prior_stage_grant_sha256 !== continuity.priorStageGrantSha256
    || renewal.prior_candidate_sha256 !== continuity.priorCandidateSha256
    || renewal.prior_manifest_sha256 !== continuity.priorManifestSha256
    || renewal.prior_casey_pair_sha256 !== continuity.caseyPairSha256
    || renewal.prior_casey_keyset_sha256 !== continuity.caseyKeysetSha256
    || renewal.stage_grant_sha256 !== grantSha256
    || renewal.budget_grant_sha256 !== continuity.budgetGrantSha256
    || syntheticQaBudgetGrantSha256(grant) !== continuity.budgetGrantSha256
    || renewal.approval_sha256 !== continuity.originalApprovalSha256
    || grant.approval_sha256 !== continuity.originalApprovalSha256
    || grant.native_approval_sha256 !== continuity.originalApprovalSha256
    || renewal.ledger_initialization_id !== grant.ledger_initialization_id
    || renewal.manifest_sha256 !== manifest.manifest_sha256 || renewal.manifest_sha256 !== grant.manifest_sha256
    || renewal.candidate_sha256 !== grant.candidate_sha256 || renewal.previous_deadline !== grant.deadline
    || Date.parse(grant.deadline) !== Date.parse(continuity.previousDeadline)
    || renewal.authorization_receipt_file_sha256 !== continuity.authorizationReceiptFileSha256
    || renewal.authorization_receipt_canonical_sha256 !== continuity.authorizationReceiptCanonicalSha256
    || renewal.approved_at !== RENEWAL_APPROVED_AT || renewal.expires_at !== RENEWAL_EXPIRES_AT
    || !Number.isFinite(approvedAt) || !Number.isFinite(expiresAt) || expiresAt - approvedAt !== 86_400_000
    || !Number.isFinite(now) || now < approvedAt || now >= expiresAt
    || renewal.coaching_cap_micro_usd !== SYNTHETIC_QA_ALLOCATION.live_coaching_micro_usd
    || renewal.total_cap_micro_usd !== SYNTHETIC_QA_ALLOCATION.total_micro_usd
    || renewal.additional_budget !== false || renewal.additional_budget_micro_usd !== 0
    || renewal.budget_reset !== false || renewal.native_regeneration !== false
    || renewal.provider_assignment_changed !== false || !authority || authority.status !== 'active'
    || authority.authority_id !== renewal.authority_id || authority.custody_sha256 !== renewal.custody_sha256
    || Date.parse(authority.expires_at) < expiresAt) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  return { effectiveDeadline: expiresAt, renewalSha256: hashCanonicalJson(renewal) };
}

function validateSecondCoachingRenewal({ env, now, grant, grantSha256, manifest, signingKey, continuity }) {
  const priorRaw = env[RENEWAL_ENV];
  if (typeof priorRaw !== 'string' || !priorRaw || Buffer.byteLength(priorRaw) > 24_000) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  let priorEnvelope; try { priorEnvelope = JSON.parse(priorRaw); } catch { fail(SYNTHETIC_QA_PROVIDER_HOLD); }
  const prior = priorEnvelope?.renewal;
  if (!prior || typeof prior !== 'object' || Array.isArray(prior)) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  const priorSignature = createHmac('sha256', signingKey).update(SYNTHETIC_QA_COACHING_RENEWAL_DOMAIN)
    .update('\0').update(canonicalJson(prior)).digest('hex');
  if (!exact(Object.keys(priorEnvelope || {}).sort(), ['renewal', 'signature'])
    || !equalHash(priorEnvelope.signature, priorSignature)
    || prior?.contract !== 'SYNTHETIC_QA_CASEY_COACHING_RENEWAL_V1'
    || prior.status !== 'APPROVED' || prior.approved_at !== RENEWAL_APPROVED_AT
    || prior.expires_at !== RENEWAL_EXPIRES_AT
    || prior.stage_grant_sha256 !== PREVIOUS_STAGE_GRANT_SHA256
    || prior.candidate_sha256 !== PREVIOUS_CANDIDATE_SHA256
    || prior.budget_grant_sha256 !== continuity.budgetGrantSha256
    || prior.approval_sha256 !== continuity.originalApprovalSha256
    || prior.authorization_receipt_file_sha256 !== continuity.authorizationReceiptFileSha256
    || prior.authorization_receipt_canonical_sha256 !== continuity.authorizationReceiptCanonicalSha256
    || prior.prior_stage_grant_sha256 !== continuity.priorStageGrantSha256
    || prior.prior_candidate_sha256 !== continuity.priorCandidateSha256
    || prior.prior_manifest_sha256 !== continuity.priorManifestSha256
    || prior.prior_casey_pair_sha256 !== continuity.caseyPairSha256
    || prior.prior_casey_keyset_sha256 !== continuity.caseyKeysetSha256
    || prior.previous_deadline !== continuity.previousDeadline
    || prior.additional_budget !== false || prior.additional_budget_micro_usd !== 0
    || prior.budget_reset !== false || prior.native_regeneration !== false
    || prior.provider_assignment_changed !== false
    || prior.total_cap_micro_usd !== SYNTHETIC_QA_ALLOCATION.total_micro_usd
    || prior.coaching_cap_micro_usd !== SYNTHETIC_QA_ALLOCATION.live_coaching_micro_usd) fail(SYNTHETIC_QA_PROVIDER_HOLD);

  const raw = env[SECOND_RENEWAL_ENV];
  if (typeof raw !== 'string' || !raw || Buffer.byteLength(raw) > 24_000) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  let envelope; try { envelope = JSON.parse(raw); } catch { fail(SYNTHETIC_QA_PROVIDER_HOLD); }
  const renewal = envelope?.renewal;
  if (!renewal || typeof renewal !== 'object' || Array.isArray(renewal)) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  const expected = createHmac('sha256', signingKey).update(SYNTHETIC_QA_COACHING_SECOND_RENEWAL_DOMAIN)
    .update('\0').update(canonicalJson(renewal)).digest('hex');
  const fields = ['additional_budget', 'additional_budget_micro_usd', 'approval_sha256', 'approved_at', 'authority_id',
    'authorization_receipt_canonical_sha256', 'authorization_receipt_file_sha256', 'budget_grant_sha256',
    'budget_reset', 'campaign_id', 'candidate_sha256', 'case_id', 'coaching_cap_micro_usd', 'contract',
    'custody_sha256', 'expires_at', 'ledger_initialization_id', 'manifest_sha256', 'native_regeneration',
    'previous_deadline', 'prior_candidate_sha256', 'prior_casey_keyset_sha256', 'prior_casey_pair_sha256',
    'prior_effective_deadline', 'prior_manifest_sha256', 'prior_renewal_sha256', 'prior_stage_grant_sha256',
    'provider_assignment_changed', 'scope_sha256', 'stage_grant_sha256', 'status', 'total_cap_micro_usd'];
  const authority = manifest.entries.find(entry => entry.case_id === 'COHORT-V1-LO-A');
  const approvedAt = Date.parse(renewal?.approved_at), expiresAt = Date.parse(renewal?.expires_at);
  if (!exact(Object.keys(envelope || {}).sort(), ['renewal', 'signature'])
    || !equalHash(envelope.signature, expected) || !renewal || !exact(Object.keys(renewal).sort(), fields.sort())
    || grant.contract !== 'SYNTHETIC_QA_MODEL2_PROVIDER_GRANT_V2'
    || grant.cohort.length !== 1 || grant.cohort[0].case_id !== 'COHORT-V1-LO-A'
    || renewal.contract !== 'SYNTHETIC_QA_CASEY_COACHING_RENEWAL_V2' || renewal.status !== 'APPROVED'
    || renewal.campaign_id !== SYNTHETIC_QA_CAMPAIGN || renewal.case_id !== grant.cohort[0].case_id
    || renewal.scope_sha256 !== grant.cohort[0].scope_sha256
    || renewal.authority_id !== grant.cohort[0].authority_id
    || renewal.custody_sha256 !== grant.cohort[0].custody_sha256
    || renewal.stage_grant_sha256 !== grantSha256
    || renewal.budget_grant_sha256 !== continuity.budgetGrantSha256
    || syntheticQaBudgetGrantSha256(grant) !== continuity.budgetGrantSha256
    || renewal.approval_sha256 !== continuity.originalApprovalSha256
    || grant.approval_sha256 !== continuity.originalApprovalSha256
    || grant.native_approval_sha256 !== continuity.originalApprovalSha256
    || renewal.ledger_initialization_id !== grant.ledger_initialization_id
    || renewal.manifest_sha256 !== manifest.manifest_sha256 || renewal.manifest_sha256 !== grant.manifest_sha256
    || renewal.candidate_sha256 !== grant.candidate_sha256
    || renewal.previous_deadline !== grant.deadline || grant.deadline !== continuity.previousDeadline
    || renewal.prior_renewal_sha256 !== hashCanonicalJson(prior)
    || renewal.prior_effective_deadline !== prior.expires_at
    || renewal.prior_stage_grant_sha256 !== prior.stage_grant_sha256
    || renewal.prior_candidate_sha256 !== prior.candidate_sha256
    || renewal.prior_manifest_sha256 !== prior.manifest_sha256
    || renewal.prior_casey_pair_sha256 !== continuity.caseyPairSha256
    || renewal.prior_casey_keyset_sha256 !== continuity.caseyKeysetSha256
    || renewal.authorization_receipt_file_sha256 !== SECOND_RENEWAL_RECEIPT_FILE_SHA256
    || renewal.authorization_receipt_canonical_sha256 !== SECOND_RENEWAL_RECEIPT_CANONICAL_SHA256
    || renewal.approved_at !== SECOND_RENEWAL_APPROVED_AT || renewal.expires_at !== SECOND_RENEWAL_EXPIRES_AT
    || !Number.isFinite(approvedAt) || !Number.isFinite(expiresAt)
    || expiresAt - approvedAt !== 86_399_498 || !Number.isFinite(now) || now < approvedAt || now >= expiresAt
    || renewal.coaching_cap_micro_usd !== SYNTHETIC_QA_ALLOCATION.live_coaching_micro_usd
    || renewal.total_cap_micro_usd !== SYNTHETIC_QA_ALLOCATION.total_micro_usd
    || renewal.additional_budget !== false || renewal.additional_budget_micro_usd !== 0
    || renewal.budget_reset !== false || renewal.native_regeneration !== false
    || renewal.provider_assignment_changed !== false || !authority || authority.status !== 'active'
    || authority.authority_id !== renewal.authority_id || authority.custody_sha256 !== renewal.custody_sha256
    || Date.parse(authority.expires_at) < expiresAt) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  return { effectiveDeadline: expiresAt, renewalSha256: hashCanonicalJson(renewal) };
}

function validateGrant(env, now, winnerAcceptance, renewalContinuity = SYNTHETIC_QA_RENEWAL_CONTINUITY) {
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
    || Date.parse(grant.deadline) <= Date.parse(grant.starts_at) || now < Date.parse(grant.starts_at)
    || !isHash(grant.candidate_sha256) || grant.candidate_sha256 !== syntheticQaProviderCandidateSha256()) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  const baseDeadline = Date.parse(grant.deadline);
  if (now >= baseDeadline && env[RENEWAL_ENV] === undefined) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  const manifest = parseFullPersonQaManifest(env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST);
  const grantSha256 = hashCanonicalJson(grant);
  verifySyntheticQaNativeApproval({ raw: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_NATIVE_APPROVED_EXECUTION,
    grant, manifest, digestKey: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY });
  const activeCases = manifest.entries.filter(c => c.status === 'active').map(c => c.case_id);
  if (manifest.manifest_sha256 !== grant.manifest_sha256 || !Array.isArray(grant.cohort)
    || grant.cohort.length < 1 || grant.cohort.length > CASES.length
    || !exact(grant.cohort.map(c => c.case_id), staged ? activeCases : CASES)
    || new Set(grant.cohort.map(c => c.scope_sha256)).size !== grant.cohort.length) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  let effectiveDeadline = baseDeadline, renewalSha256 = null;
  if (now >= baseDeadline) {
    const renewed = validateCoachingRenewal({ env, now, grant, grantSha256, manifest, signingKey,
      continuity: renewalContinuity });
    effectiveDeadline = renewed.effectiveDeadline;
    renewalSha256 = renewed.renewalSha256;
  }
  for (const entry of grant.cohort) {
    const authority = manifest.entries.find(c => c.case_id === entry.case_id);
    const source = entry.case_id.includes('-LO-') ? pinnedLoanOriginatorSubscriptionSources() : pinnedSubscriptionSources();
    if (!authority || !isHash(entry.scope_sha256) || authority.status !== 'active' || Date.parse(authority.expires_at) < effectiveDeadline
      || fullPersonQaAssessmentDigest(entry.assessment_id, env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY) !== authority.assessment_digest
      || entry.authority_id !== authority.authority_id || entry.custody_sha256 !== authority.custody_sha256
      || entry.vertical_id !== authority.vertical_id || source.info.status !== 'AVAILABLE'
      || entry.source_registry_sha256 !== source.info.registry_sha256) fail(SYNTHETIC_QA_PROVIDER_HOLD);
  }
  return { grant, manifest, grantSha256, renewalSha256 };
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
  now = () => Date.now(), renewalContinuity = SYNTHETIC_QA_RENEWAL_CONTINUITY,
  providerClientFactory = () => new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 300_000 }) } = {}) {
  // No grant, key, environment credential, provider client, or ledger is read
  // at construction. GET/readiness paths preserve the existing default-off hold.
  let client;
  function prepare(scope) {
    const admitted = validateGrant(env, now(), winnerAcceptance, renewalContinuity);
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
      if (current.grantSha256 !== initial.grantSha256 || current.renewalSha256 !== initial.renewalSha256)
        fail('SYNTHETIC_QA_GRANT_CHANGED');
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
        const revalidated = prepare(scope);
        if (revalidated.grantSha256 !== initial.grantSha256 || revalidated.renewalSha256 !== initial.renewalSha256
          || options?.signal?.aborted) fail('SYNTHETIC_QA_DISPATCH_REVALIDATION_FAILED');
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
