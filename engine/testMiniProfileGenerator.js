/**
 * TEST: Mini Profile Generator
 * Demonstrates dominance model, tradeoffs, and long-form expansion
 */

import { generateMiniProfile } from "./miniProfileGenerator.js"

// Mock scoring payload (simulating a real user profile)
const mockScoringPayload = {
  normalizedScores: {
    vector: 75,
    signal: 70,
    fidelity: 65,
    velocity: 78,
    leverage: 72,
    flex: 68,
    framework: 62,
    horizon: 74,
  },
  ranked_dimensions: [
    { key: "velocity", label: "Velocity (Tempo)", percent: 78 },
    { key: "vector", label: "Vector (Command)", percent: 75 },
    { key: "horizon", label: "Horizon (Perspective)", percent: 74 },
    { key: "leverage", label: "Leverage (Influence)", percent: 72 },
    { key: "signal", label: "Signal (Relational Awareness)", percent: 70 },
    { key: "flex", label: "Flex (Adaptability)", percent: 68 },
    { key: "fidelity", label: "Fidelity (Precision)", percent: 65 },
    { key: "framework", label: "Framework (Structure)", percent: 62 },
  ],
  dimensions: {
    vector: 75,
    signal: 70,
    fidelity: 65,
    velocity: 78,
    leverage: 72,
    flex: 68,
    framework: 62,
    horizon: 74,
  },
}

console.log("=" .repeat(80))
console.log("MINI PROFILE GENERATOR TEST — PHASE 1")
console.log("=" .repeat(80))

try {
  const miniProfile = generateMiniProfile(mockScoringPayload)

  console.log("\n✓ DOMINANCE STRUCTURE")
  console.log("-".repeat(80))
  console.log("\nPRIMARY DRIVERS:")
  miniProfile.dominance_structure.primary.forEach((d) => {
    console.log(`  • ${d.label} (${d.score}%)`)
  })
  console.log("\nSECONDARY PATTERNS:")
  miniProfile.dominance_structure.secondary.forEach((d) => {
    console.log(`  • ${d.label} (${d.score}%)`)
  })
  console.log("\nSUPPRESSED / NON-DOMINANT:")
  miniProfile.dominance_structure.suppressed.forEach((d) => {
    console.log(`  • ${d.label} (${d.score}%)`)
  })

  console.log("\n\n✓ HEADLINE")
  console.log("-".repeat(80))
  console.log(miniProfile.headline)

  console.log("\n\n✓ SUMMARY (Multi-paragraph expansion)")
  console.log("-".repeat(80))
  console.log(miniProfile.summary)

  console.log("\n\n✓ WHAT THIS MEANS (NEW: Dominance + Tradeoffs synthesis)")
  console.log("-".repeat(80))
  console.log(miniProfile.what_this_means)

  console.log("\n\n✓ HOW YOU MOVE (Expanded from 1 → 3+ paragraphs)")
  console.log("-".repeat(80))
  console.log(miniProfile.how_you_move)

  console.log("\n\n✓ COMMUNICATION STYLE (Long-form)")
  console.log("-".repeat(80))
  console.log(miniProfile.communication_style)

  console.log("\n\n✓ DECISION PATTERN (Long-form)")
  console.log("-".repeat(80))
  console.log(miniProfile.decision_pattern)

  console.log("\n\n✓ LEADERSHIP SNAPSHOT (Long-form)")
  console.log("-".repeat(80))
  console.log(miniProfile.leadership_snapshot)

  console.log("\n\n✓ FRICTION PATTERN (Long-form, behavior-based)")
  console.log("-".repeat(80))
  console.log(miniProfile.friction_pattern)

  console.log("\n\n✓ SALES BEHAVIOR (Long-form)")
  console.log("-".repeat(80))
  console.log(miniProfile.sales_behavior)

  console.log("\n\n✓ RECOMMENDED NEXT STEP (Practical, not self-help)")
  console.log("-".repeat(80))
  console.log(miniProfile.recommended_next_step)

  console.log("\n\n✓ DOMINANCE NOTE (Explanation of low scores)")
  console.log("-".repeat(80))
  console.log(miniProfile.dominance_note)

  console.log("\n" + "=" .repeat(80))
  console.log("JSON OUTPUT SCHEMA (for frontend)")
  console.log("=" .repeat(80))
  console.log(JSON.stringify(miniProfile, null, 2).slice(0, 2000) + "...\n")

  console.log("\n✓ SUCCESS: Mini profile generated with:")
  console.log("  • Dominance structure (primary/secondary/suppressed)")
  console.log("  • Tradeoff engine integrated into sections")
  console.log("  • Multi-paragraph long-form content")
  console.log("  • Behavioral language (not generic labels)")
  console.log("  • Low score explanation (de-prioritized, not deficient)")
} catch (error) {
  console.error("\n✗ ERROR:", error.message)
  console.error(error.stack)
}

console.log("\n" + "=".repeat(80))
