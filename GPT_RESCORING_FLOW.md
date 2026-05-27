# GPT-5.5 RESCORING EXECUTION FLOW

**Status:** ✅ FLOW ANALYSIS COMPLETE

---

## EXECUTION TIMELINE

### Phase 1: Assessment Ingestion

```
User submits Q1-Q28 answers
    ↓
    POST /api/moremindmap/assess
    ↓
    buildProfileInput(answers)
        └─ Normalizes raw answers
        └─ Creates profileInput object
    ↓
    Job created: STAGE = CANONICAL_GENERATION
```

### Phase 2: Deterministic Baseline (CURRENT STATE)

```
executeCanonicalGeneration.js
    ↓
    generateCanonicalProfile(profileInput)
        ├─ STEP 1: Normalize & validate
        ├─ STEP 2: inferVectorScores()
        │   └─ Creates: ranked_dimensions [Vector, Horizon, Velocity, ...]
        │   └─ Stores: baseline_ranked_dimensions (copy)
        ├─ STEP 3-27: Deterministic inference
        │   ├─ inferBehavioralPatterns()
        │   ├─ inferContradictions()
        │   ├─ inferStressPatterns()
        │   ├─ inferCommunicationStyle()
        │   ├─ [20+ more analysis functions]
        │   └─ Builds complete canonical object
        │
        ├─ STEP 28: rescoreDimensions(canonical)
        │   └─ Reads: entire canonical
        │   └─ Analyzes: topology, dominance, spread
        │   └─ Creates: rescoring_v1 {
        │       ranked_dimensions: [rescored],
        │       dominance_profile: {...},
        │       spread_profile: {...},
        │       render_ready: {...},
        │       metadata: {...}
        │   }
        │
        ├─ ← INSERTION POINT ←
        │
        ├─ [NEW] rescoreDimensionsWithGPT(canonical) [ASYNC]
        │   └─ Reads: entire canonical + rescoring_v1
        │   └─ Calls: GPT-5.5 with behavioral prompt
        │   └─ Validates: response structure & grounding
        │   └─ Creates: rescoring_gpt {
        │       ranked_dimensions: [gpt_rescored],
        │       behavioral_insights: {...},
        │       gpt_confidence: 0.95,
        │       metadata: {...}
        │   }
        │
        └─ return canonical (all layers complete)
    ↓
    Vault Save
        ├─ redis.set(profile_id, canonical)
        └─ canonical now immutable & cached
    ↓
    Job Stage: NARRATIVE_GENERATION (async, separate)
```

### Phase 3: Retrieval (Later, via Profile ID)

```
GET /api/moremindmap/retrieve-profile?id={profile_id}
    ↓
    redis.get(profile_id)
    ↓
    Returns: canonical {
        ranked_dimensions: [baseline],
        baseline_ranked_dimensions: [baseline copy],
        rescoring_v1: {
            ranked_dimensions: [rescored_v1],
            ...
        },
        rescoring_gpt: {
            ranked_dimensions: [gpt_rescored],
            ...
        },
        ... all other fields ...
    }
    ↓
    Sent to: WebProfileReport renderer
```

### Phase 4: Rendering (Browser)

```
WebProfileReport.jsx
    ↓
    const ranked = data.rescoring_gpt?.ranked_dimensions?.length > 0
                 ? data.rescoring_gpt.ranked_dimensions
                 : data.rescoring_v1?.ranked_dimensions?.length > 0
                   ? data.rescoring_v1.ranked_dimensions
                   : data.ranked_dimensions
                   || [];
    ↓
    Use ranked[] to render:
        ├─ 8 DNA boxes (DNA box #1 = ranked[0], etc.)
        ├─ Command Clarity card (ranked[0])
        ├─ Speed vs Fidelity card (ranked[1])
        ├─ Strategic Leverage card (ranked[2])
        ├─ DNA Summary (ranked.slice(0,6))
        └─ Profile DNA context (from rescoring_v1.dominance_profile)
    ↓
    User sees: Report with rescored dimensions visible
```

---

## OBJECT SHAPES AT EACH STAGE

### Baseline Ranked Dimensions (Current)

```javascript
ranked_dimensions: [
  { dimension: 'vector', score: 0.86, rank: 1, confidence: 0.92 },
  { dimension: 'horizon', score: 0.42, rank: 2, confidence: 0.88 },
  { dimension: 'velocity', score: 0.35, rank: 3, confidence: 0.85 },
  { dimension: 'leverage', score: 0.28, rank: 4, confidence: 0.80 },
  { dimension: 'signal', score: 0.20, rank: 5, confidence: 0.75 },
  { dimension: 'fidelity', score: 0.15, rank: 6, confidence: 0.72 },
  { dimension: 'flex', score: -0.05, rank: 7, confidence: 0.68 },
  { dimension: 'framework', score: -0.15, rank: 8, confidence: 0.65 }
]
```

### rescoring_v1 Output (Current)

```javascript
rescoring_v1: {
  version: 'v2',
  phase: 'threshold_dominance_refinement',
  generated_at: '2026-05-27T16:30:00Z',
  generation_source: 'rescoring_engine_v2',
  
  ranked_dimensions: [
    { dimension: 'vector', score: 0.92, baseline_score: 0.86, delta: +0.06, rank: 1, confidence: 0.95 },
    { dimension: 'horizon', score: 0.38, baseline_score: 0.42, delta: -0.04, rank: 2, confidence: 0.87 },
    // ... 6 more, rescore based on dominance/topology
  ],
  
  dominance_profile: {
    primary_dimension: 'vector',
    secondary_dimension: 'horizon',
    dominance_amplitude: 0.92,
    spread_type: 'extreme',
    profile_intensity: 'high',
    threshold_band: 'extreme',
    threshold_weight: 1.4
  },
  
  spread_profile: {
    flatness_score: 0.3,
    polarization_score: 0.75,
    dominance_gap: 1.42,
    // ...
  },
  
  render_ready: {
    command_clarity: 0.92,
    speed_vs_fidelity: 0.34,
    strategic_leverage: 0.88,
    dominance_flavor: 'extreme',
    active_suppression: true,
    profile_intensity: 'extreme'
  },
  
  metadata: {
    baseline_hash: '0.86:0.42:0.35',
    rescoring_timestamp: '2026-05-27T16:30:00Z',
    rescoring_engine_version: 'v2.0.0',
    input_canonical_keys: '(full canonical)',
    phase_features: [
      'threshold_gravity',
      'compensatory_suppression',
      'flatness_preservation',
      'tension_amplification',
      'extremity_differentiation',
      'render_ready_intelligence'
    ]
  }
}
```

### rescoring_gpt Output (NEW)

```javascript
rescoring_gpt: {
  version: '1.0',
  phase: 'behavioral_cognitive_interpretation',
  generated_at: '2026-05-27T16:30:05Z',
  generation_source: 'gpt_rescoring_engine_v1',
  gpt_model: 'gpt-5.5',
  
  ranked_dimensions: [
    { 
      dimension: 'vector', 
      score: 0.94,              // GPT interpretation
      baseline_score: 0.86,
      v1_rescored_score: 0.92,
      delta_from_baseline: +0.08,
      delta_from_v1: +0.02,
      gpt_reasoning: 'Extreme directiveness amplified by pressure tolerance and organizational clarity',
      rank: 1, 
      confidence: 0.98 
    },
    // ... 7 more dimensions, with GPT behavioral interpretation
  ],
  
  behavioral_interpretation: {
    primary_system: 'vector',
    dominance_mechanism: 'Decision velocity creates command presence',
    secondary_dynamics: 'Horizon stabilizes speed, prevents recklessness',
    tension_analysis: 'Vector-Signal tension creates decisive focus (precision suppressed)',
    profile_archetype: 'High-agency operator with clear authority',
    psychological_profile: 'Action-first cognition, risk-tolerant',
    team_impact: 'Drives pace; suppresses deliberation',
    organizational_fit: 'Thrives in fast-moving, hierarchical environments',
    constraints: 'Struggles with consensus-heavy, process-heavy contexts',
    growth_edge: 'Integrating analytical depth with decisiveness'
  },
  
  gpt_render_ready: {
    command_clarity: 0.94,
    speed_vs_fidelity: 0.36,
    strategic_leverage: 0.90,
    behavioral_flavor: 'decisive_action_operator',
    psychological_archetype: 'high_agency_director',
    team_role_affinity: 'command_leader'
  },
  
  confidence_metrics: {
    overall_confidence: 0.98,
    baseline_alignment: 0.92,
    v1_alignment: 0.88,
    grounding_violations: 0,
    contradiction_flags: 0
  },
  
  metadata: {
    input_hash: '0.86:0.42:0.35',
    gpt_prompt_version: 'v1',
    gpt_token_usage: {
      input_tokens: 4200,
      output_tokens: 1800,
      total_tokens: 6000
    },
    generation_time_ms: 2400,
    validation_status: 'passed',
    grounding_evidence: [
      'Intake answer Q3: "I move fast"',
      'Intake answer Q8: "People follow my lead"',
      'Stress pattern: increases_directiveness',
      'Pressure mechanic: accelerates_pace',
      'Communication style: directive, authoritative'
    ]
  }
}
```

---

## FALLBACK SEQUENCE (RENDERER)

### Current Fallback (V1)

```javascript
const ranked = data.rescoring_v1?.ranked_dimensions?.length > 0
  ? data.rescoring_v1.ranked_dimensions
  : data.ranked_dimensions
  || [];
```

**Sequence:**
1. Check if rescoring_v1 has ranked_dimensions array ✓
2. If yes → use rescored values
3. If no → use baseline
4. If neither → use empty array

### New Fallback (With GPT)

```javascript
const ranked = data.rescoring_gpt?.ranked_dimensions?.length > 0
  ? data.rescoring_gpt.ranked_dimensions          // GPT layer
  : data.rescoring_v1?.ranked_dimensions?.length > 0
    ? data.rescoring_v1.ranked_dimensions         // Deterministic layer
    : data.ranked_dimensions                      // Baseline layer
    || [];                                         // Safety fallback
```

**Sequence:**
1. Check if GPT rescoring exists ✓
2. If yes → use GPT rescored values (most enriched)
3. If no → check deterministic rescoring ✓
4. If yes → use V1 rescored values (moderately enriched)
5. If no → use baseline (untouched original)
6. If neither → use empty array (safety)

**Safety Property:** Each layer available independently; any layer can be missing without breaking rendering

---

## ASYNC EXECUTION TIMELINE

```
T+0ms:   generateCanonicalProfile() starts
T+50ms:  deterministic inference completes
T+55ms:  rescoreDimensions() completes (rescoring_v1 ready)
T+60ms:  ← GPT call begins (ASYNC, non-blocking) ←
T+60ms:  Continue to Vault save (DON'T WAIT for GPT)
T+65ms:  Vault save starts
T+70ms:  Vault save completes, canonical persisted
T+80ms:  GPT response received (background)
T+85ms:  ← GPT validation completes (rescoring_gpt ready) ←
T+90ms:  redis.update(profile_id, rescoring_gpt) [non-critical]
T+95ms:  User receives canonical with/without rescoring_gpt
```

**Options:**

**Option A: Wait for GPT (Blocking)**
- Pro: guaranteed GPT rescoring in every canonical
- Con: adds 2-3 seconds latency to profile generation
- Pattern: `canonical = await buildWithGPT(...)`

**Option B: Fire-and-Forget (Non-blocking)**
- Pro: instant canonical delivery, no latency
- con: some profiles arrive without rescoring_gpt
- pattern: `fire_async_gpt_rescoring(canonical.profile_id)`

**Recommendation:** Option B (fire-and-forget)
- Faster user experience
- Renderer fallback handles missing rescoring_gpt
- GPT rescoring becomes available on next retrieval
- Can fetch fresh from cache after GPT completes

---

## VALIDATION CHECKPOINT

### GPT Response Validation

```javascript
async function rescoreDimensionsWithGPT(canonical) {
  // 1. Validate input canonical
  if (!canonical.ranked_dimensions || canonical.ranked_dimensions.length !== 8) {
    throw new Error('Invalid canonical: missing or malformed ranked_dimensions');
  }
  
  // 2. Call GPT-5.5
  const gptResponse = await callGPT55(gptPrompt, 'rescoring_behavioral');
  
  // 3. Validate response structure
  if (!gptResponse?.ranked_dimensions) {
    throw new Error('GPT response missing ranked_dimensions');
  }
  
  // 4. Validate ranked_dimensions array
  if (gptResponse.ranked_dimensions.length !== 8) {
    throw new Error(`Expected 8 dimensions, got ${gptResponse.ranked_dimensions.length}`);
  }
  
  // 5. Validate individual dimensions
  const dimensionNames = ['vector', 'horizon', 'velocity', 'leverage', 'signal', 'fidelity', 'flex', 'framework'];
  gptResponse.ranked_dimensions.forEach((dim, idx) => {
    if (dim.dimension !== dimensionNames[idx]) {
      throw new Error(`Dimension mismatch at index ${idx}: expected ${dimensionNames[idx]}, got ${dim.dimension}`);
    }
    if (typeof dim.score !== 'number' || dim.score < -10 || dim.score > 10) {
      throw new Error(`Invalid score for ${dim.dimension}: ${dim.score}`);
    }
    if (dim.rank !== idx + 1) {
      throw new Error(`Rank mismatch for ${dim.dimension}: expected ${idx + 1}, got ${dim.rank}`);
    }
  });
  
  // 6. Validate grounding
  if (!validateGrounding(gptResponse)) {
    throw new Error('GPT response failed grounding validation');
  }
  
  // 7. Return valid response
  return gptResponse;
}
```

---

## SUMMARY TABLE

| Layer | Source | Method | Latency | Fallback | Used By |
|-------|--------|--------|---------|----------|---------|
| **Baseline** | Q1-Q28 | Deterministic (formula) | ~10ms | None (source of truth) | Everything |
| **rescoring_v1** | Baseline + full canonical | Deterministic topology analysis | ~50ms | Baseline | Renderer DNA boxes |
| **rescoring_gpt** | rescoring_v1 + full canonical | GPT-5.5 behavioral interpretation | ~2500ms | rescoring_v1 | Renderer (if available) |

**Rendering Priority:** rescoring_gpt > rescoring_v1 > baseline

---

**FLOW ANALYSIS COMPLETE**
