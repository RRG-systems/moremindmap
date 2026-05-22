# LIVE JOB INSPECTION DIAGNOSTIC REPORT

**Created:** Thu May 21, 2026 21:12 MST  
**Purpose:** Production-safe job inspection diagnostics for debugging live assessments  
**Status:** ✅ IMPLEMENTATION COMPLETE

---

## 1. JOB KEY STRUCTURE

**Pattern:** `job:{uuid}`

**Example:** `job:550e8400-e29b-41d4-a716-446655440000`

**Storage:** Redis with 24-hour TTL (86400 seconds)

**Type:** JSON object (serialized by ioredis)

**Fields in Job:**
- `job_id` - UUID
- `status` - queued/processing/complete/failed
- `stage` - RECEIVED, FIRST_PASS_GENERATION, CANONICAL_GENERATION, FIRST_INJECTION, etc.
- `created_at` - ISO timestamp
- `updated_at` - ISO timestamp
- `payload` - Contains answers + metadata (email, person_name, company_name)
- `profileInput` - Built from answers
- `reportContent` - Generated report text
- `result_html` - Final HTML output
- `error` - Error message if failed
- `canonical_diagnostics` - NEW: Canonical generation diagnostics
- `diagnostics` - Stage trace and other diagnostics

---

## 2. RECENT JOB INDEX

**Index key:** `jobs:recent`

**Type:** Redis LIST (LPUSH order)

**Retention:** Last 50 jobs (trimmed via LTRIM)

**When added:** When job is created in `createJob()`

**Purpose:** Enables efficient recent job listing for diagnostics

**Previous state:** No index existed

**New state:** ✅ Index created and maintained automatically

---

## 3. CANONICAL DIAGNOSTICS STRUCTURE

**Added to:** Job object when canonical stage executes

**Fields:**
```json
{
  "attempted": bool,
  "success": bool,
  "error": string|null,
  "profile_id": string|null,
  "vault_save_attempted": bool,
  "vault_save_success": bool,
  "vault_save_error": string|null,
  "timestamp": ISO-8601 string
}
```

**Example (success):**
```json
{
  "attempted": true,
  "success": true,
  "error": null,
  "profile_id": "MM-20260521-xxxxxxxx",
  "vault_save_attempted": true,
  "vault_save_success": true,
  "vault_save_error": null,
  "timestamp": "2026-05-21T21:07:32.000Z"
}
```

**Example (vault save failed):**
```json
{
  "attempted": true,
  "success": false,
  "error": "Vault save failed: Redis connection timeout",
  "profile_id": null,
  "vault_save_attempted": true,
  "vault_save_success": false,
  "vault_save_error": "Redis connection timeout",
  "timestamp": "2026-05-21T21:07:35.000Z"
}
```

---

## 4. DIAGNOSTIC ENDPOINT

**Path:** `GET /api/diagnostic/list-recent-jobs?limit=10`

**File:** `api/diagnostic/list-recent-jobs.js`

**Response format:**
```json
{
  "ok": true,
  "environment": "production",
  "redis_visible": true,
  "recent_jobs_index_found": true,
  "total_jobs_found": 10,
  "timestamp": "2026-05-21T21:12:00.000Z",
  "jobs": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2026-05-21T21:07:00.000Z",
      "updated_at": "2026-05-21T21:07:45.000Z",
      "status": "complete",
      "stage": "complete",
      "current_stage": "complete",
      "completed": true,
      "error_present": false,
      "error_summary": null,
      "metadata_present": true,
      "person_name_present": true,
      "email_present": true,
      "email_masked": "da***@example.com",
      "answer_count": 28,
      "written_answer_count": 12,
      "canonical_generation_attempted": true,
      "canonical_generation_success": true,
      "canonical_generation_error_summary": null,
      "canonical_profile_id": "MM-20260521-xxxxxxxx",
      "vault_save_attempted": true,
      "vault_save_success": true,
      "vault_save_error_summary": null,
      "has_report_content": true,
      "has_result_html": true,
      "has_pdf_or_output": true
    }
  ]
}
```

**Security features:**
- ✅ Emails are masked (da***@example.com)
- ✅ No full answers exposed
- ✅ No full person names (boolean only)
- ✅ No secrets or API keys
- ✅ No Redis URLs or credentials
- ✅ Error messages truncated to 100 chars
- ✅ No full canonical dossiers
- ✅ No OpenAI API usage details

---

## 5. VISIBILITY IMPROVEMENTS

### Before

- ❌ No way to inspect recent jobs
- ❌ Cannot see metadata transmission
- ❌ Cannot see canonical stage execution
- ❌ Cannot see Vault save attempts
- ❌ No job indexing by recency
- ❌ Blind to pipeline execution

### After

- ✅ Can list 50 most recent jobs
- ✅ Can see if metadata reached backend
- ✅ Can see if canonical stage attempted/succeeded
- ✅ Can see if Vault save attempted/succeeded
- ✅ Can see exact error at each step
- ✅ Can diagnose live assessment failures

---

## 6. NEXT TEST PROCEDURE

**After deployment:**

1. **Call endpoint:**
   ```
   GET https://moremindmap.com/api/diagnostic/list-recent-jobs?limit=10
   ```

2. **Expected response if no jobs:**
   ```json
   {
     "ok": true,
     "recent_jobs_index_found": false,
     "total_jobs_found": 0,
     "jobs": []
   }
   ```

3. **Submit NEW assessment:**
   - Name: test-assessment-2026-05-21
   - Email: test@example.com
   - Complete all 28 questions

4. **Wait 10-30 seconds for job completion**

5. **Call endpoint again:**
   ```
   GET https://moremindmap.com/api/diagnostic/list-recent-jobs?limit=10
   ```

6. **Expected response if job complete:**
   - `total_jobs_found: 1`
   - `jobs[0].status: "complete"`
   - `jobs[0].canonical_generation_attempted: true`
   - `jobs[0].canonical_generation_success: true`
   - `jobs[0].vault_save_success: true`
   - `jobs[0].canonical_profile_id: "MM-20260521-..."`

7. **If canonical or vault save failed:**
   - Check `canonical_generation_error_summary`
   - Check `vault_save_error_summary`
   - Determine exact failure point

---

## 7. FILES CREATED/MODIFIED

### Created

1. **`api/diagnostic/list-recent-jobs.js`** (5KB)
   - New diagnostic endpoint
   - Lists 50 most recent jobs
   - Masks sensitive data
   - Shows canonical/vault diagnostics

### Modified

1. **`api/engine/miniV2JobManager.js`** (2 changes)
   - Added `canonical_diagnostics` to job initialization
   - Added `jobs:recent` index maintenance in `createJob()`
   - Imports `redis` function for list operations

2. **`api/engine/redisClient.js`** (1 change)
   - Added `redis()` export for direct client access

3. **`api/engine/canonical/executeCanonicalGeneration.js`** (2 changes)
   - Updated canonical_diagnostics object with standard fields (attempted, success, error, profile_id)
   - Set profile_id in diagnostics after successful save
   - Set error field in diagnostics on failure

---

## 8. DEPLOYMENT IMPACT

**Safety:** 🟢 Very low risk

**Reason:**
- ✅ No changes to assessment flow
- ✅ No changes to canonical logic
- ✅ No changes to Vault architecture
- ✅ No changes to renderer/templates
- ✅ New diagnostic fields are additive only
- ✅ Fallback preserved (no new failures)
- ✅ Index maintenance fails silently if Redis unavailable
- ✅ Endpoint read-only (no mutations)

**Breaking changes:** 0

**API changes:** 1 new endpoint (backward compatible)

**Performance impact:** Negligible
- List operations on `jobs:recent` are O(n) where n ≤ 50
- Minimal memory overhead per job

---

## 9. DEBUGGING WORKFLOW

**To debug why David's assessments aren't in Vault:**

1. Deploy this code
2. Wait for new assessment submission
3. Call `/api/diagnostic/list-recent-jobs?limit=1`
4. Inspect the response:

**If `canonical_generation_attempted: false`:**
→ Assessment didn't reach canonical stage (stuck in FIRST_PASS_GENERATION)

**If `canonical_generation_attempted: true` and `canonical_generation_success: false`:**
→ Canonical generation threw error (see canonical_generation_error_summary)

**If `vault_save_attempted: false`:**
→ Canonical stage never called saveCanonicalProfile

**If `vault_save_attempted: true` and `vault_save_success: false`:**
→ Vault save failed (see vault_save_error_summary)

**If `email_present: false`:**
→ Frontend not sending email (metadata transmission failure)

**If `metadata_present: false`:**
→ Backend not receiving metadata payload

---

## 10. NEXT STEPS

1. ✅ Code complete
2. ⏳ Deploy to production
3. ⏳ Test endpoint with new assessment
4. ⏳ Identify exact failure point
5. ⏳ Fix root cause (if any identified)

---

**STATUS: Ready for deployment and live assessment testing.**
