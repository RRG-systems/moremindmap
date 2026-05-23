/**
 * narrativeExpander.js
 * 
 * Deterministic narrative expansion from canonical dossier
 * Transforms terse fields into rich, readable interpretations
 * No external APIs, no AI—pure logic transformation
 * 
 * Input: canonical_profile_json
 * Output: webProfileNarrative object with 11 rich narrative sections
 */

export function expandNarrative(canonical) {
  if (!canonical) return getDefaultNarrative();

  const data = canonical.canonical_profile_json || canonical;
  const topSystems = data.top_systems || {};
  const vectorScores = data.vector_scores || {};
  const tradeoffs = (topSystems.dimension_tradeoffs || []);
  const contradictions = data.contradictions || [];
  const narratives = canonical.narratives || data.narratives || {};

  // Extract key data
  const primaryDriver = topSystems.primary_driver || {};
  const stabilizer = topSystems.secondary_stabilizer || {};
  const opposing1 = topSystems.opposing_pattern_1 || {};
  const opposing2 = topSystems.opposing_pattern_2 || {};

  const driverDim = primaryDriver.dimension || 'primary pattern';
  const driverDesc = primaryDriver.description || driverDim;
  const stabilizerDim = stabilizer.dimension || 'stabilizer';
  const stabilizerDesc = stabilizer.description || stabilizerDim;
  const profileType = data.inferred_patterns?.profile_type || 'behavioral profile';
  
  // Extract first tradeoff for richer tension description
  const primaryTradeoff = tradeoffs[0] || {};

  return {
    // 1. PROFILE DNA
    profileDNA:
      narratives.profile_dna ||
      `${driverDesc} combined with ${stabilizerDesc} creates a distinctive operating signature. ` +
      `${primaryDriver.operating_manifestation || `This combination drives ${driverDim}-based decision making.`} ` +
      `The counterbalance of ${opposing1.description || opposing1.dimension || 'opposing patterns'} ` +
      `provides important structural tension that, when understood, can become a hidden advantage.`,

    // 2. EXECUTIVE SUMMARY
    executiveSummary:
      narratives.executive_summary ||
      `This person operates with ${driverDesc}. Their strength is directional conviction—` +
      `${primaryDriver.operating_manifestation || 'they enter situations with direction already forming, pulling toward action'}. ` +
      `Coupled with ${stabilizerDesc}, they maintain strategic perspective across decisions. ` +
      `Under pressure: ${primaryDriver.pressure_manifestation || 'decisiveness intensifies; they move faster and read less'}. ` +
      `The core dynamic: conviction accelerates faster than information flow, creating both speed and blind spots.`,

    // 3. OPERATING PATTERN (Default + Pressure)
    operatingPattern:
      narratives.operating_pattern ||
      `**Default Mode:** ${primaryDriver.operating_manifestation || 'Enters situations with clear direction forming'} ` +
      `${stabilizer.operating_manifestation ? `while ${stabilizer.operating_manifestation.toLowerCase()}` : ''}. ` +
      `This creates momentum and conviction.\n\n` +
      `**Under Pressure:** ${primaryDriver.pressure_manifestation || 'Doubles down on primary pattern'} ` +
      `${stabilizer.pressure_manifestation ? `${stabilizer.pressure_manifestation.toLowerCase()}` : ''}. ` +
      `The gap between default and pressure modes reveals the system's breaking point.`,

    // 4. DECISION ARCHITECTURE
    decisionArchitecture:
      narratives.decision_architecture ||
      `Decisions form through ${driverDesc}—${primaryDriver.operating_manifestation || 'rapid directional pattern recognition'}. ` +
      `Then validated against ${stabilizerDesc}—${stabilizer.operating_manifestation || 'multi-move strategic perspective'}. ` +
      `Critical friction: ${primaryTradeoff.tradeoff || 'command creates friction with relational awareness and adaptability'}. ` +
      `Cost: ${primaryTradeoff.cost || 'under time pressure, conviction overrides feedback'}. ` +
      `Result: Decisions lock in with 70% information, executed with 100% conviction. This creates speed and ownership, but misses course corrections hiding in the last 30%.`,

    // 5. COMMUNICATION STYLE
    communicationStyle:
      narratives.communication_style ||
      `Communicates with directional clarity—names the destination first, then the path. ` +
      `This creates efficiency but can feel like override to listeners still mapping the terrain. ` +
      `Prefers outcome-focused dialogue over extended process exploration. ` +
      `Most receptive to feedback framed as tactical advantage or strategic correction, not as polite suggestions. ` +
      `Under pressure, directness increases; nuance decreases. Relationships can feel secondary to momentum.`,

    // 6. SYSTEM UNDER STRAIN
    systemUnderStrain:
      narratives.system_under_strain ||
      `The system tension: ${contradictions[0]?.tension || 'primary drive accelerates beyond secondary stabilization'}. ` +
      `Manifestation: ${contradictions[0]?.manifestation || 'increased speed creates precision drag'} ` +
      `When this tension reaches critical mass, the operating pattern inverts—what was strength becomes liability. ` +
      `Decision velocity exceeds information velocity, creating blind spots that compound quickly.`,

    // 7. HIDDEN CONTRADICTIONS
    hiddenContradictions:
      narratives.hidden_contradictions ||
      `Contradiction 1 (Self vs. Reality): Believes they read people well because they read situations fast. ` +
      `Reality: relational signal bandwidth is narrow. Catches environment patterns but misses relationship texture. ` +
      `This creates a credibility gap: high conviction about direction, lower-than-realized calibration about people.

` +
      `Contradiction 2 (Values vs. Behavior): Can articulate the value of precision and deliberation. ` +
      `But structures decisions to avoid needing them—commits before precision becomes option. ` +
      `Contradiction 3 (Strength vs. Limitation): The same directional conviction that drives execution ` +
      `also blinds them to contrary data arriving too late to shift course.`,

    // 8. STRATEGIC CEILING
    strategicCeiling:
      narratives.strategic_ceiling ||
      `Current system works until complexity exceeds ${driverDim} pattern recognition capacity.
` +
      `At 2x scale: Ad-hoc decision velocity (strength at 1x) becomes a liability. More moves being made than can be tracked.
` +
      `At 5x scale: The system fragments. High-conviction decisions contradict each other; no integrated strategy.

` +
      `Evolution path: Integrate ${opposing1.description || 'precision'} not as constraint, but as detection system. ` +
      `Requires delegating routine decisions to instinct while reserving deliberation for high-stakes edge cases. ` +
      `This is uncomfortable—it means consciously moving slower on purpose. But it's the unlock for 10x scale.`,

    // 9. HIDDEN RISKS
    hiddenRisks:
      narratives.hidden_risks ||
      `Risk 1 (Pattern Mastery Illusion): Reads patterns so fast that pattern recognition feels like pattern mastery. ` +
      `Confidence is often calibrated one move ahead of reality. When market/environment shifts, the gap becomes catastrophic.

` +
      `Risk 2 (Relationship Debt): Relationships decay during high-intensity execution phases. ` +
      `Team members experience this as: fast commitments, low follow-through, emotional distance under pressure.

` +
      `Risk 3 (Organizational Brittleness): Systems built mirror their operating mode: fast, conviction-based, brittle under chaos. ` +
      `When conviction-driven systems meet uncertainty, they either over-correct or collapse entirely.

` +
      `Risk Trajectory: Confidence → Overconfidence → Miscalibration → Crisis → Recalibration (rinse/repeat). ` +
      `The question: can the recalibration cycle compress in time?`,

    // 10. COACHING LEVERAGE
    coachingLeverage:
      narratives.coaching_leverage ||
      `Leverage 1: Reframe ${opposing1.description || 'precision'} as pattern amplification, not delay.
` +
      `Frame: 'Precision isn't slowing you down. It's sharpening your target.' They'll lean in if precision becomes advantage, not bottleneck.

` +
      `Leverage 2: Make blind spots visible through real-time feedback loops, not retrospectives.
` +
      `Retrospectives feel like blame. Real-time signals feel like intelligence gathering.

` +
      `Leverage 3: Help them delegate their own role. Biggest growth = building teams that slow them down in useful ways.
` +
      `This is uncomfortable because it means loss of control, but it's the only path to 10x without burning out the team.

` +
      `Leverage 4: Gamify precision. If you can turn deliberation into a strategic game with skin in the game, they'll engage.`,

    // 11. RECOMMENDED NEXT STEP
    recommendedNextStep:
      narratives.recommended_next_step ||
      `The immediate next step: Audit one recent decision. Track where conviction formed, where it wavered, where ignored signals mattered. ` +
      `Don't change the decision. Just map the psychology. ` +
      `This creates the self-observation needed for conscious evolution. From there, experiment with ${stabilizer.dimension || 'stabilization patterns'} ` +
      `in lower-stakes environments. Build muscle memory before scaling.`,
  };
}

function getDefaultNarrative() {
  return {
    profileDNA: 'Profile data not available.',
    executiveSummary: 'Profile data not available.',
    operatingPattern: 'Profile data not available.',
    decisionArchitecture: 'Profile data not available.',
    communicationStyle: 'Profile data not available.',
    systemUnderStrain: 'Profile data not available.',
    hiddenContradictions: 'Profile data not available.',
    strategicCeiling: 'Profile data not available.',
    hiddenRisks: 'Profile data not available.',
    coachingLeverage: 'Profile data not available.',
    recommendedNextStep: 'Profile data not available.',
  };
}
