import { deepFreeze } from '../../intelligenceFabric/validation.js';

export const COACHING_EPISODE_PHASES = deepFreeze([
  'IDLE',
  'STARTED',
  'ACTIVE',
  'ENDING',
  'SESSION_LEARNING_NOTES_READY',
]);

export const SUBSCRIPTION_S1_1_SESSION_SPINE = deepFreeze({
  default_orientation: ['VISION', 'PERSPECTIVE', 'TIME', 'GAP', 'MOVE', 'LEARNING', 'COURSE_CORRECTION'],
  natural_branches: [
    ['CHANGE', 'MEANING', 'RESPONSE'],
    ['OUTCOME', 'EXCEPTION_OR_WHAT_WORKED', 'CONSTRAINT', 'EXPERIMENT'],
    ['PRIOR_COMMITMENT', 'WHAT_HAPPENED', 'LEARN', 'NEXT_MOVE'],
  ],
  structure_not_script: true,
  model_owns_session_arc: true,
  human_owns_decisions: true,
});

const VALID_TRANSITIONS = deepFreeze({
  IDLE: ['STARTED'],
  STARTED: ['ACTIVE', 'ENDING'],
  ACTIVE: ['ACTIVE', 'ENDING'],
  ENDING: ['SESSION_LEARNING_NOTES_READY'],
  SESSION_LEARNING_NOTES_READY: ['IDLE'],
});

export function validateCoachingEpisodeTransition(from, to) {
  const valid = COACHING_EPISODE_PHASES.includes(from) && VALID_TRANSITIONS[from]?.includes(to);
  return deepFreeze({ valid: Boolean(valid), from, to });
}

export function createCoachingEpisodeContext({
  phase = 'ACTIVE',
  preferred_conversational_name,
  preferred_name_authority = 'GOVERNED_SYNTHETIC_SUBJECT_FIXTURE',
  session_kind = 'WEEKLY',
} = {}) {
  if (!COACHING_EPISODE_PHASES.includes(phase)) throw new TypeError('SUBSCRIPTION_S1_1_EPISODE_PHASE_INVALID');
  if (typeof preferred_conversational_name !== 'string' || !preferred_conversational_name.trim()) throw new TypeError('SUBSCRIPTION_S1_1_PREFERRED_NAME_REQUIRED');
  if (typeof preferred_name_authority !== 'string' || !preferred_name_authority.trim()) throw new TypeError('SUBSCRIPTION_S1_1_PREFERRED_NAME_AUTHORITY_REQUIRED');
  return deepFreeze({
    contract: 'SUBSCRIPTION_FLAGSHIP_S1_1_COACHING_EPISODE_V1',
    current_phase: phase,
    relationship_continuous: true,
    substantive_session_started: !['IDLE'].includes(phase),
    opening_subscription_is_not_substantive_engagement: true,
    preferred_conversational_name: preferred_conversational_name.trim(),
    preferred_name_authority: preferred_name_authority.trim(),
    session_kind,
    responsibility: 'You are responsible for helping this session move somewhere useful. Understand where this person is trying to go, where they are now, what happened since you last spoke, and what matters most today. Gently lead through questions and insight. Help the human discover rather than lecture. Think deeply; speak simply.',
    spine: SUBSCRIPTION_S1_1_SESSION_SPINE,
    start_orientation: [
      'Governed Vision',
      'Current Business Twin and Perspective',
      'Prior durable session meaning',
      'One Move and open commitments',
      'Relevant Personal RSL',
      'Recent attempts and outcomes',
      'Visible surface',
      'Current user message',
    ],
    temporal_principle: 'Software knows the clock precisely. Frontier intelligence understands what the passage of time means.',
    temporal_coaching_doctrine: [
      'A dream becomes more achievable when it is translated into smaller actions.',
      'Regular coaching creates opportunities for accountability, learning, and course correction.',
      'Large goals become manageable through repeated smaller steps: little bites of the elephant.',
      'Accountability is not punishment; it helps the human remain connected to what they said matters.',
      'A missed commitment is information. Understand what happened before prescribing harder discipline.',
      'Repeated misses may mean the intervention, environment, capacity, or assumption needs to change.',
      'Examine progress against the person’s desired future, not only activity counts.',
      'Course correction is part of progress.',
      'The coaching relationship adapts to the human instead of forcing MORE’s preferred cadence.',
    ],
    temporal_use_rule: 'Use elapsed-time meaning only when it improves coaching. Never mechanically police attendance or shame the human.',
    relationship_intelligence_principles: [
      'Remember unfinished governed meaning. Surface at most one relevant open loop when it helps this session; never treat a possible open loop as newly established canonical truth.',
      'Recognize earned progress only when governed state shows specific movement from a prior state through an attempt to an observed change connected to the person’s Vision. Do not give generic praise.',
      'When an intervention is working, maintaining course and continuing to observe may be the best decision. Do not manufacture a new problem, intervention, or insight.',
      'Before fully ending the session, establish whether it landed for the human. Invite correction naturally, and let that response change the final shared understanding.',
    ],
    frontier_freedom: 'Use the complete governed coaching reality to understand deeply, then coach naturally. Never expose these internal labels or mechanically walk the human through them.',
    close_learning_seam: [
      'what mattered',
      'what changed',
      'what was learned',
      'what was decided',
      'what remains open',
      'what belongs in durable governed meaning',
      'what should be picked up next time',
      'whether the human agrees that this is where the session landed',
    ],
    future_s2_gu_seams: {
      material_map_change: 'MANDATORY_GU_NOT_IMPLEMENTED_IN_S1_1',
      session_close_notes_evidence_receipt: 'MANDATORY_GU_NOT_IMPLEMENTED_IN_S1_1',
    },
  });
}

export function coachingEpisodeProjection({ phase, transitions = [] } = {}) {
  if (!COACHING_EPISODE_PHASES.includes(phase)) throw new TypeError('SUBSCRIPTION_S1_1_EPISODE_PHASE_INVALID');
  if (!Array.isArray(transitions) || transitions.some((value) => !COACHING_EPISODE_PHASES.includes(value))) throw new TypeError('SUBSCRIPTION_S1_1_EPISODE_TRANSITIONS_INVALID');
  return deepFreeze({
    contract: 'SUBSCRIPTION_FLAGSHIP_S1_1_COACHING_EPISODE_V1',
    phase,
    transitions: [...transitions],
    relationship_continuous: true,
  });
}
