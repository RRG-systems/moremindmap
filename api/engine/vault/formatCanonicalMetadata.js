/**
 * formatCanonicalMetadata.js
 * 
 * Format organizational metadata and contextual signals for display
 */

/**
 * Format metadata section for canonical dossier export
 */
export function formatMetadataSection(vault_record) {
  if (!vault_record) return '';
  
  const metadata = vault_record.metadata || {};
  const org = metadata.organization || {};
  const signals = metadata.contextual_signals || {};
  
  let output = '';
  
  // IDENTITY & ORG CONTEXT SECTION
  output += '# Assessment Metadata\n\n';
  
  // Identity
  output += '## Identity & Organization\n\n';
  if (vault_record.person_name) {
    output += `**Name:** ${vault_record.person_name}\n`;
  }
  if (vault_record.email) {
    output += `**Email:** ${vault_record.email}\n`;
  }
  if (org.phone) {
    output += `**Phone:** ${org.phone}\n`;
  }
  output += '\n';
  
  // Organization Context
  output += '## Current Role & Organization\n\n';
  if (vault_record.company_name) {
    output += `**Company:** ${vault_record.company_name}\n`;
  }
  if (org.department) {
    output += `**Department:** ${org.department}\n`;
  }
  if (org.role_title) {
    output += `**Role Title:** ${org.role_title}\n`;
  }
  if (org.reports_to) {
    output += `**Reports To:** ${org.reports_to}\n`;
  }
  if (org.direct_reports_count) {
    output += `**Direct Reports:** ${org.direct_reports_count}\n`;
  }
  if (org.years_in_current_role) {
    output += `**Years in Current Role:** ${org.years_in_current_role}\n`;
  }
  if (org.years_in_industry) {
    output += `**Years in Industry:** ${org.years_in_industry}\n`;
  }
  if (org.industry) {
    output += `**Industry:** ${org.industry}\n`;
  }
  if (Array.isArray(org.org_context) && org.org_context.length > 0) {
    output += `**Organizational Context:** ${org.org_context.join(', ')}\n`;
  }
  output += '\n';
  
  // Contextual Signals
  if (Object.keys(signals).length > 0) {
    output += '## Contextual Signals\n\n';
    output += 'These responses provide high-signal context about work history, current challenges, and untapped capacity.\n\n';
    
    // Best role section
    if (signals.best_role_ever || signals.best_role_why) {
      output += '### Best Work Environment\n\n';
      if (signals.best_role_ever) {
        output += `**What was your best job or work environment?**\n\n${signals.best_role_ever}\n\n`;
      }
      if (signals.best_role_why) {
        output += `**Why did it work so well?**\n\n${signals.best_role_why}\n\n`;
      }
    }
    
    // Worst role section
    if (signals.worst_role_ever || signals.worst_role_why) {
      output += '### Worst Work Environment\n\n';
      if (signals.worst_role_ever) {
        output += `**What was your worst job or work environment?**\n\n${signals.worst_role_ever}\n\n`;
      }
      if (signals.worst_role_why) {
        output += `**Why did it drain or frustrate you?**\n\n${signals.worst_role_why}\n\n`;
      }
    }
    
    // Current challenges section
    if (signals.current_energy_drain || signals.current_role_misalignment) {
      output += '### Current Challenges\n\n';
      if (signals.current_energy_drain) {
        output += `**What currently drains the most energy?**\n\n${signals.current_energy_drain}\n\n`;
      }
      if (signals.current_role_misalignment) {
        output += `**What feels misaligned in your current role?**\n\n${signals.current_role_misalignment}\n\n`;
      }
    }
    
    // Work avoidance & org frustration
    if (signals.avoided_work || signals.recurring_org_frustration) {
      output += '### Work Avoidance & Organizational Friction\n\n';
      if (signals.avoided_work) {
        output += `**What work do you avoid even when you know it matters?**\n\n${signals.avoided_work}\n\n`;
      }
      if (signals.recurring_org_frustration) {
        output += `**What problem in your organization frustrates you repeatedly?**\n\n${signals.recurring_org_frustration}\n\n`;
      }
    }
    
    // Strengths & perception
    if (signals.relied_on_for || signals.misunderstood_for) {
      output += "### How You're Perceived\n\n";
      if (signals.relied_on_for) {
        output += `**What do people consistently rely on you for?**\n\n${signals.relied_on_for}\n\n`;
      }
      if (signals.misunderstood_for) {
        output += `**What do people misunderstand about you?**\n\n${signals.misunderstood_for}\n\n`;
      }
    }
    
    // Unrealized capacity
    if (signals.unrealized_capacity) {
      output += '### Unrealized Capacity\n\n';
      output += `**What do you suspect you're capable of that isn't being used?**\n\n${signals.unrealized_capacity}\n\n`;
    }
  }
  
  output += '---\n\n';
  
  return output;
}

/**
 * Format short metadata summary for inline display
 */
export function formatMetadataSummary(vault_record) {
  if (!vault_record) return '';
  
  const metadata = vault_record.metadata || {};
  const org = metadata.organization || {};
  
  let summary = '';
  
  if (vault_record.person_name) {
    summary += `${vault_record.person_name}`;
  }
  
  if (org.role_title) {
    summary += ` • ${org.role_title}`;
  }
  
  if (vault_record.company_name) {
    summary += ` at ${vault_record.company_name}`;
  }
  
  if (org.industry) {
    summary += ` • ${org.industry}`;
  }
  
  return summary;
}

/**
 * Extract key contextual signals for profile summary
 */
export function extractKeySignals(vault_record) {
  if (!vault_record) return {};
  
  const signals = vault_record.metadata?.contextual_signals || {};
  
  return {
    energy_drain: signals.current_energy_drain || null,
    role_misalignment: signals.current_role_misalignment || null,
    relied_on_for: signals.relied_on_for || null,
    avoided_work: signals.avoided_work || null,
    unrealized_capacity: signals.unrealized_capacity || null,
  };
}
