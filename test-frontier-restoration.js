#!/usr/bin/env node

/**
 * test-frontier-restoration.js
 * 
 * Local validation of frontier inference orchestrator restoration.
 * Generates 3 test profiles and compares behavioral depth.
 */

import { generateCanonicalProfile } from './api/engine/canonical/canonicalProfileGenerator.js'

// Test profile inputs: David, Billybob, Neutral
const testProfiles = {
  david: {
    person_name: 'David',
    email: 'david@example.com',
    organizationalMetadata: {},
    dimension_scores: {
      vector: { raw_score: 0.86, rank: 1, label: 'Command' },
      signal: { raw_score: 0.69, rank: 5, label: 'Relational' },
      fidelity: { raw_score: 0.83, rank: 2, label: 'Precision' },
      velocity: { raw_score: 0.70, rank: 4, label: 'Tempo' },
      leverage: { raw_score: 0.50, rank: 6, label: 'Influence' },
      flex: { raw_score: 0.69, rank: 3, label: 'Adaptability' },
      framework: { raw_score: 0.50, rank: 7, label: 'Structure' },
      horizon: { raw_score: 0.50, rank: 8, label: 'Perspective' }
    },
    assessmentAnswers: [
      { q: 1, answer: 'A', type: 'mc' },
      { q: 3, answer: 'A', type: 'mc' },
      { q: 24, answer: 'I move fast but sometimes miss relational signals until too late', type: 'written' }
    ],
    life_direction: { stated_priorities: ['speed', 'impact', 'autonomy'] },
    business_reality: { numerical_grounding: 'high', scale_indicators: { 'team_size': 12, 'revenue': 5000000 } }
  },

  billybob: {
    person_name: 'Billybob',
    email: 'billybob@example.com',
    organizationalMetadata: {},
    dimension_scores: {
      vector: { raw_score: 0.50, rank: 6, label: 'Command' },
      signal: { raw_score: 0.30, rank: 8, label: 'Relational' },
      fidelity: { raw_score: 0.95, rank: 1, label: 'Precision' },
      velocity: { raw_score: 0.40, rank: 7, label: 'Tempo' },
      leverage: { raw_score: 0.60, rank: 5, label: 'Influence' },
      flex: { raw_score: 0.70, rank: 3, label: 'Adaptability' },
      framework: { raw_score: 0.85, rank: 2, label: 'Structure' },
      horizon: { raw_score: 0.50, rank: 4, label: 'Perspective' }
    },
    assessmentAnswers: [
      { q: 1, answer: 'D', type: 'mc' },
      { q: 3, answer: 'D', type: 'mc' },
      { q: 24, answer: 'I get stuck in perfectionism and miss the bigger picture', type: 'written' }
    ],
    life_direction: { stated_priorities: ['accuracy', 'stability', 'mastery'] },
    business_reality: { numerical_grounding: 'high', gap_awareness: true }
  },

  neutral: {
    person_name: 'Neutral Operator',
    email: 'neutral@example.com',
    organizationalMetadata: {},
    dimension_scores: {
      vector: { raw_score: 2.0, rank: 4, label: 'Command' },
      signal: { raw_score: 2.0, rank: 5, label: 'Relational' },
      fidelity: { raw_score: 2.0, rank: 3, label: 'Precision' },
      velocity: { raw_score: 2.0, rank: 6, label: 'Tempo' },
      leverage: { raw_score: 2.0, rank: 7, label: 'Influence' },
      flex: { raw_score: 2.0, rank: 2, label: 'Adaptability' },
      framework: { raw_score: 2.0, rank: 1, label: 'Structure' },
      horizon: { raw_score: 2.0, rank: 8, label: 'Perspective' }
    },
    assessmentAnswers: [
      { q: 1, answer: 'B', type: 'mc' },
      { q: 3, answer: 'C', type: 'mc' },
      { q: 24, answer: 'I adapt to what the situation requires', type: 'written' }
    ],
    life_direction: { stated_priorities: ['balance', 'growth', 'learning'] },
    business_reality: { numerical_grounding: 'moderate', adaptability: true }
  }
}

async function testFrontierRestoration() {
  console.log('\n========== FRONTIER RESTORATION VALIDATION ==========\n')

  for (const [name, profileInput] of Object.entries(testProfiles)) {
    console.log(`\n--- Generating ${name.toUpperCase()} Profile ---`)
    
    try {
      const profile = await generateCanonicalProfile(profileInput, {
        profile_id: `test-${name}-frontier`,
        model: 'canonical-v2-frontier-restored'
      })

      // Validation checks
      const checks = {
        'Has model field': !!profile.metadata?.model,
        'Model is frontier': profile.metadata?.model?.includes('frontier'),
        'Has vector_scores': !!profile.vector_scores,
        'Has ranked_dimensions': Array.isArray(profile.ranked_dimensions),
        'Has top_systems': Array.isArray(profile.top_systems),
        'Has contradictions': Array.isArray(profile.contradictions),
        'Has stress_patterns': !!profile.stress_patterns,
        'Has inferred_patterns': !!profile.inferred_patterns,
        'Has analyzed_responses': !!profile.life_direction,
        'Has behavioral_consequences': !!profile.behavioral_consequences,
        'Has organizational_effects': !!profile.organizational_effects,
        'Has causal_chains': !!profile.causal_chains,
        'Contradictions count': profile.contradictions?.length || 0,
        'Top systems count': profile.top_systems?.length || 0
      }

      // Display results
      Object.entries(checks).forEach(([check, value]) => {
        const status = value > 0 ? '✓' : (value ? '✓' : '✗')
        console.log(`  ${status} ${check}:`, value)
      })

      // Show first contradiction if present
      if (profile.contradictions?.length > 0) {
        console.log(`\n  First Contradiction:`)
        console.log(`    Tension: ${profile.contradictions[0].tension}`)
        console.log(`    Dimensions: ${profile.contradictions[0].dimensions_in_conflict?.join(' vs ')}`)
        console.log(`    Severity: ${profile.contradictions[0].severity}`)
      }

      // Show stress pattern if present
      if (profile.stress_patterns?.amplified_dimension) {
        console.log(`\n  Stress Pattern:`)
        console.log(`    Amplified: ${profile.stress_patterns.amplified_dimension}`)
        console.log(`    Lost: ${profile.stress_patterns.lost_dimensions?.join(', ') || 'none'}`)
      }

      // Show primary driver manifestations
      if (profile.top_systems?.[0]) {
        const primary = profile.top_systems[0]
        console.log(`\n  Primary Driver: ${primary.dimension}`)
        if (primary.operating_manifestation) {
          console.log(`    Operating: ${primary.operating_manifestation.substring(0, 80)}...`)
        }
        if (primary.pressure_manifestation) {
          console.log(`    Pressure: ${primary.pressure_manifestation.substring(0, 80)}...`)
        }
      }

      console.log(`\n  ✓ ${name} profile generated successfully`)

    } catch (err) {
      console.error(`\n  ✗ ERROR generating ${name} profile:`, err.message)
      console.error(err.stack.split('\n').slice(0, 5).join('\n'))
    }
  }

  console.log('\n========== VALIDATION COMPLETE ==========\n')
}

// Run tests
testFrontierRestoration().catch(console.error)
