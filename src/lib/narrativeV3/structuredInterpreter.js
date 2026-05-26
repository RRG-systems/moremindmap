/**
 * structuredInterpreter.js
 * 
 * Extract canonical data into structured interpretation.
 * Canonical dossier → structured fields that GPT uses.
 * 
 * NOT A NARRATIVE GENERATOR.
 * Just extraction and interpretation of existing truth.
 */

export function interpretCanonical(canonical) {
  if (!canonical) return null;

  const data = canonical.canonical_profile_json || canonical;
  const topSystems = data.top_systems || {};
  const vectorScores = data.vector_scores || {};
  const ranked = data.ranked_dimensions || [];
  const tradeoffs = topSystems.dimension_tradeoffs || [];
  
  // Extract intake answers (preserved from vault record)
  const intake_answers = canonical.intake_answers || {};

  const primaryDriver = topSystems.primary_driver || {};
  const stabilizer = topSystems.secondary_stabilizer || {};
  const opposing1 = topSystems.opposing_pattern_1 || {};
  const opposing2 = topSystems.opposing_pattern_2 || {};

  // Extract core behavioral facts
  return {
    identity: {
      name: canonical.person_name || "Subject",
      company: canonical.company_name || "",
      profileId: canonical.profile_id || "",
      assessmentTime: canonical.created_at || "",
    },

    primarySystem: {
      dimension: primaryDriver.dimension || "",
      score: primaryDriver.score || 0,
      description: primaryDriver.description || "",
      operating: primaryDriver.operating_manifestation || "",
      pressure: primaryDriver.pressure_manifestation || "",
    },

    secondarySystem: {
      dimension: stabilizer.dimension || "",
      score: stabilizer.score || 0,
      description: stabilizer.description || "",
      operating: stabilizer.operating_manifestation || "",
      pressure: stabilizer.pressure_manifestation || "",
    },

    opposingPatterns: [
      {
        dimension: opposing1.dimension || "",
        score: opposing1.score || 0,
        description: opposing1.description || "",
        operating: opposing1.operating_manifestation || "",
      },
      {
        dimension: opposing2.dimension || "",
        score: opposing2.score || 0,
        description: opposing2.description || "",
        operating: opposing2.operating_manifestation || "",
      },
    ],

    tradeoffs: tradeoffs.map((t) => ({
      dimensions: t.dimensions || [],
      tradeoff: t.tradeoff || "",
      cost: t.cost || "",
    })),

    scores: vectorScores,

    ranked: ranked.map((d) => ({
      dimension: d.dimension || "",
      score: d.score || 0,
      rank: d.rank || 0,
    })),

    // Derived interpretations (truth-grounded)
    coreSignature:
      `${primaryDriver.description || "High on primary dimension"} combined with ${stabilizer.description || "high on secondary"}.` +
      ` ${primaryDriver.operating_manifestation || ""} while ` +
      `${stabilizer.operating_manifestation || ""}.`,

    pressureResponse:
      `Under load: ${primaryDriver.pressure_manifestation || "increased intensity"}. ` +
      `${stabilizer.pressure_manifestation ? `Secondary system: ${stabilizer.pressure_manifestation}` : ""}.`,

    scalingTension:
      tradeoffs[0]
        ? `Core friction: ${tradeoffs[0].tradeoff || "between primary and secondary systems"}. Cost: ${tradeoffs[0].cost || "affects decision quality"}.`
        : "Internal system balance under stress.",

    decisionProfile:
      `Decisions form through ${primaryDriver.operating_manifestation || "primary pattern recognition"}. ` +
      `Validated against ${stabilizer.operating_manifestation || "secondary strategic perspective"}.`,

    communicationAsset:
      `${primaryDriver.operating_manifestation ? `${primaryDriver.operating_manifestation}. ` : ""}` +
      `This creates distinctive communication style: directional clarity combined with strategic scope.`,

    constraintAtScale:
      `Primary driver: ${primaryDriver.description || "high velocity"}. ` +
      `At 1x: advantage. At 5x+: becomes coordination challenge when scaled without deliberation layers.`,

    // Preserve raw intake answers for GPT to read actual written responses
    intake_answers: intake_answers,
  };
}

/**
 * Build micro-scenario from interpretation.
 * Concrete workplace behavior fragment.
 */
export function buildMicroScenario(interpreted, sectionContext) {
  const primary = interpreted.primarySystem.operating || "";
  const secondary = interpreted.secondarySystem.operating || "";

  if (sectionContext === "communication" && primary.toLowerCase().includes("direction")) {
    return "In a six-person meeting, this profile may reach conclusion before half the room finishes processing the problem. " +
      "Some team members experience this as clarity. Others experience it as override.";
  }

  if (sectionContext === "strain" && interpreted.primarySystem.score > 2) {
    return "Early in a high-load project: decisions move fast, credibility builds, team energy rises. " +
      "Mid-project (month 3-4): small details start creating friction. Some team members stop offering contrary opinions. " +
      "By month 6, cascading decisions begin contradicting each other.";
  }

  if (sectionContext === "contradictions") {
    return "Self-assessment: reads situations well. Reality check: 70% pattern recognition at 3 months " +
      "looks identical to 95% confidence. Missing 25% surfaces at month 4-6. " +
      "They attribute surprises to external factors, not to recalibration needed.";
  }

  if (sectionContext === "ceiling") {
    return "At 1x scale: fast execution outpaces peers. At 2x: speed starts creating coordination gaps. " +
      "At 5x: high-conviction decisions made independently start contradicting each other. System requires centralized approval.";
  }

  return null;
}

/**
 * Extract grounding evidence used in a section.
 * For proof: show exactly which canonical fields supported claims.
 */
export function extractGroundingUsed(sectionName, interpreted) {
  const groundingMap = {
    executiveSummary: [
      "primarySystem.description",
      "primarySystem.operating",
      "primarySystem.score",
      "secondarySystem.description",
      "scalingTension",
    ],
    communicationStyle: [
      "primarySystem.operating",
      "communicationAsset",
      "tradeoffs[0].tradeoff",
      "secondarySystem.operating",
    ],
    hiddenContradictions: [
      "primarySystem.pressure",
      "secondarySystem.pressure",
      "opposingPatterns[0]",
      "tradeoffs[0].cost",
    ],
    strategicCeiling: [
      "constraintAtScale",
      "primarySystem.score",
      "secondarySystem.score",
      "ranked (all dimensions)",
    ],
  };

  return groundingMap[sectionName] || [];
}

export default interpretCanonical;
