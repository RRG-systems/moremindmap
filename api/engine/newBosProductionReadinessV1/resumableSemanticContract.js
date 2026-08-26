import { LIBRARY_MANIFEST_SHA256 } from '../../../src/lib/newBosPersonalityDnaV1/libraryRegistry.js';

import { buildNewBosReasoningSchema } from './reasoningContract.js';
import { NEW_BOS_PROVIDER_POLICY_VERSION, sha256Stable } from './realizationIdentity.js';

export const NEW_BOS_RESUMABLE_CAMPAIGN_VERSION = 'new_bos_resumable_generation_campaign_v1';
export const NEW_BOS_SEMANTIC_STAGE_REGISTRY_VERSION = 'new_bos_semantic_stage_registry_v1';

const STAGES = Object.freeze([
  Object.freeze({
    id: 'causal_foundation',
    order: 1,
    mission: 'Establish the governed causal foundation: topology, attributes, dynamics, sequences, strengths and overuse, and compensation.',
    top_level: Object.freeze(['topology', 'attributes', 'dynamics', 'sequences', 'strengths_and_overuse', 'compensation']),
    specialized: Object.freeze([]),
    dependencies: Object.freeze([]),
  }),
  Object.freeze({
    id: 'operating_domains',
    order: 2,
    mission: 'Develop the distinct operating-domain intelligence without repeating the whole-person synthesis or decision domains.',
    top_level: Object.freeze([]),
    specialized: Object.freeze([
      'version',
      'recognition',
      'personality_dna',
      'operating_engine',
      'people_experience',
      'communication',
      'strengths_vulnerabilities',
      'pressure_conflict',
      'work_environment',
      'role_seat',
      'leadership',
      'cognition',
      'energy',
    ]),
    dependencies: Object.freeze(['causal_foundation']),
  }),
  Object.freeze({
    id: 'whole_person_decision_synthesis',
    order: 3,
    mission: 'Synthesize the vector-free whole person, governed decisions, validation, operating identity, visual BOS, abstentions, and validation backlog.',
    top_level: Object.freeze(['whole_person', 'abstentions', 'validation_backlog']),
    specialized: Object.freeze(['five_futures', 'one_move', 'validation', 'operating_identity', 'visual_bos']),
    dependencies: Object.freeze(['causal_foundation', 'operating_domains']),
  }),
  Object.freeze({
    id: 'surface_routing',
    order: 4,
    mission: 'Route existing governed claim IDs and evidence IDs to all 15 surfaces without creating new semantic claims.',
    top_level: Object.freeze(['surface_claims', 'surface_evidence_refs']),
    specialized: Object.freeze([]),
    dependencies: Object.freeze(['causal_foundation', 'operating_domains', 'whole_person_decision_synthesis']),
  }),
]);

export const NEW_BOS_SEMANTIC_STAGES = STAGES;
export const NEW_BOS_SEMANTIC_STAGE_REGISTRY_SHA256 = sha256Stable({
  version: NEW_BOS_SEMANTIC_STAGE_REGISTRY_VERSION,
  stages: STAGES,
});

function exactObject(properties) {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function selectProperties(source, keys) {
  return Object.fromEntries(keys.map((key) => {
    if (!Object.hasOwn(source, key)) throw new Error(`new_bos_semantic_stage_schema_path_missing:${key}`);
    return [key, source[key]];
  }));
}

function stageById(stageId) {
  const stage = STAGES.find(({ id }) => id === stageId);
  if (!stage) throw new Error('new_bos_semantic_stage_unknown');
  return stage;
}

export function buildNewBosSemanticStageSchema({ stageId, evidenceIds }) {
  const stage = stageById(stageId);
  const full = buildNewBosReasoningSchema(evidenceIds);
  const properties = selectProperties(full.properties, stage.top_level);
  if (stage.specialized.length) {
    properties.specialized = exactObject(selectProperties(full.properties.specialized.properties, stage.specialized));
  }
  return exactObject(properties);
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`new_bos_semantic_fragment_invalid:${label}`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`new_bos_semantic_fragment_key_mismatch:${label}`);
  }
}

export function validateNewBosSemanticStageFragment({ stageId, fragment }) {
  const stage = stageById(stageId);
  const expectedTopLevel = [...stage.top_level, ...(stage.specialized.length ? ['specialized'] : [])];
  assertExactKeys(fragment, expectedTopLevel, stageId);
  if (stage.specialized.length) assertExactKeys(fragment.specialized, stage.specialized, `${stageId}.specialized`);
  return fragment;
}

export function assembleNewBosReasoningDraftV1({ fragments }) {
  const byId = new Map((fragments || []).map((item) => [item.stage_id, item.fragment]));
  STAGES.forEach((stage) => validateNewBosSemanticStageFragment({
    stageId: stage.id,
    fragment: byId.get(stage.id),
  }));
  const causal = byId.get('causal_foundation');
  const domains = byId.get('operating_domains');
  const synthesis = byId.get('whole_person_decision_synthesis');
  const routing = byId.get('surface_routing');
  const assembled = {
    topology: causal.topology,
    attributes: causal.attributes,
    dynamics: causal.dynamics,
    specialized: {
      ...domains.specialized,
      ...synthesis.specialized,
    },
    sequences: causal.sequences,
    strengths_and_overuse: causal.strengths_and_overuse,
    compensation: causal.compensation,
    whole_person: synthesis.whole_person,
    abstentions: synthesis.abstentions,
    validation_backlog: synthesis.validation_backlog,
    surface_claims: routing.surface_claims,
    surface_evidence_refs: routing.surface_evidence_refs,
  };
  const fullSchema = buildNewBosReasoningSchema(
    [...new Set([
      ...causal.topology.flatMap((item) => item.evidence_refs || []),
      ...causal.attributes.flatMap((item) => item.evidence_refs || []),
      ...causal.dynamics.flatMap((item) => item.evidence_refs || []),
    ])],
  );
  assertExactKeys(assembled, Object.keys(fullSchema.properties), 'assembled');
  assertExactKeys(assembled.specialized, Object.keys(fullSchema.properties.specialized.properties), 'assembled.specialized');
  return Object.freeze(assembled);
}

export function buildNewBosResumableCampaignIdentity({ realizationIdentity, evidenceIds }) {
  if (!realizationIdentity?.sha256) throw new Error('new_bos_resumable_campaign_realization_identity_required');
  const finalReasoningSchemaSha256 = sha256Stable(buildNewBosReasoningSchema(evidenceIds));
  const components = Object.freeze({
    final_realization_identity_sha256: realizationIdentity.sha256,
    resumable_orchestrator_version: NEW_BOS_RESUMABLE_CAMPAIGN_VERSION,
    semantic_stage_registry_sha256: NEW_BOS_SEMANTIC_STAGE_REGISTRY_SHA256,
    final_reasoning_schema_sha256: finalReasoningSchemaSha256,
    provider_policy_version: NEW_BOS_PROVIDER_POLICY_VERSION,
    canonical_evidence_sha256: realizationIdentity.components.canonical_evidence_sha256,
    frozen_authority_manifest_sha256: LIBRARY_MANIFEST_SHA256,
  });
  return Object.freeze({
    version: NEW_BOS_RESUMABLE_CAMPAIGN_VERSION,
    sha256: sha256Stable(components),
    components,
  });
}

export function semanticStageById(stageId) {
  return stageById(stageId);
}
