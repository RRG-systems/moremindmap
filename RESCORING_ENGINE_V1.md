# RESCORING ENGINE V1: Behavioral Dominance Inference

**Commit:** 35a99cf  
**Status:** ✅ ENGINE LIVE - DOWNSTREAM INTELLIGENCE ACTIVE

---

## What It Does

The rescoring engine reads the ENTIRE canonical dossier to detect and amplify true behavioral hierarchies.

**NOT:** Random score stretching, dramatic exaggeration, or artificial intensity.

**IS:** Inference of which system actually dominates a person's operating model.

---

## Core Philosophy

1. **Humans are hierarchical, not balanced**
   - One system typically dominates
   - Others arrange themselves relative to that dominance

2. **One dominant system bends the rest**
   - If vector is dominant, horizon/leverage follow
   - If signal is dominant, fidelity/framework follow
   - Creates recognizable identity patterns

3. **Flat profiles stay flatter**
   - System doesn't artificially polarize balanced people
   - Preserves genuine profile structure

4. **Extreme profiles become more extreme**
   - Highly dominant systems get amplified
   - Creates clearer identity differentiation

5. **Near-threshold matters**
   - Second-place dimension position affects everything
   - Reinforces dominance hierarchy

---

## Inputs

The engine reads from ENTIRE canonical:

### Behavioral Evidence
- Baseline dimension scores (ranked_dimensions)
- Top systems (primary driver, secondary stabilizer)
- Pressure/stress patterns (how person behaves under load)
- Communication style
- Contradictions and tensions

### Written Evidence
- Intake answers (Q2, Q14, Q17, Q20, Q22, Q24-Q28)
- Written signals: directiveness, precision, momentum, relational
- Contradiction count (internal conflicts)

### Contextual Evidence
- Life direction
- Business operating reality
- Inferred patterns
- Hidden costs
- Organization effects

---

## Output

Populates `canonical.rescoring_v1` with:

```javascript
{
  version: "v1",
  generated_at: "2026-05-27T...",
  generation_source: "rescoring_engine_v1",
  
  // Rescored dimensions (same scale as baseline)
  ranked_dimensions: [
    { dimension: "vector", score: 0.92, baseline_score: 0.86, delta: +0.06, rank: 1, confidence: 0.95 },
    // ... 7 more
  ],
  
  // Dominance analysis
  dominance_profile: {
    primary_dimension: "vector",
    secondary_dimension: "signal",
    dominance_amplitude: 0.92,
    spread_type: "extreme",
    profile_intensity: "high"
  },
  
  // Spread characteristics
  spread_profile: {
    flatness_score: 0.3,
    polarization_score: 0.75,
    dominance_gap: 1.42,
    total_spread: 1.66,
    variance: 0.48,
    balanced_vs_extreme: "extreme"
  },
  
  // Dimension tensions
  tension_pairs: {
    velocity_vs_fidelity: 0.34,
    vector_vs_signal: -0.15,
    horizon_vs_flex: 0.42,
    leverage_vs_flex: -0.05
  },
  
  // Gravity (which dimension drives others)
  dominance_gravity: {
    strongest_system: "vector",
    gravity_strength: 0.92,
    downstream_influence: [
      { dimension: "horizon", correlation: 0.65 },
      { dimension: "leverage", correlation: 0.72 }
    ],
    drives_entire_profile: true
  },
  
  // Amplitude metrics
  amplitude_metrics: {
    highest_score: 0.92,
    lowest_score: -0.50,
    total_spread: 1.42,
    score_variance: 0.48
  },
  
  // Render ready (safe for immediate use)
  render_ready: {
    dna_summary: null,
    command_clarity: 0.92,
    speed_vs_fidelity: 0.34,
    strategic_leverage: 0.88
  },
  
  // Audit trail
  metadata: {...}
}
```

---

## Rescoring Logic (Phase 1)

### 1. Extract Evidence

- Baseline scores + contradictions
- Written signals from answers (directiveness, precision, momentum, relational)
- Stress/pressure patterns
- Top systems

### 2. Detect Dominance

- Primary dimension score + gap to secondary
- How clear is the dominance (gap_to_secondary)?
- Written signals alignment (do answers support baseline ranking?)
- Pressure harmony (does behavior under stress confirm dominance?)
- Contradiction dampening (do conflicts reduce confidence?)

### 3. Amplitude Adjustment

**Primary dimension:**
- If dominance is CLEAR + written evidence aligns: +0-15% amplification
- If written evidence contradicts: dampened by contradiction count
- Capped at +10 / -10

**Secondary dimension:**
- If gap to primary > 0.5: reduce slightly to clarify distance
- If profile is flat (low variance): keep it flat

**Profile spread preservation:**
- Flat profiles → stay flat
- Extreme profiles → potentially more extreme
- Balanced profiles → stay balanced

### 4. Analyze Spread

- Flatness score (0=flat, 1=extreme)
- Polarization (do scores cluster at extremes?)
- Dominance gap
- Classification: flat / balanced / extreme

### 5. Calculate Gravity

Which dimension drives others?

- If **vector** dominant → horizon + leverage follow
- If **signal** dominant → fidelity + framework follow
- If **velocity** dominant → flex follows
- Calculates correlation strength

### 6. Analyze Tensions

Key dimension pairs:
- velocity_vs_fidelity
- vector_vs_signal
- horizon_vs_flex
- leverage_vs_flex

Shows where systems conflict or align.

### 7. Amplitude Metrics

Summary statistics:
- Highest + lowest scores
- Total spread
- Variance

---

## Example: What Changes

### David (Extreme Vector Profile)

**Baseline:** vector +0.86, signal +0.60, horizon +0.42, ...

**Rescored:** vector +0.92, signal +0.50, horizon +0.35, ...

**What happened:**
1. Vector dominance detected (clear + gap to secondary 0.26)
2. Written signals align (answers show directiveness)
3. Pressure patterns confirm (doubles down under load)
4. Vector gets +0.06 amplification
5. Secondary signals reduced (clarify hierarchy)
6. **Result:** More recognizable "command-driven operator"

### Pamela (Flat Profile)

**Baseline:** signal +0.55, fidelity +0.50, vector +0.45, ...

**Rescored:** signal +0.55, fidelity +0.50, vector +0.44, ...

**What happened:**
1. No clear dominance (gap to secondary 0.05)
2. Profile stays flat (low variance preserved)
3. Minor adjustments for consistency
4. **Result:** Remains "blended, adaptive systems"

### Jonny (Concentrated Profile)

**Baseline:** vector +0.80, velocity +0.75, fidelity -0.20, ...

**Rescored:** vector +0.85, velocity +0.68, fidelity -0.25, ...

**What happened:**
1. Vector dominance clear (gap 0.20)
2. Written signals confirm
3. Velocity slightly compressed (clarify primary)
4. Fidelity pushed lower (show contrast)
5. **Result:** More "pure operator, suppressed precision"

---

## Safety & Constraints

### Baseline Preserved
- Original `ranked_dimensions` untouched
- `baseline_ranked_dimensions` stored as audit
- Renderer uses fallback: rescoring_v1 || baseline

### No Breaking Changes
- Engine reads entire canonical but doesn't modify it
- Rescoring_v1 is optional (schema was empty until now)
- All 6 target surfaces have fallback to baseline

### Scale Preserved
- Scores stay -10 to +10 (same as baseline)
- Rank stays 1-8 (8 dimensions)
- No new dimensions created

### Doctrine Maintained
- ✅ Baseline scoring untouched
- ✅ Ingress flows unchanged
- ✅ Orchestration parity maintained
- ✅ Renderer layout unchanged
- ✅ No narrative rewrite yet

---

## Integration

### When It Runs

During canonical generation:
```javascript
// After canonical object built
canonicalProfile.rescoring_v1 = rescoreDimensions(canonicalProfile);
```

### What Renderer Sees

```javascript
const ranked = data.rescoring_v1?.ranked_dimensions?.length > 0
  ? data.rescoring_v1.ranked_dimensions  // ← Uses rescored
  : data.ranked_dimensions               // ← Falls back to baseline
  || [];
```

### All 6 Surfaces Automatically Updated

- 8 DNA boxes: display rescored scores
- Command Clarity card: ranked[0]
- Speed vs Fidelity card: ranked[1]
- Strategic Leverage card: ranked[2]
- DNA Summary: ranked.slice(0,6)
- Profile DNA text: (narratives unchanged yet)

---

## Testing

### Verification

Load any profile and check:

```javascript
// In console:
console.log(canonical.rescoring_v1);  // Should now be populated
console.log(canonical.baseline_ranked_dimensions);  // Original preserved
```

### Expected:
- ✅ Rescored dimensions populated
- ✅ Dominance patterns detected
- ✅ 6 surfaces render rescored values
- ✅ Baseline still available as fallback

### Test Profiles:
- David: Should see vector amplified, signal reduced
- Pamela: Should stay relatively flat
- Jonny: Should see concentration amplified

---

## What This Phase Doesn't Do

❌ Rewrite narrative-v3 (yet)  
❌ Regenerate Profile DNA text (yet)  
❌ Rebuild Futures (yet)  
❌ Change orchestration  
❌ Modify ingress flows  
❌ Redesign renderer  

✅ These are FUTURE phases.

---

## Future Phases

### Phase 2: Narrative Regeneration
When rescored dimensions available, rebuild:
- Profile DNA text (profileDNA section)
- ExecutiveSummary with rescored context
- Contradictions analysis with new hierarchy

### Phase 3: Futures Enrichment
Generate futures from rescored dominance:
- Extreme profiles → more extreme futures
- Flat profiles → blended futures
- Tension dynamics → conflict scenarios

### Phase 4: Pressure Mechanics
Analyze how rescored profile responds to load

---

## Code Structure

### Main Export

```javascript
export function rescoreDimensions(canonical)
```

Input: Full canonical dossier  
Output: rescoring_v1 object

### Key Functions

1. `extractEvidence()` - Gather all signals from canonical
2. `detectDominance()` - Find primary system + clarity
3. `calculateRescoredDimensions()` - Adjust scores with dominance logic
4. `analyzeSpread()` - Characterize profile distribution
5. `calculateGravity()` - Which dimension drives others
6. `analyzeTensionPairs()` - Dimension conflicts/alignment
7. `calculateAmplitudeMetrics()` - Summary statistics
8. `assembleRescoring()` - Build final structure

### Supporting Functions

- `extractWrittenSignals()` - Parse Q2, Q14, Q17, Q20, Q22, Q24-Q28
- `checkWrittenAlignment()` - Do written answers match baseline?
- `checkPressureHarmony()` - Do stress patterns confirm dominance?
- `calculateConfidence()` - Confidence in rescored dimension
- `calculateVariance()` - Profile spread metric
- `hashDimensions()` - Audit trail

---

## Conclusion

✅ Engine reads full canonical  
✅ Detects behavioral hierarchy  
✅ Amplifies true dominance (not fake drama)  
✅ Preserves baseline for audit  
✅ All 6 surfaces auto-update  
✅ Zero breaking changes  

**Status:** Live on production. Ready for narrative regeneration (Phase 2).

---

**RESCORING ENGINE V1 DEPLOYED AND OPERATIONAL**
