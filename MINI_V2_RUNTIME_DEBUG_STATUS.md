# MINI V2 RUNTIME DEBUG STATUS

**Last Updated:** Mon May 18, 2026 15:48 MST  
**Current HEAD:** `18421e1`  
**Status:** STEP 1 FIELD POPULATION — Late Stage Debugging

---

## CURRENT STATE

### ✅ WORKING INFRASTRUCTURE

**Frontend:**
- Repo: `RRG-systems/moremindmap`
- Path: `/Users/rrg/.openclaw/workspace/moremindmap-live`
- Assessment flow: ✅ Complete
- FATHOMFREE routing: ✅ Working
- 24 questions: ✅ Rendering (6 written: Q2, Q14, Q17, Q20, Q22, Q24)
- Submit endpoint: ✅ Calls correct API

**Backend:**
- Endpoint: `https://moremindmap.com/api/moremindmap/mini-profile-v2`
- Deployment: Vercel serverless functions
- OpenAI API Key: ✅ Present (164 chars)
- Model: `gpt-4.1`
- Generation mode: ✅ OpenAI (not mock)
- Schema validation: ✅ Passing

**Pipeline:**
- buildProfileInput: ✅ Working
- generateReportContent: ✅ Working (GPT responds)
- validateReportContent: ✅ Working
- injectReportContent: ✅ Working
- Repair pass infrastructure: ✅ Deployed

---

## FIXES COMPLETED TODAY (Mon May 18, 2026)

### Major Issues Fixed:
1. ✅ **404 route error** — API not found → Created Vercel serverless function
2. ✅ **Function invocation errors** — Fixed import/export mismatches, missing files
3. ✅ **Wrong API URL** — Frontend pointed to old backend URL → Corrected to serverless function
4. ✅ **Mock mode fallback** — OpenAI API key configuration verified
5. ✅ **Invalid model** — Changed from gpt-5.5 → gpt-4.1
6. ✅ **TypeError: t.toLowerCase** — Answer text normalization in buildProfileInput
7. ✅ **Schema validation** — Top-level key requirements enforced
8. ✅ **Return value bug** — injectReportContent wasn't returning result
9. ✅ **Diagnostic visibility** — Created working diagnostic endpoint

### Commits Today:
```
18421e1 — allow html generation with placeholders for repair pass diagnostics
65d1284 — fix injectReportContent to return html and snapshot
d1e08ee — add full pipeline test to diagnostic with placeholder extraction
8f3242b — add generateReportContent test to diagnostic
c7fc8e9 — add buildProfileInput test to diagnostic
eb12adc — fix mini v2 diagnostic endpoint imports
abaef5f — add diagnostic endpoint for repair pass field mapping analysis
c24f2ae — implement mini v2 missing field repair pass
0374704 — step1 complete field population and stable render pipeline
96b1cea — increase max_tokens from 8000 to 16000
```

---

## CURRENT BLOCKER

**Issue:** GPT generates ~50% of required fields (88 of 173 placeholders remain unfilled)

**Root Cause Identified:**
- Prompt says "generate all fields" but doesn't enumerate each field by name
- GPT selectively generates:
  - ✅ Main narrative fields (summaries, bodies, pattern descriptions)
  - ❌ UI/structural fields (headings, icons, bullets, legends)

**Pattern:**
```
Page 04 example:
✅ GPT generates: operating_pattern_body_1/2/3/4, strongest_default_body
❌ GPT skips: strongest_default_heading, likely_blind_spot_heading, etc.
```

**Missing field types:**
1. Icons (~20 fields) — emoji/symbols for visual elements
2. Page 2 bullets (16 fields) — operating system map driver bullets
3. Legends (3 fields) — system map legend text
4. Headings (15+ fields) — section headers
5. Secondary narratives — decision_architecture_narrative_2, etc.

---

## REPAIR PASS STATUS

**Infrastructure:** ✅ Deployed (commit `c24f2ae`)

**Logic:**
1. First-pass generation
2. Template injection
3. Detect placeholders
4. Make targeted repair OpenAI call with missing field names
5. Merge repaired fields
6. Re-inject
7. Return final HTML or error

**Current behavior:**
- Repair pass executes
- But placeholder count doesn't decrease
- Likely issue: Field name mapping or merge logic

**Suspected causes:**
- Placeholder names are flat (`leadership_heading`)
- But merge expects nested paths (`page03_executive_summary.leadership_heading`)
- Or repair GPT response doesn't match expected format
- Or merge skips fields due to path mismatch

---

## DIAGNOSTIC ENDPOINT

**Endpoint:** `https://moremindmap.com/api/diagnostic-repair`

**Status:** ✅ Working (as of commit `18421e1`)

**Provides:**
- First-pass placeholder count: 88
- First-pass placeholder sample (first 30 names)
- GPT-generated page keys
- Exact field lists per page

**Sample output:**
```json
{
  "first_pass": {
    "placeholder_count": 88,
    "placeholders_sample": [
      "core_edge_icon",
      "primary_driver_icon",
      "opposing_pattern_1_bullet_1",
      "likely_blind_spot_heading",
      "decision_architecture_narrative_1",
      ...
    ],
    "page03_keys": ["summary_text", "leadership_body", "development_body", "priority_body"],
    "page04_keys": ["operating_pattern_body_1", "operating_pattern_body_2", ...]
  }
}
```

**Reveals:** GPT generates main bodies but skips headings/icons/bullets

---

## EXACT NEXT TASK (Next Session)

**DO NOT modify merge logic yet.**

**First:** Complete repair pass diagnostics

**Required visibility:**
1. Exact missingFields array sent to repair prompt
2. Repair prompt sample (first 1000 chars)
3. Raw repair GPT response (first 2000 chars)
4. Parsed repair object structure
5. Merge operation field mapping
6. Merge written count
7. Merge skipped count + reasons
8. Final placeholder count after merge
9. Remaining placeholder names

**Once exact mismatch is proven:**
- Fix placeholder-to-reportContent path mapping
- Or fix repair response parsing
- Or fix merge deep path resolution

**Commit message (when fixed):**
```
fix mini v2 repair merge field mapping
```

---

## DO NOT TOUCH (Protected)

- ❌ Frontend code
- ❌ Question wording/count
- ❌ Page 1/2 visual layout
- ❌ CSS/templates
- ❌ Stripe integration
- ❌ Assessment flow
- ❌ MOLTmarket

**ONLY modify:**
- Repair pass field mapping
- Diagnostic visibility
- Merge logic (if proven buggy)
- Prompt field enumeration (if needed)

---

## REPOSITORY PATHS

**Frontend/Live:**
- Path: `/Users/rrg/.openclaw/workspace/moremindmap-live`
- Repo: `https://github.com/RRG-systems/moremindmap.git`
- Branch: `main`
- HEAD: `18421e1`

**Backend/Memory (unchanged):**
- Path: `/Users/rrg/.openclaw/workspace/moremindmap-backend`
- Contains: Original engine files, schema docs, locked PDFs
- Not actively deployed (moremindmap-live contains deployed copies)

**Git Root:**
- `/Users/rrg/.openclaw/workspace`
- Unified repo for both projects

---

## PRODUCTION ENDPOINTS

**Live site:**
- `https://moremindmap.com` (custom domain)
- `https://moremindmap.vercel.app` (Vercel default)

**API endpoints:**
- `POST /api/moremindmap/mini-profile-v2` — Mini V2 (FATHOMFREE users)
- `POST /api/moremindmap/mini-profile` — Old generator (preserved)
- `GET /api/diagnostic` — OpenAI config check
- `POST /api/diagnostic-repair` — Repair pass diagnostics

---

## KEY FILES

**Pipeline:**
- `api/moremindmap/mini-profile-v2.js` — Main endpoint with repair pass
- `api/engine/buildProfileInput.js` — Answer → profile conversion
- `api/engine/generateReportContent.js` — GPT report generation + repair
- `api/engine/validateReportContent.js` — Quality checks
- `api/engine/injectReportContent.js` — Template injection
- `api/engine/generateMiniV2HTML.js` — HTML assembly

**Config:**
- `api/prompts/moremindmapMiniV2Prompt.js` — GPT prompt builder
- `vercel.json` — Deployment config
- `.env.production` — API URL

**Templates:**
- `api/templates/mini-v2/page01-cover.html` through `page10-full-profile-unlocks-dna.html`

**Documentation:**
- `MINI_V2_STEP1_FIELD_POPULATION_PLAN.md` — Field inventory + strategy
- `MINI_V2_RUNTIME_DEBUG_STATUS.md` — Current status (this file)

---

## ENVIRONMENT

**Vercel Environment Variables:**
- `OPENAI_API_KEY`: Present (164 chars)
- `OPENAI_MODEL`: `gpt-4.1`
- `NODE_ENV`: `production`

---

**Next session:** Start by reading this file, then proceed with repair pass diagnostics per "EXACT NEXT TASK" section above.
