# VAULT V1 ARCHITECTURE

**Created:** Thu May 21, 2026 15:42 MST  
**Purpose:** Permanent canonical profile storage system  
**Backend:** Redis (Vercel Redis in production)

---

## PROFILE ID FORMAT

**Pattern:** `MM-YYYYMMDD-XXXXXXXX`

**Components:**
- `MM` — MoreMindMap prefix
- `YYYYMMDD` — Creation date (ISO 8601 compact)
- `XXXXXXXX` — 8-character random alphanumeric ID (lowercase)

**Examples:**
- `MM-20260521-gknmgkf5`
- `MM-20260521-7lcrdttl`
- `MM-20260521-a3f9k2x7`

**Validation:**
- Must match regex: `^MM-\d{8}-[a-z0-9]{8}$`
- Date part must be valid YYYYMMDD
- Random part must be exactly 8 lowercase alphanumeric characters

**Generation:**
- Uses `crypto.randomBytes()` for random component
- Guaranteed unique with >99.999% probability (36^8 = 2.8 trillion combinations per day)

---

## REDIS KEY STRUCTURE

### Primary Storage

**Profile Data:**
```
vault:profile:{profile_id} → Full vault record (JSON)
```

**Markdown Cache:**
```
vault:markdown:{profile_id} → Canonical markdown dossier (text)
```

### Indexes

**Date Index:**
```
vault:index:date:{YYYY-MM-DD} → Set of profile_ids created that day
```

**Email Index:**
```
vault:index:email:{email_lowercase} → Set of profile_ids for that email
```

### Metadata

**Total Count:**
```
vault:metadata:count → Total number of profiles stored
```

---

## VAULT RECORD STRUCTURE

**Stored in:** `vault:profile:{profile_id}`

```json
{
  "profile_id": "MM-20260521-gknmgkf5",
  "job_id": "test_canonical_20260521",
  "person_name": "John Doe",
  "email": "john@example.com",
  "created_at": "2026-05-21T22:40:54.615Z",
  "assessment_version": "mini-v2",
  "model": "canonical-v1-frontier",
  "canonical_profile_json": { ... },
  "vector_scores": {
    "vector": 7.2,
    "signal": 2.1,
    ...
  },
  "profile_signature": "f2ef73f2fa3508f1",
  "intake_answers": [ ... ],
  "quality_score": 93,
  "metadata": {
    "test_run": false,
    "source": "production",
    "vault_version": "1.0.0",
    "saved_by": "vault-v1"
  }
}
```

**Field Descriptions:**

- **profile_id** (string, required) — Permanent unique identifier
- **job_id** (string, nullable) — Assessment job ID if available
- **person_name** (string, nullable) — Subject name
- **email** (string, nullable) — Subject email (used for email index)
- **created_at** (ISO string, required) — UTC timestamp
- **assessment_version** (string) — Assessment format version (e.g., "mini-v2")
- **model** (string) — Canonical engine version (e.g., "canonical-v1-frontier")
- **canonical_profile_json** (object, required) — Full canonical profile object
- **vector_scores** (object) — Extracted dimension scores
- **profile_signature** (string, 16 chars) — SHA-256 hash of vector scores (first 16 hex chars)
- **intake_answers** (array, nullable) — Raw intake responses if available
- **quality_score** (number, nullable) — Dossier quality score (0-100)
- **metadata** (object) — Additional metadata (vault version, source, flags)

---

## PROFILE SIGNATURE

**Purpose:** Fingerprint vector scores for quick comparison/deduplication

**Generation:**
1. Sort vector_scores keys alphabetically
2. JSON.stringify() sorted object
3. SHA-256 hash
4. Take first 16 hex characters

**Example:**
```javascript
const vector_scores = {
  vector: 7.2,
  signal: 2.1,
  fidelity: 8.3,
  velocity: 6.5,
  leverage: 4.2,
  flex: 5.8,
  framework: 3.9,
  horizon: 6.1
};

// Signature: "f2ef73f2fa3508f1"
```

**Deterministic:** Same scores always produce same signature

**Use Cases:**
- Quick duplicate detection
- Profile similarity search
- Change detection (re-assessment comparison)

---

## API MODULES

### generateProfileId.js

**Exports:**
- `generateProfileId()` — Generate new profile ID
- `isValidProfileId(profileId)` — Validate format
- `extractDateFromProfileId(profileId)` — Extract YYYY-MM-DD date

### saveCanonicalProfile.js

**Exports:**
- `saveCanonicalProfile(options)` — Save full canonical profile
  - Returns: `{ profile_id, profile_signature, created_at, vault_key, success }`
- `saveCanonicalMarkdown(profile_id, markdown_content)` — Save markdown separately
  - Returns: `{ profile_id, markdown_key, markdown_size, success }`

**What it does:**
1. Generate permanent profile_id
2. Create vault record with all metadata
3. Save to `vault:profile:{profile_id}`
4. Add profile_id to date index
5. Add profile_id to email index (if email provided)
6. Increment total count

### getCanonicalProfile.js

**Exports:**
- `getCanonicalProfile(profile_id)` — Retrieve full profile
- `getCanonicalMarkdown(profile_id)` — Retrieve markdown only
- `profileExists(profile_id)` — Check existence
- `getCanonicalProfiles(profile_ids)` — Batch retrieve

### listCanonicalProfiles.js

**Exports:**
- `listProfilesByDate(date)` — List all profiles created on date (YYYY-MM-DD)
- `listProfilesByEmail(email)` — List all profiles for email
- `getVaultStats()` — Get total counts and date range
- `listRecentProfiles(limit)` — List N most recent profiles
- `searchProfilesByName(name_query)` — Case-insensitive name search

---

## USAGE EXAMPLES

### Save Profile

```javascript
import { saveCanonicalProfile, saveCanonicalMarkdown } from './api/engine/vault/saveCanonicalProfile.js';

const result = await saveCanonicalProfile({
  canonical_profile: canonical_json,
  job_id: 'abc123',
  person_name: 'Jane Smith',
  email: 'jane@example.com',
  assessment_version: 'mini-v2',
  model: 'canonical-v1-frontier',
  quality_score: 93,
  metadata: {
    source: 'production',
    custom_field: 'value'
  }
});

console.log(result.profile_id); // MM-20260521-gknmgkf5

await saveCanonicalMarkdown(result.profile_id, markdown_content);
```

### Retrieve Profile

```javascript
import { getCanonicalProfile, getCanonicalMarkdown } from './api/engine/vault/getCanonicalProfile.js';

const profile = await getCanonicalProfile('MM-20260521-gknmgkf5');

if (profile.found) {
  console.log(profile.person_name);
  console.log(profile.quality_score);
  console.log(profile.canonical_profile_json);
}

const md = await getCanonicalMarkdown('MM-20260521-gknmgkf5');
console.log(md.markdown);
```

### List Profiles

```javascript
import { listProfilesByDate, getVaultStats, listRecentProfiles } from './api/engine/vault/listCanonicalProfiles.js';

// List by date
const today_profiles = await listProfilesByDate('2026-05-21');
console.log(today_profiles.profile_ids);

// Get stats
const stats = await getVaultStats();
console.log(stats.total_profiles);
console.log(stats.earliest_date);

// Recent profiles
const recent = await listRecentProfiles(10);
recent.profiles.forEach(p => {
  console.log(`${p.profile_id}: ${p.person_name} (${p.quality_score})`);
});
```

---

## PRODUCTION DEPLOYMENT

### Vercel Redis

**Already configured in production environment:**
- `REDIS_URL` environment variable set
- Vercel Redis instance active
- No additional setup required

**Vault will work automatically in production**

### Local Development

**For local Redis testing:**
```bash
# Install Redis
brew install redis

# Start Redis
redis-server

# Set environment variable
export REDIS_URL="redis://localhost:6379"

# Run tests
node scripts/testVaultSave.js
```

**For structure-only testing (no Redis):**
```bash
node scripts/testVaultStructure.js
```

---

## CAPACITY

### Redis Memory Estimation

**Per profile:**
- Vault record (JSON): ~27KB average
- Markdown cache: ~26KB average
- **Total per profile: ~53KB**

**Capacity examples:**
- 100MB Redis → ~1,900 profiles
- 500MB Redis → ~9,400 profiles
- 1GB Redis → ~18,800 profiles

**Vercel Redis (Hobby):** 256MB → ~4,800 profiles

### Scaling Strategy

**Phase 1 (Current):** All profiles in Redis
**Phase 2 (>5K profiles):** Move old profiles to S3, keep recent in Redis
**Phase 3 (>50K profiles):** Redis = hot cache, Postgres = permanent storage, S3 = cold storage

---

## SECURITY

### Data Sensitivity

**Profile contains:**
- Behavioral intelligence (sensitive)
- Psychological patterns (sensitive)
- Personal information (PII)

**Protection:**
- Redis connection encrypted (TLS)
- Vercel Redis private network
- No public Redis access
- Access restricted to backend only

### PII Handling

**Email indexing:**
- Stored lowercase for case-insensitive lookup
- Indexed for multi-profile retrieval
- Not exposed in public APIs

**Name storage:**
- Optional field (can be null)
- Used for search/display only
- Not required for vault operation

---

## TESTING

### Structure Test (No Redis)

**File:** `scripts/testVaultStructure.js`

**Tests:**
- Profile ID generation (5 samples)
- Profile ID validation (7 test cases)
- Date extraction
- Profile signature generation (deterministic)
- Vault record structure
- Redis key structure (logical)

**Run:**
```bash
node scripts/testVaultStructure.js
```

### Full Integration Test (Requires Redis)

**File:** `scripts/testVaultSave.js`

**Tests:**
- Save profile to Redis
- Save markdown to Redis
- Retrieve profile
- Retrieve markdown
- List by date
- Get vault stats
- List recent profiles
- Redis key inspection

**Run:**
```bash
export REDIS_URL="redis://localhost:6379"
node scripts/testVaultSave.js
```

---

## FUTURE ENHANCEMENTS

### Phase 2 (After Production Validation)

1. **S3 Cold Storage**
   - Archive old profiles to S3 after 90 days
   - Keep metadata in Redis, full JSON in S3
   - On-demand hydration

2. **Profile Versioning**
   - Track re-assessments
   - Store delta/changelog
   - Compare v1 vs v2

3. **Advanced Search**
   - Search by vector score ranges
   - Similarity search (profile signature clustering)
   - Contradiction pattern search

4. **Analytics**
   - Profile quality distribution
   - Most common patterns
   - Temporal trends

5. **Export Formats**
   - PDF generation on-demand
   - CSV export for bulk analysis
   - API for external integrations

---

## MIGRATION NOTES

### From Job System to Vault

**Old:** Profiles tied to job_id, ephemeral  
**New:** Profiles have permanent profile_id, indexed, searchable

**Migration path:**
1. Generate profile_id for existing jobs
2. Copy canonical_profile_json to Vault
3. Create indexes (date, email)
4. Maintain backward compatibility (job_id still stored)

**No breaking changes:** Vault is additive storage layer

---

## STATUS

**Version:** 1.0.0  
**Status:** ✅ Structure validated, ready for production integration  
**Redis Requirement:** Vercel Redis (already configured in production)  
**Test Coverage:** Structure tests passing, integration tests ready (require Redis)

**Next Step:** Wire Vault into canonical generation pipeline (save after generation)

---

**END OF VAULT V1 ARCHITECTURE**
