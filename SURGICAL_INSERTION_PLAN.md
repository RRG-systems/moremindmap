# SURGICAL GPT-5.5 RESCORING INSERTION PLAN

**Status:** ✅ PLAN COMPLETE - READY FOR BUILD

---

## MISSION CRITICAL: ZERO BREAKING CHANGES

This plan ensures:
- ✅ Baseline scoring completely untouched
- ✅ Existing rescoring_v1 layer untouched
- ✅ Renderer fallback chain extended (additive only)
- ✅ New field `rescoring_gpt` isolated
- ✅ All changes behind feature flag
- ✅ Rollback possible with single env var

---

## BUILD PHASES (MINIMAL ORDER)

### Phase 1: Backend Endpoint (New)

**File:** `/api/moremindmap/rescoring-gpt.js`

**What:** New backend endpoint for GPT behavioral rescoring

**Size:** ~150 lines

**Function:**
```javascript
export default async function handler(req, res) {
  // POST /api/moremindmap/rescoring-gpt
  // Input: { canonical, profile_id }
  // Output: { rescoring_gpt object } or { error }
  
  // 1. Validate canonical input
  // 2. Call rescoreDimensionsWithGPT(canonical)
  // 3. Return rescoring_gpt object
  // 4. Error handling with graceful fallback
}
```

**No changes to:** canonical generation, baseline, ingress, orchestration

---

### Phase 2: Rescoring Function (New)

**File:** `/api/engine/rescoring/rescoreDimensionsWithGPT.js`

**What:** Main GPT rescoring engine

**Size:** ~200 lines

**Function:**
```javascript
export async function rescoreDimensionsWithGPT(canonical) {
  // 1. Validate canonical has rescoring_v1
  // 2. Build GPT prompt (structured)
  // 3. Call GPT-5.5 via existing callGPT55 pattern
  // 4. Validate response structure
  // 5. Validate grounding (no hallucinations)
  // 6. Return rescoring_gpt object
  // 7. Catch errors, return null (safe fallback)
}
```

**Imports:**
- `callGPT55` from `/src/lib/narrativeV3/openaiIntegration.js` (existing)
- `validateGrounding` from same (existing)

**No changes to:** canonical generation, baseline, ingress, orchestration

---

### Phase 3: Integration Point (Minimal Edit)

**File:** `/api/engine/canonical/canonicalProfileGenerator.js`

**Change:** Add 8 lines after line 388

```javascript
// AFTER THIS:
try {
  canonicalProfile.rescoring_v1 = rescoreDimensions(canonicalProfile);
} catch (rescoreErr) {
  console.error('[CANONICAL] Rescoring failed:', rescoreErr.message);
}

// ADD THIS:
// GPT RESCORING (async, background, optional)
if (process.env.GPT_RESCORING_ENABLED === 'true') {
  try {
    const { rescoreDimensionsWithGPT } = await import('../rescoring/rescoreDimensionsWithGPT.js');
    // Fire async (don't await - let it complete in background)
    rescoreDimensionsWithGPT(canonicalProfile).then(result => {
      if (result) {
        canonicalProfile.rescoring_gpt = result;
        // Schedule redis.update to save rescoring_gpt (non-blocking)
      }
    }).catch(err => {
      console.error('[CANONICAL] GPT rescoring background task failed:', err.message);
    });
  } catch (importErr) {
    console.error('[CANONICAL] Failed to import GPT rescoring:', importErr.message);
  }
}
```

**Impact:** 
- ✅ GPT rescoring is optional (env flag)
- ✅ Non-blocking (fire-and-forget)
- ✅ Canonical returns immediately with or without rescoring_gpt
- ✅ rescoring_gpt available on next retrieval (if GPT completes)

**No changes to:** baseline, ingress, orchestration, vault save, renderer logic (yet)

---

### Phase 4: Renderer Fallback Enhancement (Minimal Edit)

**File:** `/src/components/reports/WebProfileReport.jsx`

**Change:** Update line 1096 (fallback chain)

```javascript
// BEFORE:
const ranked = data.rescoring_v1?.ranked_dimensions?.length > 0
  ? data.rescoring_v1.ranked_dimensions
  : data.ranked_dimensions 
  || [];

// AFTER:
const ranked = data.rescoring_gpt?.ranked_dimensions?.length > 0
  ? data.rescoring_gpt.ranked_dimensions
  : data.rescoring_v1?.ranked_dimensions?.length > 0
    ? data.rescoring_v1.ranked_dimensions
    : data.ranked_dimensions 
    || [];
```

**Impact:**
- ✅ Adds GPT layer to fallback chain
- ✅ Deterministic layer still available
- ✅ Baseline still available
- ✅ Zero breaking changes
- ✅ Renderer automatically prioritizes GPT when available

**No changes to:** scoring logic, ingress, orchestration, baseline

---

### Phase 5: Environment Configuration (No Code)

**Add to `.env.production`:**
```
GPT_RESCORING_ENABLED=false    # Initially off for safety
```

**Add to `.env.development`:**
```
GPT_RESCORING_ENABLED=true     # On for testing
```

**Deployment Control:**
- Set to `false` at deployment (feature flag OFF)
- GPT rescoring layer will not run
- All code in place, but not active
- Zero performance impact when disabled

---

## BUILD ORDER (SAFEST SEQUENCE)

1. ✅ Create `/api/moremindmap/rescoring-gpt.js` endpoint
2. ✅ Create `/api/engine/rescoring/rescoreDimensionsWithGPT.js` function
3. ✅ Add 8-line integration to `canonicalProfileGenerator.js`
4. ✅ Update renderer fallback in `WebProfileReport.jsx`
5. ✅ Add env vars to `.env` files
6. ✅ Test with feature flag OFF (should have zero impact)
7. ✅ Test with feature flag ON (should use GPT when available)
8. ✅ Deploy with flag OFF by default
9. ✅ Monitor metrics
10. ✅ Enable flag for beta users
11. ✅ Full rollout after validation

---

## ROLLBACK STRATEGY

**If anything breaks:**

**Immediate:** Set `GPT_RESCORING_ENABLED=false`
- GPT rescoring stops running
- All profiles render with rescoring_v1 or baseline
- No code changes needed
- Zero impact

**Full Rollback:** Revert commits in reverse order
- Revert renderer fallback (back to V1 only)
- Revert integration point (remove GPT call)
- Remove new files
- Production continues with V1 rescoring only

**Minimal Risk:** Because GPT layer is:
- Optional (feature flag)
- Non-blocking (async background)
- Isolated (new field, no overwrites)
- Fallback-safe (renderer has fallback chain)

---

## VALIDATION STRATEGY

### Test Case 1: GPT Disabled (OFF)

**Setup:** `GPT_RESCORING_ENABLED=false`

**Expected:**
- ✅ canonical.rescoring_gpt field never created
- ✅ Renderer uses rescoring_v1 (deterministic)
- ✅ All profiles render identically to before
- ✅ No latency change
- ✅ No API calls to OpenAI

**Verification:**
```javascript
console.log(canonical.rescoring_gpt);  // undefined
console.log(canonical.rescoring_v1);   // populated (existing)
```

### Test Case 2: GPT Enabled (ON)

**Setup:** `GPT_RESCORING_ENABLED=true`

**Expected:**
- ✅ GPT rescoring runs in background
- ✅ canonical returned immediately (don't wait)
- ✅ rescoring_gpt populated after ~2-3 seconds
- ✅ Renderer can use rescoring_gpt if available
- ✅ First load might use V1, second load uses GPT

**Verification:**
```javascript
// First load
console.log(canonical.rescoring_gpt);  // undefined or undefined
console.log(canonical.rescoring_v1);   // populated

// Wait 3 seconds, retrieve same profile
console.log(canonical.rescoring_gpt);  // populated!
console.log(canonical.rescoring_v1);   // still populated
```

### Test Case 3: Fallback Chain

**Setup:** Mix of profiles (some with rescoring_gpt, some without)

**Test:**
- Load profile1 (has rescoring_gpt)
  - Renderer: GPT layer → render GPT dimensions
- Load profile2 (no rescoring_gpt yet)
  - Renderer: V1 layer → render V1 dimensions
- Load old profile3 (created before GPT layer)
  - Renderer: baseline → render baseline dimensions

**Expected:** All render without errors, fallback chain works

**Verification:** All three render successfully

### Test Case 4: GPT Error Handling

**Setup:** GPT API down or fails

**Test:**
- canonical.rescoring_gpt remains null
- No error propagates to user
- Profiles render with V1 or baseline
- No visual glitches

**Expected:** Silent fallback, no breakage

**Verification:**
```javascript
console.log(canonical.rescoring_gpt);  // null (not undefined, tried but failed)
// Renderer still renders fine with V1
```

---

## BLAST RADIUS ANALYSIS

### If Integration Point Fails

**Current Code:**
```javascript
// DETERMINISTIC RESCORING
canonicalProfile.rescoring_v1 = rescoreDimensions(...);
```

**With GPT (guarded):**
```javascript
canonicalProfile.rescoring_v1 = rescoreDimensions(...);

if (process.env.GPT_RESCORING_ENABLED === 'true') {
  try {
    // GPT code...
  } catch (err) {
    // Fail silently, canonical already returned
  }
}
```

**Blast Radius:** ZERO
- If GPT code fails → caught
- Canonical still returned successfully
- rescoring_v1 still available
- Renderer still works

### If Renderer Fallback Fails

**Current Code:**
```javascript
const ranked = data.rescoring_v1?.ranked_dimensions?.length > 0
  ? data.rescoring_v1.ranked_dimensions
  : data.ranked_dimensions 
  || [];
```

**With GPT:**
```javascript
const ranked = data.rescoring_gpt?.ranked_dimensions?.length > 0
  ? data.rescoring_gpt.ranked_dimensions
  : data.rescoring_v1?.ranked_dimensions?.length > 0
    ? data.rescoring_v1.ranked_dimensions
    : data.ranked_dimensions 
    || [];
```

**Blast Radius:** ZERO
- If rescoring_gpt is malformed → skipped, V1 used
- If rescoring_gpt missing → skipped, V1 used
- If rescoring_v1 missing → skipped, baseline used
- Default fallback always works

---

## MONITORING (POST-DEPLOYMENT)

**Metrics to Track:**

1. **GPT Call Success Rate**
   - % of profiles where rescoring_gpt populated
   - Target: >95%

2. **GPT Latency**
   - Average time for rescoring_gpt to complete
   - Target: <3 seconds

3. **Rendering Performance**
   - No new errors/exceptions
   - Fallback chain working correctly
   - Target: 0 new error types

4. **User Experience**
   - Profile load time (should be unchanged)
   - Report rendering (should be unchanged)
   - Display quality (should be improved)

**Alerts:**
- If GPT success rate < 90%
- If GPT latency > 5 seconds
- If new exceptions appear in renderer
- If fallback chain broken

---

## COMMIT STRATEGY

**Commit 1:** Add GPT rescoring endpoint
```
git commit -m "FEAT: Add GPT-5.5 rescoring endpoint - fire-and-forget background task"
```

**Commit 2:** Add rescoring function
```
git commit -m "FEAT: Add rescoreDimensionsWithGPT function - behavioral cognitive interpretation"
```

**Commit 3:** Integrate into canonical generation
```
git commit -m "FEAT: Integrate GPT rescoring into canonical generation (behind feature flag)"
```

**Commit 4:** Update renderer fallback
```
git commit -m "FEAT: Extend renderer fallback chain for GPT rescoring (additive only)"
```

**Commit 5:** Add documentation
```
git commit -m "DOC: GPT-5.5 rescoring insertion plan and architecture"
```

**All commits:** Feature flag disabled by default

---

## PRODUCTION DEPLOYMENT CHECKLIST

- [ ] All code changes committed & reviewed
- [ ] Feature flag `.env.production` set to `false`
- [ ] Feature flag `.env.development` set to `true`
- [ ] Monitoring alerts configured
- [ ] Rollback procedure documented
- [ ] Team notified of changes
- [ ] Initial deployment with flag OFF
- [ ] Verify no impact on profiles (flag OFF)
- [ ] Enable flag for 10% of users (beta)
- [ ] Monitor metrics for 24 hours
- [ ] If stable, expand to 50% of users
- [ ] Monitor 24 hours
- [ ] Full rollout (100% of users)

---

## SUCCESS CRITERIA

✅ All phases built without breaking existing systems  
✅ Feature flag controls execution (OFF = zero GPT impact)  
✅ Renderer fallback chain extended (additive only)  
✅ Baseline scoring completely untouched  
✅ rescoring_v1 completely untouched  
✅ Ingress completely untouched  
✅ Orchestration completely untouched  
✅ Vault save unaffected  
✅ Retrieval unaffected  
✅ Profiles render correctly with or without rescoring_gpt  
✅ Rollback possible with single env var change  
✅ Zero breaking changes introduced  

---

**SURGICAL INSERTION PLAN COMPLETE - READY FOR BUILD EXECUTION**
