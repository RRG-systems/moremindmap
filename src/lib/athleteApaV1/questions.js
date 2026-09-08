export const ATHLETE_APA_INTAKE_VERSION = 'athlete-apa-intake-v1.14-synthetic-20260904'

export const DEFAULT_ATHLETE_APA_QUESTIONS = Object.freeze([
  {
    id: 'APA01',
    mode: 'joint',
    responseShape: 'structured+narrative',
    prompt: 'What sport are we mapping, and what does the current season or training phase look like?',
    evidenceTargets: ['sport_context', 'current_phase'],
  },
  {
    id: 'APA02',
    mode: 'athlete',
    responseShape: 'narrative',
    prompt: 'What do you want to be different by the end of this season or training phase—and why does that matter to you?',
    evidenceTargets: ['athlete_goal', 'athlete_meaning'],
  },
  {
    id: 'APA03',
    mode: 'instructor',
    responseShape: 'narrative',
    prompt: 'What outcomes or development priorities are you helping this athlete work toward right now?',
    evidenceTargets: ['instructor_priority'],
  },
  {
    id: 'APA04',
    mode: 'joint',
    responseShape: 'narrative',
    prompt: 'Where do your answers about the current goal match, and where do they differ?',
    evidenceTargets: ['shared_goal', 'goal_difference'],
  },
  {
    id: 'APA05',
    mode: 'athlete',
    responseShape: 'narrative',
    prompt: 'What are you focused on improving in the sport right now? Give one recent example.',
    evidenceTargets: ['athlete_focus', 'recent_example'],
  },
  {
    id: 'APA06',
    mode: 'instructor',
    responseShape: 'narrative',
    prompt: 'What are you focusing on in training right now? Give one recent example.',
    evidenceTargets: ['instructor_focus', 'instructor_observation'],
  },
  {
    id: 'APA07',
    mode: 'separate-both',
    responseShape: 'narrative',
    prompt: 'What is working well right now? Athlete and instructor: add your own example if you have one.',
    evidenceTargets: ['current_asset'],
  },
  {
    id: 'APA08',
    mode: 'separate-both',
    responseShape: 'narrative',
    prompt: 'Where is performance or progress inconsistent, frustrating, or stuck? Describe what each of you sees.',
    evidenceTargets: ['current_gap', 'source_difference'],
  },
  {
    id: 'APA09',
    mode: 'joint',
    responseShape: 'narrative',
    prompt: 'What are you currently trying together? What has actually been attempted—not just discussed?',
    evidenceTargets: ['current_attempt', 'execution_state'],
  },
  {
    id: 'APA10',
    mode: 'separate-both',
    responseShape: 'narrative',
    prompt: 'What has improved recently? What evidence makes you say that?',
    evidenceTargets: ['recent_change', 'change_evidence'],
  },
  {
    id: 'APA11',
    mode: 'separate-both',
    responseShape: 'narrative',
    prompt: 'What has not improved despite effort? What was tried, for how long, and under what conditions?',
    evidenceTargets: ['persistent_gap', 'attempt_conditions'],
  },
  {
    id: 'APA12',
    mode: 'separate-both',
    responseShape: 'structured+narrative',
    prompt: 'What current constraints matter most—schedule, recovery, school, travel, access, qualified health restrictions, or something else?',
    evidenceTargets: ['current_constraint'],
  },
  {
    id: 'APA13',
    mode: 'joint',
    responseShape: 'structured+narrative',
    prompt: 'What upcoming event, tryout, role, recruiting, return, or transition matters now? If none, say none.',
    evidenceTargets: ['upcoming_event'],
  },
  {
    id: 'APA14',
    mode: 'joint',
    responseShape: 'structured+narrative',
    prompt: 'What objective or observed evidence can we legitimately use now—and what important evidence is missing?',
    evidenceTargets: ['objective_evidence', 'missing_evidence'],
  },
])

// This cassette is wholly fictional. It proves that Box 1 language and
// elicitation can change without changing the normalized APA contract.
export const FICTIONAL_NORTHSTAR_QUESTIONS = Object.freeze([
  { id: 'NS01', mode: 'joint', responseShape: 'structured+narrative', prompt: 'Name the sport, the current phase, and the next event that makes this moment matter.', evidenceTargets: ['sport_context', 'current_phase', 'upcoming_event'] },
  { id: 'NS02', mode: 'athlete', responseShape: 'narrative', prompt: 'What are you trying to make more possible in this phase?', evidenceTargets: ['athlete_goal', 'athlete_meaning'] },
  { id: 'NS03', mode: 'instructor', responseShape: 'narrative', prompt: 'What development are you trying to make more possible for this athlete?', evidenceTargets: ['instructor_priority'] },
  { id: 'NS04', mode: 'joint', responseShape: 'narrative', prompt: 'What part of that direction is shared, and what part is still different?', evidenceTargets: ['shared_goal', 'goal_difference'] },
  { id: 'NS05', mode: 'separate-both', responseShape: 'narrative', prompt: 'What conditions help useful performance show up? Give one example from each point of view.', evidenceTargets: ['current_asset', 'athlete_focus', 'instructor_focus'] },
  { id: 'NS06', mode: 'separate-both', responseShape: 'narrative', prompt: 'What signals tell each of you that something is not working yet?', evidenceTargets: ['current_gap', 'source_difference'] },
  { id: 'NS07', mode: 'joint', responseShape: 'narrative', prompt: 'What response are you trying now, and what has actually happened so far?', evidenceTargets: ['current_attempt', 'execution_state'] },
  { id: 'NS08', mode: 'separate-both', responseShape: 'narrative', prompt: 'What changed recently, if anything, and what supports that view?', evidenceTargets: ['recent_change', 'change_evidence'] },
  { id: 'NS09', mode: 'separate-both', responseShape: 'narrative', prompt: 'What has stayed hard even with effort? Include the conditions around the attempts.', evidenceTargets: ['persistent_gap', 'attempt_conditions'] },
  { id: 'NS10', mode: 'separate-both', responseShape: 'structured+narrative', prompt: 'What limits or pressures are part of the current conditions?', evidenceTargets: ['current_constraint'] },
  { id: 'NS11', mode: 'joint', responseShape: 'structured+narrative', prompt: 'What observed or objective records are safe and useful to bring into this map?', evidenceTargets: ['objective_evidence'] },
  { id: 'NS12', mode: 'joint', responseShape: 'narrative', prompt: 'What do we still need to see before either of you would trust a stronger conclusion?', evidenceTargets: ['missing_evidence'] },
])

export function validateQuestionSet(questions) {
  if (!Array.isArray(questions) || questions.length < 12 || questions.length > 15) throw new Error('ATHLETE_APA_QUESTION_COUNT_OUT_OF_RANGE')
  if (new Set(questions.map((question) => question.id)).size !== questions.length) throw new Error('ATHLETE_APA_DUPLICATE_QUESTION_ID')
  for (const question of questions) {
    if (!question.prompt?.trim() || !question.mode || !question.responseShape || !question.evidenceTargets?.length) throw new Error('ATHLETE_APA_INCOMPLETE_QUESTION')
  }
  return questions
}
