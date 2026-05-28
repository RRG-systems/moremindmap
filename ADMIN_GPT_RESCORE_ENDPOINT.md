# ADMIN GPT RESCORE ENDPOINT - COMPREHENSIVE DOCUMENTATION

**Date:** 2026-05-27 21:45 MST  
**Status:** ✅ ENDPOINT COMPLETE  
**Purpose:** Backfill GPT behavioral rescoring on existing canonical profiles

---

## MISSION

GPT behavioral rescoring is a downstream layer.

Existing profiles (generated before GPT flag enabled) need to support GPT rescoring WITHOUT requiring users to retake the assessment.

This endpoint enables backfill/refresh of rescoring_gpt on any existing canonical.

---

## ENDPOINT SPECIFICATION

### Route

```
POST /api/admin/rescore-profile
```

### Authentication

**Required Header:**
```
Authorization: Bearer <ADMIN_GPT_RESCORE_SECRET>
```

**OR:**
```
x-admin-key: <ADMIN_GPT_RESCORE_SECRET>
```

**Env Variable:**
```
ADMIN_GPT_RESCORE_SECRET=<secret>
```

**Security:**
- 401 if header missing
- 401 if token invalid
- 403 if GPT_RESCORING_ENABLED=false
- 500 if secret not configured

---

## REQUEST BODY

```json
{
  "profile_id": "mm-20260526-r8362esx",
  "force": false,
  "debug": false
}
```

### Fields

| Field | Type | Required | Default | Purpose |
|-------|------|----------|---------|---------|
| `profile_id` | string | YES | — | Profile ID to rescore |
| `force` | boolean | NO | false | Force refresh if already rescored |
| `debug` | boolean | NO | false | Include full rescoring_gpt in response |

### Profile ID Formats Supported

```
mm-20260526-r8362esx    (new format, lowercase)
MM-20260523-mqlev9c9    (legacy format, uppercase)
```

Both are normalized to lowercase for Redis key lookup.

---

## RESPONSE - SUCCESS (200)

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
  "spread_type": "distributed",
  "profile_intensity": "moderate",
  "ranked_count": 8,
  "refreshed_at": "2026-05-27T21:45:00.000Z",
  "previous_existed": false,
  "render_ready_keys": ["dna_summary", "command_clarity", "speed_vs_fidelity", "strategic_leverage"]
}
```

### Response Fields

| Field | Type | Purpose |
|-------|------|---------|
| `success` | boolean | Operation succeeded |
| `profile_id` | string | Profile that was rescored |
| `rescoring_gpt_saved` | boolean | rescoring_gpt field was saved to Redis |
| `source` | string | Source of rescoring (always "gpt_behavioral_rescore") |
| `model` | string | GPT model used (always "gpt-5.5") |
| `primary_dimension` | string | Primary system (vector, horizon, velocity, etc.) |
| `secondary_dimension` | string | Secondary system |
| `dominance_amplitude` | string | Amplitude of dominance (concentrated, balanced, flat, extreme) |
| `spread_type` | string | Distribution type (concentrated, distributed, asymmetric) |
| `profile_intensity` | string | Overall intensity (low, moderate, high, extreme) |
| `ranked_count` | number | Count of rescored dimensions (always 8) |
| `refreshed_at` | string | ISO timestamp of refresh |
| `previous_existed` | boolean | Whether rescoring_gpt already existed |
| `render_ready_keys` | array | Keys available in render_ready |

### Debug Mode

Add `"debug": true` to request to include full rescoring_gpt:

```json
{
  ...all fields above...,
  "debug_rescoring_gpt": {
    "source": "gpt_behavioral_rescore",
    "model": "gpt-5.5",
    "ranked_dimensions": [...],
    "dominance_profile": {...},
    "spread_profile": {...},
    "tension_pairs": {...},
    "render_ready": {...},
    "audit": {...}
  }
}
```

---

## RESPONSE - ALREADY RESCORED (200)

If profile already has rescoring_gpt and `force=false`:

```json
{
  "success": true,
  "profile_id": "mm-20260526-r8362esx",
  "status": "already_rescored",
  "message": "Profile already has GPT behavioral rescoring. Use force:true to refresh.",
  "refreshed_at": "2026-05-26T23:48:06.761Z",
  "primary_dimension": "signal"
}
```

---

## ERROR RESPONSES

### 400 - Missing profile_id

```json
{
  "error": "profile_id required"
}
```

### 401 - Missing Authorization

```json
{
  "error": "Unauthorized - missing authorization header"
}
```

### 401 - Invalid Token

```json
{
  "error": "Unauthorized - invalid token"
}
```

### 403 - Feature Disabled

```json
{
  "error": "GPT rescoring is disabled (GPT_RESCORING_ENABLED=false)"
}
```

### 404 - Profile Not Found

```json
{
  "error": "Profile not found: mm-20260526-r8362esx",
  "profile_id": "mm-20260526-r8362esx"
}
```

### 422 - Validation Failed

```json
{
  "error": "GPT rescore validation failed",
  "profile_id": "mm-20260526-r8362esx",
  "validation_errors": [
    "Expected 8 dimensions, got 7",
    "Invalid gpt_rescored_score for vector: NaN"
  ]
}
```

### 500 - Server Error

```json
{
  "error": "Internal server error",
  "message": "Redis connection failed",
  "profile_id": "mm-20260526-r8362esx"
}
```

### 500 - GPT Failed

```json
{
  "error": "GPT rescoring failed - no response",
  "profile_id": "mm-20260526-r8362esx"
}
```

---

## VALIDATION

### Pre-Rescoring Checks

1. ✅ Authorization header present and valid
2. ✅ Feature flag GPT_RESCORING_ENABLED=true
3. ✅ Profile ID provided
4. ✅ Profile exists in Redis

### Post-Rescoring Checks

1. ✅ GPT response received (not null)
2. ✅ Response structure valid (source, model, ranked_dimensions)
3. ✅ Exactly 8 dimensions present
4. ✅ No duplicate dimensions
5. ✅ All dimension names valid (vector, horizon, velocity, leverage, signal, fidelity, flex, framework)
6. ✅ All scores numeric and in range [-10, +10]
7. ✅ All confidence scores in range [0, 1]
8. ✅ dominance_profile present and has primary_dimension
9. ✅ render_ready present

**If any validation fails:** Return 422 with full error summary, DO NOT SAVE

---

## DATA PRESERVATION

### What Is NEVER Overwritten

```
canonical.ranked_dimensions          ← IMMUTABLE baseline
canonical.baseline_ranked_dimensions  ← IMMUTABLE baseline copy
canonical.rescoring_v1               ← IMMUTABLE deterministic layer
canonical.rescoring_v1_previous      ← IMMUTABLE if exists
```

### What IS Updated

```
canonical.rescoring_gpt              ← UPDATED with new GPT result
canonical.rescoring_gpt_metadata     ← ADDED with refresh info
canonical.rescoring_gpt_previous     ← ADDED if previous existed (size < 50KB)
```

### Metadata Structure

```javascript
canonical.rescoring_gpt_metadata = {
  refreshed_at: "2026-05-27T21:45:00.000Z",
  refreshed_by: "admin_rescore_endpoint",
  previous_existed: true,
  profile_id: "mm-20260526-r8362esx"
}
```

---

## REDIS STORAGE

### Profile Key

```
profile_id lowercase → Redis key
"mm-20260526-r8362esx" → stored as "mm-20260526-r8362esx"
"MM-20260523-MQLEV9C9" → stored as "mm-20260523-mqlev9c9"
```

### Entire Canonical Stored

Endpoint stores FULL canonical dossier back to Redis.

**Not** a partial update — entire object is re-serialized and saved.

This ensures consistency and future-proofs against missing fields.

---

## WORKFLOW

### Typical Usage

1. **Admin identifies** old profile needing GPT rescoring
2. **Admin calls** POST /api/admin/rescore-profile
3. **Endpoint retrieves** canonical from Redis
4. **Endpoint calls** gptBehavioralRescore(canonical)
5. **Endpoint validates** response structure
6. **Endpoint updates** canonical.rescoring_gpt
7. **Endpoint saves** entire canonical back to Redis
8. **User retrieves** profile via GET /api/moremindmap/retrieve-profile
9. **Renderer** automatically uses rescoring_gpt layer

### With force=true (Refresh)

```json
{
  "profile_id": "mm-20260526-r8362esx",
  "force": true
}
```

- Ignores previous rescoring_gpt
- Calls GPT again
- Overwrites with new rescoring_gpt
- Saves old value in rescoring_gpt_previous (if size < 50KB)
- Useful for: testing, updating after GPT model changes, fixing bad rescores

---

## TEST COMMANDS

### Local Development

```bash
# Set up env
export ADMIN_GPT_RESCORE_SECRET=dev_secret_12345

# Run test script
node TEST_ADMIN_RESCORE_ENDPOINT.js local

# Or manual curl
curl -X POST http://localhost:3000/api/admin/rescore-profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev_secret_12345" \
  -d '{"profile_id": "mm-20260526-r8362esx"}'
```

### Production

```bash
# Manual curl (requires actual secret)
curl -X POST https://moremindmap.com/api/admin/rescore-profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_GPT_RESCORE_SECRET>" \
  -d '{"profile_id": "mm-20260526-r8362esx"}'

# With debug flag
curl -X POST https://moremindmap.com/api/admin/rescore-profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_GPT_RESCORE_SECRET>" \
  -d '{"profile_id": "mm-20260526-r8362esx", "debug": true}'

# With force refresh
curl -X POST https://moremindmap.com/api/admin/rescore-profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_GPT_RESCORE_SECRET>" \
  -d '{"profile_id": "mm-20260526-r8362esx", "force": true}'
```

---

## TEST PROFILES

### Profile IDs

| Name | Profile ID | Expected Behavior |
|------|-----------|-------------------|
| David | mm-20260523-mqlev9c9 | Extreme vector, suppressed signal |
| Pamela | mm-20260526-r8362esx | Balanced, distributed |
| Jonny | mm-20260527-kgppxg8e | Concentrated vector+velocity |

---

## LOGGING

### Console Logs (Production-safe)

```
[ADMIN RESCORE] START - Profile: mm-20260526-r8362esx, force: false, debug: false
[ADMIN RESCORE] Retrieving canonical for mm-20260526-r8362esx
[ADMIN RESCORE] Canonical found - has rescoring_gpt: false
[ADMIN RESCORE] Running GPT behavioral rescoring...
[ADMIN RESCORE] Validating GPT output...
[ADMIN RESCORE] Validation passed ✅
[ADMIN RESCORE] Saving updated canonical...
[ADMIN RESCORE] Saved to Redis ✅
[ADMIN RESCORE] COMPLETE ✅ - Profile now has rescoring_gpt
```

**No private data** is logged (no dossier, no scores, no answers).

---

## SECURITY NOTES

1. **Admin-only** — Requires secret header, returns 401 without it
2. **Feature-flagged** — Returns 403 if GPT rescoring disabled globally
3. **Stateless** — No session/JWT required, only secret key
4. **Idempotent** — Multiple calls safe (if force=false, returns early)
5. **No side effects** — Only updates rescoring_gpt, preserves all other data
6. **Secret rotation-ready** — Change ADMIN_GPT_RESCORE_SECRET in .env anytime

---

## ROLLBACK

### If Endpoint Has Issues

**Immediate:**
```bash
# Stop calling the endpoint
# Profiles still render fine (fallback chain works)
```

**Revert:**
```bash
git revert <commit>
# Removes endpoint
# Old profiles still have whatever rescoring_gpt they had
```

**Reset Profile:**
```bash
# Delete rescoring_gpt from Redis manually (if corrupted)
redis-cli DEL mm-20260526-r8362esx
# or update to remove rescoring_gpt field from canonical
```

---

## INTEGRATION WITH RENDERER

After rescore refresh:

1. Endpoint saves updated canonical to Redis
2. User retrieves profile: GET /api/moremindmap/retrieve-profile?id=mm-20260526-r8362esx
3. Redis returns canonical with rescoring_gpt now populated
4. Renderer gets rescoring_gpt.ranked_dimensions
5. Renderer prioritizes GPT layer (automatic, no code change needed)
6. User sees behavioral rescoring immediately

**No cache invalidation needed** — Redis has fresh data.

---

## DEPLOYMENT CHECKLIST

- [ ] Endpoint code committed
- [ ] Admin secret configured in .env.production
- [ ] Feature flag verified (GPT_RESCORING_ENABLED=true)
- [ ] Tests pass locally
- [ ] Endpoint responds to POST requests
- [ ] Authentication works (401 on invalid token)
- [ ] Validation works (422 on bad rescore)
- [ ] Redis save works (profile updated)
- [ ] Renderer uses new rescoring_gpt (automatic via fallback)
- [ ] Documentation complete

---

## SUMMARY

This endpoint enables **downstream backfill** of GPT behavioral rescoring.

**Key features:**
- ✅ Admin-only (requires secret)
- ✅ Feature-flagged (respects GPT_RESCORING_ENABLED)
- ✅ Non-destructive (preserves baseline, V1, all original data)
- ✅ Idempotent (safe to call multiple times)
- ✅ Validated (full structure check before save)
- ✅ Logged (clear, safe logging)
- ✅ Reversible (can rollback or manually delete rescoring_gpt)

**Enables:**
- Existing profiles to get GPT behavioral rescoring
- Batch refresh operations
- Testing GPT changes
- Supporting users who don't retake assessment

---

**ADMIN ENDPOINT COMPLETE AND DOCUMENTED**
