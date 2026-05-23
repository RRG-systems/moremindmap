/**
 * Retrieve Pamela's canonical profile
 * Profile ID: MM-20260523-bm6knd3p
 */

import Redis from 'ioredis';
import { writeFileSync } from 'fs';

async function retrievePamela() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl);
  
  const profile_id = 'MM-20260523-bm6knd3p';
  
  try {
    console.log(`\n[RETRIEVE] Fetching profile: ${profile_id}\n`);
    
    // Retrieve canonical profile
    const profile_key = `vault:profile:${profile_id}`;
    const profile_json = await redis.get(profile_key);
    
    if (!profile_json) {
      console.error(`✗ Profile not found: ${profile_key}`);
      process.exit(1);
    }
    
    const canonical_profile = JSON.parse(profile_json);
    console.log(`✓ Profile retrieved: ${canonical_profile.person_name || 'Unknown'}`);
    console.log(`  Company: ${canonical_profile.company_name || 'N/A'}`);
    console.log(`  Email: ${canonical_profile.email || 'N/A'}`);
    
    // Try to retrieve markdown
    const markdown_key = `vault:markdown:${profile_id}`;
    let markdown_content = await redis.get(markdown_key);
    let markdown_source = 'vault';
    
    if (!markdown_content) {
      console.log(`⚠ Markdown not in vault, will transform from JSON`);
      markdown_source = 'json_transform';
      markdown_content = transformCanonicalToMarkdown(canonical_profile);
    } else {
      console.log(`✓ Markdown retrieved from vault`);
    }
    
    // Return results
    console.log('\n[EXPORT] Ready to export\n');
    
    return {
      profile_id,
      canonical_profile,
      markdown_content,
      markdown_source,
      person_name: canonical_profile.person_name,
      company_name: canonical_profile.company_name,
      email: canonical_profile.email
    };
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

/**
 * Transform canonical JSON to clean markdown
 * If vault markdown is missing, generate from JSON
 */
function transformCanonicalToMarkdown(profile) {
  const narratives = profile.canonical_profile_json?.narratives || {};
  const metadata = profile.metadata || {};
  const org = metadata.organization || {};
  
  let md = '';
  
  // Header
  md += `# ${profile.person_name || 'Profile'}\n\n`;
  
  if (profile.company_name) {
    md += `**Company:** ${profile.company_name}\n`;
  }
  if (org.role_title) {
    md += `**Role:** ${org.role_title}\n`;
  }
  if (profile.email) {
    md += `**Email:** ${profile.email}\n`;
  }
  
  md += `\n**Profile ID:** ${profile.profile_id}\n`;
  md += `**Created:** ${profile.created_at}\n`;
  md += `**Quality Score:** ${profile.quality_score}%\n\n`;
  
  // Organizational Context
  if (org && Object.keys(org).length > 0) {
    md += `## Organizational Context\n\n`;
    if (org.department) md += `- **Department:** ${org.department}\n`;
    if (org.reports_to) md += `- **Reports To:** ${org.reports_to}\n`;
    if (org.direct_reports_count) md += `- **Direct Reports:** ${org.direct_reports_count}\n`;
    if (org.years_in_current_role) md += `- **Tenure (Current Role):** ${org.years_in_current_role} years\n`;
    if (org.years_in_industry) md += `- **Industry Experience:** ${org.years_in_industry} years\n`;
    if (org.org_context && Array.isArray(org.org_context)) {
      md += `- **Org Context:** ${org.org_context.join(', ')}\n`;
    }
    md += '\n';
  }
  
  // Narrative Sections
  const sections = [
    { key: 'identity_narrative', title: 'Identity' },
    { key: 'executive_summary', title: 'Executive Summary' },
    { key: 'strategic_ceiling', title: 'Strategic Ceiling' },
    { key: 'contradiction_analysis', title: 'Contradictions' },
    { key: 'leadership_narrative', title: 'Leadership' },
    { key: 'decision_narrative', title: 'Decision Style' },
    { key: 'communication_narrative', title: 'Communication' },
    { key: 'development_narrative', title: 'Development Path' },
    { key: 'hidden_risks_narrative', title: 'Hidden Risks' },
    { key: 'coaching_leverage_narrative', title: 'Coaching Leverage' }
  ];
  
  for (const section of sections) {
    const content = narratives[section.key];
    if (content && content.trim()) {
      md += `## ${section.title}\n\n${content}\n\n`;
    }
  }
  
  // Metadata footer
  const identity = metadata.identity || {};
  const signals = metadata.contextual_signals || {};
  
  if (Object.keys(identity).length > 0 || Object.keys(signals).length > 0) {
    md += `---\n\n## Context\n\n`;
    
    if (identity.full_name || identity.phone) {
      md += `### Identity\n\n`;
      if (identity.full_name) md += `- **Name:** ${identity.full_name}\n`;
      if (identity.phone) md += `- **Phone:** ${identity.phone}\n`;
      md += '\n';
    }
    
    if (Object.keys(signals).length > 0) {
      md += `### Contextual Signals\n\n`;
      const signal_labels = {
        best_role_ever: 'Best Role Ever',
        best_role_why: 'Why It Worked',
        worst_role_ever: 'Worst Role Ever',
        worst_role_why: 'Why It Drained',
        current_energy_drain: 'Current Energy Drain',
        current_role_misalignment: 'Role Misalignment',
        avoided_work: 'Avoided Work',
        recurring_org_frustration: 'Recurring Frustration',
        relied_on_for: 'Relied On For',
        misunderstood_for: 'Misunderstood For',
        unrealized_capacity: 'Unrealized Capacity'
      };
      
      for (const [key, label] of Object.entries(signal_labels)) {
        if (signals[key]) {
          md += `**${label}:** ${signals[key]}\n\n`;
        }
      }
    }
  }
  
  return md;
}

// Run retrieval
const result = await retrievePamela();

console.log('\n✓ Export ready\n');
console.log(JSON.stringify({
  profile_id: result.profile_id,
  person_name: result.person_name,
  company_name: result.company_name,
  markdown_source: result.markdown_source,
  markdown_size: result.markdown_content.length,
  status: 'success'
}, null, 2));

// Write JSON
writeFileSync(
  'REVIEWABLE_PAMELA_CANONICAL_DOSSIER.json',
  JSON.stringify(result.canonical_profile, null, 2)
);
console.log('\n✓ Exported JSON');

// Write Markdown
writeFileSync(
  'REVIEWABLE_PAMELA_CANONICAL_DOSSIER.md',
  result.markdown_content
);
console.log('✓ Exported Markdown');

// Write Verification
const verification = `# Pamela Canonical Profile Retrieval Verification

**Timestamp:** ${new Date().toISOString()}
**Profile ID:** ${result.profile_id}
**Person:** ${result.person_name}
**Company:** ${result.company_name}
**Email:** ${result.email}

## Vault Keys Retrieved

\`\`\`
vault:profile:${result.profile_id}
\`\`\`

${result.markdown_source === 'vault' ? `\`\`\`
vault:markdown:${result.profile_id}
\`\`\`

**Source:** Markdown retrieved from Vault` : `**Source:** Markdown generated from JSON (vault key not found)`}

## Data Integrity

- Profile JSON: ✓ Retrieved
- Markdown: ✓ ${result.markdown_source === 'vault' ? 'Retrieved from Vault' : 'Generated from JSON'}
- Person Name: ${result.person_name}
- Quality Score: ${result.canonical_profile.quality_score}%
- Narratives Present: ${Object.keys(result.canonical_profile.canonical_profile_json?.narratives || {}).length}

## Files Created

- REVIEWABLE_PAMELA_CANONICAL_DOSSIER.json
- REVIEWABLE_PAMELA_CANONICAL_DOSSIER.md
- PAMELA_RETRIEVAL_VERIFICATION.txt

---

*Export verified and ready for review.*
`;

writeFileSync(
  'PAMELA_RETRIEVAL_VERIFICATION.txt',
  verification
);
console.log('✓ Exported Verification');

console.log('\n✓ All files created successfully\n');
process.exit(0);
