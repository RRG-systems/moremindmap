# LIVE DAVID DOSSIER SEARCH REPORT

**Investigation Time:** Thu May 21, 2026 19:57 MST  
**Target Email:** djbergiii@icloud.com  
**Status:** NOT FOUND

---

## SEARCH RESULTS

### Email Search

**Query:** `djbergiii@icloud.com`

**Result:**
```json
{
  "success": false,
  "email": "djbergiii@icloud.com",
  "message": "No profiles found for this email",
  "count": 0
}
```

**Status:** No profiles indexed under this email

---

### Latest Profile Check

**Total profiles in Vault:** 3

**Latest profile:**
```
Profile ID: MM-20260522-rbeggfac
Email: diagnostic@moremindmap.com
Person: Diagnostic Test
Company: Diagnostic Test Co
Created: 2026-05-22T02:17:56.301Z
Quality: 100
```

**Status:** Latest profile is diagnostic test, not David's assessment

---

## POSSIBLE EXPLANATIONS

### 1. Email Not Captured During Assessment Submission

**Most likely:** Assessment frontend doesn't send `email` in metadata

**Evidence needed:**
- Check frontend form submission code
- Check what metadata is sent to `/api/moremindmap/start`
- Check if email field exists in assessment form

**Impact:** Profiles generated but not indexed by email

**Fix:** Add email to assessment metadata submission

### 2. Assessment Not Yet Completed

**Possible:** David's assessment still processing

**Evidence needed:**
- Check job status for recent jobs
- Look for in-progress jobs
- Check Redis for `job:*` keys

**Impact:** Profile will appear when job completes

### 3. Canonical Generation Failed Before Save

**Possible:** Error in canonical generation stage

**Evidence needed:**
- Check Vercel function logs
- Look for `[CANONICAL-GENERATION] Error` messages
- Check job diagnostics for errors

**Impact:** Job completed, but canonical not saved

### 4. Assessment Submitted Before Canonical Wiring

**Possible:** David's assessment happened before commit f374281

**Evidence needed:**
- Check assessment timestamp
- Compare to deployment timeline
- Check if old jobs exist in Redis

**Impact:** Old assessment won't have canonical dossier

---

## VAULT CONTENTS

**Total profiles:** 3

**Known profiles:**
1. MM-20260522-rbeggfac (diagnostic test, just retrieved)
2. MM-20260522-spsfzbin (diagnostic test, from earlier diagnostic run, cleaned up)
3. (Unknown third profile)

**Real assessments:** 0 confirmed (all appear to be diagnostic tests)

---

## NEXT DIAGNOSTIC STEPS

### Step 1: Check All Vault Profiles

**Query all 3 profiles:**
- Get profile metadata for each
- Identify which are diagnostic vs real
- Find if any match David's data (even without email index)

### Step 2: Check Recent Jobs

**Query Redis for recent jobs:**
```
KEYS job:*
```

**Find:**
- Latest job_id
- Job status
- Whether canonical stage completed
- Any errors in canonical_diagnostics

### Step 3: Verify Assessment Submission Metadata

**Check frontend code:**
- What metadata is sent to `/api/moremindmap/start`
- Does it include email?
- Does it include person_name?
- Does it include company_name?

---

## HYPOTHESIS

**Most likely explanation:**

David's assessment was submitted, but **email was not included in the submission metadata**, so:
- ✅ Assessment completed
- ✅ Report generated (PDF flow)
- ✅ Canonical generation executed
- ✅ Profile saved to Vault
- ❌ Email index not created (no email in metadata)
- ❌ Cannot find profile by email search

**Evidence supporting this:**
- Vault diagnostics all PASS (save/retrieve working)
- Email search returns 0 results
- Total profiles: 3 (suggests some real data exists)
- No errors in production diagnostics

**How to find David's profile:**
- List all 3 profiles
- Check metadata for recognizable data
- Match by timestamp or partial data
- Search by person_name if captured

---

## RECOMMENDATION

**Create additional diagnostic endpoints:**

1. `GET /api/diagnostic/list-all-profiles` — List all 3 profiles with metadata
2. `GET /api/diagnostic/get-profile?profile_id=X` — Get specific profile by ID

**OR use existing Vault functions to:**
- Query all profile keys from Redis
- Inspect each profile's metadata
- Find David's profile by person_name or timestamp

**Once found:**
- Export full canonical JSON
- Export markdown dossier
- Run quality assessment

---

**STATUS: David's profile likely exists but not indexed by email. Need broader search.**
