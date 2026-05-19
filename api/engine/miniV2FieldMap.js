// miniV2FieldMap.js - Deterministic Placeholder to ReportContent Path Mapping
// Extracted from Mini V2 templates on Tue May 19, 2026
// Purpose: Map flat placeholder names to nested reportContent page paths for repair pass

// PLACEHOLDER_TO_PATH: Maps every template placeholder to its reportContent path
export const PLACEHOLDER_TO_PATH = {
  // Global metadata (appears on all pages)
  assessment_date: 'metadata.assessment_date',
  confidence_level: 'metadata.confidence_level',
  profile_type: 'metadata.profile_type',
  
  // Page 01: Cover
  profile_code_string: 'page01_cover.profile_code_string',
  profile_signature_interpretation: 'page01_cover.profile_signature_interpretation',
  core_edge_icon: 'page01_cover.core_edge_icon',
  core_edge_narrative: 'page01_cover.core_edge_narrative',
  vector_code: 'page01_cover.vector_code',
  vector_label: 'page01_cover.vector_label',
  vector_explanation: 'page01_cover.vector_explanation',
  fidelity_code: 'page01_cover.fidelity_code',
  fidelity_label: 'page01_cover.fidelity_label',
  fidelity_explanation: 'page01_cover.fidelity_explanation',
  framework_code: 'page01_cover.framework_code',
  framework_label: 'page01_cover.framework_label',
  framework_explanation: 'page01_cover.framework_explanation',
  velocity_code: 'page01_cover.velocity_code',
  velocity_label: 'page01_cover.velocity_label',
  velocity_explanation: 'page01_cover.velocity_explanation',
  leverage_code: 'page01_cover.leverage_code',
  leverage_label: 'page01_cover.leverage_label',
  leverage_explanation: 'page01_cover.leverage_explanation',
  horizon_code: 'page01_cover.horizon_code',
  horizon_label: 'page01_cover.horizon_label',
  horizon_explanation: 'page01_cover.horizon_explanation',
  signal_code: 'page01_cover.signal_code',
  signal_label: 'page01_cover.signal_label',
  signal_explanation: 'page01_cover.signal_explanation',
  flex_code: 'page01_cover.flex_code',
  flex_label: 'page01_cover.flex_label',
  flex_explanation: 'page01_cover.flex_explanation',
  
  // Page 02: Operating System Map
  system_tension_warning: 'page02_operating_system_map.system_tension_warning',
  core_engine_heading: 'page02_operating_system_map.core_engine_heading',
  core_engine_summary: 'page02_operating_system_map.core_engine_summary',
  primary_driver_name: 'page02_operating_system_map.primary_driver_name',
  primary_driver_icon: 'page02_operating_system_map.primary_driver_icon',
  primary_driver_bullet_1: 'page02_operating_system_map.primary_driver_bullet_1',
  primary_driver_bullet_2: 'page02_operating_system_map.primary_driver_bullet_2',
  primary_driver_bullet_3: 'page02_operating_system_map.primary_driver_bullet_3',
  primary_driver_bullet_4: 'page02_operating_system_map.primary_driver_bullet_4',
  secondary_stabilizer_name: 'page02_operating_system_map.secondary_stabilizer_name',
  secondary_stabilizer_icon: 'page02_operating_system_map.secondary_stabilizer_icon',
  secondary_stabilizer_bullet_1: 'page02_operating_system_map.secondary_stabilizer_bullet_1',
  secondary_stabilizer_bullet_2: 'page02_operating_system_map.secondary_stabilizer_bullet_2',
  secondary_stabilizer_bullet_3: 'page02_operating_system_map.secondary_stabilizer_bullet_3',
  secondary_stabilizer_bullet_4: 'page02_operating_system_map.secondary_stabilizer_bullet_4',
  opposing_pattern_1_name: 'page02_operating_system_map.opposing_pattern_1_name',
  opposing_pattern_1_icon: 'page02_operating_system_map.opposing_pattern_1_icon',
  opposing_pattern_1_bullet_1: 'page02_operating_system_map.opposing_pattern_1_bullet_1',
  opposing_pattern_1_bullet_2: 'page02_operating_system_map.opposing_pattern_1_bullet_2',
  opposing_pattern_1_bullet_3: 'page02_operating_system_map.opposing_pattern_1_bullet_3',
  opposing_pattern_1_bullet_4: 'page02_operating_system_map.opposing_pattern_1_bullet_4',
  opposing_pattern_2_name: 'page02_operating_system_map.opposing_pattern_2_name',
  opposing_pattern_2_icon: 'page02_operating_system_map.opposing_pattern_2_icon',
  opposing_pattern_2_bullet_1: 'page02_operating_system_map.opposing_pattern_2_bullet_1',
  opposing_pattern_2_bullet_2: 'page02_operating_system_map.opposing_pattern_2_bullet_2',
  opposing_pattern_2_bullet_3: 'page02_operating_system_map.opposing_pattern_2_bullet_3',
  opposing_pattern_2_bullet_4: 'page02_operating_system_map.opposing_pattern_2_bullet_4',
  system_tension_summary: 'page02_operating_system_map.system_tension_summary',
  legend_primary_driver_text: 'page02_operating_system_map.legend_primary_driver_text',
  legend_secondary_stabilizer_text: 'page02_operating_system_map.legend_secondary_stabilizer_text',
  legend_opposing_patterns_text: 'page02_operating_system_map.legend_opposing_patterns_text',
  
  // Page 03: Executive Summary
  summary_text: 'page03_executive_summary.summary_text',
  leadership_heading: 'page03_executive_summary.leadership_heading',
  leadership_body: 'page03_executive_summary.leadership_body',
  development_heading: 'page03_executive_summary.development_heading',
  development_body: 'page03_executive_summary.development_body',
  priority_heading: 'page03_executive_summary.priority_heading',
  priority_body: 'page03_executive_summary.priority_body',
  
  // Page 04: Operating Pattern
  operating_pattern_body_1: 'page04_operating_pattern.operating_pattern_body_1',
  operating_pattern_body_2: 'page04_operating_pattern.operating_pattern_body_2',
  operating_pattern_body_3: 'page04_operating_pattern.operating_pattern_body_3',
  operating_pattern_body_4: 'page04_operating_pattern.operating_pattern_body_4',
  strongest_default_heading: 'page04_operating_pattern.strongest_default_heading',
  strongest_default_body: 'page04_operating_pattern.strongest_default_body',
  likely_blind_spot_heading: 'page04_operating_pattern.likely_blind_spot_heading',
  likely_blind_spot_body: 'page04_operating_pattern.likely_blind_spot_body',
  highest_value_adjustment_heading: 'page04_operating_pattern.highest_value_adjustment_heading',
  highest_value_adjustment_body: 'page04_operating_pattern.highest_value_adjustment_body',
  development_priority_heading: 'page04_operating_pattern.development_priority_heading',
  development_priority_body: 'page04_operating_pattern.development_priority_body',
  
  // Page 05: Decision Architecture
  decision_architecture_narrative_1: 'page05_decision_architecture.decision_architecture_narrative_1',
  decision_architecture_narrative_2: 'page05_decision_architecture.decision_architecture_narrative_2',
  decision_trait_1_heading: 'page05_decision_architecture.decision_trait_1_heading',
  decision_trait_1_value: 'page05_decision_architecture.decision_trait_1_value',
  decision_trait_2_heading: 'page05_decision_architecture.decision_trait_2_heading',
  decision_trait_2_value: 'page05_decision_architecture.decision_trait_2_value',
  advantage_heading: 'page05_decision_architecture.advantage_heading',
  advantage_body: 'page05_decision_architecture.advantage_body',
  failure_heading: 'page05_decision_architecture.failure_heading',
  failure_body: 'page05_decision_architecture.failure_body',
  upgrade_heading: 'page05_decision_architecture.upgrade_heading',
  upgrade_body: 'page05_decision_architecture.upgrade_body',
  
  // Page 06: Communication Style
  signal_matrix_explanation: 'page06_communication_style.signal_matrix_explanation',
  others_experience_1_heading: 'page06_communication_style.others_experience_1_heading',
  others_experience_1_body: 'page06_communication_style.others_experience_1_body',
  others_experience_2_heading: 'page06_communication_style.others_experience_2_heading',
  others_experience_2_body: 'page06_communication_style.others_experience_2_body',
  others_experience_3_heading: 'page06_communication_style.others_experience_3_heading',
  others_experience_3_body: 'page06_communication_style.others_experience_3_body',
  communication_advantage_heading: 'page06_communication_style.communication_advantage_heading',
  communication_advantage_body: 'page06_communication_style.communication_advantage_body',
  communication_friction_heading: 'page06_communication_style.communication_friction_heading',
  communication_friction_body: 'page06_communication_style.communication_friction_body',
  communication_upgrade_heading: 'page06_communication_style.communication_upgrade_heading',
  communication_upgrade_body: 'page06_communication_style.communication_upgrade_body',
  
  // Page 07: System Under Strain
  pressure_response_explanation: 'page07_system_under_strain.pressure_response_explanation',
  escalation_chain_explanation: 'page07_system_under_strain.escalation_chain_explanation',
  friction_patterns_explanation: 'page07_system_under_strain.friction_patterns_explanation',
  blind_spot_field_explanation: 'page07_system_under_strain.blind_spot_field_explanation',
  recalibration_priorities_explanation: 'page07_system_under_strain.recalibration_priorities_explanation',
  
  // Page 08: Operating Environment Fit
  high_traction_card_heading: 'page08_operating_environment_fit.high_traction_card_heading',
  high_traction_card_body: 'page08_operating_environment_fit.high_traction_card_body',
  high_traction_environments_body: 'page08_operating_environment_fit.high_traction_environments_body',
  high_friction_card_heading: 'page08_operating_environment_fit.high_friction_card_heading',
  high_friction_card_body: 'page08_operating_environment_fit.high_friction_card_body',
  high_friction_environments_body: 'page08_operating_environment_fit.high_friction_environments_body',
  conditional_fit_card_heading: 'page08_operating_environment_fit.conditional_fit_card_heading',
  conditional_fit_card_body: 'page08_operating_environment_fit.conditional_fit_card_body',
  conditional_fit_environments_body: 'page08_operating_environment_fit.conditional_fit_environments_body',
  adapt_shift_heading: 'page08_operating_environment_fit.adapt_shift_heading',
  adapt_shift_body: 'page08_operating_environment_fit.adapt_shift_body',
  input_shift_heading: 'page08_operating_environment_fit.input_shift_heading',
  input_shift_body: 'page08_operating_environment_fit.input_shift_body',
  horizon_shift_heading: 'page08_operating_environment_fit.horizon_shift_heading',
  horizon_shift_body: 'page08_operating_environment_fit.horizon_shift_body',
  
  // Page 09: Facilitator Notes
  facilitator_interpretation_body: 'page09_facilitator_notes.facilitator_interpretation_body',
  development_edges_body: 'page09_facilitator_notes.development_edges_body',
  coaching_intervention_body: 'page09_facilitator_notes.coaching_intervention_body',
  coaching_questions_body: 'page09_facilitator_notes.coaching_questions_body',
  
  // Page 10: Full Profile Unlocks
  operating_dna_subtitle: 'page10_full_profile_unlocks.operating_dna_subtitle',
  core_force_heading: 'page10_full_profile_unlocks.core_force_heading',
  core_force_body: 'page10_full_profile_unlocks.core_force_body',
  hidden_cost_heading: 'page10_full_profile_unlocks.hidden_cost_heading',
  hidden_cost_body: 'page10_full_profile_unlocks.hidden_cost_body',
  next_evolution_heading: 'page10_full_profile_unlocks.next_evolution_heading',
  next_evolution_body: 'page10_full_profile_unlocks.next_evolution_body',
  unlock_area_1_heading: 'page10_full_profile_unlocks.unlock_area_1_heading',
  unlock_area_1_body: 'page10_full_profile_unlocks.unlock_area_1_body',
  unlock_area_2_heading: 'page10_full_profile_unlocks.unlock_area_2_heading',
  unlock_area_2_body: 'page10_full_profile_unlocks.unlock_area_2_body',
  advanced_system_1_heading: 'page10_full_profile_unlocks.advanced_system_1_heading',
  advanced_system_1_body: 'page10_full_profile_unlocks.advanced_system_1_body',
  advanced_system_2_heading: 'page10_full_profile_unlocks.advanced_system_2_heading',
  advanced_system_2_body: 'page10_full_profile_unlocks.advanced_system_2_body',
  why_this_matters_body: 'page10_full_profile_unlocks.why_this_matters_body'
};

/**
 * Group missing fields by their page object
 * @param {string[]} missingFields - Array of flat placeholder names
 * @returns {Object} - Object with page keys and field arrays
 */
export function groupMissingFieldsByPage(missingFields) {
  // Normalize missingFields to array (boundary enforcement - do not rely on callers)
  let fields
  
  if (Array.isArray(missingFields)) {
    fields = missingFields
  } else if (missingFields && typeof missingFields === "object") {
    // Object (possibly {"0": "field", "1": "field2"} or nested) → flatten
    console.warn('[GROUP] Converting object to array')
    fields = Object.values(missingFields).flat().filter(Boolean)
  } else if (missingFields == null) {
    console.warn('[GROUP] missingFields is null/undefined, using empty array')
    fields = []
  } else {
    throw new Error("[GROUP] missingFields invalid type: " + typeof missingFields)
  }
  
  const grouped = {};
  const unmapped = [];
  
  fields.forEach(field => {
    const path = PLACEHOLDER_TO_PATH[field];
    if (!path) {
      unmapped.push(field);
      return;
    }
    
    const [pageKey, fieldName] = path.split('.');
    if (!grouped[pageKey]) {
      grouped[pageKey] = [];
    }
    grouped[pageKey].push(fieldName);
  });
  
  if (unmapped.length > 0) {
    console.warn(`[FIELD MAP] ${unmapped.length} unmapped placeholders:`, unmapped.slice(0, 20));
  }
  
  console.log(`[FIELD MAP] Grouped ${missingFields.length} fields into ${Object.keys(grouped).length} pages`);
  Object.keys(grouped).forEach(page => {
    console.log(`[FIELD MAP]   ${page}: ${grouped[page].length} fields`);
  });
  
  return { grouped, unmapped };
}

/**
 * Normalize repair response from GPT
 * Handles: nested page objects, flat fields, wrapper keys
 * @param {Object} repairResponse - Raw GPT repair response
 * @param {string[]} requestedFields - Original requested field names
 * @returns {Object} - Normalized { pageKey: { field: value } }
 */
export function normalizeRepairResponse(repairResponse, requestedFields = []) {
  console.log('[FIELD MAP] Normalizing repair response...');
  console.log('[FIELD MAP] Response keys:', Object.keys(repairResponse).sort());
  
  let normalized = {};
  
  // Check for wrapper keys
  if (repairResponse.repairs) {
    console.log('[FIELD MAP] Unwrapping "repairs" wrapper');
    repairResponse = repairResponse.repairs;
  }
  if (repairResponse.content) {
    console.log('[FIELD MAP] Unwrapping "content" wrapper');
    repairResponse = repairResponse.content;
  }
  if (repairResponse.reportContent) {
    console.log('[FIELD MAP] Unwrapping "reportContent" wrapper');
    repairResponse = repairResponse.reportContent;
  }
  
  // Check if already in page format
  const pageKeys = Object.keys(repairResponse).filter(k => k.startsWith('page') || k === 'metadata');
  if (pageKeys.length > 0) {
    console.log('[FIELD MAP] Response already in page format');
    normalized = repairResponse;
  } else {
    // Flat format - map to pages
    console.log('[FIELD MAP] Converting flat response to page format');
    Object.keys(repairResponse).forEach(field => {
      const path = PLACEHOLDER_TO_PATH[field];
      if (!path) {
        console.warn(`[FIELD MAP] Cannot map field: ${field}`);
        return;
      }
      
      const [pageKey, fieldName] = path.split('.');
      if (!normalized[pageKey]) {
        normalized[pageKey] = {};
      }
      normalized[pageKey][fieldName] = repairResponse[field];
    });
  }
  
  // Count normalized fields
  let totalFields = 0;
  Object.keys(normalized).forEach(page => {
    const count = Object.keys(normalized[page] || {}).length;
    totalFields += count;
    console.log(`[FIELD MAP] Normalized ${page}: ${count} fields`);
  });
  
  console.log(`[FIELD MAP] Total normalized fields: ${totalFields}`);
  return normalized;
}

/**
 * Merge repaired fields into reportContent
 * Only overwrites empty/missing/placeholder fields
 * @param {Object} reportContent - Original reportContent
 * @param {Object} normalizedRepairs - Normalized repairs from normalizeRepairResponse
 * @returns {Object} - Stats { written, skipped, reasons }
 */
export function mergeRepairedFields(reportContent, normalizedRepairs) {
  console.log('[FIELD MAP] Merging repaired fields...');
  
  let written = 0;
  let skipped = 0;
  const skipReasons = {};
  const detailedSkips = [];
  const writtenFields = [];
  
  Object.keys(normalizedRepairs).forEach(pageKey => {
    if (!reportContent[pageKey]) {
      reportContent[pageKey] = {};
    }
    
    const pageFields = normalizedRepairs[pageKey];
    Object.keys(pageFields).forEach(fieldName => {
      const newValue = pageFields[fieldName];
      const oldValue = reportContent[pageKey][fieldName];
      
      // Check if should overwrite (safe string operations)
      const oldValueText = typeof oldValue === 'string' ? oldValue : '';
      const isEmpty = oldValue == null || oldValueText.trim() === '';
      const isPlaceholder = oldValueText && (
        oldValueText.includes('{{') || 
        oldValueText.includes('[MOCK]') ||
        oldValueText.toLowerCase().includes('placeholder')
      );
      
      if (isEmpty || isPlaceholder) {
        reportContent[pageKey][fieldName] = newValue;
        written++;
        writtenFields.push(`${pageKey}.${fieldName}`);
      } else {
        skipped++;
        const reason = 'has_content';
        skipReasons[reason] = (skipReasons[reason] || 0) + 1;
        detailedSkips.push({ page: pageKey, field: fieldName, reason, oldValue: oldValueText.substring(0, 50) });
      }
    });
  });
  
  console.log(`[FIELD MAP] Merge complete: ${written} written, ${skipped} skipped`);
  if (skipped > 0) {
    console.log('[FIELD MAP] Skip reasons:', skipReasons);
  }
  
  return { 
    written, 
    skipped, 
    skipReasons,
    writtenFields: writtenFields.slice(0, 30),
    skippedFields: detailedSkips.slice(0, 30)
  };
}
