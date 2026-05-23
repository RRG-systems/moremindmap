# Vault Profile ID Mismatch Fix

**Commit:** `080f929`  
**Date:** 2026-05-23 08:15 MST  
**Status:** DEPLOYED & READY FOR NEW PROFILES  

---

## Root Cause

**Problem:** Profile ID mismatch between reported and saved

```
Job reports: canonical_profile_id: MM-20260523-bb3hsat9
But saved as: vault:profile:MM-20260523-d1er8ac5
```

**Why this happened:**

Two profile_ids were being generated:
1. In `executeCanonicalGeneration.js`: `const profile_id = generateProfileId()`
2. In `saveCanonicalProfile.js`: `const profile_id = generateProfileId()` (different ID!)

The function was NOT passing the first ID to saveCanonicalProfile, so a new one was generated inside.

Result:
- Job stores one ID
- Vault saves under different ID
- Retrieval by job's ID fails

---

## The Fix

### File 1: saveCanonicalProfile.js

**Change:** Accept optional `profile_id` parameter

```javascript
// BEFORE:
export async function saveCanonicalProfile(options) {
  const { canonical_profile, job_id = null, ... } = options;
  const profile_id = generateProfileId();  // ← Always generates new ID
  // ...uses profile_id for vault:profile:{profile_id}
}

// AFTER:
export async function saveCanonicalProfile(options) {
  const { canonical_profile, profile_id = null, job_id = null, ... } = options;
  const final_profile_id = profile_id || generateProfileId();  // ← Uses provided ID or generates
  // ...uses final_profile_id for vault:profile:{final_profile_id}
}
```

Key changes:
- Accepts optional `profile_id` parameter
- If provided, validates it and uses it
- If not provided, generates a new one
- All vault keys use `final_profile_id` consistently
- Added diagnostics fields to track this

### File 2: executeCanonicalGeneration.js

**Change:** Pass profile_id to saveCanonicalProfile

```javascript
// BEFORE:
const profile_id = generateProfileId();
const vault_result = await saveCanonicalProfile({
  canonical_profile,
  job_id: job.job_id,
  // ...
  // profile_id NOT passed, so saveCanonicalProfile generates new one
});

// AFTER:
const profile_id = generateProfileId();
const vault_result = await saveCanonicalProfile({
  canonical_profile,
  profile_id,  // ← Pass it explicitly
  job_id: job.job_id,
  // ...
});
```

---

## Verification

### Test Case: Profile MM-20260523-d1er8ac5

**Old code result:**
```json
{
  "canonical_profile_id": "MM-20260523-bb3hsat9",
  "vault_keys_created": ["vault:profile:MM-20260523-d1er8ac5"]
}
```
Mismatch: bb3hsat9 ≠ d1er8ac5

**Retrieval test:**
```bash
# Using REPORTED ID (fails):
curl https://moremindmap.com/api/diagnostic/get-vault-profile?id=MM-20260523-bb3hsat9
# Result: Profile not found ✗

# Using ACTUAL VAULT KEY (succeeds):
curl https://moremindmap.com/api/diagnostic/get-vault-profile?id=MM-20260523-d1er8ac5
# Result: Profile found ✓
```

This proves the mismatch.

---

## Future Testing

### Next steps after this deployment:

1. Generate a NEW profile AFTER commit `080f929` is deployed
2. Check that `canonical_profile_id` matches `vault_keys_created[0]`
3. Retrieve by `canonical_profile_id` and verify it works

Expected result:
```json
{
  "canonical_profile_id": "MM-20260523-XXXXXXXX",
  "vault_keys_created": ["vault:profile:MM-20260523-XXXXXXXX"]
}
```
Same ID in both places ✓

---

## Why This Matters

**Before fix:**
- Profile saved under one ID
- Job reports different ID
- Users can't find their profile by the ID they're given
- Retrieval endpoint returns 404 even though profile exists

**After fix:**
- Profile ID generated once
- Passed through entire pipeline
- Saved under correct ID
- Retrieved by reported ID
- End-to-end consistency

---

## Instrumentation Added

Both functions now return detailed diagnostics:

```json
{
  "save_timestamp": "2026-05-23T08:04:25.497Z",
  "redis_provider": "ioredis",
  "redis_url_present": true,
  "profile_id_provided": false,
  "vault_key_written": true,
  "verification_read_attempted": true,
  "verification_read_success": true,
  "verification_value_length": 28456,
  "redis_disconnect_called": true
}
```

Stored in `job.canonical_diagnostics.vault_save_diagnostics`

---

## Git History

- `2c003c5` - First attempt: redis disconnect + verification
- `6eb020a` - Instrumentation: detailed diagnostics logging
- `080f929` - ROOT CAUSE FIX: Profile ID mismatch (pass ID, don't regenerate)

---

## Status

✅ **Deployed**  
✅ **Ready for new profiles**  
⏳ **Awaiting new profile generation to verify fix works end-to-end**  

When a new profile is generated AFTER this commit, it will:
1. Use consistent profile_id throughout pipeline
2. Save to correct vault:profile:{id}
3. Be retrievable by reported ID
4. Return full profile + markdown with diagnostic data
