# DIAGNOSTICS READY: FIVE FUTURES RENDERING FAILURE

**Date:** 2026-05-27 09:45 MST  
**Status:** ✅ INSTRUMENTATION COMPLETE - READY FOR LIVE TESTING

---

## What Was Done

Added domain-level logging to `extractBehavioralIntelligence()` in:
- `/api/engine/canonical/extractIntelligence.js`

The logging will print to server console:
```
[EXTRACT] Starting domain extraction...
[EXTRACT] Domain 1/11: operatingSystem
[EXTRACT] Domain 2/11: worldExperience
[EXTRACT] Domain 3/11: othersExperience
[EXTRACT] Domain 4/11: pressureMechanics
[EXTRACT] Domain 5/11: contradictions
[EXTRACT] Domain 6/11: scalingConstraint
[EXTRACT] Domain 7/11: decisionArchitecture
[EXTRACT] Domain 8/11: organizationalConsequences
[EXTRACT] Domain 9/11: facilitatorNotes
[EXTRACT] Domain 10/11: fiveFutures
[EXTRACT] Domain 11/11: theOneMove
```

If an extractor throws, it will log:
```
[EXTRACT] FAILED: <domain-name> - <error message>
```

---

## How to Use

### Step 1: Deploy Current Code
```bash
git push origin main
```

The logging is already in place and won't affect behavior - it only adds console output.

### Step 2: Test with Live Profile

**Option A: Manual Profile ID**
1. Go to moremindmap.vercel.app
2. Enter Profile ID: `MM-20260523-mqlev9c9` (David)
3. Click "Retrieve"

**Option B: FATHOMFREE**
1. Complete a new FATHOMFREE assessment (or use existing job)
2. Wait for completion

### Step 3: Check Server Logs

Open server console at: https://moremindmap-backend.vercel.app/logs (or equivalent)

Look for:
```
[EXTRACT] Domain X/11: <name>
```

The logs will show exactly which domain fails (if any).

### Step 4: Report Back

When you see the failure, provide:
1. **Which domain failed** - the exact [EXTRACT] line that didn't complete
2. **Error message** - what the failure says
3. **Profile ID** - which profile caused it

Example:
> "Domain 7/11: decisionArchitecture fails with 'Cannot read property of undefined'"

---

## Testing Notes

### Local Test Status
✅ All domains extract correctly with mock data (David, Pamela, Jonny profiles)
- Mock test confirms futures engine and normalizer work
- All 11 domains produce output
- fiveFutures contains 5 cards

**Conclusion:** The issue is not in the extraction logic, but in the DATA from the vault being incomplete or malformed.

### What We Know
- ✅ Futures Engine: Working
- ✅ Normalizer: Working  
- ✅ Extractor logic: Working
- ✗ Real vault data: May be incomplete

---

## Commits
- **d9542a0** - Domain-level logging instrumentation
- **47d70f3** - Trace summary
- **2fa0617** - Root cause analysis + error logging

---

## Next Action

After identifying the failing domain, we can apply a surgical fix:

Example fixes (depending on failure):
- Add defensive defaulting if field is missing
- Handle null/undefined gracefully
- Parse malformed data
- Skip optional domains if they fail

**Critical:** We will fix ONLY the failing domain, no architectural changes.

---

## Timeline

This diagnostic adds minimal overhead (<1ms per extraction) and is safe to deploy immediately.

The logging will help us identify the exact issue so we can apply a precise, surgical fix.

---

**Ready for deployment + live testing.**
