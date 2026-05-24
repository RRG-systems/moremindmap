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

// ============================================================
// NEW SECTIONS: Profile DNA, Coaching Leverage, Next Step
// ============================================================

export function buildProfileDNAPrompt(interpreted, previousSections) {
  return {
    systemRule: `You are rendering verified behavioral operating model based on assessment data.
DO NOT invent traits or philosophical language.
Describe how this person operates, not who they are.
Concise, specific, grounded.`,

    section: "profileDNA",
    voiceMode: "systems-observer",
    emotionalTemperature: "neutral-factual",

    canonical: {
      primaryDimension: interpreted.primarySystem.dimension,
      primaryScore: interpreted.primarySystem.score,
      primaryOperating: interpreted.primarySystem.operating,
      secondaryDimension: interpreted.secondarySystem.dimension,
      secondaryScore: interpreted.secondarySystem.score,
    },

    instruction: `Generate a concise operating model description (max 100 words).
Frame: how this person processes information and makes decisions, not personality traits.
Tone: technical, systems-focused, observational.

DO NOT: use "strength", "trait", "tendency", "person who", therapy language
DO: describe the actual operating mechanics

Example: "Direction-driven pattern recognition. Recognizes edges before centers. Fast convergence, low process friction. Moves to action while others are still gathering. Paired with [secondary], creates velocity advantage in execution-velocity environments."`,

    format: JSON.stringify({
      section: "profileDNA",
      body: "(operating model, max 100 words)",
      grounding_used: "(list evidence fields)",
    }),
  };
}

export function buildCoachingLeveragePrompt(interpreted, previousSections) {
  return {
    systemRule: `You are a behavioral systems coach.
Generate actionable leverage points, NOT therapy or motivation.
Focus: concrete behavioral experiments and system-level shifts.
Ground in the person's actual operating model (from previous sections).`,

    section: "coachingLeverage",
    voiceMode: "operator-coach",
    emotionalTemperature: "direct-practical",

    canonical: {
      communicationStyle: previousSections.communicationStyle?.body,
      hiddenContradictions: previousSections.hiddenContradictions?.body,
      strategicCeiling: previousSections.strategicCeiling?.body,
      primaryDimension: interpreted.primarySystem.dimension,
    },

    instruction: `Generate 3-4 coaching leverage points (max 200 words).
Format: numbered list, each point is 1-2 sentences.
Focus: behavioral experiments, NOT inspiration or generic advice.
Tone: tactical, systems-focused, slightly irreverent.

Each leverage point should:
- Identify a specific behavioral pattern
- Propose a concrete experiment or shift
- Explain the system-level consequence

Example good leverage: "Pace as signal: explicit awareness that meeting velocity=decision certainty. Slow decisions down when wrong choices cost more than speed saves."
Example bad leverage: "Improve your communication skills" or "Work on being more collaborative"

DO NOT use: "try to", "should", "could", "might", "practice"
DO use: "when [condition], [action] shifts [system consequence]"`,

    format: JSON.stringify({
      section: "coachingLeverage",
      body: "(3-4 leverage points, numbered, tactical)",
      grounding_used: "(what from previous sections informed this)",
    }),
  };
}

export function buildRecommendedNextStepPrompt(interpreted, previousSections) {
  return {
    systemRule: `You are recommending a behavioral intelligence experiment.
ONE concrete next step.
Not generic, not coaching platitude.
Specific, grounded, testable.`,

    section: "recommendedNextStep",
    voiceMode: "intelligence-advisor",
    emotionalTemperature: "direct-practical",

    canonical: {
      strategicCeiling: previousSections.strategicCeiling?.body,
      coachingLeverage: previousSections.coachingLeverage?.body,
      hiddenContradictions: previousSections.hiddenContradictions?.body,
    },

    instruction: `Generate ONE specific recommended next step (max 150 words).
Format: 2-3 sentences max.
Tone: intelligent, specific, operator-level.

The recommendation should:
- Be testable/measurable
- Address a scaling or coordination constraint
- Be based on the person's actual operating model
- Feel like it came from an executive advisor, not a coach

Example good: "Conduct a 'decision velocity audit': map 5 recent decisions. For each: when was it locked in, when did consequences surface, what was the gap cost? Pattern reveals whether speed is advantage or constraint in your context."
Example bad: "Work on listening more" or "Try to be more collaborative"`,

    format: JSON.stringify({
      section: "recommendedNextStep",
      body: "(one specific experiment or observation, max 150 words)",
      grounding_used: "(which sections informed this)",
    }),
  };
}

export default {
  buildExecutiveSummaryPrompt,
  buildCommunicationStylePrompt,
  buildHiddenContradictionsPrompt,
  buildStrategicCeilingPrompt,
  buildProfileDNAPrompt,
  buildCoachingLeveragePrompt,
  buildRecommendedNextStepPrompt,
};
