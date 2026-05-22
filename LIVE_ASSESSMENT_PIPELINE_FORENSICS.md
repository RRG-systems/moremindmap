# LIVE ASSESSMENT PIPELINE FORENSICS

**Investigation Time:** Thu May 21, 2026 20:14 MST  
**Target:** Determine why David's real assessment bypassed canonical/Vault storage  
**Status:** ROOT CAUSE IDENTIFIED

---

## EXECUTIVE SUMMARY

**Finding:** Frontend captures email/name but does NOT send it to backend

**Impact:** Backend canonical generation runs, but saves with `null` email/name, so:
- ❌ No email index created
- ❌ Cannot search by email
- ❌ Profile saved but unfindable
- ⚠️ Profile may exist but is orphaned

**Break point:** Frontend submission (src/Profile.jsx line 148)

**Root cause:** Payload contains only `{ answers }`, missing `{ answers, metadata: { email, person_name } }`

---

## FORENSIC TRACE

### STEP 1: Frontend Submission Path

**File:** `src/Profile.jsx`

**User input captured:**
```javascript
const [fullName, setFullName] = useState("")  // Line 8
const [email, setEmail] = useState("")        // Line 9
```

**Validation:**
```javascript
const isButtonDisabled = !fullName.trim() || !email.trim() || ...  // Line 431
```

**User MUST provide email and name before submit button enables.**

**Submission code (line 143-148):**
```javascript
const startRes = await fetch(`${API}/api/moremindmap/start`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ answers }),  // ← BUG: Only answers, no metadata!
})
```

**What's sent:**
```json
{
  "answers": {
    "q1": { "choice": "A" },
    "q2": { "choice": "B" },
    ...
  }
}
```

**What's MISSING:**
```json
{
  "answers": { ... },
  "metadata": {
    "person_name": "David Berg",
    "email": "djbergiii@icloud.com",
    "company_name": null
  }
}
```

**Endpoint used:** `/api/moremindmap/start` ✅ CORRECT (not legacy path)

---

### STEP 2: Backend Job Creation

**File:** `api/moremindmap/start.js`

**Code (line 35-40):**
```javascript
const { answers, metadata = {} } = req.body

// Create job in Redis (queued, no execution yet)
const jobId = await createJob({ answers: formattedAnswers, metadata })
```

**What backend receives:**
```json
{
  "answers": { ... },
  "metadata": {}  // ← EMPTY because frontend didn't send it
}
```

**Job created:** ✅ YES (with empty metadata)

---

### STEP 3: Staged Executor Flow

**File:** `api/engine/miniV2StagedExecutor.js`

**Stage sequence (verified):**
1. RECEIVED
2. FIRST_PASS_GENERATION → builds profileInput + generates reportContent
3. **CANONICAL_GENERATION** → wired correctly ✅
4. FIRST_INJECTION → template injection
5. COMPLETE

**Transition logic (line 71):**
```javascript
await updateJob(job.job_id, {
  stage: JOB_STAGE.CANONICAL_GENERATION,  // ✅ Correct transition
  // ...
})
```

**executeNextStage (line 424):**
```javascript
case JOB_STAGE.CANONICAL_GENERATION:
  const { executeCanonicalGeneration } = await import('./canonical/executeCanonicalGeneration.js')
  return await executeCanonicalGeneration(job)
```

**Stage wiring:** ✅ CORRECT

---

### STEP 4: Canonical Execution

**File:** `api/engine/canonical/executeCanonicalGeneration.js`

**Metadata extraction (line 66-68):**
```javascript
const { metadata = {} } = job.payload
const person_name = metadata.person_name || metadata.name || null
const email = metadata.email || null
const company_name = metadata.company_name || metadata.company || null
```

**What happens with empty metadata:**
```javascript
person_name = null
email = null
company_name = null
```

**Canonical generation:** ✅ STILL EXECUTES (doesn't fail)

**ProfileInput:** ✅ Built from answers (works without metadata)

**Canonical profile:** ✅ Generated (doesn't require metadata)

---

### STEP 5: Vault Save Attempt

**File:** `api/engine/canonical/executeCanonicalGeneration.js` (line 88-100)

**Code:**
```javascript
const vault_result = await saveCanonicalProfile({
  canonical_profile,
  job_id: job.job_id,
  person_name,          // null
  email,                // null
  company_name,         // null
  assessment_version: 'mini-v2',
  model: 'canonical-v1-frontier',
  intake_answers: job.payload.answers,
  quality_score,
  metadata: { ... }
})
```

**Vault save:** ✅ SUCCEEDS

**What gets saved:**
```json
{
  "profile_id": "MM-20260522-XXXXXXXX",
  "person_name": null,
  "email": null,
  "company_name": null,
  "canonical_profile_json": { ... },  // ✅ Populated
  ...
}
```

**Redis keys created:**
```
vault:profile:{profile_id}  ← ✅ Created
vault:index:date:{date}     ← ✅ Created
vault:index:email:          ← ❌ NOT created (email is null)
vault:index:company:        ← ❌ NOT created (company is null)
```

---

## EXACT BREAK POINT

**Location:** `src/Profile.jsx` line 148

**Before:**
```javascript
body: JSON.stringify({ answers }),
```

**Should be:**
```javascript
body: JSON.stringify({ 
  answers,
  metadata: {
    person_name: fullName.trim() || null,
    email: email.trim() || null
  }
}),
```

---

## ROOT CAUSE

**Frontend does not send metadata (email, person_name) to backend**

**Evidence chain:**
1. ✅ User enters fullName + email (required for submit button)
2. ✅ Frontend validates fullName + email present
3. ✅ Frontend submits to `/api/moremindmap/start`
4. ❌ **Frontend payload contains ONLY answers, not metadata**
5. ✅ Backend receives request with empty metadata
6. ✅ Job created with `metadata: {}`
7. ✅ Canonical generation executes
8. ✅ Vault save succeeds
9. ❌ **Profile saved with null email/name**
10. ❌ **No email index created**
11. ❌ **Profile orphaned** (exists but unfindable by email)

---

## IMPACT ASSESSMENT

### What Worked
- ✅ Assessment submission
- ✅ Job creation
- ✅ Staged executor
- ✅ Canonical generation
- ✅ Vault save
- ✅ Profile storage

### What Failed
- ❌ Metadata capture (email, person_name not sent)
- ❌ Email indexing (no email = no index)
- ❌ Profile discoverability (cannot search by email)
- ❌ Identity association (profile is anonymous)

### David's Profile Status

**Likely scenario:**
- Profile EXISTS in Vault
- Profile has canonical dossier
- Profile has evidence maps, causal chains, contradictions
- Profile has quality score
- Profile is ANONYMOUS (no email, no name)
- Profile is UNFINDABLE by email search
- Profile is discoverable by:
  - Latest profile query (if most recent)
  - Date query (if you know submission date)
  - Brute force (list all profiles)

**To find David's real profile:**
- List all profiles
- Filter out diagnostic tests
- Check timestamps
- Match by creation date/time

---

## SMALLEST SAFE FIX

**File:** `src/Profile.jsx`

**Location:** Line 148 (Mini V2 submission)

**Change:**
```javascript
// BEFORE:
body: JSON.stringify({ answers }),

// AFTER:
body: JSON.stringify({ 
  answers,
  metadata: {
    person_name: fullName.trim() || null,
    email: email.trim() || null
  }
}),
```

**Impact:**
- Future assessments will include metadata
- Email indexing will work
- Profiles will be searchable

**Risk:** Very low (additive only, backend already handles metadata)

**Does NOT fix:**
- Existing orphaned profiles (remain anonymous)
- David's current profile (still unfindable by email)

**To recover David's profile:**
- List all profiles
- Identify by timestamp
- OR: David retakes assessment after fix

---

## VERIFICATION NEEDED

**After fix, verify:**
1. Frontend sends metadata
2. Backend receives metadata
3. Canonical saves with email/name
4. Email index created
5. Profile searchable by email

---

## FORENSIC TIMELINE

```
User enters email + name
  ↓
Frontend validates present
  ↓
Frontend submits to /api/moremindmap/start
  ↓
Payload: { answers } only  ← BUG HERE
  ↓
Backend receives empty metadata
  ↓
Job created (metadata: {})
  ↓
Staged executor runs
  ↓
CANONICAL_GENERATION executes
  ↓
Canonical profile generated (works without metadata)
  ↓
Vault save called with null email/name
  ↓
Profile saved (anonymous)
  ↓
vault:profile:{profile_id} created ✅
vault:index:email: NOT created ❌
  ↓
Profile exists but unfindable by email
```

---

## EXACT ROOT CAUSE

**Frontend metadata omission bug**

**What user sees:** "Please enter your name and email" → enters data → submits

**What actually happens:** Name and email captured but discarded before backend submission

**Why this wasn't caught:**
- Infrastructure tests use mock data with explicit metadata
- Diagnostic endpoint constructs test profiles directly
- Real user flow bypasses metadata transmission

**Classic integration bug:** Each layer works in isolation, breaks at integration point

---

## DAVID'S PROFILE STATUS

**Hypothesis:** Profile EXISTS but is ANONYMOUS

**Evidence supporting:**
- Vault diagnostics all PASS (save works)
- Canonical generation wired correctly
- Executor transitions correctly
- No errors in diagnostic tests
- Profile count: 3 (includes at least one non-diagnostic profile likely)

**To find it:**
- List all profiles (diagnostic endpoint: list-all-profiles)
- Check creation timestamps around David's submission time
- Profile without email but with real assessment answers

**Likely profile_id:** MM-20260522-XXXXXXXX (created today, after diagnostic tests)

---

## RECOMMENDED ACTION

### Option 1: Fix Frontend, Resubmit (Recommended)

1. Fix `src/Profile.jsx` line 148 (add metadata)
2. Deploy
3. David resubmits assessment
4. New profile created with email/name
5. Searchable and inspectable

**Pro:** Clean, forward-looking  
**Con:** Loses David's original assessment data

### Option 2: Find Orphaned Profile

1. Query all Vault profiles
2. Filter by timestamp
3. Match David's submission time
4. Retrieve orphaned profile
5. Inspect quality

**Pro:** Recovers original data  
**Con:** Manual forensic work, one-time fix

### Option 3: Both

1. Find orphaned profile for quality inspection (one-time)
2. Fix frontend for future assessments (permanent)

**Recommended:** Option 3

---

**ROOT CAUSE CONFIRMED: Frontend omits metadata. Fix is one line. David's profile likely exists but orphaned.**
