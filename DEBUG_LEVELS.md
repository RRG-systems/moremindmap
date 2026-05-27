# DEBUG LEVELS: Five Futures Extraction Chain

**Date:** 2026-05-27 10:10 MST  
**Status:** Multi-layer debugging deployed for extraction chain

---

## Debug Layers (in order of execution)

### Layer 1: Backend - Normalizer Output
**File:** `/api/engine/canonical/extractIntelligence.js`  
**Console:** Server logs (terminal)

```
[NORMALIZE FUTURES] Returning: {
  futures_type: "object",
  futures_isArray: true,
  futures_length: 5,
  has_summary: true,
  has_most_likely: true,
  keys: ['futures', 'summary', 'most_likely']
}
```

**What it tells you:**
- ✅ Normalizer is creating correct structure
- ✅ futures array has 5 items
- ✅ All three keys present

---

### Layer 2: Backend - Domain Assignment
**File:** `/api/engine/canonical/extractIntelligence.js`  
**Console:** Server logs (terminal)

```
[EXTRACT] Domain 10/11: fiveFutures
```

**What it tells you:**
- ✅ Domain extraction reached fiveFutures
- If you don't see this, earlier domain failed

---

### Layer 3: Backend - Field Extraction
**File:** `/src/lib/profile/renderContract.js`  
**Console:** Browser console (DevTools)

```
[EXTRACT SECTION] >>> FIVE FUTURES EXTRACTION START
[EXTRACT SECTION] behavioralIntelligence exists: true
[EXTRACT SECTION] BI.domains keys: ['operatingSystem', 'worldExperience', ..., 'fiveFutures', ...]
[EXTRACT SECTION] BI.domains.fiveFutures exists: true
[EXTRACT SECTION] BI.domains.fiveFutures keys: ['futures', 'summary', 'most_likely']
```

**What it tells you:**
- ✅ Domain exists in BI
- ✅ Domain has all three keys
- If BI is null → extraction fails completely
- If domain is null → falls back to canonical
- If domain keys are wrong → wrong shape

---

### Layer 4: Backend - Field Mapping
**File:** `/src/lib/profile/renderContract.js`  
**Console:** Browser console (DevTools)

```
[EXTRACT FIELDS] domain keys: ['futures', 'summary', 'most_likely']
[EXTRACT FIELDS] requested fields: ['summary', 'futures', 'most_likely']
[EXTRACT FIELDS] extracted: futures = object [Array 5]
[EXTRACT FIELDS] extracted: summary = string
[EXTRACT FIELDS] extracted: most_likely = object
[EXTRACT FIELDS] final extracted keys: ['futures', 'summary', 'most_likely']
```

**What it tells you:**
- ✅ All fields extracted correctly
- ✅ futures is Array(5)
- If a field shows "MISSING:" → wasn't in domain

---

### Layer 5: Backend - Section Extraction Result
**File:** `/src/lib/profile/renderContract.js`  
**Console:** Browser console (DevTools)

```
[EXTRACT SECTION CONTENT] section-five-futures sourceDomain: fiveFutures
[EXTRACT SECTION CONTENT] domain exists: true
[EXTRACT SECTION CONTENT] domain keys: ['futures', 'summary', 'most_likely']
[EXTRACT SECTION CONTENT] extracted content keys: ['futures', 'summary', 'most_likely']
```

**What it tells you:**
- ✅ Section found domain
- ✅ Fields extracted with correct keys
- If "extracted content keys" doesn't include "futures" → field extraction failed

---

### Layer 6: Frontend - Section Content Passed to React
**File:** `/src/components/reports/WebProfileReport.jsx`  
**Console:** Browser console (DevTools)

```
[EXTRACT SECTION] fiveFuturesBI: {found: true, source: 'behavioral_intelligence', domain: 'fiveFutures', content: {...}}
[EXTRACT SECTION] fiveFuturesBI.content.futures: [Array(5)]
```

**What it tells you:**
- ✅ fiveFuturesBI has correct structure
- ✅ content.futures is Array(5)
- ✗ If undefined here → previous layer didn't extract it

---

### Layer 7: Frontend - Renderer Input
**File:** `/src/components/reports/WebProfileReport.jsx`  
**Console:** Browser console (DevTools)

```
[FUTURES RENDERER] content: {futures: Array(5), summary: '...', most_likely: {...}}
[FUTURES RENDERER] content?.futures: Array(5)
[FUTURES RENDERER] Array.isArray(content?.futures): true
[FUTURES RENDERER] content?.futures?.length: 5
[FUTURES RENDERER] First future: {title: '...', likelihood: '...', trajectory: '...', organization_experiences: '...'}
[FUTURES RENDERER] First future keys: ['title', 'likelihood', 'trajectory', 'organization_experiences', 'profile_specific']
```

**What it tells you:**
- ✅ All good - 5 cards render
- ✗ If content?.futures is undefined → Layer 6 failed

---

## Reading the Chain

### GOOD CASE: All Layers Work
```
[NORMALIZE FUTURES] futures_isArray: true, futures_length: 5       ✅
[EXTRACT SECTION] BI.domains.fiveFutures keys: ['futures', ...]   ✅
[EXTRACT FIELDS] extracted: futures = object [Array 5]             ✅
[EXTRACT SECTION CONTENT] extracted content keys: [... 'futures']  ✅
[EXTRACT SECTION] fiveFuturesBI.content.futures: [Array(5)]        ✅
[FUTURES RENDERER] Array.isArray(content?.futures): true           ✅
Result: 5 CARDS RENDER ✅
```

### BAD CASE 1: Domain Missing
```
[EXTRACT SECTION] BI.domains.fiveFutures exists: false             ✗
Result: FALLBACK TO CANONICAL, PROSE BLOCK
```

### BAD CASE 2: Field Not Extracted
```
[EXTRACT FIELDS] MISSING: futures                                  ✗
Result: FUTURES NOT IN EXTRACTED CONTENT
```

### BAD CASE 3: Normalizer Issue
```
[NORMALIZE FUTURES] futures_isArray: false                          ✗
Result: FUTURES FIELD WRONG TYPE
```

---

## How to Test

1. Deploy code
2. Load profile: `https://moremindmap.vercel.app/?profileId=MM-20260523-mqlev9c9`
3. Open DevTools (F12)
4. Go to Console tab
5. Scroll up to see all [EXTRACT...] logs
6. Report the EXACT sequence

---

## Report Format

When you test, send:
1. Profile ID
2. Entry method (Manual ID / FATHOMFREE)
3. **FULL console log output** (copy-paste)
4. Whether Five Futures renders as 5 cards or fallback

---

## Key Points

- **Server logs** show Layer 1-2 (normalizer, domains)
- **Browser console** shows Layer 3-7 (extraction, rendering)
- **Last successful layer** tells us where to fix
- **First failing layer** tells us the root cause

---

**Run test, send logs, and we'll identify exact mismatch.**
