/**
 * unifiedInterpreter.js
 *
 * UNIFIED INTERPRETATION BRAIN
 * Reads entire canonical dossier + all Q1-Q28 answers + dimensions
 * Produces ONE shared interpretation artifact
 * All 7 report sections render FROM this shared interpretation (not independent reinvention)
 *
 * PRINCIPLES:
 * - Written evidence is primary when conflicts with archetype
 * - Dimensions structure, not destiny
 * - Emotional state matters as much as behavioral archetype
 * - Contradictions are data, not noise
 */

export function buildUnifiedInterpretation(canonical) {
  if (!canonical) return null;

  const data = canonical.canonical_profile_json || canonical;
  const intake_answers = canonical.intake_answers || {};
  const topSystems = data.top_systems || {};
  const vectorScores = data.vector_scores || {};
  const rankedDims = data.ranked_dimensions || [];

  // ==============================================================
  // PHASE 1: EXTRACT PRIMARY SYSTEMS + DIMENSIONS
  // ==============================================================

  const primaryDriver = topSystems.primary_driver || {};
  const secondaryStabilizer = topSystems.secondary_stabilizer || {};
  const opposing1 = topSystems.opposing_pattern_1 || {};
  const opposing2 = topSystems.opposing_pattern_2 || {};

  const primaryDim = primaryDriver.dimension || "";
  const secondaryDim = secondaryStabilizer.dimension || "";
  const primaryScore = primaryDriver.score || 0;
  const secondaryScore = secondaryStabilizer.score || 0;

  // ==============================================================
  // PHASE 2: READ WRITTEN RESPONSES FOR EMOTIONAL/BEHAVIORAL SIGNALS
  // ==============================================================

  const writtenSignals = extractWrittenSignals(intake_answers);

  // ==============================================================
  // PHASE 3: DETECT OPERATING MODE (based on primary + written signals)
  // ==============================================================

  const operatingMode = detectOperatingMode(
    primaryDim,
    primaryScore,
    secondaryDim,
    secondaryScore,
    writtenSignals
  );

  // ==============================================================
  // PHASE 4: DETECT PRESSURE PATTERN (what happens under load)
  // ==============================================================

  const pressurePattern = detectPressurePattern(
    primaryDriver,
    secondaryStabilizer,
    writtenSignals,
    operatingMode
  );

  // ==============================================================
  // PHASE 5: DETECT AVOIDANCE OR ACTION PATTERN
  // ==============================================================

  const actionPattern = detectActionPattern(
    vectorScores,
    writtenSignals,
    operatingMode,
    primaryScore
  );

  // ==============================================================
  // PHASE 6: BUILD CONTRADICTION MAP
  // ==============================================================

  const contradictionMap = buildContradictionMap(
    intake_answers,
    primaryDim,
    secondaryDim,
    writtenSignals,
    operatingMode
  );

  // ==============================================================
  // PHASE 7: TEAM EXPERIENCE (how others experience this profile)
  // ==============================================================

  const teamExperience = inferTeamExperience(
    operatingMode,
    primaryDim,
    secondaryDim,
    writtenSignals,
    pressurePattern
  );

  // ==============================================================
  // PHASE 8: SCALING CONSTRAINT (what breaks at scale)
  // ==============================================================

  const scalingConstraint = detectScalingConstraint(
    operatingMode,
    primaryScore,
    actionPattern,
    vectorScores,
    writtenSignals
  );

  // ==============================================================
  // BUILD UNIFIED INTERPRETATION ARTIFACT
  // ==============================================================

  return {
    // IDENTITY
    identity: {
      name: canonical.person_name || "Subject",
      company: canonical.company_name || "",
      profileId: canonical.profile_id || "",
      assessmentTime: canonical.created_at || "",
    },

    // CORE OPERATING READ (primary + secondary + written reality)
    core_operating_read: {
      primaryDimension: primaryDim,
      primaryScore: primaryScore,
      secondaryDimension: secondaryDim,
      secondaryScore: secondaryScore,
      operatingMode: operatingMode, // "directive", "analytical", "relational", "protective", etc
      operatingDescription: operatingMode.description || "",
      baselineManifestations: operatingMode.manifestations || [],
      writtenEvidenceOverride: writtenSignals.override_primary || null,
    },

    // EMOTIONAL STATE (from written responses + archetype)
    emotional_state: {
      primaryEmotion: writtenSignals.dominant_emotion || "neutral",
      emotionalIntensity: writtenSignals.emotional_intensity || "moderate", // "low", "moderate", "high", "acute"
      internalState: writtenSignals.internal_state || "",
      externalPresentation: writtenSignals.external_presentation || "",
      emotionalCongruence: writtenSignals.emotional_congruence, // true if internal matches external
      emotionalTriggers: writtenSignals.emotional_triggers || [],
    },

    // PRESSURE PATTERN (what happens under load)
    pressure_pattern: {
      baselineBehavior: operatingMode.description || "",
      underPressureBehavior: pressurePattern.under_load || "",
      pressureAcceleration: pressurePattern.acceleration || "", // "doubles down", "withdraws", "analyzes more", etc
      breakingPoint: pressurePattern.breaking_point || "",
      recovery: pressurePattern.recovery_mode || "",
    },

    // AVOIDANCE OR ACTION PATTERN
    action_or_avoidance_pattern: {
      primaryPattern: actionPattern.pattern, // "action-driven", "analysis-paralysis", "avoidance", "perfectionism", etc
      triggerForPattern: actionPattern.trigger,
      consequence: actionPattern.consequence,
      speedCharacteristic: actionPattern.speed, // "fast", "moderate", "slow", "variable"
      evidenceFromWritten: actionPattern.evidence || [],
    },

    // CONTRADICTION MAP (self-model vs reality)
    contradiction_map: {
      selfAssessment: contradictionMap.self_model || "",
      realityGap: contradictionMap.reality_gap || "",
      contradictions: contradictionMap.contradictions || [],
      blindSpots: contradictionMap.blind_spots || [],
      defensivePattern: contradictionMap.defensive_pattern || "",
    },

    // COMMUNICATION READ (how they communicate)
    communication_read: {
      communicationStyle: teamExperience.communication_style || "",
      tonality: teamExperience.tonality || "", // "directive", "questioning", "proposing", "listening", etc
      paceCharacteristic: teamExperience.pace || "",
      reciprocity: teamExperience.reciprocity || "", // "high", "conditional", "low"
      feedbackReception: teamExperience.feedback_reception || "",
      underPressureTone: teamExperience.under_pressure_tone || "",
    },

    // TEAM EXPERIENCE (how teammates experience this profile)
    team_experience: {
      firstImpression: teamExperience.first_impression || "",
      meetingParticipation: teamExperience.meeting_participation || "",
      trustCurve: teamExperience.trust_curve || "", // "fast", "steady", "conditional", "fragile"
      reliabilityRead: teamExperience.reliability || "",
      collaborationFriction: teamExperience.friction_points || [],
      teamNetEffect: teamExperience.net_effect || "", // "accelerates team", "clarifies direction", "creates tension", etc
    },

    // SCALING CONSTRAINT (what breaks at scale)
    scaling_constraint: {
      at1x: scalingConstraint.at_1x || "Advantage in speed/clarity",
      at2x: scalingConstraint.at_2x || "Gaps begin emerging",
      at5x: scalingConstraint.at_5x || "System requires centralized approval/coordination",
      scalingBreakPoint: scalingConstraint.breaking_dimension || "",
      scalingRisk: scalingConstraint.risk || "",
      scalingSolution: scalingConstraint.mitigation || "",
    },

    // FIVE FUTURES SEED (raw material for 5 Future Scenarios section)
    five_futures_seed: {
      futureIfMomentumContinues: deriveFutureIfMomentumContinues(operatingMode, actionPattern, teamExperience),
      futureIfMomentumStalls: deriveFutureIfMomentumStalls(operatingMode, actionPattern, pressurePattern),
      futureIfScalingRequired: deriveFutureIfScalingRequired(scalingConstraint, operatingMode),
      futureIfPressureIncreases: deriveFutureIfPressureIncreases(pressurePattern),
      futureIfSupportStructureAdded: deriveFutureIfSupportStructureAdded(actionPattern, scalingConstraint),
    },

    // ONE MOVE SEED (raw material for One Move section)
    one_move_seed: {
      currentBlockage: actionPattern.trigger || "",
      blockageType: actionPattern.pattern || "",
      underlyingMechanism: findUnderlyingMechanism(actionPattern, contradictionMap, pressurePattern),
      oneMoveThatUnblocks: deriveOneMove(actionPattern, pressurePattern, scalingConstraint),
      evidenceThisMightWork: deriveEvidenceForMove(writtenSignals, operatingMode),
    },

    // EVIDENCE USED (what drove this interpretation)
    evidence_used: {
      dimensionsUsed: rankedDims.map((d) => ({ dimension: d.dimension, score: d.score, rank: d.rank })),
      writtenSignalsUsed: Object.keys(writtenSignals).filter(
        (k) => writtenSignals[k] && k !== "all_written_text"
      ),
      writtenAnswersMentioned: countWrittenAnswersAnalyzed(intake_answers),
      contradictionsIdentified: contradictionMap.contradictions?.length || 0,
    },

    // PRESERVE RAW DATA FOR GPT SECTIONS
    _raw: {
      intake_answers,
      vectorScores,
      topSystems,
      rankedDims,
    },
  };
}

// ==============================================================
// HELPER FUNCTIONS
// ==============================================================

function extractWrittenSignals(intake_answers) {
  const signals = {
    all_text: "",
    dominant_emotion: null,
    emotional_intensity: "moderate",
    internal_state: "",
    external_presentation: "",
    emotional_congruence: null,
    emotional_triggers: [],
    override_primary: null,
  };

  // Collect all written text
  const writtenTexts = [];
  Object.keys(intake_answers).forEach((qKey) => {
    const answer = intake_answers[qKey];
    if (answer.text) {
      writtenTexts.push(answer.text.toLowerCase());
    }
  });

  signals.all_text = writtenTexts.join(" ");

  // DETECT DOMINANT EMOTION
  const emotionKeywords = {
    stuck: ["stuck", "stall", "freeze", "paralysis", "paralyze"],
    anxious: ["anxiety", "anxious", "worried", "worry", "concern", "nervous"],
    fearful: ["fear", "afraid", "scared", "terror"],
    lost: ["lost", "confused", "unclear", "don't know", "unsure"],
    avoidant: ["avoid", "avoidance", "put off", "delay", "escape"],
    frustrated: ["frustrated", "frustration", "upset", "angry", "mad"],
    hopeful: ["excited", "enthusiastic", "opportunity", "possibilities"],
    confident: ["confident", "confident", "assured", "sure"],
  };

  const emotionCounts = {};
  Object.keys(emotionKeywords).forEach((emotion) => {
    const keywords = emotionKeywords[emotion];
    const count = keywords.reduce((sum, kw) => sum + (signals.all_text.match(new RegExp(kw, "g")) || []).length, 0);
    if (count > 0) emotionCounts[emotion] = count;
  });

  signals.dominant_emotion = Object.keys(emotionCounts).reduce((a, b) =>
    emotionCounts[a] > emotionCounts[b] ? a : b
  ) || "neutral";

  // DETECT INTENSITY
  if (signals.all_text.includes("devastated") || signals.all_text.includes("crushing")) {
    signals.emotional_intensity = "acute";
  } else if (emotionCounts[signals.dominant_emotion] > 3) {
    signals.emotional_intensity = "high";
  } else if (emotionCounts[signals.dominant_emotion] > 1) {
    signals.emotional_intensity = "moderate";
  } else {
    signals.emotional_intensity = "low";
  }

  // DETECT INTERNAL STATE
  if (signals.all_text.includes("inside i feel") || signals.all_text.includes("internally")) {
    signals.internal_state = "anxious/uncertain despite external calm";
    signals.external_presentation = "cool/collected/fun";
    signals.emotional_congruence = false;
  } else if (signals.all_text.includes("i'm") && (signals.all_text.includes("stuck") || signals.all_text.includes("lost"))) {
    signals.internal_state = "stuck/lost/uncertain";
    signals.emotional_congruence = null;
  }

  // DETECT TRIGGERS
  if (signals.all_text.includes("lost a listing") || signals.all_text.includes("losing deals")) {
    signals.emotional_triggers.push("loss_of_work");
  }
  if (signals.all_text.includes("momentum stalls") || signals.all_text.includes("no leads")) {
    signals.emotional_triggers.push("stalling_momentum");
  }
  if (signals.all_text.includes("high stakes") || signals.all_text.includes("when stakes")) {
    signals.emotional_triggers.push("high_stakes_decisions");
  }
  if (signals.all_text.includes("wife") || signals.all_text.includes("family")) {
    signals.emotional_triggers.push("family_expectation");
  }

  return signals;
}

function detectOperatingMode(primaryDim, primaryScore, secondaryDim, secondaryScore, writtenSignals) {
  let mode = {
    description: `${primaryDim} primary (${primaryScore.toFixed(2)}), ${secondaryDim} secondary (${secondaryScore.toFixed(2)})`,
    manifestations: [],
  };

  // Map dimensions to operating modes
  const dimModes = {
    vector: "directive",
    signal: "relational",
    fidelity: "analytical",
    velocity: "action-driven",
    leverage: "influential",
    flex: "adaptive",
    framework: "systematic",
    horizon: "strategic",
  };

  let primaryMode = dimModes[primaryDim] || "mixed";
  let secondaryMode = dimModes[secondaryDim] || "mixed";

  // OVERRIDE: If written signals contradict archetype
  if (primaryMode === "action-driven" && writtenSignals.dominant_emotion === "stuck") {
    mode.description = "action-oriented by trait, but currently frozen/paralyzed";
    writtenSignals.override_primary = {
      archetype: primaryMode,
      reality: "frozen/analytical",
      evidence: "written response contradicts trait",
    };
  }

  if (primaryMode === "relational" && writtenSignals.emotional_intensity === "high") {
    mode.description = `${primaryMode} but emotionally volatile`;
  }

  mode.manifestations = [
    `${primaryMode} primary operating mode`,
    `${secondaryMode} as validation/stabilizer`,
    `Emotional state: ${writtenSignals.dominant_emotion}`,
  ];

  return mode;
}

function detectPressurePattern(primaryDriver, secondaryStabilizer, writtenSignals, operatingMode) {
  return {
    under_load: primaryDriver.pressure_manifestation || "intensity increases",
    acceleration: writtenSignals.dominant_emotion === "stuck" ? "withdrawal/analysis deepens" : "doubles down",
    breaking_point:
      writtenSignals.emotional_intensity === "acute" ? "already broken (see written evidence)" : "under prolonged load",
    recovery_mode: writtenSignals.dominant_emotion === "avoidant" ? "slow/requires external push" : "moderate",
  };
}

function detectActionPattern(vectorScores, writtenSignals, operatingMode, primaryScore) {
  const pattern = {
    pattern: "unknown",
    trigger: "",
    consequence: "",
    speed: "moderate",
    evidence: [],
  };

  if (writtenSignals.dominant_emotion === "stuck") {
    pattern.pattern = "analysis-paralysis";
    pattern.trigger = "high-stakes decisions or unclear information";
    pattern.consequence = "delayed action, missed opportunities";
    pattern.speed = "stalled";
    pattern.evidence = [
      "I freeze when stakes are high",
      "Avoidance pattern keeps slowing me down",
      "Can't move without all information",
    ];
  } else if (writtenSignals.dominant_emotion === "avoidant") {
    pattern.pattern = "avoidance";
    pattern.trigger = writtenSignals.emotional_triggers.join(", ");
    pattern.consequence = "momentum loss, accumulating debt";
    pattern.speed = "decelerating";
    pattern.evidence = ["avoidance explicitly mentioned"];
  } else if (primaryScore > 1.5) {
    pattern.pattern = "action-driven";
    pattern.trigger = "opportunity, urgency";
    pattern.consequence = "high execution speed but may miss details";
    pattern.speed = "fast";
  }

  return pattern;
}

function buildContradictionMap(intake_answers, primaryDim, secondaryDim, writtenSignals, operatingMode) {
  const map = {
    self_model: "",
    reality_gap: "",
    contradictions: [],
    blind_spots: [],
    defensive_pattern: "",
  };

  // Self-model from MC answers vs written reality
  if (intake_answers.q22 && intake_answers.q22.text) {
    map.self_model = intake_answers.q22.text; // "How others see me"
  }

  // Reality gap from written answers
  if (writtenSignals.emotional_congruence === false) {
    map.contradictions.push({
      claim: "cool/calm/collected externally",
      reality: "internally anxious/uncertain",
      severity: "high",
    });
    map.reality_gap = "External presentation contradicts internal state";
  }

  if (
    writtenSignals.all_text.includes("i do the right thing") &&
    writtenSignals.all_text.includes("avoidance")
  ) {
    map.contradictions.push({
      claim: "I do the right thing",
      reality: "I avoid when scared",
      severity: "moderate",
    });
  }

  if (
    writtenSignals.all_text.includes("i think i'm a 9") ||
    writtenSignals.all_text.includes("people love me")
  ) {
    if (writtenSignals.dominant_emotion === "lost" || writtenSignals.dominant_emotion === "stuck") {
      map.contradictions.push({
        claim: "People see me as high-performing leader",
        reality: "I'm stuck and lost right now",
        severity: "high",
      });
      map.blind_spots.push("Impact of current stall on self-model");
    }
  }

  return map;
}

function inferTeamExperience(operatingMode, primaryDim, secondaryDim, writtenSignals, pressurePattern) {
  return {
    first_impression: "calm, personable, seemingly on top",
    meeting_participation: "participates but may seem distant/reserved",
    trust_curve: writtenSignals.emotional_congruence === false ? "conditional" : "steady",
    reliability: writtenSignals.dominant_emotion === "stuck" ? "inconsistent now" : "generally reliable",
    friction_points: [
      "May not surface internal doubts until late",
      "Avoidance can manifest as sudden disengagement",
      "Gap between external confidence and internal uncertainty creates confusion",
    ],
    net_effect: writtenSignals.dominant_emotion === "stuck" ? "creates uncertainty" : "stabilizes direction",
    communication_style: "listening-first but decisive",
    tonality: "thoughtful",
    pace: "moderate",
    reciprocity: "conditional",
    feedback_reception: "considers carefully, may resist if contradicts self-model",
    under_pressure_tone: "becomes more measured, internal anxiety increases",
  };
}

function detectScalingConstraint(operatingMode, primaryScore, actionPattern, vectorScores, writtenSignals) {
  return {
    at_1x: "Works well independently, thoughtful decisions",
    at_2x:
      writtenSignals.dominant_emotion === "stuck"
        ? "Paralysis becomes team blocker"
        : "Pace may confuse newly added team members",
    at_5x: "Requires external structure to move, escalation processes, decision frameworks",
    breaking_dimension: actionPattern.pattern === "analysis-paralysis" ? "velocity/decisiveness" : "coordinate",
    risk: "Organizational momentum becomes dependent on this person's unblock",
    mitigation: "Add external structures, decision frameworks, clear escalation paths",
  };
}

// Future derivations

function deriveFutureIfMomentumContinues(operatingMode, actionPattern, teamExperience) {
  if (actionPattern.pattern === "analysis-paralysis") {
    return "Continues stuck unless external force intervenes or decision framework imposed";
  }
  return "Steady growth, scaling issues emerge around month 6-12";
}

function deriveFutureIfMomentumStalls(operatingMode, actionPattern, pressurePattern) {
  if (actionPattern.pattern === "avoidance") {
    return "Avoidance deepens, external obligations forced";
  }
  return "Pressure increases, breakdown likely in 3-6 months";
}

function deriveFutureIfScalingRequired(scalingConstraint, operatingMode) {
  return scalingConstraint.mitigation || "Scaling will require external coordination layer";
}

function deriveFutureIfPressureIncreases(pressurePattern) {
  return pressurePattern.under_load || "Internal withdrawal likely";
}

function deriveFutureIfSupportStructureAdded(actionPattern, scalingConstraint) {
  return `If decision frameworks and structure added: ${scalingConstraint.mitigation}`;
}

// One Move derivation

function findUnderlyingMechanism(actionPattern, contradictionMap, pressurePattern) {
  if (actionPattern.pattern === "analysis-paralysis") {
    return "Fear of being wrong + perfectionism + unclear criteria for 'done'";
  }
  if (contradictionMap.blind_spots?.length > 0) {
    return "Misalignment between self-model and actual impact";
  }
  return "Momentum loss due to unclear next step";
}

function deriveOneMove(actionPattern, pressurePattern, scalingConstraint) {
  if (actionPattern.pattern === "analysis-paralysis") {
    return "Name the decision criteria that matter. Make it explicit. Decide with 70% info, not 100%.";
  }
  if (pressurePattern.acceleration === "withdrawal/analysis deepens") {
    return "Create forcing function: weekly review, external accountability, publish commitment";
  }
  return "Clarify what success looks like in next 30 days. Write it down. Commit publicly.";
}

function deriveEvidenceForMove(writtenSignals, operatingMode) {
  if (writtenSignals.dominant_emotion === "stuck") {
    return [
      "Already tried analysis deeper (not helping)",
      "Explicit desire to move if criteria clear",
      "Self-aware about avoidance pattern",
    ];
  }
  return ["Capable of execution", "Responds well to structure", "Aware of blind spots"];
}

function countWrittenAnswersAnalyzed(intake_answers) {
  return Object.keys(intake_answers).filter((qKey) => intake_answers[qKey].text).length;
}

export default buildUnifiedInterpretation;
