# ADMIN GPT RESCORE ENDPOINT - BUILD COMPLETE

**Commit:** c22933d  
**Status:** ✅ READY FOR PRODUCTION  
**Build:** ✅ PASSING (459ms)  

---

## WHAT WAS BUILT

### Endpoint: `POST /api/admin/rescore-profile`

**Purpose:** Refresh GPT-5.5 behavioral rescoring on existing canonical profiles

**File:** `/api/admin/rescore-profile.js` (280 lines)

**Capabilities:**
- ✅ Admin-only (auth required via ADMIN_GPT_RESCORE_SECRET)
- ✅ Retrieves existing canonical from Redis
- ✅ Runs gptBehavioralRescore on full dossier
- ✅ Validates response structure (8 dims, scores, confidence, render_ready)
- ✅ Updates only rescoring_gpt (preserves baseline, V1, all original data)
- ✅ Saves updated canonical back to Redis
- ✅ Returns confirmation with primary dimension, intensity, etc.
- ✅ Feature-flagged (requires GPT_RESCORING_ENABLED=true)
- ✅ Idempotent (safe to call multiple times)

---

## SECURITY

**Authentication:** Bearer token via Authorization header or x-admin-key  
**Secret:** ADMIN_GPT_RESCORE_SECRET env variable  
**Feature Flag:** Must have GPT_RESCORING_ENABLED=true  
**Validation:** Returns 401/403/404/422 appropriately  

**Env Configuration:**
```
Production:   ADMIN_GPT_RESCORE_SECRET=<strong_random_secret>
Development:  ADMIN_GPT_RESCORE_SECRET=dev_secret_12345
```

---

## REQUEST/RESPONSE

### Request

```json
POST /api/admin/rescore-profile
Authorization: Bearer <ADMIN_GPT_RESCORE_SECRET>

{
  "profile_id": "mm-20260526-r8362esx",
  "force": false,
  "debug": false
}
```

### Response (Success - 200)

```json
{
  "success": true,
  "profile_id": "mm-20260526-r8362esx",
  "rescoring_gpt_saved": true,
  "source": "gpt_behavioral_rescore",
  "model": "gpt-5.5",
  "primary_dimension": "signal",
  "secondary_dimension": "vector",
  "dominance_amplitude": "balanced",
  "profile_intensity": "moderate",
  "ranked_count": 8,
  "refreshed_at": "2026-05-27T21:45:00Z",
  "previous_existed": false,
  "render_ready_keys": ["dna_summary", "command_clarity", "speed_vs_fidelity", "strategic_leverage"]
}
```

---

## DATA PRESERVATION

**Protected (Never Overwritten):**
```
canonical.ranked_dimensions          ← Baseline (immutable)
canonical.baseline_ranked_dimensions  ← Baseline copy (immutable)
canonical.rescoring_v1               ← Deterministic layer (immutable)
```

**Updated (Only rescoring_gpt layer):**
```
canonical.rescoring_gpt              ← New GPT behavioral rescoring
canonical.rescoring_gpt_metadata     ← Refresh info + timestamp
canonical.rescoring_gpt_previous     ← Previous value (if existed and small)
```

---

## WORKFLOW

```
Existing Profile (cached in Redis)
    ↓
Admin calls POST /api/admin/rescore-profile
    ↓
Endpoint retrieves canonical from Redis
    ↓
Endpoint calls gptBehavioralRescore(canonical)
    ↓
Endpoint validates output (8 dims, structure, no hallucinations)
    ↓
Endpoint updates canonical.rescoring_gpt only
    ↓
Endpoint saves full canonical back to Redis
    ↓
User retrieves profile normally
    ↓
Renderer uses rescoring_gpt automatically (fallback chain)
    ↓
User sees behavioral rescoring
```

---

## FEATURES

### Already Rescored (No Action Needed)

If profile already has rescoring_gpt and force=false:

```json
{
  "success": true,
  "status": "already_rescored",
  "message": "Profile already has GPT behavioral rescoring. Use force:true to refresh."
}
```

### Force Refresh

With force=true, re-runs GPT even if already rescored:

```json
{
  "profile_id": "mm-20260526-r8362esx",
  "force": true
}
```

### Debug Mode

With debug=true, includes full rescoring_gpt in response:

```json
{
  "...other fields...",
  "debug_rescoring_gpt": {
    "source": "gpt_behavioral_rescore",
    "ranked_dimensions": [...],
    "dominance_profile": {...},
    ...
  }
}
```

---

## VALIDATION

**Pre-Rescoring:**
1. ✅ Authorization header present and valid
2. ✅ Profile ID provided
3. ✅ Profile exists in Redis
4. ✅ GPT_RESCORING_ENABLED=true

**Post-Rescoring:**
1. ✅ 8 dimensions present
2. ✅ No duplicate dimensions
3. ✅ All scores numeric, range [-10, 10]
4. ✅ All confidence [0, 1]
5. ✅ dominance_profile has primary_dimension
6. ✅ render_ready present

**Validation failure:** Returns 422 with error summary, does NOT save

---

## ERROR HANDLING

| Code | Scenario | Response |
|------|----------|----------|
| 400 | Missing profile_id | "profile_id required" |
| 401 | Missing auth header | "Unauthorized - missing authorization header" |
| 401 | Invalid token | "Unauthorized - invalid token" |
| 403 | GPT rescoring disabled | "GPT rescoring is disabled (GPT_RESCORING_ENABLED=false)" |
| 404 | Profile not found | "Profile not found: {id}" |
| 422 | Validation failed | Detailed validation errors |
| 500 | Server error | Error message |

---

## TEST SCRIPT

**File:** `TEST_ADMIN_RESCORE_ENDPOINT.js`

**Usage:**
```bash
# Local testing
node TEST_ADMIN_RESCORE_ENDPOINT.js local

# Production testing (if secret available)
node TEST_ADMIN_RESCORE_ENDPOINT.js production
```

**Tests:**
- David (mm-20260523-mqlev9c9) - extreme vector
- Pamela (mm-20260526-r8362esx) - balanced
- Jonny (mm-20260527-kgppxg8e) - concentrated

---

## LOGGING

**Safe, production-ready logging:**
```
[ADMIN RESCORE] START - Profile: mm-20260526-r8362esx
[ADMIN RESCORE] Canonical found - has rescoring_gpt: false
[ADMIN RESCORE] Running GPT behavioral rescoring...
[ADMIN RESCORE] Validation passed ✅
[ADMIN RESCORE] Saved to Redis ✅
[ADMIN RESCORE] COMPLETE ✅
```

**No private data logged** (no dossier, no answers, no full scores)

---

## USE CASES

1. **Backfill existing profiles:** Run once for all old profiles to add rescoring_gpt
2. **Batch refresh:** Periodically refresh rescoring_gpt (monthly, quarterly)
3. **Testing:** Verify GPT behavior on specific profiles
4. **Troubleshoot:** debug=true includes full rescoring_gpt
5. **Model updates:** When GPT model changes, refresh profiles with force=true
6. **Partial backfill:** Refresh only profiles matching certain criteria

---

## DEPLOYMENT

**Status:** Ready for production deployment

**Env Setup Required:**
```
.env.production:
  ADMIN_GPT_RESCORE_SECRET=<strong_random_secret>
  GPT_RESCORING_ENABLED=true

.env.development:
  ADMIN_GPT_RESCORE_SECRET=dev_secret_12345
  GPT_RESCORING_ENABLED=true
```

**Deployment Steps:**
1. ✅ Code committed
2. ✅ Build passes
3. → Merge to main (auto-deploys to Vercel)
4. → Test locally or in staging
5. → Verify endpoint responds
6. → Backfill existing profiles as needed

---

## REVERSIBILITY

If issues occur:

1. **Stop calling endpoint** → Profiles still render (fallback chain works)
2. **Revert commit** → Endpoint removed
3. **Delete rescoring_gpt manually** → Reset specific profile
4. **Change secret** → Disable endpoint immediately

**No data loss** — Original canonical always preserved

---

## ADMIN WORKFLOW EXAMPLE

### Backfill All Existing Profiles

```bash
#!/bin/bash
ADMIN_SECRET="<secret>"
API_URL="https://moremindmap.com"

# List of profile IDs to refresh
PROFILES=(
  "mm-20260523-mqlev9c9"
  "mm-20260526-r8362esx"
  "mm-20260527-kgppxg8e"
  # ... more profiles
)

for profile_id in "${PROFILES[@]}"; do
  echo "Rescoring: $profile_id"
  curl -X POST "$API_URL/api/admin/rescore-profile" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_SECRET" \
    -d "{\"profile_id\": \"$profile_id\"}"
  sleep 1
done

echo "Backfill complete"
```

---

## SUMMARY

✅ **Admin-only endpoint** for GPT rescore backfill  
✅ **Non-destructive** (preserves baseline, V1)  
✅ **Idempotent** (safe to call multiple times)  
✅ **Validated** (full structure check)  
✅ **Secure** (requires auth, feature-flagged)  
✅ **Logged** (clear, safe logging)  
✅ **Documented** (comprehensive docs + test script)  
✅ **Build passes** (459ms)  
✅ **Ready** for production deployment  

---

## FILES

| File | Purpose |
|------|---------|
| `api/admin/rescore-profile.js` | Endpoint implementation (280 lines) |
| `TEST_ADMIN_RESCORE_ENDPOINT.js` | Test script |
| `ADMIN_GPT_RESCORE_ENDPOINT.md` | Complete documentation (12 KB) |
| `.env.production` | Config with ADMIN_GPT_RESCORE_SECRET |
| `.env.development` | Config with dev secret |

---

**ADMIN ENDPOINT BUILD COMPLETE — READY FOR PRODUCTION DEPLOYMENT**
