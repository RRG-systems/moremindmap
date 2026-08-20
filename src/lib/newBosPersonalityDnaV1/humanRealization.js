import {
  NEW_BOS_HUMAN_REALIZATION_PROMPT_VERSION,
  NEW_BOS_HUMAN_REALIZATION_VERSION,
  NEW_BOS_SURFACE_MISSION_VERSION,
} from './constants.js';

const INTERNAL_KEYS = new Set([
  'id',
  'version',
  'subject_token',
  'profile_id',
  'surface_id',
  'evidence_refs',
  'counterevidence_refs',
  'confidence',
  'falsifier',
  'what_would_change_it',
  'source_ref',
  'lineage',
  'library_selection',
  'rendering',
]);

const INTERNAL_VALUE = /^(?:KNOWN|STRONGLY_SUPPORTED|SUPPORTED_HYPOTHESIS|TENTATIVE|INSUFFICIENT_EVIDENCE|bos_[a-z0-9_]+|moremindmap:\/\/)/u;

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
}

function plainConfidence(value) {
  const states = {
    KNOWN: 'directly stated or directly established',
    STRONGLY_SUPPORTED: 'strongly supported by the available evidence',
    SUPPORTED_HYPOTHESIS: 'a supported interpretation that should remain open to correction',
    TENTATIVE: 'tentative and still being learned',
    INSUFFICIENT_EVIDENCE: 'not established by the available evidence',
  };
  return states[value] || 'uncertainty should remain explicit';
}

function semanticStatements(value, output = []) {
  if (typeof value === 'string') {
    if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/u.test(value)) {
      output.push(value.replaceAll('_', ' ').toLowerCase());
    } else if (!INTERNAL_VALUE.test(value) && !/^[a-f0-9]{32,}$/iu.test(value)) output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => semanticStatements(item, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  Object.entries(value).forEach(([key, item]) => {
    if (!INTERNAL_KEYS.has(key)) semanticStatements(item, output);
  });
  return output;
}

function wholeHuman(wholePersonModel) {
  return Object.freeze({
    core_understanding: wholePersonModel.core_explanation,
    central_tension: wholePersonModel.central_tension,
    recurring_patterns: Object.freeze([...(wholePersonModel.mechanisms || [])]),
    identity_tensions: Object.freeze([...(wholePersonModel.identity_tensions || [])]),
    goal_conflicts: Object.freeze([...(wholePersonModel.goal_conflicts || [])]),
    possible_private_calculations: Object.freeze([...(wholePersonModel.private_calculations || [])]),
    pressure_and_recovery: wholePersonModel.pressure_and_recovery,
    work_and_relationships: wholePersonModel.work_and_relationships,
    governing_compression: wholePersonModel.identity_distillation,
  });
}

function localClaims(resolvedLocalTruth) {
  return Object.freeze((resolvedLocalTruth.resolved_claims || []).map((claim) => Object.freeze({
    meaning: claim.statement,
    certainty: plainConfidence(claim.confidence),
    alternative_explanations: Object.freeze([...(claim.confounds || [])]),
    what_might_change_the_interpretation: claim.what_would_change_it,
  })));
}

function localEvidence(surfaceId, resolvedLocalTruth) {
  return Object.freeze((resolvedLocalTruth.evidence || [])
    .filter(({ epistemic_class: kind }) => (
      kind !== 'score_prior' || ['personality_dna', 'evidence_certainty'].includes(surfaceId)
    ))
    .map((item) => Object.freeze({
      source_kind: String(item.epistemic_class || 'evidence').replaceAll('_', ' '),
      content: item.exact_content,
    })));
}

export function buildHumanRealizationInput({
  identityContext,
  wholePersonModel,
  localSurfacePacket,
  resolvedLocalTruth,
}) {
  const surfaceId = localSurfacePacket.surface_id;
  return Object.freeze({
    person: Object.freeze({
      display_name: identityContext?.display_name || 'the customer',
      relevant_context: identityContext?.role || identityContext?.context || null,
    }),
    whole_human_understanding: wholeHuman(wholePersonModel),
    surface: Object.freeze({
      name: localSurfacePacket.label,
      purpose: localSurfacePacket.local_mission,
    }),
    local_truth: Object.freeze({
      insights: localClaims(resolvedLocalTruth),
      domain_understanding: Object.freeze(unique(semanticStatements(resolvedLocalTruth.specialist_truth))),
      evidence: localEvidence(surfaceId, resolvedLocalTruth),
      contradictions: Object.freeze((resolvedLocalTruth.contradictions || []).map(({ statement }) => statement)),
      counterevidence: Object.freeze((resolvedLocalTruth.counterevidence || []).map(({ exact_content: content }) => content)),
      uncertainty_boundaries: Object.freeze(unique([
        ...(resolvedLocalTruth.abstentions || []),
        ...(resolvedLocalTruth.confounds || []),
      ])),
    }),
  });
}

export function buildHumanRealizationRequest({ model, input, safetyIdentifier, writerInstruction }) {
  return Object.freeze({
    model,
    store: false,
    safety_identifier: safetyIdentifier,
    instructions: writerInstruction.join('\n\n'),
    input: [{
      role: 'user',
      content: [{
        type: 'input_text',
        text: JSON.stringify({ governed_input: input }),
      }],
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'bos_human_realization',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['customer_prose'],
          properties: {
            customer_prose: { type: 'string' },
          },
        },
      },
    },
    metadata: {
      contract: NEW_BOS_HUMAN_REALIZATION_PROMPT_VERSION,
      surface_mission: NEW_BOS_SURFACE_MISSION_VERSION,
    },
  });
}

export function governedEvidenceRefs(localSurfacePacket) {
  return Object.freeze(unique((localSurfacePacket.resolved_local_truth?.evidence || [])
    .filter(({ epistemic_class: kind }) => (
      kind !== 'score_prior' || ['personality_dna', 'evidence_certainty'].includes(localSurfacePacket.surface_id)
    ))
    .map(({ evidence_id: id }) => id)));
}

export function createHumanRealization({
  surfaceId,
  customerProse,
  localSurfacePacket,
  generation,
}) {
  return Object.freeze({
    version: NEW_BOS_HUMAN_REALIZATION_VERSION,
    surface_id: surfaceId,
    customer_prose: String(customerProse || '').trim(),
    governed_evidence_refs: governedEvidenceRefs(localSurfacePacket),
    generation: generation ? Object.freeze({ ...generation }) : null,
  });
}
