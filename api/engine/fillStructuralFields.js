/**
 * Fill Structural Fields
 * Generates deterministic fallback values for icon, name, heading, and summary fields
 * that OpenAI doesn't reliably generate
 * 
 * Only fills fields that are null/empty - preserves any GPT-generated content
 */

/**
 * Fill missing structural fields with deterministic fallbacks
 * @param {Object} reportContent - Report content (may have nulls)
 * @returns {Object} - Report content with structural fields filled
 */
export function fillStructuralFields(reportContent) {
  if (!reportContent || typeof reportContent !== 'object') {
    return reportContent
  }
  
  // Page 1: Cover
  if (reportContent.page01_cover) {
    const p1 = reportContent.page01_cover
    
    // Core edge icon
    if (!p1.core_edge_icon) {
      p1.core_edge_icon = '⚡'
    }
  }
  
  // Page 2: Operating System Map
  if (reportContent.page02_operating_system_map) {
    const p2 = reportContent.page02_operating_system_map
    
    // Core engine heading/summary
    if (!p2.core_engine_heading) {
      p2.core_engine_heading = 'Operating Engine'
    }
    if (!p2.core_engine_summary) {
      // Use primary driver label if available
      p2.core_engine_summary = p2.primary_driver_label || 'Core behavioral operating system'
    }
    
    // Primary driver
    if (!p2.primary_driver_name) {
      p2.primary_driver_name = p2.primary_driver_label || 'Primary Driver'
    }
    if (!p2.primary_driver_icon) {
      p2.primary_driver_icon = '→'
    }
    
    // Secondary stabilizer
    if (!p2.secondary_stabilizer_name) {
      p2.secondary_stabilizer_name = p2.secondary_stabilizer_label || 'Secondary Stabilizer'
    }
    if (!p2.secondary_stabilizer_icon) {
      p2.secondary_stabilizer_icon = '◆'
    }
    
    // Opposing pattern 1
    if (!p2.opposing_pattern_1_name) {
      p2.opposing_pattern_1_name = p2.opposing_pattern_1_label || 'Opposing Pattern 1'
    }
    if (!p2.opposing_pattern_1_icon) {
      p2.opposing_pattern_1_icon = '⚠'
    }
    
    // Opposing pattern 2
    if (!p2.opposing_pattern_2_name) {
      p2.opposing_pattern_2_name = p2.opposing_pattern_2_label || 'Opposing Pattern 2'
    }
    if (!p2.opposing_pattern_2_icon) {
      p2.opposing_pattern_2_icon = '⚠'
    }
    
    // System tension
    if (!p2.system_tension_heading) {
      p2.system_tension_heading = 'System Tension'
    }
    if (!p2.system_tension_warning) {
      p2.system_tension_warning = 'Pattern conflicts may create operational tension'
    }
  }
  
  return reportContent
}
