
## ORGANIZATION / COMPANY IDENTITY

### Company Name vs Profile ID

**Design Decision: Company name is METADATA, not embedded in profile_id**

**Profile ID format remains:** `MM-YYYYMMDD-XXXXXXXX`

**Why:**
- Profile_id is individual-scoped, not organization-scoped
- One person may have profiles from multiple companies
- Company affiliation can change (acquisition, job change)
- Profile_id should be permanent and immutable
- Company is contextual metadata, not identity

### Company Slug Generation

**Function:** `generateCompanySlug(companyName)`

**Rules:**
1. Lowercase
2. Replace spaces and special characters with hyphens
3. Trim leading/trailing hyphens
4. Max 64 characters

**Examples:**
- "Acme Corp" → "acme-corp"
- "Revenue & Growth Solutions, LLC" → "revenue-growth-solutions-llc"
- "ACME-123" → "acme-123"

### Company Index

**Redis key:** `vault:index:company:{company_slug}`

**Contents:** Set of profile_ids associated with that company

**Use cases:**
- List all assessments for a company
- Aggregate company intelligence
- Team composition analysis
- Organizational health tracking

### Organization Search Strategy

**By company slug:**
```javascript
const profiles = await listProfilesByCompany("acme-corp")
// Returns all profile_ids for Acme Corp
```

**By date + company:**
```javascript
const date_profiles = await listProfilesByDate("2026-05-21")
const company_profiles = await listProfilesByCompany("acme-corp")
const intersection = date_profiles.profile_ids.filter(id => 
  company_profiles.profile_ids.includes(id)
)
// Returns profiles for Acme Corp created on 2026-05-21
```

**Aggregate company intelligence:**
```javascript
const company_profiles = await listProfilesByCompany("acme-corp")
const full_profiles = await getCanonicalProfiles(company_profiles.profile_ids)

// Aggregate vector scores, patterns, etc.
const avg_vector = full_profiles.reduce((sum, p) => 
  sum + p.vector_scores.vector, 0
) / full_profiles.length
```

**Why company indexing matters:**
- B2B use case: Organizations buy assessments for entire teams
- Leadership development: Track org-wide leadership capacity
- Talent strategy: Identify patterns across company
- Recruiting intelligence: Company culture insights
- M&A due diligence: Assess leadership bench

---

