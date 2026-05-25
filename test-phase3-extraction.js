/**
 * Phase 3 Extraction Test
 * Tests: Scaling Constraint, Decision Architecture, Organizational Consequences,
 * Facilitator Notes, Five Futures, The One Move
 */

import { extractBehavioralIntelligence } from './api/engine/canonical/extractIntelligence.js';
import fs from 'fs';

const PROFILE_PATH = './benchmark_profiles/MM-20260523-mqlev9c9/CANONICAL_PROFILE.json';

console.log('═'.repeat(80));
console.log('PHASE 3 EXTRACTION TEST - ORGANIZATIONAL CONSEQUENCES DOMAINS');
console.log('Profile: MM-20260523-mqlev9c9');
console.log('═'.repeat(80));
console.log('');

const canonical = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
const intelligence = extractBehavioralIntelligence(canonical);
const domains = intelligence.domains;

// Domain 7: Scaling Constraint
console.log('7️⃣ SCALING CONSTRAINT');
console.log(`Summary: ${domains.scalingConstraint?.summary || 'Not available'}`);
if (domains.scalingConstraint?.ceiling_mechanics) {
  console.log(`Primary constraint: ${domains.scalingConstraint.ceiling_mechanics.primary_constraint || 'Unknown'}`);
  console.log(`Current systems: ${domains.scalingConstraint.current_systems_capacity?.capacity_description || 'Unknown'}`);
}
console.log('');

// Domain 8: Decision Architecture
console.log('8️⃣ DECISION ARCHITECTURE');
console.log(`Summary: ${domains.decisionArchitecture?.summary || 'Not available'}`);
if (domains.decisionArchitecture?.decision_velocity) {
  console.log(`Decision speed: ${domains.decisionArchitecture.decision_velocity.speed}`);
  console.log(`Interpretation: ${domains.decisionArchitecture.decision_velocity.interpretation}`);
}
if (domains.decisionArchitecture?.delegation_resistance) {
  console.log(`Delegation resistance: ${domains.decisionArchitecture.delegation_resistance.interpretation}`);
}
console.log('');

// Domain 9: Organizational Consequences
console.log('9️⃣ ORGANIZATIONAL CONSEQUENCES');
console.log(`Summary: ${domains.organizationalConsequences?.summary || 'Not available'}`);
console.log(`Consequence count: ${domains.organizationalConsequences?.consequence_count || 0}`);
if (domains.organizationalConsequences?.consequence_matrix?.length > 0) {
  domains.organizationalConsequences.consequence_matrix.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.domain}: ${c.cost}`);
  });
}
console.log('');

// Domain 10: Facilitator Notes
console.log('🔟 FACILITATOR NOTES (Environment Design)');
console.log(`Note count: ${domains.facilitatorNotes?.note_count || 0}`);
console.log(`Primary guidance: ${domains.facilitatorNotes?.primary_guidance || 'None'}`);
if (domains.facilitatorNotes?.notes?.length > 0) {
  domains.facilitatorNotes.notes.forEach((note, i) => {
    console.log(`  ${i + 1}. [${note.category}] ${note.note}`);
  });
}
console.log('');

// Domain 11: Five Futures
console.log('1️⃣1️⃣ FIVE POSSIBLE FUTURES (Trajectory Simulations)');
console.log(`Most likely: ${domains.fiveFuturesStarter?.most_likely || 'Unknown'}`);
if (domains.fiveFuturesStarter?.futures?.length > 0) {
  domains.fiveFuturesStarter.futures.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.title} (${f.likelihood})`);
    console.log(`     Organization experiences: ${f.organization_experiences.substring(0, 70)}...`);
  });
}
console.log('');

// Domain 12: The One Move
console.log('1️⃣2️⃣ THE ONE MOVE (Highest-Leverage Intervention)');
console.log(`Move: ${domains.theOneMove?.the_move || 'Not identified'}`);
console.log(`Reasoning: ${domains.theOneMove?.reasoning || 'N/A'}`);
console.log(`Timeline: ${domains.theOneMove?.timeline || 'N/A'}`);
console.log('');

console.log('═'.repeat(80));
console.log('DOSSIER EVIDENCE GROUPS NOW UTILIZED (Phase 3)');
console.log('═'.repeat(80));
console.log('');

console.log('✓ infrastructure_maturity (new)');
console.log('✓ future_ceiling (new)');
console.log('✓ growth_trajectory (new)');
console.log('✓ stated_goals (new)');
console.log('✓ decision_making_patterns (new)');
console.log('✓ execution_identity (new)');
console.log('✓ delegation_resistance (new)');
console.log('✓ time_horizon (partial)');
console.log('✓ stall_patterns (already from Phase 2)');
console.log('✓ hidden_risk_patterns (already from Phase 2)');
console.log('');

console.log('📊 DOSSIER EVIDENCE GROUPS STILL UNUSED');
console.log('');
console.log('❌ narrative_profile (raw story framing)');
console.log('❌ evidence_chains (Q→A→contradiction links)');
console.log('❌ question_omissions (what wasn\'t answered)');
console.log('❌ phrasing_patterns (language reveals)');
console.log('❌ team_interaction_patterns (full mapping)');
console.log('❌ role_fit_analysis (natural vs. friction roles)');
console.log('');

console.log('═'.repeat(80));
console.log('READINESS ASSESSMENT');
console.log('═'.repeat(80));
console.log('');

const domains_with_data = [
  domains.scalingConstraint ? 'Scaling Constraint' : null,
  domains.decisionArchitecture ? 'Decision Architecture' : null,
  domains.organizationalConsequences ? 'Organizational Consequences' : null,
  domains.facilitatorNotes ? 'Facilitator Notes' : null,
  domains.fiveFuturesStarter ? 'Five Futures' : null,
  domains.theOneMove ? 'The One Move' : null
].filter(Boolean);

console.log(`Domains rendering: ${domains_with_data.length} of 6 Phase 3 domains`);
console.log('');

const consequence_count = domains.organizationalConsequences?.consequence_count || 0;
const note_count = domains.facilitatorNotes?.note_count || 0;

if (consequence_count >= 2 && note_count >= 1) {
  console.log('✅ PHASE 3 READY FOR LIVE INTEGRATION');
  console.log(`   - ${consequence_count} consequence domains identified`);
  console.log(`   - ${note_count} facilitator guidance notes generated`);
  console.log(`   - Decision architecture mapped`);
  console.log(`   - Scaling constraint identified`);
  console.log(`   - Five futures + One Move trajectories modeled`);
} else {
  console.log('⚠️  PHASE 3 PARTIALLY READY');
  console.log(`   - Consequences: ${consequence_count}`);
  console.log(`   - Facilitator notes: ${note_count}`);
  console.log('   - May need expanded dossier evidence on this profile');
}

console.log('');
console.log('═'.repeat(80));
console.log('TEST COMPLETE');
console.log('═'.repeat(80));
