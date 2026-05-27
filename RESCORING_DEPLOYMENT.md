# RESCORING DEPLOYMENT: Schema Phase Complete

**Date:** 2026-05-27 12:05 MST  
**Status:** ✅ SCHEMA DEPLOYED - PRODUCTION LIVE

---

## What Was Deployed

### Commits

| Commit | What |
|--------|------|
| 0992bf3 | Schema: Add canonical.rescoring_v1 structure + renderer fallback |
| 28750ab | Doc: Rescoring schema reference |

---

## Exact Changes

### 1. Backend: canonicalProfileGenerator.js

**Added:** Lines 315-365 (51 lines)

**What:**
```javascript
// Baseline audit trail
canonicalProfile.baseline_ranked_dimensions = ranked_dimensions;

// Rescoring schema (empty, ready for population)
canonicalProfile.rescoring_v1 = {
  version: "v1",
  generated_at: null,
  ranked_dimensions: [],
  dominance_profile: { ... },
  spread_profile: { ... },
  tension_pairs: { ... },
  dominance_gravity: { ... },
  amplitude_metrics: { ... },
  render_ready: { ... },
  metadata: { ... }
};
```

**Impact:** Every profile now has rescoring_v1 structure (empty)

---

### 2. Frontend: WebProfileReport.jsx

**Modified:** Lines 1045-1050 (render fallback)

**Before:**
```javascript
const ranked = data.ranked_dimensions || [];
```

**After:**
```javascript
// RESCORING FALLBACK: Use rescored dimensions if available, else baseline
const ranked = data.rescoring_v1?.ranked_dimensions?.length > 0
  ? data.rescoring_v1.ranked_dimensions
  : data.ranked_dimensions 
  || [];
```

**Impact:** All 6 target surfaces automatically use rescored values when available

---

## Current Behavior (After Deployment)

### Visible Output
✓ **NO CHANGE** - All profiles render exactly as before (baseline, no rescoring)

### Behind the Scenes
✓ rescoring_v1 structure available in every canonical  
✓ baseline_ranked_dimensions preserves original for audit  
✓ Renderer fallback chain active (but using baseline)  
✓ Schema ready for rescoring engine  

### Testing

**All profiles:**
- David (MM-20260523-mqlev9c9)
- Pamela (mm-20260526-r8362esx)
- Jonny (mm-20260527-kgppxg8e)

**Should render identically to before** (baseline, no rescoring yet)

---

## Safety Checklist

✅ No baseline scoring logic changed  
✅ No ingress flows modified (FATHOMFREE, Profile ID, Stripe)  
✅ No orchestration affected  
✅ No renderer layout changed  
✅ No visible output changed  
✅ Backward compatible (old profiles get empty rescoring_v1)  
✅ Audit trail preserved (baseline_ranked_dimensions)  

---

## What Happens When Rescoring Engine Runs (Future)

### Schema Will Be Populated

```javascript
canonical.rescoring_v1 = {
  version: "v1",
  generated_at: "2026-05-27T12:10:00Z",
  generation_source: "rescoring_engine_v1",
  
  ranked_dimensions: [
    { dimension: "vector", score: 0.92, rank: 1, ... },
    { dimension: "signal", score: 0.75, rank: 2, ... },
    // ... 6 more
  ],
  
  dominance_profile: { ... },
  // ... rest of fields populated
}
```

### Renderer Will Automatically Switch

```javascript
// Already updated fallback:
const ranked = data.rescoring_v1?.ranked_dimensions?.length > 0
  ? data.rescoring_v1.ranked_dimensions    // ← Will use this when populated
  : data.ranked_dimensions 
  || [];
```

**All 6 target surfaces will render rescored values:**
- 8 DNA boxes
- Command Clarity card
- Speed vs Fidelity card
- Strategic Leverage card
- DNA Summary
- (Profile DNA text would need narrative regeneration)

---

## Production Status

### Live URL
```
https://moremindmap.vercel.app
```

### Latest Commit
```
28750ab
```

### Verified
✅ Deployment successful  
✅ Schema in place  
✅ Fallback chain active  
✅ No errors  
✅ Backward compatible  

---

## Next Phase: Rescoring Engine

When ready to build rescoring logic:

1. Create `/api/engine/rescoring/rescoreDimensions.js`
2. Input: Full canonical dossier
3. Output: Populate `canonical.rescoring_v1`
4. Renderer automatically switches (no changes needed)

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| api/engine/canonical/canonicalProfileGenerator.js | +51 | Added rescoring schema |
| src/components/reports/WebProfileReport.jsx | +5 | Added renderer fallback |

---

## No Changes To

- ✗ Baseline scoring (buildProfileInput.js)
- ✗ Ingress flows
- ✗ Orchestration
- ✗ Renderer layout
- ✗ Canonical schema (only added new optional field)

---

## Documentation Generated

1. **RESCORING_SCHEMA.md** (11 KB)
   - Complete field reference
   - Integration guide
   - Usage examples
   - Testing instructions

2. **This file: RESCORING_DEPLOYMENT.md**
   - Deployment summary
   - What changed
   - Current behavior
   - Next steps

---

## Success Criteria

✅ Schema deployed  
✅ No breaking changes  
✅ Baseline preserved  
✅ Renderer updated  
✅ Production live  
✅ Ready for rescoring engine build  

---

**RESCORING SCHEMA PHASE COMPLETE**

Production is ready for the next phase: rescoring engine implementation.

When the rescoring engine populates `canonical.rescoring_v1.ranked_dimensions`, all 6 target surfaces will automatically render rescored values through the fallback chain already in place.
