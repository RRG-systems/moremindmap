import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import { createFreeGptProviderReceipt } from '../subscriptionV1/freeGptV2/contracts.js';
import { FREE_GPT_V2_MODEL, FREE_GPT_V2_RUNTIME_POLICY } from '../subscriptionV1/freeGptV2/constants.js';
import { EXECUTION_DEGREES, OPEN_LOOP_STATES, OUTCOME_CLASSIFICATIONS } from '../subscriptionV1/lineage.js';
import { classifyAthleteMutationItemsV1 } from './athleteDomainAdapter.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const PROPOSAL_TYPES = ['COMMITMENT_CANDIDATE', 'EVIDENCE_CANDIDATE', 'CORRECTION_CANDIDATE', 'PLAN_CHANGE_CANDIDATE'];
const SOURCES = ['ATHLETE_AUTHORED', 'INSTRUCTOR_AUTHORED', 'CO_CREATED', 'MORE_SUGGESTION'];

const itemSchema = {
  type: 'object', additionalProperties: false, required: ['field', 'value'],
  properties: {
    field: { type: 'string', minLength: 1, maxLength: 120, pattern: '^athlete_(?:current_reality|futures|one_move|plan|evidence)\\.[a-z0-9_]+(?:\\.[a-z0-9_]+)*$' },
    value: { type: 'string', minLength: 1, maxLength: 1200 },
  },
};

export const ATHLETE_DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1 = deepFreeze({
  type: 'json_schema',
  name: 'athlete_living_consult_candidate_v1',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false, required: ['candidate'],
    properties: {
      candidate: {
        anyOf: [{
          type: 'object', additionalProperties: false,
          required: ['candidate_source', 'proposal_type', 'target_contract', 'operation', 'summary', 'items', 'reason', 'evidence_ref_ids', 'authority_ref_ids', 'confirmation_required', 'model_speech_is_not_truth'],
          properties: {
            candidate_source: { type: 'string', enum: SOURCES },
            proposal_type: { type: 'string', enum: PROPOSAL_TYPES },
            target_contract: { type: 'string', const: 'athlete_living_map_v1' },
            operation: { type: 'string', const: 'PROPOSE' },
            summary: { type: 'string', minLength: 1, maxLength: 500 },
            items: { type: 'array', minItems: 1, maxItems: 12, items: itemSchema },
            reason: { type: 'string', minLength: 1, maxLength: 800 },
            evidence_ref_ids: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 160 } },
            authority_ref_ids: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 200 } },
            confirmation_required: { type: 'boolean', const: true },
            model_speech_is_not_truth: { type: 'boolean', const: true },
          },
        }, { type: 'null' }],
      },
    },
  },
});

function exactKeys(value, keys) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function activeLineageIds(packet) {
  const fromHistory = packet?.provider_understanding?.relevant_relationship_history || [];
  const fromScorecard = packet?.provider_understanding?.longitudinal_relationship?.interventions || [];
  return new Set([
    ...fromHistory.map((item) => item?.lineage?.intervention_lineage_id),
    ...fromScorecard.map((item) => item?.intervention_lineage_id),
  ].filter((value) => /^intervention_[a-f0-9]{24}$/u.test(value || '')));
}

export function validateAthleteDurableCandidateOutputV1(value, packet) {
  const errors = [];
  if (!exactKeys(value, ['candidate'])) errors.push('ATHLETE_CANDIDATE_OUTPUT_FIELDS_INVALID');
  if (value?.candidate === null) return deepFreeze({ valid: errors.length === 0, errors, candidate: null });
  const candidate = value?.candidate;
  const keys = ['candidate_source', 'proposal_type', 'target_contract', 'operation', 'summary', 'items', 'reason', 'evidence_ref_ids', 'authority_ref_ids', 'confirmation_required', 'model_speech_is_not_truth'];
  if (!exactKeys(candidate, keys)) errors.push('ATHLETE_CANDIDATE_FIELDS_INVALID');
  if (!SOURCES.includes(candidate?.candidate_source) || !PROPOSAL_TYPES.includes(candidate?.proposal_type)) errors.push('ATHLETE_CANDIDATE_KIND_INVALID');
  // This V1 extraction contract does not carry a stable Personal-RSL event
  // target. A model may notice a correction, but it may not manufacture the
  // lineage required to supersede durable customer truth. The conversational
  // runtime already preserves the human correction against the preceding
  // MORE hypothesis as noncanonical relationship-episode provenance.
  if (candidate?.proposal_type === 'CORRECTION_CANDIDATE') errors.push('ATHLETE_CORRECTION_LINEAGE_TARGET_UNAVAILABLE');
  if (candidate?.target_contract !== 'athlete_living_map_v1' || candidate?.operation !== 'PROPOSE') errors.push('ATHLETE_CANDIDATE_TARGET_INVALID');
  if (typeof candidate?.summary !== 'string' || !candidate.summary.trim() || candidate.summary.length > 500
    || typeof candidate?.reason !== 'string' || !candidate.reason.trim() || candidate.reason.length > 800) errors.push('ATHLETE_CANDIDATE_LANGUAGE_INVALID');
  const itemValidation = classifyAthleteMutationItemsV1(candidate?.items);
  if (!itemValidation.valid) errors.push(...itemValidation.errors);
  if (candidate?.confirmation_required !== true || candidate?.model_speech_is_not_truth !== true) errors.push('ATHLETE_CANDIDATE_AUTHORITY_BOUNDARY_INVALID');
  const evidenceAllowed = new Set(packet?.allowed_refs?.evidence || []);
  const authorityAllowed = new Set(packet?.allowed_refs?.authority || []);
  if (!Array.isArray(candidate?.evidence_ref_ids) || candidate.evidence_ref_ids.some((id) => !evidenceAllowed.has(id))) errors.push('INVENTED_EVIDENCE_REFERENCE');
  if (!Array.isArray(candidate?.authority_ref_ids) || candidate.authority_ref_ids.some((id) => !authorityAllowed.has(id))) errors.push('INVENTED_AUTHORITY_REFERENCE');
  const itemMap = new Map((candidate?.items || []).map((item) => [item.field, item.value]));
  for (const [field, value] of itemMap) {
    if (field.endsWith('.open_loop_state') && !OPEN_LOOP_STATES.includes(value)) errors.push('ATHLETE_OPEN_LOOP_STATE_INVALID');
    if (field === 'athlete_evidence.execution_degree' && !EXECUTION_DEGREES.includes(value)) errors.push('ATHLETE_EXECUTION_DEGREE_INVALID');
    if (field === 'athlete_evidence.outcome_classification' && !OUTCOME_CLASSIFICATIONS.includes(value)) errors.push('ATHLETE_OUTCOME_CLASSIFICATION_INVALID');
  }
  const linksExisting = itemMap.has('athlete_evidence.attempt') || itemMap.has('athlete_evidence.execution_degree') || itemMap.has('athlete_evidence.outcome');
  if (linksExisting && !activeLineageIds(packet).has(itemMap.get('athlete_evidence.intervention_lineage_id'))) errors.push('ATHLETE_INTERVENTION_LINEAGE_REFERENCE_INVALID');
  if (errors.length) return deepFreeze({ valid: false, errors, candidate: null });
  return deepFreeze({ valid: true, errors: [], candidate: clone(candidate) });
}

export function createAthletePostResponseCandidateExtractorV1({
  transport,
  enabled = false,
  now = () => new Date().toISOString(),
}) {
  if (typeof transport !== 'function') throw new TypeError('ATHLETE_CANDIDATE_TRANSPORT_REQUIRED');
  return deepFreeze({
    inspect: () => deepFreeze({ enabled, model: FREE_GPT_V2_MODEL, reasoning_effort: 'xhigh', store: false, background: false, mutation_authority: false }),
    async extract({ packet, human_message, coach_message }) {
      if (!enabled) return deepFreeze({ ok: false, code: 'ATHLETE_CANDIDATE_PROVIDER_DEFAULT_OFF' });
      const request = {
        model: FREE_GPT_V2_MODEL,
        store: false,
        background: false,
        tools: [],
        reasoning: { effort: 'xhigh' },
        max_output_tokens: FREE_GPT_V2_RUNTIME_POLICY.candidate_max_output_tokens,
        text: { format: ATHLETE_DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1 },
        input: [
          { role: 'system', content: 'Identify only a bounded Athlete-map proposal that is materially present in this exchange. This stage may preserve an athlete-authored, instructor-authored, co-created, or MORE-suggested next step as a proposal, but never as agreement or truth. Return null for ordinary reflection, a question, generic encouragement, or a duplicate of current governed state. Use only Athlete-native field paths. A proposed experiment uses athlete_plan.intervention and may include open_loop_state, due_at, observation windows, and falsifiers only when the exchange supports them. An attempt or outcome must cite an exact active intervention lineage; never infer one by date or similarity. The model cannot authorize mutation. Both the athlete and instructor must separately confirm the exact state-bound proposal downstream.' },
          { role: 'user', content: JSON.stringify({
            governed_understanding: packet.provider_understanding,
            human_message,
            coach_message,
            allowed_evidence_ref_ids: packet.allowed_refs.evidence,
            allowed_authority_ref_ids: packet.allowed_refs.authority,
            state_packet_hash: packet.packet_hash,
          }) },
        ],
      };
      const response = await transport(deepFreeze(request), { stage: 'CANDIDATE_EXTRACTION' });
      const validation = validateAthleteDurableCandidateOutputV1(response?.output, packet);
      if (!validation.valid) return deepFreeze({ ok: false, code: 'ATHLETE_CANDIDATE_OUTPUT_INVALID', errors: validation.errors, mutation_performed: false });
      const receipt = createFreeGptProviderReceipt({
        stage: 'CANDIDATE_EXTRACTION',
        request_hash: hashCanonicalJson(request), response_hash: hashCanonicalJson(response.output),
        usage: response.usage || {}, latency_ms: response.latency_ms || 0,
        web_search_calls: 0, attempt_count: response.attempt_count || 1,
        estimated_token_cost_microusd: response.estimated_cost_microusd || 0,
        created_at: now(),
      });
      return deepFreeze({ ok: true, code: validation.candidate ? 'ATHLETE_DURABLE_CANDIDATE_EXTRACTED' : 'ATHLETE_NO_DURABLE_CANDIDATE', candidate: validation.candidate, receipt, mutation_performed: false });
    },
  });
}
