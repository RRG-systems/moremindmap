import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { deepFreeze } from '../../../src/lib/intelligenceFabric/validation.js';
import { normalizeProfileId as normalizePaidProfileId } from '../../../src/lib/publicSiteAirlockV1/contracts.js';
import {
  createAuthorityReference,
  createCoachingEpisodeContext,
  createEvidenceReference,
  createFreeGptLivingRelationshipRuntimeV2,
  createFrontierConversationSeamV2,
  createInitialLivingBusinessTwinPublication,
  createLivingConversationController,
  createNaturalAuthorizationInterpreterV1,
  createPostResponseCandidateExtractorV1,
  createSessionCloseSeamV1,
  initialLivingStateFromBusinessTwin,
  sameScope,
  scopeFingerprint,
} from '../../../src/lib/subscriptionV1/index.js';
import { retrieveCoachingDoctrine } from '../../../src/lib/subscriptionV1/afw04/index.js';
import { getCanonicalProfile, extractProfileContext } from '../../business-assessment/shared.js';
import { resolveBundledBosAuthority } from '../newBaProductionReadinessV1/canonicalReader.js';
import { normalizeProfileId as normalizeNewBaProfileId, sha256Stable } from '../newBaProductionReadinessV1/stable.js';
import { RedisLivingRelationshipStore, readExternalEvidence } from './internalDevInfrastructure.js';
import { createSubscriptionLiveDemoOpenAiTransport } from './liveDemoOpenAiTransport.js';
import {
  assertCanonicalLineage,
  assertPaidBusinessScope,
  completedBosFusionAuthority,
  completedRealization,
} from './paidSubscriberCustody.js';
import { pinnedSubscriptionSources } from './pinnedSources.js';
import { paidRuntimeKeys, paidRuntimeRelationshipKey } from './paidRuntimeInfrastructure.js';

export const PAID_SUBSCRIBER_REQUIRED_ARTIFACT_TYPES = deepFreeze([
  'NEW_BOS',
  'NEW_BA',
  'BOS_BA_FUSION',
  'WHOLE_BUSINESS_MODEL_V1',
  'FIVE_FUTURES_V2',
  'ONE_MOVE_V2',
  'PLAN_135',
  'EVIDENCE_LEDGER',
]);

const SESSION_ID = /^session_[a-f0-9]{24}$/u;
const PRIVATE_VALUE_KEYS = new Set([
  'assessment_id',
  'business_id',
  'membership_id',
  'profile_id',
  'subject_id',
  'tenant_id',
]);
const SENSITIVE_STRING = /\bMM-[A-Z0-9-]+\b|\bba-\d{8}-[a-f0-9]{8}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/giu;
const CUSTOMER_PROJECTION_SENSITIVE = /\bMM-[A-Z0-9-]+\b|\bba-\d{8}-[a-f0-9]{8}\b|\b[a-f0-9]{64}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/iu;

const clone = (value) => JSON.parse(JSON.stringify(value));

function deny(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireCondition(condition, code) {
  if (!condition) deny(code);
}

function requireFunction(value, code) {
  requireCondition(typeof value === 'function', code);
  return value;
}

function statement(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object') return null;
  for (const key of ['statement', 'meaning', 'question', 'candidate', 'explanation', 'value', 'title', 'summary']) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
  }
  return null;
}

function boundedStatements(values, limit = 20) {
  return [...new Set((Array.isArray(values) ? values : [values]).map(statement).filter(Boolean))].slice(0, limit);
}

function semanticSource(value) {
  if (typeof value === 'string') return value.replace(SENSITIVE_STRING, 'governed private record');
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(semanticSource);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !PRIVATE_VALUE_KEYS.has(key)
      && !/(?:^|_)(?:hash|hashes|ref|refs|lineage|provider|raw|internal)(?:$|_)/iu.test(key))
    .map(([key, child]) => [key, semanticSource(child)]));
}

function exactPaidMembershipContext(context) {
  requireCondition(context?.authenticated === true
    && context.membership_verified === true
    && context.binding_source === 'AUTHENTICATED_SERVER_CONTEXT'
    && context.scope && typeof context.scope === 'object', 'PAID_SUBSCRIBER_AUTHENTICATED_MEMBERSHIP_REQUIRED');
  let scopeHash;
  try { scopeHash = scopeFingerprint(context.scope); } catch { deny('PAID_SUBSCRIBER_EXACT_SCOPE_REQUIRED'); }
  const scope = clone(context.scope);
  requireCondition(scope.profile_id === normalizePaidProfileId(scope.profile_id), 'PAID_SUBSCRIBER_PROFILE_SCOPE_INVALID');
  const binding = context.membership_binding;
  if (binding != null) {
    const bindingScope = binding.scope || Object.fromEntries(
      ['subject_id', 'membership_id', 'tenant_id', 'profile_id', 'business_id'].map((field) => [field, binding[field]]),
    );
    let bindingScopeMatches = false;
    try { bindingScopeMatches = scopeFingerprint(bindingScope) === scopeHash; } catch { bindingScopeMatches = false; }
    requireCondition(binding?.membership_verified === true
      && binding?.binding_source === 'AUTHENTICATED_SERVER_CONTEXT'
      && bindingScopeMatches
      && sameScope(bindingScope, scope), 'PAID_SUBSCRIBER_MEMBERSHIP_BINDING_MISMATCH');
  }
  return { scope: deepFreeze(scope), scope_hash: scopeHash };
}

function governedWholePersonClaims(authority) {
  if (!authority) return [];
  return authority.claims.map((claim) => {
    requireCondition(claim.business_cause_authority === false, 'PAID_SUBSCRIBER_BOS_BUSINESS_CAUSE_AUTHORITY_PROHIBITED');
    return {
      category: claim.category,
      meaning: claim.meaning,
      confidence: claim.confidence,
      allowed_uses: [...claim.allowed_uses],
      business_cause_authority: false,
    };
  });
}

function internalArtifact(scope, artifactType, payload, sourceHash, createdAt, {
  version = '1.0.0',
  bindings = {},
  parentArtifactIds = [],
  domainBoundary = null,
} = {}) {
  const projectedPayload = semanticSource(payload);
  const contentHash = hashCanonicalJson({
    contract: 'paid-subscriber-canonical-artifact-projection-v1',
    artifact_type: artifactType,
    source_sha256: sourceHash,
    payload: projectedPayload,
  });
  const suffix = contentHash.slice(0, 24);
  return deepFreeze({
    artifact_id: `${artifactType.toLowerCase()}_${suffix}`,
    artifact_type: artifactType,
    version,
    content_hash: contentHash,
    authority: createAuthorityReference({
      authority_id: `canonical_real_profile_${artifactType.toLowerCase()}`,
      authority_version: version,
      authority_hash: sourceHash,
    }),
    parent_artifact_ids: [...parentArtifactIds],
    created_at: createdAt,
    supersedes_artifact_id: null,
    scope: clone(scope),
    status: 'COMPLETE',
    validation_status: 'PASS',
    compatibility_status: 'COMPATIBLE',
    bindings: clone(bindings),
    payload: projectedPayload,
    domain_boundary: domainBoundary || {
      source: 'CANONICAL_OWNED_PROFILE_COMPLETED_REALIZATION',
      raw_profile_forwarded: false,
    },
  });
}

function canonicalArtifacts({ scope, artifact, hashes, createdAt, bosFusionAuthority }) {
  const wbm = artifact.business_reality;
  const futuresSource = artifact.five_futures;
  const moveSource = artifact.one_move;
  const customerView = artifact.customer_view_model;
  const evidenceState = wbm.epistemic_state || {};
  const newBaRuntimeHash = hashCanonicalJson({
    contract: 'paid-subscriber-new-ba-runtime-projection-v1',
    business_evidence_sha256: hashes.business_evidence,
    customer_projection_sha256: hashes.customer_projection,
  });

  const bos = internalArtifact(scope, 'NEW_BOS', {
    summary: customerView.bos?.headline || 'Completed Whole-Person authority is available for execution fit.',
    execution_adjustments: customerView.bos?.adjustments || [],
    governed_claims: governedWholePersonClaims(bosFusionAuthority),
    boundary: customerView.bos?.boundary || 'Whole-Person authority modifies execution feasibility only.',
  }, hashes.bos_authority, createdAt, { version: artifact.version });

  const ba = internalArtifact(scope, 'NEW_BA', {
    current_business_reality: wbm.current_business_reality || {},
    governed_business_evidence: wbm.governed_business_evidence || [],
    evidence_summary: artifact.evidence,
  }, newBaRuntimeHash, createdAt, { version: artifact.version });

  const fusion = internalArtifact(scope, 'BOS_BA_FUSION', {
    relationships: artifact.fusion.relationships,
    causal_boundary: artifact.fusion.causal_boundary,
    privacy_boundary: artifact.fusion.privacy_boundary,
    customer_projection_effect: artifact.fusion.customer_projection_effect,
  }, hashes.fusion, createdAt, {
    version: artifact.fusion.version || '1.0.0',
    bindings: { bos_hash: bos.content_hash, ba_hash: ba.content_hash },
    parentArtifactIds: [bos.artifact_id, ba.artifact_id],
  });

  const wholeBusinessModel = internalArtifact(scope, 'WHOLE_BUSINESS_MODEL_V1', {
    business_model: wbm.business_model || {},
    current_business_reality: wbm.current_business_reality || {},
    domain_states: wbm.domain_states || [],
    causal_model: wbm.causal_model || {},
    governing_constraint: wbm.governing_constraint || {},
    assets: wbm.assets || [],
    vulnerabilities: wbm.vulnerabilities || [],
    epistemic_state: wbm.epistemic_state || {},
  }, hashes.whole_business_model, createdAt, {
    version: wbm.version || '1.0.0',
    bindings: { ba_hash: ba.content_hash, fusion_hash: fusion.content_hash },
    parentArtifactIds: [ba.artifact_id, fusion.artifact_id],
    domainBoundary: {
      business_causes: 'BUSINESS_EVIDENCE_ONLY',
      whole_person_role: 'EXECUTION_FEASIBILITY_ONLY',
      source: 'CANONICAL_OWNED_PROFILE_COMPLETED_REALIZATION',
      raw_profile_forwarded: false,
    },
  });

  const futures = internalArtifact(scope, 'FIVE_FUTURES_V2', {
    trajectories: (futuresSource.futures || []).map((future) => ({
      role: future.future_role,
      title: future.title,
      meaning: future.business_state_if_realized,
      conditionality: future.conditionality,
      relative_support_weight: future.normalized_relative_support_weight,
      certainty: future.certainty_support_classification,
      leading_indicators: future.leading_indicators || [],
      risks: future.risks || [],
      assumptions: future.assumptions || [],
      falsifiers: future.falsifiers || [],
    })),
    support_semantics: futuresSource.support_semantics,
  }, hashes.five_futures, createdAt, {
    version: futuresSource.version || '2.0.0',
    bindings: { wbm_hash: wholeBusinessModel.content_hash },
    parentArtifactIds: [wholeBusinessModel.artifact_id],
  });

  const mechanismId = moveSource.primary_mechanism_ids?.[0] || moveSource.governing_constraint_id;
  requireCondition(typeof mechanismId === 'string' && mechanismId.trim(), 'PAID_SUBSCRIBER_ONE_MOVE_MECHANISM_REQUIRED');
  const move = internalArtifact(scope, 'ONE_MOVE_V2', {
    selected: true,
    mechanism_id: mechanismId,
    title: moveSource.title,
    intervention: moveSource.intervention,
    why_now: moveSource.why_now,
    execution_definition: moveSource.execution_definition,
    bounded_execution_steps: moveSource.bounded_execution_steps || [],
    leading_indicators: moveSource.leading_indicators || [],
    success_evidence: moveSource.success_evidence || [],
    failure_evidence: moveSource.failure_evidence || [],
    falsifiers: moveSource.falsifiers || [],
    stop_or_reconsider_conditions: moveSource.stop_or_reconsider_conditions || [],
  }, hashes.one_move, createdAt, {
    version: moveSource.version || '2.0.0',
    bindings: { wbm_hash: wholeBusinessModel.content_hash, five_futures_hash: futures.content_hash },
    parentArtifactIds: [wholeBusinessModel.artifact_id, futures.artifact_id],
  });

  const plan = internalArtifact(scope, 'PLAN_135', artifact.plan_135, hashes.plan, createdAt, {
    version: artifact.plan_135.version || '1.0.0',
    bindings: { one_move_hash: move.content_hash, wbm_hash: wholeBusinessModel.content_hash },
    parentArtifactIds: [move.artifact_id, wholeBusinessModel.artifact_id],
  });

  const evidencePayload = {
    categories: artifact.evidence.categories || [],
    known: boundedStatements((wbm.domain_states || []).flatMap((state) => state.claims || [])
      .filter((claim) => ['KNOWN', 'STRONGLY_SUPPORTED'].includes(claim.epistemic_class))),
    inferred: boundedStatements((wbm.domain_states || []).flatMap((state) => state.claims || [])
      .filter((claim) => !['KNOWN', 'STRONGLY_SUPPORTED'].includes(claim.epistemic_class))),
    missing: boundedStatements(evidenceState.missing_evidence),
    contradicted: boundedStatements(evidenceState.contradictions),
    counterevidence: boundedStatements(evidenceState.counterevidence),
    mind_changes: boundedStatements(evidenceState.mind_change_conditions),
  };
  const evidenceHash = hashCanonicalJson({
    contract: 'paid-subscriber-evidence-ledger-projection-v1',
    source_business_evidence_sha256: hashes.business_evidence,
    source_wbm_sha256: hashes.whole_business_model,
    payload: evidencePayload,
  });
  const evidence = internalArtifact(scope, 'EVIDENCE_LEDGER', evidencePayload, evidenceHash, createdAt, {
    bindings: { ba_hash: ba.content_hash, wbm_hash: wholeBusinessModel.content_hash },
    parentArtifactIds: [ba.artifact_id, wholeBusinessModel.artifact_id],
  });

  return deepFreeze([bos, ba, fusion, wholeBusinessModel, futures, move, plan, evidence]);
}

function safePreferredName(profileLookup, profileId) {
  const context = extractProfileContext(profileLookup.dossier, profileId);
  const fullName = String(context.owner_profile_name || '').replace(SENSITIVE_STRING, '').trim();
  const firstName = fullName.split(/\s+/u)[0]?.slice(0, 60);
  return firstName && firstName !== 'Profile' ? firstName : 'Customer';
}

function verticalLabel(artifact) {
  const value = artifact.customer_view_model?.vertical?.label
    || artifact.customer_view_model?.identity?.vertical
    || artifact.lineage?.vertical_id
    || 'Business';
  return String(semanticSource(String(value))).trim().slice(0, 100) || 'Business';
}

function doctrineVerticalId(artifact) {
  const value = `${artifact.lineage?.vertical_id || ''} ${verticalLabel(artifact)}`.toUpperCase();
  if (value.includes('REAL') && value.includes('ESTATE')) return 'REAL_ESTATE';
  if (value.includes('PROFESSIONAL') && value.includes('SERVICE')) return 'PROFESSIONAL_SERVICES';
  return null;
}

function assertCustomerProjectionBoundary(viewModel, scope, assessmentId, realizationProfileId) {
  const serialized = JSON.stringify(viewModel).toLowerCase();
  const privateValues = [...Object.values(scope), assessmentId, realizationProfileId]
    .filter((value) => typeof value === 'string' && value);
  requireCondition(privateValues.every((value) => !serialized.includes(value.toLowerCase()))
    && !CUSTOMER_PROJECTION_SENSITIVE.test(serialized), 'PAID_SUBSCRIBER_CUSTOMER_PROJECTION_PRIVATE_ID_DENIED');
}

export function projectCompletedRealProfileToSubscription({
  scope,
  assessment_id = null,
  profile_lookup,
  realization_record,
  bos_realization_record,
  resolveBundledBosAuthorityForProfile = resolveBundledBosAuthority,
} = {}) {
  const profileId = normalizePaidProfileId(scope?.profile_id);
  requireCondition(profileId && scope?.profile_id === profileId
    && profile_lookup?.found === true
    && profile_lookup.profile_id === profileId
    && profile_lookup.dossier && typeof profile_lookup.dossier === 'object', 'PAID_SUBSCRIBER_CANONICAL_OWNED_PROFILE_REQUIRED');
  const realizationProfileId = normalizeNewBaProfileId(profileId);
  const completed = completedRealization(realization_record, realizationProfileId, assessment_id);
  const hashes = assertCanonicalLineage(completed.artifact, realization_record.realization_identity || null);
  const bosFusionAuthority = completedBosFusionAuthority(bos_realization_record, {
    profileId: realizationProfileId,
    baArtifact: completed.artifact,
    baHashes: hashes,
    baIdentity: realization_record.realization_identity,
    resolveBundledBosAuthorityForProfile,
  });
  assertPaidBusinessScope(scope, completed.assessment_id, hashes.vertical_binding);
  const baseViewModel = clone(completed.artifact.customer_view_model);
  assertCustomerProjectionBoundary(baseViewModel, scope, completed.assessment_id, realizationProfileId);
  initialLivingStateFromBusinessTwin(baseViewModel);
  const preferredName = safePreferredName(profile_lookup, profileId);
  const vertical = verticalLabel(completed.artifact);
  const artifacts = canonicalArtifacts({
    scope,
    artifact: completed.artifact,
    hashes,
    createdAt: completed.created_at,
    bosFusionAuthority,
  });
  return deepFreeze({
    scope: clone(scope),
    base_view_model: baseViewModel,
    canonical_artifacts: artifacts,
    business_truth: [
      createEvidenceReference({ evidence_id: 'canonical_business_assessment', evidence_domain: 'BUSINESS', content_hash: hashes.business_evidence, certainty: 'KNOWN' }),
      createEvidenceReference({ evidence_id: 'completed_whole_business_model', evidence_domain: 'BUSINESS', content_hash: hashes.whole_business_model, certainty: 'INFERRED' }),
    ],
    whole_person_execution_context: [
      createEvidenceReference({ evidence_id: 'completed_whole_person_authority', evidence_domain: 'WHOLE_PERSON_EXECUTION', content_hash: hashes.bos_authority, certainty: 'KNOWN' }),
      createEvidenceReference({ evidence_id: 'completed_person_business_fusion', evidence_domain: 'WHOLE_PERSON_EXECUTION', content_hash: hashes.fusion, certainty: 'INFERRED' }),
    ],
    uncertainty: boundedStatements([
      ...(completed.artifact.business_reality.epistemic_state?.missing_evidence || []),
      ...(completed.artifact.business_reality.epistemic_state?.contradictions || []),
    ], 40),
    preferred_name: preferredName,
    vertical,
    doctrine_vertical_id: doctrineVerticalId(completed.artifact),
    source_created_at: completed.created_at,
    source_artifact_sha256: sha256Stable(completed.artifact),
    bos_authority_claim_count: bosFusionAuthority?.claims.length || 0,
    bos_authority_projection_source: bosFusionAuthority
      ? 'EXACT_RECORDED_LAUNCH_SAFE_BOS_REALIZATION'
      : 'RECORDED_NEW_BA_COMPACT_COMPATIBILITY',
    assessment_binding_source: 'COMPLETED_REALIZATION_CROSS_CHECKED_TO_PROFILE_SCOPE',
    raw_canonical_profile_forwarded: false,
    raw_bos_artifact_forwarded: false,
  });
}

function relationshipContext(projection, sessionKind) {
  return deepFreeze({
    session_kind: sessionKind,
    preferred_conversational_name: projection.preferred_name,
    preferred_name_authority: 'CANONICAL_OWNED_PROFILE',
    mission: sessionKind === 'FIRST_EVER'
      ? 'Begin a continuing coaching relationship from the completed governed Business Twin without repeating the completed assessment or exposing private source detail.'
      : 'Continue from the current governed Business Twin, durable relationship history, attempts, outcomes, and open loops.',
    bos_validation: { status: 'ESTABLISHED', repeat_weekly: false, reassessment_allowed: false },
    privacy_boundary: 'Use only the governed semantic projection. Never expose raw profile custody, private identifiers, internal hashes, or raw assessment evidence.',
    source_authority: 'CANONICAL_OWNED_PROFILE_AND_COMPLETED_BOS_BA_REALIZATION',
    capability_context: {
      live_web_research_available: false,
      knowledge_library: 'MORE Real Estate knowledge and a separately labeled D.J. field-doctrine extract, available through optional read-only source tools.',
      customer_notice: 'This version does not search the live web. Current web facts have not been checked.',
    },
  });
}

function currentPendingProposal(store, currentPublicationHash) {
  const snapshot = store.snapshot();
  const currentPublication = snapshot.publications?.[snapshot.current_publication_hash] || null;
  if (!currentPublication || snapshot.current_publication_hash !== currentPublicationHash) return null;
  return Object.values(snapshot.proposals || {})
    .filter((entry) => entry?.workflow_status === 'AWAITING_CUSTOMER_DECISION'
      && entry?.proposal?.expected_prior_publication_hash === currentPublicationHash
      && entry?.proposal?.expected_prior_publication_version === currentPublication.publication_version)
    .sort((left, right) => String(right.persisted_at).localeCompare(String(left.persisted_at)))[0]?.proposal?.proposal_id || null;
}

export async function createPaidSubscriberRuntimeFromProjection({
  projection,
  store,
  session_id,
  session_kind,
  coaching_episode_phase = 'ACTIVE',
  session_temporal_context = null,
  initial_conversation = [],
  external_evidence = [],
  transport,
  now = () => new Date().toISOString(),
} = {}) {
  requireCondition(projection && store, 'PAID_SUBSCRIBER_RUNTIME_DEPENDENCIES_REQUIRED');
  requireCondition(SESSION_ID.test(session_id || ''), 'PAID_SUBSCRIBER_SESSION_BINDING_INVALID');
  requireCondition(['FIRST_EVER', 'WEEKLY'].includes(session_kind), 'PAID_SUBSCRIBER_SESSION_KIND_INVALID');
  requireFunction(transport, 'PAID_SUBSCRIBER_PROVIDER_TRANSPORT_REQUIRED');
  requireFunction(now, 'PAID_SUBSCRIBER_CLOCK_REQUIRED');

  const initial = createInitialLivingBusinessTwinPublication({
    scope: projection.scope,
    artifact_lineage: projection.canonical_artifacts.map(({ artifact_type, content_hash }) => ({ artifact_type, content_hash })),
    initial_state: initialLivingStateFromBusinessTwin(projection.base_view_model),
    published_at: projection.source_created_at,
  });
  requireCondition(initial.ok, initial.code || 'PAID_SUBSCRIBER_INITIAL_PUBLICATION_INVALID');

  let currentRead = store.readCurrent({ scope: projection.scope });
  if (!currentRead.ok) {
    const initialized = await store.initialize({ scope: projection.scope, publication: initial.publication });
    if (!initialized.ok && initialized.code !== 'AFW05_ALREADY_INITIALIZED') deny(initialized.code || 'PAID_SUBSCRIBER_STORE_INITIALIZATION_FAILED');
    currentRead = store.readCurrent({ scope: projection.scope });
  }
  requireCondition(currentRead.ok, 'PAID_SUBSCRIBER_CURRENT_STATE_UNAVAILABLE');
  requireCondition(currentRead.publication.source_artifact_set_hash === initial.publication.source_artifact_set_hash,
    'PAID_SUBSCRIBER_BASELINE_RECONCILIATION_REQUIRED');

  const clock = now;
  const context = relationshipContext(projection, session_kind);
  const runtime = createFreeGptLivingRelationshipRuntimeV2({
    scope: projection.scope,
    session_id,
    store,
    conversation_seam: createFrontierConversationSeamV2({ transport, enabled: true, web_search_enabled: false, now: clock }),
    session_close_seam: createSessionCloseSeamV1({ transport, enabled: true, now: clock }),
    candidate_extractor: createPostResponseCandidateExtractorV1({ transport, enabled: true, now: clock }),
    authorization_interpreter: createNaturalAuthorizationInterpreterV1({ transport, enabled: true, now: clock }),
    doctrine_retrieval: retrieveCoachingDoctrine({
      purpose: session_kind === 'FIRST_EVER' ? 'ONBOARDING' : 'WEEKLY_COACHING',
      vertical_id: projection.doctrine_vertical_id,
    }),
    canonical_artifacts: projection.canonical_artifacts,
    business_truth: projection.business_truth,
    whole_person_execution_context: projection.whole_person_execution_context,
    uncertainty: projection.uncertainty,
    external_evidence,
    relationship_context: context,
    coaching_session: createCoachingEpisodeContext({
      phase: coaching_episode_phase,
      preferred_conversational_name: projection.preferred_name,
      preferred_name_authority: 'CANONICAL_OWNED_PROFILE',
      session_kind,
    }),
    session_temporal_context,
    initial_conversation,
    initial_pending_proposal_id: currentPendingProposal(store, currentRead.publication.publication_hash),
    clock,
  });
  const assembled = runtime.assemble({
    visible_customer_context: {
      surface: 'Overview',
      visible_objects: ['Where You Are', 'Five Possible Futures', 'Your One Move', 'Your Plan', 'Evidence'],
    },
    as_of_at: clock(),
  });
  requireCondition(assembled.ok, assembled.code || 'PAID_SUBSCRIBER_UNDERSTANDING_ASSEMBLY_FAILED');
  const controller = createLivingConversationController({
    runtime,
    store,
    scope: projection.scope,
    base_view_model: projection.base_view_model,
    evidence_catalog: [],
  });
  const current = controller.current();
  requireCondition(current.ok, current.code || 'PAID_SUBSCRIBER_CURRENT_STATE_UNAVAILABLE');
  return { controller, store, current, relationship_context: context };
}

async function defaultCanonicalProfileReader({ redis, profile_id }) {
  return getCanonicalProfile(redis, profile_id);
}

async function defaultStoreOpener({ redis, keys }) {
  return RedisLivingRelationshipStore.open({ redis, keys });
}

async function defaultExternalEvidenceReader({ redis, keys }) {
  return readExternalEvidence({ redis, key: keys.research });
}

function defaultTransportFactory({ env }) {
  return createSubscriptionLiveDemoOpenAiTransport({
    apiKey: env.OPENAI_API_KEY,
    timeoutMs: 300_000,
    maxTransportRetries: 1,
    sourceLibrary: pinnedSubscriptionSources,
  });
}

export function createCurrentRealProfileRealizationReader({ realizationStore } = {}) {
  requireCondition(typeof realizationStore?.getCurrent === 'function', 'PAID_SUBSCRIBER_REALIZATION_STORE_REQUIRED');
  return async function readCurrentRealProfileRealization({ profile_id }) {
    const current = await realizationStore.getCurrent({ profileId: normalizeNewBaProfileId(profile_id) });
    requireCondition(current, 'PAID_SUBSCRIBER_COMPLETED_REALIZATION_NOT_FOUND');
    return current;
  };
}

export function createRecordedBosRealizationReader({ realizationStore } = {}) {
  requireCondition(typeof realizationStore?.getRealization === 'function', 'PAID_SUBSCRIBER_BOS_REALIZATION_STORE_REQUIRED');
  return async function readRecordedBosRealization({ profile_id, realization_id }) {
    requireCondition(typeof realization_id === 'string' && realization_id.trim(), 'PAID_SUBSCRIBER_RECORDED_BOS_REALIZATION_ID_REQUIRED');
    const current = await realizationStore.getRealization({
      profileId: normalizeNewBaProfileId(profile_id),
      realizationId: realization_id,
    });
    return current;
  };
}

export function createPaidSubscriberLoader({
  readCanonicalProfile = defaultCanonicalProfileReader,
  readCompletedRealization,
  readCompletedBosRealization,
  resolveBundledBosAuthorityForProfile = resolveBundledBosAuthority,
  openRelationshipStore = defaultStoreOpener,
  readExternalEvidenceForRuntime = defaultExternalEvidenceReader,
  createTransport = defaultTransportFactory,
} = {}) {
  requireFunction(readCanonicalProfile, 'PAID_SUBSCRIBER_CANONICAL_PROFILE_READER_REQUIRED');
  requireFunction(readCompletedRealization, 'PAID_SUBSCRIBER_REALIZATION_READER_REQUIRED');
  requireFunction(readCompletedBosRealization, 'PAID_SUBSCRIBER_BOS_REALIZATION_READER_REQUIRED');
  requireFunction(resolveBundledBosAuthorityForProfile, 'PAID_SUBSCRIBER_BUNDLED_BOS_AUTHORITY_RESOLVER_REQUIRED');
  requireFunction(openRelationshipStore, 'PAID_SUBSCRIBER_RELATIONSHIP_STORE_FACTORY_REQUIRED');
  requireFunction(readExternalEvidenceForRuntime, 'PAID_SUBSCRIBER_EXTERNAL_EVIDENCE_READER_REQUIRED');
  requireFunction(createTransport, 'PAID_SUBSCRIBER_TRANSPORT_FACTORY_REQUIRED');

  return async function loadPaidSubscriber({
    redis,
    relationship_key,
    subject_key,
    membership_context,
    session_id,
    session_kind,
    coaching_episode_phase = 'ACTIVE',
    session_temporal_context = null,
    initial_conversation = [],
    env = globalThis.process?.env || {},
    transport = null,
    now = () => new Date().toISOString(),
  } = {}) {
    const authority = exactPaidMembershipContext(membership_context);
    requireCondition(subject_key === authority.scope.subject_id
      && relationship_key === paidRuntimeRelationshipKey(authority.scope), 'PAID_SUBSCRIBER_RUNTIME_IDENTITY_BINDING_MISMATCH');
    const membershipAssessmentId = membership_context.assessment_id
      || membership_context.membership_binding?.assessment_id
      || null;
    const [profileLookup, realizationRecord] = await Promise.all([
      readCanonicalProfile({ redis, profile_id: authority.scope.profile_id, membership_context }),
      readCompletedRealization({ redis, profile_id: authority.scope.profile_id, membership_context }),
    ]);
    const preliminary = completedRealization(
      realizationRecord,
      normalizeNewBaProfileId(authority.scope.profile_id),
      membershipAssessmentId,
    );
    const recordedBosRealizationId = preliminary.artifact.fusion?.bos_authority?.realization_id;
    requireCondition(typeof recordedBosRealizationId === 'string' && recordedBosRealizationId,
      'PAID_SUBSCRIBER_RECORDED_BOS_REALIZATION_ID_REQUIRED');
    const bosRealizationRecord = await readCompletedBosRealization({
      redis,
      profile_id: authority.scope.profile_id,
      realization_id: recordedBosRealizationId,
      membership_context,
    });
    const projection = projectCompletedRealProfileToSubscription({
      scope: authority.scope,
      assessment_id: membershipAssessmentId,
      profile_lookup: profileLookup,
      realization_record: realizationRecord,
      bos_realization_record: bosRealizationRecord,
      resolveBundledBosAuthorityForProfile,
    });
    const keys = paidRuntimeKeys({ scope: authority.scope });
    const [store, externalEvidence] = await Promise.all([
      openRelationshipStore({ redis, keys, scope: authority.scope }),
      readExternalEvidenceForRuntime({ redis, keys, scope: authority.scope }),
    ]);
    requireCondition(Array.isArray(externalEvidence), 'PAID_SUBSCRIBER_EXTERNAL_EVIDENCE_INVALID');
    let deferredTransport = transport;
    const providerTransport = async (...args) => {
      if (!deferredTransport) deferredTransport = createTransport({ env, scope: authority.scope });
      requireFunction(deferredTransport, 'PAID_SUBSCRIBER_PROVIDER_TRANSPORT_REQUIRED');
      return deferredTransport(...args);
    };
    const loaded = await createPaidSubscriberRuntimeFromProjection({
      projection,
      store,
      session_id,
      session_kind,
      coaching_episode_phase,
      session_temporal_context,
      initial_conversation,
      external_evidence: externalEvidence,
      transport: providerTransport,
      now,
    });
    return {
      controller: loaded.controller,
      store: loaded.store,
      keys,
      scope: authority.scope,
      baseViewModel: projection.base_view_model,
      current: loaded.current,
      identity: {
        first_name: projection.preferred_name,
        vertical: projection.vertical,
        synthetic_only: false,
        demo_copy_only: false,
      },
      relationship_context: loaded.relationship_context,
      architecture: {
        loader_id: 'subscription_v1_paid_canonical_profile_runtime_loader_v1',
        exact_scope_hash: authority.scope_hash,
        required_artifact_types: [...PAID_SUBSCRIBER_REQUIRED_ARTIFACT_TYPES],
        free_gpt_v2: true,
        afw05_core_reused: true,
        canonical_owned_profile_loaded: true,
        completed_bos_ba_realization_loaded: true,
        completed_recorded_bos_realization_loaded: Boolean(bosRealizationRecord),
        governed_whole_person_claim_count: projection.bos_authority_claim_count,
        bos_authority_projection_source: projection.bos_authority_projection_source,
        assessment_binding_source: projection.assessment_binding_source,
        raw_canonical_profile_forwarded: false,
        raw_bos_artifact_forwarded: projection.raw_bos_artifact_forwarded,
        synthetic_lab_state_loaded: false,
        demo_copy_loaded: false,
        provider_calls_during_load: 0,
      },
    };
  };
}
