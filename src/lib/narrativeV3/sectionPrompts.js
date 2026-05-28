/**
 * sectionPrompts.js
 * 
 * Build section-specific GPT-5.5 prompts.
 * Each section is rendered independently (no whole-report generation).
 * 
 * This prevents AI repetition patterns and thematic loops.
 * 
 * STEP 2.5 REFINEMENT FOCUS:
 * - Reduce taxonomy language (remove "high vector", "moderate", etc.)
 * - Increase causal continuity (behavior → habit → team adaptation → cost)
 * - Increase emotional realism (lived-in organizational detail)
 * - Improve escalation logic (small behavior → systemic consequence)
 * - Reduce generated cadence (vary sentence rhythm, avoid uniformity)
 */

export function buildExecutiveSummaryPrompt(unified, interpreted, previousSections) {
  return {
    systemRule: `You are rendering verified behavioral intelligence based on assessment data.
DO NOT invent traits, diagnoses, or personal conclusions.
Use ONLY the supplied evidence.
Ground every statement to the canonical data provided.`,

    section: "executiveSummary",
    voiceMode: "intelligence-briefing",
    emotionalTemperature: "neutral-observant",

    canonical: { unified, // Use unified interpretation as primary
      coreOperatingRead: unified.core_operating_read,
      emotionalState: unified.emotional_state,
      pressurePattern: unified.pressure_pattern,
      actionPattern: unified.action_or_avoidance_pattern,
      teamExperience: unified.team_experience,
      contradictions: unified.contradiction_map,
      scalingConstraint: unified.scaling_constraint,
      intake_answers: unified._raw.intake_answers,
    },

    instruction: `Generate a compressed executive summary (max 150 words) as JSON.

Generate a compressed executive summary (max 150 words) as JSON.

PRIORITY: Emotional state and action pattern from unified interpretation DOMINATE.
When unified says stuck/fearful/avoidant/frozen, that IS the reality. Build narrative FROM that truth.

Format: Asymmetrical prose. Mix short and longer sentences. Felt like you sat in meetings.
Do NOT use: "strength", "operates", "tendency", "has a", "outpaces", "conviction"
DO use: emotional truth + behavioral consequence

Structure:
- Opening: what's actually happening (emotional state first, not quality)
- Internal reality: what's true internally per unified (anxiety despite calm, stuck despite intelligence)
- Behavioral pattern: action or avoidance pattern from unified (paralysis, withdrawal, etc)
- Team impact: how this affects others
- Honest assessment: no advantage narrative if evidence says stuck/fearful

READ unified.emotional_state, unified.action_or_avoidance_pattern, unified.contradiction_map FIRST.
Let THOSE dominate section output.
Dimensions are structure only. Evidence is truth.`,

    format: JSON.stringify({
      section: "executiveSummary",
      headline: "(2-3 words, punchy)",
      body: "(max 150 words, rhythmic prose)",
      micro_scenario: "(one concrete workplace moment)",
      key_warning: "(one overlooked risk)",
      grounding_used: "(list canonical fields used)",
    }),
  };
}

export function buildCommunicationStylePrompt(unified, interpreted, previousSections) {
  return {
    systemRule: `You are rendering verified behavioral intelligence based on assessment data.
DO NOT invent traits, diagnoses, or personal conclusions.
Use ONLY the supplied evidence.`,

    section: "communicationStyle",
    voiceMode: "relational-observation",
    emotionalTemperature: "social-aware",

    canonical: { unified, // Use unified interpretation as primary
      primaryOp: interpreted.primarySystem.operating,
      primaryPressure: interpreted.primarySystem.pressure,
      secondaryOp: interpreted.secondarySystem.operating,
      tradeoff: interpreted.tradeoffs[0]?.tradeoff || "",
      decisionProfile: interpreted.decisionProfile,
      intake_answers: interpreted.intake_answers,
    },

    instruction: `Generate communication style analysis (max 250 words) as JSON.

Generate communication style analysis (max 250 words) as JSON.

PRIORITY: unified.team_experience + unified.emotional_state DOMINATE.
When unified says "internal turmoil creates uncertainty" or "emotionalCongruence=false", that shapes communication reality.

What's it actually like to be around this person?

Structure:
- Paragraph 1: First impression vs internal reality (calm exterior/anxious interior?)
- Paragraph 2: Meeting dynamic (how does their emotional state show up? hesitation? withdrawal?)
- Paragraph 3: Under pressure (does pressure accelerate them or freeze them per unified?)
- Paragraph 4: Team consequence (does their state clarify or confuse teammates?)

Do NOT use: "strong communicator", "communicates", "receptive", "responds"
DO use actual team experience from unified: trust_curve, friction_points, net_effect

Grounding: Show exactly how unified.emotional_state and unified.team_experience map to actual communication patterns.

CONCRETE EXAMPLES:
- "People leave meetings unsure whether disagreement was actually welcome"
- "When pushback surfaces, correcting instinct kicks in faster than curiosity"
- "Meeting pace suits people who think fast; others seem to process slower"

Vary rhythm. Ground to observable patterns, not interpretation.`,

    format: JSON.stringify({
      section: "communicationStyle",
      headline: "(team experience in 2-3 words)",
      body: "(max 250 words, team experience focus)",
      micro_scenario: "(one specific meeting moment)",
      key_warning: "(one communication consequence that's unintended but consistent)",
      grounding_used: "(list canonical fields used)",
    }),
  };
}

export function buildHiddenContradictionsPrompt(unified, interpreted, previousSections) {
  return {
    systemRule: `You are rendering verified behavioral intelligence based on assessment data.
DO NOT invent psychological diagnoses.
Ground contradictions to OBSERVABLE EVIDENCE from scores and manifestations.`,

    section: "hiddenContradictions",
    voiceMode: "paradoxical-honest",
    emotionalTemperature: "uncomfortable",

    canonical: { unified, // Use unified interpretation as primary
      primaryScore: interpreted.primarySystem.score,
      primaryOp: interpreted.primarySystem.operating,
      primaryPressure: interpreted.primarySystem.pressure,
      secondaryScore: interpreted.secondarySystem.score,
      secondaryPressure: interpreted.secondarySystem.pressure,
      opposingScore: interpreted.opposingPatterns[0].score,
      tradeoffCost: interpreted.tradeoffs[0]?.cost || "",
      intake_answers: interpreted.intake_answers,
    },

    instruction: `Generate 3-4 core contradictions (max 220 words total) as JSON.
Format: Organizational realism, not psychology. Show where self-model diverges from team experience.
Each contradiction: observable gap between intent and consequence.

Pattern for each:
1. Describe what happens (behavioral manifestation + team experience)
2. Show why it happens (the operating model at work)
3. Reveal the cost (specific, organizational, not emotional)
4. Name the contradiction (implicit, felt but unspoken)

Do NOT use: "contradiction", "believes", "tension", "paradox", "self", "struggle"
DO use: "People experience Y even though intention is X", "The gap costs Z"

Make it sting because it's TRUE, not because it's harsh.

EXAMPLE REALISM:
- "Direction gets set before input lands; team adapts but stops bringing concerns"
- "Speed advantage disappears at scale; coordination gaps become expensive"
- "Process knowledge exists; process adoption doesn't; infrastructure debt compounds"

Ground to:
- Observable team behavior (what happens in practice)
- Operating model logic (why it happens)
- Organizational consequence (what it costs)`,

    format: JSON.stringify({
      section: "hiddenContradictions",
      headline: "(title for all 3 contradictions together)",
      body: "(3-4 contradictions showing behavior→team experience→cost pattern)",
      micro_scenario: "(one moment where contradiction surfaces)",
      key_warning: "(organizational cost if pattern continues unchanged)",
      grounding_used: "(list canonical fields used)",
    }),
  };
}

export function buildStrategicCeilingPrompt(unified, interpreted, previousSections) {
  return {
    systemRule: `You are rendering verified behavioral intelligence based on assessment data.
DO NOT invent scaling dynamics.
Ground predictions to PRIMARY DRIVER SCORE and SECONDARY SYSTEM ABILITY.`,

    section: "strategicCeiling",
    voiceMode: "founder-memo",
    emotionalTemperature: "pragmatic-inevitable",

    canonical: { unified, // Use unified interpretation as primary
      primaryScore: interpreted.primarySystem.score,
      primaryDimension: interpreted.primarySystem.dimension,
      secondaryScore: interpreted.secondarySystem.score,
      secondaryDimension: interpreted.secondarySystem.dimension,
      constraintAtScale: interpreted.constraintAtScale,
      ranked: interpreted.ranked,
      intake_answers: interpreted.intake_answers,
    },

    instruction: `Generate scaling ceiling analysis (max 200 words) as JSON.
Format: Organizational dynamics, not personality. Show how operating model becomes constraint at scale.
Structure: 1x (advantage) → 2x (early friction) → 5x (systemic cost) → 10x (personal execution breaks)

For each transition:
- What worked at smaller scale
- Why it stops working (coordination math, not attitude)
- Team/org experience at the breaking point
- The specific decision or communication failure that emerges

Do NOT use: "scale", "requires", "fragments", "impossible", "system", "challenge", "need"
DO use: "coordination gaps widen", "speed advantage reverses", "people stop assuming you know the whole picture", "personal execution can't cover for broken infrastructure"

Make it feel inevitable. Like mathematical breakdown, not character flaw.

EXAMPLE: "At 1x, speed wins. At 2x, unread people start assuming you've decided without input. At 5x, coordination gaps mean decisions conflict. At 10x, personal execution can't cover for process breakdown."

Ground each state to PRIMARY + SECONDARY (how they hold together at smaller scale, where secondary stabilizer can't compensate at scale).`,

    format: JSON.stringify({
      section: "strategicCeiling",
      headline: "(title: growth ceiling)",
      body: "(escalation sequence: 1x→2x→5x→10x with team/org experience at each)",
      micro_scenario: "(one scaling moment of friction)",
      key_warning: "(where coordination breaks first when scale exceeds secondary stabilizer's reach)",
      grounding_used: "(list canonical fields used)",
    }),
  };
}

// ============================================================
// NEW SECTIONS: Profile DNA, Coaching Leverage, Next Step
// ============================================================

export function buildProfileDNAPrompt(unified, interpreted, previousSections, cognitionContext = null) {
  return {
    systemRule: `You are describing an operating pattern based on assessment data.
DO NOT invent traits, psychology, or personal qualities.
Describe the OBSERVABLE MECHANICS: trigger → pattern → consequence.
Ground to primary + secondary interaction. Be mechanical, not evaluative.`,

    section: "profileDNA",
    voiceMode: "operational-mechanics",
    emotionalTemperature: "neutral-mechanical",

    canonical: { unified, // Use unified interpretation as primary
      cognitionSource: cognitionContext?.source || 'structured',
      primaryDimension: cognitionContext?.ranked_dimensions?.[0]?.dimension || interpreted.primarySystem.dimension,
      primaryScore: cognitionContext?.ranked_dimensions?.[0]?.score || cognitionContext?.ranked_dimensions?.[0]?.gpt_rescored_score || interpreted.primarySystem.score,
      primaryOperating: interpreted.primarySystem.operating,
      primaryPressure: interpreted.primarySystem.pressure,
      secondaryDimension: cognitionContext?.ranked_dimensions?.[1]?.dimension || interpreted.secondarySystem.dimension,
      secondaryScore: cognitionContext?.ranked_dimensions?.[1]?.score || cognitionContext?.ranked_dimensions?.[1]?.gpt_rescored_score || interpreted.secondarySystem.score,
      secondaryOperating: interpreted.secondarySystem.operating,
      intake_answers: interpreted.intake_answers,
      dominance_profile: cognitionContext?.dominance_profile,
      render_ready: cognitionContext?.render_ready,
    },

    instruction: `Generate a concise operating model description (max 100 words) as JSON.
Frame: how this person actually thinks and acts, not qualities or traits.
Tone: mechanical, observable, no attribution.

DO NOT use: "strength", "trait", "tendency", "person who", "has a", "is someone who"
DO use: "enters with direction forming", "reads momentum before consensus", "moves faster than shared understanding", "stabilized by [secondary]"

Show the OPERATING PATTERN:
- What triggers action (decision formation? opportunity sensing? pressure?)
- How primary + secondary interact (what stabilizes? what accelerates?)
- What's the consequence in practice (team experience, team adaptation)
- What's the pressure response (does pattern intensify or shift?)

Example: "Direction congeals before input lands. Perspective provides coverage for precision gaps. In practice: moves faster than groups can process. Under pressure: directiveness increases, precision signals disappear."`,

    format: JSON.stringify({
      section: "profileDNA",
      body: "(operating mechanics: triggering pattern → primary+secondary interaction → consequence)",
      grounding_used: "(which canonical fields: operating manifestations, pressure responses, dimensions)",
    }),
  };
}

export function buildCoachingLeveragePrompt(unified, interpreted, previousSections) {
  return {
    systemRule: `You are a behavioral systems engineer.
Generate actionable leverage points based on operating patterns.
Focus: behavioral experiments that shift system consequence.
Ground in the person's actual operating model (from previous sections).`,

    section: "coachingLeverage",
    voiceMode: "behavioral-engineer",
    emotionalTemperature: "mechanical-direct",

    canonical: { unified, // Use unified interpretation as primary
      communicationStyle: previousSections.communicationStyle?.body,
      hiddenContradictions: previousSections.hiddenContradictions?.body,
      strategicCeiling: previousSections.strategicCeiling?.body,
      primaryDimension: interpreted.primarySystem.dimension,
      intake_answers: interpreted.intake_answers,
    },

    instruction: `Generate 3-4 behavioral experiments (max 200 words) as JSON.
Format: numbered list, each 1-2 sentences. Testable, specific, operator-level.
Focus: System shifts, not trait improvement. What changes if this pattern shifts?
Tone: tactical, mechanical, irreverent.

Each experiment should:
- Name a specific operating pattern (from profile DNA)
- Propose ONE concrete shift or observation
- Explain the organizational consequence of the shift

EXAMPLE GOOD:
1. "Velocity audit: log 5 decisions. When locked? When consequences surfaced? Gap reveals whether speed is advantage or debt in your context."
2. "Precision signaling: bring one unfinished idea to next team meeting. Notice what happens. Do people add rigor or assume decision's locked?"

EXAMPLE BAD: "Improve communication" or "Be more collaborative"

DO NOT use: "try to", "should", "could", "might", "practice", "work on"
DO use: "run this experiment", "notice what", "this shifts", "when X happens, Y follows"

Ground to PRIMARY OPERATING PATTERN + consequences if pattern shifts.`,

    format: JSON.stringify({
      section: "coachingLeverage",
      body: "(3-4 experiments, each: pattern → shift → consequence)",
      grounding_used: "(which sections + behavioral patterns inform these experiments)",
    }),
  };
}

export function buildRecommendedNextStepPrompt(unified, interpreted, previousSections) {
  return {
    systemRule: `You are recommending a behavioral intelligence experiment.
ONE concrete next step.
Not generic, not coaching platitude.
Specific, grounded, testable.`,

    section: "recommendedNextStep",
    voiceMode: "intelligence-advisor",
    emotionalTemperature: "mechanical-direct",

    canonical: { unified, // Use unified interpretation as primary
      strategicCeiling: previousSections.strategicCeiling?.body,
      coachingLeverage: previousSections.coachingLeverage?.body,
      hiddenContradictions: previousSections.hiddenContradictions?.body,
      intake_answers: interpreted.intake_answers,
    },

    instruction: `Generate ONE specific recommended next step (max 150 words) as JSON.
Format: 2-3 sentences max.
Tone: executive-level observation, testable, grounded in this person's operating model.

The recommendation should:
- Directly address a constraint that emerges from primary + secondary interaction
- Be specific enough to run (measurable, testable)
- Surface something about their own operating model (not coaching toward an ideal)
- Feel like it came from someone who's analyzed their operating math

EXAMPLE GOOD:
"Decision velocity audit: log your next 5 decisions (when formed, when locked, when consequences surfaced). Pattern shows whether speed compounds advantage or creates blind spots in your context."

EXAMPLE BAD:
"Work on listening more" or "Try to be more collaborative"

Ground to:
- The specific operating pattern (from profile DNA)
- The scaling ceiling (where it breaks)
- One testable observation that would reveal whether it's working or becoming liability`,

    format: JSON.stringify({
      section: "recommendedNextStep",
      body: "(one specific, testable next step grounded in operating model)",
      grounding_used: "(which operating pattern + constraint informed this)",
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
