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
import { inferLeadershipReadiness } from './inferLeadershipReadiness.js';
import { inferRoleFit } from './inferRoleFit.js';
import { inferFutureConstraints } from './inferFutureConstraints.js';
import { inferCoachingLeverage } from './inferCoachingLeverage.js';
import { inferHiddenRisks } from './inferHiddenRisks.js';
import { inferExecutionIdentity } from './inferExecutionIdentity.js';
import { inferStrategicCeiling } from './inferStrategicCeiling.js';
import { inferScalingReadiness } from './inferScalingReadiness.js';
import { inferTeamInteraction } from './inferTeamInteraction.js';
import { inferBehavioralConsequences } from './inferBehavioralConsequences.js';
import { inferOrganizationalEffects } from './inferOrganizationalEffects.js';
import { inferHiddenCosts } from './inferHiddenCosts.js';
import { inferSelfDeceptionPatterns } from './inferSelfDeceptionPatterns.js';
import { inferFutureTrajectory } from './inferFutureTrajectory.js';
import { inferEvidenceMap } from './inferEvidenceMap.js';
import { inferCausalChains } from './inferCausalChains.js';

/**
 * Generate canonical behavioral profile
 * 
 * @param {Object} profileInput - Output from buildProfileInput
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} canonicalProfile
 */
export async function generateCanonicalProfile(profileInput, options = {}) {
  const profile_id = options.profile_id || generateProfileId();
  
  // STEP 1: Extract metadata (including organizational context)
  const metadata = {
    assessment_version: 'mini-v2',
    generated_at: new Date().toISOString(),
    model: options.model || 'canonical-v1',
    person_name: profileInput.person_name || null,
    email: profileInput.email || null,
    identity: profileInput.organizationalMetadata?.identity || null,
    organization: profileInput.organizationalMetadata?.organization || null,
    contextual_signals: profileInput.organizationalMetadata?.contextual_signals || null
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
  
  // Merge all contradictions (with defensive normalization)
  const contradictions = [
    ...(Array.isArray(dimension_contradictions) ? dimension_contradictions : []),
    ...(Array.isArray(cross_question_tensions) ? cross_question_tensions : [])
  ];
  
  // STEP 5: Infer stress patterns
  const stress_patterns = inferStressPatterns(vector_scores, ranked_dimensions);
  
  // STEP 6: Infer communication style
  const communication_style = inferCommunicationStyle(vector_scores, ranked_dimensions);
  
  // STEP 7: Infer leadership architecture
  const leadership_architecture = inferLeadershipArchitecture(vector_scores, ranked_dimensions);
  
  // STEP 8: Determine development targets from contradictions
  const development_targets = (Array.isArray(contradictions) && contradictions.length > 0)
    ? contradictions.map((contradiction, index) => ({
        dimension: (contradiction?.dimensions_in_conflict && contradiction.dimensions_in_conflict[1]) || 'unknown',
        rationale: contradiction?.tension || 'Unknown tension',
        approach: contradiction?.resolution_path || 'Develop awareness',
        priority: index + 1,
        severity: contradiction?.severity || 'moderate'
      }))
    : [];
  
  // STEP 9: Infer enhanced environment fit (with analyzed responses)
  const environment_fit = inferEnvironmentFit(vector_scores, ranked_dimensions, analyzed_responses);
  
  // STEP 10: Infer leadership readiness (STEP 2E-D)
  const leadership_readiness = inferLeadershipReadiness(
    vector_scores,
    leadership_architecture,
    communication_style,
    stress_patterns,
    analyzed_responses
  );
  
  // STEP 11: Infer role fit (STEP 2E-D)
  const role_fit_analysis = inferRoleFit(vector_scores, analyzed_responses);
  
  // STEP 12: Infer future constraints (STEP 2E-D)
  const future_growth_constraints = inferFutureConstraints(
    vector_scores,
    analyzed_responses,
    contradictions
  );
  
  // STEP 13: Infer coaching leverage (STEP 2E-D)
  const coaching_leverage_points = inferCoachingLeverage(
    vector_scores,
    contradictions,
    analyzed_responses,
    leadership_architecture
  );
  
  // STEP 14: Infer hidden risks (STEP 2E-D)
  const hidden_risk_patterns = inferHiddenRisks(
    vector_scores,
    stress_patterns,
    analyzed_responses,
    contradictions
  );
  
  // STEP 15: Infer execution identity (STEP 2E-D)
  const execution_identity = inferExecutionIdentity(
    vector_scores,
    analyzed_responses,
    contradictions
  );
  
  // STEP 16: Infer strategic ceiling (STEP 2E-D)
  const strategic_ceiling_analysis = inferStrategicCeiling(
    vector_scores,
    analyzed_responses,
    contradictions,
    future_growth_constraints
  );
  
  // STEP 17: Infer scaling readiness (STEP 2E-D)
  const scaling_readiness = inferScalingReadiness(
    vector_scores,
    analyzed_responses,
    leadership_readiness
  );
  
  // STEP 18: Infer team interaction patterns (STEP 2E-D)
  const team_interaction_patterns = inferTeamInteraction(
    vector_scores,
    analyzed_responses,
    communication_style
  );
  
  // STEP 19: Infer behavioral consequences (STEP 2E-E)
  const behavioral_consequences = inferBehavioralConsequences(
    vector_scores,
    leadership_architecture,
    stress_patterns,
    future_growth_constraints,
    hidden_risk_patterns,
    analyzed_responses,
    contradictions
  );
  
  // STEP 20: Infer organizational effects (STEP 2E-E)
  const organizational_effects = inferOrganizationalEffects(
    vector_scores,
    leadership_readiness,
    analyzed_responses,
    hidden_risk_patterns
  );
  
  // STEP 21: Infer hidden costs (STEP 2E-E)
  const hidden_costs = inferHiddenCosts(
    vector_scores,
    analyzed_responses,
    behavioral_consequences,
    organizational_effects
  );
  
  // STEP 22: Infer self-deception patterns (STEP 2E-E)
  const self_deception_patterns = inferSelfDeceptionPatterns(
    vector_scores,
    analyzed_responses,
    contradictions,
    behavioral_consequences
  );
  
  // STEP 23: Infer future trajectory (STEP 2E-E)
  const future_trajectory = inferFutureTrajectory(
    vector_scores,
    contradictions,
    future_growth_constraints,
    hidden_risk_patterns,
    scaling_readiness,
    analyzed_responses,
    behavioral_consequences
  );
  
  // STEP 24: Generate evidence map (STEP 2E-F)
  const evidence_map = inferEvidenceMap(
    vector_scores,
    analyzed_responses,
    contradictions,
    {} // all inferences available
  );
  
  // STEP 25: Generate causal chains (STEP 2E-F)
  const causal_chains = inferCausalChains(
    vector_scores,
    analyzed_responses,
    contradictions,
    future_trajectory
  );
  
  // STEP 24: Build narrative profile (with all new domains + consequences)
  const narrative_profile = buildNarrativeProfile(
    inferred_patterns,
    contradictions,
    stress_patterns,
    communication_style,
    leadership_architecture,
    analyzed_responses,
    leadership_readiness,
    future_growth_constraints,
    coaching_leverage_points,
    hidden_risk_patterns,
    strategic_ceiling_analysis,
    vector_scores,
    profileInput.organizationalMetadata || {}
  );
  
  // STEP 20: Assemble canonical artifact
  const canonicalProfile = {
    profile_id,
    metadata,
    vector_scores,
    ranked_dimensions,
    top_systems,
    
    // Step 2D: expanded intake analysis
    life_direction: analyzed_responses.life_direction,
    business_operating_reality: analyzed_responses.business_reality,
    growth_tension: analyzed_responses.growth_tension,
    systems_accountability: analyzed_responses.systems_accountability,
    stall_patterns: analyzed_responses.stall_patterns,
    
    // Core inference (original)
    inferred_patterns,
    contradictions,
    stress_patterns,
    communication_style,
    leadership_architecture,
    development_targets,
    environment_fit,
    
    // Step 2E-D: organizational intelligence domains
    leadership_readiness,
    role_fit_analysis,
    future_growth_constraints,
    coaching_leverage_points,
    hidden_risk_patterns,
    execution_identity,
    strategic_ceiling_analysis,
    scaling_readiness,
    team_interaction_patterns,
    
    // Step 2E-E: consequence modeling
    behavioral_consequences,
    organizational_effects,
    hidden_costs,
    self_deception_patterns,
    future_trajectory,
    
    // Step 2E-F: frontier intelligence
    evidence_map,
    causal_chains,
    
    // Narrative synthesis
    narrative_profile
  };
  
  return canonicalProfile;
}

/**
 * Infer environment fit from dimension profile
 */
function inferEnvironmentFit(vectorScores, rankedDimensions, analyzedResponses = {}) {
  const { stall_patterns, growth_tension } = analyzedResponses;
  
  const thrives_in = [];
  const struggles_in = [];
  const requires = [];
  
  // High vector thrives in fast-execution cultures
  if (vectorScores.vector > 6.5) {
    thrives_in.push("Fast-moving organizations with clear decision authority");
    thrives_in.push("Entrepreneurial/startup environments that reward speed");
    struggles_in.push("Consensus-heavy cultures requiring extensive buy-in");
    struggles_in.push("Matrix organizations with diffuse authority");
    requires.push("Autonomy to establish direction and execute quickly");
  }
  
  // High framework thrives in structured environments
  if (vectorScores.framework > 6.5) {
    thrives_in.push("Process-mature organizations (enterprise, regulated industries)");
    thrives_in.push("Operations-heavy roles with defined workflows");
    struggles_in.push("High-chaos startup environments");
    struggles_in.push("Frequent pivots and strategic shifts");
    requires.push("Clear process documentation and role definition");
  }
  
  // High signal thrives in relational cultures
  if (vectorScores.signal > 6.5) {
    thrives_in.push("Relationship-driven organizations (sales, customer success, HR)");
    thrives_in.push("Collaborative team cultures");
    struggles_in.push("Purely metrics-driven environments ignoring people dynamics");
    requires.push("Time and permission to build relationships");
  }
  
  // High velocity thrives in fast-paced environments
  if (vectorScores.velocity > 6.5) {
    thrives_in.push("High-tempo organizations (trading, emergency response, rapid deployment)");
    struggles_in.push("Slow, deliberative cultures");
    requires.push("Freedom to move fast without excessive process");
  }
  
  // High horizon thrives in strategic environments
  if (vectorScores.horizon > 6.5) {
    thrives_in.push("Strategy-focused organizations valuing long-range planning");
    thrives_in.push("Product/R&D environments with long development cycles");
    struggles_in.push("Purely tactical execution environments");
    requires.push("Strategic planning time and future-state framing");
  }
  
  // High fidelity thrives in precision environments
  if (vectorScores.fidelity > 6.5) {
    thrives_in.push("Quality-focused organizations (healthcare, finance, engineering)");
    struggles_in.push("Move-fast-break-things cultures");
    requires.push("Standards and verification time");
  }
  
  // Low signal struggles in relational environments
  if (vectorScores.signal < 3.5) {
    struggles_in.push("High-touch client relationships");
    struggles_in.push("Consensus-required team cultures");
    requires.push("Direct communication culture, tolerance for bluntness");
  }
  
  // Low framework struggles in structured environments
  if (vectorScores.framework < 3.5 && vectorScores.flex > 6.0) {
    thrives_in.push("Startups and high-ambiguity environments");
    struggles_in.push("Bureaucratic or heavily-procedural organizations");
  }
  
  // Business reality adjustments
  if (stall_patterns?.frustrations?.includes('bureaucracy')) {
    struggles_in.push("Bureaucratic environments with excessive approvals");
  }
  
  if (growth_tension?.priority_stated === 'autonomy' || growth_tension?.priority_stated === 'freedom') {
    requires.push("High autonomy and minimal oversight");
  }
  
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
