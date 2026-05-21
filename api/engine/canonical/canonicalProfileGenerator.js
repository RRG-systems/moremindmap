/**
 * canonicalProfileGenerator.js
 * 
 * Master orchestrator for canonical behavioral profile generation.
 * 
 * This is the CORE ENGINE that transforms assessment data into
 * authoritative behavioral intelligence.
 * 
 * Flow:
 * 1. Normalize assessment input
 * 2. Infer vector scores
 * 3. Infer behavioral patterns
 * 4. Infer contradictions
 * 5. Infer stress patterns
 * 6. Infer communication style
 * 7. Infer leadership architecture
 * 8. Build narrative profile
 * 9. Assemble canonical artifact
 * 
 * Output: Complete canonical profile (source of truth)
 * 
 * Canonical profiles are NOT PDFs.
 * They are behavioral intelligence artifacts.
 * PDFs are RENDERED FROM canonical profiles.
 */

import { inferVectorScores } from './inferVectorScores.js';
import { inferBehavioralPatterns } from './inferBehavioralPatterns.js';
import { inferContradictions } from './inferContradictions.js';
import { inferStressPatterns } from './inferStressPatterns.js';
import { inferCommunicationStyle } from './inferCommunicationStyle.js';
import { inferLeadershipArchitecture } from './inferLeadershipArchitecture.js';
import { buildNarrativeProfile } from './buildNarrativeProfile.js';
import { analyzeLongFormAnswers } from './analyzeLongFormAnswers.js';
import { synthesizeCrossQuestionPatterns } from './synthesizeCrossQuestionPatterns.js';

/**
 * Generate canonical behavioral profile
 * 
 * @param {Object} profileInput - Output from buildProfileInput
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} canonicalProfile
 */
export async function generateCanonicalProfile(profileInput, options = {}) {
  const profile_id = options.profile_id || generateProfileId();
  
  // STEP 1: Extract metadata
  const metadata = {
    assessment_version: 'mini-v2',
    generated_at: new Date().toISOString(),
    model: options.model || 'canonical-v1',
    person_name: profileInput.person_name || null,
    email: profileInput.email || null
  };
  
  // STEP 2: Infer vector scores and rankings
  const { vector_scores, ranked_dimensions, top_systems } = inferVectorScores(profileInput);
  
  // STEP 2.5: Analyze long-form answers (NEW - Step 2D)
  const analyzed_responses = analyzeLongFormAnswers(profileInput);
  
  // STEP 3: Infer behavioral patterns (CORE INTELLIGENCE)
  const inferred_patterns = inferBehavioralPatterns(vector_scores, ranked_dimensions, profileInput);
  
  // STEP 4: Infer contradictions (dimension-based)
  const dimension_contradictions = inferContradictions(vector_scores, ranked_dimensions, profileInput);
  
  // STEP 4.5: Synthesize cross-question tensions (NEW - Step 2D)
  const cross_question_tensions = synthesizeCrossQuestionPatterns(analyzed_responses, vector_scores);
  
  // Merge all contradictions
  const contradictions = [...dimension_contradictions, ...cross_question_tensions];
  
  // STEP 5: Infer stress patterns
  const stress_patterns = inferStressPatterns(vector_scores, ranked_dimensions);
  
  // STEP 6: Infer communication style
  const communication_style = inferCommunicationStyle(vector_scores, ranked_dimensions);
  
  // STEP 7: Infer leadership architecture
  const leadership_architecture = inferLeadershipArchitecture(vector_scores, ranked_dimensions);
  
  // STEP 8: Determine development targets from contradictions
  const development_targets = (contradictions && contradictions.length > 0)
    ? contradictions.map((contradiction, index) => ({
        dimension: (contradiction.dimensions_in_conflict && contradiction.dimensions_in_conflict[1]) || 'unknown',
        rationale: contradiction.tension || 'Unknown tension',
        approach: contradiction.resolution_path || 'Develop awareness',
        priority: index + 1,
        severity: contradiction.severity || 'moderate'
      }))
    : [];
  
  // STEP 9: Infer environment fit
  const environment_fit = inferEnvironmentFit(vector_scores, ranked_dimensions);
  
  // STEP 10: Build narrative profile (with Step 2D analyzed responses)
  const narrative_profile = buildNarrativeProfile(
    inferred_patterns,
    contradictions,
    stress_patterns,
    communication_style,
    leadership_architecture,
    analyzed_responses
  );
  
  // STEP 11: Assemble canonical artifact
  const canonicalProfile = {
    profile_id,
    metadata,
    vector_scores,
    ranked_dimensions,
    top_systems,
    
    // Step 2D additions: expanded intake analysis
    life_direction: analyzed_responses.life_direction,
    business_operating_reality: analyzed_responses.business_reality,
    growth_tension: analyzed_responses.growth_tension,
    systems_accountability: analyzed_responses.systems_accountability,
    stall_patterns: analyzed_responses.stall_patterns,
    
    inferred_patterns,
    contradictions, // now includes cross-question tensions
    stress_patterns,
    communication_style,
    leadership_architecture,
    development_targets,
    environment_fit,
    narrative_profile
  };
  
  return canonicalProfile;
}

/**
 * Infer environment fit from dimension profile
 */
function inferEnvironmentFit(vectorScores, rankedDimensions) {
  const primary = rankedDimensions[0]?.dimension || 'vector';
  const opposing1 = rankedDimensions[6]?.dimension || 'flex';
  
  const thrives_in = [];
  const struggles_in = [];
  const requires = [];
  
  const DIMENSION_LABELS = {
    vector: 'command',
    signal: 'relational awareness',
    fidelity: 'precision',
    velocity: 'tempo',
    leverage: 'influence',
    flex: 'adaptability',
    framework: 'structure',
    horizon: 'perspective'
  };
  
  // High vector thrives in fast-execution cultures
  if (vectorScores.vector > 6.5) {
    thrives_in.push("Fast-moving organizations that reward decisive action");
    struggles_in.push("Consensus-heavy cultures that require extensive alignment before moving");
    requires.push("Autonomy to establish direction without constant approval");
  }
  
  // High framework thrives in structured environments
  if (vectorScores.framework > 6.5) {
    thrives_in.push("Process-driven organizations with clear structure");
    struggles_in.push("High-chaos environments that require constant pivoting");
    requires.push("Defined processes and clear role expectations");
  }
  
  // High signal thrives in relational cultures
  if (vectorScores.signal > 6.5) {
    thrives_in.push("Cultures that value relational intelligence and team dynamics");
    struggles_in.push("Purely execution-focused environments that deprioritize relationships");
    requires.push("Permission to invest in relational calibration");
  }
  
  // High horizon thrives in strategic environments
  if (vectorScores.horizon > 6.5) {
    thrives_in.push("Organizations that reward long-term strategic thinking");
    struggles_in.push("Purely tactical environments focused only on short-term execution");
    requires.push("Space to think multi-move ahead");
  }
  
  // Add opposing dimension struggle
  struggles_in.push(`Environments that over-index on ${DIMENSION_LABELS[opposing1]} without supporting ${DIMENSION_LABELS[primary]}`);
  
  return {
    thrives_in,
    struggles_in,
    requires
  };
}

/**
 * Generate unique profile ID
 * Format: MM-YYYYMMDD-SHORTUUID
 */
function generateProfileId() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const shortId = Math.random().toString(36).substring(2, 6);
  
  return `MM-${yyyy}${mm}${dd}-${shortId}`;
}
