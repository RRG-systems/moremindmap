import fs from 'node:fs';
import crypto from 'node:crypto';
import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import {
  assertAthletePresentationSafePayloadV1,
  compileAthleteSharedContextV1,
  createAthleteDomainAdapterV1,
  createAthleteLivingConsultOneShotRuntimeV1,
  createAthleteLivingRelationshipScopeV1,
  createAthletePostResponseCandidateExtractorV1,
  createAthleteSharedContextGrantV1,
  createInitialAthleteLivingMapPublicationV1,
} from '../../../src/lib/athleteLivingConsultOneShotV1/index.js';
import {
  createFrontierConversationSeamV2,
  createSessionCloseSeamV1,
} from '../../../src/lib/subscriptionV1/freeGptV2/providerSeams.js';
import { createSubscriptionS2OpenAiTransport } from '../subscriptionS2/openAiTransport.js';
import { createAthleteConsultDemoFixtureV1 } from './demoFixtures.js';
import { createAthleteS2GuRuntimeV1 } from './athleteGuRuntime.js';

const MIKA_BOS_ARTIFACT_URL = new URL(
  './fixtures/mika-bos-v1.json',
  import.meta.url,
);
const MIKA_BOS_ARTIFACT_SHA256 = '21dad9299058dbdaa935bc89e66a0d3126d9c845c18b599bfa6afda3cd1ce6d0';
const MIKA_BOS_ARTIFACT_BYTES = fs.readFileSync(MIKA_BOS_ARTIFACT_URL);
if (crypto.createHash('sha256').update(MIKA_BOS_ARTIFACT_BYTES).digest('hex') !== MIKA_BOS_ARTIFACT_SHA256) {
  throw new TypeError('ATHLETE_LIVING_CONSULT_BOS_SOURCE_HASH_MISMATCH');
}
const FIXED_CREATED_AT = '2026-09-05T22:00:00.000Z';
const clone = (value) => JSON.parse(JSON.stringify(value));

export const ATHLETE_LIVING_CONSULT_COACHING_MISSION_V1 = `Fully read and understand the governed athlete, current performance reality, relationship history, coaching intelligence, and present moment before responding.

Talk naturally as MORE's shared Athlete advisor. Help the athlete and instructor think, self-discover, learn, decide, plan, and follow through. Use source-bound Athlete evidence for performance claims. Use whole-person understanding for communication and feasible action without treating personality as a performance cause. Preserve uncertainty. Ask when you need to know more. Never claim a durable change occurred unless both humans actually approved it.

Think deeply. Speak simply without being childish. Help the humans think better. Use questions naturally when a question creates useful self-discovery.

Use the complete authorized governed reality to understand deeply. Do not expose sensitive source details. Do not invent facts.

Take gentle responsibility for helping the session move somewhere useful. Understand where the athlete wants to go, where reality stands now, what happened since the last session, and what matters today. The session has structure; the conversation has freedom. MORE owns the arc; the humans own their decisions. Use the governed preferred name naturally near a new substantive opening. Use elapsed time, commitments, attempts, outcomes, misses, progress, and course correction only when useful. A missed commitment is information before it is a discipline problem.

Keep athlete report, instructor observation, qualified record, model inference, contradiction, and missingness distinct. The instructor remains the human coach. Do not rank, select, diagnose, prescribe medically, or predict an athletic future.`;

export const ATHLETE_LIVING_CONSULT_COACHING_DEMONSTRATIONS_V1 = Object.freeze([
  Object.freeze({
    situation: 'Source-bound Athlete evidence supports a reasonable possibility, but not a proven cause.',
    human: 'I work harder in training, but late in games I still hesitate.',
    coach: 'One possibility is that more effort is not giving you a clear enough cue when the moment speeds up. That is not a proven cause. What do you notice just before you hesitate?',
  }),
  Object.freeze({
    situation: 'The athlete corrects the advisor’s first interpretation.',
    human: 'That is not quite it. I see the play. I worry that making the aggressive choice will let the team down.',
    coach: 'That changes my understanding. Reading the play may not be the problem; trusting your choice may be. Which game moment would be safe enough to test that?',
  }),
  Object.freeze({
    situation: 'A continuing relationship has a jointly approved prior attempt and a source-bound observed outcome.',
    human: 'What should we work on today?',
    coach: 'The breath cue helped you reset in two of the four moments you tried it, and the other two are still unclear. What was different in the moments when it helped?',
  }),
]);

export const ATHLETE_LIVING_CONSULT_CUSTOMER_EXPRESSION_V1 = `Let the humans experience the coaching point, not a case file. Use governed intelligence silently. Unless they ask for detailed analysis or evidence, do not lead with a dashboard, state inventory, evidence replay, retrieval explanation, or reconstructed session report. Speak from relationship continuity, not about memory machinery. Say the smallest useful thing that helps them think, then continue with one clear question when a question helps.`;

const ATHLETE_DOMAIN_INSTRUCTION = `The governed domain is ATHLETE, ages 18–20, with fictional data only. Help the athlete and instructor think together about chosen direction, current sport reality, preparation, capacity, shared experiments, attempts, outcomes, and learning. Preserve athlete agency and who said what. A model suggestion is not a shared decision; athlete and instructor approval is required downstream.`;

function text(value) {
  return typeof value === 'string' ? value : '';
}

function textList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : [];
}

function safeClaim(claim) {
  return {
    id: text(claim?.id),
    statement: text(claim?.statement),
    layer: text(claim?.layer),
    confidence: text(claim?.confidence),
    counterEvidenceIds: textList(claim?.counterEvidenceIds),
    alternatives: textList(claim?.alternatives),
    confounds: textList(claim?.confounds),
    whatWouldChangeIt: text(claim?.whatWouldChangeIt || claim?.what_would_change_it),
  };
}

function safeDifference(difference) {
  return {
    id: text(difference?.id),
    statement: text(difference?.statement || difference?.summary || difference?.description),
    resolved: difference?.resolved === true,
  };
}

function safeDynamic(dynamic) {
  return {
    id: text(dynamic?.id),
    triggerOrContext: text(dynamic?.triggerOrContext),
    responseOrAction: text(dynamic?.responseOrAction),
    immediateUse: text(dynamic?.immediateUse),
    possibleDelayedCost: text(dynamic?.possibleDelayedCost),
    confounders: textList(dynamic?.confounders),
    confidence: text(dynamic?.confidence),
    falsifier: text(dynamic?.falsifier),
  };
}

function safeResolvedTruth(value) {
  const truth = value && typeof value === 'object' ? value : {};
  return {
    resolved_claims: Array.isArray(truth.resolved_claims) ? truth.resolved_claims.map(safeClaim) : [],
    unknowns: textList(truth.unknowns),
    abstentions: textList(truth.abstentions),
    contradictions: Array.isArray(truth.contradictions) ? truth.contradictions.map(safeDifference) : [],
  };
}

function safeSurface(packet) {
  return {
    surface_id: text(packet?.surface_id),
    surface_number: Number(packet?.surface_number || 0),
    label: text(packet?.label),
    editorial_headline: text(packet?.editorial_headline),
    primary_realization: text(packet?.primary_realization),
    destination: text(packet?.destination),
    local_mission: text(packet?.local_mission),
    claim_refs: textList(packet?.claim_refs),
    causal_refs: textList(packet?.causal_refs),
    unknowns: textList(packet?.unknowns),
    communication_contract: text(packet?.communication_contract),
    human_realization: {
      version: text(packet?.human_realization?.version),
      surface_id: text(packet?.human_realization?.surface_id),
      customer_prose: text(packet?.human_realization?.customer_prose),
      governed_evidence_refs: textList(packet?.human_realization?.governed_evidence_refs),
    },
    rendering: clone(packet?.rendering || {}),
    resolved_local_truth: safeResolvedTruth(packet?.resolved_local_truth),
  };
}

export function createPresentationSafeAthleteBosProjectionV1(rawArtifact, { subject_id } = {}) {
  if (rawArtifact?.identity_context?.subject_token !== subject_id
    || rawArtifact?.identity_context?.age_band !== '18–20'
    || rawArtifact?.identity_context?.fictional !== true) {
    throw new TypeError('ATHLETE_LIVING_CONSULT_BOS_SOURCE_INVALID');
  }
  const whole = rawArtifact.whole_person_model || {};
  const plan = rawArtifact.plan || {};
  const projection = {
    contract: 'athlete_bos_presentation_safe_shared_projection_v1',
    architecture: text(rawArtifact.architecture),
    identity: text(rawArtifact.identity),
    sourceHash: text(rawArtifact.sourceHash),
    audience: 'athlete-and-instructor-with-explicit-athlete-grant',
    createdAt: text(rawArtifact.createdAt),
    identity_context: clone(rawArtifact.identity_context),
    subject: clone(rawArtifact.subject),
    whole_person_model: {
      version: text(whole.version),
      core_explanation: text(whole.core_explanation),
      central_tension: text(whole.central_tension),
      pressure_and_recovery: clone(whole.pressure_and_recovery || {}),
      work_and_relationships: clone(whole.work_and_relationships || {}),
      identity_distillation: text(whole.identity_distillation),
      uncertainty: textList(whole.uncertainty),
    },
    athlete_map: clone(rawArtifact.athlete_map || {}),
    plan: {
      title: text(plan.title),
      recognition: text(plan.recognition),
      lifeHopes: clone(plan.lifeHopes || []),
      goals: clone(plan.goals || []),
      claims: Array.isArray(plan.claims) ? plan.claims.map(safeClaim) : [],
      causal_dynamics: Array.isArray(plan.causal_dynamics) ? plan.causal_dynamics.map(safeDynamic) : [],
      sequences: clone(plan.sequences || []),
      strengths_and_overuse: clone(plan.strengths_and_overuse || []),
      compensations: clone(plan.compensations || []),
      contradictions: Array.isArray(plan.contradictions) ? plan.contradictions.map(safeDifference) : [],
      domains: clone(plan.domains || []),
      athlete_map: clone(plan.athlete_map || rawArtifact.athlete_map || {}),
      life_direction_futures_disposition: clone(plan.life_direction_futures_disposition || {}),
      futures: clone(plan.futures || []),
      move: clone(plan.move || null),
      unknowns: textList(plan.unknowns),
      surface_routes: clone(plan.surface_routes || []),
    },
    surface_packets: (rawArtifact.surface_packets || []).map(safeSurface),
    chapters: [],
    status: 'PRESENTATION_SAFE_SHARED_PROJECTION',
  };
  assertAthletePresentationSafePayloadV1(projection);
  if (JSON.stringify(projection).includes('business_id')) throw new TypeError('ATHLETE_IDENTITY_SHORTCUT_DENIED');
  return Object.freeze(projection);
}

export function createPresentationSafeMikaBosProjectionV1(rawArtifact) {
  return createPresentationSafeAthleteBosProjectionV1(rawArtifact, { subject_id: 'synthetic-athlete-parity' });
}

function sourceBindings({ fixture, bosProjection, apaViewModel }) {
  return {
    bos: Object.freeze({
      source_kind: 'ATHLETE_BOS',
      artifact_id: fixture.bosArtifactId,
      artifact_version: '1.0.0-synthetic-shared',
      content_hash: hashCanonicalJson(bosProjection),
    }),
    apa: Object.freeze({
      source_kind: 'ATHLETE_APA',
      artifact_id: fixture.apaArtifactId,
      artifact_version: '1.0.0-synthetic-parity',
      content_hash: hashCanonicalJson(apaViewModel),
    }),
  };
}

function sharedCatalog({ fixture, bindings, bosProjection }) {
  const apaViewObjects = Object.values(fixture.apaViewModel.objects || {});
  const apa = fixture.apaClaims.map((claim) => ({
    object_id: `apa:claim:${claim.id.toLowerCase()}`,
    source_binding: bindings.apa,
    source_class: claim.sourceClass,
    epistemic_status: claim.epistemicStatus,
    presentation: {
      title: claim.topic.replaceAll('_', ' '),
      summary: claim.statement,
      uncertainty: claim.confidence === 'BOUNDED_INFERENCE' ? 'This is a bounded interpretation, not a settled cause.' : 'This keeps the original speaker and source class.',
    },
    evidence_refs: [`athlete-apa-${claim.id.toLowerCase()}`],
    observed_at: claim.eventTime ? new Date(claim.eventTime).toISOString() : fixture.apaFixture.asOf,
    presentation_safe: true,
    page_context_refs: [...new Set(apaViewObjects
      .filter((object) => object.object_id?.toLowerCase().includes(`-${claim.id.toLowerCase()}`)
        || JSON.stringify(object.drawer_payload || []).includes(claim.questionId))
      .flatMap((object) => [object.object_id, `layer0-${object.destination}`]))].sort(),
  }));
  const open = [
    ...fixture.apaOpenEvidence.contradictions.map((item) => ({ ...item, epistemic: 'CONTRADICTED' })),
    ...fixture.apaOpenEvidence.missing.map((item) => ({ ...item, epistemic: 'MISSING' })),
  ].map((item) => ({
    object_id: `apa:open:${item.id.toLowerCase()}`,
    source_binding: bindings.apa,
    source_class: 'MISSING',
    epistemic_status: item.epistemic,
    presentation: { title: item.topic.replaceAll('_', ' '), summary: item.statement, uncertainty: 'This stays open until accepted source-bound evidence changes it.' },
    evidence_refs: [`athlete-apa-${item.id.toLowerCase()}`],
    observed_at: fixture.apaFixture.asOf,
    presentation_safe: true,
    page_context_refs: [
      'layer0-evidence',
      ...apaViewObjects.filter((object) => object.destination === 'evidence').map((object) => object.object_id),
    ].sort(),
  }));
  const bos = bosProjection.surface_packets.map((packet) => ({
    object_id: `bos:surface:${packet.surface_id.replaceAll('_', '-')}`,
    source_binding: bindings.bos,
    source_class: 'ATHLETE_SELF_REPORT',
    epistemic_status: 'REPORTED',
    presentation: {
      title: packet.rendering.headline || packet.editorial_headline || packet.label,
      summary: packet.primary_realization || packet.rendering.summary || packet.human_realization.customer_prose,
      uncertainty: packet.resolved_local_truth.unknowns[0] || packet.resolved_local_truth.abstentions[0] || 'This Athlete-authorized projection remains open to correction.',
    },
    evidence_refs: packet.human_realization.governed_evidence_refs.map((id) => `athlete-bos-${id.toLowerCase()}`),
    observed_at: bosProjection.createdAt,
    presentation_safe: true,
    page_context_refs: [packet.surface_id],
  }));
  return Object.freeze([...apa, ...open, ...bos]);
}

function initialMapState(fixture) {
  const view = fixture.apaViewModel;
  return {
    athlete_current_reality: {
      summary: view.layer0.bigPicture,
      sport: view.destinations.where.domains.find((item) => item.label === 'SPORT')?.summary || view.destinations.where.domains[0]?.summary,
      training: view.destinations.where.domains.find((item) => item.label === 'TRAINING')?.summary || view.destinations.where.domains[1]?.summary,
      warrior_mentality: view.destinations.where.domains.find((item) => item.label === 'WARRIOR MENTALITY')?.summary || view.destinations.where.domains[2]?.summary,
      unresolved: view.destinations.where.openReality.text,
    },
    athlete_futures: { paths: view.destinations.futures.items.map((item) => ({ label: item.label, meaning: item.meaning, confidence: item.confidence })) },
    athlete_one_move: { proposal: view.destinations.move.headline, status: 'PROPOSED_NOT_ACCEPTED' },
    athlete_plan: { intervention: null, open_loop_state: 'UNRESOLVED' },
    athlete_evidence: { confidence: 'BOUNDED', highest_value_missing: clone(view.destinations.evidence.highestValueMissing) },
  };
}

function providerSeams({ apiKey, clock }) {
  if (!apiKey) return { coach: null, candidate: null, close: null, gu: null, provider_status: 'NOT_CONFIGURED_NO_PROVIDER_CALL' };
  const zeroToolTransport = createSubscriptionS2OpenAiTransport({ apiKey, timeoutMs: 300_000, maxTransportRetries: 1 });
  const transport = async (request, context) => {
    const response = await zeroToolTransport(request, context);
    const provider = response.receipt || {};
    return {
      output: response.output,
      usage: {
        input_tokens: provider.input_tokens || 0,
        cached_input_tokens: provider.cached_input_tokens || 0,
        output_tokens: provider.output_tokens || 0,
      },
      latency_ms: provider.latency_ms || 0,
      attempt_count: provider.attempt_count || 1,
      estimated_cost_microusd: 0,
      web_search_calls: 0,
      external_evidence: [],
      raw_request_persisted: false,
      raw_response_persisted: false,
    };
  };
  const gu = createAthleteS2GuRuntimeV1({ transport: zeroToolTransport });
  return {
    coach: createFrontierConversationSeamV2({
      transport,
      enabled: true,
      now: clock,
      domain_instruction: ATHLETE_DOMAIN_INSTRUCTION,
      web_search_enabled: false,
      coaching_mission: ATHLETE_LIVING_CONSULT_COACHING_MISSION_V1,
      coaching_demonstrations: ATHLETE_LIVING_CONSULT_COACHING_DEMONSTRATIONS_V1,
      customer_expression_boundary: ATHLETE_LIVING_CONSULT_CUSTOMER_EXPRESSION_V1,
    }),
    candidate: createAthletePostResponseCandidateExtractorV1({
      transport,
      enabled: true,
      now: clock,
    }),
    close: createSessionCloseSeamV1({
      transport,
      enabled: true,
      now: clock,
      domain_instruction: ATHLETE_DOMAIN_INSTRUCTION,
      coaching_mission: ATHLETE_LIVING_CONSULT_COACHING_MISSION_V1,
      coaching_demonstrations: ATHLETE_LIVING_CONSULT_COACHING_DEMONSTRATIONS_V1,
    }),
    gu,
    provider_status: 'OPENAI_RESPONSES_GPT_5_6_SOL_XHIGH_CONFIGURED',
  };
}

export function createAthleteLivingConsultStructuralQaSeamsV1({
  clock = () => new Date().toISOString(),
} = {}) {
  const structuralReceipt = (stage) => Object.freeze({
    stage,
    provider_called: false,
    structural_qa_only: true,
    captured_at: new Date(clock()).toISOString(),
  });
  const coach = Object.freeze({
    inspect: () => Object.freeze({
      enabled: false,
      structural_qa_only: true,
      provider_status: 'STRUCTURAL_QA_NO_FRONTIER',
      model: null,
      reasoning_effort: null,
      store: false,
      background: false,
    }),
    coach: async ({ packet }) => Object.freeze({
      ok: true,
      code: 'ATHLETE_STRUCTURAL_QA_COACHING_TURN',
      customer_message: `${packet?.provider_understanding?.coaching_session?.preferred_conversational_name || 'Athlete'}, I’m here with both of you. What should we understand together next?`,
      receipt: structuralReceipt('STRUCTURAL_QA_CONVERSATION'),
      mutation_performed: false,
    }),
  });
  const close = Object.freeze({
    inspect: () => Object.freeze({
      enabled: false,
      structural_qa_only: true,
      provider_status: 'STRUCTURAL_QA_NO_FRONTIER',
      mutation_authority: false,
    }),
    close: async ({ packet, mode, alignment_message = null }) => {
      const preferredName = packet?.provider_understanding?.coaching_session?.preferred_conversational_name || 'Athlete';
      const aligned = typeof alignment_message === 'string' && alignment_message.trim() ? alignment_message.trim() : null;
      return Object.freeze({
        ok: true,
        code: mode === 'REQUEST_ALIGNMENT'
          ? 'ATHLETE_STRUCTURAL_QA_CLOSE_ALIGNMENT_REQUESTED'
          : 'ATHLETE_STRUCTURAL_QA_SESSION_LEARNING_READY',
        customer_message: mode === 'REQUEST_ALIGNMENT'
          ? `${preferredName}, does this feel like the right place for the two of you to pause?`
          : `${preferredName}, this is a good place to pause. We’ll pick it up together next time.`,
        session_learning: Object.freeze({
          contract: 'ATHLETE_LIVING_CONSULT_SESSION_LEARNING_V1',
          status: mode === 'REQUEST_ALIGNMENT' ? 'DRAFT_AWAITING_ALIGNMENT' : 'NOTES_READY',
          summary: aligned
            ? `At mutual close, the two humans said: ${aligned}`
            : 'Structural QA verified the mutual-close and continuity mechanics; it did not evaluate frontier coaching quality.',
          what_mattered: aligned || 'No model-derived learning was claimed.',
          what_changed: 'Only explicitly authorized map changes count as changed reality.',
          what_was_learned: 'Structural transport and lifecycle only.',
          what_was_decided: aligned
            ? `At the noncanonical mutual close, the humans aligned on: ${aligned}`
            : 'See exact joint-authority lineage for any approved decision.',
          what_remains_open: 'Any unresolved shared plan remains open.',
          pick_up_next_time: 'Resume from the current shared map and exact lineage.',
          canonical_mutation_performed: false,
          personal_rsl_mutation_performed: false,
          structural_fixture_fallback: true,
        }),
        receipt: structuralReceipt(`STRUCTURAL_QA_SESSION_CLOSE_${mode}`),
        mutation_performed: false,
      });
    },
  });
  return Object.freeze({ coach, close, candidate: null });
}

export async function createAthleteLivingConsultOneShotDemoRuntimeV1({
  env = globalThis.process?.env || {},
  clock = () => new Date().toISOString(),
  fixture_id = 'mika',
  raw_bos_artifact = null,
  coach_seam = undefined,
  candidate_extractor = undefined,
  close_seam = undefined,
  gu_generator = undefined,
  runtime_snapshot = null,
} = {}) {
  const sourceBos = raw_bos_artifact || JSON.parse(MIKA_BOS_ARTIFACT_BYTES.toString('utf8'));
  const fixture = createAthleteConsultDemoFixtureV1(fixture_id, sourceBos);
  const bosProjection = createPresentationSafeAthleteBosProjectionV1(fixture.rawBos, { subject_id: fixture.subject.id });
  const apaViewModel = fixture.apaViewModel;
  const bindings = sourceBindings({ fixture, bosProjection, apaViewModel });
  const catalog = sharedCatalog({ fixture, bindings, bosProjection });
  const scope = createAthleteLivingRelationshipScopeV1({
    subject_id: fixture.subject.id,
    relationship_id: fixture.relationshipId,
    membership_id: fixture.membershipId,
    tenant_id: 'synthetic-athlete-lab',
    athlete_profile_id: fixture.athleteProfileId,
  });
  const adapter = createAthleteDomainAdapterV1({ scope });
  const relationship = Object.freeze({
    relationship_id: scope.relationship_id,
    athlete_actor_id: scope.subject_id,
    instructor_actor_id: fixture.relationship.instructorId,
    synthetic_only: true,
  });
  const createdAt = new Date(clock()).toISOString();
  const initialGrant = createAthleteSharedContextGrantV1({
    scope,
    relationship,
    source_artifact_bindings: [bindings.apa],
    allowed_object_ids: catalog.filter((entry) => entry.source_binding.source_kind === 'ATHLETE_APA').map((entry) => entry.object_id),
    granted_at: createdAt,
    expires_at: new Date(Date.parse(createdAt) + 90 * 86_400_000).toISOString(),
    granted_by: { actor_role: 'ATHLETE', actor_ref: scope.subject_id },
  });
  const compiled = compileAthleteSharedContextV1({
    adapter,
    grant: initialGrant,
    relationship,
    object_catalog: catalog,
    as_of_at: createdAt,
  });
  if (!compiled.ok) throw new TypeError(compiled.code);
  const initialPublication = createInitialAthleteLivingMapPublicationV1({
    adapter,
    initial_state: initialMapState(fixture),
    // BOS is deliberately absent from the shared relationship until the athlete
    // grants its presentation-safe projection. It must not influence even an
    // opaque initial-map provenance hash before that grant.
    source_state_hash: hashCanonicalJson({ apa: fixture.realizationIdentity }),
    authority_receipt_hash: compiled.authority_receipt.receipt_hash,
    created_at: createdAt,
  });
  const seams = providerSeams({ apiKey: env.OPENAI_API_KEY, clock });
  const runtime = await createAthleteLivingConsultOneShotRuntimeV1({
    adapter,
    relationship,
    initial_publication: initialPublication,
    source_artifact_bindings: [bindings.apa, bindings.bos],
    shared_object_catalog: catalog,
    bos_presentation_artifact: bosProjection,
    bos_authority_object_id: catalog.find((entry) => entry.source_binding.source_kind === 'ATHLETE_BOS')?.object_id,
    apa_customer_view_model: apaViewModel,
    apa_source_binding: bindings.apa,
    coach_seam: coach_seam === undefined ? seams.coach : coach_seam,
    candidate_extractor: candidate_extractor === undefined ? seams.candidate : candidate_extractor,
    close_seam: close_seam === undefined ? seams.close : close_seam,
    gu_generator: gu_generator === undefined ? seams.gu?.generate : gu_generator,
    preferred_name: fixture.subject.displayName,
    instructor_name: fixture.relationship.instructorDisplayName,
    plan_fixture: fixture.plan,
    clock,
    runtime_snapshot,
  });
  const originalInspect = runtime.inspect;
  return Object.freeze({
    ...runtime,
    inspect: () => Object.freeze({
      ...originalInspect(),
      demo_fixture: {
        fixture_id: fixture.id,
        athlete: fixture.subject.displayName,
        instructor: fixture.relationship.instructorDisplayName,
        sport: fixture.subject.sport,
        bos_base_chassis_artifact_sha256: MIKA_BOS_ARTIFACT_SHA256,
        bos_source_derivation: fixture.id === 'mika' ? 'SEALED_MIKA_SOURCE' : 'FICTIONAL_AVERY_DERIVED_ON_IDENTICAL_BOS_CHASSIS',
        bos_presentation_projection_hash: bindings.bos.content_hash,
        apa_view_model_hash: bindings.apa.content_hash,
        bos_source_bytes_exposed: false,
        provider_status: seams.provider_status,
      },
    }),
  });
}

export const ATHLETE_LIVING_CONSULT_ONE_SHOT_DEMO_POLICY_V1 = Object.freeze({
  domain: 'ATHLETE',
  age_band: '18–20',
  synthetic_only: true,
  fixed_fixture_created_at: FIXED_CREATED_AT,
  provider: 'OpenAI Responses API',
  model: 'gpt-5.6-sol',
  reasoning_effort: 'xhigh',
  store: false,
  background: false,
  web_search: 'AVAILABLE_IN_FOUNDATION_BUT_DEFAULT_OFF_FOR_ONE_SHOT',
  universal_rsl_reads: false,
  universal_promotion: false,
  autonomous_scientific_closed_loop: false,
});
