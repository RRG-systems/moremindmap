/**
 * completeMissingMiniV2Fields.js
 * 
 * Deterministic fallback completion for remaining Mini V2 placeholders.
 * Fills only missing/empty/placeholder fields after repair merge.
 * Never overwrites good generated content.
 * 
 * Use case: After repair pass, ~79 placeholders remain (mostly icon/name/heading/summary/bullet).
 * This ensures 0 placeholders before final_injection.
 */

/**
 * Checks if a field value is missing, empty, or contains placeholders
 */
function isFieldMissing(value) {
  if (!value) return true;
  if (typeof value !== 'string') return true;
  
  const trimmed = value.trim();
  if (trimmed === '') return true;
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) return true;
  if (trimmed === '[placeholder]') return true;
  if (trimmed.toLowerCase().includes('placeholder')) return true;
  
  return false;
}

/**
 * Safe field writer - only writes if current value is missing
 */
function safeWrite(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  // Navigate to parent
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  const finalKey = keys[keys.length - 1];
  
  // Only write if missing
  if (isFieldMissing(current[finalKey])) {
    current[finalKey] = value;
    return true;
  }
  
  return false;
}

/**
 * Generate safe icon fallback
 */
function getIconFallback(fieldName) {
  // Map field names to appropriate icons
  const iconMap = {
    'primary_driver_icon': '🎯',
    'core_edge_icon': '⚡',
    'foundational_driver_icon': '🔧',
    'opposing_pattern_1_icon': '🔄',
    'opposing_pattern_2_icon': '🔄',
    'blind_spot_1_icon': '👁️',
    'blind_spot_2_icon': '👁️',
    'blind_spot_3_icon': '👁️',
    'friction_pattern_1_icon': '⚠️',
    'friction_pattern_2_icon': '⚠️',
    'friction_pattern_3_icon': '⚠️',
    'recalibration_1_icon': '🔄',
    'recalibration_2_icon': '🔄',
    'recalibration_3_icon': '🔄',
    'recalibration_4_icon': '🔄',
    'recalibration_5_icon': '🔄',
  };
  
  return iconMap[fieldName] || '●';
}

/**
 * Generate safe name fallback
 */
function getNameFallback(fieldName, profileInput) {
  if (fieldName.includes('primary_driver')) {
    return profileInput?.profile_summary?.primary_driver_label || 'Primary Driver';
  }
  if (fieldName.includes('foundational_driver')) {
    return profileInput?.profile_summary?.foundational_driver_label || 'Foundational Driver';
  }
  if (fieldName.includes('opposing_pattern_1')) {
    return 'Opposing Pattern 1';
  }
  if (fieldName.includes('opposing_pattern_2')) {
    return 'Opposing Pattern 2';
  }
  
  // Generic fallback
  return fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Generate safe heading fallback
 */
function getHeadingFallback(fieldName) {
  const headingMap = {
    'core_engine_heading': 'Core Engine',
    'decision_architecture_heading': 'Decision Architecture',
    'system_under_strain_heading': 'System Under Strain',
    'communication_heading': 'Communication Style',
    'environment_fit_heading': 'Environment Fit',
  };
  
  return headingMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Generate safe summary fallback
 */
function getSummaryFallback(fieldName, profileInput) {
  if (fieldName === 'core_engine_summary') {
    return 'This profile operates through a distinct combination of behavioral drivers and decision patterns.';
  }
  if (fieldName === 'primary_driver_summary') {
    return 'Primary behavioral driver shapes core operational approach.';
  }
  
  return 'Key behavioral insight for this profile dimension.';
}

/**
 * Generate safe bullet fallback
 */
function getBulletFallback(fieldName, index) {
  const bulletTemplates = [
    'Core behavioral characteristic',
    'Decision pattern influence',
    'Operational approach element',
    'System response pattern',
    'Environmental interaction factor',
  ];
  
  return bulletTemplates[index % bulletTemplates.length];
}

/**
 * Main completion function
 * 
 * @param {Object} reportContent - Nested page structure after repair merge
 * @param {Object} profileInput - Original profile input with scoring
 * @param {Array} missingFields - Array of field names still missing
 * @returns {Object} { reportContent, diagnostics }
 */
function completeMissingMiniV2Fields(reportContent, profileInput, missingFields) {
  const diagnostics = {
    fallback_fields_attempted: 0,
    fallback_fields_written: 0,
    fallback_fields_remaining: 0,
    field_types: {
      icon: 0,
      name: 0,
      heading: 0,
      summary: 0,
      bullet: 0,
      other: 0,
    },
  };
  
  if (!missingFields || !Array.isArray(missingFields) || missingFields.length === 0) {
    return { reportContent, diagnostics };
  }
  
  missingFields.forEach(fieldName => {
    diagnostics.fallback_fields_attempted++;
    
    let fallbackValue = null;
    let fieldType = 'other';
    
    // Determine field type and generate appropriate fallback
    if (fieldName.includes('_icon')) {
      fieldType = 'icon';
      fallbackValue = getIconFallback(fieldName);
    } else if (fieldName.includes('_name')) {
      fieldType = 'name';
      fallbackValue = getNameFallback(fieldName, profileInput);
    } else if (fieldName.includes('_heading')) {
      fieldType = 'heading';
      fallbackValue = getHeadingFallback(fieldName);
    } else if (fieldName.includes('_summary')) {
      fieldType = 'summary';
      fallbackValue = getSummaryFallback(fieldName, profileInput);
    } else if (fieldName.includes('_bullet_')) {
      fieldType = 'bullet';
      const match = fieldName.match(/_bullet_(\d+)$/);
      const bulletIndex = match ? parseInt(match[1], 10) - 1 : 0;
      fallbackValue = getBulletFallback(fieldName, bulletIndex);
    } else {
      fieldType = 'other';
      fallbackValue = 'Content element for ' + fieldName.replace(/_/g, ' ');
    }
    
    diagnostics.field_types[fieldType]++;
    
    // Attempt to write fallback
    // Try direct field name first (flat structure)
    let written = false;
    
    Object.keys(reportContent).forEach(pageKey => {
      if (pageKey.startsWith('page') && typeof reportContent[pageKey] === 'object') {
        if (safeWrite(reportContent[pageKey], fieldName, fallbackValue)) {
          written = true;
        }
      }
    });
    
    if (written) {
      diagnostics.fallback_fields_written++;
    } else {
      diagnostics.fallback_fields_remaining++;
    }
  });
  
  return { reportContent, diagnostics };
}

module.exports = completeMissingMiniV2Fields;
