# PATCH READY: Five Futures Extraction Chain Analysis

**Date:** 2026-05-27 10:12 MST  
**Status:** Root cause identification in progress

---

## What We Know

**User reported:**
```
[FUTURES RENDERER] content?.futures: undefined
```

This means FiveFuturesRenderer is called, but its input is missing the futures array.

---

## Extraction Chain

```
generateProfileSpecificFutures() → [5 futures]
            ↓
normalizeFiveFuturesOutput() → {futures: [...], summary: '...', most_likely: {...}}
            ↓
extractIntelligence.domains.fiveFutures = normalized
            ↓
retrieve-profile returns behavioral_intelligence_v1
            ↓
WebProfileReport receives BI
            ↓
extractSectionContent('section-five-futures', BI, canonical)
            ↓ (uses renderContract sourceDomain: 'fiveFutures')
extractFieldsFromDomain(BI.domains.fiveFutures, ['summary', 'futures', 'most_likely'])
            ↓
Returns: {content: {summary: '...', futures: [...], most_likely: {...}}}
            ↓
FiveFuturesRenderer({content}) receives props
```

---

## Possible Failure Points

### 1. Domain Missing
If `BI.domains.fiveFutures` is undefined/null:
- extractSectionContent falls back to canonical
- Canonical fallback field is `'future_trajectory'` (not an array)
- Renderer receives string, not futures array
- Fallback prose block renders

### 2. Field Not Extracted
If extractFieldsFromDomain skips futures:
- Domain has futures, but extraction misses it
- Renderer receives {summary: '...', most_likely: {...}} without futures
- Fallback prose block renders

### 3. Wrong Field Name
If renderContract sourceDomain is wrong:
- Points to wrong domain or non-existent domain
- Falls back to canonical
- Renderer receives wrong shape

### 4. Normalizer Returns Wrong Shape
If normalizeFiveFuturesOutput doesn't return {futures: [...]}:
- Domain has wrong structure
- extractFieldsFromDomain gets undefined when looking for futures
- Renderer receives {summary: '...', most_likely: {...}} without futures

---

## Deployed Debug Instrumentation

✅ **Layer 1 (Backend):** Normalizer logs its output
✅ **Layer 2 (Backend):** Domain assignment logs
✅ **Layer 3 (Frontend):** Five Futures specific extraction logging
✅ **Layer 4 (Frontend):** Field extraction detailed logging
✅ **Layer 5 (Frontend):** Section content result logging
✅ **Layer 6 (Frontend):** Section content passed to React
✅ **Layer 7 (Frontend):** Renderer input logging

---

## Next Action Required

Run ONE of the three profiles with detailed console logging:

```bash
# Test David
https://moremindmap.vercel.app/?profileId=MM-20260523-mqlev9c9
```

1. Open DevTools (F12)
2. Go to Console tab
3. Scroll to see all [EXTRACT...] and [NORMALIZE...] logs
4. Check server logs for [EXTRACT] Domain lines
5. Report the EXACT sequence

---

## Most Likely Fixes

Based on failure pattern, surgical fixes will be ONE OF:

### Fix A: Domain Path Wrong
```javascript
// If BI.domains.fiveFutures doesn't exist
// Change renderContract:
sourceDomain: 'fiveFuturesStarter'  // or correct domain name
```

### Fix B: Field Name Wrong
```javascript
// If futures extracted as different name
sourceFields: ['summary', 'five_futures', 'most_likely']  // or correct name
```

### Fix C: Normalizer Field Missing
```javascript
// If futures not in normalized output
return {
  futures: normalized,  // ensure this line exists
  ...
}
```

### Fix D: Extraction Fallback Active
```javascript
// If it's falling back to canonical
// Check if BI is null or domain is null
// Add defensive wrapping
```

---

## Commits Ready

- **319d0f9** - Normalizer output logging
- **d2ba801** - Five Futures specific extraction tracing
- **2d1e1a6** - Section extraction logging
- **b87623b** - Field extraction logging
- **4aa122e** - Debug levels documentation

---

## Timeline to Fix

1. ⏳ Test and get console logs
2. ⏳ Identify exact failure point
3. ✅ Apply 1-line surgical fix
4. ✅ Test on all 3 profiles
5. ✅ Remove debug logging
6. ✅ Commit fix

---

**Awaiting test results. Once we see the exact mismatch, the fix is 1-3 lines.**
