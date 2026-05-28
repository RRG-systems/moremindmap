# DEPLOYMENT TRACE — WHY DNA SUMMARY STILL SHOWS FALLBACK

**Date:** 2026-05-27 23:14 MST  
**Status:** ✅ SOURCE CODE FIXED | ❌ PRODUCTION NOT DEPLOYED | ❌ ADMIN ENDPOINT STILL FAILING  

---

## THE EXACT PROBLEM

David still renders:
```
"Balanced multi-system topology with flexible dynamics."
```

---

## ROOT CAUSE ANALYSIS

### Problem 1: Production NOT Deployed

**Commits in Git:**
- ✅ 836fcde - FIX: All rescoring_gpt reads now use correct canonical path
- ✅ 38362fd - FIX: DNA Summary topology now reads rescoring_gpt from correct canonical path
- ✅ 95f7767 - DOC: DNA Summary canonical path fix complete

**Commits in Production:**
- ❌ NOT DEPLOYED to Vercel yet

**Proof:**
- Local source: WebProfileReport.jsx has `canonicalProfile` extraction (8 occurrences)
- Production bundle: `index-BlCf1hwg.js` does NOT contain `canonicalProfile` anywhere

**Bundle Information:**
```
Production: index-BlCf1hwg.js (488.55 KB)
Local: index-BlCf1hwg.js (488.55 KB) ← Same hash, means same version

But source code changed and should have different hash
```

### Problem 2: Admin Endpoint Still Failing

**Test Results:**
```
POST /api/admin/rescore-profile with David's profile ID
Response: FUNCTION_INVOCATION_FAILED
```

**Commits that should fix it:**
- ✅ e5b7637 - FIX: Admin endpoint now generates rescoring_v1 for old profiles
- ✅ 670a795 - FIX: Correct rescoreDimensions import (named export)

**Status:**
- ❌ NOT DEPLOYED to Vercel

**Why endpoint is failing:**
- gptBehavioralRescore requires canonical.rescoring_v1
- Old profiles (David created 2026-05-23) don't have v1
- Admin endpoint supposed to generate v1 first, then gpt
- But endpoint isn't deployed yet

---

## THE COMPLETE CHAIN (WHAT SHOULD HAPPEN)

```
1. POST admin/rescore-profile with David's profile
   ├─ Check: Does canonical have rescoring_v1?
   ├─ If NO: Call rescoreDimensions to generate it ✅ (e5b7637)
   ├─ Call: gptBehavioralRescore(canonical) ✅ (now v1 exists)
   └─ Save: canonical.rescoring_gpt to Redis

2. GET retrieve-profile?id=david&nocache=true
   └─ Returns: canonical_dossier.canonical_profile_json.rescoring_gpt

3. Profile.jsx renders
   └─ Passes: <WebProfileReport canonical={result.canonical_dossier} />

4. WebProfileReport renders DNA Summary
   ├─ Extract: const canonicalProfile = canonical.canonical_profile_json ✅ (836fcde)
   ├─ Read: canonicalProfile.rescoring_gpt.render_ready.profile_intensity ✅ (836fcde)
   ├─ Check: if profile_intensity === 'extreme'
   └─ Return: "Concentrated directional topology..." ✅ (NOT hardcoded fallback)
```

---

## DEPLOYMENT STATUS

| Component | Source | Production | Status |
|-----------|--------|-----------|--------|
| Admin endpoint rescue V1 | e5b7637 ✅ | NOT DEPLOYED ❌ | BLOCKED |
| Admin endpoint fix import | 670a795 ✅ | NOT DEPLOYED ❌ | BLOCKED |
| WebProfileReport read path | 836fcde ✅ | NOT DEPLOYED ❌ | BLOCKED |
| DNA Summary topology | 38362fd ✅ | NOT DEPLOYED ❌ | BLOCKED |

---

## WHY DAVID STILL RENDERS FALLBACK

### What Actually Happens Now

```
David's canonical (in production):
{
  canonical_profile_json: {
    rescoring_gpt: null  ← Admin endpoint never created it
    rescoring_v1: null   ← Never created
    ranked_dimensions: [...] ← Baseline only
  }
}

WebProfileReport renderer (in production):
- OLD CODE (not deployed fix): Reads canonical.rescoring_gpt directly
- Result: null (empty object)
- Fallback: renderReady = {} (empty)
- All conditions fail
- RETURNS: "Balanced multi-system topology..." ❌

IF fix WERE deployed:
- NEW CODE: Would read canonical.canonical_profile_json.rescoring_gpt
- But still NULL because admin endpoint didn't create it
- Still RETURNS: "Balanced multi-system topology..."
```

**So even if renderer fix deployed, still won't work without admin endpoint fix.**

---

## THE ACTUAL BLOCKER

**Root Issue:** Admin endpoint is NOT deployed, so rescoring_gpt never created.

**If Only Renderer Fix Deployed:**
- renderer reads correct path
- Still finds null (because admin endpoint didn't create rescoring_gpt)
- Falls back to "Balanced multi-system topology..."

**If Both Fixes Deployed:**
1. Admin endpoint works
2. Creates rescoring_v1 + rescoring_gpt
3. Renderer reads correct path
4. Finds rescoring_gpt.render_ready.profile_intensity = 'extreme'
5. Returns: "Concentrated directional topology..."
6. David renders correctly ✅

---

## PROOF TABLE

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Admin endpoint deployed? | Commit e5b7637 live | NOT FOUND in production | ❌ |
| Admin endpoint can create V1? | Returns success | Returns FUNCTION_INVOCATION_FAILED | ❌ |
| David has rescoring_gpt? | exists | null | ❌ |
| Renderer code deployed? | Commit 836fcde live | NOT FOUND in production | ❌ |
| Renderer reads correct path? | Should have canonicalProfile | Not in dist bundle | ❌ |
| David renders correct topology? | "Concentrated..." | "Balanced multi-system..." | ❌ |

---

## WHAT NEEDS TO HAPPEN

1. **Vercel needs to redeploy**
   - Current commits are NOT in production
   - Commits are pushed to GitHub but not built/deployed by Vercel

2. **After deployment:**
   - Admin endpoint will work (e5b7637 + 670a795 deployed)
   - Renderer will read correct path (836fcde + 38362fd deployed)

3. **Then:**
   - Admin rescore David
   - rescoring_v1 generated ✅
   - rescoring_gpt created ✅
   - Profile rendered with "Concentrated..." ✅

---

## NEXT ACTION REQUIRED

**DO NOT PATCH ANYTHING YET.**

Vercel needs to be triggered to redeploy. Options:
1. Push a new commit (can be a documentation comment change)
2. Trigger Vercel rebuild manually (if UI available)
3. Wait for Vercel's automatic rebuild (may take time)

Once deployed, test:
```bash
# 1. Admin rescore David
curl -X POST https://moremindmap.com/api/admin/rescore-profile \
  -H "Authorization: Bearer $SECRET" \
  -d '{"profile_id":"MM-20260523-mqlev9c9"}'

# 2. Retrieve David
curl https://moremindmap.com/api/moremindmap/retrieve-profile?id=mm-20260523-mqlev9c9

# 3. Check DNA Summary in browser
# Should show: "Concentrated directional topology..."
# NOT: "Balanced multi-system topology..."
```

---

**CONCLUSION: Code is fixed. Production is not deployed. Awaiting Vercel rebuild.**
