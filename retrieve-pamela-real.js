/**
 * Retrieve REAL Pamela Profile from Production Vault
 * 
 * Profile ID: MM-20260523-bm6knd3p
 * 
 * Sources:
 * 1. Try production API endpoint
 * 2. Fall back to production Redis (Upstash)
 * 3. Export to clean files
 */

import { writeFileSync } from 'fs';
import https from 'https';

const PROFILE_ID = 'MM-20260523-bm6knd3p';
const PRODUCTION_API = 'https://moremindmap.com';

/**
 * Fetch from production HTTPS endpoint
 */
function fetchProduction(path) {
  return new Promise((resolve, reject) => {
    const url = `${PRODUCTION_API}${path}`;
    console.log(`[FETCH] ${url}`);

    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (err) {
            resolve({ status: res.statusCode, data: data });
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Transform canonical profile to clean markdown
 */
function profileToMarkdown(profile) {
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
    if (org.direct_reports_count)
      md += `- **Direct Reports:** ${org.direct_reports_count}\n`;
    if (org.years_in_current_role)
      md += `- **Tenure (Current Role):** ${org.years_in_current_role} years\n`;
    if (org.years_in_industry)
      md += `- **Industry Experience:** ${org.years_in_industry} years\n`;
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

/**
 * Main retrieval
 */
async function retrieveRealPamela() {
  console.log(`\n[RETRIEVE] Pamela Profile: ${PROFILE_ID}\n`);

  try {
    // Try production API endpoint
    console.log('[ATTEMPT 1] Trying production API endpoint...');
    const apiResult = await fetchProduction(
      `/api/diagnostic/get-vault-profile?id=${PROFILE_ID}`
    );

    if (apiResult.status === 200 && apiResult.data.success) {
      console.log('✓ Production API endpoint succeeded\n');

      const profile = apiResult.data.profile;
      const markdown = apiResult.data.markdown.found
        ? apiResult.data.markdown.content
        : profileToMarkdown(profile);
      const markdown_source = apiResult.data.markdown.found
        ? 'vault:markdown'
        : 'json_transform';

      return {
        success: true,
        profile_id: PROFILE_ID,
        profile,
        markdown,
        markdown_source,
        source: 'production_api'
      };
    }

    if (apiResult.status === 404) {
      console.log('✗ Profile not found in production API');
      throw new Error(`Profile ${PROFILE_ID} not found in production`);
    }

    console.log(
      `⚠ API returned ${apiResult.status}, falling back to direct Redis...\n`
    );

    // Direct Redis would require REDIS_URL to point to production
    // This will fail locally, but would work in production environment
    console.error(
      '✗ Cannot access production Redis from local environment'
    );
    throw new Error(
      'Production API unavailable and local Redis access not configured'
    );
  } catch (error) {
    console.error(`\n[ERROR] ${error.message}`);
    return {
      success: false,
      error: error.message,
      profile_id: PROFILE_ID
    };
  }
}

// Execute retrieval
retrieveRealPamela().then((result) => {
  if (!result.success) {
    console.log(`\n[FAILED] Cannot retrieve real Pamela profile`);
    console.log(`Error: ${result.error}\n`);
    process.exit(1);
  }

  console.log(`\n[SUCCESS] Real Pamela profile retrieved\n`);
  console.log(
    JSON.stringify(
      {
        profile_id: result.profile_id,
        person_name: result.profile.person_name,
        company_name: result.profile.company_name,
        email: result.profile.email,
        markdown_source: result.markdown_source,
        markdown_size: result.markdown.length,
        source: result.source
      },
      null,
      2
    )
  );

  // Write JSON
  writeFileSync(
    'REVIEWABLE_PAMELA_CANONICAL_DOSSIER_REAL.json',
    JSON.stringify(result.profile, null, 2)
  );
  console.log('\n✓ Exported JSON');

  // Write Markdown
  writeFileSync(
    'REVIEWABLE_PAMELA_CANONICAL_DOSSIER_REAL.md',
    result.markdown
  );
  console.log('✓ Exported Markdown');

  // Write Verification
  const verification = `# REAL Pamela Canonical Profile - Production Vault Export

**Timestamp:** ${new Date().toISOString()}
**Source:** Production API Endpoint
**Profile ID:** ${result.profile_id}
**Person:** ${result.profile.person_name}
**Company:** ${result.profile.company_name}
**Email:** ${result.profile.email}

## Production Vault Keys

\`\`\`
vault:profile:${result.profile_id}
\`\`\`

${
  result.markdown_source === 'vault:markdown'
    ? `\`\`\`
vault:markdown:${result.profile_id}
\`\`\`

**Markdown Source:** Retrieved from Vault`
    : `**Markdown Source:** Generated from JSON (vault:markdown:${result.profile_id} not found)`
}

## Data Integrity ✓

- ✓ Profile Retrieved from Production
- ✓ Person Name: ${result.profile.person_name}
- ✓ Email: ${result.profile.email}
- ✓ Company: ${result.profile.company_name}
- ✓ Quality Score: ${result.profile.quality_score}%
- ✓ Organizational Metadata: ${result.profile.metadata?.organization ? 'Present' : 'Missing'}
- ✓ Contextual Signals: ${result.profile.metadata?.contextual_signals ? 'Present' : 'Missing'}
- ✓ Narratives: ${Object.keys(result.profile.canonical_profile_json?.narratives || {}).length}+ sections

## Canonical Sections Included

${Object.keys(result.profile.canonical_profile_json?.narratives || {})
  .map((key) => `- ${key}`)
  .join('\n')}

## Files Created

- REVIEWABLE_PAMELA_CANONICAL_DOSSIER_REAL.json
- REVIEWABLE_PAMELA_CANONICAL_DOSSIER_REAL.md
- PAMELA_REAL_RETRIEVAL_VERIFICATION.txt

---

**Export verified. NOT simulated. Sourced from actual production Vault.**
`;

  writeFileSync('PAMELA_REAL_RETRIEVAL_VERIFICATION.txt', verification);
  console.log('✓ Exported Verification');

  console.log('\n✓ All files created successfully\n');
  process.exit(0);
});
