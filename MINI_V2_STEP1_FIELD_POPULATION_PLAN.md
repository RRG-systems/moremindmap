# MINI V2 STEP 1 — COMPLETE FIELD POPULATION PLAN

**Created:** Mon May 18, 2026 14:05 MST  
**Updated:** Mon May 18, 2026 15:48 MST  
**Status:** DIAGNOSTIC PHASE — Root cause identified, repair logic needs field mapping fix  
**Goal:** Achieve 0 placeholders, stable 10-page render

**Current HEAD:** `18421e1`  
**Current Blocker:** GPT generates ~50% of fields, repair pass deployed but not reducing placeholder count

---

## FIELD INVENTORY

### Total Field Count: **173 unique placeholders**

### By Page:
- Page 01 (Cover): 31 fields
- Page 02 (Operating Map): 34 fields  
- Page 03 (Executive Summary): 10 fields
- Page 04 (Operating Pattern): 15 fields
- Page 05 (Decision Architecture): 15 fields
- Page 06 (Communication Style): 16 fields
- Page 07 (System Under Strain): 8 fields
- Page 08 (Operating Environment Fit): 18 fields
- Page 09 (Facilitator Notes): 7 fields
- Page 10 (Full Profile Unlocks): 19 fields

---

## FIELD CATEGORIZATION

### REQUIRED_LONG (High Word Count)
**Pages 3-8 Core Narratives:**
- `summary_text` (Page 3) — 150-200 words
- `operating_pattern_body_1/2/3/4` (Page 4) — 100-150 words each
- `decision_architecture_narrative_1/2/3` (Page 5) — 100 words each
- `communication_narrative_1/2` (Page 6) — 100 words each
- `pressure_response_explanation` (Page 7) — 150 words
- `operating_environment_body` sections (Page 8) — 80-120 words each

**Total estimated: ~1800-2500 words**

### REQUIRED_SHORT (Low Word Count)
**Bullets, Labels, Summaries:**
- All `_bullet_1/2/3/4` fields — 8-15 words each (Page 2, 32 bullets = ~400 words)
- All `_heading` fields — 2-5 words each
- All dimension labels/codes — 1-3 words each
- Profile metadata — 1-10 words each

**Total estimated: ~800-1000 words**

### VISUAL_SUPPORT (Minimal)
**Page 2 System Map:**
- Icons (emoji/symbols) — 1 char each
- Compact labels — 2-4 words
- Tension warning — 20-30 words
- System tension summary — 40-60 words

**Total estimated: ~200 words**

### CRITICAL_INFRASTRUCTURE
**Cross-page Metadata:**
- `profile_type` — appears on every page
- `assessment_date` — appears on every page
- `confidence_level` — appears on every page
- `profile_code_string` — Page 1

---

## WORD BUDGET MAP

### By Page Priority:

**HIGH PRIORITY (Pages 3-8):** 1800-2500 words
- Page 03: 250 words
- Page 04: 500 words
- Page 05: 400 words
- Page 06: 350 words
- Page 07: 200 words
- Page 08: 450 words

**MEDIUM PRIORITY (Pages 1, 9, 10):** 600-800 words
- Page 01: 250 words (compressed identity)
- Page 09: 150 words (facilitator intelligence)
- Page 10: 250 words (unlock narrative)

**LOW PRIORITY (Page 2):** 200-300 words
- Visual-first design
- Compact bullets only
- Minimal paragraph density

**TOTAL TARGET: 2600-3600 words**

---

## GENERATION STRATEGY

### Current Problem:
- `max_tokens: 16000` allows ~12,000 words
- Prompt requests all fields
- GPT returns valid structure but under-populates nested fields
- Result: 88 placeholders remain unfilled

### Root Cause Analysis:
1. **Insufficient prompt specificity** — doesn't enumerate every field
2. **No explicit word targets** — GPT doesn't know minimum lengths
3. **Single-pass generation** — no completion verification
4. **No field inventory in prompt** — GPT doesn't see full schema

### Solution Strategy: **EXPLICIT FIELD ENUMERATION**

**Approach:**
1. Update prompt to include COMPLETE field list with word targets
2. Add explicit instructions: "Generate ALL 173 fields"
3. Include minimum word counts per field type
4. Add JSON structure validation reminder
5. Increase max_tokens if needed (current: 16000)

**Implementation:**
- Modify `api/prompts/moremindmapMiniV2Prompt.js`
- Add comprehensive field checklist
- Add word count requirements
- Add field-by-field generation guidance

---

## BEFORE STATE

**Placeholders:** 88 remaining (estimated, based on error)  
**Generation Mode:** OpenAI (gpt-4.1)  
**Schema Validation:** ✅ Passing  
**Content Completeness:** ❌ Insufficient  

---

## TARGET STATE

**Placeholders:** 0  
**Generation Mode:** OpenAI (gpt-4.1)  
**Schema Validation:** ✅ Passing  
**Content Completeness:** ✅ All fields populated  
**Page Render:** ✅ Stable 10-page output  

---

## IMPLEMENTATION STEPS

1. ✅ Complete field inventory (DONE)
2. ✅ Create word budget map (DONE)
3. ⏳ Update prompt with explicit field list
4. ⏳ Add word count targets per field
5. ⏳ Test production endpoint
6. ⏳ Verify placeholder count = 0
7. ⏳ Generate sample HTML output
8. ⏳ Commit & deploy

---

## COMMIT PLAN

**Files to modify:**
- `api/prompts/moremindmapMiniV2Prompt.js` — Add comprehensive field schema

**Commit message:**
```
step1 complete field population and stable render pipeline
```

---

**Status:** Field inventory complete, ready for prompt enhancement.

---

## DIAGNOSTIC FINDINGS (Mon May 18 15:45 MST)

**Root Cause:** GPT generates main narrative fields but skips UI/structural fields

**Evidence:**
- Page 03: Generates summary_text, leadership_body ✅ | Skips headings ❌
- Page 04: Generates operating_pattern_body fields ✅ | Skips headings ❌
- Page 02: Skips all 16 driver bullets, icons, legends ❌

**Missing categories:** Icons (20), Page 2 bullets (16), Headings (15+), Legends (3)

**Total missing:** 88 of 173 fields (51% completion)

**Repair pass:** Deployed but not reducing count (field mapping issue suspected)
