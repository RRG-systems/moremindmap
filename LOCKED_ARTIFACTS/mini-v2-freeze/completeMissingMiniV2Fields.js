/**
 * completeMissingMiniV2Fields.js
 * 
 * Profile-aware deterministic fallback completion for Mini V2.
 * Generates semantically meaningful content based on dimension scores and profile data.
 * NO generic "Content element for..." or placeholder-style text.
 */

// Dimension labels for semantic interpretation
const DIMENSION_LABELS = {
  vector: 'Command',
  signal: 'Relational Awareness',
  fidelity: 'Precision',
  velocity: 'Tempo',
  leverage: 'Influence',
  flex: 'Adaptability',
  framework: 'Structure',
  horizon: 'Perspective'
};

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
 * Get top dimension names from profileInput
 */
function getTopDimensions(profileInput) {
  const primary = profileInput?.top_systems?.primary_driver?.dimension || 'vector';
  const secondary = profileInput?.top_systems?.secondary_stabilizer?.dimension || 'signal';
  const opposing1 = profileInput?.top_systems?.opposing_pattern_1?.dimension || 'flex';
  const opposing2 = profileInput?.top_systems?.opposing_pattern_2?.dimension || 'fidelity';
  
  return { primary, secondary, opposing1, opposing2 };
}

/**
 * Generate profile-aware heading based on dimensions
 */
function getSmartHeading(fieldName, profileInput) {
  const { primary, secondary, opposing1, opposing2 } = getTopDimensions(profileInput);
  const primaryLabel = DIMENSION_LABELS[primary] || 'Direction';
  const secondaryLabel = DIMENSION_LABELS[secondary] || 'Support';
  const opposing1Label = DIMENSION_LABELS[opposing1] || 'Tension';
  
  // Page-specific headings
  if (fieldName.includes('leadership')) {
    return `Leads Through ${primaryLabel}`;
  }
  if (fieldName.includes('development')) {
    return `Growth Requires ${opposing1Label} Development`;
  }
  if (fieldName.includes('priority')) {
    return `Build ${secondaryLabel} Before Speed`;
  }
  if (fieldName.includes('decision_trait_1')) {
    return `Decisive Through ${primaryLabel}`;
  }
  if (fieldName.includes('decision_trait_2')) {
    return `${secondaryLabel}-Oriented Framing`;
  }
  if (fieldName.includes('others_experience_1')) {
    return `Clear ${primaryLabel}`;
  }
  if (fieldName.includes('others_experience_2')) {
    return `Low Patience for Drift`;
  }
  if (fieldName.includes('others_experience_3')) {
    return `May Feel Hard to Interrupt`;
  }
  if (fieldName.includes('communication')) {
    return `${primaryLabel}-First Communication`;
  }
  if (fieldName.includes('environment')) {
    return `Thrives in ${primaryLabel}-Valued Environments`;
  }
  
  // Generic smart fallback - NO "Heading" suffix
  return fieldName
    .replace(/_heading$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Generate profile-aware body/summary text
 */
function getSmartBody(fieldName, profileInput) {
  const { primary, secondary, opposing1, opposing2 } = getTopDimensions(profileInput);
  const primaryLabel = DIMENSION_LABELS[primary] || 'direction';
  const secondaryLabel = DIMENSION_LABELS[secondary] || 'support';
  const opposing1Label = DIMENSION_LABELS[opposing1] || 'tension';
  
  if (fieldName.includes('leadership')) {
    return `This profile leads by establishing ${primaryLabel.toLowerCase()} early and maintaining momentum through ${secondaryLabel.toLowerCase()}. Team members experience clear direction but may need explicit permission to challenge assumptions.`;
  }
  
  if (fieldName.includes('development')) {
    return `Growth opportunities center on developing ${opposing1Label.toLowerCase()} as a complement to natural ${primaryLabel.toLowerCase()}. Building capacity in underused dimensions strengthens strategic range without abandoning core strengths.`;
  }
  
  if (fieldName.includes('priority')) {
    return `Effectiveness increases when ${secondaryLabel.toLowerCase()} is established before accelerating through ${primaryLabel.toLowerCase()}. Investing early in foundational clarity prevents costly course corrections later.`;
  }
  
  if (fieldName.includes('decision_trait')) {
    return `Decisions form through ${primaryLabel.toLowerCase()} first, with ${secondaryLabel.toLowerCase()} providing validation framework. This pattern creates speed but requires conscious integration of ${opposing1Label.toLowerCase()} to avoid blind spots.`;
  }
  
  if (fieldName.includes('others_experience')) {
    return `Others experience strong ${primaryLabel.toLowerCase()} and clear direction. The challenge surface appears when speed outpaces shared context or when ${opposing1Label.toLowerCase()} signals are missed during execution.`;
  }
  
  if (fieldName.includes('communication')) {
    return `Communication style reflects ${primaryLabel.toLowerCase()}-first processing, emphasizing clarity and momentum. Messages land best when ${secondaryLabel.toLowerCase()} context is provided upfront to align team understanding.`;
  }
  
  if (fieldName.includes('environment')) {
    return `This profile performs best in environments that reward ${primaryLabel.toLowerCase()} and provide infrastructure for ${secondaryLabel.toLowerCase()}. Organizational cultures that over-index on ${opposing1Label.toLowerCase()} without supporting ${primaryLabel.toLowerCase()} create unnecessary friction.`;
  }
  
  if (fieldName.includes('core_engine')) {
    return `Core operating system runs on ${primaryLabel.toLowerCase()} as primary driver, stabilized by ${secondaryLabel.toLowerCase()}. This combination creates speed and clarity while requiring conscious attention to ${opposing1Label.toLowerCase()} to avoid strategic blind spots.`;
  }
  
  // Generic smart body
  return `This profile dimension reflects behavioral patterns shaped by ${primaryLabel.toLowerCase()} as primary driver and ${secondaryLabel.toLowerCase()} as stabilizing force. Development opportunities emerge at the intersection with ${opposing1Label.toLowerCase()}.`;
}

/**
 * Generate profile-aware bullet points
 */
function getSmartBullet(fieldName, index, profileInput) {
  const { primary, secondary, opposing1 } = getTopDimensions(profileInput);
  const primaryLabel = DIMENSION_LABELS[primary] || 'direction';
  const secondaryLabel = DIMENSION_LABELS[secondary] || 'support';
  const opposing1Label = DIMENSION_LABELS[opposing1] || 'adaptation';
  
  const bulletSets = {
    leadership: [
      `Establishes ${primaryLabel.toLowerCase()} before consensus`,
      `Maintains momentum through ${secondaryLabel.toLowerCase()}`,
      `May move faster than team can follow`,
      `Requires explicit permission to slow down`
    ],
    development: [
      `Build ${opposing1Label.toLowerCase()} capacity`,
      `Integrate ${secondaryLabel.toLowerCase()} more deliberately`,
      `Practice pausing before action`,
      `Develop pattern recognition for blind spots`
    ],
    decision: [
      `${primaryLabel} forms direction quickly`,
      `${secondaryLabel} validates approach`,
      `Speed can outpace context`,
      `Conscious integration prevents regret`
    ],
    communication: [
      `${primaryLabel}-first message structure`,
      `Emphasizes clarity and momentum`,
      `Works best with upfront context`,
      `May feel too direct for some cultures`
    ]
  };
  
  // Determine bullet set
  let bullets = bulletSets.leadership; // default
  if (fieldName.includes('development') || fieldName.includes('priority')) {
    bullets = bulletSets.development;
  } else if (fieldName.includes('decision')) {
    bullets = bulletSets.decision;
  } else if (fieldName.includes('communication')) {
    bullets = bulletSets.communication;
  }
  
  return bullets[index % bullets.length];
}

/**
 * Generate profile-aware name/label
 */
function getSmartName(fieldName, profileInput) {
  const { primary, secondary, opposing1, opposing2 } = getTopDimensions(profileInput);
  
  if (fieldName.includes('primary_driver')) {
    return DIMENSION_LABELS[primary] || 'Primary Driver';
  }
  if (fieldName.includes('secondary_stabilizer')) {
    return DIMENSION_LABELS[secondary] || 'Secondary Stabilizer';
  }
  if (fieldName.includes('foundational_driver')) {
    return DIMENSION_LABELS[secondary] || 'Foundational Driver';
  }
  if (fieldName.includes('opposing_pattern_1')) {
    return DIMENSION_LABELS[opposing1] || 'Lower Dimension';
  }
  if (fieldName.includes('opposing_pattern_2')) {
    return DIMENSION_LABELS[opposing2] || 'Strain Pattern';
  }
  
  // NO generic "Name" - use actual semantic label
  return fieldName
    .replace(/_name$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Generate safe icon fallback
 */
function getIconFallback(fieldName) {
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
      body: 0,
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
    
    // Determine field type and generate profile-aware fallback
    if (fieldName.includes('_icon')) {
      fieldType = 'icon';
      fallbackValue = getIconFallback(fieldName);
    } else if (fieldName.includes('_name')) {
      fieldType = 'name';
      fallbackValue = getSmartName(fieldName, profileInput);
    } else if (fieldName.includes('_heading')) {
      fieldType = 'heading';
      fallbackValue = getSmartHeading(fieldName, profileInput);
    } else if (fieldName.includes('_summary') || fieldName.includes('_body')) {
      fieldType = fieldName.includes('_summary') ? 'summary' : 'body';
      fallbackValue = getSmartBody(fieldName, profileInput);
    } else if (fieldName.includes('_bullet_')) {
      fieldType = 'bullet';
      const match = fieldName.match(/_bullet_(\d+)$/);
      const bulletIndex = match ? parseInt(match[1], 10) - 1 : 0;
      fallbackValue = getSmartBullet(fieldName, bulletIndex, profileInput);
    } else {
      // NO "Content element for" - generate smart fallback
      fieldType = 'other';
      fallbackValue = getSmartBody(fieldName, profileInput);
    }
    
    diagnostics.field_types[fieldType]++;
    
    // Attempt to write fallback
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

export default completeMissingMiniV2Fields;
