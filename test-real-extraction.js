/**
 * Real Profile Extraction Test
 * Tests against: MM-20260523-mqlev9c9 (from benchmark_profiles)
 */

import { extractBehavioralIntelligence } from './api/engine/canonical/extractIntelligence.js';
import fs from 'fs';

const PROFILE_PATH = './benchmark_profiles/MM-20260523-mqlev9c9/CANONICAL_PROFILE.json';

function runRealExtractionTest() {
  console.log('═'.repeat(80));
  console.log('REAL PROFILE EXTRACTION TEST');
  console.log('Profile: MM-20260523-mqlev9c9 (Legacy Benchmark)');
  console.log('═'.repeat(80));
  console.log('');

  try {
    // Load canonical profile
    console.log(`Loading: ${PROFILE_PATH}`);
    const canonical_json = fs.readFileSync(PROFILE_PATH, 'utf8');
    const canonical = JSON.parse(canonical_json);
    console.log(`✓ Loaded canonical (${Object.keys(canonical).length} top-level fields)`);
    console.log('');

    // Show available fields
    console.log('[Available Dossier Fields]');
    Object.keys(canonical).forEach(key => {
      const value = canonical[key];
      const type = Array.isArray(value) ? 'array' : typeof value;
      const size = type === 'array' ? value.length : type === 'object' && value !== null ? Object.keys(value).length : '-';
      console.log(`  ${key}: ${type} (${size})`);
    });
    console.log('');

    // Run extraction
    console.log('[Running Extraction]');
    const start = Date.now();
    const intelligence = extractBehavioralIntelligence(canonical);
    const duration = Date.now() - start;
    console.log(`✓ Extraction completed in ${duration}ms`);
    console.log('');

    // Full output
    console.log('═'.repeat(80));
    console.log('FULL behavioral_intelligence_v1 OBJECT');
    console.log('═'.repeat(80));
    console.log(JSON.stringify(intelligence, null, 2));
    console.log('');

    // Section-by-section review
    console.log('═'.repeat(80));
    console.log('SECTION-BY-SECTION EXTRACTION REVIEW');
    console.log('═'.repeat(80));
    console.log('');

    const domains = intelligence.domains;

    // Domain 1: Operating System
    console.log('[1. Operating System]');
    console.log(`Confidence: ${domains.operatingSystem.confidence}`);
    console.log(`Summary: ${domains.operatingSystem.summary}`);
    console.log(`Primary: ${domains.operatingSystem.primary_driver.dimension} (${domains.operatingSystem.primary_driver.score})`);
    console.log(`  Operating: ${domains.operatingSystem.primary_driver.operating_manifestation}`);
    console.log(`  Pressure: ${domains.operatingSystem.primary_driver.pressure_manifestation}`);
    console.log(`Secondary: ${domains.operatingSystem.secondary_stabilizer.dimension} (${domains.operatingSystem.secondary_stabilizer.score})`);
    console.log(`Tradeoff: ${domains.operatingSystem.core_tradeoff.tradeoff}`);
    console.log(`Cost: ${domains.operatingSystem.core_tradeoff.cost}`);
    console.log('');

    // Domain 2: World Experience
    console.log('[2. How You Experience The World]');
    console.log(`Confidence: ${domains.worldExperience.confidence}`);
    console.log(`Summary: ${domains.worldExperience.summary}`);
    console.log(`Perception: ${domains.worldExperience.perception_filter.interpretation}`);
    console.log(`Processing: ${domains.worldExperience.information_processing.interpretation}`);
    console.log(`Decision: ${domains.worldExperience.decision_formation.interpretation}`);
    console.log(`Time Horizon: ${domains.worldExperience.time_horizon.interpretation}`);
    console.log(`Risk: ${domains.worldExperience.risk_calibration.interpretation}`);
    console.log('');

    // Domain 3: Others Experience
    console.log('[3. How Others Experience You]');
    console.log(`Confidence: ${domains.othersExperience.confidence}`);
    console.log(`Summary: ${domains.othersExperience.summary}`);
    console.log(`First Impression: ${domains.othersExperience.first_impression.interpretation}`);
    console.log(`Communication: ${domains.othersExperience.communication_pattern.interpretation}`);
    console.log(`Listening: ${domains.othersExperience.listening_pattern.interpretation}`);
    if (domains.othersExperience.relational_friction) {
      console.log(`Relational Friction: ${domains.othersExperience.relational_friction.interpretation}`);
    }
    console.log('');

    // Domain 5: Pressure Mechanics
    console.log('[5. Pressure Mechanics]');
    console.log(`Confidence: ${domains.pressureMechanics.confidence}`);
    console.log(`Summary: ${domains.pressureMechanics.summary}`);
    console.log(`Primary Under Load: ${domains.pressureMechanics.primary_under_load.interpretation}`);
    console.log(`Secondary Override: ${domains.pressureMechanics.secondary_override.interpretation}`);
    console.log(`Stress Patterns Available: ${domains.pressureMechanics.stress_patterns_available}`);
    console.log('');

    // Domain 6: Contradictions
    console.log('[6. Hidden Contradictions]');
    console.log(`Confidence: ${domains.contradictions.confidence}`);
    console.log(`Summary: ${domains.contradictions.summary}`);
    console.log(`Count: ${domains.contradictions.contradiction_count}`);
    if (domains.contradictions.contradictions.length > 0) {
      domains.contradictions.contradictions.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.interpretation}`);
        console.log(`     Cost: ${c.cost}`);
        console.log(`     Severity: ${c.severity}`);
      });
    }
    if (domains.contradictions.organizational_cost) {
      console.log(`Organizational Cost: ${domains.contradictions.organizational_cost}`);
    }
    console.log('');

    // Quality assessment
    console.log('═'.repeat(80));
    console.log('EXTRACTION QUALITY ASSESSMENT');
    console.log('═'.repeat(80));
    console.log('');

    console.log('[STRONGEST SECTIONS - "Holy Shit" Quality]');
    const strongSections = [];
    
    // Check Operating System depth
    if (domains.operatingSystem.primary_driver.operating_manifestation && 
        domains.operatingSystem.primary_driver.pressure_manifestation &&
        domains.operatingSystem.core_tradeoff.cost) {
      strongSections.push('Operating System: Full primary+secondary+tradeoff with pressure mechanics');
    }

    // Check World Experience specificity
    if (domains.worldExperience.perception_filter.score > 0 &&
        domains.worldExperience.time_horizon.score > 0) {
      strongSections.push('World Experience: Specific perceptual filters and time horizon mapping');
    }

    // Check Pressure Mechanics
    if (domains.pressureMechanics.primary_under_load.pressure_state &&
        domains.pressureMechanics.secondary_override.override_pattern) {
      strongSections.push('Pressure Mechanics: Dual-system pressure response mapped');
    }

    strongSections.forEach(s => console.log(`  ✓ ${s}`));
    console.log('');

    console.log('[WEAK/GENERIC SECTIONS - Needs More]');
    const weakSections = [];

    // Check for generic fallback text
    if (domains.othersExperience.trust_building_speed.composite < 1) {
      weakSections.push('Others Experience: Trust speed composite too low (missing data)');
    }

    // Check contradictions
    if (domains.contradictions.contradiction_count === 0) {
      weakSections.push('Contradictions: No contradictions identified (likely incomplete dossier)');
    }

    // Check pressure patterns
    if (!domains.pressureMechanics.stress_patterns_available) {
      weakSections.push('Pressure Mechanics: Stress patterns not populated (Phase 2 needed)');
    }

    weakSections.forEach(s => console.log(`  ⚠ ${s}`));
    console.log('');

    console.log('[MISSING INFERENCE OPPORTUNITIES]');
    const missing = [];

    // Check for Q25 evidence (misunderstanding pattern)
    if (!canonical.life_direction || !canonical.life_direction.misunderstanding_evidence) {
      missing.push('Q25 Misunderstanding Pattern: No written response evidence available');
    }

    // Check for delegation evidence
    if (!canonical.evidence_map || !canonical.evidence_map.delegation_resistance) {
      missing.push('Delegation Readiness: No evidence map for Q24→Q26→Q28 chain');
    }

    // Check for scaling constraint
    if (!canonical.business_operating_reality || !canonical.systems_accountability) {
      missing.push('Scaling Constraint: Q26+Q28 business/systems analysis not in dossier');
    }

    // Check for execution identity
    if (!canonical.execution_identity) {
      missing.push('Execution Identity: Speed/quality/risk preferences not extracted');
    }

    missing.forEach(m => console.log(`  → ${m}`));
    console.log('');

    console.log('[DOSSIER FIELDS NOT YET UTILIZED]');
    const unused = [];

    // Check what's in canonical but not extracted
    const usedFields = new Set([
      'top_systems', 'vector_scores', 'contradictions', 'stress_patterns',
      'profile_id', 'metadata'
    ]);

    Object.keys(canonical).forEach(field => {
      if (!usedFields.has(field) && canonical[field] !== null) {
        const value = canonical[field];
        const hasContent = Array.isArray(value) ? value.length > 0 
          : typeof value === 'object' ? Object.keys(value).length > 0
          : !!value;
        
        if (hasContent) {
          unused.push(field);
        }
      }
    });

    unused.forEach(field => {
      const value = canonical[field];
      const type = Array.isArray(value) ? `array[${value.length}]` 
        : typeof value === 'object' ? `object{${Object.keys(value).length}}`
        : typeof value;
      console.log(`  • ${field}: ${type}`);
    });

    console.log('');
    console.log('═'.repeat(80));
    console.log('TEST COMPLETE');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runRealExtractionTest();
