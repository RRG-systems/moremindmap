# STEP 1: CLEANUP PASS — IN PROGRESS

**Objective:** Polish current mini profile output for premium beta appearance
**Scope:** Fix rendering, grammar, markdown, naming consistency
**Status:** Identifying issues

---

## ISSUES IDENTIFIED

### Issue 1: Markdown Symbols in Output
**Location:** miniProfileGenerator.js (all text generation functions)
**Problem:** Text contains **bold** markdown that renders literally in UI
**Impact:** Professional report reads like raw source code
**Example:** "You move by **getting to the point and taking action**" should render as styled text, not with symbols

### Issue 2: Dimension Naming Inconsistency
**Location:** DIMENSION_TRADEOFFS in miniProfileGenerator.js
**Problem:** Inconsistent naming across references
**Current:**
- Horizon (Vision) in tradeoffs vs Horizon (Perspective) in labels
- Signal (Tempo) vs Signal (Relational Awareness)
**Fix:** Standardize to:
  - Vector (Command) ✓
  - Signal (Relational Awareness) ← fix from (Tempo)
  - Fidelity (Precision) ✓
  - Velocity (Tempo) ✓
  - Leverage (Influence) ✓
  - Flex (Adaptability) ✓
  - Framework (Structure) ✓
  - Horizon (Perspective) ← fix from (Vision)

### Issue 3: Grammar and Awkward Phrasing
**Location:** Text generation functions (generateWhatThisMeans, generateCommunicationStyle, etc.)
**Problems Found:**
- "creates predictable friction" → awkward tone, should be tightened
- "Your lower-scoring dimensions are not weaknesses. They simply reflect that your system relies on them less because your dominant traits are already leading the charge." → wordy, can be sharper
- Some sentences are too long and could break for readability

### Issue 4: Dimension Bar Rendering
**Location:** MiniProfileReport.jsx - DimensionBar component
**Problem:** Need to verify labels and percentages display correctly
**Check:** All 8 dimensions show name and percentage

### Issue 5: Text Rendering Without Markdown
**Location:** MiniProfileReport.jsx - text display sections
**Solution:** Convert markdown **bold** to either:
  - Option A: Remove markdown, use plain text
  - Option B: Use React styling with semantic tags
  - Option C: Use simple CSS classes

---

## FIXES TO APPLY

### Fix 1: Standardize Dimension Labels
File: `/engine/miniProfileGenerator.js`
Lines: DIMENSION_TRADEOFFS object

Changes:
- horizon: Change label from "Horizon (Vision)" → "Horizon (Perspective)"
- signal: Change label from "Signal (Tempo)" → "Signal (Relational Awareness)"

### Fix 2: Remove Markdown Symbols
File: `/engine/miniProfileGenerator.js`
All text generation functions

Changes:
- Replace `**text**` with `text` (plain)
- Use semantic HTML tags in renderer if styling needed

### Fix 3: Tighten Grammar and Phrasing
File: `/engine/miniProfileGenerator.js`
Specific sentences in:
- generateWhatThisMeans()
- generateCommunicationStyle()
- generateLeadershipSnapshot()
- generateFrictionPattern()

### Fix 4: Verify DimensionBar Rendering
File: `/src/components/reports/MiniProfileReport.jsx`
Component: DimensionBar

Check:
- Labels display full name (not truncated)
- Percentages show correctly
- All 8 dimensions render

---

## FILES TO MODIFY

1. `/engine/miniProfileGenerator.js`
   - DIMENSION_TRADEOFFS object (lines ~36-150)
   - All generate*() functions (remove **)

2. `/src/components/reports/MiniProfileReport.jsx`
   - DimensionBar component verification
   - Text rendering sections

---

## CONSTRAINTS (DO NOT VIOLATE)

✓ Do NOT change 24 locked questions
✓ Do NOT begin Phase 2A
✓ Do NOT overhaul scoring system
✓ Do NOT redesign UI fundamentally
✓ Keep current structure intact

---

**NEXT:** Apply fixes per issue list above.
