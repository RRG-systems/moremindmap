/**
 * VERIFY: generateMiniProfile() Output
 * 
 * Check that the generator returns ALL Phase 1 fields
 */

import { generateMiniProfile } from "./miniProfileGenerator.js"

// Mock scoring payload (realistic test data)
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

console.log("================================================================================")
console.log("GENERATOR OUTPUT VERIFICATION")
console.log("================================================================================\n")

try {
  const output = generateMiniProfile(mockScoringPayload)

  console.log("✓ generateMiniProfile() executed successfully\n")

  // Check for Phase 1 fields
  console.log("CHECKING FOR PHASE 1 FIELDS:")
  console.log("─".repeat(80) + "\n")

  const phase1Fields = [
    "dominance_structure",
    "what_this_means",
    "dominance_note",
  ]

  const requiredFields = [
    "headline",
    "summary",
    "how_you_move",
    "communication_style",
    "decision_pattern",
    "leadership_snapshot",
    "friction_pattern",
    "sales_behavior",
    "primary_pattern",
    "secondary_pattern",
    "recommended_next_step",
  ]

  console.log("PHASE 1 NEW FIELDS:")
  phase1Fields.forEach((field) => {
    const present = field in output
    const status = present ? "✓" : "✗"
    const type = present ? typeof output[field] : "N/A"
    console.log(`  ${status} ${field} (type: ${type})`)
  })

  console.log("\nREQUIRED FIELDS:")
  requiredFields.forEach((field) => {
    const present = field in output
    const status = present ? "✓" : "✗"
    const type = present ? typeof output[field] : "N/A"
    console.log(`  ${status} ${field} (type: ${type})`)
  })

  // Verify dominance_structure shape
  console.log("\nDOMINANCE STRUCTURE VERIFICATION:")
  console.log("─".repeat(80) + "\n")

  if (output.dominance_structure) {
    const ds = output.dominance_structure
    console.log(`  ✓ dominance_structure present`)
    console.log(
      `    • primary: ${ds.primary?.length || 0} items`,
      ds.primary?.length === 2 ? "✓" : "✗"
    )
    console.log(
      `    • secondary: ${ds.secondary?.length || 0} items`,
      ds.secondary?.length === 2 ? "✓" : "✗"
    )
    console.log(
      `    • suppressed: ${ds.suppressed?.length || 0} items`,
      ds.suppressed?.length === 4 ? "✓" : "✗"
    )

    // Show sample structure
    if (ds.primary && ds.primary.length > 0) {
      console.log(`\n    Sample primary item:`)
      console.log(`      ${JSON.stringify(ds.primary[0], null, 6)}`)
    }
  } else {
    console.log(`  ✗ dominance_structure missing!`)
  }

  // Verify long-form text fields
  console.log("\n\nLONG-FORM TEXT VERIFICATION:")
  console.log("─".repeat(80) + "\n")

  const textFields = {
    what_this_means: "New dominance + tradeoff synthesis",
    how_you_move: "Expanded behavioral description",
    communication_style: "Multi-paragraph communication details",
    decision_pattern: "Decision-making process description",
    leadership_snapshot: "Leadership behavior analysis",
    friction_pattern: "Conflict and friction points",
    sales_behavior: "Sales effectiveness patterns",
  }

  Object.entries(textFields).forEach(([field, description]) => {
    const text = output[field]
    if (text && typeof text === "string" && text.length > 300) {
      const wordCount = text.split(/\s+/).length
      const paragraphCount = (text.match(/\n\n/g) || []).length + 1
      console.log(`  ✓ ${field}`)
      console.log(`    • Length: ${text.length} characters`)
      console.log(`    • Words: ${wordCount}`)
      console.log(`    • Paragraphs: ${paragraphCount}`)
      console.log(`    • Sample: "${text.substring(0, 80)}..."`)
    } else {
      const length = text ? text.length : 0
      console.log(`  ✗ ${field} (only ${length} chars, need 300+)`)
    }
    console.log()
  })

  // Final verdict
  console.log("FINAL VERDICT:")
  console.log("─".repeat(80) + "\n")

  const allFieldsPresent = phase1Fields.every((f) => f in output) &&
    requiredFields.every((f) => f in output)
  const textQualityGood = Object.keys(textFields).every(
    (f) => output[f] && output[f].length > 300
  )
  const dominanceStructureValid =
    output.dominance_structure &&
    output.dominance_structure.primary &&
    output.dominance_structure.primary.length === 2

  if (allFieldsPresent && textQualityGood && dominanceStructureValid) {
    console.log("✓ GENERATOR OUTPUT IS COMPLETE AND CORRECT")
    console.log("\nAll Phase 1 requirements met:")
    console.log("  ✓ Dominance structure present and valid")
    console.log("  ✓ Long-form fields present (300+ chars each)")
    console.log("  ✓ what_this_means (NEW) included")
    console.log("  ✓ dominance_note (NEW) included")
    console.log("  ✓ All required fields present")
  } else {
    console.log("✗ GENERATOR OUTPUT HAS ISSUES\n")
    if (!allFieldsPresent) console.log("  ✗ Missing required fields")
    if (!textQualityGood) console.log("  ✗ Text fields too short")
    if (!dominanceStructureValid) console.log("  ✗ Dominance structure invalid")
  }

  console.log("\n" + "=".repeat(80))
  console.log("FULL OUTPUT (JSON):")
  console.log("=".repeat(80) + "\n")

  console.log(JSON.stringify(output, null, 2))
} catch (error) {
  console.error("✗ ERROR:", error.message)
  console.error(error.stack)
}
