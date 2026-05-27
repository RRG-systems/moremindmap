# SCORING TRACE REPORT: Current Scoring & Render Population

**Date:** 2026-05-27 11:47 MST  
**Status:** TRACE ONLY - NO CODE CHANGES

---

## EXECUTIVE SUMMARY

### Current Scoring Origin
- **Primary source:** Deterministic baseline scoring module (buildProfileInput → dimension_scores)
- **Baseline method:** MC questions (Q1-Q28) scored with explicit dimension maps
- **Rank calculation:** Normalized and rank-ordered by buildProfileInput
- **Storage:** canonical.ranked_dimensions (already ranked + scored)
- **Flow:** Scoring → Canonical → Retrieval → Intelligence → Narrative-V3 → Renderer

### Centralization Status
- **Scoring:** Centralized in buildProfileInput (single source of truth)
- **Ranking:** Centralized in inferVectorScores
- **Rendering:** Decentralized (multiple components read ranked_dimensions)
- **Narrative enrichment:** GPT-5.5 reads unified interpretation (downstream)

### Current Score Sources in Renderer
- **8 DNA boxes:** `canonical.ranked_dimensions` (deterministic baseline)
- **3 big cards:** `canonical.ranked_dimensions[0-2]` (deterministic baseline)
- **Profile DNA text:** narrative-v3 output (GPT-5.5 interpretation of unified artifact)
- **DNA Summary:** `ranked.slice(0,6)` mapped to text (deterministic baseline)

---

## CURRENT SCORING SOURCE MAP

### 8 Behavioral Dimensions

All 8 dimensions follow identical pattern:

| Dimension | Code | Source Path | Calculation | Normalization | Display Format |
|-----------|------|-------------|-------------|----------------|----------------|
| vector | VEC | profileInput.dimension_scores.vector.raw_score | MC Q1+Q2 scoring | -10 to +10 scale | `+0.86` |
| horizon | HOR | profileInput.dimension_scores.horizon.raw_score | MC Q3 scoring | -10 to +10 scale | `+0.42` |
| velocity | VEL | profileInput.dimension_scores.velocity.raw_score | MC Q5+Q6+Q7 scoring | -10 to +10 scale | `-0.15` |
| leverage | LEV | profileInput.dimension_scores.leverage.raw_score | MC Q8+Q9 scoring | -10 to +10 scale | `+0.68` |
| signal | SIG | profileInput.dimension_scores.signal.raw_score | MC Q10+Q11 scoring | -10 to +10 scale | `+0.60` |
| flex | FLE | profileInput.dimension_scores.flex.raw_score | MC Q12+Q13 scoring | -10 to +10 scale | `-0.50` |
| fidelity | FID | profileInput.dimension_scores.fidelity.raw_score | MC Q14+Q15+Q16 scoring | -10 to +10 scale | `+0.83` |
| framework | FRA | profileInput.dimension_scores.framework.raw_score | MC Q17+Q18+Q19 scoring | -10 to +10 scale | `+0.42` |

**Source:** `/api/engine/canonical/inferVectorScores.js` line 15-27  
**Calculation origin:** `/api/engine/scoring/buildProfileInput.js`  
**Fallback:** `|| 0` (if missing)

---

## TARGET SURFACE MAP

### A. Eight DNA Score Boxes (Purple Boxes)

**Location:** `/src/components/reports/WebProfileReport.jsx` line 1161  
**Component:** Inline `<span className="dna-score">`  
**Current render:**
```javascript
{ranked.slice(0, 6).map((d) => (
  <div key={d.dimension} className="dna-item-v2">
    <span className="dna-dimension">{d.dimension.toUpperCase().substring(0, 2)}</span>
    <span className="dna-score">{d.score > 0 ? '+' : ''}{d.score}</span>
  </div>
))}
```

**Data source:** `ranked` → `canonical.ranked_dimensions`  
**Calculation:** Deterministic baseline  
**Type:** Deterministic (baseline scoring)  
**Fallback:** None (undefined defaults to empty map)

**Future override point:**
```javascript
// Safe insertion point (pseudo-code)
const displayScore = canonical.rescoring_v1?.ranked_dimensions?.[idx]?.score 
                  || canonical.ranked_dimensions[idx]?.score 
                  || 0;
```

---

### B. Profile DNA Text Box (Operating Model)

**Location:** `/src/components/reports/WebProfileReport.jsx` line 1175  
**Component:** `<div className="narrative-text">`  
**Current render:**
```javascript
{narrative.profileDNA?.body || narrative.profileDNA}
```

**Data source:** `narrative.profileDNA.body` ← GPT-5.5 enriched  
**Calculation source:** `/src/lib/narrativeV3/sectionPrompts.js` line 247-280  
**Type:** GPT-5.5 generated (from unified interpretation + ranked dimensions)  
**Fallback:** `narrative.profileDNA` (string fallback)

**Input to GPT:**
- unified interpretation artifact
- ranked dimensions (primary + secondary)
- intake_answers
- pressure responses
- behavioral operating patterns

**Future override point:**
```javascript
// Would keep GPT enrichment, but rebuild with rescored dimensions
// No override needed unless rescoring significantly changes interpretation
```

---

### C. Command Clarity Card (1st of 3)

**Location:** `/src/components/reports/WebProfileReport.jsx` line 120  
**Component:** `<MetricCard>`  
**Current render:**
```javascript
<MetricCard
  icon="🔄"
  title="Command Clarity"
  metric={ranked[0]?.score || 0}
  dimension={ranked[0]?.dimension || 'Primary'}
  color="clarity"
/>
```

**Data source:** `ranked[0].score` ← `canonical.ranked_dimensions[0]`  
**Rank position:** 1st (highest scoring dimension)  
**Type:** Deterministic (baseline scoring)  
**Fallback:** `0` if ranked[0] missing

**Future override point:**
```javascript
const score = canonical.rescoring_v1?.ranked_dimensions?.[0]?.score 
           || ranked[0]?.score 
           || 0;
```

---

### D. Speed vs Fidelity Card (2nd of 3)

**Location:** `/src/components/reports/WebProfileReport.jsx` line 127  
**Component:** `<MetricCard>`  
**Current render:**
```javascript
<MetricCard
  icon="⚖️"
  title="Speed vs Fidelity"
  metric={ranked[1]?.score || 0}
  dimension={ranked[1]?.dimension || 'Secondary'}
  color="balance"
/>
```

**Data source:** `ranked[1].score` ← `canonical.ranked_dimensions[1]`  
**Rank position:** 2nd (second highest)  
**Type:** Deterministic (baseline scoring)  
**Fallback:** `0` if ranked[1] missing

**Future override point:** Same pattern as Command Clarity

---

### E. Strategic Leverage Card (3rd of 3)

**Location:** `/src/components/reports/WebProfileReport.jsx` line 134  
**Component:** `<MetricCard>`  
**Current render:**
```javascript
<MetricCard
  icon="🎯"
  title="Strategic Leverage"
  metric={ranked[2]?.score || 0}
  dimension={ranked[2]?.dimension || 'Tertiary'}
  color="leverage"
/>
```

**Data source:** `ranked[2].score` ← `canonical.ranked_dimensions[2]`  
**Rank position:** 3rd (third highest)  
**Type:** Deterministic (baseline scoring)  
**Fallback:** `0` if ranked[2] missing

**Future override point:** Same pattern

---

### F. DNA Summary Box

**Location:** `/src/components/reports/WebProfileReport.jsx` line 139  
**Component:** `<InsightPanel>`  
**Current render:**
```javascript
content={ranked.slice(0, 6).map(d => 
  `${d.dimension}: ${d.score > 0 ? '+' : ''}${d.score}`
).join(' • ')}
```

**Data source:** `ranked.slice(0, 6)` ← `canonical.ranked_dimensions[0-5]`  
**Type:** Deterministic (baseline, formatted as text)  
**Display format:** `"vector: +0.86 • signal: +0.60 • fidelity: +0.83 • ..."`  
**Fallback:** Empty array if ranked missing

**Future override point:**
```javascript
const summaryDimensions = canonical.rescoring_v1?.ranked_dimensions?.slice(0, 6) 
                       || ranked.slice(0, 6);
content = summaryDimensions.map(d => 
  `${d.dimension}: ${d.score > 0 ? '+' : ''}${d.score}`
).join(' • ');
```

---

## FULL DATA FLOW

### Pipeline: Assessment → Render

```
1. USER INPUT PHASE
   ├─ Assessment answers (Q1-Q28)
   ├─ Preamble / context / org data
   └─ Job metadata

2. BASELINE SCORING PHASE
   ├─ File: /api/engine/scoring/buildProfileInput.js
   ├─ Scoring logic:
   │  ├─ MC questions parsed
   │  ├─ Each dimension mapped (Q1+Q2 → vector, etc.)
   │  ├─ Scores normalized to -10 to +10 scale
   │  └─ Rank calculated (rank_1 = highest score, etc.)
   └─ Output: dimension_scores object with raw_score + rank

3. CANONICAL GENERATION PHASE
   ├─ File: /api/engine/canonical/canonicalProfileGenerator.js
   ├─ Process:
   │  ├─ Call inferVectorScores(profileInput)
   │  ├─ Extract ranked_dimensions from dimension_scores
   │  ├─ Store in canonical.ranked_dimensions
   │  └─ Preserve raw_score, rank, dimension name
   └─ Output: Canonical dossier with ranked_dimensions

4. BEHAVIORAL INTELLIGENCE EXTRACTION
   ├─ File: /api/engine/canonical/extractIntelligence.js
   ├─ Process:
   │  ├─ Extract 11 domains (operating, world, pressure, etc.)
   │  ├─ Create unified interpretation artifact
   │  └─ Pass ranked_dimensions to unified interpreter
   └─ Output: behavioral_intelligence_v1 with unified interpretation

5. NARRATIVE ENRICHMENT (GPT-5.5)
   ├─ File: /src/lib/narrativeV3/buildNarrativeV3.js
   ├─ Process:
   │  ├─ Pass unified interpretation to sectionPrompts
   │  ├─ sectionPrompts read ranked_dimensions
   │  ├─ sectionPrompts read dimension scores
   │  ├─ GPT generates profileDNA section
   │  └─ GPT generates executiveSummary, etc.
   └─ Output: narrative_v3 with enriched text

6. PROFILE RETRIEVAL
   ├─ File: /api/moremindmap/retrieve-profile.js
   ├─ Returns:
   │  ├─ canonical_dossier (includes ranked_dimensions)
   │  ├─ behavioral_intelligence_v1
   │  └─ (no narrative-v3 in retrieval, loaded client-side)

7. CLIENT-SIDE RENDERING
   ├─ File: /src/components/reports/WebProfileReport.jsx
   ├─ Data assembly:
   │  ├─ ranked ← canonical.ranked_dimensions
   │  ├─ narrative ← buildNarrativeV3() output
   │  └─ data ← canonical.canonical_profile_json
   ├─ Component assembly:
   │  ├─ DNA boxes: ranked[i].score
   │  ├─ 3 big cards: ranked[0-2].score + dimension
   │  ├─ DNA Summary: ranked.slice(0,6) formatted
   │  └─ Profile DNA: narrative.profileDNA.body (GPT text)
   └─ Output: Rendered HTML/React

8. FINAL RENDER OUTPUTS
   ├─ 8 DNA boxes: deterministic baseline scores
   ├─ 3 metric cards: deterministic baseline scores + dimensions
   ├─ DNA Summary: deterministic baseline formatted
   └─ Profile DNA text: GPT-5.5 narrative
```

---

## SAFE INSERTION OPTIONS

### Option A: After Canonical, Before Intelligence Extraction (Recommended)

**Location:** `/api/engine/canonical/canonicalProfileGenerator.js` line 270-280

**How:**
1. After canonical object built with ranked_dimensions
2. Before behavioral_intelligence extraction
3. Add new field: `canonical.rescoring_v1`
4. Preserve baseline: `canonical.baseline_ranked_dimensions` (for audit)

**Structure:**
```javascript
// After ranked_dimensions set at line 270
const canonical = {
  ...existing_fields,
  ranked_dimensions: ranked_dimensions,  // Keep baseline
  baseline_ranked_dimensions: ranked_dimensions,  // Audit copy
  rescoring_v1: null  // Will be populated downstream
};
```

**Pros:**
- ✅ Centralized storage
- ✅ Passed through entire pipeline
- ✅ Available to intelligence extraction, narrative, rendering
- ✅ Audit trail (baseline preserved)
- ✅ No breaking changes to existing code

**Cons:**
- Downstream code needs to check rescoring_v1 presence

**Risk:** LOW

---

### Option B: In Behavioral Intelligence Domain

**Location:** `/api/engine/canonical/extractIntelligence.js` line 115

**How:**
1. Create new domain: `domains.rescoredDNA`
2. Store rescored dimensions in intelligence object
3. Renderer checks BI first, then canonical

**Structure:**
```javascript
intelligence.domains.rescoredDNA = {
  ranked_dimensions: [...rescored...],
  rescoring_source: 'rescoring_engine_v1'
};
```

**Pros:**
- ✅ Keeps scoring with other intelligence
- ✅ Audit clear (domain-specific)

**Cons:**
- ⚠️ Intelligence extraction not designed for this
- ⚠️ Extra network traffic
- ⚠️ Requires intelligence regeneration to update scores

**Risk:** MEDIUM

---

### Option C: Client-Side Override (Not Recommended)

**Location:** `/src/components/reports/WebProfileReport.jsx` line 1046

**How:**
1. Client fetches rescored dimensions separately
2. Override `ranked` variable before render

**Pros:**
- No backend changes

**Cons:**
- ✗ Extra API call
- ✗ Race conditions
- ✗ State management complexity
- ✗ Breaks orchestration parity

**Risk:** HIGH

---

## RECOMMENDED INSERTION POINT

### ✅ Option A: Canonical.rescoring_v1

**Why:**
1. Centralized storage (alongside baseline)
2. Audit trail (baseline preserved separately)
3. Available to all downstream systems
4. No breaking changes to existing code
5. Maintains orchestration parity
6. Compatible with narrative enrichment

**Implementation plan (future):**
```javascript
// In canonicalProfileGenerator.js, after line 270:
const canonical = {
  ...existing,
  ranked_dimensions: ranked_dimensions,  // Keep baseline
  baseline_ranked_dimensions: ranked_dimensions,  // Audit
  rescoring_v1: {
    ranked_dimensions: rescored_ranked,  // Future rescored
    scoring_version: 'rescoring-engine-v1',
    timestamp: new Date().toISOString(),
    override_reason: 'detailed scoring analysis'
  }
};
```

---

## RENDER OVERRIDE PLAN

### Pattern for All Target Surfaces

**Generic override pattern:**
```javascript
// For dimensions/scores:
const useDimension = canonical.rescoring_v1?.ranked_dimensions 
                  || canonical.ranked_dimensions 
                  || [];

// For individual scores:
const score = canonical.rescoring_v1?.ranked_dimensions?.[index]?.score 
           || canonical.ranked_dimensions[index]?.score 
           || 0;

// For narrative text (no override, rebuild instead):
// ProfileDNA narrative would need to be regenerated with rescored input
```

**Applied to each surface:**

1. **8 DNA boxes:** Use rescored if present, else baseline
2. **3 big cards:** Use rescored ranked[0-2], else baseline
3. **DNA Summary:** Use rescored slice(0-6), else baseline
4. **Profile DNA text:** No override, but will be different when narrative rebuilt

### Fallback safety:
- ✅ Null-coalescing (`?.`) prevents crashes
- ✅ Baseline always available as fallback
- ✅ No renderer redesign needed
- ✅ Graceful degradation if rescoring missing

---

## RISK LIST

### Critical Risks

1. **RISK: Circular score dependencies**
   - **Where:** If rescoring references interpreted_patterns which reference ranked_dimensions
   - **Fix:** Rescoring uses ONLY intake_answers + baseline scores, not interpreted output
   - **Status:** ⚠️ MUST PREVENT

2. **RISK: Score label hardcoding**
   - **Where:** MetricCard titles ("Command Clarity", "Speed vs Fidelity") hardcoded
   - **Impact:** If rescoring changes ranking order, card titles won't update
   - **Fix:** Map dimension → title dynamically (future)
   - **Status:** ⚠️ KNOWN LIMITATION

3. **RISK: Mini V2 fallback interference**
   - **Where:** Old mini-v2 template still in code, may have separate scoring
   - **Impact:** If both paths exist, inconsistent scores
   - **Fix:** Ensure mini-v2 also uses canonical.ranked_dimensions (verify)
   - **Status:** ⚠️ VERIFY BEFORE PROCEEDING

### Medium Risks

4. **Narrative V3 expects baseline scores**
   - **Location:** `/src/lib/narrativeV3/sectionPrompts.js`
   - **Impact:** If rescored scores fed to GPT, narrative will change (intended but risky)
   - **Fix:** Narrative must be regenerated when rescoring applied
   - **Status:** ⚠️ DOCUMENT REQUIREMENT

5. **Duplicate score objects**
   - **Risk:** If rescoring not properly scoped, two score objects in flight
   - **Fix:** Clear naming (rescoring_v1, baseline_scored, etc.)
   - **Status:** ⚠️ NAMING CONVENTION NEEDED

### Low Risks

6. **Score values rounded/clamped in renderer**
   - **Location:** DNA boxes use `score > 0 ? '+' : ''` formatting
   - **Impact:** If rescoring produces different scale, formatting breaks
   - **Fix:** Ensure rescoring maintains -10 to +10 scale
   - **Status:** ✅ LOW RISK (documented)

7. **Fallback traps**
   - **Status:** ✅ LOW RISK (triple fallback guard: rescoring → baseline → 0)

---

## DO NOT TOUCH LIST

### Sacred Code (During Rescoring Build)

**INGRESS FLOWS:**
- ✗ `/api/assessment/submitAssessment.js` - FATHOMFREE flow
- ✗ `/api/moremindmap/retrieve-profile.js` - Profile ID flow
- ✗ `/src/Profile.jsx` - Entry orchestration
- ✗ All Stripe integration

**BASELINE SCORING:**
- ✗ `/api/engine/scoring/buildProfileInput.js` - Baseline deterministic scoring
- ✗ `/api/engine/canonical/inferVectorScores.js` - Baseline ranking
- ✗ `dimension_scores` object schema

**RENDERER LAYOUT:**
- ✗ CSS/styling for DNA boxes
- ✗ MetricCard component design
- ✗ InsightPanel layout
- ✗ Grid structure

**CANONICAL GENERATION LOGIC:**
- ✗ Canonical profile schema
- ✗ Behavioral pattern inference
- ✗ Contradiction detection
- ✗ Pressure mechanics

**NARRATIVE V3 ENRICHMENT:**
- ✗ Unified interpreter core
- ✗ GPT prompt templates
- ✗ Section rendering logic
- ✗ Evidence dominance rules

**ORCHESTRATION PARITY:**
- ✗ FATHOMFREE = Profile ID = Stripe flows
- ✗ retrieve-profile response structure
- ✗ behavioral_intelligence_v1 formation

---

## NEXT BUILD PLAN

### Phase 1: Rescoring Infrastructure (NO CODE YET, PLAN ONLY)

**Step 1: Rescoring Engine Entry Point**
- Create `/api/engine/rescoring/rescoreDimensions.js`
- Input: Full canonical dossier
- Output: `rescoring_v1` object (same shape as ranked_dimensions)
- No logic yet, just structure

**Step 2: Insert Point**
- Add `canonical.rescoring_v1 = null` (placeholder)
- Add `canonical.baseline_ranked_dimensions = ranked_dimensions` (audit)
- Location: After ranked_dimensions assigned in canonicalProfileGenerator

**Step 3: Render Override Points**
- Add safe fallback chains to WebProfileReport
- Pattern: rescoring_v1 || baseline || 0
- No visual changes (both will show same baseline initially)

**Step 4: Test Harness**
- Verify baseline still renders (no rescoring active)
- Verify fallback chain works
- Verify orchestration parity maintained

**Step 5: Rescoring Logic** (LATER)
- Implement rescoring algorithm
- Populate rescoring_v1 with actual rescored dimensions
- Test visual changes

---

## SUMMARY TABLE

| Surface | Source | Type | Override Point | Risk |
|---------|--------|------|-----------------|------|
| 8 DNA boxes | canonical.ranked_dimensions | Deterministic | canonical.rescoring_v1?.ranked_dimensions | ✅ LOW |
| Command Clarity | ranked[0].score | Deterministic | rescoring_v1?.ranked_dimensions[0] | ✅ LOW |
| Speed vs Fidelity | ranked[1].score | Deterministic | rescoring_v1?.ranked_dimensions[1] | ✅ LOW |
| Strategic Leverage | ranked[2].score | Deterministic | rescoring_v1?.ranked_dimensions[2] | ✅ LOW |
| DNA Summary | ranked.slice(0,6) | Deterministic | rescoring_v1?.ranked_dimensions.slice(0,6) | ✅ LOW |
| Profile DNA text | narrative.profileDNA.body | GPT-5.5 | Regenerate narrative (later) | ⚠️ MEDIUM |

---

## CONCLUSION

**Current system is clean and centralized:**
- ✅ Baseline scoring in one place
- ✅ Rankings computed once
- ✅ Both stored in canonical
- ✅ Passed through all downstream systems
- ✅ Rendered consistently across surfaces

**Insertion point is clear:**
- ✅ Add rescoring_v1 to canonical
- ✅ Preserve baseline scores separately
- ✅ Renderer uses fallback chain
- ✅ No breaking changes

**Safe to proceed with rescoring build.**

---

**Report complete. No code changes made.**
