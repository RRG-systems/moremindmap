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
  const contradictions = data.contradictions || [];
  const narratives = canonical.narratives || data.narratives || {};

  // Extract key data
  const primaryDriver = topSystems.primary_driver || {};
  const stabilizer = topSystems.secondary_stabilizer || {};
  const opposing1 = topSystems.opposing_pattern_1 || {};
  const opposing2 = topSystems.opposing_pattern_2 || {};

  const driverDim = primaryDriver.dimension || 'primary pattern';
  const stabilizerDim = stabilizer.dimension || 'stabilizer';
  const profileType = data.inferred_patterns?.profile_type || 'behavioral profile';

  return {
    // 1. PROFILE DNA
    profileDNA:
      narratives.profile_dna ||
      `${driverDim} combined with ${stabilizerDim} creates a distinctive operating signature. ` +
      `${primaryDriver.operating_manifestation || `This combination drives ${driverDim}-based decision making.`} ` +
      `The counterbalance of ${opposing1.dimension || 'opposing patterns'} provides important friction that often goes underutilized.`,

    // 2. EXECUTIVE SUMMARY
    executiveSummary:
      narratives.executive_summary ||
      `This person operates with ${primaryDriver.description || driverDim}. ` +
      `Their strength lies in ${primaryDriver.operating_manifestation || 'decisive action and forward momentum'}. ` +
      `Under pressure, this manifests as ${primaryDriver.pressure_manifestation || 'increased intensity and directiveness'}. ` +
      `The core tension: their drive for speed can override precision signals that often contain valuable information.`,

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
      `Decisions are made through ${driverDim}—${primaryDriver.operating_manifestation || 'rapid pattern formation'}. ` +
      `Then refined by ${stabilizerDim}—${stabilizer.operating_manifestation || 'long-range validation'}. ` +
      `The friction point: ${contradictions[0]?.tension || 'tension between speed and precision'} ` +
      `means decisions often lock in before all information surfaces. ` +
      `This is both strength (commitment, speed) and limitation (revised truth missed).`,

    // 5. COMMUNICATION STYLE
    communicationStyle:
      narratives.communication_style ||
      `Communicates with clarity and directness. Prefers outcome-focused conversation over process exploration. ` +
      `Often establishes the destination before discussing the path, which creates efficiency but can feel like override to detail-oriented listeners. ` +
      `Most receptive to feedback that frames new information as tactical advantage, not course correction.`,

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
      `The self-deception: believes they read people well because they read situations fast. ` +
      `Reality: signal reception bandwidth is narrow. They catch environment patterns but miss relationship texture. ` +
      `This creates a credibility gap—high conviction, lower-than-realized calibration. ` +
      `Second contradiction: values precision but structures decisions to avoid needing it.`,

    // 8. STRATEGIC CEILING
    strategicCeiling:
      narratives.strategic_ceiling ||
      `Growth ceiling: current system works until complexity exceeds ${driverDim} pattern recognition capacity. ` +
      `At 2x scale, ad-hoc decision velocity becomes liability. At 5x, the system fragments entirely. ` +
      `Evolution path: integrate ${opposing1.dimension || 'precision'} not as constraint but as detection system. ` +
      `This requires delegating speed decisions to instinct while surfacing edge cases for deliberation.`,

    // 9. HIDDEN RISKS
    hiddenRisks:
      narratives.hidden_risks ||
      `Blind spot 1: Assumes pattern recognition = pattern mastery. Often wrong. ` +
      `Blind spot 2: Relationships decay during high-intensity execution phases. ` +
      `Blind spot 3: Organizational systems they build mirror their own operating mode—fast, conviction-based, brittle under chaos. ` +
      `Risk trajectory: confidence → overconfidence → miscalibration → crisis.`,

    // 10. COACHING LEVERAGE
    coachingLeverage:
      narratives.coaching_leverage ||
      `Leverage point 1: Reframe ${opposing1.dimension || 'precision/friction'} as pattern amplification, not delay. ` +
      `They'll lean in if you show precision as decision advantage, not bottleneck. ` +
      `Leverage point 2: Make the blind spots visible through real-time feedback loops, not retrospectives. ` +
      `Leverage point 3: Help them delegate their own role—biggest growth comes from building teams that slow them down in useful ways.`,

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
