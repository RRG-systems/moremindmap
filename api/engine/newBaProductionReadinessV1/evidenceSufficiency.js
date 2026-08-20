import { isSha256, sha256Stable } from './stable.js';

export const BA_EVIDENCE_SUFFICIENCY_CONTRACT = Object.freeze({
  contract_id: 'ba-evidence-sufficiency-v1',
  version: '1.0.0',
  doctrine: 'missing evidence remains explicit and localized; it is never fabricated or silently converted to not-applicable',
});

export const BA_QUESTION_KEYS = Object.freeze(Array.from({ length: 12 }, (_, index) => `q${index + 1}`));

export const BA_QUESTION_AUTHORITY = Object.freeze({
  q1: Object.freeze({ purpose: 'Business Awareness Reality', primary_domain: 'demand', secondary_domains: ['pipeline', 'goals'], customer_question: 'How customers currently become aware of the business', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'EVIDENCE'] }),
  q2: Object.freeze({ purpose: 'Desired Future', primary_domain: 'goals', secondary_domains: ['stage', 'capacity'], customer_question: 'The business outcome the owner wants to create', affected_surfaces: ['NOW', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] }),
  q3: Object.freeze({ purpose: 'Relationship Asset Reality', primary_domain: 'relationship', secondary_domains: ['demand'], customer_question: 'The current relationship asset and how it contributes to demand', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'EVIDENCE'] }),
  q4: Object.freeze({ purpose: 'Business Generation Behavior', primary_domain: 'demand', secondary_domains: ['relationship', 'conversion'], customer_question: 'How the business currently creates new opportunities', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'EVIDENCE'] }),
  q5: Object.freeze({ purpose: 'Database Intelligence', primary_domain: 'relationship', secondary_domains: ['pipeline', 'conversion', 'operations'], customer_question: 'How relationship and database intelligence is organized and used', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] }),
  q6: Object.freeze({ purpose: 'Lead Generation Reality', primary_domain: 'demand', secondary_domains: ['capacity', 'operations'], customer_question: 'How lead generation currently operates', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'PLAN', 'EVIDENCE'] }),
  q7: Object.freeze({ purpose: 'Accountability Reality', primary_domain: 'accountability', secondary_domains: ['operations', 'team'], customer_question: 'How accountability currently works', affected_surfaces: ['NOW', 'WHY', 'MOVE', 'PLAN', 'EVIDENCE'] }),
  q8: Object.freeze({ purpose: 'Systems Reality', primary_domain: 'operations', secondary_domains: ['listing', 'buyer', 'conversion', 'transaction'], customer_question: 'Which operating systems exist and how consistently they work', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] }),
  q9: Object.freeze({ purpose: 'Financial Reality', primary_domain: 'financial', secondary_domains: ['stage', 'capacity'], customer_question: 'The current financial reality of the business', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'PLAN', 'EVIDENCE'] }),
  q10: Object.freeze({ purpose: 'Constraint Reality', primary_domain: 'constraints', secondary_domains: ['capacity', 'operations'], customer_question: 'The most important current business constraint', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] }),
  q11: Object.freeze({ purpose: 'Team Reality', primary_domain: 'team', secondary_domains: ['capacity', 'accountability'], customer_question: 'The current team structure, ownership, and capacity', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] }),
  q12: Object.freeze({ purpose: 'Scaling Reality', primary_domain: 'capacity', secondary_domains: ['stage', 'team', 'operations'], customer_question: 'What currently limits or enables the business to scale', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] }),
});

const REQUIRED_MISSIONS = Object.freeze([
  Object.freeze({ mission_id: 'GOAL_ANCHOR', questions: Object.freeze(['q2']), description: 'A governed desired-business outcome is available.' }),
  Object.freeze({ mission_id: 'DEMAND_RELATIONSHIP_REALITY', questions: Object.freeze(['q1', 'q3', 'q4', 'q5', 'q6']), description: 'At least one governed demand or relationship reality is available.' }),
  Object.freeze({ mission_id: 'OPERATING_REALITY', questions: Object.freeze(['q5', 'q7', 'q8']), description: 'At least one governed operating, system, or accountability reality is available.' }),
  Object.freeze({ mission_id: 'CONSTRAINT_ANCHOR', questions: Object.freeze(['q10']), description: 'A governed current constraint is available.' }),
  Object.freeze({ mission_id: 'SCALING_CAPACITY_ANCHOR', questions: Object.freeze(['q12']), description: 'A governed scaling or capacity reality is available.' }),
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function explicitNotApplicableKeys(states = {}) {
  return BA_QUESTION_KEYS.filter((key) => {
    const state = states?.[key];
    return state?.state === 'NOT_APPLICABLE'
      && Array.isArray(state.evidence_refs)
      && state.evidence_refs.length > 0
      && typeof state.reason === 'string'
      && state.reason.trim().length > 0;
  });
}

export function classifyBaEvidenceSufficiency({ answers = {}, answerSha256 = {}, explicit_question_states = {} } = {}) {
  const notApplicable = explicitNotApplicableKeys(explicit_question_states);
  const answered = BA_QUESTION_KEYS.filter((key) => typeof answers?.[key] === 'string' && answers[key].trim().length > 0);
  const malformedHashes = answered.filter((key) => !isSha256(answerSha256?.[key]));
  const unanswered = BA_QUESTION_KEYS.filter((key) => !answered.includes(key) && !notApplicable.includes(key));
  const missionCoverage = REQUIRED_MISSIONS.map((mission) => {
    const evidenceQuestions = mission.questions.filter((key) => answered.includes(key));
    return Object.freeze({ ...mission, satisfied: evidenceQuestions.length > 0, evidence_questions: Object.freeze(evidenceQuestions) });
  });
  const failedMissions = missionCoverage.filter((mission) => !mission.satisfied).map((mission) => mission.mission_id);
  const localizedConsequences = unanswered.map((key) => {
    const authority = BA_QUESTION_AUTHORITY[key];
    return Object.freeze({
      question_key: key,
      state: 'UNKNOWN_UNANSWERED',
      customer_safe_missing_evidence: `${authority.customer_question} is not yet established from this assessment.`,
      primary_domain: authority.primary_domain,
      secondary_domains: authority.secondary_domains,
      affected_surfaces: authority.affected_surfaces,
      prohibited_inferences: Object.freeze([
        `Do not infer ${authority.primary_domain} facts from the unanswered item.`,
        'Do not convert missing evidence to not-applicable without explicit governed evidence.',
      ]),
    });
  });
  const status = malformedHashes.length === 0 && failedMissions.length === 0 ? 'PASS' : 'FAIL';
  const compatibilityClass = status === 'PASS' ? (unanswered.length === 0 ? 'A' : 'B') : 'C';
  const result = {
    ...BA_EVIDENCE_SUFFICIENCY_CONTRACT,
    status,
    compatibility_class: compatibilityClass,
    automatic_rebuild: status === 'PASS',
    preserve_missingness: unanswered.length > 0,
    answered_questions: Object.freeze(answered),
    unanswered_questions: Object.freeze(unanswered),
    not_applicable_questions: Object.freeze(notApplicable),
    malformed_answer_hashes: Object.freeze(malformedHashes),
    mission_coverage: Object.freeze(missionCoverage),
    failed_missions: Object.freeze(failedMissions),
    localized_consequences: Object.freeze(localizedConsequences),
    reasons: Object.freeze(status === 'PASS'
      ? [unanswered.length === 0 ? 'complete_governed_business_evidence' : 'governed_business_evidence_sufficient_with_explicit_missingness']
      : [
          ...(malformedHashes.length ? ['governed_answer_hash_invalid'] : []),
          ...(failedMissions.length ? ['required_reasoning_mission_not_supported'] : []),
        ]),
  };
  return deepFreeze({ ...result, contract_sha256: sha256Stable({
    contract: BA_EVIDENCE_SUFFICIENCY_CONTRACT,
    question_authority: BA_QUESTION_AUTHORITY,
    required_missions: REQUIRED_MISSIONS,
  }) });
}

