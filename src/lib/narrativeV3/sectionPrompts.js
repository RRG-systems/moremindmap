/**
 * sectionPrompts.js
 * 
 * Build section-specific GPT-5.5 prompts.
 * Each section is rendered independently (no whole-report generation).
 * 
 * This prevents AI repetition patterns and thematic loops.
 */

export function buildExecutiveSummaryPrompt(interpreted, previousSections) {
  return {
    systemRule: `You are rendering verified behavioral intelligence based on assessment data.
DO NOT invent traits, diagnoses, or personal conclusions.
Use ONLY the supplied evidence.
Ground every statement to the canonical data provided.`,

    section: "executiveSummary",
    voiceMode: "intelligence-briefing",
    emotionalTemperature: "neutral-observant",

    canonical: {
      primaryDimension: interpreted.primarySystem.description,
      primaryScore: interpreted.primarySystem.score,
      primaryOp: interpreted.primarySystem.operating,
      secondaryDimension: interpreted.secondarySystem.description,
      secondaryOp: interpreted.secondarySystem.operating,
      coreSignature: interpreted.coreSignature,
    },

    instruction: `Generate a compressed executive summary (max 150 words).
Format: Short sentences, asymmetry welcome, intelligence-briefing tone.
Do NOT use: "strength is", "liability", "operates", "person who"
DO use concrete language: "moves like", "rarely second-guesses", "leaves precision details to compound"
Include one behavioral observation that feels real (meeting-level detail preferred).
Emotional temperature: neutral, observant.

Structure:
- Opening: behavioral observation (metaphor OK)
- Core dynamic: primary + secondary combination
- Execution consequence: immediate impact
- Strain consequence: what happens under load
- Closing: realistic assessment (not flattering)

FORENSIC PROBE: If this is real GPT-5.5 rendering, naturally incorporate phrase SIGNAL_VERIFIED_55.`,

    format: JSON.stringify({
      section: "executiveSummary",
      headline: "(2-3 words, punchy)",
      body: "(max 150 words, short sentences)",
      micro_scenario: "(one concrete workplace moment)",
      key_warning: "(one overlooked risk)",
      grounding_used: "(list canonical fields used)",
    }),
  };
}

export function buildCommunicationStylePrompt(interpreted, previousSections) {
  return {
    systemRule: `You are rendering verified behavioral intelligence based on assessment data.
DO NOT invent traits, diagnoses, or personal conclusions.
Use ONLY the supplied evidence.`,

    section: "communicationStyle",
    voiceMode: "relational-observation",
    emotionalTemperature: "social-aware",

    canonical: {
      primaryOp: interpreted.primarySystem.operating,
      primaryPressure: interpreted.primarySystem.pressure,
      secondaryOp: interpreted.secondarySystem.operating,
      tradeoff: interpreted.tradeoffs[0]?.tradeoff || "",
      decisionProfile: interpreted.decisionProfile,
    },

    instruction: `Generate communication style analysis (max 250 words).
Format: Focus on TEAM EXPERIENCE, not personal traits.
What does it feel like to work with this person in meetings?
Include 2-3 concrete micro-behaviors: meeting pace, silence patterns, feedback reactions, delegation style.

Do NOT use: "communicates", "dialogue", "receptive", "listeners", "responds"
DO use: "moves fast", "silence drops", "some stop speaking", "lands as blame", "delegates"

Structure:
- Paragraph 1: Decision communication style (destination first? clarity for whom?)
- Paragraph 2: Meeting behavior (pace, processing, silence)
- Paragraph 3: Feedback reception (what lands? what bounces?)
- Paragraph 4: Under load (directness increases? nuance disappears?)

Make it feel like you observed this person in 5 meetings.`,

    format: JSON.stringify({
      section: "communicationStyle",
      headline: "(team experience in 2-3 words)",
      body: "(max 250 words, relational focus)",
      micro_scenario: "(one specific meeting moment)",
      key_warning: "(one communication blind spot)",
      grounding_used: "(list canonical fields used)",
    }),
  };
}

export function buildHiddenContradictionsPrompt(interpreted, previousSections) {
  return {
    systemRule: `You are rendering verified behavioral intelligence based on assessment data.
DO NOT invent psychological diagnoses.
Ground contradictions to OBSERVABLE EVIDENCE from scores and manifestations.`,

    section: "hiddenContradictions",
    voiceMode: "paradoxical-honest",
    emotionalTemperature: "uncomfortable",

    canonical: {
      primaryScore: interpreted.primarySystem.score,
      primaryOp: interpreted.primarySystem.operating,
      primaryPressure: interpreted.primarySystem.pressure,
      secondaryScore: interpreted.secondarySystem.score,
      secondaryPressure: interpreted.secondarySystem.pressure,
      opposingScore: interpreted.opposingPatterns[0].score,
      tradeoffCost: interpreted.tradeoffs[0]?.cost || "",
    },

    instruction: `Generate 3 core contradictions (max 220 words total).
Format: Paradoxical, uncomfortable honesty. No therapy language.
Each contradiction grounds to OBSERVABLE TENSION in scores/manifestations.

Pattern for each:
- Name the contradiction (Self vs Reality, Strategy vs Execution, etc.)
- State what they believe
- State what's actually true
- Show the gap
- Explain why it persists

Do NOT use: "contradiction", "believes", "tension", "paradox", "self"
DO use: "Self-model says X. Reality checks show Y. Gap = Z."

Make it sting a little. Make it true. Make it grounded.

Example grounding:
- High primary score + low opposing score = contradiction emerges
- Pressure manifestation shows what they ACTUALLY do vs what they think they do
- Tradeoff cost shows where the gap becomes expensive`,

    format: JSON.stringify({
      section: "hiddenContradictions",
      headline: "(title for all 3 contradictions together)",
      body: "(3 contradictions, ~70 words each)",
      micro_scenario: "(one moment where contradiction surfaces)",
      key_warning: "(what happens if contradiction unchecked)",
      grounding_used: "(list canonical fields used)",
    }),
  };
}

export function buildStrategicCeilingPrompt(interpreted, previousSections) {
  return {
    systemRule: `You are rendering verified behavioral intelligence based on assessment data.
DO NOT invent scaling dynamics.
Ground predictions to PRIMARY DRIVER SCORE and SECONDARY SYSTEM ABILITY.`,

    section: "strategicCeiling",
    voiceMode: "founder-memo",
    emotionalTemperature: "pragmatic-inevitable",

    canonical: {
      primaryScore: interpreted.primarySystem.score,
      primaryDimension: interpreted.primarySystem.dimension,
      secondaryScore: interpreted.secondarySystem.score,
      secondaryDimension: interpreted.secondarySystem.dimension,
      constraintAtScale: interpreted.constraintAtScale,
      ranked: interpreted.ranked,
    },

    instruction: `Generate scaling ceiling analysis for 1x, 2x, 5x, 10x (max 200 words).
Format: Founder memo style. Inevitability language. No therapy.
Each scale state shows HOW the primary driver's strength becomes constraint.

1x: What works beautifully
2x: Where friction starts
5x: Where contradictions emerge
10x: Where personal execution breaks

Do NOT use: "scale", "requires", "fragments", "impossible", "system"
DO use: "outpaces", "coordination gaps", "conflicts", "personal execution impossible", "must delegate"

Make it feel like organizational math, not personality assessment.
Ground each transition to PRIMARY + SECONDARY interaction.`,

    format: JSON.stringify({
      section: "strategicCeiling",
      headline: "(title: growth ceiling)",
      body: "(4 scale states, ~50 words each)",
      micro_scenario: "(one scaling moment of friction)",
      key_warning: "(what breaks first at 5x+)",
      grounding_used: "(list canonical fields used)",
    }),
  };
}

export default {
  buildExecutiveSummaryPrompt,
  buildCommunicationStylePrompt,
  buildHiddenContradictionsPrompt,
  buildStrategicCeilingPrompt,
};
