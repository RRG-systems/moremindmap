# TRACE STATUS: FIVE FUTURES RENDERING MISMATCH

**Date:** 2026-05-27 09:52 MST  
**Status:** INSTRUMENTATION COMPLETE - AWAITING LIVE TEST DATA

---

## Summary of Investigation

### What We Know ✅

1. **Futures Engine:** Works correctly
   - generateProfileSpecificFutures returns 5 futures
   - Each has: title, likelihood, description, consequence

2. **Normalizer:** Works correctly
   - Maps description → trajectory
   - Maps consequence → organization_experiences
   - Wraps in {futures: [...], summary, most_likely}

3. **Data Flow:** Correct in theory
   - Mock tests show all domains extract
   - All 11 extractors work
   - behavioral_intelligence builds correctly

4. **Renderer Mounts:** Successfully
   - Section header renders
   - Component doesn't crash
   - Therefore FiveFuturesRenderer function executes

5. **Fallback System:** Activates
   - Single prose block renders (InsightPanel)
   - Means Array.isArray(content.futures) check fails
   - Content.futures is either: undefined, null, empty, or wrong shape

---

## Current Hypothesis

The shape mismatch is ONE of:

| Scenario | Symptom | Likely Cause |
|----------|---------|--------------|
| content.futures undefined | No array check passes | extractSectionContent not extracting futures key |
| content.futures empty | Array but length 0 | normalizer returned empty array |
| content.futures wrong shape | Array but wrong fields | normalizer mapping incorrect |
| content.futures nested wrong | Double nested | wrapping structure error |
| content.summary exists | Falls to summary | futures path never taken |

---

## Instrumentation Deployed

### Layer 1: extractSectionContent Output
```javascript
// Line ~407 in WebProfileReport.jsx
console.log('[EXTRACT SECTION] fiveFuturesBI:', fiveFuturesBI);
console.log('[EXTRACT SECTION] fiveFuturesBI.content.futures:', fiveFuturesBI.content.futures);
```

**Shows:** What came out of extractSectionContent (does it have futures?)

### Layer 2: FiveFuturesRenderer Input
```javascript
// Line ~747 in WebProfileReport.jsx
console.log('[FUTURES RENDERER] content:', content);
console.log('[FUTURES RENDERER] content?.futures:', content?.futures);
console.log('[FUTURES RENDERER] Array.isArray(content?.futures):', Array.isArray(content?.futures));
console.log('[FUTURES RENDERER] content?.futures?.length:', content?.futures?.length);
if (content?.futures?.[0]) {
  console.log('[FUTURES RENDERER] First future:', content.futures[0]);
  console.log('[FUTURES RENDERER] First future keys:', Object.keys(content.futures[0]));
}
```

**Shows:** Exact shape the renderer receives

---

## Next Steps (Action Items)

### Step 1: Live Test
1. Deploy current code (debug logging only)
2. Load profile: MM-20260523-mqlev9c9 (David)
3. Open browser console
4. Note [EXTRACT SECTION] and [FUTURES RENDERER] output

### Step 2: Identify Mismatch
Report exact console output:
- What does fiveFuturesBI.content look like?
- What does content?.futures contain?
- Does Array.isArray return true or false?

### Step 3: Apply Surgical Fix
Likely locations for fix:
- extractSectionContent (if futures not being extracted)
- normalizeFiveFuturesOutput (if wrong shape)
- renderContract (if sourceDomain wrong)

### Step 4: Validate
Test on all 3 profiles:
- David (MM-20260523-mqlev9c9)
- Pamela (mm-20260526-r8362esx)
- Jonny (mm-20260527-kgppxg8e)

Success: 5 cards render, no fallback.

---

## What Will NOT Change

❌ Renderer logic (beyond shape fix)
❌ Futures engine
❌ Normalizer logic
❌ Canonical generation
❌ Orchestration
❌ Ingress parity
❌ Vault
❌ Scoring

✅ ONLY: The broken shape mapping (1-3 lines)

---

## Commits

- **ccd3a04** - TEMP DEBUG: FiveFuturesRenderer shape tracing
- **569abcf** - DEBUG GUIDE
- **7b229da** - Test cases + diagnostics
- **d9542a0** - Domain-level logging instrumentation
- **47d70f3** - Trace summary
- **2fa0617** - Root cause analysis
- **d806944** - Validation documentation
- **599737d** - Fix sourceDomain reference
- **78d5b5a** - Schema adapter

---

## Documentation

- **DEBUG_GUIDE.md** - How to test and what to look for
- **ROOT_CAUSE_REPORT.md** - Complete failure chain
- **DIAGNOSTIC_READY.md** - Earlier diagnostics
- **TRACE_SUMMARY.md** - Overall trace result

---

## Timeline

| Phase | Status | What |
|-------|--------|------|
| Trace | ✅ Complete | Identified renderer fallback |
| Instrument | ✅ Complete | Added shape debugging |
| Test | ⏳ Pending | Run on live profiles |
| Identify | ⏳ Pending | See exact mismatch |
| Fix | ⏳ Pending | Apply 1-3 line surgical fix |
| Validate | ⏳ Pending | Confirm 5 cards render |

---

## Expected Fix Size

**Before Fix:**
```javascript
// Something returns wrong shape
fiveFutures: normalizeFiveFuturesOutput(...)
// Result: content.futures undefined or wrong
```

**After Fix:**
```javascript
// Minimal adapter or mapping fix
fiveFutures: wrapFuturesCorrectly(normalizeFiveFuturesOutput(...))
// Result: content.futures is correct array with 5 items
```

**Lines Changed:** 1-3
**Files Affected:** 1 (likely extractIntelligence.js or renderContract.js)

---

**Ready for deployment + live testing.**
