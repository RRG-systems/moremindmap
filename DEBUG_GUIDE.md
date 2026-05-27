# DEBUG GUIDE: FIVE FUTURES RENDERING SHAPE MISMATCH

**Date:** 2026-05-27 09:50 MST  
**Status:** ✅ DEBUG INSTRUMENTATION DEPLOYED

---

## What Was Added

Two layers of debug logging to trace the exact content shape:

### Layer 1: Section Content Extraction (Line 407)
```javascript
const fiveFuturesBI = renderPlan ? extractSectionContent(...) : null;

// NEW DEBUG:
console.log('[EXTRACT SECTION] fiveFuturesBI:', fiveFuturesBI);
if (fiveFuturesBI?.content) {
  console.log('[EXTRACT SECTION] fiveFuturesBI.content keys:', Object.keys(fiveFuturesBI.content));
  console.log('[EXTRACT SECTION] fiveFuturesBI.content.futures:', fiveFuturesBI.content.futures);
}
```

**Shows:** What extractSectionContent returns (the extracted data structure)

### Layer 2: FiveFuturesRenderer (Line 747)
```javascript
function FiveFuturesRenderer({ content }) {
  // NEW DEBUG:
  console.log('[FUTURES RENDERER] content:', content);
  console.log('[FUTURES RENDERER] content?.futures:', content?.futures);
  console.log('[FUTURES RENDERER] Array.isArray(content?.futures):', Array.isArray(content?.futures));
  console.log('[FUTURES RENDERER] content?.futures?.length:', content?.futures?.length);
  if (content?.futures?.[0]) {
    console.log('[FUTURES RENDERER] First future:', content.futures[0]);
    console.log('[FUTURES RENDERER] First future keys:', Object.keys(content.futures[0]));
  }
```

**Shows:** What the renderer actually receives (prop shape)

---

## How to Test

### Step 1: Load a Profile

**Option A - Manual Profile ID:**
```
https://moremindmap.vercel.app/?profileId=MM-20260523-mqlev9c9
```

**Option B - FATHOMFREE:**
- Complete assessment or load existing job result

### Step 2: Open Browser Console

Open DevTools:
- **Chrome/Edge:** F12 → Console tab
- **Firefox:** F12 → Console tab
- **Safari:** Cmd+Option+I → Console tab

### Step 3: Trigger Profile Load

- Manual: Enter profile ID and click "Load"
- FATHOMFREE: Wait for assessment completion

### Step 4: Look for Debug Output

In browser console, you'll see something like:

```
[EXTRACT SECTION] fiveFuturesBI: {found: true, content: {...}}
[EXTRACT SECTION] fiveFuturesBI.content keys: ['futures', 'summary', 'most_likely']
[EXTRACT SECTION] fiveFuturesBI.content.futures: [Array(5)]

[FUTURES RENDERER] content: {futures: [...], summary: '...', most_likely: {...}}
[FUTURES RENDERER] content?.futures: [Array(5)]
[FUTURES RENDERER] Array.isArray(content?.futures): true
[FUTURES RENDERER] content?.futures?.length: 5
[FUTURES RENDERER] First future: {title: '...', likelihood: '...', trajectory: '...', organization_experiences: '...'}
[FUTURES RENDERER] First future keys: ['title', 'likelihood', 'trajectory', 'organization_experiences', 'profile_specific']
```

---

## What to Look For

### GOOD CASE (Should Render 5 Cards)
```
[EXTRACT SECTION] content.futures: [Array(5)]        ✓
[FUTURES RENDERER] Array.isArray(...futures): true    ✓
[FUTURES RENDERER] content?.futures?.length: 5        ✓
[FUTURES RENDERER] First future keys: [...trajectory, ...organization_experiences]  ✓
```
→ 5 cards render

### BAD CASE 1: Empty Array
```
[EXTRACT SECTION] content.futures: []                 ✗
[FUTURES RENDERER] content?.futures?.length: 0        ✗
```
→ Falls back to InsightPanel (prose block)

### BAD CASE 2: Undefined Futures
```
[EXTRACT SECTION] content.futures: undefined          ✗
[FUTURES RENDERER] Array.isArray(content?.futures): false  ✗
```
→ Falls back to InsightPanel

### BAD CASE 3: Wrong Field Names
```
[FUTURES RENDERER] First future keys: ['content', 'title', ...]  ✗ (wrong shape)
```
→ Cards render but with wrong data

### BAD CASE 4: Nested Incorrectly
```
[EXTRACT SECTION] content.futures: {futures: [...]}   ✗ (double nested)
```
→ Falls back to InsightPanel

---

## Profiles to Test

Test these three profiles in order:

| Profile | ID | Type |
|---------|----|----|
| David | MM-20260523-mqlev9c9 | Manual ID |
| Pamela | mm-20260526-r8362esx | Manual ID |
| Jonny | mm-20260527-kgppxg8e | Manual ID |

For each:
1. Load profile
2. Open console
3. Scroll for [EXTRACT SECTION] and [FUTURES RENDERER] logs
4. Note the exact shape

---

## What to Report Back

When you see the fallback rendering, provide:

```
Profile: David / Pamela / Jonny
Entry: Manual ID / FATHOMFREE

[EXTRACT SECTION] output:
- fiveFuturesBI.found: [true/false]
- content.futures type: [Array/Object/undefined]
- content.futures length: [number/N/A]

[FUTURES RENDERER] output:
- content?.futures value: [Array/Object/null/undefined]
- Array.isArray result: [true/false]
- First future keys: [list of keys]
```

Example report:
> David / Manual ID
> [EXTRACT SECTION] fiveFuturesBI.found: true, content.futures: undefined
> [FUTURES RENDERER] Array.isArray: false, content?.futures: undefined

---

## What This Tells Us

Each debug output reveals exactly where the mismatch is:

| Symptom | Cause | Fix Location |
|---------|-------|--------------|
| content.futures undefined | Schema mismatch in extractor | extractSectionContent |
| content.futures empty array | Normalizer returned empty array | normalizeFiveFuturesOutput |
| Wrong field names | Normalizer mapping wrong | normalizer field mapping |
| Double-nested | Wrong wrapping structure | extractIntelligence assignment |

---

## Timeline

1. ✅ Instrumentation deployed
2. ⏳ Test against 3 profiles
3. ⏳ Review console logs
4. ⏳ Identify exact mismatch
5. ⏳ Apply surgical fix (1-2 lines)
6. ✅ Validate (5 cards render)

---

## Commits

- **ccd3a04** - TEMP DEBUG: FiveFuturesRenderer shape tracing

---

## Remember

- ✅ This is TEMPORARY debug code (will remove after fix)
- ✅ NO production logic changed
- ✅ NO architecture modified
- ✅ Safe to deploy immediately
- ✅ Browser console output only

Once we see the exact mismatch, the fix will be 1-3 lines in ONE location.

---

**Ready for live testing. Report console output and we'll apply surgical fix.**
