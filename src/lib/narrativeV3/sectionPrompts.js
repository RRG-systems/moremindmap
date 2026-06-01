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

function buildCompactCognitionBlock(cognitionContext) {
  if (!cognitionContext) return null;

  const rankedDimensions = Array.isArray(cognitionContext.ranked_dimensions)
    ? cognitionContext.ranked_dimensions.map((dimension, index) => ({
        rank: dimension.rank ?? index + 1,
        dimension: dimension.dimension,
        score: dimension.display_score ?? dimension.gpt_rescored_score ?? dimension.score,
        baseline_score: dimension.baseline_score ?? dimension.v1_score,
        support_adjusted_score: dimension.support_adjusted_score,
        evidence_count: dimension.evidence_count ?? dimension.contributing_answer_count,
        contributing_answer_count: dimension.contributing_answer_count ?? dimension.evidence_count,
        evidence_band: dimension.evidence_band,
        intensity_band: dimension.intensity_band,
        distance_from_neutral: dimension.distance_from_neutral,
        role: dimension.role,
        confidence: dimension.confidence,
        rationale: dimension.rationale,
      }))
    : [];

  const audit = cognitionContext.audit || {};

  return {
    source: cognitionContext.source,
    ranked_dimensions: rankedDimensions,
    dominance_profile: cognitionContext.dominance_profile || null,
    spread_profile: cognitionContext.spread_profile || null,
    tension_pairs: cognitionContext.tension_pairs || [],
    suppressions: cognitionContext.suppressions || cognitionContext.suppression_map || [],
    render_ready: cognitionContext.render_ready || null,
    audit: {
      changed_dimensions: audit.changed_dimensions || [],
      preserved_dimensions: audit.preserved_dimensions || [],
      reason_for_changes: audit.reason_for_changes || [],
      warning_flags: audit.warning_flags || [],
    },
    rationales: cognitionContext.rationales || rankedDimensions
      .filter((dimension) => dimension.rationale)
      .map((dimension) => ({
        dimension: dimension.dimension,
        rationale: dimension.rationale,
      })),
  };
}

export function buildExecutiveSummaryPrompt(unified, interpreted, previousSections, cognitionContext = null, executiveIntelligence = null) {
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
      cognition: buildCompactCognitionBlock(cognitionContext),
      executive_intelligence: executiveIntelligence,
      downstream_synthesis: {
        profileDNA: previousSections.profileDNA || null,
        hiddenContradictions: previousSections.hiddenContradictions || null,
        strategicCeiling: previousSections.strategicCeiling || null,
        recommendedNextStep: previousSections.recommendedNextStep || null,
        teamExperience: previousSections.teamExperience || null,
        facilitatorNotes: previousSections.facilitatorNotes || null,
        fiveFutures: previousSections.fiveFutures || null,
      },
    },

    instruction: `Generate a compressed executive summary (max 150 words) as JSON.

This section must descend from canonical.executive_intelligence.

Answer these six questions in one integrated briefing:
1. What value does this person create?
2. What limits them?
3. What happens under pressure?
4. What role are they naturally built for?
5. What role will exhaust them?
6. What is the highest-leverage insight earned by evidence?

Evidence hierarchy:
1. Behavioral DNA / canonical.executive_intelligence
2. Scoring and amplitude: support_adjusted_score, evidence_count, confidence, evidence_band, intensity_band, distance_from_neutral
3. Written responses
4. Role and company context
5. Downstream synthesis from already-generated sections
6. Emotion only if directly evidenced

Do NOT make emotional state dominate unless the supplied evidence says it changes workplace behavior.
Do NOT use generic Command/operator language.
Do NOT use: "strength", "operates", "tendency", "has a", "outpaces", "conviction"

If canonical.cognition.source is "gpt", use cognition as the strongest behavioral topology layer.
Use cognition ranked dimensions, dominance, spread, tension, suppressions, render_ready, and audit rationales to interpret operating weight.
Dimensions are structure only. Evidence is truth.

Format: Asymmetrical prose. Mix short and longer sentences. Felt like you sat in meetings.`,

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

export function buildHiddenContradictionsPrompt(unified, interpreted, previousSections, cognitionContext = null) {
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
      cognition: buildCompactCognitionBlock(cognitionContext),
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
- Organizational consequence (what it costs)

If canonical.cognition.source is "gpt", use cognition as the strongest behavioral topology layer.
Use cognition ranked dimensions, dominance, spread, tension, suppressions, render_ready, and audit rationales to find gaps between operating weight, suppression, and team consequence.`,

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

export function buildStrategicCeilingPrompt(unified, interpreted, previousSections, cognitionContext = null) {
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
      cognition: buildCompactCognitionBlock(cognitionContext),
    },

    instruction: `Generate scaling ceiling analysis (max 200 words) as JSON.
Format: executive leadership briefing, not personality and not lab mechanics. Use mechanism internally, but render consequence externally.
Structure: 1x (advantage) → 2x (early friction) → 5x (systemic cost) → 10x (personal execution breaks)

For each transition:
- What worked at smaller scale
- Why it stops working (coordination math, not attitude)
- Team/org experience at the breaking point
- The specific decision or communication failure that emerges

Do NOT use: "visible mechanism", "operating pair", "operating math", "late-cycle friction", "adoption data", "seed evidence", "scale", "requires", "fragments", "impossible", "system", "challenge", "need"
DO use executive language: leader, team, decision, trust, clarity, execution, accountability, growth, feedback, ownership.
Useful phrases: "coordination gaps widen", "problems surface too late", "people stop assuming you know the whole picture", "personal execution can't cover for broken infrastructure"

Make it feel inevitable. Like mathematical breakdown, not character flaw.

EXAMPLE: "At 1x, speed wins. At 2x, unread people start assuming you've decided without input. At 5x, coordination gaps mean decisions conflict. At 10x, personal execution can't cover for process breakdown."

Ground each state to PRIMARY + SECONDARY (how they hold together at smaller scale, where secondary stabilizer can't compensate at scale).
If canonical.cognition exists, use cognition ranked dimensions, dominance, spread, tension, suppressions, render_ready, and audit rationales to identify the actual operating bottleneck.
Never say the scaling constraint is not identified when canonical.cognition, unified.scaling_constraint, or written evidence provide enough operating topology to infer one.`,

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
Frame: how this person creates value and pressure for the organization, not qualities or traits.
Tone: executive, observable, no attribution. Use mechanism internally, but render consequence externally.

DO NOT use: "strength", "trait", "tendency", "person who", "has a", "is someone who"
DO use: "enters with direction forming", "reads momentum before consensus", "moves faster than shared understanding", "stabilized by [secondary]"

Show the decision pattern:
- What triggers action (decision formation? opportunity sensing? pressure?)
- How primary + secondary interact (what stabilizes? what accelerates?)
- What's the consequence in practice (team experience, team adaptation)
- What's the pressure response (does pattern intensify or shift?)

Example: "Direction congeals before input lands. Perspective provides coverage for precision gaps. In practice: moves faster than groups can process. Under pressure: directiveness increases, precision signals disappear."`,

    format: JSON.stringify({
      section: "profileDNA",
      body: "(decision pattern: triggering pattern → primary+secondary interaction → consequence)",
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

export function buildRecommendedNextStepPrompt(unified, interpreted, previousSections, cognitionContext = null) {
  return {
    systemRule: `You are recommending a concrete executive action.
ONE concrete next step.
Not generic, not coaching platitude.
Specific, grounded, testable.`,

    section: "recommendedNextStep",
    voiceMode: "executive-advisor",
    emotionalTemperature: "practical-direct",

    canonical: { unified, // Use unified interpretation as primary
      strategicCeiling: previousSections.strategicCeiling?.body,
      coachingLeverage: previousSections.coachingLeverage?.body,
      hiddenContradictions: previousSections.hiddenContradictions?.body,
      intake_answers: interpreted.intake_answers,
      cognition: buildCompactCognitionBlock(cognitionContext),
    },

    instruction: `Generate ONE specific recommended next step (max 150 words) as JSON.
Format: one short action plan. It must read like something the person can start in the next 30 days.
Tone: executive-level observation, testable, grounded in this person's leadership reality.

The recommendation should:
- Directly address a constraint that emerges from primary + secondary interaction
- Be specific enough to run (measurable, testable)
- Surface something about their own decision pattern (not coaching toward an ideal)
- Feel like it came from someone who understands how their decisions affect team execution

EXAMPLE GOOD:
"Decision velocity audit: log your next 5 decisions (when formed, when locked, when consequences surfaced). Pattern shows whether speed compounds advantage or creates blind spots in your context."

EXAMPLE BAD:
"Work on listening more" or "Try to be more collaborative"

Ground to:
- The specific decision pattern (from profile DNA)
- The scaling ceiling (where it breaks)
- One testable observation that would reveal whether it's working or becoming liability

Do NOT use: "visible mechanism", "operating pair", "operating math", "seed evidence", "late-cycle friction", "adoption data".
DO use: "for the next 30 days", "owner", "timeline", "what success looks like", "what would cause the decision to change".

If canonical.cognition exists, use cognition ranked dimensions, dominance, spread, tension, suppressions, render_ready, and audit rationales to choose the move.
The move must address the actual operating bottleneck, not a generic improvement theme.`,

    format: JSON.stringify({
      section: "recommendedNextStep",
      body: "(one specific 30-day action grounded in decision pattern and constraint)",
      grounding_used: "(which decision pattern + constraint informed this)",
    }),
  };
}

export function buildFacilitatorNotesPrompt(unified, interpreted, previousSections, cognitionContext = null) {
  return {
    systemRule: `You are generating environment design guidance from verified behavioral intelligence.
DO NOT provide therapy, motivation, personality coaching, or generic leadership advice.
Design the environment around the operator's actual mechanics.
Use ONLY supplied canonical evidence and cognition context.`,

    section: "facilitatorNotes",
    voiceMode: "environment-architect",
    emotionalTemperature: "practical-structural",

    canonical: { unified,
      profileDNA: previousSections.profileDNA?.body,
      strategicCeiling: previousSections.strategicCeiling?.body,
      coachingLeverage: previousSections.coachingLeverage?.body,
      recommendedNextStep: previousSections.recommendedNextStep?.body,
      communicationRead: unified.communication_read,
      teamExperience: unified.team_experience,
      scalingConstraint: unified.scaling_constraint,
      oneMoveSeed: unified.one_move_seed,
      environmentFit: interpreted.environmentFit,
      decisionProfile: interpreted.decisionProfile,
      intake_answers: interpreted.intake_answers,
      cognition: buildCompactCognitionBlock(cognitionContext),
    },

    instruction: `Generate Facilitator Notes as JSON.
Purpose: environment design guidance, not behavior coaching.

Use full canonical + cognition context to infer:
- reporting structure
- delegation architecture
- accountability design
- meeting cadence
- communication architecture
- decision review structure
- organizational fit
- what the environment must provide so the operator functions well

Do NOT output "insufficient evidence" if canonical contains usable behavioral signals.
Be specific, structural, and operational. Each note should be usable by a facilitator, manager, coach, or organizational designer.

The notes must describe environment requirements around this operator, not self-improvement assignments for the operator.`,

    format: JSON.stringify({
      section: "facilitatorNotes",
      summary: "(one sentence describing the environmental design requirement)",
      primary_guidance: "(single most important structural guidance)",
      notes: [
        {
          label: "(short label: reporting, delegation, accountability, meetings, communication, decisions, fit)",
          guidance: "(specific environment design instruction)",
          rationale: "(why this fits the operating pattern and cognition context)"
        }
      ],
      caution: "(one boundary: what the environment should not assume or force)"
    }),
  };
}

export function buildTeamExperiencePrompt(unified, interpreted, previousSections, cognitionContext = null) {
  return {
    systemRule: `You are generating team-experience intelligence from verified behavioral evidence.
DO NOT write generic leadership observations, personality praise, or archetype language.
Use ONLY supplied canonical evidence, prior sections, and cognition context.
Every claim must explain how this specific operator lands on other people.`,

    section: "teamExperience",
    voiceMode: "team-impact-analyst",
    emotionalTemperature: "specific-observed",

    canonical: { unified,
      profileDNA: previousSections.profileDNA?.body,
      executiveSummary: previousSections.executiveSummary?.body,
      hiddenContradictions: previousSections.hiddenContradictions?.body,
      strategicCeiling: previousSections.strategicCeiling?.body,
      facilitatorNotes: previousSections.facilitatorNotes,
      recommendedNextStep: previousSections.recommendedNextStep?.body,
      pressurePattern: unified.pressure_pattern,
      communicationRead: unified.communication_read,
      teamExperience: unified.team_experience,
      contradictions: unified.contradiction_map,
      leadershipArchitecture: interpreted.leadershipArchitecture,
      decisionProfile: interpreted.decisionProfile,
      intake_answers: interpreted.intake_answers,
      cognition: buildCompactCognitionBlock(cognitionContext),
    },

    instruction: `Generate Team Experience as JSON.

This section must answer:
- how this person lands on others
- what others initially trust
- what others misread
- what becomes frustrating under load
- what team members must learn to do around this operator
- what is unique to this profile, not generic Command/vector language

Evidence Dominance Rule:
Every major Team Experience claim must be grounded in at least one of:
- a score pattern
- a dimension relationship
- a pressure mechanic
- a tension pair
- a written answer
- leadership or communication evidence
- facilitator, one-move, or scaling evidence

Before writing, identify internally:
- what others trust first
- what others misread first
- what becomes frustrating under load
- what team members must learn to do around this person
- what behavioral debt accumulates if the pattern is unmanaged

Think evidence → mechanism → consequence internally. Write the consequence in executive language.

Anti-convergence requirements:
- Include at least 2 dossier-specific facts from canonical evidence, intake answers, cognition rationales, or prior sections.
- Include 1 profile-specific cause explaining why this team experience belongs to this person.
- Include 1 team consequence that would NOT apply equally to another Command/vector profile.

Do NOT use these generic phrases unless directly grounded and rewritten uniquely:
- "Command-first communication structure"
- "Team experiences Command as primary organizing force"
- "Relational awareness disappears under stress"
- "people need structure"
- "team needs alignment"

Use cognition ranked dimensions, primary/secondary/tertiary/lowest dimensions, pressure mechanics, tension pairs, communication style, leadership architecture, hidden contradictions, facilitator notes, strategic ceiling, one move, and written intake answers when available.

Executive distinction examples:
- Vector + Velocity: trust first = movement, pace, execution; misread = speed as certainty; debt = translation debt, rework, alignment lag.
- Vector + Flex: trust first = adaptability, situational adjustment; misread = flexibility as alignment; debt = ambiguity debt, consensus drift, unclear boundaries.
- Vector + Fidelity: trust first = certainty checked by verification; misread = checking as hesitation or control; debt = verification bottleneck, precision drag.
- Signal + Fidelity: trust first = reading, calibration, caution; misread = caution as reluctance; debt = quality threshold delay, over-checking.
- Fidelity + Framework: trust first = steadiness, process care; misread = process as rigidity; debt = repeatability burden, procedural drag.

Do not describe inner emotional state unless it directly changes how the team experiences the person.
Do not use generic command/operator explanations unless tied to evidence.
The output must answer: "Why does this person land this way on others?"

Do NOT use: "visible mechanism", "operating pair", "profile-exclusive causal mechanism", "late-cycle friction", "adoption data", "seed evidence", "operating math".
Prefer executive language: leader, team, decision, trust, clarity, execution, accountability, growth, feedback, ownership.

Write as organizational observation, not coaching advice. The output must be renderer-compatible with the existing othersExperience schema.`,

    format: JSON.stringify({
      section: "teamExperience",
      summary: "string",
      first_impression: { interpretation: "string" },
      communication_pattern: { interpretation: "string" },
      listening_pattern: { interpretation: "string" },
      relational_friction: { interpretation: "string" },
      key_signals: ["string", "string", "string"],
      causal_interpretation: "string"
    }),
  };
}

export function buildFiveFuturesPrompt(unified, interpreted, previousSections, cognitionContext = null) {
  return {
    systemRule: `You are generating trajectory simulations from verified behavioral intelligence.
DO NOT write generic self-help, vague futures, motivation, or personality advice.
Each future must show what happens behaviorally and organizationally.
Use ONLY supplied canonical evidence, prior sections, and cognition context.`,

    section: "fiveFutures",
    voiceMode: "trajectory-simulator",
    emotionalTemperature: "specific-inevitable",

    canonical: { unified,
      profileDNA: previousSections.profileDNA?.body,
      hiddenContradictions: previousSections.hiddenContradictions?.body,
      pressurePattern: unified.pressure_pattern,
      contradictionMap: unified.contradiction_map,
      scalingConstraint: unified.scaling_constraint,
      oneMoveSeed: unified.one_move_seed,
      strategicCeiling: previousSections.strategicCeiling?.body,
      recommendedNextStep: previousSections.recommendedNextStep?.body,
      facilitatorNotes: previousSections.facilitatorNotes,
      intake_answers: interpreted.intake_answers,
      cognition: buildCompactCognitionBlock(cognitionContext),
    },

    instruction: `Generate exactly five future trajectory cards as JSON.

Prompt intent:
Generate five specific trajectory scenarios from full canonical evidence, cognitionContext, contradictions, pressure mechanics, scaling constraint, facilitator notes, and recommended next step.

Anti-convergence requirement:
Before writing, identify how this profile differs from another similar Command/vector profile. Use the secondary system, pressure mechanics, written answers, role/company context, contradictions, facilitator notes, scaling constraint, and recommended next step to differentiate.
Every future must include:
- At least 2 direct dossier-specific facts from the supplied canonical evidence or prior sections
- At least 1 profile-specific cause explaining why this trajectory belongs to this person
- At least 1 organizational consequence that would NOT apply equally to another Command/vector profile

Do NOT use generic repeated conclusions unless directly evidenced by this profile:
- "needs structure"
- "decision frameworks"
- "clear escalation paths"
- "team alignment"
- "scaling bottlenecks"
- "burnout"
- "family expectations"
- "internal doubts"

If one of those ideas is used, tie it to the exact evidence that makes it true for this dossier. Otherwise choose a different cause.

Rules:
- No generic self-help.
- No vague futures.
- Each future must show what happens behaviorally and organizationally.
- Current Trajectory = what happens if nothing changes.
- Optimized Trajectory = what improves if the One Move and environment design are adopted.
- Burnout Trajectory = what breaks under prolonged pressure.
- Leadership Trajectory = what happens if the operator matures into stronger leadership architecture.
- Constraint Trajectory = what happens if the main scaling constraint remains unresolved.

Titles:
Preserve renderer fields, but make titles short, human, and boardroom-readable. Do not let a full consequence sentence become the title.
Examples:
- "Current Trajectory: Momentum With Rising Coordination Cost"
- "Optimized Trajectory: Decision Rules Become Transferable"
- "Burnout Trajectory: Founder Dependency Increases"
- "Leadership Trajectory: Judgment Becomes Transferable"
- "Constraint Trajectory: Scale Exposes The Gap"

Do NOT use: "visible mechanism", "operating pair", "profile-exclusive causal mechanism", "late-cycle friction", "adoption data", "seed evidence", "operating math".
Prefer executive language: leader, team, decision, trust, clarity, execution, accountability, growth, feedback, ownership.

Do not add extra futures. Do not rename fields. Keep title, likelihood, trajectory, and organization_experiences exactly as fields.`,

    format: JSON.stringify({
      section: "fiveFutures",
      summary: "string",
      most_likely: {
        title: "string",
        likelihood: "string",
        trajectory: "string",
        organization_experiences: "string"
      },
      futures: [
        {
          title: "Current Trajectory: profile-specific bottleneck",
          likelihood: "likely",
          trajectory: "string",
          organization_experiences: "string"
        },
        {
          title: "Optimized Trajectory: profile-specific unlock",
          likelihood: "possible",
          trajectory: "string",
          organization_experiences: "string"
        },
        {
          title: "Burnout Trajectory: profile-specific overload pattern",
          likelihood: "risk",
          trajectory: "string",
          organization_experiences: "string"
        },
        {
          title: "Leadership Trajectory: profile-specific maturation path",
          likelihood: "possible",
          trajectory: "string",
          organization_experiences: "string"
        },
        {
          title: "Constraint Trajectory: profile-specific unresolved constraint",
          likelihood: "likely",
          trajectory: "string",
          organization_experiences: "string"
        }
      ]
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
  buildFacilitatorNotesPrompt,
  buildTeamExperiencePrompt,
  buildFiveFuturesPrompt,
};
