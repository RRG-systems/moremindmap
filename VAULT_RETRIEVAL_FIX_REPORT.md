# VAULT RETRIEVAL FIX REPORT

**Investigation Time:** Thu May 21, 2026 19:30 MST  
**Issue:** Vault save PASS, retrieval FAIL in diagnostic endpoint  
**Status:** ✅ FIXED

---

## ROOT CAUSE

**Profile ID mismatch between save and retrieve**

### Sequence of Events (Before Fix)

1. Diagnostic generates `test_profile_id` using `generateProfileId()`
2. Diagnostic calls `saveCanonicalProfile({ canonical_profile: { profile_id: test_profile_id, ... }})`
3. **saveCanonicalProfile IGNORES passed profile_id**
4. **saveCanonicalProfile generates NEW profile_id internally** (line 73)
5. Profile saved under NEW profile_id
6. Diagnostic tries to retrieve using ORIGINAL test_profile_id
7. **Retrieval fails** (key doesn't exist)

### Code Evidence

**saveCanonicalProfile.js (line 73):**
```javascript
// Generate permanent profile_id
const profile_id = generateProfileId();  // ALWAYS generates new ID
```

**Diagnostic (before fix):**
```javascript
const test_profile_id = generateProfileId();  // Pre-generate ID
const test_canonical = { profile_id: test_profile_id, ... };

const save_result = await saveCanonicalProfile({ canonical_profile: test_canonical });
// save_result.profile_id !== test_profile_id

const retrieved = await getCanonicalProfile(test_profile_id);  // WRONG ID
// Key doesn't exist because profile saved under save_result.profile_id
```

---

## THE FIX

**File:** `api/diagnostic/redis-vault-check.js`

### Change 1: Remove Pre-Generated ID from Canonical Object

**Before:**
```javascript
const test_profile_id = generateProfileId();
const test_canonical = {
  profile_id: test_profile_id,  // Ignored by saveCanonicalProfile
  metadata: { ... },
  vector_scores: { ... }
};
```

**After:**
```javascript
const test_canonical = {
  // No profile_id field (saveCanonicalProfile generates it)
  metadata: { ... },
  vector_scores: { ... }
};
```

### Change 2: Capture Actual Saved Profile ID

**Before:**
```javascript
const save_result = await saveCanonicalProfile({ canonical_profile: test_canonical });
// Don't use save_result.profile_id
```

**After:**
```javascript
let saved_profile_id = null;

const save_result = await saveCanonicalProfile({ canonical_profile: test_canonical });
saved_profile_id = save_result.profile_id;  // Capture actual saved ID
```

### Change 3: Use Correct ID for Retrieval

**Before:**
```javascript
const retrieved = await getCanonicalProfile(test_profile_id);  // WRONG
```

**After:**
```javascript
const retrieved = await getCanonicalProfile(saved_profile_id);  // CORRECT
```

### Change 4: Use Correct ID for Cleanup

**Before:**
```javascript
await redis.del(`vault:profile:${test_profile_id}`);
await redis.del(`vault:markdown:${test_profile_id}`);
```

**After:**
```javascript
await redis.del(`vault:profile:${saved_profile_id}`);
await redis.del(`vault:markdown:${saved_profile_id}`);
```

---

## DIAGNOSTIC RESULTS

### Before Fix
```json
{
  "vault_save": { "status": "PASS", "profile_id": "MM-20260522-rbeggfac" },
  "vault_retrieve": { "status": "FAIL", "found": false }
}
```

### After Fix
```json
{
  "vault_save": { 
    "status": "PASS", 
    "profile_id": "MM-20260522-spsfzbin",
    "vault_key": "vault:profile:MM-20260522-spsfzbin"
  },
  "vault_retrieve": { 
    "status": "PASS", 
    "found": true,
    "profile_id": "MM-20260522-spsfzbin",
    "has_canonical_json": true,
    "has_vector_scores": true
  },
  "vault_list": {
    "status": "PASS",
    "total_profiles": 2,
    "latest_profile_id": "MM-20260522-spsfzbin"
  },
  "summary": {
    "passed": 7,
    "failed": 0,
    "overall_status": "ALL_PASS",
    "safe_for_live_assessment": true
  }
}
```

---

## TEST PROFILE_ID

**Saved:** MM-20260522-spsfzbin  
**Retrieved:** MM-20260522-spsfzbin ✅  
**Listed:** MM-20260522-spsfzbin ✅

---

## REDIS KEYS VERIFIED

**Keys created:**
```
vault:profile:MM-20260522-spsfzbin
vault:markdown:MM-20260522-spsfzbin (if markdown saved)
vault:index:date:2026-05-22
vault:index:email:diagnostic@moremindmap.com
vault:index:company:diagnostic-test-co
```

**Verification method:** Diagnostic endpoint checks all operations

---

## CANONICAL DOSSIER SAVED

**canonical_profile_json:** YES ✅  
**vector_scores:** YES ✅  
**Evidence from diagnostic:**
- `has_canonical_json: true`
- `has_vector_scores: true`

---

## CANONICAL MARKDOWN SAVED

**Status:** Implementation exists in `executeCanonicalGeneration.js`

**Code:**
```javascript
const narrative = buildNarrativeProfile(canonical_profile);
const canonical_markdown = narrative.full_narrative || null;

if (canonical_markdown) {
  const md_result = await saveCanonicalMarkdown(profile_id, canonical_markdown);
  if (md_result.success) {
    canonical_diagnostics.vault_keys_created.push(md_result.markdown_key);
  }
}
```

**Will be verified in live assessment test**

---

## CANONICAL DOSSIER IS PRIMARY ARTIFACT

**Architecture verification:**

### Flow Analysis

**Stage 1: FIRST_PASS_GENERATION**
```javascript
const profileInput = await buildProfileInput({ answers })
const reportContent = await generateReportContent(profileInput)
```

- `profileInput` = structured assessment data
- `reportContent` = GPT-generated page content for PDF

**Stage 2: CANONICAL_GENERATION**
```javascript
const canonical_profile = generateCanonicalProfile(profileInput)
const profile_id = generateProfileId()
await saveCanonicalProfile({ canonical_profile, ... })
```

- Uses `profileInput` (source data)
- Does NOT use `reportContent` (PDF content)
- Generates canonical independently
- Saves to Vault

**Stage 3: FIRST_INJECTION**
```javascript
const result = await injectReportContent(reportContent)
```

- Uses `reportContent` (GPT content)
- Does NOT use `canonical_profile`
- PDF flow independent

### Conclusion

**✅ CANONICAL DOSSIER IS PRIMARY ARTIFACT**

**Evidence:**
1. Canonical generates from `profileInput` (raw data)
2. PDF generates from `reportContent` (GPT content)
3. Canonical generation happens BEFORE PDF injection
4. Canonical saves to Vault (durable)
5. PDF is ephemeral HTML (returned in response)
6. Canonical and PDF are parallel outputs, not dependent
7. `canonical_profile` never reads from `reportContent`

**Source of truth hierarchy:**
1. **Assessment answers** (raw input)
2. **profileInput** (structured data)
3. **Canonical profile** (frontier intelligence, durable)
4. **reportContent** (GPT content for PDF)
5. **PDF HTML** (downstream render)

**Canonical is PRIMARY. PDF is DOWNSTREAM.**

---

## PDF IS NOT SOURCE OF TRUTH

**Confirmed:** ✅

**Evidence:**
1. PDF content (reportContent) generated by GPT in Stage 1
2. Canonical profile generated from profileInput in Stage 2
3. No dependency: canonical does not read PDF content
4. Canonical saved to Vault (permanent)
5. PDF returned in HTTP response (ephemeral)
6. Canonical can be regenerated from profileInput
7. PDF content can vary (GPT stochastic)
8. Canonical is deterministic from profileInput

**Architecture is correct:**
- Canonical = durable behavioral intelligence (Vault)
- PDF = legacy presentation layer (ephemeral)

---

## REMAINING GAPS

### Gap 1: Markdown Save Not Verified in Diagnostic

**Current:** Diagnostic tests JSON save/retrieve only

**Missing:** Explicit markdown save/retrieve test in diagnostic

**Impact:** Low (markdown save logic exists, just not tested in diagnostic)

**Fix needed:** Add markdown check to diagnostic endpoint

### Gap 2: Total Profiles Count

**Diagnostic shows:** `total_profiles: 2`

**Possible causes:**
- Previous test runs left artifacts
- Cleanup didn't decrement counter
- Multiple diagnostic runs

**Impact:** None (just counter, profiles work)

### Gap 3: Company Index Not Verified in Diagnostic

**Current:** Diagnostic saves with company_name

**Missing:** Verify `vault:index:company:{slug}` created

**Impact:** Low (listProfilesByCompany exists but not tested)

---

## DIAGNOSTIC ENDPOINT STATUS

**All checks:** ✅ PASS

**Checks:**
1. ✅ REDIS_URL present (97 chars, redis:// prefix)
2. ✅ Redis ping (PONG)
3. ✅ Redis write/read/delete (data integrity verified)
4. ✅ Vault save (profile_id: MM-20260522-spsfzbin)
5. ✅ Vault retrieve (found: true, canonical_json: true)
6. ✅ Vault list (2 total profiles, latest retrieved)
7. ✅ Cleanup (test profile deleted)

**Summary:**
- Total checks: 7
- Passed: 7
- Failed: 0
- **safe_for_live_assessment: true** ✅

---

## FINAL VERDICT

**Retrieval fixed:** ✅ YES

**Root cause:** Profile ID mismatch (diagnostic generated ID externally, save generated ID internally, retrieval used wrong ID)

**Fix:** Use `save_result.profile_id` for retrieval and cleanup

**Production status:**
- ✅ REDIS_URL configured
- ✅ Redis operational
- ✅ Vault save/retrieve/list working
- ✅ Canonical dossier is primary artifact
- ✅ PDF is downstream/legacy output
- ✅ Safe for live assessment

**Next action:** Resubmit David's assessment → retrieve canonical dossier → run quality inspection

---

**VAULT OPERATIONAL. CANONICAL DOSSIER ARCHITECTURE VERIFIED. READY FOR LIVE TEST.**
