export const NEW_BOS_PERSONALITY_DNA_VERSION = 'new_bos_personality_dna_v1';
export const NEW_BOS_RUNTIME_VERSION = 'bos_personality_dna_runtime_v1';
export const NEW_BOS_WHOLE_PERSON_VERSION = 'bos_vector_free_whole_person_model_v1';
export const NEW_BOS_LIBRARY_VERSION = 'bos_intelligence_library_v1';
export const NEW_BOS_DEPTH_CONTRACT_VERSION = 'bos_depth_contract_v1';
export const NEW_BOS_SURFACE_TRUTH_VERSION = 'bos_resolved_surface_truth_v1';
export const NEW_BOS_VISUAL_SYSTEM_VERSION = 'bos_visual_system_v1';
export const NEW_BOS_HUMAN_REALIZATION_VERSION = 'bos_human_realization_v1';
export const NEW_BOS_HUMAN_REALIZATION_PROMPT_VERSION = 'bos_human_realization_prompt_v1';
export const NEW_BOS_SURFACE_MISSION_VERSION = 'bos_surface_mission_realization_v1';
export const NEW_BOS_LOCAL_FLAG = 'VITE_NEW_BOS_PERSONALITY_DNA_V1';
export const NEW_BOS_REAL_PROFILE_HS_GATE_V1 = 'real_profile_hs_gate_v1';

export const DIMENSIONS = Object.freeze([
  Object.freeze({ id: 'command', label: 'Command' }),
  Object.freeze({ id: 'tempo', label: 'Tempo' }),
  Object.freeze({ id: 'relational_awareness', label: 'Relational Awareness' }),
  Object.freeze({ id: 'precision', label: 'Precision' }),
  Object.freeze({ id: 'leverage', label: 'Leverage' }),
  Object.freeze({ id: 'adaptability', label: 'Adaptability' }),
  Object.freeze({ id: 'structure', label: 'Structure' }),
  Object.freeze({ id: 'perspective', label: 'Perspective' }),
]);

export const PRIOR_BAND_LABELS = Object.freeze({
  higher_relative_prior: 'Higher relative prior',
  context_sensitive_prior: 'Context-sensitive prior',
  lower_relative_prior: 'Lower relative prior',
});

export const EPISTEMIC_CLASSES = Object.freeze([
  'direct_fact',
  'self_report',
  'score_prior',
  'model_inference',
  'observed_history',
  'outcome_evidence',
  'contradiction',
  'counterevidence',
  'unknown',
]);

export const CONFIDENCE_STATES = Object.freeze([
  'KNOWN',
  'STRONGLY_SUPPORTED',
  'SUPPORTED_HYPOTHESIS',
  'TENTATIVE',
  'INSUFFICIENT_EVIDENCE',
]);

export const ROLE_FIT_STATES = Object.freeze([
  'NATURAL_FIT',
  'ADAPTABLE_FIT',
  'COMPENSATED_FIT',
  'SEAT_RISK',
  'INSUFFICIENT_EVIDENCE',
]);

export const RUNTIME_STAGES = Object.freeze([
  'raw_evidence',
  'vector_priors',
  'cross_vector_topology',
  'higher_order_attributes',
  'causal_dynamics',
  'specialized_intelligence',
  'evidence_certainty',
  'personality_dna',
  'whole_person_model',
  'customer_surfaces',
]);

export const SURFACES = Object.freeze([
  Object.freeze({ id: 'this_is_you', number: 1, label: 'This Is You', destination: 'recognition', bibleIds: [15, 14] }),
  Object.freeze({ id: 'personality_dna', number: 2, label: 'Personality DNA', destination: 'recognition', bibleIds: [1, 2, 3, 15] }),
  Object.freeze({ id: 'how_you_operate', number: 3, label: 'How You Operate', destination: 'operating', bibleIds: [2, 3, 4, 10] }),
  Object.freeze({ id: 'how_people_experience_you', number: 4, label: 'How People Experience You', destination: 'people', bibleIds: [5, 6, 9, 14] }),
  Object.freeze({ id: 'communication_dna', number: 5, label: 'Communication DNA', destination: 'people', bibleIds: [6, 14] }),
  Object.freeze({ id: 'strengths_vulnerabilities', number: 6, label: 'Strengths & Vulnerabilities', destination: 'pressure', bibleIds: [3, 4, 5] }),
  Object.freeze({ id: 'pressure_conflict', number: 7, label: 'Pressure & Conflict', destination: 'pressure', bibleIds: [5, 6] }),
  Object.freeze({ id: 'work_dna', number: 8, label: 'Work DNA', destination: 'work', bibleIds: [7, 3, 4] }),
  Object.freeze({ id: 'role_seat', number: 9, label: 'Role & Seat Intelligence', destination: 'work', bibleIds: [8, 9, 14] }),
  Object.freeze({ id: 'cognitive_operating_style', number: 10, label: 'Cognitive Operating Style', destination: 'dna', bibleIds: [10, 14] }),
  Object.freeze({ id: 'personal_operating_energy', number: 11, label: 'Personal Operating Energy', destination: 'dna', bibleIds: [11, 14] }),
  Object.freeze({ id: 'five_futures', number: 12, label: 'Your Five Futures', destination: 'futures', bibleIds: [12, 4, 14, 15] }),
  Object.freeze({ id: 'one_move', number: 13, label: 'Your One Move', destination: 'futures', bibleIds: [13, 4, 12, 14] }),
  Object.freeze({ id: 'evidence_certainty', number: 14, label: 'Evidence & Certainty', destination: 'evidence', bibleIds: [14] }),
  Object.freeze({ id: 'operating_identity', number: 15, label: 'Your Operating Identity', destination: 'recognition', bibleIds: [15, 14] }),
]);

export const DESTINATIONS = Object.freeze([
  Object.freeze({ id: 'recognition', label: 'You', surfaceIds: ['this_is_you', 'operating_identity', 'personality_dna'] }),
  Object.freeze({ id: 'visual_bos', label: 'Visual BOS', surfaceIds: [], experience: 'visual_bos' }),
  Object.freeze({ id: 'operating', label: 'How You Operate', surfaceIds: ['how_you_operate'] }),
  Object.freeze({ id: 'people', label: 'People & Communication', surfaceIds: ['how_people_experience_you', 'communication_dna'] }),
  Object.freeze({ id: 'pressure', label: 'Strength & Pressure', surfaceIds: ['strengths_vulnerabilities', 'pressure_conflict'] }),
  Object.freeze({ id: 'work', label: 'Work & Role', surfaceIds: ['work_dna', 'role_seat'] }),
  Object.freeze({ id: 'dna', label: 'Mind & Energy', surfaceIds: ['cognitive_operating_style', 'personal_operating_energy'] }),
  Object.freeze({ id: 'futures', label: 'Futures & One Move', surfaceIds: ['five_futures', 'one_move'] }),
  Object.freeze({ id: 'evidence', label: 'The Validation', surfaceIds: ['evidence_certainty'] }),
]);

export const FINAL_COMMUNICATION_DOCTRINE = Object.freeze([
  'Take time to fully read and understand the whole person. Do not start until you understand them.',
  'Now talk to the customer as you would in a coaching conversation. Help them understand themselves.',
]);

const WHOLE_PERSON_UNDERSTANDING_INSTRUCTION = FINAL_COMMUNICATION_DOCTRINE[0];

export const SURFACE_HUMAN_MISSIONS = Object.freeze({
  this_is_you: FINAL_COMMUNICATION_DOCTRINE[1],
  operating_identity: 'Now talk to the customer as you would in a coaching conversation. Help them understand the deeper operating logic that seems to follow them from situation to situation—the part of themselves that, once they see it, could help them make sense of their own behavior in the future.',
  personality_dna: 'Now talk to the customer as you would in a coaching conversation. Help them understand what seems to be underneath the way they naturally operate—how the different parts of them work together, where they reinforce each other, where they pull against each other, and why the combination creates the person they recognize as themselves.',
  how_you_operate: 'Now talk to the customer as you would in a coaching conversation. Help them understand how they actually operate when life and work are happening—how they think, decide, organize themselves, move into action, adjust when things change, solve problems, and get things across the finish line.',
  how_people_experience_you: 'Now talk to the customer as you would in a coaching conversation. Help them see themselves from the other side of the table. Help them understand what it may be like to work with them, be led by them, disagree with them, rely on them, frustrate them, or be around them when the pressure rises. Be clear about what we know and what we are only helping them consider.',
  communication_dna: 'Now talk to the customer as you would in a coaching conversation. Help them understand what it is actually like to communicate with them—how they tend to listen, explain, respond, decide when to speak, handle disagreement, change when the stakes rise, and reconnect when something does not land the way they intended. Help them see why communication that feels natural to them may not always feel the same to someone else.',
  strengths_vulnerabilities: 'Now talk to the customer as you would in a coaching conversation. Help them understand the things they do exceptionally well—and especially the places where something that genuinely works for them can quietly begin costing them. Help them see why they keep doing it, what it gives them, and when the same strength starts working against what they want.',
  pressure_conflict: 'Now talk to the customer as you would in a coaching conversation. Help them understand what happens to them when the pressure rises or something important starts going wrong. Show them what changes, what becomes harder to access, what other people may encounter, how conflict tends to develop, and what helps them find their way back to themselves afterward.',
  work_dna: 'Now talk to the customer as you would in a coaching conversation. Help them understand the kind of work and working environment that brings out the best in them—and the kinds of conditions they may be perfectly capable of handling but that slowly make them less effective, less energized, or more dependent on effort than they should have to be.',
  role_seat: 'Now talk to the customer as you would in a coaching conversation. Help them understand what kind of seat allows this particular version of them to be at their best. Help them see which demands come naturally, which they can grow into, which they can handle but at a cost, and which could eventually put the wrong version of them in the job. Talk about the person and the demands of the role—not personality stereotypes or job titles.',
  cognitive_operating_style: 'Now talk to the customer as you would in a coaching conversation. Help them understand what you notice about the way their mind works when they are actually trying to figure something out—how they make sense of information, solve problems, notice patterns, learn, reconsider, connect ideas, and find a workable answer when the answer is not obvious.',
  personal_operating_energy: 'Now talk to the customer as you would in a coaching conversation. Help them understand what seems to bring them to life, what pulls energy out of them, what happens to their energy under different kinds of pressure and responsibility, and what seems to help them recover. Help them separate who they generally are from what may simply be true of this season or situation.',
  five_futures: 'Now talk to the customer as you would in a coaching conversation. Based on the whole person you understand, show them five genuinely different ways their life, work, or way of operating could develop from here. Help them see what would have to be true for each future to become more likely, what signs would tell them it was beginning to happen, and what they could do that might change the direction.',
  one_move: 'Now talk to the customer as you would in a coaching conversation. Given everything you understand about them, tell them the one move you would most want them to try next. Make it something small enough to actually test, important enough to matter, and clear enough that they will know whether it helped.',
  evidence_certainty: 'Now talk to the customer as you would in a coaching conversation. Show them why you believe what you have told them. Help them understand what we know, what we believe strongly, what we are still figuring out, where the picture is incomplete or contradictory, and what we would need to see to change our mind.',
});

export const SURFACE_COMMUNICATION_DOCTRINES = Object.freeze(Object.fromEntries(
  SURFACES.map(({ id }) => [
    id,
    id === 'this_is_you'
      ? FINAL_COMMUNICATION_DOCTRINE
      : Object.freeze([WHOLE_PERSON_UNDERSTANDING_INSTRUCTION, SURFACE_HUMAN_MISSIONS[id]]),
  ]),
));

export function communicationDoctrineForSurface(surfaceId) {
  const doctrine = SURFACE_COMMUNICATION_DOCTRINES[surfaceId];
  if (!doctrine) throw new Error(`Unknown New BOS surface mission: ${surfaceId}`);
  return doctrine;
}

export const FORBIDDEN_WHOLE_PERSON_LANGUAGE = Object.freeze([
  'command',
  'tempo',
  'relational awareness',
  'precision',
  'leverage',
  'adaptability',
  'structure score',
  'perspective score',
  'vector',
  'dimension',
  'assessment',
  'measured pattern',
]);
