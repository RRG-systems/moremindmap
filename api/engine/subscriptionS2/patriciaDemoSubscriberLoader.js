import fs from 'node:fs';
import crypto from 'node:crypto';

import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
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
} from '../../../src/lib/subscriptionV1/index.js';
import { retrieveCoachingDoctrine } from '../../../src/lib/subscriptionV1/afw04/index.js';
import { buildSyntheticGeneralizationCandidate } from '../../../src/lab/baV2CustomerRealization/buildSyntheticGeneralizationCandidate.js';
import { createBaProgressiveDisclosureV1 } from '../../../src/lib/baProgressiveDisclosureV1/index.js';
import { createSyntheticRealEstateFounderViewModelV1 } from '../../../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticRealEstateFounderSubjectsV1.js';
import { createSubscriptionLiveDemoOpenAiTransport } from '../subscriptionV1/liveDemoOpenAiTransport.js';
import { RedisLivingRelationshipStore, internalDevKeys, readExternalEvidence } from '../subscriptionV1/internalDevInfrastructure.js';
import {
  PATRICIA_DEMO_RELATIONSHIP_KEY,
  PATRICIA_DEMO_SUBJECT_KEY,
} from './demoSubjectAuthority.js';

export { PATRICIA_DEMO_RELATIONSHIP_KEY, PATRICIA_DEMO_SUBJECT_KEY };
export const PATRICIA_DEMO_SCOPE = Object.freeze({
  subject_id: 'subject_local_demo_patricia_derived_s2',
  membership_id: 'membership_local_demo_patricia_derived_s2',
  tenant_id: 'tenant_local_subscription_s2_demo_only',
  profile_id: 'DEMO-S2-PATRICIA-DERIVED-SNAPSHOT',
  business_id: 'business_local_demo_patricia_derived_s2',
});
export const PATRICIA_DEMO_FIXTURE_SHA256 = 'fda0303d6f8d29a0f4ea822fdacc97afcf84fd226f3fd21dfe4fbf051e894b78';
export const PATRICIA_DEMO_FIXTURE_FILE_SHA256 = 'e99f1879def39eee1c798a331641c723525919a02feb4a558ea55bba92a974c4';
export const PATRICIA_DEMO_SOURCE_PATH = new URL('../../../docs/stack-lab/stage-b-control-vs-reality/PATRICIA_TEST_A_FROZEN.json', import.meta.url);

const clone = (value) => JSON.parse(JSON.stringify(value));
const list = (value) => Array.isArray(value) ? value : [];
const statement = (item) => typeof item === 'string' ? item : item?.statement || item?.question || item?.candidate || item?.title || JSON.stringify(item);

function readSealedFixture() {
  const raw = fs.readFileSync(PATRICIA_DEMO_SOURCE_PATH);
  if (crypto.createHash('sha256').update(raw).digest('hex') !== PATRICIA_DEMO_FIXTURE_FILE_SHA256) {
    throw new Error('SUBSCRIPTION_S2_PATRICIA_DEMO_FIXTURE_FILE_HASH_INVALID');
  }
  const fixture = JSON.parse(raw.toString('utf8'));
  if (fixture.fixture_sha256 !== PATRICIA_DEMO_FIXTURE_SHA256
    || fixture.fixture_id !== 'PATRICIA_TEST_A'
    || fixture.fixture_class !== 'AUTHORIZED_REAL_WORLD_FROZEN_TEST_FIXTURE_NOT_CANONICAL_STATE') {
    throw new Error('SUBSCRIPTION_S2_PATRICIA_DEMO_FIXTURE_CUSTODY_INVALID');
  }
  return fixture;
}

function internalArtifact(scope, artifactType, payload, sourceHash, { bindings = {}, domainBoundary = null } = {}) {
  return {
    artifact_id: `${artifactType.toLowerCase()}_patricia_derived_demo_s2`,
    artifact_type: artifactType,
    version: '1.0.0-demo-snapshot',
    content_hash: hashCanonicalJson({ artifactType, payload, sourceHash, demoOnly: true }),
    authority: createAuthorityReference({ authority_id: `${artifactType.toLowerCase()}_sealed_demo_authority`, authority_version: '1.0.0' }),
    parent_artifact_ids: [],
    created_at: '2026-08-30T00:00:00.000Z',
    supersedes_artifact_id: null,
    scope: clone(scope),
    status: 'COMPLETE',
    validation_status: 'PASS',
    compatibility_status: 'COMPATIBLE',
    bindings: { sealed_fixture_sha256: PATRICIA_DEMO_FIXTURE_SHA256, ...clone(bindings) },
    payload: clone(payload),
    domain_boundary: domainBoundary || { source: 'SEALED_AUTHORIZED_PSEUDONYMOUS_SNAPSHOT', writes: 'LOCAL_DEMO_SCOPE_ONLY' },
  };
}

function canonicalArtifacts(fixture) {
  const current = fixture.business.vertical_reality.current_business_reality;
  const desired = fixture.business.vertical_reality.desired_business_reality;
  const constraint = fixture.business.whole_business_model.governing_constraint;
  const bos = internalArtifact(PATRICIA_DEMO_SCOPE, 'NEW_BOS', { governed_claims: fixture.whole_person.governed_bos_authority.claims, privacy_boundary: fixture.whole_person.governed_bos_authority.boundary }, fixture.whole_person.governed_bos_authority.contract_sha256);
  const ba = internalArtifact(PATRICIA_DEMO_SCOPE, 'NEW_BA', { current_business_reality: current, desired_business_reality: desired, claims: fixture.evidence.known, missing_evidence: fixture.evidence.missing, contradictions: fixture.evidence.contradicted }, fixture.business.vertical_reality.state_hash);
  const fusion = internalArtifact(PATRICIA_DEMO_SCOPE, 'BOS_BA_FUSION', { whole_person_role: 'COMMUNICATION_AND_EXECUTION_FIT_ONLY', person_business_synthesis: fixture.business.whole_business_model.person_business_synthesis }, fixture.business.whole_business_model.state_hash, { bindings: { bos_hash: bos.content_hash, ba_hash: ba.content_hash } });
  const wbm = internalArtifact(PATRICIA_DEMO_SCOPE, 'WHOLE_BUSINESS_MODEL_V1', { current_business_reality: current, governing_constraint: constraint, causal_model: fixture.business.whole_business_model.causal_model, assets: fixture.business.whole_business_model.assets, vulnerabilities: fixture.business.whole_business_model.vulnerabilities, open_questions: fixture.business.whole_business_model.open_questions }, fixture.business.whole_business_model.state_hash, {
    bindings: { ba_hash: ba.content_hash, fusion_hash: fusion.content_hash },
    domainBoundary: { business_causes: 'BUSINESS_EVIDENCE_ONLY', whole_person_role: 'EXECUTION_FEASIBILITY_ONLY', source: 'SEALED_AUTHORIZED_PSEUDONYMOUS_SNAPSHOT', writes: 'LOCAL_DEMO_SCOPE_ONLY' },
  });
  const futures = internalArtifact(PATRICIA_DEMO_SCOPE, 'FIVE_FUTURES_V2', { trajectories: fixture.futures.futures.map((future) => ({ role: future.future_role, relative_support_weight: future.normalized_relative_support_weight, meaning: future.business_state_if_realized, conditional: true, certainty: future.certainty_support_classification })) }, fixture.futures.artifact_hash, { bindings: { wbm_hash: wbm.content_hash } });
  const move = internalArtifact(PATRICIA_DEMO_SCOPE, 'ONE_MOVE_V2', { selected: true, mechanism_id: fixture.one_move.primary_mechanism_ids?.[0] || fixture.one_move.governing_constraint_id, title: fixture.one_move.title, intervention: fixture.one_move.intervention, why_now: fixture.one_move.why_now, proof: fixture.one_move.success_evidence, falsifiers: fixture.one_move.falsifiers }, fixture.one_move.artifact_hash, { bindings: { wbm_hash: wbm.content_hash, five_futures_hash: futures.content_hash } });
  const plan = internalArtifact(PATRICIA_DEMO_SCOPE, 'PLAN_135', { goal: fixture.plan.goal, ways: [{ title: fixture.plan.way, strategies: fixture.plan.strategies }, { title: null, strategies: [] }, { title: null, strategies: [] }], honest_state: 'One fixture-grounded way is complete. Additional ways remain open.' }, hashCanonicalJson(fixture.plan), { bindings: { one_move_hash: move.content_hash, wbm_hash: wbm.content_hash } });
  const evidence = internalArtifact(PATRICIA_DEMO_SCOPE, 'EVIDENCE_LEDGER', { known: fixture.evidence.known, inferred: fixture.evidence.inferred, missing: fixture.evidence.missing, contradicted: fixture.evidence.contradicted }, hashCanonicalJson(fixture.evidence), { bindings: { ba_hash: ba.content_hash, wbm_hash: wbm.content_hash } });
  return [bos, ba, fusion, wbm, futures, move, plan, evidence];
}

function patriciaDemoViewModel(fixture) {
  const source = buildSyntheticGeneralizationCandidate('top');
  const template = createBaProgressiveDisclosureV1({
    sourceViewModel: source.viewModel,
    bindings: { subjectKey: 'S2_PATRICIA_DERIVED_TEMPLATE', modelDate: 'Sealed demo snapshot', verticalAuthorityRefs: ['SEALED_AUTHORIZED_SNAPSHOT'], sourceAuthority: 'PATRICIA_TEST_A_FROZEN' },
  }).customerViewModel;
  const view = clone(createSyntheticRealEstateFounderViewModelV1(template, 're-mid'));
  const current = fixture.business.vertical_reality.current_business_reality;
  const constraint = fixture.business.whole_business_model.governing_constraint;
  const known = list(fixture.evidence.known).map(statement);
  const missing = list(fixture.evidence.missing).map(statement);
  const contradicted = list(fixture.evidence.contradicted).map(statement);
  const futures = fixture.futures.futures;
  const move = fixture.one_move;
  view.identity = { firstName: fixture.preferred_name, business: 'Patricia-derived sealed demo business', vertical: 'Real Estate' };
  view.hero = { eyebrow: `${fixture.preferred_name}’s Business Twin`, title: 'A real-world business snapshot in an isolated demo relationship.', subtitle: 'One sealed source snapshot. One evolving demo-only relationship. No live-customer write path.', modelDate: 'Patricia-derived authorized snapshot · demo-only copy' };
  Object.assign(view.layer0.cards.find((card) => card.id === 'where'), { value: 'Current', qualifier: 'Sealed business snapshot', description: current.summary, details: [{ value: 'Relationship-led', label: 'Opportunity base', epistemicClass: 'REPORTED' }, { value: 'Leader-centered', label: 'Execution pattern', epistemicClass: 'INFERRED' }, { value: 'Open', label: 'Current market context', epistemicClass: 'MISSING' }] });
  Object.assign(view.layer0.cards.find((card) => card.id === 'futures'), { value: `${Math.max(...futures.map((item) => item.normalized_relative_support_weight))}%`, qualifier: 'Highest relative support', items: futures.map((item) => ({ label: item.title, probability: item.normalized_relative_support_weight })) });
  Object.assign(view.layer0.cards.find((card) => card.id === 'move'), { value: move.title, qualifier: move.intervention });
  Object.assign(view.layer0.cards.find((card) => card.id === 'plan'), { value: 'One governed way. Two honest openings.', qualifier: fixture.plan.way });
  Object.assign(view.layer0.cards.find((card) => card.id === 'evidence'), { value: `${known.length} governed claims`, qualifier: `${missing.length} missing · ${contradicted.length} contradicted`, items: [{ value: known.length, label: 'Things represented' }, { value: missing.length, label: 'Things still missing' }, { value: contradicted.length, label: 'Contradictions held open' }] });
  view.layer0.bigPicture = current.summary;
  view.layer0.bigPictureQualifier = constraint.candidate;
  view.layer0.nextStep = move.title;
  view.layer0.nextStepQualifier = move.intervention;
  view.destinations.where.subhead = current.summary;
  view.destinations.where.headline = `${fixture.preferred_name}’s current real-estate business snapshot.`;
  view.destinations.where.metrics = [
    { title: 'Opportunity engine', value: 'Relationship-led', qualifier: 'Customer-reported snapshot', tone: 'green', objectId: 'where-metric-1' },
    { title: 'Operating ownership', value: 'Leader-centered', qualifier: 'Supported hypothesis', tone: 'amber', objectId: 'where-metric-2' },
    { title: 'Financial bridge', value: 'Unreconciled', qualifier: 'Material open evidence', tone: 'violet', objectId: 'where-metric-3' },
    { title: 'Current market context', value: 'Missing', qualifier: 'Research when purpose requires it', tone: 'teal', objectId: 'where-metric-4' },
  ];
  view.destinations.where.pathway.today = view.destinations.where.metrics.map((item, index) => ({ ...item, objectId: `where-today-${index + 1}` }));
  view.destinations.where.pathway.goal = [{ title: 'Desired business', value: 'More transferable', qualifier: fixture.plan.goal, tone: 'indigo', objectId: 'where-goal-1' }];
  view.destinations.where.pathway.required = [{ title: 'Bounded ownership proof', value: 'One workflow', qualifier: move.intervention, tone: 'violet', objectId: 'where-required-1' }];
  view.destinations.where.realities = [{ title: 'Relationship asset', text: known[0] || current.summary, tone: 'green', objectId: 'where-reality-1' }, { title: 'Leader-centered system', text: constraint.candidate, tone: 'amber', objectId: 'where-reality-2' }, { title: 'Evidence before expansion', text: constraint.falsifier, tone: 'violet', objectId: 'where-reality-3' }];
  view.destinations.where.gap = `The gap is the distance between the desired transferable business and the current leader-centered system, while material demand, market, and economic evidence remains open.`;
  view.destinations.futures.items = futures.map((future) => ({ role: future.future_role, label: future.title, meaning: future.state_summary, title: future.title, probability: future.normalized_relative_support_weight, confidence: future.certainty_support_classification, summary: future.business_state_if_realized, condition: future.conditionality, keyCharacteristics: future.leading_indicators.slice(0, 4), supporting: future.supporting_evidence_refs.slice(0, 4), opposing: future.counterevidence_refs.slice(0, 4), missing, falsifiers: future.falsifiers, objectId: `future-${future.future_role}` }));
  view.destinations.futures.ifMoveWorks = futures.map((future) => ({ role: future.future_role, label: future.title, probability: future.normalized_relative_support_weight }));
  view.destinations.move.headline = move.title; view.destinations.move.subhead = move.intervention;
  view.destinations.move.logic = [{ label: 'Current constraint hypothesis', value: constraint.candidate, description: constraint.why_current_candidate_stronger, tone: 'amber', objectId: 'move-logic-1' }, { label: 'Alternatives still open', value: 'Demand, economics, and market', description: constraint.alternatives.map((item) => item.explanation).join(' '), tone: 'violet', objectId: 'move-logic-2' }, { label: 'The move', value: move.title, description: move.intervention, tone: 'amber', objectId: 'move-logic-3' }, { label: 'What would change the view', value: 'Observed transfer evidence', description: constraint.falsifier, tone: 'blue', objectId: 'move-logic-4' }];
  view.destinations.move.proof = move.success_evidence.slice(0, 4).map((label, index) => ({ label, objectId: `move-proof-${index + 1}` }));
  view.destinations.move.startHere = { text: move.bounded_execution_steps[0], qualifier: move.why_now, objectId: 'move-start-here' };
  view.destinations.plan.headline = fixture.plan.goal; view.destinations.plan.subhead = 'One sealed-snapshot way. Two openings for future demo-authorized learning.';
  view.destinations.plan.goal = { title: fixture.plan.goal, monthly: 'Current', monthlyLabel: 'governed direction', annual: 'Future', annualLabel: 'transferable business', horizon: 'Demo relationship horizon', classification: 'REPORTED' };
  view.destinations.plan.ways = [{ status: 'SELECTED_COMPLETE', title: fixture.plan.way, destinationState: fixture.plan.goal, whyPriority: constraint.candidate }, { status: 'OPEN', title: null, destinationState: null, whyPriority: null }, { status: 'OPEN', title: null, destinationState: null, whyPriority: null }];
  view.destinations.plan.strategies = fixture.plan.strategies.map((title, index) => ({ order: index + 1, mission: `PATRICIA_DEMO_STRATEGY_${index + 1}`, title, headline: title, description: title, supportingText: title, flow: [], target: null, firstAction: title, cadence: 'Review through the demo coaching relationship.', observationWindow: 'Bounded demo period.', scorecard: move.leading_indicators.slice(0, 4), proof: move.success_evidence, stopConditions: move.stop_or_reconsider_conditions, confidence: 'Fixture-grounded bounded action.', objectId: `plan-strategy-${index + 1}` }));
  view.destinations.plan.oneMove = { status: 'ALONGSIDE_PLAN_NOT_A_STRATEGY', title: move.title, intervention: move.intervention, whyAlongside: move.why_now, proofBoundary: constraint.falsifier };
  const ledger = [...known.slice(0, 12).map((reality, index) => ({ id: `known-${index + 1}`, reality, value: 'Sealed governed snapshot', basis: 'Authorized pseudonymous fixture', status: 'REPORTED', confidence: 'Known in snapshot', objectId: `evidence-row-${index + 1}` })), ...missing.slice(0, 6).map((reality, index) => ({ id: `missing-${index + 1}`, reality, value: 'Not yet known', basis: 'Material evidence gap', status: 'MISSING', confidence: 'Open', objectId: `evidence-row-${known.length + index + 1}` }))];
  view.destinations.evidence.ledger = ledger;
  view.destinations.evidence.highestValueMissing = missing;
  view.destinations.evidence.counterevidence = constraint.alternatives.map((item) => item.explanation);
  view.destinations.evidence.mindChanges = [constraint.falsifier];
  view.destinations.evidence.truthColumns = [{ label: 'Factual reality', title: 'What the sealed snapshot reports', items: known.slice(0, 8) }, { label: 'Interpreted reality', title: 'What may be happening', items: [constraint.candidate] }, { label: 'Open questions', title: 'What remains unknown', items: missing }];
  view.destinations.evidence.categories = [{ id: 'known', label: 'What we know', value: known.length, summary: 'Authorized sealed-snapshot claims.', objectId: 'evidence-summary-known' }, { id: 'inferred', label: 'What may be happening', value: 1, summary: 'Supported constraint hypothesis.', objectId: 'evidence-summary-inferred' }, { id: 'missing', label: 'What would sharpen the map', value: missing.length, summary: 'Material evidence gaps.', objectId: 'evidence-summary-missing' }, { id: 'uncertain', label: 'Contradictions held open', value: contradicted.length, summary: 'No forced reconciliation.', objectId: 'evidence-summary-uncertain' }];
  view.livingMap = { headline: 'This demo relationship can evolve without touching live Patricia.', copy: 'Confirmed demo-only changes publish only inside the isolated local scope.', action: 'See the demo boundary', active: true };
  for (const object of Object.values(view.objects)) object.drawer_payload = [{ id: 'known', title: 'What the sealed demo knows', items: known.slice(0, 4) }, { id: 'meaning', title: 'What this may mean', items: [constraint.candidate] }, { id: 'counterevidence', title: 'Alternatives', items: constraint.alternatives.map((item) => item.explanation) }, { id: 'missing', title: 'What remains open', items: missing.slice(0, 4) }, { id: 'mind-change', title: 'What would change the view', items: [constraint.falsifier] }];
  return view;
}

function relationshipContext(fixture, sessionKind) {
  return {
    session_kind: sessionKind,
    preferred_conversational_name: fixture.preferred_name,
    preferred_name_authority: 'SEALED_AUTHORIZED_PSEUDONYMOUS_DEMO_FIXTURE',
    mission: sessionKind === 'FIRST_EVER' ? 'Begin a continuing demo coaching relationship from the sealed governed snapshot without interrogating or exposing private source detail.' : 'Continue from the isolated demo Personal RSL, attempts, outcomes, open loops, and the current demo Business Twin.',
    bos_validation: { status: sessionKind === 'FIRST_EVER' ? 'NOT_YET_COMPLETED' : 'ESTABLISHED', repeat_weekly: false, reassessment_allowed: false },
    dj_domain_prior: { availability: 'STRONG_PURPOSE_RETRIEVED_STARTING_PRIOR', fixed_weight: false, scripts: false, mimicry: false, customer_outcomes_override_when_governed: true },
    privacy_boundary: 'Understand from the sealed authorized snapshot. Do not expose raw sensitive source details.',
    demo_boundary: 'Every durable write is isolated to the demo scope; there is no actual Patricia identifier or write path.',
  };
}

export async function loadPatriciaDerivedDemoSubscriber({ redis, relationship_key, subject_key, session_id, session_kind, coaching_episode_phase = 'ACTIVE', session_temporal_context = null, initial_conversation = [], env = globalThis.process?.env || {}, transport = null, now = () => new Date().toISOString() }) {
  if (subject_key !== PATRICIA_DEMO_SUBJECT_KEY || relationship_key !== PATRICIA_DEMO_RELATIONSHIP_KEY) throw new Error('SUBSCRIPTION_S2_PATRICIA_DEMO_SCOPE_DENIED');
  if (!/^session_[a-f0-9]{24}$/u.test(session_id || '')) throw new Error('SUBSCRIPTION_S2_PATRICIA_DEMO_SESSION_BINDING_INVALID');
  const fixture = readSealedFixture();
  const keys = internalDevKeys({ relationship_key, subject_key });
  const store = await RedisLivingRelationshipStore.open({ redis, keys });
  const baseViewModel = patriciaDemoViewModel(fixture);
  const artifacts = canonicalArtifacts(fixture);
  const initial = createInitialLivingBusinessTwinPublication({ scope: PATRICIA_DEMO_SCOPE, artifact_lineage: artifacts.map(({ artifact_type, content_hash }) => ({ artifact_type, content_hash })), initial_state: initialLivingStateFromBusinessTwin(baseViewModel), published_at: '2026-08-30T00:00:00.000Z' });
  if (!initial.ok) throw new Error(initial.code);
  if (!store.readCurrent({ scope: PATRICIA_DEMO_SCOPE }).ok) {
    const initialized = await store.initialize({ scope: PATRICIA_DEMO_SCOPE, publication: initial.publication });
    if (!initialized.ok) throw new Error(initialized.code);
  }
  const providerTransport = transport || createSubscriptionLiveDemoOpenAiTransport({ apiKey: env.OPENAI_API_KEY, timeoutMs: 300_000, maxTransportRetries: 1 });
  const clock = now;
  const conversationSeam = createFrontierConversationSeamV2({ transport: providerTransport, enabled: true, now: clock });
  const sessionCloseSeam = createSessionCloseSeamV1({ transport: providerTransport, enabled: true, now: clock });
  const candidateExtractor = createPostResponseCandidateExtractorV1({ transport: providerTransport, enabled: true, now: clock });
  const authorizationInterpreter = createNaturalAuthorizationInterpreterV1({ transport: providerTransport, enabled: true, now: clock });
  const currentSnapshot = store.snapshot();
  const currentPublication = currentSnapshot.publications?.[currentSnapshot.current_publication_hash] || null;
  const pendingProposal = Object.values(currentSnapshot.proposals || {}).filter((entry) => entry?.workflow_status === 'AWAITING_CUSTOMER_DECISION' && entry?.proposal?.expected_prior_publication_hash === currentSnapshot.current_publication_hash && entry?.proposal?.expected_prior_publication_version === currentPublication?.publication_version).sort((left, right) => String(right.persisted_at).localeCompare(String(left.persisted_at)))[0]?.proposal?.proposal_id || null;
  const externalEvidence = await readExternalEvidence({ redis, key: keys.research });
  const runtime = createFreeGptLivingRelationshipRuntimeV2({
    scope: PATRICIA_DEMO_SCOPE,
    session_id,
    store,
    conversation_seam: conversationSeam,
    session_close_seam: sessionCloseSeam,
    candidate_extractor: candidateExtractor,
    authorization_interpreter: authorizationInterpreter,
    doctrine_retrieval: retrieveCoachingDoctrine({ purpose: session_kind === 'FIRST_EVER' ? 'ONBOARDING' : 'WEEKLY_COACHING', vertical_id: null }),
    canonical_artifacts: artifacts,
    business_truth: [createEvidenceReference({ evidence_id: 'patricia_derived_demo_business_snapshot', evidence_domain: 'BUSINESS', content_hash: fixture.source_snapshot_sha256, certainty: 'KNOWN' })],
    whole_person_execution_context: [createEvidenceReference({ evidence_id: 'patricia_derived_demo_bos_authority', evidence_domain: 'WHOLE_PERSON_EXECUTION', content_hash: fixture.whole_person.governed_bos_authority.contract_sha256, certainty: 'KNOWN' })],
    external_evidence: externalEvidence,
    relationship_context: relationshipContext(fixture, session_kind),
    coaching_session: createCoachingEpisodeContext({ phase: coaching_episode_phase, preferred_conversational_name: fixture.preferred_name, session_kind }),
    session_temporal_context,
    initial_conversation,
    initial_pending_proposal_id: pendingProposal,
    clock,
  });
  const assembled = runtime.assemble({ visible_customer_context: { surface: 'Overview', visible_objects: ['Where You Are', 'Five Possible Futures', 'Your One Move', 'Your Plan', 'Evidence'] }, as_of_at: clock() });
  if (!assembled.ok) throw new Error(assembled.code);
  const controller = createLivingConversationController({ runtime, store, scope: PATRICIA_DEMO_SCOPE, base_view_model: baseViewModel, evidence_catalog: [] });
  const current = controller.current();
  if (!current.ok) throw new Error(current.code || 'SUBSCRIPTION_S2_PATRICIA_DEMO_CURRENT_STATE_UNAVAILABLE');
  const understanding = controller.wholeUnderstandingPacket();
  return {
    controller,
    store,
    keys,
    scope: PATRICIA_DEMO_SCOPE,
    baseViewModel,
    current,
    identity: { first_name: fixture.preferred_name, vertical: 'Real Estate', synthetic_only: false, demo_copy_only: true, demo_subject: 'PATRICIA_DERIVED' },
    relationship_context: relationshipContext(fixture, session_kind),
    current_profile_key: PATRICIA_DEMO_SUBJECT_KEY,
    fixture: { sealed_authorized_snapshot: true, fixture_sha256: fixture.fixture_sha256, fixture_file_sha256: PATRICIA_DEMO_FIXTURE_FILE_SHA256, source_snapshot_sha256: fixture.source_snapshot_sha256, real_customer_data: false, actual_patricia_write_path: false, local_demo_writes: true },
    architecture: { loader_id: 'subscription_s2_patricia_derived_writable_demo_loader_v1', subject_key, exact_scope_hash: understanding?.scope_hash || null, required_artifact_types: understanding?.artifact_manifest?.map?.((item) => item.artifact_type) || [], free_gpt_v2: true, afw05_core_reused: true, demo_only: true, actual_patricia_write_path: false, isolated_persistence_keys: clone(keys), fixture_sha256: fixture.fixture_sha256 },
  };
}

export function provePatriciaDemoStorageIsolation() {
  const keys = internalDevKeys({ relationship_key: PATRICIA_DEMO_RELATIONSHIP_KEY, subject_key: PATRICIA_DEMO_SUBJECT_KEY });
  const serialized = JSON.stringify({ scope: PATRICIA_DEMO_SCOPE, keys });
  const denied = ['mm-20260708-dsst020z', 'PATRICIA_TEST_A_PROFILE', 'PATRICIA_TEST_A_ASSESSMENT', 'ba-20260714-64ca0783'];
  return Object.freeze({
    ok: denied.every((value) => !serialized.toLowerCase().includes(value.toLowerCase())),
    contract: 'SUBSCRIPTION_S2_PATRICIA_DERIVED_DEMO_STORAGE_ISOLATION_PROOF_V1',
    demo_subject_key: PATRICIA_DEMO_SUBJECT_KEY,
    demo_relationship_key_hash: hashCanonicalJson(PATRICIA_DEMO_RELATIONSHIP_KEY),
    demo_scope_hash: hashCanonicalJson(PATRICIA_DEMO_SCOPE),
    demo_storage_keys_hash: hashCanonicalJson(keys),
    actual_patricia_identifiers_present_in_write_scope_or_keys: false,
    actual_patricia_write_path: false,
  });
}
