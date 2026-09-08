import { customerProseSha256 } from '../../../src/lib/newBosPersonalityDnaV1/renderingAssembly.js';
import { athleteSurfacePacketHasPublicationSupport } from './contract.js';

export const ATHLETE_BOS_RENDERING_VERSION = 'athlete_bos_editorial_surface_rendering_v4';

const confidenceLanguage = Object.freeze({
  direct_account: 'From the athlete’s account',
  bounded_inference: 'A careful reading to keep testing',
  tentative: 'Still being learned',
});

function firstText(...values) {
  return values.flat(Infinity).find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function uniqueText(values) {
  return [...new Set(values.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
}

export function athleteProseFragments(customerProse) {
  const paragraphs = String(customerProse || '').split(/\r?\n\s*\r?\n/u).map((item) => item.trim()).filter(Boolean);
  if (!paragraphs.length) throw new Error('ATHLETE_RENDERING_REQUIRES_PROSE');
  const summary = paragraphs.find((item) => !/^#{1,6}\s+/u.test(item)) || paragraphs[0];
  const heading = paragraphs[0].match(/^#{1,6}\s+(.+)$/u)?.[1];
  const headline = heading || summary.match(/^.+?[.!?](?=\s|$)/us)?.[0] || summary;
  if (!headline.trim() || !summary.trim() || !String(customerProse).includes(headline) || !String(customerProse).includes(summary)) {
    throw new Error('ATHLETE_RENDERING_PROSE_FRAGMENT_MISMATCH');
  }
  return Object.freeze({ headline, summary });
}

function claimCards(truth) {
  return (truth.resolved_claims || []).map((claim) => Object.freeze({
    statement: claim.statement,
    certainty: confidenceLanguage[claim.confidence] || 'Open to correction',
    alternatives: Object.freeze([...(claim.confounds || [])]),
    whatCouldChangeIt: claim.what_would_change_it,
  }));
}

function evidenceCards(truth) {
  return (truth.evidence || []).map((item) => Object.freeze({
    question: item.question_context || null,
    answer: item.exact_content,
    source: String(item.epistemic_class || 'evidence').replaceAll('_', ' '),
    eventTime: item.event_time || null,
  }));
}

function dynamicCards(truth) {
  return (truth.causal_dynamics || []).map((item) => Object.freeze({
    context: item.triggerOrContext,
    meaning: item.meaningOrPrivateCalculation,
    response: item.responseOrAction,
    usefulPart: item.immediateUse,
    possibleCost: item.possibleDelayedCost,
    uncertainty: firstText(item.falsifier, ...(item.confounders || [])),
  }));
}

function sequenceCards(truth) {
  return (truth.sequences || []).map((item) => Object.freeze({
    context: item.context,
    steps: Object.freeze([...(item.steps || [])]),
    consequence: item.consequence,
    uncertainty: firstText(item.falsifier, ...(item.confounders || [])),
  }));
}

function sharedContext(truth) {
  const specialist = truth.specialist_truth || {};
  return Object.freeze({
    domainMeaning: firstText(specialist.meaning, specialist.abstention),
    insights: Object.freeze(claimCards(truth)),
    moments: Object.freeze(evidenceCards(truth).slice(0, 4)),
    stillOpen: Object.freeze(uniqueText([...(truth.abstentions || []), ...(truth.confounds || [])]).slice(0, 4)),
  });
}

function publicationTruthFor(packet) {
  if (athleteSurfacePacketHasPublicationSupport(packet)) return packet.resolved_local_truth;
  const abstentions = Object.freeze([...(packet.resolved_local_truth?.abstentions || [])]);
  return Object.freeze({
    whole_person_model: Object.freeze({}),
    resolved_claims: Object.freeze([]),
    causal_dynamics: Object.freeze([]),
    sequences: Object.freeze([]),
    strengths_and_overuse: Object.freeze([]),
    compensations: Object.freeze([]),
    evidence: Object.freeze([]),
    contradictions: Object.freeze([]),
    counterevidence: Object.freeze([]),
    confounds: Object.freeze([]),
    falsifiers: Object.freeze([]),
    specialist_truth: Object.freeze({ abstention: abstentions[0] || '' }),
    abstentions,
  });
}

function visualFor(surfaceId, truth) {
  const whole = truth.whole_person_model || {};
  const specialist = truth.specialist_truth || {};
  const common = sharedContext(truth);
  switch (surfaceId) {
    case 'this_is_you':
      return Object.freeze({
        kind: 'recognition',
        anchor: firstText(specialist.recognition, whole.core_explanation, whole.identity_distillation),
        threads: Object.freeze((whole.causal_mechanisms || []).slice(0, 3).map(({ meaning, uncertainty }) => ({ meaning, uncertainty }))),
        tensions: Object.freeze(uniqueText([whole.central_tension, ...(whole.identity_tensions || [])]).slice(0, 3)),
      });
    case 'personality_dna':
      return Object.freeze({
        kind: 'whole_person_pattern',
        anchor: firstText(specialist.meaning, whole.core_explanation),
        threads: Object.freeze((whole.causal_mechanisms || []).slice(0, 4).map(({ meaning, uncertainty }) => ({ meaning, uncertainty }))),
        dynamics: Object.freeze(dynamicCards(truth).slice(0, 3)),
        tensions: Object.freeze(uniqueText([whole.central_tension, ...(whole.identity_tensions || []), ...(whole.goal_conflicts || [])]).slice(0, 4)),
      });
    case 'how_you_operate':
      return Object.freeze({ kind: 'operating_sequence', sequences: Object.freeze(sequenceCards(truth).slice(0, 3)), dynamics: Object.freeze(dynamicCards(truth).slice(0, 3)), ...common });
    case 'how_people_experience_you':
      return Object.freeze({ kind: 'relationship_lens', boundary: 'This is a careful possibility from the interactions described—not a claim about what another person thinks.', ...common });
    case 'communication_dna':
      return Object.freeze({ kind: 'communication_flow', sequences: Object.freeze(sequenceCards(truth).slice(0, 3)), dynamics: Object.freeze(dynamicCards(truth).slice(0, 3)), ...common });
    case 'strengths_vulnerabilities':
      return Object.freeze({
        kind: 'strength_tradeoff',
        items: Object.freeze((truth.strengths_and_overuse || []).map((item) => ({
          strength: item.strength,
          usefulWhen: item.usefulWhen,
          lessUsefulWhen: item.lessUsefulWhen,
          why: item.mechanism,
          uncertainty: item.falsifier,
        })).slice(0, 4)),
        ...common,
      });
    case 'pressure_conflict':
      return Object.freeze({ kind: 'pressure_response_repair', dynamics: Object.freeze(dynamicCards(truth).slice(0, 3)), sequences: Object.freeze(sequenceCards(truth).slice(0, 3)), ...common });
    case 'work_dna':
      return Object.freeze({ kind: 'sport_school_life', ...common });
    case 'role_seat':
      return Object.freeze({ kind: 'growth_conditions', ...common });
    case 'cognitive_operating_style':
      return Object.freeze({ kind: 'learning_process', sequences: Object.freeze(sequenceCards(truth).slice(0, 3)), dynamics: Object.freeze(dynamicCards(truth).slice(0, 2)), ...common });
    case 'personal_operating_energy':
      return Object.freeze({ kind: 'capacity_context', ...common });
    case 'five_futures':
      return Object.freeze({
        kind: 'conditional_futures',
        items: Object.freeze((specialist.futures || []).map((future) => ({
          title: future.title,
          condition: future.condition,
          possibility: future.possibility,
          mechanism: future.mechanismHypothesis,
          actions: Object.freeze([...(future.controllableActions || [])]),
          dependencies: Object.freeze([...(future.externalDependencies || [])]),
          horizon: future.horizon,
          uncertainty: future.uncertainty,
          indicators: Object.freeze([...(future.indicators || [])]),
          reviewTrigger: future.reviewTrigger,
        }))),
        stillOpen: Object.freeze([...(truth.abstentions || [])]),
      });
    case 'one_move': {
      const move = specialist.move || {};
      return Object.freeze({
        kind: 'one_move',
        moveKind: move.kind,
        suggestion: move.suggestion,
        purpose: move.purpose,
        why: move.whyThis,
        observation: move.observation,
        window: move.observationWindow,
        stopOrAdjust: move.stopOrAdjust,
        uncertainty: move.uncertainty,
      });
    }
    case 'evidence_certainty':
      return Object.freeze({
        kind: 'known_and_open',
        claims: Object.freeze(claimCards(truth)),
        sourceMoments: Object.freeze(evidenceCards(truth)),
        differences: Object.freeze((truth.contradictions || []).map(({ statement, resolved }) => ({ statement, resolved }))),
        stillOpen: Object.freeze(uniqueText([...(truth.abstentions || []), ...(specialist.unknowns || [])])),
      });
    case 'operating_identity':
      return Object.freeze({
        kind: 'governing_identity',
        anchor: firstText(whole.identity_distillation, whole.core_explanation, specialist.recognition),
        logic: firstText(whole.core_explanation),
        tension: firstText(whole.central_tension),
        uncertainty: Object.freeze([...(whole.uncertainty || [])]),
      });
    default:
      throw new Error('ATHLETE_RENDERING_SURFACE_UNKNOWN');
  }
}

export function assembleAthleteSurfaceRendering({ packet, humanRealization }) {
  if (humanRealization?.surface_id !== packet?.surface_id) throw new Error('ATHLETE_RENDERING_SURFACE_MISMATCH');
  const customerProse = humanRealization.customer_prose;
  const { headline, summary } = athleteProseFragments(customerProse);
  const publicationTruth = publicationTruthFor(packet);
  const governedEvidenceRefs = Object.freeze((publicationTruth.evidence || []).map(({ evidence_id: id }) => id));
  return Object.freeze({
    version: ATHLETE_BOS_RENDERING_VERSION,
    surface_id: packet.surface_id,
    eyebrow: packet.label,
    headline,
    summary,
    customer_prose_sha256: customerProseSha256(customerProse),
    governed_evidence_refs: governedEvidenceRefs,
    evidence_count: governedEvidenceRefs.length,
    abstention_visible: publicationTruth.abstentions.length > 0,
    visual: visualFor(packet.surface_id, publicationTruth),
  });
}
