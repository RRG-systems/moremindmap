// The Athlete BOS uses the proven New BOS realization topology without
// importing adult scores, roles, or business meaning. The IDs remain stable so
// the shared BOS chassis can address a familiar 15-surface contract; labels,
// missions, destinations, evidence, and meaning are Athlete-specific.
export const ATHLETE_BOS_PERSONALITY_DNA_ARCHITECTURE_VERSION = 'athlete_bos_personality_dna_architecture_v1';
export const ATHLETE_BOS_SEMANTIC_STAGE_VERSION = 'athlete_bos_four_stage_semantic_runtime_v6';
export const ATHLETE_BOS_SURFACE_TRUTH_VERSION = 'athlete_bos_surface_truth_v4';
export const ATHLETE_BOS_WHOLE_PERSON_VERSION = 'athlete_bos_vector_free_whole_person_v1';
export const ATHLETE_BOS_MAP_VERSION = 'athlete_bos_whole_athlete_map_v1';

const surface = (id, number, label, destination, mission, domainId = null) => Object.freeze({
  id,
  number,
  label,
  destination,
  mission,
  domainId,
});

export const ATHLETE_BOS_SURFACES = Object.freeze([
  surface('this_is_you', 1, 'This Is You', 'recognition', 'Help this young person recognize themselves in one specific, useful truth. Let the tension and context make the recognition feel individual; keep what is still changing visible.', null),
  surface('personality_dna', 2, 'Your Personality DNA', 'recognition', 'Help the athlete understand how the supported parts of them work together, reinforce one another, or pull against one another. This is a whole-person explanation without scores, a fixed type, or a claim that one moment defines them.', 'personality_dna'),
  surface('how_you_operate', 3, 'How You Prepare & Act', 'operating', 'Help the athlete see how they actually move through a real situation: how they prepare, notice, choose, begin, adjust, ask, and follow through. Distinguish what they chose from what the setting or another person controlled.', 'preparation_and_action'),
  surface('how_people_experience_you', 4, 'How Others May Experience You', 'people', 'Help the athlete carefully see the other side of an interaction using only the words or actions they actually reported. Show how an understandable intention may land differently without inventing another person\'s motives.', 'people_experience'),
  surface('communication_dna', 5, 'How You Communicate', 'people', 'Help the athlete understand how they take in instructions or feedback, ask, explain, respond, repair, and change when the situation changes. Stay with the situations they actually described.', 'communication'),
  surface('strengths_vulnerabilities', 6, 'Strengths & When They Get in Your Way', 'pressure', 'Help the athlete see something that genuinely works for them, why it works, and—only where the evidence supports it—when the same strength or habit can become less useful.', 'strengths_and_overuse'),
  surface('pressure_conflict', 7, 'Under Pressure & After Difficulty', 'pressure', 'Help the athlete understand what changed in the pressure or difficulty they described, what became harder to notice or do, and what helped next. One episode remains one episode unless separate events support more.', 'pressure_and_recovery'),
  surface('work_dna', 8, 'Sport, School & Responsibilities', 'work_life', 'Help the athlete understand how sport, school, work, home, and other responsibilities meet in their actual week—where their choices helped and where time, access, or other people shaped the outcome.', 'sport_school_responsibilities'),
  surface('role_seat', 9, 'Conditions That Help You Grow', 'work_life', 'Help the athlete see which supported conditions, relationships, access, explanations, or kinds of help may make learning and development easier. Describe conditions, not a fixed role, position, coachability rank, or fit score.', 'growth_conditions'),
  surface('cognitive_operating_style', 10, 'How You Learn & Solve Problems', 'dna', 'Help the athlete understand what the reported moments suggest about how they make sense of something unfamiliar, try it, notice a gap, ask, revise, and find a workable answer. Do not turn one task into a fixed learning style.', 'learning_and_problem_solving'),
  surface('personal_operating_energy', 11, 'Energy, Capacity & Recovery', 'dna', 'Help the athlete understand what the current season says about available room, demands, strain, and recovery. Separate current capacity from identity, ambition, toughness, talent, or worth.', 'energy_capacity_and_recovery'),
  surface('five_futures', 12, 'Possible Futures', 'futures', 'Show zero to five genuinely different conditional ways the athlete\'s chosen sport or life directions could develop. Each path must differ materially in goal, mechanism, or trajectory—not merely describe the same routine under different conditions. Never predict selection, college, scholarship, career, or professional sport.', null),
  surface('one_move', 13, 'One Useful Move', 'futures', 'Offer one small, reversible, evidence-grounded exploration, maintenance choice, pause, qualified-person question, or explicit abstention. Make it clear enough to observe and safe enough to stop. It is not a commitment.', null),
  surface('evidence_certainty', 14, 'What We Know & What Is Still Open', 'evidence', 'Help the athlete see, in ordinary language, why this reading says what it says: what came directly from their account, what is a careful interpretation, what conflicts, and what could change the picture. Do not recite the whole dossier.', null),
  surface('operating_identity', 15, 'What Ties It Together', 'recognition', 'Give the athlete a memorable, revisable explanation of the deeper logic connecting several supported moments. Keep it individual without turning it into a fixed identity.', null),
]);

export const ATHLETE_BOS_DESTINATIONS = Object.freeze([
  Object.freeze({ id: 'recognition', label: 'You', surfaceIds: Object.freeze(['this_is_you', 'operating_identity', 'personality_dna']) }),
  Object.freeze({ id: 'visual_bos', label: 'Your Whole Map', surfaceIds: Object.freeze([]), experience: 'visual_bos' }),
  Object.freeze({ id: 'operating', label: 'Prepare & Act', surfaceIds: Object.freeze(['how_you_operate']) }),
  Object.freeze({ id: 'people', label: 'People & Communication', surfaceIds: Object.freeze(['how_people_experience_you', 'communication_dna']) }),
  Object.freeze({ id: 'pressure', label: 'Strength & Pressure', surfaceIds: Object.freeze(['strengths_vulnerabilities', 'pressure_conflict']) }),
  Object.freeze({ id: 'work_life', label: 'Sport, School & Life', surfaceIds: Object.freeze(['work_dna', 'role_seat']) }),
  Object.freeze({ id: 'dna', label: 'Learning & Energy', surfaceIds: Object.freeze(['cognitive_operating_style', 'personal_operating_energy']) }),
  Object.freeze({ id: 'futures', label: 'Futures & One Move', surfaceIds: Object.freeze(['five_futures', 'one_move']) }),
  Object.freeze({ id: 'evidence', label: 'What We Know', surfaceIds: Object.freeze(['evidence_certainty']) }),
]);

export const ATHLETE_BOS_OPERATING_DOMAINS = Object.freeze([
  Object.freeze({ id: 'personality_dna', label: 'Personality DNA' }),
  Object.freeze({ id: 'preparation_and_action', label: 'Preparation and action' }),
  Object.freeze({ id: 'people_experience', label: 'How others may experience the athlete' }),
  Object.freeze({ id: 'communication', label: 'Communication and feedback' }),
  Object.freeze({ id: 'strengths_and_overuse', label: 'Strengths and when they become less useful' }),
  Object.freeze({ id: 'pressure_and_recovery', label: 'Pressure and recovery' }),
  Object.freeze({ id: 'sport_school_responsibilities', label: 'Sport, school, and responsibilities' }),
  Object.freeze({ id: 'growth_conditions', label: 'Conditions that help growth' }),
  Object.freeze({ id: 'learning_and_problem_solving', label: 'Learning and problem solving' }),
  Object.freeze({ id: 'energy_capacity_and_recovery', label: 'Energy, capacity, and recovery' }),
]);

export const ATHLETE_BOS_SEMANTIC_STAGES = Object.freeze([
  Object.freeze({ id: 'causal_foundation', order: 1, dependencies: Object.freeze([]), mission: 'Establish the governed causal foundation: supported claims, trigger-to-meaning-to-response dynamics, sequences, strengths and overuse, compensation, contradictions, goals, life hopes, alternatives, and unknowns. One episode is not a durable tendency.' }),
  Object.freeze({ id: 'operating_domains', order: 2, dependencies: Object.freeze(['causal_foundation']), mission: 'Develop the ten distinct Athlete operating domains from existing governed claim and evidence references, leaving a domain open when evidence is insufficient.' }),
  Object.freeze({ id: 'whole_person_decision_synthesis', order: 3, dependencies: Object.freeze(['causal_foundation', 'operating_domains']), mission: 'Synthesize a vector-free whole athlete, a non-scored Athlete map, zero to five conditional Futures, and one optional reversible Move or abstention.' }),
  Object.freeze({ id: 'surface_routing', order: 4, dependencies: Object.freeze(['causal_foundation', 'operating_domains', 'whole_person_decision_synthesis']), mission: 'Route a deliberately small, surface-owned set of existing claim, causal-item, and evidence references to all 15 canonical surfaces. Design the complete set as fifteen distinct revelations about the same person, not fifteen visual treatments of the same few stories. Each domain surface must do its own job. Do not let one event dominate unrelated domain surfaces; reuse it only when the new surface reveals a materially different mechanism and no better supported event can do that job. A supported domain may use one specific event, but the whole set must distribute distinct events and tensions across sport, school, relationships, responsibilities, pressure, learning, repair, and change when the evidence allows. If distinct evidence is unavailable, abstain instead of filling a surface by repetition. Choose one exact short Athlete-facing editorial headline for every surface while you can see the complete 15-surface set. Every headline must reveal a specific tension, mechanism, or recognition—not a generic capability, a count of sections or paths, an analyst classification, or the registry label. All 15 headlines must be customer-safe and unique after case, punctuation, whitespace, and apostrophe normalization. Personality DNA must receive the strongest supported interacting whole-person mechanisms, without scores. Conditions That Help You Grow is an Athlete growth-conditions surface, not an adult role, position, or seat judgment: when the governed growth_conditions domain has support, route that support rather than abstaining only because no team role can be named. What We Know may inspect the full governed record underneath, but its first customer explanation still needs a selective route. Empty surfaces must carry an explicit abstention rather than invented meaning and must still receive their own exact editorial headline.' }),
]);

export const athleteBosSurfaceById = (surfaceId) => ATHLETE_BOS_SURFACES.find(({ id }) => id === surfaceId) || null;
export const athleteBosStageById = (stageId) => ATHLETE_BOS_SEMANTIC_STAGES.find(({ id }) => id === stageId) || null;

export function athleteSurfaceWriterInstruction(surfaceId) {
  const entry = athleteBosSurfaceById(surfaceId);
  if (!entry) throw new Error('ATHLETE_SURFACE_UNKNOWN');
  const compact = ['this_is_you', 'one_move', 'operating_identity'].includes(surfaceId);
  const evidence = surfaceId === 'evidence_certainty';
  return Object.freeze([
    'Take time to understand the supplied whole young person and the local truth selected for this surface. Do not start writing until you understand both.',
    'Now speak directly to the athlete as you would in a thoughtful coaching conversation with a 14–20-year-old. Make this feel like an editorial reading about one recognizable person—not a dashboard, test score, evidence memo, coaching script, classroom handout, or simplified youth version of the adult product. Respect the athlete’s intelligence and never write down to them.',
    entry.mission,
    'Give this surface its own revelation. Do not repeat the whole reading or reuse an example simply because it is available. Prefer the smallest set of examples that makes this surface specific and useful. If the routed truth cannot support a distinct revelation, say what remains open instead of stretching a familiar story.',
    'Use one primary concrete moment when it is needed; use a second only when it adds a genuinely different contrast. When a moment was already explained elsewhere, refer to its meaning without replaying the whole story.',
    'Chronology is not causation. Never say that a question, pause, routine, cue, support, feeling, or other action produced an outcome unless the supplied words explicitly establish that connection. Words such as preserved, protected, left time for, enabled, allowed, caused, made possible, and felt right because are causal or motive attributions, not neutral summaries; use them only when the supplied words explicitly attribute that exact relationship. A question establishes only that it was asked; it does not establish an answer, clarification, feedback, guidance, or other input unless the supplied words report that response. A later observation, hearing, action, or outcome cannot be backfilled as the answer or input to an earlier question unless the source explicitly connects them. Answers linked to the same event do not establish their relative order unless their wording or governed timestamps do. If someone could not find an item, do not say the item was missing unless the source says that. A stated wish to preserve flexibility does not establish current dependence, rigidity, compulsion, or inability to adapt. If several things changed together, say what happened in order and keep the helpful part open. Never turn a desired, proposed, or hypothetical action into something already tried or successful. Never broaden an outcome supported for one component to a bundle of actions.',
    'Begin with one short, personalized Markdown heading that could only belong to this athlete. Make it reveal the surface’s specific tension, mechanism, or recognition. Do not use a generic capability heading such as “You Can…”, a numbered/list heading such as “Three Paths…”, an analyst classification, or the section label. Personalize through meaning rather than routinely starting the heading with the athlete’s name. Follow it with clear prose and only the structure—short paragraphs, a brief list, or a short quotation—that makes this particular idea easier to understand.',
    evidence
      ? 'Aim for roughly 130–190 words and do not exceed 220. Explain the levels of certainty through selected examples instead of replaying every answer.'
      : compact
        ? 'Aim for roughly 60–95 words and do not exceed 120.'
        : 'Aim for roughly 80–120 words and do not exceed 150.',
    'Use only the supplied local facts and careful interpretations. Add no biography, motive, diagnosis, score, fixed type, promise, prediction, or private detail that does not need to be said. If this surface is open, say that simply and respectfully. Never expose internal IDs or phrases such as event root, same-root items, bounded baseline, adult business role, or role/seat.',
  ]);
}
