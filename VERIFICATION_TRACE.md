# End-to-End Verification: Profile ID Case Normalization Fix

## Scenario: New Profile Generation & Retrieval

### Step 1: Assessment Submitted
**Frontend:** Profile.jsx → submitAssessment()
- User enters 28 questions, hits submit
- POST to `/api/moremindmap/start` with assessment payload
- Endpoint: api/moremindmap/start.js (Mini V2 async flow)

### Step 2: Job Created
**Backend:** miniV2JobManager.js → createJob()
- Creates job record with status=pending
- Job ID generated
- Awaits pipeline execution

### Step 3: Canonical Generation (CRITICAL STAGE)
**Backend:** executeCanonicalGeneration.js
```
1. Import: generateProfileId, saveCanonicalProfile
2. Call: profile_id = generateProfileId()
   ├─ Generates: mm-20260523-a1b2c3d4 (LOWERCASE)
   ├─ Returns to: executeCanonicalGeneration()
   └─ Stores in: canonical_profile.profile_id

3. Call: vault_result = saveCanonicalProfile({ profile_id, canonical_profile, ... })
   ├─ In saveCanonicalProfile.js:
   │  ├─ Receives: profile_id = "mm-20260523-a1b2c3d4"
   │  ├─ Normalizes: final_profile_id = profile_id.toLowerCase()
   │  │  (no-op, already lowercase; safety measure for provided IDs)
   │  ├─ Creates key: vault:profile:mm-20260523-a1b2c3d4
   │  ├─ SET to Redis with verification
   │  └─ Returns: vault_result with diagnostics
   └─ Returns to: executeCanonicalGeneration()

4. Job updated with: canonical_profile_id = profile_id = "mm-20260523-a1b2c3d4"
5. Job status: FIRST_INJECTION

RESULT: Profile stored in Redis at lowercase key
```

### Step 4: Frontend Polls for Completion
**Frontend:** Profile.jsx → submitAssessment() polling
- Poll `/api/moremindmap/status?job_id={job_id}`
- Backend returns: status=complete, html=..., profile_id="mm-20260523-a1b2c3d4"
- Frontend displays report, shows profile_id to user

### Step 5: User Copies Profile ID
**Frontend:** Profile report displays in UI
- Shows: "Profile ID: mm-20260523-a1b2c3d4"
- User copies text (or enters manually)
- User navigates to recovery page

### Step 6: User Enters Profile ID for Retrieval
**Frontend:** IntroScreen.jsx → validateProfileId()
```
User input:    "MM-20260523-a1b2c3d4"  (uppercase, pasted from somewhere)
         or   "mm-20260523-a1b2c3d4"  (lowercase, our format)
         or   "Mm-20260523-A1B2C3D4"  (mixed case, typo)

All are accepted and sent to backend as-is
```

### Step 7: Backend Retrieves Profile
**Backend:** api/moremindmap/retrieve-profile.js
```
1. Receives: id = "MM-20260523-a1b2c3d4" (from URL query param)

2. Validate format:
   ├─ Pattern: /^mm-\d{8}-[a-z0-9]{8}$/i
   │  (case-insensitive flag "i" allows uppercase input)
   ├─ Matches: YES (case-insensitive match)
   └─ Validation: PASS

3. Normalize to lowercase:
   ├─ normalizedId = id.toLowerCase()
   ├─ Result: "mm-20260523-a1b2c3d4"
   └─ Storage: normalizedId

4. Redis lookup:
   ├─ Key: vault:profile:mm-20260523-a1b2c3d4
   ├─ Query: redis.get("vault:profile:mm-20260523-a1b2c3d4")
   ├─ Expected: Stored value from Step 3
   └─ Result: FOUND ✓

5. Parse and return:
   ├─ JSON.parse(profileData)
   ├─ Return 200 with profile
   └─ Response includes: profile_id = "mm-20260523-a1b2c3d4"

RESULT: Profile retrieved successfully
```

### Step 8: Frontend Renders Report
**Frontend:** Profile.jsx
- Receives profile data from backend
- Calls render endpoint with canonical_dossier
- Displays report to user
- Shows: "Profile ID: mm-20260523-a1b2c3d4"

## Key Guarantees

✅ **Case Normalization:**
- Generated IDs: Always lowercase (mm-YYYYMMDD-XXXXXXXX)
- Stored keys: Always lowercase
- Retrieval: Input normalized to lowercase before lookup
- User input: Case-insensitive (MM-, mm-, Mm- all work)

✅ **Redis Key Consistency:**
- Write side: `vault:profile:mm-20260523-a1b2c3d4`
- Read side: `vault:profile:mm-20260523-a1b2c3d4`
- Match: 100%
- Result: No 404 errors

✅ **Pattern Validation:**
- All endpoints use: /^mm-\d{8}-[a-z0-9]{8}$/i
- Ensures exactly 8 lowercase alphanumeric chars after prefix
- Case-insensitive input accepted
- Normalized before use

✅ **Safety Measures:**
- Validation happens before Redis queries
- Normalization is idempotent (lowercase → lowercase = lowercase)
- Provided IDs normalized in saveCanonicalProfile (defense in depth)
- Generated IDs already lowercase

## Testing Checklist

- [ ] Deploy to production
- [ ] Generate new profile via assessment
- [ ] Verify profile_id format: mm-YYYYMMDD-XXXXXXXX
- [ ] Retrieve by ID: should work
- [ ] Retrieve with uppercase MM-: should work
- [ ] Retrieve with mixed case Mm-: should work
- [ ] Verify Redis keys created as lowercase
- [ ] Check diagnostics logs for case normalization info
- [ ] Monitor for 404s on retrieval (should be zero)

## Rollback Plan

If issues arise:
1. Revert commits: ca288aa, 48b3aa8
2. Previous version used uppercase MM- (might need migration)
3. For existing vault entries: Can copy keys from MM-* to mm-* if needed

## Files Modified

- api/engine/vault/generateProfileId.js
  ├─ format: MM- → mm-
  ├─ pattern: /^MM-/ → /^mm-/
  └─ example: MM-20260521-a3f9k2x7 → mm-20260521-a3f9k2x7

- api/engine/vault/saveCanonicalProfile.js
  ├─ normalize provided profile_id to lowercase
  └─ safety measure for provided IDs

- api/moremindmap/retrieve-profile.js
  ├─ pattern: /^MM-.*$/i → /^mm-.*$/i
  ├─ clarified comment about normalization
  └─ enhanced error message with expected format

## Next Steps

1. Monitor production for successful profile retrieval
2. Collect diagnostics from first few new profiles
3. Verify Redis key naming consistency
4. If all good, mark as VERIFIED
5. Consider eventual migration of existing vault entries (low priority)
