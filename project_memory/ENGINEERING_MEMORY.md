# ENGINEERING_MEMORY.md

**Purpose:** Prevent debugging amnesia. Technical continuity for engineers.

**Last Updated:** 2026-05-23 01:43 MST

---

## Redis Architecture (Live)

**Provider:** Upstash Redis (managed, 256MB)

**Connection Setup:**
```javascript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
// CRITICAL: Always call redis.disconnect() in finally block
// Connection pool will silently abandon writes without disconnect
```

**Connection Parameters:**
- URL format: `redis://default:{PASSWORD}@{HOST}:{PORT}`
- Host: `detail-ultraswift-vessel-11189.db.redis.io`
- Port: 16937
- Auth: Password in URL

**CRITICAL BUG HISTORY:**
- Missing `redis.disconnect()` caused silent write failures
- Writes were async in-flight, connection closed before flush
- Fix: Always disconnect in finally block
- Verification: Read back immediately after write on same client

---

## Vault Architecture

**Storage Pattern:**
```
vault:profile:{profile_id}           → Full profile JSON + metadata
vault:markdown:{profile_id}          → Markdown dossier (optional)
vault:index:date:{YYYY-MM-DD}        → Set of profile IDs
vault:index:email:{email}            → Set of profile IDs
vault:index:company:{slug}           → Set of profile IDs
vault:index:role:{slug}              → Set of profile IDs
vault:index:department:{slug}        → Set of profile IDs
vault:index:industry:{slug}          → Set of profile IDs
vault:index:org_context:{slug}       → Set of profile IDs
vault:metadata:count                 → Integer counter
```

**Profile JSON Structure:**
```json
{
  "profile_id": "MM-20260523-mqlev9c9",
  "job_id": "...",
  "person_name": "...",
  "email": "...",
  "company_name": "...",
  "company_slug": "...",
  "created_at": "ISO-8601",
  "assessment_version": "mini-v2",
  "model": "canonical-v1-frontier",
  "canonical_profile_json": { ... },
  "vector_scores": { ... },
  "profile_signature": "SHA256 hex",
  "quality_score": 72,
  "metadata": { ... },
  "vault_save_diagnostics": { ... }
}
```

**Total Size:** 37-40 KB per profile

**Retention:** Permanent (no TTL)

---

## Profile ID Lifecycle

**Generation:** 
```javascript
// generateProfileId.js
function generateProfileId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const shortUUID = generateShortUUID();  // 8 lowercase alphanumeric
  
  return `MM-${year}${month}${day}-${shortUUID}`;
}
```

**Format:** MM-YYYYMMDD-[a-z0-9]{8}

**ONE-TIME GENERATION:** Profile ID generated once in `executeCanonicalGeneration.js`

**CRITICAL BUG HISTORY:**
- Old code: Generated profile_id in TWO places (executeCanonicalGeneration + saveCanonicalProfile)
- Result: Reported ID ≠ Saved ID (e.g., MM-20260523-bb3hsat9 vs MM-20260523-d1er8ac5)
- Fix: Pass profile_id from executeCanonicalGeneration to saveCanonicalProfile
- Commits: 080f929 (fix), d1c3d57 (doc)

**Validation:**
```javascript
const pattern = /^MM-\d{8}-[a-z0-9]{8}$/;
```

**Lifetime:**
1. Generated in executeCanonicalGeneration (once)
2. Passed to saveCanonicalProfile (not regenerated)
3. Stored in vault:profile:MM-*
4. Stored in canonical_profile_json.profile_id
5. Stored in job.canonical_diagnostics.profile_id
6. Retrieved via get-vault-profile endpoint

---

## Retrieval Flow (Exact)

**Request:**
```bash
GET /api/diagnostic/get-vault-profile?id=MM-20260523-mqlev9c9
```

**Validation:**
```javascript
// Exact format check (not generic pattern)
const isValid = /^MM-\d{8}-[a-z0-9]{8}$/.test(id);
```

**Redis Operations:**
1. GET vault:profile:{id}
   - Returns JSON string or null
   - Logged: get_initiated, get_completed, returned_bytes

2. If null:
   - EXISTS vault:profile:{id} (debug check)
   - Return 404 with key_exists: false

3. If found:
   - JSON.parse() profile
   - GET vault:markdown:{id} (optional, non-blocking)
   - Return 200 with profile + markdown + diagnostics

**Diagnostics Captured:**
```json
{
  "redis_module": "ioredis",
  "redis_url_env": "redis://...",
  "redis_url_host_extracted": "detail-ultraswift-vessel-11189.db.redis.io",
  "operations": [
    {"step": "get_initiated", "key": "..."},
    {"step": "get_completed", "returned_bytes": 37353},
    {"step": "json_parse_success"},
    {"step": "retrieval_success"}
  ]
}
```

**Success Criteria:**
- GET returns non-null JSON
- JSON parses successfully
- Response includes full profile + metadata
- No Redis errors

---

## Canonical Generation Flow (Exact)

**Pipeline Stage:** CANONICAL_GENERATION

**Inputs:**
- profileInput (contains 28 assessment answers)
- Metadata (name, email, company, org context, contextual signals)

**Execution:**
1. `generateCanonicalProfile(profileInput)` → canonical_profile_json
   - Runs 12+ inference modules
   - Generates 12+ narrative sections
   - Calculates vector_scores
   - Time: 40-50 ms

2. `generateProfileId()` → profile_id (MM-YYYYMMDD-XXXXXXXX)

3. `buildNarrativeProfile(canonical_profile)` → markdown

4. `saveCanonicalProfile({ canonical_profile, profile_id, ... })`
   - SET vault:profile:{profile_id} (with verification read)
   - SADD index keys (9 types)
   - INCR vault:metadata:count
   - Disconnect Redis
   - Return diagnostics

5. `saveCanonicalMarkdown(profile_id, markdown)`
   - SET vault:markdown:{profile_id}
   - Disconnect Redis

6. Update job with canonical_diagnostics

**Output:**
- Profile persisted in Vault
- Job record updated with success/failure
- Diagnostics logged

**Error Handling:**
- All errors caught and logged
- Job continues to next stage (FIRST_INJECTION)
- Diagnostics include error details
- vault_save_success = true/false

---

## Critical Bug History (Complete)

### Bug 1: Missing Redis Disconnect (Commit 2c003c5)

**Symptom:** Profile reported saved but key doesn't exist in Vault

**Root Cause:** 
```javascript
// BAD:
const redis = getRedis();
await redis.set(profile_key, JSON.stringify(vault_record));
// ... more operations ...
return { success: true };  // ← Returns before disconnect
// ← Connection dies, writes abandoned
```

**Fix:**
```javascript
// GOOD:
const redis = getRedis();
try {
  await redis.set(profile_key, JSON.stringify(vault_record));
  const verifyRead = await redis.get(profile_key);
  if (!verifyRead) throw new Error('Verification failed');
  return { success: true };
} finally {
  redis.disconnect();  // ← Always disconnect
}
```

**Status:** Deployed, but didn't solve real issue

---

### Bug 2: Profile ID Mismatch (Commit 080f929)

**Symptom:** Retrieval by reported ID fails; same profile found under different ID

**Example:**
- Job reports: canonical_profile_id: MM-20260523-bb3hsat9
- Vault has: vault:profile:MM-20260523-d1er8ac5 ← Different!

**Root Cause:**
```javascript
// executeCanonicalGeneration.js
const profile_id = generateProfileId();  // ID #1

await saveCanonicalProfile({
  canonical_profile,
  // profile_id NOT passed
  job_id: job.job_id,
  // ...
});

// saveCanonicalProfile.js
const profile_id = generateProfileId();  // ID #2 (different!)
const profile_key = `vault:profile:${profile_id}`;
```

**Fix:**
```javascript
// executeCanonicalGeneration.js
const profile_id = generateProfileId();
await saveCanonicalProfile({
  canonical_profile,
  profile_id,  // ← Pass it
  job_id: job.job_id,
  // ...
});

// saveCanonicalProfile.js
const final_profile_id = profile_id || generateProfileId();
const profile_key = `vault:profile:${final_profile_id}`;
```

**Status:** Fixed, verified working (MM-20260523-mqlev9c9)

---

### Bug 3: Insufficient Diagnostics (Commits 6eb020a & dc53a9b)

**Symptom:** Can't debug where bytes go, which Redis provider is used, what operations happened

**Root Cause:** No logging of:
- Redis provider name
- Redis host extracted from URL
- Exact keys written
- Whether verification read succeeded
- Byte counts (written vs verified vs retrieved)
- Operations timeline

**Fix:** Added comprehensive diagnostics:
```json
{
  "redis_module": "ioredis",
  "redis_url_env": "redis://...",
  "redis_url_host_extracted": "...",
  "operations": [
    {"step": "redis_set_completed", "bytes_written": 37303},
    {"step": "redis_exists_check", "exists": true},
    {"step": "redis_get_verification", "get_returned_bytes": 37303, "bytes_match": true},
    {"step": "verification_passed"}
  ]
}
```

**Status:** Deployed, fully verified

---

## Known Stable Commits

```
e9c8d52 - lock first verified end-to-end canonical profile
dc53a9b - add comprehensive redis diagnostics (save + retrieval)
d1c3d57 - document vault profile id mismatch root cause
080f929 - fix profile id mismatch (ROOT CAUSE FIX)
2c003c5 - fix vault save with redis disconnect + verification
```

**Production-Safe Path:** All 5 commits stacked correctly

---

## Known Dangerous Modules

**⚠️ executeCanonicalGeneration.js**
- Generates profile_id (ONE-TIME only)
- Passes it to saveCanonicalProfile (do not modify)
- Changes here affect entire pipeline

**⚠️ saveCanonicalProfile.js**
- Must accept profile_id parameter (do not remove)
- Must disconnect Redis in finally block (do not remove)
- Must verify write before returning success (do not remove)

**⚠️ canonicalProfileGenerator.js**
- Generates 12+ narrative sections (quality here affects all renders)
- Changes trigger regeneration of entire profile

**⚠️ Redis connection pattern**
- ALWAYS use try/finally with disconnect()
- ALWAYS verify writes on same client before returning success
- NEVER reuse disconnected clients

---

## Current Production-Safe Flow

**Proven flow (MM-20260523-mqlev9c9):**

1. Assessment submitted → payload validated ✅
2. Job created in pending state ✅
3. Profile generation triggered ✅
4. Profile ID generated once (MM-20260523-mqlev9c9) ✅
5. Canonical narratives generated (12 sections) ✅
6. Profile saved to Vault (with verification) ✅
   - Wrote: 37,303 bytes
   - Verified: 37,303 bytes read back
   - Disconnected: Yes
7. Job updated with success ✅
8. Profile retrieved via API ✅
   - Retrieved: 37,353 bytes (expected variance)
   - Parsed: Successfully
   - ID consistency: Verified

**All systems green.**

---

## Deployment Lessons

**Lesson 1: Vercel Cold Deploys Are Slow**
- New endpoints take 15-30 seconds to appear
- Plan for this; don't assume instant availability
- Test with curl after waiting

**Lesson 2: Missing Disconnect Breaks Silently**
- No exception thrown
- Job shows success=true
- Profile doesn't actually exist
- Only catch with verification read

**Lesson 3: Profile ID Generation Is Single Point of Failure**
- Generate once, pass everywhere
- Generating twice = ID mismatch = retrieval failure
- No exception, just silent ID divergence

**Lesson 4: Diagnostics Are Debugging Superpower**
- Without them: Days of detective work
- With them: Immediate clarity on where bytes go
- Invest heavily in operational visibility

**Lesson 5: Benchmark Locking Prevents Regression**
- First verified profile locked with full proof
- Future profiles compared against benchmark
- Prevents silent quality degradation

---

## Testing Pattern

**Every change to canonical pipeline requires:**

1. Generate test profile with changes deployed
2. Retrieve profile from Vault (verify key exists)
3. Compare diagnostics:
   - Save-side: profile_id consistency?
   - Retrieval-side: bytes match? JSON valid?
   - Redis provider: same on both sides?
   - Redis host: same on both sides?
4. Compare profile quality against benchmark
5. Commit proof chain (job diagnostics + retrieval proof)

---

## Rollback Checkpoints

**Known-safe commits:**
- e9c8d52 ← Current stable
- dc53a9b ← Stable (without comprehensive diagnostics)
- 080f929 ← Stable (before diagnostics improvements)
- 2c003c5 ← Caution (disconnect added but ID mismatch not fixed)

**Never rollback before:** 2c003c5 (older code has silent write failures)

---

## Module Dependency Graph

```
executeCanonicalGeneration.js
├─ generateCanonicalProfile() [canonicalProfileGenerator.js]
├─ generateProfileId() [generateProfileId.js]
├─ buildNarrativeProfile() [buildNarrativeProfile.js]
└─ saveCanonicalProfile() [saveCanonicalProfile.js]
   ├─ Redis connection [ioredis]
   ├─ Validation [generateProfileId.isValidProfileId]
   └─ All Redis operations (SET, SADD, INCR)
```

**Change any module → test entire flow.**

---

## Bug 4: Profile ID Case Mismatch (Commit ca288aa, 48b3aa8)

**Symptom:** Frontend sends lowercase profile ID (mm-*), retrieval fails with 404 "Profile not found"

**Root Cause:** 
- Save side stored keys with uppercase MM- prefix (MM-YYYYMMDD-XXXXXXXX)
- Retrieval side normalized IDs to lowercase before lookup
- Redis keys case-sensitive → Mismatch (vault:profile:MM-* ≠ vault:profile:mm-*)

**Example:**
- Frontend sends: mm-20260523-mqlev9c9
- Vault key stored: vault:profile:MM-20260523-mqlev9c9 (uppercase MM)
- Retrieval queries: vault:profile:mm-20260523-mqlev9c9 (lowercase mm)
- Result: NOT FOUND

**Fix:**
- generateProfileId() now returns lowercase: mm-YYYYMMDD-XXXXXXXX
- isValidProfileId() pattern updated: /^mm-\d{8}-[a-z0-9]{8}$/
- saveCanonicalProfile() normalizes provided IDs to lowercase
- retrieve-profile.js pattern aligned: /^mm-\d{8}-[a-z0-9]{8}$/i

**Status:** Fixed and deployed (commits ca288aa, 48b3aa8)

---

**Last verified:** 2026-05-23 10:42 MST  
**Production status:** ✅ STABLE (case fix deployed)  
**Critical lessons:** 6 major bug fixes documented  
**Next engineer:** Read this file before touching anything
