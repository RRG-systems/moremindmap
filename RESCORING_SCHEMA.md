# RESCORING SCHEMA: canonical.rescoring_v1

**Commit:** 0992bf3  
**Status:** ✅ SCHEMA DEPLOYED - NO LOGIC YET

---

## Overview

The rescoring layer (`canonical.rescoring_v1`) is now available in every canonical dossier as an empty, safe downstream structure.

**Purpose:**
- Provides safe container for future rescoring intelligence
- Preserves baseline scores (audit trail)
- Enables clean renderer fallback
- Maintains backward compatibility
- No production impact (yet empty)

---

## Schema Structure

### Root Object

```javascript
canonical.rescoring_v1 = {
  version: "v1",
  generated_at: null,              // Timestamp when rescoring runs
  generation_source: null,         // "rescoring_engine_v1" or similar
  
  ranked_dimensions: [],           // Will hold rescored [ {dimension, score, rank} ]
  
  dominance_profile: {...},        // Dimension dominance analysis
  spread_profile: {...},           // Score spread characteristics
  tension_pairs: {...},            // Dimension interaction analysis
  dominance_gravity: {...},        // Which dimension drives others
  amplitude_metrics: {...},        // Spread and variance metrics
  
  render_ready: {...},             // Safe overrides for specific surfaces
  metadata: {...}                  // Audit trail
};
```

---

## Field Reference

### ranked_dimensions (Primary Output)

```javascript
ranked_dimensions: [
  {
    dimension: "vector",     // Must match one of 8 base dimensions
    score: 0.86,             // -10 to +10 scale (MUST MATCH BASELINE SCALE)
    rank: 1,                 // 1-8 (ranking position)
    baseline_score: 0.80,    // Reference to baseline for comparison
    delta: 0.06,             // Change from baseline (informational)
    confidence: 0.95         // Confidence in rescored value (0-1)
  },
  // ... 7 more dimensions
]
```

**Requirements:**
- Must contain exactly 8 dimensions (vector, horizon, velocity, leverage, signal, flex, fidelity, framework)
- Scores MUST be -10 to +10 scale (same as baseline)
- Rank values 1-8 (no duplicates)
- Score order matches rank (highest score = rank 1)

**SAFETY:** If rescoring_v1.ranked_dimensions is empty or invalid, renderer falls back to baseline

---

### dominance_profile

```javascript
dominance_profile: {
  primary_dimension: "vector",     // Name of top-ranked dimension
  secondary_dimension: "signal",   // Name of 2nd-ranked dimension
  dominance_amplitude: 0.86,       // Score of primary dimension
  spread_type: "concentrated",     // "concentrated" | "distributed" | "bimodal"
  profile_intensity: "high"        // "low" | "medium" | "high"
}
```

**Purpose:** Describes overall scoring pattern (not used in rendering yet, for analysis)

**Spread types:**
- "concentrated" = one dimension dominates (high score, others much lower)
- "distributed" = scores relatively balanced across dimensions
- "bimodal" = two strong dimensions, others weaker

---

### spread_profile

```javascript
spread_profile: {
  flatness_score: 0.4,             // 0-1: how flat is the profile (low=concentrated)
  polarization_score: 0.7,         // 0-1: how polarized (high=some high, some low)
  dominance_gap: 1.66,             // Difference between rank 1 and rank 8 scores
  balanced_vs_extreme: "extreme"   // "balanced" | "extreme" | "mixed"
}
```

**Purpose:** Characterize score distribution (informational for analysis)

---

### tension_pairs

```javascript
tension_pairs: {
  velocity_vs_fidelity: 0.34,      // Tension between two dimensions (delta / max)
  vector_vs_signal: -0.15,         // Negative = conflicts, positive = aligned
  horizon_vs_flex: 0.42,
  leverage_vs_flex: -0.05
}
```

**Purpose:** Quantify interactions between dimension pairs (for future interpretation)

---

### dominance_gravity

```javascript
dominance_gravity: {
  strongest_system: "vector",      // Primary dimension
  gravity_strength: 0.86,          // Its score
  downstream_influence: [          // Which dimensions move with it
    { dimension: "horizon", correlation: 0.65 },
    { dimension: "signal", correlation: 0.42 }
  ]
}
```

**Purpose:** Track which dimension drives behavior (for future pressure analysis)

---

### amplitude_metrics

```javascript
amplitude_metrics: {
  highest_score: 0.86,             // Max dimension score
  lowest_score: -0.50,             // Min dimension score
  total_spread: 1.36,              // highest - lowest
  score_variance: 0.48             // Statistical variance across 8 scores
}
```

**Purpose:** Summary statistics (for audit + future comparative analysis)

---

### render_ready

```javascript
render_ready: {
  dna_summary: null,               // Formatted string for DNA Summary box (if different)
  command_clarity: null,           // Override for Command Clarity card score
  speed_vs_fidelity: null,         // Override for Speed vs Fidelity card score
  strategic_leverage: null         // Override for Strategic Leverage card score
}
```

**Purpose:** Pre-formatted values for renderer (optional convenience, not required)

**Usage:**
```javascript
// In renderer (pseudo-code)
const commandClarityScore = canonical.rescoring_v1?.render_ready?.command_clarity
                         || canonical.rescoring_v1?.ranked_dimensions?.[0]?.score
                         || canonical.ranked_dimensions[0]?.score
```

---

### metadata

```javascript
metadata: {
  baseline_hash: null,             // Hash of baseline for consistency check
  rescoring_timestamp: null,       // When rescoring was generated
  rescoring_engine_version: null,  // Which engine generated this (e.g., "rescoring-v1.0.2")
  input_canonical_hash: null       // Hash of canonical dossier used for rescoring
}
```

**Purpose:** Audit trail and versioning

---

## Baseline Preservation

### baseline_ranked_dimensions

```javascript
canonical.baseline_ranked_dimensions = [...original ranked_dimensions];
```

**Added automatically alongside rescoring_v1**

**Purpose:**
- Preserve original deterministic scoring
- Enable comparison (rescored vs baseline)
- Audit trail (always know what changed)
- Fallback reference for renderer

**NEVER MODIFIED:** This is read-only after initial assignment

---

## Renderer Fallback Chain

### Current Implementation

```javascript
// In WebProfileReport.jsx line 1046
const ranked = data.rescoring_v1?.ranked_dimensions?.length > 0
  ? data.rescoring_v1.ranked_dimensions
  : data.ranked_dimensions 
  || [];
```

**Fallback order:**
1. ✅ rescoring_v1.ranked_dimensions (if populated)
2. ✅ baseline ranked_dimensions (default)
3. ✅ `[]` empty array (graceful)

**Result:** All 6 target surfaces automatically use rescored values when available

**Safety:** Zero breaking changes (rescoring_v1 is empty initially)

---

## Current State (After Deployment)

### What Changed
- ✅ canonical.rescoring_v1 object added (empty schema)
- ✅ canonical.baseline_ranked_dimensions added (audit copy)
- ✅ Renderer fallback chain added (no visual change)

### What Did NOT Change
- ✗ Baseline scoring logic
- ✗ Ingress flows (FATHOMFREE, Profile ID)
- ✗ Orchestration
- ✗ Renderer layout
- ✗ Output (still baseline, no rescoring yet)

### Visible Impact
- ✓ NONE (schema is empty, fallback uses baseline)

---

## Future Rescoring Build (Next Phase)

When rescoring engine is built, it will:

1. **Read entire canonical dossier**
   - All dimensions, contradictions, patterns, etc.
   - NOT just Q1-Q28 raw answers

2. **Populate rescoring_v1.ranked_dimensions**
   - Same structure as baseline (8 dimensions, -10 to +10 scale)
   - New ranking (may reorder which dimension is #1)
   - Optional confidence/delta for audit

3. **Populate other rescoring_v1 fields**
   - Dominance analysis
   - Spread profile
   - Tension pairs
   - Metadata

4. **Renderer automatically switches**
   - No changes needed to WebProfileReport
   - All 6 surfaces display rescored values
   - Baseline preserved for audit

---

## Integration Points

### Already Ready for Rescoring

| Component | Status | Ready for | Override Point |
|-----------|--------|-----------|-----------------|
| 8 DNA boxes | ✅ | rescored values | ranked[i].score |
| Command Clarity card | ✅ | rescored rank[0] | ranked[0].score |
| Speed vs Fidelity card | ✅ | rescored rank[1] | ranked[1].score |
| Strategic Leverage card | ✅ | rescored rank[2] | ranked[2].score |
| DNA Summary | ✅ | rescored summary | ranked.slice(0,6) |
| Profile DNA text | ⏳ | regenerated narrative | Would rebuild from rescored input (separate task) |

---

## Safety Guarantees

### No Breaking Changes
- ✅ Rescoring_v1 is optional (can be null)
- ✅ Renderer has 3-level fallback
- ✅ Baseline scores preserved
- ✅ No ingress changes
- ✅ Orchestration parity maintained

### Backward Compatible
- ✅ Old profiles (before this commit) will have empty rescoring_v1
- ✅ New profiles will have empty rescoring_v1
- ✅ Both render identically (baseline fallback)

### Audit Trail
- ✅ baseline_ranked_dimensions stores original
- ✅ rescoring_v1.metadata tracks rescoring applied
- ✅ Comparison: rescoring_v1.ranked_dimensions[i].delta shows change from baseline

---

## Testing This Schema

### Current State (After Deploy)
```javascript
// All profiles will have:
canonical.rescoring_v1 = {
  version: "v1",
  generated_at: null,  // Not generated yet
  ranked_dimensions: []  // Empty array
};

canonical.baseline_ranked_dimensions = [original 8 dimensions];
```

### Verification
1. Load any profile (David, Pamela, Jonny)
2. Open DevTools console:
   ```javascript
   console.log(canonical.rescoring_v1);  // Should show empty schema
   console.log(canonical.baseline_ranked_dimensions);  // Should show original scores
   ```

3. Verify renderer still works:
   - 8 DNA boxes render baseline (since rescoring_v1 is empty)
   - 3 cards render baseline
   - DNA Summary renders baseline
   - Profile DNA text unchanged

### Expected Result
✅ Everything works exactly as before (no rescoring active)
✅ Schema is ready for next phase

---

## Next Steps (When Ready)

### Phase 2: Rescoring Engine
1. Create `/api/engine/rescoring/rescoreDimensions.js`
2. Implement rescoring logic (reads full canonical)
3. Populate canonical.rescoring_v1.ranked_dimensions
4. All 6 surfaces automatically switch to rescored values

### Phase 3: Narrative Regeneration (Optional)
1. When rescored dimensions available
2. Rebuild profileDNA narrative from rescored input
3. Run narrative-v3 with rescored ranked_dimensions

---

## Schema Files Generated

- This file: `RESCORING_SCHEMA.md` (reference)
- Code: `/api/engine/canonical/canonicalProfileGenerator.js` (schema initialization)
- Code: `/src/components/reports/WebProfileReport.jsx` (renderer fallback)

---

## Conclusion

✅ Rescoring schema now safely in place  
✅ Renderer ready for rescored values  
✅ Baseline preserved for audit  
✅ Zero breaking changes  
✅ Ready for rescoring engine build (next phase)

---

**Status: Schema complete and deployed. Awaiting rescoring engine implementation.**
