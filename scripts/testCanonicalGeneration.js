#!/usr/bin/env node

/**
 * testCanonicalGeneration.js
 * 
 * Isolated test script to generate canonical profile from test assessment
 * 
 * Purpose:
 * - Run canonical engine without touching production pipeline
 * - Generate first real canonical dossier for quality inspection
 * - Validate output against CANONICAL_PROMPT_DOCTRINE
 * 
 * Usage:
 *   node scripts/testCanonicalGeneration.js
 * 
 * Output:
 *   INSPECTION_CANONICAL_DOSSIER_REAL.json
 *   INSPECTION_CANONICAL_DOSSIER_REAL.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('[TEST] Starting isolated canonical generation test...\n');

// Step 1: Load test payload
console.log('[STEP 1] Loading test assessment payload...');
const testPayloadPath = path.join(rootDir, 'test-data', 'canonical-test-answers.json');
const testPayload = JSON.parse(fs.readFileSync(testPayloadPath, 'utf8'));
console.log(`[STEP 1] ✓ Loaded ${testPayloadPath}`);
console.log(`[STEP 1]   Assessment ID: ${testPayload.assessment_id}`);
console.log(`[STEP 1]   Answer count: ${Object.keys(testPayload.answers).length}\n`);

// Step 2: Import canonical engine modules
console.log('[STEP 2] Importing canonical engine modules...');
const buildProfileInputModule = await import('../api/engine/buildProfileInput.js');
const canonicalGeneratorModule = await import('../api/engine/canonical/canonicalProfileGenerator.js');

const { BuildProfileInput } = buildProfileInputModule;
const { generateCanonicalProfile } = canonicalGeneratorModule;
console.log('[STEP 2] ✓ Modules imported\n');

// Step 3: Build profile input
console.log('[STEP 3] Building profile input...');
const builder = new BuildProfileInput();
const profileInput = builder.build(testPayload);
console.log('[STEP 3] ✓ Profile input built');
console.log(`[STEP 3]   Dimensions: ${Object.keys(profileInput.dimension_scores || {}).length}`);
console.log(`[STEP 3]   Written responses: ${Object.keys(profileInput.written_responses || {}).length}`);
console.log(`[STEP 3]   Contradictions detected: ${(profileInput.contradictions || []).length}\n`);

// Step 4: Generate canonical profile
console.log('[STEP 4] Generating canonical profile...');
const startTime = Date.now();

try {
  const canonicalProfile = await generateCanonicalProfile(profileInput, {
    profile_id: `MM-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-test01`,
    model: 'canonical-v1-test'
  });
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[STEP 4] ✓ Canonical profile generated (${duration}s)`);
  console.log(`[STEP 4]   Profile ID: ${canonicalProfile.profile_id}`);
  console.log(`[STEP 4]   Contradictions: ${(canonicalProfile.contradictions || []).length}`);
  console.log(`[STEP 4]   Development targets: ${(canonicalProfile.development_targets || []).length}\n`);
  
  // Step 5: Write JSON output
  console.log('[STEP 5] Writing output files...');
  const jsonOutputPath = path.join(rootDir, 'INSPECTION_CANONICAL_DOSSIER_REAL.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(canonicalProfile, null, 2), 'utf8');
  console.log(`[STEP 5] ✓ JSON written: ${jsonOutputPath}`);
  
  // Step 6: Generate markdown report
  const markdown = generateMarkdownReport(canonicalProfile);
  const mdOutputPath = path.join(rootDir, 'INSPECTION_CANONICAL_DOSSIER_REAL.md');
  fs.writeFileSync(mdOutputPath, markdown, 'utf8');
  console.log(`[STEP 5] ✓ Markdown written: ${mdOutputPath}\n`);
  
  // Step 7: Summary
  console.log('[COMPLETE] Canonical generation test successful');
  console.log(`\nInspect output:`);
  console.log(`  cat ${jsonOutputPath}`);
  console.log(`  cat ${mdOutputPath}`);
  
} catch (error) {
  console.error('[ERROR] Canonical generation failed:');
  console.error(error);
  process.exit(1);
}

/**
 * Generate markdown inspection report
 */
function generateMarkdownReport(canonical) {
  const sections = [];
  
  // Header
  sections.push('# INSPECTION: CANONICAL DOSSIER (REAL GENERATION)');
  sections.push('');
  sections.push(`**Generated:** ${new Date().toISOString()}`);
  sections.push(`**Profile ID:** ${canonical.profile_id}`);
  sections.push(`**Model:** ${canonical.metadata?.model || 'unknown'}`);
  sections.push(`**Assessment Version:** ${canonical.metadata?.assessment_version || 'unknown'}`);
  sections.push('');
  sections.push('---');
  sections.push('');
  
  // Metadata
  sections.push('## METADATA');
  sections.push('');
  sections.push('```json');
  sections.push(JSON.stringify(canonical.metadata, null, 2));
  sections.push('```');
  sections.push('');
  
  // Vector Scores
  sections.push('## VECTOR SCORES');
  sections.push('');
  if (canonical.vector_scores) {
    sections.push('| Dimension | Score |');
    sections.push('|-----------|-------|');
    Object.entries(canonical.vector_scores).forEach(([dim, score]) => {
      sections.push(`| ${dim} | ${score.toFixed(2)} |`);
    });
  }
  sections.push('');
  
  // Ranked Dimensions
  sections.push('## RANKED DIMENSIONS');
  sections.push('');
  if (canonical.ranked_dimensions) {
    canonical.ranked_dimensions.forEach((dim, idx) => {
      sections.push(`${idx + 1}. **${dim.dimension}** (${dim.score.toFixed(2)}) — ${dim.label}`);
    });
  }
  sections.push('');
  
  // Top Systems
  sections.push('## TOP SYSTEMS');
  sections.push('');
  if (canonical.top_systems) {
    sections.push(`**Primary Driver:** ${canonical.top_systems.primary?.dimension || 'N/A'} (${canonical.top_systems.primary?.score?.toFixed(2) || 'N/A'})`);
    sections.push(`**Secondary Stabilizer:** ${canonical.top_systems.secondary?.dimension || 'N/A'} (${canonical.top_systems.secondary?.score?.toFixed(2) || 'N/A'})`);
    sections.push('');
    if (canonical.top_systems.opposing_patterns?.length > 0) {
      sections.push('**Opposing Patterns:**');
      canonical.top_systems.opposing_patterns.forEach(p => {
        sections.push(`- ${p.dimension} (${p.score.toFixed(2)})`);
      });
    }
  }
  sections.push('');
  
  // Life Direction Analysis
  if (canonical.life_direction) {
    sections.push('## LIFE DIRECTION ANALYSIS');
    sections.push('');
    sections.push(`**Stated Priorities:** ${canonical.life_direction.stated_priorities?.join(', ') || 'N/A'}`);
    sections.push(`**Future Orientation:** ${canonical.life_direction.future_orientation || 'N/A'}`);
    sections.push(`**Meaning Clarity:** ${canonical.life_direction.meaning_clarity || 'N/A'}`);
    sections.push(`**Identity Focus:** ${canonical.life_direction.identity_focus || 'N/A'}`);
    sections.push('');
    if (canonical.life_direction.inference) {
      sections.push('**Inference:**');
      sections.push(canonical.life_direction.inference);
      sections.push('');
    }
  }
  
  // Business Operating Reality
  if (canonical.business_operating_reality) {
    sections.push('## BUSINESS OPERATING REALITY');
    sections.push('');
    sections.push(`**Role:** ${canonical.business_operating_reality.role || 'N/A'}`);
    sections.push(`**Scale:** ${canonical.business_operating_reality.scale || 'N/A'}`);
    sections.push(`**Numerical Grounding:** ${canonical.business_operating_reality.numerical_grounding || 'N/A'}`);
    sections.push(`**Self-Awareness:** ${canonical.business_operating_reality.self_awareness || 'N/A'}`);
    sections.push('');
    if (canonical.business_operating_reality.gaps?.length > 0) {
      sections.push('**Identified Gaps:**');
      canonical.business_operating_reality.gaps.forEach(gap => sections.push(`- ${gap}`));
      sections.push('');
    }
  }
  
  // Growth Tension
  if (canonical.growth_tension) {
    sections.push('## GROWTH TENSION');
    sections.push('');
    sections.push(`**Scaling Reaction:** ${canonical.growth_tension.scaling_reaction || 'N/A'}`);
    sections.push(`**Execution Confidence:** ${canonical.growth_tension.execution_confidence || 'N/A'}`);
    sections.push(`**Adaptive Ceiling:** ${canonical.growth_tension.adaptive_ceiling || 'N/A'}`);
    sections.push('');
  }
  
  // Systems & Accountability
  if (canonical.systems_accountability) {
    sections.push('## SYSTEMS & ACCOUNTABILITY');
    sections.push('');
    sections.push(`**Systems Quality:** ${canonical.systems_accountability.systems_quality || 'N/A'}`);
    sections.push(`**Accountability Mechanism:** ${canonical.systems_accountability.accountability_mechanism || 'N/A'}`);
    sections.push(`**Coachability:** ${canonical.systems_accountability.coachability || 'N/A'}`);
    sections.push(`**Meta-Cognitive Awareness:** ${canonical.systems_accountability.meta_cognitive_awareness || 'N/A'}`);
    sections.push('');
  }
  
  // Inferred Patterns
  sections.push('## INFERRED BEHAVIORAL PATTERNS');
  sections.push('');
  if (canonical.inferred_patterns) {
    Object.entries(canonical.inferred_patterns).forEach(([key, value]) => {
      sections.push(`**${key}:** ${value}`);
    });
  }
  sections.push('');
  
  // Contradictions
  sections.push('## CONTRADICTIONS');
  sections.push('');
  if (canonical.contradictions?.length > 0) {
    canonical.contradictions.forEach((c, idx) => {
      sections.push(`### ${idx + 1}. ${c.type || 'Contradiction'}`);
      sections.push(`**Tension:** ${c.tension}`);
      sections.push(`**Dimensions in Conflict:** ${c.dimensions_in_conflict?.join(' vs ') || 'N/A'}`);
      sections.push(`**Resolution Path:** ${c.resolution_path}`);
      sections.push(`**Severity:** ${c.severity}`);
      sections.push('');
    });
  } else {
    sections.push('No contradictions detected.');
    sections.push('');
  }
  
  // Stress Patterns
  sections.push('## STRESS PATTERNS');
  sections.push('');
  if (canonical.stress_patterns) {
    sections.push(`**Amplified Dimension:** ${canonical.stress_patterns.amplified_dimension || 'N/A'}`);
    sections.push(`**Lost Dimensions:** ${canonical.stress_patterns.lost_dimensions?.join(', ') || 'N/A'}`);
    sections.push(`**Stress Response:** ${canonical.stress_patterns.stress_response || 'N/A'}`);
  }
  sections.push('');
  
  // Communication Style
  sections.push('## COMMUNICATION STYLE');
  sections.push('');
  if (canonical.communication_style) {
    sections.push(`**Structure:** ${canonical.communication_style.structure || 'N/A'}`);
    sections.push(`**Directness:** ${canonical.communication_style.directness || 'N/A'}`);
    sections.push(`**Adaptive Cost:** ${canonical.communication_style.adaptive_cost || 'N/A'}`);
  }
  sections.push('');
  
  // Leadership Architecture
  sections.push('## LEADERSHIP ARCHITECTURE');
  sections.push('');
  if (canonical.leadership_architecture) {
    sections.push(`**Mode:** ${canonical.leadership_architecture.mode || 'N/A'}`);
    sections.push(`**Decision Style:** ${canonical.leadership_architecture.decision_style || 'N/A'}`);
    sections.push(`**Accountability Enforcement:** ${canonical.leadership_architecture.accountability_enforcement || 'N/A'}`);
  }
  sections.push('');
  
  // Narrative Profile
  sections.push('## NARRATIVE PROFILE');
  sections.push('');
  if (canonical.narrative_profile) {
    Object.entries(canonical.narrative_profile).forEach(([section, content]) => {
      sections.push(`### ${section}`);
      sections.push(content);
      sections.push('');
    });
  }
  
  // Development Targets
  sections.push('## DEVELOPMENT TARGETS');
  sections.push('');
  if (canonical.development_targets?.length > 0) {
    canonical.development_targets.forEach((target, idx) => {
      sections.push(`${idx + 1}. **${target.dimension}** (Priority ${target.priority}, Severity: ${target.severity})`);
      sections.push(`   - Rationale: ${target.rationale}`);
      sections.push(`   - Approach: ${target.approach}`);
      sections.push('');
    });
  }
  
  // Environment Fit
  sections.push('## ENVIRONMENT FIT');
  sections.push('');
  if (canonical.environment_fit) {
    sections.push(`**Optimal Environment:** ${canonical.environment_fit.optimal || 'N/A'}`);
    sections.push(`**Friction Environment:** ${canonical.environment_fit.friction || 'N/A'}`);
  }
  sections.push('');
  
  // Quality Review Placeholder
  sections.push('---');
  sections.push('');
  sections.push('## CANONICAL QUALITY REVIEW');
  sections.push('');
  sections.push('*(To be completed after manual inspection against CANONICAL_PROMPT_DOCTRINE)*');
  sections.push('');
  sections.push('**Strengths:**');
  sections.push('- [To be assessed]');
  sections.push('');
  sections.push('**Weak Sections:**');
  sections.push('- [To be assessed]');
  sections.push('');
  sections.push('**Generic Sections:**');
  sections.push('- [To be assessed]');
  sections.push('');
  sections.push('**Missing Inference Depth:**');
  sections.push('- [To be assessed]');
  sections.push('');
  sections.push('**Eerily Accurate Threshold:** [YES/NO] — [Reasoning]');
  sections.push('');
  
  return sections.join('\n');
}
