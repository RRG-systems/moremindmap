/**
 * renderContract.js
 * 
 * Render Contract Layer — Bridge between behavioral intelligence and profile renderer
 * 
 * Maps behavioral_intelligence_v1 domains to visible profile sections
 * with safe fallbacks to canonical/legacy fields.
 * 
 * DOCTRINE:
 * - Contract defines what renders, where it comes from, and fallback behavior
 * - Renderer consumes contract, not raw canonical or behavioral intelligence
 * - Missing behavioral_intelligence_v1 degrades gracefully to legacy narrative
 * - Zero mutations to behavioral_intelligence_v1 or canonical_profile_json
 */

/**
 * Section Render Contract
 * 
 * Maps behavioral intelligence domains to renderable section definitions.
 * Phase 1: 5 initial domains (others defer to Phase 2+)
 */
export const RENDER_CONTRACT = [
  {
    // Section 1: Operating System (Primary driver behavior)
    id: 'section-operating-system',
    displayTitle: 'Operating System',
    subtitle: 'How You Naturally Lead',
    priority: 1,
    order: 1,
    
    // Source: behavioral_intelligence_v1
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'operatingSystem',
    sourceFields: [
      'summary',
      'primary_driver',
      'secondary_stabilizer',
      'key_signals',
      'causal_interpretation'
    ],
    
    // Fallback: canonical narrative (legacy)
    fallbackType: 'canonical_narrative',
    fallbackField: 'operating_system_narrative',
    fallbackAlternative: 'narrative_profile.operating_system',
    
    // Requirements
    required: true,
    optional: false,
    
    // Content guidance
    targetWordLength: 150,
    maxWordLength: 250,
    
    // Empty state
    emptyState: 'Unable to determine operating system from assessment data.',
    hideIfEmpty: false,
    
    // Integration
    includeKeySignals: true,
    includeCausalChain: true,
    
    // Metadata
    confidence: 'tier_1_high',
    description: 'Primary operating dimension and how it shapes behavior'
  },
  
  {
    // Section 2: Hidden Contradictions (Structural tensions)
    id: 'section-contradictions',
    displayTitle: 'Hidden Contradictions',
    subtitle: 'Where Operating System Creates Friction',
    priority: 2,
    order: 2,
    
    // Source: behavioral_intelligence_v1
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'contradictions',
    sourceFields: [
      'summary',
      'contradictions',
      'contradiction_count',
      'core_tradeoff',
      'key_signals',
      'causal_interpretation'
    ],
    
    // Fallback: canonical contradictions
    fallbackType: 'canonical',
    fallbackField: 'contradictions',
    fallbackAlternative: 'top_systems.dimension_tradeoffs',
    
    // Requirements
    required: true,
    optional: false,
    
    // Content guidance
    targetWordLength: 120,
    maxWordLength: 200,
    
    // Empty state
    emptyState: 'No structural contradictions identified in assessment.',
    hideIfEmpty: true,
    
    // Integration
    includeManifestations: true,
    includeSeverity: true,
    includeOrganizationalCost: true,
    
    // Metadata
    confidence: 'tier_2_medium',
    description: 'Structural tensions between dimensions and their organizational costs'
  },
  
  {
    // Section 3: Organizational Consequences (What org experiences)
    id: 'section-organizational-consequences',
    displayTitle: 'Organizational Consequences',
    subtitle: 'What Your Organization Experiences',
    priority: 3,
    order: 3,
    
    // Source: behavioral_intelligence_v1
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'organizationalConsequences',
    sourceFields: [
      'summary',
      'consequence_matrix',
      'consequence_count',
      'key_signals'
    ],
    
    // Fallback: hidden risks + pressure dynamics
    fallbackType: 'canonical',
    fallbackField: 'hidden_risk_patterns',
    fallbackAlternative: 'pressure_dynamics',
    
    // Requirements
    required: false,
    optional: true,
    
    // Content guidance
    targetWordLength: 130,
    maxWordLength: 220,
    
    // Empty state
    emptyState: 'Analysis incomplete—insufficient pressure dynamics data.',
    hideIfEmpty: true,
    
    // Integration
    includeConsequenceMatrix: true,
    includeFrictionPoints: true,
    includeBandwidthStatus: false, // Optional in Phase 1
    
    // Metadata
    confidence: 'tier_3_medium',
    description: 'Synthesized organizational impact of operating system and contradictions'
  },
  
  {
    // Section 4: Facilitator Notes (Environment design guidance)
    id: 'section-facilitator-notes',
    displayTitle: 'Facilitator Notes',
    subtitle: 'Environment Design Guidance',
    priority: 4,
    order: 4,
    
    // Source: behavioral_intelligence_v1
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'facilitatorNotes',
    sourceFields: [
      'summary',
      'primary_guidance',
      'notes',
      'caution'
    ],
    
    // Fallback: none (new domain, no legacy)
    fallbackType: null,
    fallbackField: null,
    fallbackAlternative: null,
    
    // Requirements
    required: false,
    optional: true,
    
    // Content guidance
    targetWordLength: 100,
    maxWordLength: 180,
    
    // Empty state
    emptyState: 'No environment design guidance available for this profile.',
    hideIfEmpty: true,
    
    // Integration
    includeStructuralNotes: true,
    includeApplicability: false, // Optional in Phase 1
    
    // Metadata
    confidence: 'tier_3_medium',
    description: 'Structural guidance for org design and role fit (not coaching)'
  },
  
  {
    // Section 5: The One Move (Highest-leverage intervention)
    id: 'section-the-one-move',
    displayTitle: 'The One Move',
    subtitle: 'Highest-Leverage Intervention',
    priority: 5,
    order: 5,
    
    // Source: behavioral_intelligence_v1
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'theOneMove',
    sourceFields: [
      'summary',
      'the_move',
      'reasoning',
      'timeline',
      'caution'
    ],
    
    // Fallback: none (new domain, no legacy)
    fallbackType: null,
    fallbackField: null,
    fallbackAlternative: null,
    
    // Requirements
    required: false,
    optional: true,
    
    // Content guidance
    targetWordLength: 110,
    maxWordLength: 200,
    
    // Empty state
    emptyState: 'Unable to identify highest-leverage intervention from available data.',
    hideIfEmpty: true,
    
    // Integration
    includeReasoning: true,
    includeExpectedImpact: true,
    includeTimeline: false, // Optional in Phase 1
    
    // Metadata
    confidence: 'tier_3_low',
    description: 'Single highest-leverage structural intervention to shift trajectory'
  },

  {
    // Section 6: Pressure Mechanics (Escalation chain under load)
    id: 'section-pressure-mechanics',
    displayTitle: 'Pressure Mechanics',
    subtitle: 'Behavior Escalation Under Load',
    priority: 6,
    order: 6,
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'pressureMechanics',
    sourceFields: ['summary', 'primary_under_load', 'secondary_override', 'key_signals', 'causal_interpretation'],
    fallbackType: 'canonical',
    fallbackField: 'pressure_dynamics',
    fallbackAlternative: 'top_systems.pressure_response',
    required: false,
    optional: true,
    targetWordLength: 140,
    maxWordLength: 220,
    emptyState: 'Pressure response patterns not yet analyzed.',
    hideIfEmpty: true,
    includeEscalationChain: true,
    includeBreakingPoint: true,
    confidence: 'tier_2_high',
    description: 'Behavioral escalation sequence under operational pressure'
  },

  {
    // Section 7: World Experience (Operating environment)
    id: 'section-world-experience',
    displayTitle: 'World Experience',
    subtitle: 'How You Experience Your Operating Environment',
    priority: 7,
    order: 7,
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'worldExperience',
    sourceFields: ['summary', 'perception_filter', 'information_processing', 'decision_formation', 'time_horizon', 'risk_calibration', 'key_signals', 'causal_interpretation'],
    fallbackType: 'canonical',
    fallbackField: 'contextual_signals',
    fallbackAlternative: 'inferred_patterns.decision_architecture',
    required: false,
    optional: true,
    targetWordLength: 130,
    maxWordLength: 210,
    emptyState: 'Environmental perception patterns not analyzed.',
    hideIfEmpty: true,
    includeEnvironmentReading: true,
    includeOpportunityPattern: true,
    confidence: 'tier_2_high',
    description: 'How operating system reads and interprets environment'
  },

  {
    // Section 8: How Others Experience You (Social consequence)
    id: 'section-how-others-experience',
    displayTitle: 'How Others Experience You',
    subtitle: 'Your Operating Pattern From Team Perspective',
    priority: 8,
    order: 8,
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'othersExperience',
    sourceFields: ['summary', 'first_impression', 'communication_pattern', 'listening_pattern', 'relational_friction', 'key_signals', 'causal_interpretation'],
    fallbackType: 'canonical',
    fallbackField: 'organizational_effects',
    fallbackAlternative: 'inferred_patterns.communication_style.team_experience',
    required: false,
    optional: true,
    targetWordLength: 140,
    maxWordLength: 220,
    emptyState: 'Social experience patterns not yet determined.',
    hideIfEmpty: true,
    includeTeamExperience: true,
    includeRelationalCost: true,
    confidence: 'tier_2_medium',
    description: 'How teams adapt to and experience your operating pattern'
  },

  {
    // Section 9: Decision Architecture (How decisions form)
    id: 'section-decision-architecture',
    displayTitle: 'Decision Architecture',
    subtitle: 'How Decisions Form, Validate, and Execute',
    priority: 9,
    order: 9,
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'decisionArchitecture',
    sourceFields: ['summary', 'decision_formation', 'validation_method', 'execution_pattern', 'blind_spot'],
    fallbackType: 'canonical',
    fallbackField: 'decision_profile',
    fallbackAlternative: 'inferred_patterns.decision_architecture',
    required: false,
    optional: true,
    targetWordLength: 130,
    maxWordLength: 210,
    emptyState: 'Decision architecture not analyzed.',
    hideIfEmpty: true,
    includeFormation: true,
    includeValidation: true,
    includeBlindSpot: true,
    confidence: 'tier_2_high',
    description: 'Decision formation model and validation approach'
  },

  {
    // Section 10: Scaling Constraint (The specific breaking point)
    id: 'section-scaling-constraint',
    displayTitle: 'Scaling Constraint',
    subtitle: 'Where Your Operating Model Hits Its Ceiling',
    priority: 10,
    order: 10,
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'scalingConstraint',
    sourceFields: ['summary', 'ceiling_mechanics', 'current_systems_capacity', 'stated_vs_supported', 'implications', 'key_signals'],
    fallbackType: 'canonical',
    fallbackField: 'strategic_ceiling',
    fallbackAlternative: 'inferred_patterns.constraint_at_scale',
    required: false,
    optional: true,
    targetWordLength: 125,
    maxWordLength: 200,
    emptyState: 'Scaling constraint analysis not available.',
    hideIfEmpty: true,
    includeCoordinationMath: true,
    includeInfrastructureNeeds: true,
    confidence: 'tier_2_medium',
    description: 'Specific scaling point where personal execution becomes insufficient'
  },

  {
    // Section 11: Five Futures (Trajectory simulations)
    id: 'section-five-futures',
    displayTitle: 'Five Futures',
    subtitle: 'Trajectory Simulations Based on Current Pattern',
    priority: 11,
    order: 11,
    sourceType: 'behavioral_intelligence',
    sourceDomain: 'fiveFutures',
    sourceFields: ['summary', 'futures', 'most_likely'],
    fallbackType: 'canonical',
    fallbackField: 'future_trajectory',
    fallbackAlternative: 'inferred_patterns.future_trajectory',
    required: false,
    optional: true,
    targetWordLength: 200,
    maxWordLength: 300,
    emptyState: 'Future trajectory analysis not available.',
    hideIfEmpty: true,
    includeFutureStates: true,
    includeDecisionPoints: true,
    confidence: 'tier_2_medium',
    description: 'Five trajectory scenarios emerging from current operating pattern'
  }
];

/**
 * Contract utilities
 */

/**
 * Get render contract for a specific section
 */
export function getSectionContract(sectionId) {
  return RENDER_CONTRACT.find(s => s.id === sectionId);
}

/**
 * Get all sections ordered by priority
 */
export function getOrderedSections() {
  return [...RENDER_CONTRACT].sort((a, b) => a.priority - b.priority);
}

/**
 * Get required sections
 */
export function getRequiredSections() {
  return RENDER_CONTRACT.filter(s => s.required);
}

/**
 * Get optional sections
 */
export function getOptionalSections() {
  return RENDER_CONTRACT.filter(s => s.optional);
}

/**
 * Extract section content from behavioral intelligence
 * 
 * Safe extraction with fallback behavior
 */
export function extractSectionContent(sectionId, behavioralIntelligence, canonicalDossier) {
  const contract = getSectionContract(sectionId);
  
  if (!contract) {
    return {
      sectionId,
      found: false,
      error: `Unknown section: ${sectionId}`
    };
  }
  
  // Try primary source: behavioral intelligence
  if (contract.sourceType === 'behavioral_intelligence' && behavioralIntelligence) {
    const domain = behavioralIntelligence.domains?.[contract.sourceDomain];
    
    // TEMP DEBUG
    console.log('[EXTRACT SECTION CONTENT]', sectionId, 'sourceDomain:', contract.sourceDomain);
    console.log('[EXTRACT SECTION CONTENT] domain exists:', !!domain);
    if (domain) {
      console.log('[EXTRACT SECTION CONTENT] domain keys:', Object.keys(domain));
    }
    
    if (domain) {
      const extracted = extractFieldsFromDomain(domain, contract.sourceFields);
      console.log('[EXTRACT SECTION CONTENT] extracted content keys:', Object.keys(extracted));
      return {
        sectionId,
        found: true,
        source: 'behavioral_intelligence',
        domain: contract.sourceDomain,
        content: extracted,
        confidence: contract.confidence,
        fallbackUsed: false
      };
    }
  }
  
  // Fallback to canonical
  if (contract.fallbackType === 'canonical' && canonicalDossier) {
    let fallbackContent = null;
    
    // Try primary fallback field
    if (contract.fallbackField && canonicalDossier[contract.fallbackField]) {
      fallbackContent = canonicalDossier[contract.fallbackField];
    }
    
    // Try alternative fallback field
    if (!fallbackContent && contract.fallbackAlternative) {
      fallbackContent = getNestedField(canonicalDossier, contract.fallbackAlternative);
    }
    
    if (fallbackContent) {
      return {
        sectionId,
        found: true,
        source: 'canonical_fallback',
        fallbackField: contract.fallbackField || contract.fallbackAlternative,
        content: fallbackContent,
        confidence: 'fallback',
        fallbackUsed: true
      };
    }
  }
  
  // No content found anywhere
  if (contract.required) {
    return {
      sectionId,
      found: false,
      source: 'empty_state',
      content: contract.emptyState,
      confidence: 'unknown',
      fallbackUsed: false,
      required: true
    };
  }
  
  // Optional section with no content
  if (contract.hideIfEmpty) {
    return {
      sectionId,
      found: false,
      source: 'hidden',
      reason: 'optional_and_empty',
      confidence: 'unknown',
      fallbackUsed: false,
      optional: true,
      hidden: true
    };
  }
  
  return {
    sectionId,
    found: false,
    source: 'empty_state',
    content: contract.emptyState,
    confidence: 'unknown',
    fallbackUsed: false,
    optional: true
  };
}

/**
 * Extract specific fields from a domain object
 */
function extractFieldsFromDomain(domain, fieldNames) {
  const extracted = {};
  
  if (!domain || !fieldNames) return extracted;
  
  // TEMP DEBUG
  console.log('[EXTRACT FIELDS] domain keys:', Object.keys(domain));
  console.log('[EXTRACT FIELDS] requested fields:', fieldNames);
  
  fieldNames.forEach(fieldName => {
    if (domain[fieldName] !== undefined) {
      extracted[fieldName] = domain[fieldName];
      console.log('[EXTRACT FIELDS] extracted:', fieldName, '=', typeof domain[fieldName], Array.isArray(domain[fieldName]) ? `[Array ${domain[fieldName].length}]` : '');
    } else {
      console.log('[EXTRACT FIELDS] MISSING:', fieldName);
    }
  });
  
  console.log('[EXTRACT FIELDS] final extracted keys:', Object.keys(extracted));
  
  return extracted;
}

/**
 * Get nested field from object (e.g., 'a.b.c')
 */
function getNestedField(obj, path) {
  if (!obj || !path) return null;
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  
  return current;
}

/**
 * Build render plan for profile
 * 
 * Determines which sections to render, their order, and where content comes from
 */
export function buildRenderPlan(behavioralIntelligence, canonicalDossier) {
  const plan = {
    timestamp: new Date().toISOString(),
    hasIntelligence: !!behavioralIntelligence,
    sections: []
  };
  
  // Extract all sections
  const allSections = getOrderedSections();
  
  allSections.forEach(section => {
    const sectionContent = extractSectionContent(
      section.id,
      behavioralIntelligence,
      canonicalDossier
    );
    
    const shouldRender = sectionContent.found && (
      section.required ||
      (!section.hideIfEmpty && sectionContent.content)
    );
    
    plan.sections.push({
      ...sectionContent,
      contract: section,
      shouldRender
    });
  });
  
  return plan;
}

/**
 * Validate render contract integrity
 * 
 * Checks for missing fields, inconsistencies, etc.
 */
export function validateContract() {
  const issues = [];
  
  RENDER_CONTRACT.forEach((section, idx) => {
    // Check required fields
    if (!section.id) issues.push(`Section ${idx}: missing id`);
    if (!section.displayTitle) issues.push(`Section ${idx}: missing displayTitle`);
    if (section.priority === undefined) issues.push(`Section ${idx}: missing priority`);
    
    // Check source config
    if (section.sourceType === 'behavioral_intelligence' && !section.sourceDomain) {
      issues.push(`Section ${idx}: sourceType is behavioral_intelligence but sourceDomain missing`);
    }
    
    // Check mutually exclusive
    if (section.required && section.optional) {
      issues.push(`Section ${idx}: cannot be both required and optional`);
    }
  });
  
  // Check priority uniqueness
  const priorities = RENDER_CONTRACT.map(s => s.priority);
  const duplicatePriorities = priorities.filter((p, i) => priorities.indexOf(p) !== i);
  if (duplicatePriorities.length > 0) {
    issues.push(`Duplicate priorities: ${duplicatePriorities.join(', ')}`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
