# Page 0A Vault Indexing Strategy

## Overview
Page 0A (Organizational Context) metadata is stored in the Vault alongside canonical profiles.
This document describes the indexing structure for organizational metadata retrieval.

## Indexes Created on Profile Save

When a profile with organizational metadata is saved to Vault, the following indexes are created:

### Primary Indexes (Existing)
- `vault:index:date:{YYYY-MM-DD}` — Profiles created on that date
- `vault:index:email:{email}` — Profiles for an email address
- `vault:index:company:{company_slug}` — Profiles for a company

### Organizational Context Indexes (New)
- `vault:index:department:{department_slug}` — Profiles by department
  - Example: `vault:index:department:sales`, `vault:index:department:operations`

- `vault:index:role:{role_slug}` — Profiles by role title
  - Example: `vault:index:role:vp-of-sales`, `vault:index:role:team-lead`

- `vault:index:manager:{manager_slug}` — Profiles by manager/reports-to
  - Example: `vault:index:manager:ceo`, `vault:index:manager:john-smith`

- `vault:index:industry:{industry_slug}` — Profiles by industry
  - Example: `vault:index:industry:real-estate`, `vault:index:industry:technology`

- `vault:index:org_context:{context_slug}` — Profiles by organizational role
  - Example: `vault:index:org_context:individual-contributor`
  - Example: `vault:index:org_context:executive-c-suite`
  - Example: `vault:index:org_context:founder-owner`

## Implementation Code (Insert into saveCanonicalProfile.js)

```javascript
// Add organizational context indexes
if (metadata?.organizational_context) {
  const orgContext = metadata.organizational_context;
  
  // Department index
  if (orgContext.department) {
    const dept_slug = orgContext.department
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 64);
    const dept_key = `vault:index:department:${dept_slug}`;
    await redis.sadd(dept_key, profile_id);
  }
  
  // Role index
  if (orgContext.role_title) {
    const role_slug = orgContext.role_title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 64);
    const role_key = `vault:index:role:${role_slug}`;
    await redis.sadd(role_key, profile_id);
  }
  
  // Manager index
  if (orgContext.reports_to) {
    const manager_slug = orgContext.reports_to
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 64);
    const manager_key = `vault:index:manager:${manager_slug}`;
    await redis.sadd(manager_key, profile_id);
  }
  
  // Industry index
  if (orgContext.industry) {
    const industry_slug = orgContext.industry
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 64);
    const industry_key = `vault:index:industry:${industry_slug}`;
    await redis.sadd(industry_key, profile_id);
  }
  
  // Org context multi-select index
  if (Array.isArray(orgContext.org_context)) {
    orgContext.org_context.forEach(context => {
      const ctx_slug = context
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 64);
      const ctx_key = `vault:index:org_context:${ctx_slug}`;
      redis.sadd(ctx_key, profile_id);
    });
  }
}
```

## Query Examples

```javascript
// Get all profiles for a department
const dept_profiles = await redis.smembers('vault:index:department:sales');

// Get all profiles for a specific role
const role_profiles = await redis.smembers('vault:index:role:vp-of-sales');

// Get all profiles managed by a specific person
const manager_profiles = await redis.smembers('vault:index:manager:ceo');

// Get all profiles in an industry
const industry_profiles = await redis.smembers('vault:index:industry:real-estate');

// Get all profiles with a specific org context
const executive_profiles = await redis.smembers('vault:index:org_context:executive-c-suite');
```

## Status

This indexing strategy is DESIGNED BUT NOT YET IMPLEMENTED.

To enable, insert the code block above into `api/engine/vault/saveCanonicalProfile.js`
after the company index block (after line ~140).

## Future Enhancements

- Compound indexes: `vault:index:company_department:{company}:{department}`
- Time-based rollups: `vault:index:industry:monthly:{industry}:{YYYY-MM}`
- Analytics: `vault:metadata:department_count:{department}` — counter per department
