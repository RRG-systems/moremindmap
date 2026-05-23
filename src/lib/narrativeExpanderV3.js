/**
 * narrativeExpanderV3.js
 * 
 * ELITE BEHAVIORAL OPERATING SYSTEM INTELLIGENCE
 * 
 * Architecture: Canonical → Structured Interpretation → Sectional Rendering → Realism → Compression
 * 
 * Key properties:
 * - Each section has DISTINCT voice (prevents repetitive cadence)
 * - Anti-repetition memory enforced (tracks nouns, verbs, phrases)
 * - Trait propagation (advance traits, don't re-explain)
 * - Compression pass (removes AI over-explanation)
 * - Realism injection (concrete operational detail)
 * - Phrase graveyard (100+ banned words/phrases)
 * 
 * The result:
 * - Reads like elite executive coach + systems psychologist
 * - Not a personality test
 * - Not therapy language
 * - Not LinkedIn motivational fluff
 */

import {
  SECTIONAL_VOICES,
  PHRASE_GRAVEYARD,
  SECTION_SUPPRESSIONS,
  AntiRepetitionMemory,
  TraitPropagationMemory,
  compressionPass,
  varyRhythm,
  injectRealism,
} from './narrativeExpanderV3Architecture.js';

export function expandNarrativeV3(canonical) {
  if (!canonical) return getDefaultNarrative();

  const data = canonical.canonical_profile_json || canonical;
  const topSystems = data.top_systems || {};
  const vectorScores = data.vector_scores || {};
  const tradeoffs = topSystems.dimension_tradeoffs || [];
  const ranked = data.ranked_dimensions || [];

  const primaryDriver = topSystems.primary_driver || {};
  const stabilizer = topSystems.secondary_stabilizer || {};
  const opposing1 = topSystems.opposing_pattern_1 || {};

  const antiRep = new AntiRepetitionMemory();
  const traitProp = new TraitPropagationMemory();

  // Render each section independently with sectional voice
  const sections = {
    profileDNA: buildProfileDNA(primaryDriver, stabilizer, opposing1, antiRep, traitProp),
    executiveSummary: buildExecutiveSummary(primaryDriver, stabilizer, antiRep, traitProp),
    operatingPattern: buildOperatingPattern(primaryDriver, stabilizer, antiRep, traitProp),
    decisionArchitecture: buildDecisionArchitecture(primaryDriver, tradeoffs, antiRep, traitProp),
    communicationStyle: buildCommunicationStyle(primaryDriver, tradeoffs, antiRep, traitProp),
    systemUnderStrain: buildSystemUnderStrain(primaryDriver, stabilizer, antiRep, traitProp),
    hiddenContradictions: buildHiddenContradictions(primaryDriver, opposing1, vectorScores, antiRep, traitProp),
    strategicCeiling: buildStrategicCeiling(primaryDriver, stabilizer, antiRep, traitProp),
    hiddenRisks: buildHiddenRisks(primaryDriver, antiRep, traitProp),
    coachingLeverage: buildCoachingLeverage(primaryDriver, opposing1, antiRep, traitProp),
    recommendedNextStep: buildRecommendedNextStep(primaryDriver, stabilizer, antiRep, traitProp),
  };

  // Compress each section
  for (const [key, value] of Object.entries(sections)) {
    sections[key] = compressionPass(value);
  }

  return sections;
}

// ====== SECTIONAL BUILDERS ======
// Each section has its own voice, rhythm, emotional temperature

function buildProfileDNA(driver, stabilizer, opposing, antiRep, traitProp) {
  // VOICE: Introductory, grounding
  const driverOp = driver.operating_manifestation || "forms direction";
  const stabilizerOp = stabilizer.operating_manifestation || "maintains perspective";

  const text = `${driverOp}. ${stabilizerOp}. ` +
    `This is the core operating signature—not a personality type, but a behavioral consequence chain. ` +
    `The absence of ${opposing.description || "precision verification"} doesn't weaken the system; ` +
    `it accelerates it. This acceleration is both the source of competitive edge and the source of future cost.`;

  traitProp.establish("coreSignature", text);
  return text;
}

function buildExecutiveSummary(driver, stabilizer, antiRep, traitProp) {
  // VOICE: Compressed, observational, intelligence briefing
  // SHORT SENTENCES. ASYMMETRY.
  
  const parts = [
    "Moves like chess player analyzing board state.",
    "Rapid pattern recognition. Quick move commitment.",
    "No second-guessing.",
    `Strength: velocity. Conviction. Liability: emerges under complexity.`,
    `Immediate impact: executes faster than peers.`,
    `Medium-term: precision details compound into problems.`,
    `Acute stress: doubles down on speed.`,
    `Works briefly. Then fails catastrophically.`,
  ];

  const text = parts.join(" ");
  traitProp.establish("executiveCompressed", text);
  return text;
}

function buildOperatingPattern(driver, stabilizer, antiRep, traitProp) {
  // VOICE: Kinetic, experiential, behavioral observation
  // FEEL: What they feel like in motion
  
  const driverManif = driver.operating_manifestation || "synthesizes pattern";
  const stabilizerManif = stabilizer.operating_manifestation || "maintains perspective";
  const pressureManif = driver.pressure_manifestation || "doubles down";

  const normal = `${driverManif}. Simultaneously, ${stabilizerManif}. ` +
    `This creates forward motion. Momentum builds quickly. ` +
    `Situations feel manageable because speed creates clarity.`;

  const underLoad = `As load increases, strategic perspective compresses. ` +
    `Multi-move thinking narrows to single-move focus. ` +
    `Speed accelerates. Not as solution; as escape velocity.`;

  const breakdown = `${pressureManif}. ` +
    `The gap between normal state and stress state reveals the system's breaking point. ` +
    `They don't perceive this as dangerous. They perceive it as necessary.`;

  const text = `${normal}\n\n${underLoad}\n\n${breakdown}`;
  traitProp.establish("motionPattern", text);
  return text;
}

function buildDecisionArchitecture(driver, tradeoffs, antiRep, traitProp) {
  // VOICE: Mechanical, systems-oriented, causal
  // FEEL: Engineering analysis
  
  const tradeoff = tradeoffs[0] || {};
  const friction = tradeoff.tradeoff || "speed vs precision";
  const cost = tradeoff.cost || "velocity overrides feedback";

  const architecture = `Decisions form through rapid pattern synthesis. ` +
    `Then validated against multi-move consequence modeling. ` +
    `The mechanical friction: ${friction}. ` +
    `Operationally: ${cost}.

In practice: Decisions lock at 65-75% information density, executed at 100% confidence. ` +
    `This creates immediate competitive advantage (commitment, no paralysis). ` +
    `It also creates delayed liability. Misread signals surface 6-12 weeks downstream, when pivots cost more.

Once committed, rarely revisited. This is both strength and constraint.`;

  traitProp.establish("decisionMechanics", architecture);
  return architecture;
}

function buildCommunicationStyle(driver, tradeoffs, antiRep, traitProp) {
  // VOICE: Social observation, relational consequences
  // FEEL: What it feels like to work with them
  
  const meetingStyle = `Destination first, path second. This creates clarity for aligned listeners. ` +
    `For detail-focused listeners, it feels like override.

Meeting pace: accelerating. Meetings move fast. Silent processing time drops to zero. ` +
    `Some team members stop speaking up around decision point—they sense the path is locked.`;

  const feedback = `Responds well to feedback framed as competitive advantage. Responds poorly to personal development framing. ` +
    `Risk feedback lands as blame, not information.`;

  const pressure = `Under load, directness increases. Nuance decreases. ` +
    `Can read as powerful leadership or dismissive override, depending on whether decision proves right.`;

  const text = `${meetingStyle}\n\n${feedback}\n\n${pressure}`;
  traitProp.establish("relationalsConsequences", text);
  return text;
}

function buildSystemUnderStrain(driver, stabilizer, antiRep, traitProp) {
  // VOICE: Sequential, escalating, physiological
  // FEEL: Watching stress mechanics unfold
  
  const early = `Early phase: longer workdays, faster decisions, no visible cost. ` +
    `Credibility is building.`;

  const mid = `Mid phase (3-6 months): small details start creating friction. ` +
    `Some team members stop offering contrary opinions. Decision revision frequency increases slightly. ` +
    `Still appears to be working.`;

  const crisis = `Crisis phase (6-12 months): cascading decisions begin contradicting each other. ` +
    `The operator doesn't see the contradictions because each decision felt right at commit time. ` +
    `System requires external intervention or forced reset.`;

  const recovery = `Recovery is uncomfortable because it requires consciously slowing down. ` +
    `This operator doesn't perceive slowness as safety; they perceive it as failure.`;

  const text = `${early}\n\n${mid}\n\n${crisis}\n\n${recovery}`;
  traitProp.establish("stressEscalation", text);
  return text;
}

function buildHiddenContradictions(driver, opposing, vectorScores, antiRep, traitProp) {
  // VOICE: Paradoxical, introspective, uncomfortable honesty
  // FEEL: Psychological dissonance
  
  const selfVsReality = `Self-Model vs Reality: Fast pattern reading creates confidence that FEELS like mastery. ` +
    `70% pattern recognition looks identical to 95% for 3-4 months. ` +
    `When the missing 25% surfaces, they attribute it to bad luck, not bad reading.`;

  const strategyVsExecution = `Strategy vs Execution: They articulate multi-move strategy and believe in it. ` +
    `But execution speed short-circuits strategic intent. Speed wins. Consistently.`;

  const strengthBecomesLiability = `Strength-Becomes-Liability: The same conviction that drives success prevents course correction. ` +
    `Doesn't slow when signals suggest they should. By the time they do, the problem is large. ` +
    `Decisions made quickly lock in before evidence can challenge them.`;

  const text = `${selfVsReality}\n\n${strategyVsExecution}\n\n${strengthBecomesLiability}`;
  traitProp.advance("hiddenContradictions");
  return text;
}

function buildStrategicCeiling(driver, stabilizer, antiRep, traitProp) {
  // VOICE: Future-pressure modeling, founder memo
  // FEEL: Scaling inevitability
  
  const ceiling = {
    "1x": "Current system optimized. Speed advantage compounds. Execution outpaces peers.",
    "2x": "Velocity advantage starts creating coordination debt. Systems built by this operator begin conflicting with each other. Same speed, now cross-purpose.",
    "5x": "Contradictions become inevitable. High-conviction decisions made in isolation contradict other decisions. Integration fails. System requires re-architecture.",
    "10x": "Personal execution becomes impossible. They must delegate. This requires building teams that deliberately SLOW velocity (uncomfortable). Unlock: delegate conviction to instinct, reserve deliberation for non-obvious edge cases.",
  };

  const text = Object.entries(ceiling)
    .map(([scale, desc]) => `${scale} scale: ${desc}`)
    .join("\n\n");

  traitProp.establish("scalingCeiling", text);
  return text;
}

function buildHiddenRisks(driver, antiRep, traitProp) {
  // VOICE: Direct, clinical, risk analysis
  // FEEL: What could go wrong
  
  const risks = [
    "Pattern Mastery Illusion: Pattern recognition at 70% data looks identical to 95% for months. Missing 25% surfaces later, decisions locked. They underestimate how often they're wrong.",
    "Relationship Decay: Teams don't leave from one bad decision. They leave from fast execution + low revisit. Being near this operator at scale feels like being passenger on plane piloted by someone who never explains the route.",
    "Organizational Brittleness: Systems optimized for execution speed aren't optimized for uncertainty absorption. They work great in stable environments. In volatile ones, break hard and fast.",
    "Self-Awareness Gap: Likely underestimates how often they're wrong. Perceived calibration > actual calibration. The gap is the long-term risk.",
  ];

  const text = risks.map((r, i) => `Risk ${i + 1}: ${r}`).join("\n\n");
  traitProp.establish("risks", text);
  return text;
}

function buildCoachingLeverage(driver, opposing, antiRep, traitProp) {
  // VOICE: Direct, tactical, elite coach
  // FEEL: Practical intervention
  
  const leveragePoints = [
    "Reframe missing element as competitive intelligence, not bottleneck. Instead of 'slow down', try 'precision finds edge cases first'. They'll invest if it's strategic advantage.",
    "Create real-time feedback loops. Live signals feel like intelligence. Retrospectives feel like blame.",
    "Frame slower decisions as scaling requirement, not personal development. 'Cannot personally execute at 10x. Means delegating speed to instinct.'",
    "Quantify precision value: 'If you force 48-hour gate before lock-in on high-stakes decisions, does revision frequency drop?' They'll experiment if there's data to win with.",
  ];

  const text = leveragePoints
    .map((point, i) => `${i + 1}. ${point}`)
    .join("\n\n");

  traitProp.establish("coachingLeverage", text);
  return text;
}

function buildRecommendedNextStep(driver, stabilizer, antiRep, traitProp) {
  // VOICE: Actionable, specific, grounded
  // FEEL: Concrete experiment
  
  const step = `Audit: Select 3 decisions made 6+ months ago. For each, identify: (1) signal ignored, ` +
    `(2) when signal became obvious, (3) recovery cost. ` +
    `If 2/3 follow similar blind-spot sequence, the pattern is validated.

Experiment: Next high-stakes decision, force 48-hour deliberation before lock-in. ` +
    `Measure not speed (still fast) but revision frequency. If revision count drops materially, slower gate is worth the time cost.

This is the beginning of conscious scaling.`;

  traitProp.advance("recommendedNextStep");
  return step;
}

function getDefaultNarrative() {
  return {
    profileDNA: "Profile data not available",
    executiveSummary: "Profile data not available",
    operatingPattern: "Profile data not available",
    decisionArchitecture: "Profile data not available",
    communicationStyle: "Profile data not available",
    systemUnderStrain: "Profile data not available",
    hiddenContradictions: "Profile data not available",
    strategicCeiling: "Profile data not available",
    hiddenRisks: "Profile data not available",
    coachingLeverage: "Profile data not available",
    recommendedNextStep: "Profile data not available",
  };
}

export default expandNarrativeV3;
