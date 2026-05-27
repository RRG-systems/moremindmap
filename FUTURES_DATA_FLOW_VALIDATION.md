# Futures Engine Data Flow Validation

**Date:** 2026-05-27 09:12 MST  
**Status:** ✅ SCHEMA FIX COMPLETE

## Problem Identified

Five Futures cards were not rendering after Futures Engine V1 integration.

**Root Cause:** Schema mismatch between engine output and renderer expectations.

### Engine Output (generateProfileSpecificFutures.js)
```javascript
[
  {
    title: "Momentum Empire",
    likelihood: "likely",
    description: "Speed compounds. Operator-led expansion accelerates.",  // ← Engine field
    consequence: "Organization becomes dependent on tempo.",             // ← Engine field
    profile_specific: true
  },
  // ... 4 more futures
]
```

### Renderer Expected Schema (WebProfileReport.jsx > FiveFuturesRenderer)
```javascript
{
  futures: [
    {
      title: "Momentum Empire",
      likelihood: "likely",
      trajectory: "Speed compounds...",                    // ← Renderer expects this
      organization_experiences: "Organization becomes...", // ← Renderer expects this
      profile_specific: true
    }
  ]
}
```

### Extract Schema (renderContract.js)
```javascript
sourceFields: ['summary', 'futures', 'most_likely']
```
The extractor looks for `domain.futures`, `domain.summary`, `domain.most_likely`.

## Solution Implemented

### 1. Added Normalizer Function (extractIntelligence.js)

```javascript
function normalizeFiveFuturesOutput(futuresArray) {
  if (!Array.isArray(futuresArray) || futuresArray.length === 0) {
    return {
      futures: [],
      summary: 'Future trajectory analysis not available.',
      most_likely: null
    };
  }
  
  // Map engine fields to renderer schema
  const normalized = futuresArray.map(future => ({
    title: future.title,
    likelihood: future.likelihood,
    trajectory: future.description,           // MAPPED
    organization_experiences: future.consequence, // MAPPED
    profile_specific: future.profile_specific
  }));
  
  return {
    futures: normalized,
    summary: 'Five trajectory scenarios emerge from your current operating pattern.',
    most_likely: normalized[0] || null
  };
}
```

### 2. Updated Assignment in extractIntelligence.js

**Before:**
```javascript
fiveFutures: generateProfileSpecificFutures(canonical),
```

**After:**
```javascript
fiveFutures: normalizeFiveFuturesOutput(generateProfileSpecificFutures(canonical)),
```

### 3. Fixed sourceDomain Reference (renderContract.js)

**Before:**
```javascript
sourceDomain: 'fiveFuturesStarter',  // ← Wrong domain name
```

**After:**
```javascript
sourceDomain: 'fiveFutures',  // ← Correct domain name
```

## Data Flow After Fix

```
generateProfileSpecificFutures(canonical)
  ↓ (returns array of 5 futures)
  ↓
normalizeFiveFuturesOutput(array)
  ├─ Maps description → trajectory
  ├─ Maps consequence → organization_experiences
  └─ Wraps in { futures: [...], summary, most_likely }
  ↓
extractIntelligence.domains.fiveFutures = normalized object
  ↓
extractSectionContent('section-five-futures', ..., ...)
  ├─ Looks up renderContract for 'section-five-futures'
  ├─ Finds: sourceDomain = 'fiveFutures'
  ├─ Extracts: domain['summary'], domain['futures'], domain['most_likely']
  └─ Returns: { found: true, content: { summary, futures, most_likely } }
  ↓
PageSevenDashboard receives fiveFuturesBI.content
  ↓
FiveFuturesRenderer({ content })
  ├─ Checks: Array.isArray(content.futures) && content.futures.length > 0
  ├─ Maps each future: { title, likelihood, trajectory, organization_experiences }
  └─ Renders: 5 distinct future cards
```

## Validation

✅ Schema mapping verified with TEST_FUTURES_SCHEMA.js
✅ All 5 futures have required renderer fields
✅ No collateral damage to other systems
✅ Ingress pathways unchanged (FATHOMFREE + Profile ID parity maintained)
✅ Orchestration preserved
✅ Scoring untouched
✅ Canonical generation untouched

## Commits

1. **78d5b5a** - Schema adapter function + field mapping
2. **599737d** - Fix sourceDomain reference

## Expected Result for Test Profiles

### David (MM-20260523-mqlev9c9)
- Five Futures renders: 5 distinct cards
- Card titles: profile-specific (vector/command-focused trajectories)
- No placeholder blocks
- No generic fallback text

### Pamela (mm-20260526-r8362esx)
- Five Futures renders: 5 distinct cards
- Card titles: profile-specific (scenario-based trajectories)
- No placeholder blocks
- FATHOMFREE and Profile ID render identically

### Billybob (mm-20260526-fqxptt3n)
- Five Futures renders: 5 distinct cards
- Card titles: profile-specific (stuck/avoidant-themed trajectories)
- No placeholder blocks
- Full narrative enrichment

## No Code Changes Needed

- ✅ Renderer layout unchanged
- ✅ Futures engine logic unchanged
- ✅ Canonical generation unchanged
- ✅ Vault unchanged
- ✅ Scoring unchanged
- ✅ FATHOMFREE/Profile ID orchestration unchanged
- ✅ Unified interpreter unchanged

This is a **pure schema adapter fix** — no refactoring, no redesign.
