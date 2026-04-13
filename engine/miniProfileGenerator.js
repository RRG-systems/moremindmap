/**
 * MINI PROFILE GENERATOR — PHASE 1
 * 
 * Generates long-form behavioral intelligence report with:
 * - Dominance Model (primary/supporting/suppressed)
 * - Tradeoff Engine (strengths + costs)
 * - Multi-paragraph content
 */

import { DIMENSION_LABELS } from "./dimensionMap.js"
import { interpretWrittenResponses, generateInterpreterModifier } from "./writtenResponseInterpreter.js"

/**
 * STEP 1: Organize dimensions into dominance groups
 */
function buildDominanceStructure(rankedDimensions) {
  // Top 2-3 = PRIMARY DRIVERS
  // Next 2-3 = SUPPORTING PATTERNS
  // Bottom = SUPPRESSED / NON-DOMINANT

  const primary = rankedDimensions.slice(0, 2)
  const secondary = rankedDimensions.slice(2, 4)
  const suppressed = rankedDimensions.slice(4)

  return {
    primary,
    secondary,
    suppressed,
  }
}

/**
 * STEP 2: Tradeoff definitions for each dimension
 * Each dimension has: advantages + tradeoffs (costs)
 */
const DIMENSION_TRADEOFFS = {
  velocity: {
    label: "Velocity (Tempo)",
    advantages: [
      "Moves quickly to action without paralysis",
      "Creates momentum and forward progress",
      "Comfortable making decisions with partial information",
      "Energizes teams through pace and decisiveness",
    ],
    tradeoffs: [
      "May miss important nuance or context",
      "Can appear impatient with careful analysis",
      "Risk of premature decisions that need rework",
      "May not adequately gather input from others",
    ],
  },
  vector: {
    label: "Vector (Command)",
    advantages: [
      "Provides clear direction and removes ambiguity",
      "Takes charge naturally without waiting for consensus",
      "Establishes decisiveness and accountability",
      "Cuts through debate to move toward goals",
    ],
    tradeoffs: [
      "Can seem dominating or dismissive of alternatives",
      "May reduce team input and buy-in",
      "Can create friction with collaborative cultures",
      "Risk of missing valuable minority perspectives",
    ],
  },
  horizon: {
    label: "Horizon (Perspective)",
    advantages: [
      "Sees patterns and possibilities others miss",
      "Connects dots across disparate information",
      "Thinks beyond immediate constraints",
      "Inspires others with compelling future states",
    ],
    tradeoffs: [
      "Can seem disconnected from present-day execution",
      "May underestimate practical obstacles",
      "Risk of being seen as unrealistic or vague",
      "Difficulty communicating vision clearly to detail-oriented teams",
    ],
  },
  leverage: {
    label: "Leverage (Influence)",
    advantages: [
      "Builds networks and relationships strategically",
      "Moves things through systems and people",
      "Creates alliances that amplify impact",
      "Negotiates effectively and finds paths forward",
    ],
    tradeoffs: [
      "Can appear more focused on politics than substance",
      "May prioritize relationships over raw performance",
      "Risk of seeming manipulative or calculating",
      "Can get caught between constituencies",
    ],
  },
  signal: {
    label: "Signal (Relational Awareness)",
    advantages: [
      "Reads market conditions and social cues accurately",
      "Adjusts timing to maximize impact",
      "Knows when to push and when to hold",
      "Navigates complex interpersonal dynamics smoothly",
    ],
    tradeoffs: [
      "Can seem overly cautious or hesitant",
      "May delay action waiting for perfect moment",
      "Risk of appearing indirect or unclear",
      "Can get caught in endless re-calibration",
    ],
  },
  fidelity: {
    label: "Fidelity (Precision)",
    advantages: [
      "Ensures quality and accuracy in execution",
      "Catches errors and inconsistencies others miss",
      "Builds trust through reliable, thorough work",
      "Creates systems that scale because they're precise",
    ],
    tradeoffs: [
      "Can slow down progress with perfectionism",
      "May seem overly focused on details",
      "Risk of analysis paralysis or endless refinement",
      "Can frustrate faster-moving teammates",
    ],
  },
  flex: {
    label: "Flex (Adaptability)",
    advantages: [
      "Pivots quickly when conditions change",
      "Comfortable with ambiguity and uncertainty",
      "Finds creative solutions to novel problems",
      "Keeps options open rather than over-committing",
    ],
    tradeoffs: [
      "Can seem inconsistent or unprincipled",
      "May not follow through on commitments",
      "Risk of being seen as unreliable",
      "Difficulty maintaining focus on long-term goals",
    ],
  },
  framework: {
    label: "Framework (Structure)",
    advantages: [
      "Creates systems and processes that endure",
      "Brings order to chaos",
      "Scales through repeatable approaches",
      "Provides clarity and consistency to teams",
    ],
    tradeoffs: [
      "Can seem rigid or resistant to change",
      "May over-engineer simple problems",
      "Risk of rules getting in the way of results",
      "Can stifle innovation and experimentation",
    ],
  },
}

/**
 * STEP 3: Generate long-form sections
 */

function generateHeadline(dominance) {
  const primary1 = dominance.primary[0]?.key
  const primary2 = dominance.primary[1]?.key

  const headlineMap = {
    velocity_vector: "Fast-moving command executor",
    velocity_horizon: "Visionary who moves at speed",
    velocity_leverage: "Momentum-driven networker",
    vector_horizon: "Strategic leader with clear vision",
    vector_leverage: "Influential decision-maker",
    horizon_leverage: "Visionary relationship builder",
  }

  const key = `${primary1}_${primary2}`
  return headlineMap[key] || "High-impact operator"
}

function generateSummary(dominance, dimensions) {
  const primary = dominance.primary
  const secondary = dominance.secondary

  const tradeoffs = primary.map((d) => DIMENSION_TRADEOFFS[d.key])

  return `You are defined by a small number of dominant patterns that shape how you think, decide, and move.

Your primary drivers are ${primary.map((d) => d.label.toLowerCase()).join(" and ")}, which means ${
    primary[0]?.key === "velocity"
      ? "you prioritize action and speed,"
      : "you take charge and set direction,"
  } while ${primary[1]?.key === "vector" ? "establishing clear command." : "moving at pace."} These patterns interact: ${
    primary[0]?.key === "velocity" && primary[1]?.key === "vector"
      ? "you combine decisiveness with forward momentum, which means you move fast AND take charge."
      : "they reinforce each other to create your distinctive operating style."
  }

Your supporting patterns in ${secondary.map((d) => d.label.toLowerCase()).join(" and ")} provide flexibility and additional capability. Together, these create someone who is effective, but also someone with blind spots—not weaknesses, but areas where your dominant traits have costs.`
}

function generateWhatThisMeans(dominance) {
  const primary = dominance.primary
  const tradeoffs = primary.map((d) => DIMENSION_TRADEOFFS[d.key])

  let section = `Your profile is shaped by dominant patterns that drive most of your decisions and behavior.\n\n`

  // Describe each primary driver with advantages and tradeoffs
  for (let i = 0; i < primary.length; i++) {
    const dim = primary[i]
    const t = DIMENSION_TRADEOFFS[dim.key]

    section += `${t.label} is your strongest pattern. ${t.advantages[0]} You naturally ${t.advantages[1]?.toLowerCase() || "operate this way"}. The advantage is clear: ${t.advantages[2]?.toLowerCase() || "you get results"}. The cost is also clear: ${t.tradeoffs[0]?.toLowerCase() || "tradeoffs exist"}. Additionally, ${t.tradeoffs[1]?.toLowerCase() || "you face predictable challenges"}.\n\n`
  }

  section += `Your lower-scoring dimensions are not weaknesses—they reflect areas your system prioritizes less because dominant traits are already taking charge. For example, a low Framework score doesn't mean you can't structure; it means Velocity is already driving action, so structure comes second.\n\n`

  section += `This drives real strengths: you move fast, decide under pressure, and build momentum. The cost: you skip details, rush steps, and sometimes miss the human impact of speed.`

  return section
}

function generateHowYouMove(dominance) {
  const primary = dominance.primary
  const isVelocityDriven = primary.some((d) => d.key === "velocity")
  const isVectorDriven = primary.some((d) => d.key === "vector")

  let section = `You move by getting to the point and taking action. `

  if (isVelocityDriven) {
    section += `You don't wait for perfect information; you move with 60-70% clarity and adjust mid-course. This creates speed, but sometimes you need to backtrack. You cut non-essentials ruthlessly and focus entirely on forward momentum.\n\n`
  }

  if (isVectorDriven) {
    section += `You take charge naturally. You're comfortable stepping in to provide direction when situations are unclear. You make the call and move on. This creates clarity, but it can also mean people feel less heard.\n\n`
  }

  section += `When situations shift, you adapt immediately. You don't cling to original plans if conditions have changed. You reassess and reroute on the fly. This flexibility is your strength; your challenge is knowing when to hold course versus when to pivot.\n\n`

  section += `In meetings and group settings, you move the conversation toward decision. You're uncomfortable with endless debate. You push for closure, next steps, and momentum. This can feel pushy to people who need more time to think.`

  return section
}

function generateCommunicationStyle(dominance) {
  const primary = dominance.primary
  const isVectorDriven = primary.some((d) => d.key === "vector")

  let section = `You communicate directly and briefly. You skip preamble and context-setting. You get to the point. Most people appreciate this; some experience it as blunt.\n\n`

  if (isVectorDriven) {
    section += `Your communication style reflects your need for clarity and direction. You speak with confidence. You state conclusions, not possibilities. You're comfortable being wrong, correcting, and moving on.\n\n`
  }

  section += `In writing, you favor bullets and short paragraphs over prose. You're impatient with lengthy explanations. You want the key insight, the implication, and the next step.\n\n`

  section += `You listen selectively. You're hearing for the core idea or decision point, not the full context. This means you can miss important nuance from people who communicate in layers. They may feel unheard even when you've captured their main point.\n\n`

  section += `When you disagree, you say so. You don't soften critique with excessive politeness. You assume others can handle directness. Some find this refreshing; others find it harsh.`

  return section
}

function generateDecisionPattern(dominance) {
  const primary = dominance.primary
  const isVelocityDriven = primary.some((d) => d.key === "velocity")
  const isVectorDriven = primary.some((d) => d.key === "vector")

  let section = `You decide quickly and with conviction. You trust pattern recognition over exhaustive analysis. `

  if (isVelocityDriven) {
    section += `You decide with partial information and move before all alternatives are analyzed. You gather 60-70% of what you think you need, then call it.\n\n`
  }

  section += `You make the same kinds of decisions repeatedly, and they tend to work out, so you trust your instinct. When they don't, you adjust and move on quickly.\n\n`

  if (isVectorDriven) {
    section += `You own your decisions visibly. You don't hide behind committee consensus or data analysis. You step forward and say "here's what I think we should do." This creates accountability and clarity.\n\n`
  }

  section += `You're comfortable with risk. You accept that some decisions will be wrong. You've learned that perfect decision-making is slower than good-enough decision-making followed by quick adjustment.\n\n`

  section += `You don't revisit decisions unnecessarily. Once called, a decision stays called. You move energy toward implementation, not second-guessing. This creates momentum; it also means you can miss important signals to course-correct.`

  return section
}

function generateLeadershipSnapshot(dominance) {
  const primary = dominance.primary

  let section = `You lead by example and momentum. Your teams follow your pace and decisiveness, not because you inspire them with words, but because you move. You raise the bar through action.\n\n`

  section += `You create clarity through direction. When ambiguity exists, you step in and decide. Your teams may not always like the decision, but they know where they stand. This reduces anxiety and increases velocity.\n\n`

  section += `You're impatient with process for its own sake. You'll create structure if it serves speed, but you won't maintain it if it slows things down. This can make you a refreshing leader in slow-moving organizations, and a chaotic one in cultures that need stability.\n\n`

  section += `You notice and reward execution. You celebrate fast closures and momentum more than you do careful deliberation. Over time, this shapes teams to move faster and take more risks.\n\n`

  section += `Your challenge is ensuring people feel heard. Directness can read as dismissal if you're not careful. The best version of you includes one extra pause to listen.`

  return section
}

function generateFrictionPattern(dominance) {
  const primary = dominance.primary
  const secondary = dominance.secondary

  let section = `Your dominant patterns create predictable friction points:\n\n`

  section += `In detail work: You tend to cut too many corners. You want the 80% solution and move on. This works for fast-moving markets; it's dangerous in regulated or high-precision environments.\n\n`

  section += `With people: You can miss important emotional or interpersonal data. You're focused on the problem, not the person. People may feel unseen or undervalued, even when you respect them.\n\n`

  section += `In long-term planning: You optimize for immediate velocity over future-proofing. You're happy to rework things later if it means moving faster now. This creates technical debt and relationship friction.\n\n`

  section += `Under pressure: You get more impatient, not less. This can tip into bulldozing or dismissiveness. Your teams may feel unheard when you need them most.\n\n`

  section += `With people who think differently: You can appear intolerant of different paces, styles, or thinking processes. Slow thinkers, detail people, or consensus-builders may feel judged by your model.`

  return section
}

function generateSalesBehavior(dominance) {
  const primary = dominance.primary

  let section = `In sales, you move the conversation toward decision. You don't linger in rapport-building or trust-creation. You move to value prop, objection handling, and close.\n\n`

  section += `You're comfortable with rejection. You don't take it personally. You move to the next opportunity. This gives you persistence that lower-confidence salespeople don't have.\n\n`

  section += `You build momentum through early wins. You want to create a sense that things are moving forward. You use velocity as a tactic: "We've already done X and Y, moving to Z tomorrow."\n\n`

  section += `Your weakness in sales is understanding the buyer's real concerns. You hear what they say and move on. You may miss the unstated objection or the relationship issue beneath the surface objection.\n\n`

  section += `You're effective in high-velocity sales environments and weaker in complex, relationship-driven, long-cycle deals where buyers need to feel understood.`

  return section
}

function generateRecommendedNextStep() {
  return `Consider a single practice: Before major decisions or important conversations, pause for one extra beat and ask: "What might I be missing here? Who else should I hear from?" This isn't about slowing down. It's about adding one small input valve to a system that's already moving fast. You'll still move quickly; you'll just move on slightly more complete information.`
}

/**
 * STEP 4: Assemble the complete mini profile
 */
export function generateMiniProfile(scoringPayload, writtenResponses = []) {
  if (!scoringPayload || (!scoringPayload.ranked && !scoringPayload.ranked_dimensions)) {
    throw new Error("Invalid scoring payload: missing ranked or ranked_dimensions")
  }

  // scoreAssessment returns 'ranked', but we support both for compatibility
  const rankedDimensions = scoringPayload.ranked_dimensions || scoringPayload.ranked
  const dominance = buildDominanceStructure(rankedDimensions)

  // PHASE 2A: Interpret written responses to modify profile tone
  const writtenInterpretation = interpretWrittenResponses(writtenResponses)
  const interpreterModifier = generateInterpreterModifier(writtenInterpretation)

  return {
    // Dominance structure (for frontend/analysis)
    dominance_structure: {
      primary: dominance.primary.map((d) => ({
        key: d.key,
        label: d.label,
        score: d.percent,
      })),
      secondary: dominance.secondary.map((d) => ({
        key: d.key,
        label: d.label,
        score: d.percent,
      })),
      suppressed: dominance.suppressed.map((d) => ({
        key: d.key,
        label: d.label,
        score: d.percent,
      })),
    },

    // Long-form sections (multi-paragraph)
    headline: generateHeadline(dominance),
    summary: generateSummary(dominance, scoringPayload.dimensions),
    what_this_means: generateWhatThisMeans(dominance),
    how_you_move: generateHowYouMove(dominance),
    communication_style: generateCommunicationStyle(dominance),
    decision_pattern: generateDecisionPattern(dominance),
    leadership_snapshot: generateLeadershipSnapshot(dominance),
    friction_pattern: generateFrictionPattern(dominance),
    sales_behavior: generateSalesBehavior(dominance),

    // Primary/secondary labels (compatibility with frontend)
    primary_pattern: dominance.primary
      .map((d) => d.label)
      .join(", "),
    secondary_pattern: dominance.secondary
      .map((d) => d.label)
      .join(", "),

    recommended_next_step: generateRecommendedNextStep(),

    // Metadata
    dominance_note:
      "This profile is shaped by a small number of dominant patterns. Your lower scores are not deficiencies—they reflect areas your system relies on less because stronger patterns are leading.",

    // PHASE 2A: Written response interpretation
    written_interpretation: writtenInterpretation,
    interpreter_modifier: interpreterModifier,
  }
}
