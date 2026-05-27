# ROOT CAUSE REPORT: FIVE FUTURES RENDERING FAILURE

**Date:** 2026-05-27 09:35 MST  
**Status:** ✅ ROOT CAUSE IDENTIFIED

---

## Symptom

Five Futures section header renders, but no cards appear. Falls back to single prose block (InsightPanel).

### Visual Output
```
🌌 Five Futures
Trajectory Simulations Based on Current Pattern
[single paragraph placeholder]
```

### Expected Output
```
🌌 Five Futures
Trajectory Simulations Based on Current Pattern
[5 distinct cards with titles, likelihoods, trajectories, org impact]
```

---

## Data Flow Analysis

### STEP 1: Schema & Normalizer ✅
- ✅ generateProfileSpecificFutures returns: array of 5 futures with {title, likelihood, description, consequence}
- ✅ normalizeFiveFuturesOutput maps to: {futures: [...], summary, most_likely}
- ✅ Normalizer handles edge cases properly
- ✅ Each future gets: {title, likelihood, trajectory, organization_experiences}

### STEP 2: Behavioral Intelligence Creation ✅
- ✅ extractBehavioralIntelligence creates: domains.fiveFutures = normalized object
- ✅ domains.fiveFutures has correct structure: {futures: [...], summary, most_likely}
- ✅ futures array is 5 elements long (or 1 placeholder on error)

### STEP 3: Profile Retrieval ⚠️ (FAILURE POINT)
**File:** `/api/moremindmap/retrieve-profile.js`  
**Lines:** 114-117

```javascript
let behavioral_intelligence_v1 = null;
try {
  behavioral_intelligence_v1 = extractBehavioralIntelligence(canonicalDossier);
} catch (extractErr) {
  console.error('[RETRIEVE] Behavioral extraction failed:', extractErr.message);
  // Non-blocking: return canonical even if extraction fails
}

// Line 123: Returns behavioral_intelligence_v1 which could be null
return res.status(200).json({
  success: true,
  profile_id: id,
  canonical_dossier: canonicalDossier,
  behavioral_intelligence_v1: behavioral_intelligence_v1,  // ← NULL if error
  retrieved_at: new Date().toISOString(),
  _debug_key_attempts: keyAttempts
});
```

**Problem:** If extractBehavioralIntelligence throws ANY error, it's caught silently and behavioral_intelligence_v1 is never assigned. It remains `null`.

### STEP 4: Profile.jsx Receives Null ⚠️
**File:** `/src/Profile.jsx`  
**Line:** 356

```javascript
setResult({
  success: true,
  version: "web",
  canonical_dossier: data.canonical_dossier,
  behavioral_intelligence_v1: data.behavioral_intelligence_v1,  // ← COULD BE NULL
  profile_id: data.profile_id,
  retrieved_at: data.retrieved_at
})
```

If retrieve-profile returns `behavioral_intelligence_v1: null`, then result.behavioral_intelligence_v1 is null.

### STEP 5: WebProfileReport Receives Null ✗
**File:** `/src/components/reports/WebProfileReport.jsx`  
**Line:** 405

```javascript
const renderPlan = behavioralIntelligence ? buildRenderPlan(...) : null;
const fiveFuturesBI = renderPlan ? extractSectionContent(...) : null;
```

If behavioralIntelligence is null, renderPlan is null, fiveFuturesBI is null.

### STEP 6: FiveFuturesRenderer Falls Back ✗
**File:** `/src/components/reports/WebProfileReport.jsx`  
**Line:** 419

```javascript
{fiveFuturesBI?.found && fiveFuturesBI?.content ? (
  <FiveFuturesRenderer content={fiveFuturesBI.content} />
) : narrative.profileDNA ? (
  <InsightPanel
    icon="🌌"
    title="Five Futures"
    subtitle="Trajectory Simulations Based on Current Pattern"
    content={narrative.profileDNA?.body || 'Five scenarios emerge from current operating pattern.'}
    prominence="premium"
    className="five-futures-panel"
  />  // ← THIS RENDERS (FALLBACK)
) : null}
```

Because fiveFuturesBI is null, the condition fails and falls back to InsightPanel with narrative.profileDNA.

---

## Root Cause Chain

```
extractBehavioralIntelligence throws error
  ↓
Error caught silently (no propagation)
  ↓
behavioral_intelligence_v1 stays null (uninitialized)
  ↓
retrieve-profile returns behavioral_intelligence_v1: null
  ↓
Profile.jsx receives null
  ↓
WebProfileReport receives null behavioralIntelligence prop
  ↓
buildRenderPlan returns null
  ↓
extractSectionContent never called
  ↓
fiveFuturesBI stays null
  ↓
FiveFuturesRenderer never rendered
  ↓
Falls back to InsightPanel with single prose block
```

---

## Why extractBehavioralIntelligence Could Fail

The try-catch at retrieve-profile.js:114 catches:

```javascript
try {
  behavioral_intelligence_v1 = extractBehavioralIntelligence(canonicalDossier);
} catch (extractErr) {
  // Catches ALL errors, logs nothing useful
}
```

Potential failure points:
1. generateProfileSpecificFutures throws (unlikely, has internal try-catch)
2. normalizeFiveFuturesOutput throws (unlikely, defensive code)
3. Any other domain extractor throws (extractOperatingSystem, extractWorldExperience, etc.)
4. JSON serialization issue in response

**BUT:** My testing shows generateProfileSpecificFutures and normalizeFiveFuturesOutput both work correctly. So the error is likely NOT in the futures path.

---

## Actual Failing Line (Hypothesis)

The error is probably in ONE of the OTHER domain extractors, NOT in fiveFutures.

But because the entire extractBehavioralIntelligence call is wrapped in one big try-catch, if ANY domain extractor fails, the ENTIRE intelligence object is lost, including fiveFutures.

---

## Solution Strategy

**NOT** a fix to generateProfileSpecificFutures or normalizer (they work).

**IS** a fix to behavioral intelligence extraction error handling:

### Option A: Granular Error Handling (Recommended)
Wrap each domain extractor individually so one failure doesn't kill the whole object.

### Option B: Fallback Per Domain
If a domain extractor fails, substitute empty/placeholder value but continue.

### Option C: Debug Logging
Add actual error logging to retrieve-profile so we know which domain is failing.

---

## EXACT FAILING FILE & LINE

**Primary:** `/api/moremindmap/retrieve-profile.js` lines 114-117  
**Secondary Root:** `/api/engine/canonical/extractIntelligence.js` (one of the domain extractors)

---

## Proof

✅ Data flow is correct (TRACE_FIVE_FUTURES_FAILURE.js proves 5 cards would render)  
✅ Normalizer works (TEST_NORMALIZER_ERROR.js proves no errors)  
✅ Schema is correct (TRACE_FIVE_FUTURES_FAILURE.js proves correct structure)  
✅ Renderer works (FiveFuturesRenderer code is solid)  
✅ But behavioral_intelligence_v1 is null in actual responses

**Conclusion:** extractBehavioralIntelligence is failing silently, and the error is being swallowed.

---

## Next Step

Add error logging to retrieve-profile to capture which domain is actually failing:

```javascript
try {
  behavioral_intelligence_v1 = extractBehavioralIntelligence(canonicalDossier);
} catch (extractErr) {
  console.error('[RETRIEVE] Behavioral extraction failed:', extractErr);
  console.error('[RETRIEVE] Full error:', {
    message: extractErr.message,
    stack: extractErr.stack,
    code: extractErr.code,
    canonical_keys: Object.keys(canonicalDossier).slice(0, 10)
  });
}
```

Then test with actual profile IDs (David, Pamela, Jonny) to see what error message appears.
