# SCORING TRACE SUMMARY: Key Findings

**Commit:** 3d9dab0  
**Full report:** `SCORING_TRACE_REPORT.md`

---

## ONE-PAGE SUMMARY

### Current Scoring Pipeline

```
Q1-Q28 Answers
    ↓
buildProfileInput.js (deterministic scoring)
    ↓
dimension_scores object (raw_score + rank)
    ↓
canonicalProfileGenerator.js
    ↓
canonical.ranked_dimensions (locked, baseline)
    ↓
retrieveProfile + WebProfileReport
    ↓
8 DNA boxes + 3 cards + DNA Summary + Profile DNA text
```

---

## Target Surfaces (What We're Rescoring)

| Surface | Count | Data Source | Type |
|---------|-------|-------------|------|
| DNA boxes (VEC, HOR, VEL, LEV, SIG, FLE, FID, FRA) | 8 | canonical.ranked_dimensions | Deterministic baseline |
| Command Clarity card | 1 | ranked[0].score | Deterministic baseline |
| Speed vs Fidelity card | 1 | ranked[1].score | Deterministic baseline |
| Strategic Leverage card | 1 | ranked[2].score | Deterministic baseline |
| DNA Summary (6 dims formatted) | 1 | ranked.slice(0,6) | Deterministic baseline |
| Profile DNA text (Operating Model) | 1 | narrative.profileDNA.body | GPT-5.5 enriched |

**Total: 13 surfaces populated by scoring**

---

## Key Files

### Scoring Origin (DO NOT TOUCH)
- `/api/engine/scoring/buildProfileInput.js` - Q1-Q28 → dimension_scores
- `/api/engine/canonical/inferVectorScores.js` - dimension_scores → ranked_dimensions
- `/api/engine/canonical/canonicalProfileGenerator.js` - Build canonical with ranked_dimensions

### Rendering (CAN OVERRIDE SAFELY)
- `/src/components/reports/WebProfileReport.jsx` line 1046 - Data entry point
- `/src/components/reports/WebProfileReport.jsx` line 1161 - 8 DNA boxes render
- `/src/components/reports/WebProfileReport.jsx` line 120-134 - 3 big cards render
- `/src/components/reports/WebProfileReport.jsx` line 139 - DNA Summary render

### Narrative (WILL CHANGE WITH RESCORING)
- `/src/lib/narrativeV3/sectionPrompts.js` - profileDNA prompt uses ranked dimensions
- `/src/lib/narrativeV3/buildNarrativeV3.js` - GPT enrichment (must regenerate)

---

## Safe Rescoring Insertion Point

### Recommended: Option A - canonical.rescoring_v1

**Location:** `/api/engine/canonical/canonicalProfileGenerator.js` line 270

**Structure:**
```javascript
const canonical = {
  // Keep baseline (audit trail)
  ranked_dimensions: ranked_dimensions,
  baseline_ranked_dimensions: ranked_dimensions,
  
  // Add rescoring placeholder
  rescoring_v1: null,  // Will be populated downstream
  
  // ... rest of canonical
};
```

**Render override pattern:**
```javascript
// In WebProfileReport, for each surface:
const score = canonical.rescoring_v1?.ranked_dimensions?.[idx]?.score 
           || canonical.ranked_dimensions[idx]?.score 
           || 0;
```

---

## What Rescoring Must Do

1. **Input:** Full canonical dossier (all fields)
2. **Process:** Detailed scoring analysis (NOT just Q1-Q28)
3. **Output:** `rescoring_v1.ranked_dimensions` with same shape as baseline
4. **Preserve:** Original `baseline_ranked_dimensions` for audit
5. **Maintain:** -10 to +10 score scale
6. **Keep:** 8 dimensions (don't add/remove)

---

## What NOT to Rescoring

- ✗ Do NOT modify `dimension_scores` from buildProfileInput
- ✗ Do NOT change baseline scoring logic
- ✗ Do NOT modify ingress flows (FATHOMFREE, Profile ID, Stripe)
- ✗ Do NOT change renderer layout
- ✗ Do NOT modify narrative generation (yet)
- ✗ Do NOT break orchestration parity

---

## Render Override Points (All Safe)

**All use same pattern: rescoring_v1 || baseline || fallback**

1. **8 DNA boxes** - Line 1161
   - `canonical.rescoring_v1?.ranked_dimensions?.[i]?.score || baseline`

2. **Command Clarity** - Line 120
   - `canonical.rescoring_v1?.ranked_dimensions?.[0]?.score || baseline`

3. **Speed vs Fidelity** - Line 127
   - `canonical.rescoring_v1?.ranked_dimensions?.[1]?.score || baseline`

4. **Strategic Leverage** - Line 134
   - `canonical.rescoring_v1?.ranked_dimensions?.[2]?.score || baseline`

5. **DNA Summary** - Line 139
   - `canonical.rescoring_v1?.ranked_dimensions?.slice(0,6) || baseline.slice(0,6)`

6. **Profile DNA text** - Line 1175
   - No override needed; will be regenerated from rescored input

---

## Build Roadmap (Planning Only)

### Phase 1: Infrastructure
1. Add `canonical.rescoring_v1` placeholder
2. Add `canonical.baseline_ranked_dimensions` for audit
3. Add render override chains (no logic yet)
4. Test fallback works, baseline still renders

### Phase 2: Rescoring Logic (LATER)
1. Create rescoring engine module
2. Implement rescoring algorithm
3. Populate `rescoring_v1.ranked_dimensions`
4. Verify all 6 surfaces render rescored values

### Phase 3: Narrative Regeneration (LATER)
1. If rescoring changes interpretation, rebuild narrative
2. Pass rescored ranked_dimensions to profileDNA prompt
3. Regenerate narrative-v3 output

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|-----------|
| Break baseline scoring | LOW | Don't touch buildProfileInput |
| Break renderer | LOW | Use null-coalescing fallback |
| Break parity | LOW | No ingress changes |
| Circular dependencies | MEDIUM | Rescoring reads ONLY answers + baseline |
| Narrative mismatch | MEDIUM | Regenerate narrative when rescoring applied |
| Score scale mismatch | LOW | Keep -10 to +10 scale |

---

## Success Criteria

✅ Understand full scoring pipeline  
✅ Identify all 6 target surfaces  
✅ Know exactly where scores come from  
✅ Know safe insertion point (canonical.rescoring_v1)  
✅ Know safe render override pattern  
✅ Know what NOT to touch  
✅ Ready to build rescoring engine  

---

## Full Trace

See `SCORING_TRACE_REPORT.md` for complete details:
- Detailed source map (all 8 dimensions)
- Each surface's exact render code
- Full data flow diagram
- Risk analysis
- DO NOT TOUCH list

---

**TRACE COMPLETE. NO CODE CHANGES MADE. READY FOR RESCORING BUILD.**
