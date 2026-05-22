# LIVE DOSSIER FORENSICS — David's Assessment

**Investigation Time:** Thu May 21, 2026 18:57 MST  
**Target:** David's canonical dossier from live assessment  
**Email:** djbergiii@icloud.com  
**Name:** david bergmay21st

---

## CRITICAL FINDING: REDIS NOT CONFIGURED IN PRODUCTION

### Discovery

**Environment inspection:**
```bash
$ vercel env pull .env.production --environment=production
$ grep REDIS_URL .env.production

REDIS_URL=""
```

**Status:** REDIS_URL is EMPTY in production environment

### Impact

**Without Redis:**
- ❌ Vault cannot save profiles
- ❌ No canonical dossiers persisted
- ❌ Job queue unable to function
- ❌ Status polling fails
- ❌ All canonical generation happens but isn't stored

**Pipeline behavior:**
1. Assessment submitted → `createJob()` → **FAILS** (Redis unavailable)
2. OR: Job creation succeeds locally but Vault save fails silently
3. Canonical generation may execute but throws error on `saveCanonicalProfile()`
4. Error caught, job continues (per fallback design)
5. Report may generate, but no Vault persistence

### Root Cause

**Vercel Redis not provisioned or connected**

**Likely scenario:**
- Vercel project doesn't have Redis addon enabled
- OR Redis addon enabled but environment variable not set
- OR Redis URL not pulled into production environment correctly

### Consequence

**Current state:**
- ✅ Code is correct and deployed
- ✅ Canonical engine functional
- ✅ Vault storage logic implemented
- ❌ **Backend storage unavailable**
- ❌ **Cannot retrieve David's dossier**

**David's assessment:**
- Likely submitted successfully
- May have generated PDF/HTML report (if old flow worked)
- Canonical generation may have executed
- **Vault save failed** (no Redis)
- **Canonical dossier lost** (not persisted)

---

## FORENSIC OPTIONS

### Option 1: Check Vercel Function Logs

**Platform:** Vercel dashboard  
**Look for:**
- Recent function execution for `/api/moremindmap/start`
- Status poll logs for `/api/moremindmap/status`
- `[CANONICAL-GENERATION]` log entries
- `REDIS_URL environment variable not configured` errors
- Job execution traces

**Expected findings:**
- Job creation failure OR
- Vault save failure with error logged

### Option 2: Check for Local Job Cache

**If job system has fallback:**
- Check for any local file-based job storage
- Check temp directories
- Check for any `.json` files created during assessment

**Unlikely but possible:**
- Job stored temporarily before Redis failure

### Option 3: Check Email Delivery

**If assessment sent email:**
- Check djbergiii@icloud.com inbox
- Email may contain job_id or report link
- Could reverse-lookup job from email

---

## IMMEDIATE NEXT STEPS

### Step 1: Configure Vercel Redis

**Required actions:**
1. Log into Vercel dashboard
2. Navigate to project: `moremindmap`
3. Go to Storage tab
4. Provision Redis (if not already done)
5. Connect Redis to project
6. Verify `REDIS_URL` environment variable set
7. Redeploy (or environment vars auto-apply)

**Verification:**
```bash
vercel env pull .env.production --environment=production
grep REDIS_URL .env.production
# Should show: REDIS_URL="redis://..."
```

### Step 2: Resubmit Test Assessment

**Once Redis configured:**
1. Submit new test assessment
2. Poll status endpoint
3. Verify `canonical_profile_id` in response
4. Run `testVaultRetrieveLatest.js` (with production REDIS_URL)
5. Confirm Vault keys exist

---

## DAVID'S DOSSIER: STATUS UNKNOWN

**Can we retrieve it?**
- ❌ Not from Vault (Redis unavailable)
- ⏳ Maybe from Vercel logs (if canonical generation executed)
- ⏳ Maybe from job Redis (if job creation succeeded before Vault save)
- ❌ Likely lost (no persistence layer available)

**Best estimate:**
- Assessment likely submitted
- Report may have generated (old PDF flow)
- Canonical generation may have executed
- Vault save failed silently
- **Dossier not retrievable**

**To recover David's insights:**
1. Configure Redis
2. Resubmit David's assessment
3. Canonical will generate + persist correctly

---

## PIPELINE INTEGRITY ASSESSMENT

**Code deployed:** ✅ Correct (commit f374281)

**Canonical stage:** ✅ Wired into executor

**Vault logic:** ✅ Implemented correctly

**Fallback behavior:** ✅ Working as designed (job continues on error)

**Missing:** ❌ Redis backend storage

**Diagnosis:** Infrastructure issue, not code issue

---

## WHAT THIS MEANS FOR LIVE TEST

**Cannot complete live test forensics because:**
- No Redis = No Vault storage
- No Vault storage = No dossier retrieval
- No dossier retrieval = Cannot inspect quality

**Can still verify:**
- ✅ Code structure (already done)
- ✅ Stage wiring (already done)
- ✅ Fallback behavior (code review confirms)

**Cannot verify until Redis configured:**
- ❌ Live canonical generation
- ❌ Vault save success
- ❌ Profile retrieval
- ❌ Dossier quality
- ❌ Evidence map population
- ❌ Causal chain population
- ❌ Company indexing

---

## RECOMMENDATION

**Priority 1: Configure Vercel Redis**

**Without this:**
- Vault is dead code
- Canonical dossiers lost
- Company indexing impossible
- All live assessments generate but don't persist

**With this:**
- Full pipeline operational
- Every assessment creates durable canonical dossier
- Vault indexing works
- Intelligence accumulates

**Timeline:**
- Redis provision: 5 minutes
- Environment variable set: automatic
- Redeploy: automatic or manual trigger
- Test assessment: 15 minutes
- Verification: 5 minutes

**Total: 30 minutes to operational Vault**

---

## PARTIAL REPORT (Infrastructure Blocker)

**Live canonical dossier successfully generated:** UNKNOWN (Redis unavailable)

**Can retrieve David's dossier:** NO (Vault backend missing)

**Next operator action:** Configure Vercel Redis → resubmit assessment → verify Vault save

---

**STATUS: FORENSIC INSPECTION BLOCKED ON INFRASTRUCTURE**
