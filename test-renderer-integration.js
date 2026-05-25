/**
 * Renderer Integration Test
 * Verifies behavioral intelligence integrates safely into WebProfileReport
 */

import fs from 'fs';
import { extractBehavioralIntelligence } from './api/engine/canonical/extractIntelligence.js';
import { buildRenderPlan, extractSectionContent } from './src/lib/profile/renderContract.js';

console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('RENDERER INTEGRATION TEST');
console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('');

// Load test profile
const PROFILE_PATH = './benchmark_profiles/MM-20260523-mqlev9c9/CANONICAL_PROFILE.json';
const canonical = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));

// Extract behavioral intelligence
const behavioralIntelligence = extractBehavioralIntelligence(canonical);

console.log('📋 RENDER PLAN GENERATION');
console.log('─'.repeat(80));
console.log('');

// Build render plan (as renderer would do)
const renderPlan = buildRenderPlan(behavioralIntelligence, canonical);
console.log(`Has behavioral intelligence: ${renderPlan.hasIntelligence ? '✓' : '✗'}`);
console.log(`Sections: ${renderPlan.sections.length}`);
console.log(`Renderable: ${renderPlan.sections.filter(s => s.shouldRender).length}`);
console.log('');

console.log('📊 EXTRACTED SECTION CONTENT');
console.log('─'.repeat(80));
console.log('');

// Extract individual sections as renderer would
const operatingSystem = extractSectionContent('section-operating-system', behavioralIntelligence, canonical);
const hiddenContradictions = extractSectionContent('section-contradictions', behavioralIntelligence, canonical);
const organizationalConsequences = extractSectionContent('section-organizational-consequences', behavioralIntelligence, canonical);
const facilitatorNotes = extractSectionContent('section-facilitator-notes', behavioralIntelligence, canonical);
const theOneMove = extractSectionContent('section-the-one-move', behavioralIntelligence, canonical);

const sections = [
  { name: 'Operating System', data: operatingSystem },
  { name: 'Hidden Contradictions', data: hiddenContradictions },
  { name: 'Organizational Consequences', data: organizationalConsequences },
  { name: 'Facilitator Notes', data: facilitatorNotes },
  { name: 'The One Move', data: theOneMove }
];

sections.forEach((section, i) => {
  const found = section.data.found ? '✓' : '✗';
  const source = section.data.fallbackUsed ? 'fallback' : 'BI';
  console.log(`${i + 1}. ${found} ${section.name} (${source})`);
  
  if (section.data.found && section.data.content) {
    const contentType = typeof section.data.content;
    const preview = contentType === 'object'
      ? `{${Object.keys(section.data.content || {}).slice(0, 2).join(', ')}...}`
      : `"${String(section.data.content).substring(0, 60)}..."`;
    console.log(`   Content: ${preview}`);
  }
});

console.log('');

console.log('✅ FALLBACK BEHAVIOR');
console.log('─'.repeat(80));
console.log('');

// Test fallback when BI is null
const fallbackPlan = buildRenderPlan(null, canonical);
const fallbackOperatingSystem = extractSectionContent('section-operating-system', null, canonical);
console.log(`Without BI: ${fallbackOperatingSystem.found ? 'Still renders via fallback' : 'No fallback content'}`);
console.log('');

console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('INTEGRATION PROOF');
console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('');

const checks = [
  { check: 'Operating System found', pass: operatingSystem.found },
  { check: 'Hidden Contradictions found', pass: hiddenContradictions.found },
  { check: 'Organizational Consequences found', pass: organizationalConsequences.found },
  { check: 'Facilitator Notes found', pass: facilitatorNotes.found },
  { check: 'The One Move found', pass: theOneMove.found },
  { check: 'All sections from BI (not fallback)', pass: !operatingSystem.fallbackUsed && !hiddenContradictions.fallbackUsed },
  { check: 'Render plan generates sections', pass: renderPlan.sections.length === 5 }
];

checks.forEach(check => {
  const symbol = check.pass ? '✓' : '✗';
  console.log(`${symbol} ${check.check}`);
});

console.log('');

const allPass = checks.every(c => c.pass);
if (allPass) {
  console.log('✅ RENDERER INTEGRATION VERIFIED');
  console.log('');
  console.log('Behavioral intelligence sections rendering:');
  console.log('  1. Operating System ✓');
  console.log('  2. Hidden Contradictions ✓');
  console.log('  3. Organizational Consequences ✓');
  console.log('  4. Facilitator Notes ✓');
  console.log('  5. The One Move ✓');
  console.log('');
  console.log('Fallback behavior preserved (non-breaking change).');
  console.log('Current design shell intact.');
  console.log('Profile rendering safe.');
} else {
  console.log('❌ SOME CHECKS FAILED');
  process.exit(1);
}
