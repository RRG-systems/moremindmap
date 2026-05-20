/**
 * Map Dimension Fields
 * Normalizes OpenAI-generated generic dimension_N fields into canonical named fields
 * 
 * OpenAI returns: dimension_1_code, dimension_2_code, etc.
 * Templates expect: vector_code, fidelity_code, etc.
 * 
 * This translation layer bridges the gap without changing prompts or templates.
 */

// Canonical dimension name mapping (order matters - matches assessment structure)
const DIMENSION_NAMES = [
  'vector',      // dimension_1
  'fidelity',    // dimension_2
  'framework',   // dimension_3
  'velocity',    // dimension_4
  'leverage',    // dimension_5
  'horizon',     // dimension_6
  'signal',      // dimension_7
  'flex'         // dimension_8
]

/**
 * Map dimension_N fields to canonical dimension names
 * Works on nested page structures
 * 
 * @param {Object} reportContent - Report content from OpenAI (may have dimension_N fields)
 * @returns {Object} - Normalized report content with canonical field names
 */
export function mapDimensionFields(reportContent) {
  if (!reportContent || typeof reportContent !== 'object') {
    return reportContent
  }
  
  // Clone to avoid mutation
  const normalized = JSON.parse(JSON.stringify(reportContent))
  
  // Process each page
  Object.keys(normalized).forEach(pageKey => {
    if (!pageKey.startsWith('page') || !normalized[pageKey] || typeof normalized[pageKey] !== 'object') {
      return
    }
    
    const page = normalized[pageKey]
    
    // Map dimension_N_* fields to named dimension fields
    for (let i = 1; i <= 8; i++) {
      const dimensionName = DIMENSION_NAMES[i - 1]
      const genericPrefix = `dimension_${i}_`
      
      // Check for dimension_N_code, dimension_N_label, dimension_N_explanation
      const suffixes = ['code', 'label', 'explanation']
      
      suffixes.forEach(suffix => {
        const genericField = genericPrefix + suffix
        const canonicalField = dimensionName + '_' + suffix
        
        if (page[genericField] !== undefined) {
          // Move dimension_N_* to named dimension field
          page[canonicalField] = page[genericField]
          delete page[genericField]
        }
      })
    }
  })
  
  return normalized
}

/**
 * Map dimension fields in repair response
 * Handles both nested (page objects) and flat (field: value) structures
 * 
 * @param {Object} repairResponse - Raw repair response from OpenAI
 * @returns {Object} - Normalized response with canonical field names
 */
export function mapDimensionFieldsInRepair(repairResponse) {
  if (!repairResponse || typeof repairResponse !== 'object') {
    return repairResponse
  }
  
  // Check if response is nested (has page keys) or flat (field: value)
  const keys = Object.keys(repairResponse)
  const hasPageKeys = keys.some(k => k.startsWith('page'))
  
  if (hasPageKeys) {
    // Nested structure - use standard mapper
    return mapDimensionFields(repairResponse)
  }
  
  // Flat structure - map top-level fields
  const normalized = {}
  
  Object.keys(repairResponse).forEach(fieldName => {
    let normalizedName = fieldName
    
    // Check if field matches dimension_N_* pattern
    const dimensionMatch = fieldName.match(/^dimension_(\d+)_(code|label|explanation)$/)
    if (dimensionMatch) {
      const dimensionIndex = parseInt(dimensionMatch[1])
      const suffix = dimensionMatch[2]
      
      if (dimensionIndex >= 1 && dimensionIndex <= 8) {
        const dimensionName = DIMENSION_NAMES[dimensionIndex - 1]
        normalizedName = `${dimensionName}_${suffix}`
      }
    }
    
    normalized[normalizedName] = repairResponse[fieldName]
  })
  
  return normalized
}
