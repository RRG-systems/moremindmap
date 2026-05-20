# CANONICAL PIVOT DOCTRINE

**Created:** Wed May 20, 2026 09:51 MST  
**Freeze Point:** `mini-v2-pre-canonical-pivot`

---

## THE PROBLEM

### Current State
Mini V2 renders reports with **zero placeholders** but **weak semantic quality**.

**What exists:**
- ✅ Async timeout architecture (working)
- ✅ Redis job queue (working)
- ✅ Staged execution pipeline (working)
- ✅ Template injection (working)
- ✅ Fallback completion (fills all fields)
- ✅ Frontend delivery (renders HTML)

**What's missing:**
- ❌ Intelligent content generation
- ❌ Score → semantic interpretation layer
- ❌ Behavioral pattern recognition
- ❌ Strategic framing intelligence
- ❌ Narrative coherence validation

---

## THE GAP

### Current Flow
```
Assessment Answers
  ↓
buildProfileInput (scoring + dimension ranking)
  ↓
GPT: "Generate report from this profile data"
  ↓ (GPT returns ~50% of fields)
Repair Pass GPT: "Fill missing fields"
  ↓ (GPT returns ~20% of remaining)
Deterministic Fallback: Fill everything else
  ↓ (Generic but profile-aware text)
Template Injection
  ↓
HTML Report (0 placeholders, weak semantics)
```

### The Missing Layer
**NO CANONICAL INTERPRETER between profileInput and generation**

profileInput contains:
- Dimension scores (8 dimensions, ranked)
- Top systems (primary driver, secondary stabilizer, opposing patterns)
- Written response analysis
- Trade-offs and synergies
- Raw operating data

**But there's no intelligence that says:**

"This is a **Command/Perspective** profile (Vector 8.2, Horizon 7.1)"
- Operating signature: "Decisive directive with future-framing"
- Leadership pattern: "Establishes direction early, thinks multi-move"
- Pressure manifestation: "Accelerates to action, may skip present context"
- Blind spot field: "Relational timing, collaborative pacing"
- Strategic frame: "Move fast AND orient team to outcomes"

**This interpretation DOES NOT EXIST in the current system.**

---

## THE CANONICAL PIVOT

### What Is Canonical?

**Canonical** = The authoritative semantic interpretation of profile data that exists BEFORE content generation.

**Example:**

**Raw Data:**
```javascript
{
  dimension_scores: {
    vector: { raw_score: 8.2, rank: 1 },
    horizon: { raw_score: 7.1, rank: 2 },
    signal: { raw_score: 2.1, rank: 7 },
    flex: { raw_score: 1.8, rank: 8 }
  }
}
```

**Canonical Interpretation:**
```javascript
{
  profile_type: "Command/Perspective (Vector-Horizon)",
  operating_signature: "Decisive directive with long-range framing",
  
  leadership_approach: {
    primary_mode: "Establishes direction before consensus forms",
    stabilizing_force: "Connects current decisions to future states",
    team_experience: "Clear where we're going, may feel hard to slow down",
    challenge_surface: "Speed can outpace shared understanding"
  },
  
  decision_architecture: {
    formation_pattern: "Direction emerges quickly through future lens",
    validation_method: "Does this move us toward the right end state?",
    speed_driver: "High vector creates urgency bias",
    blind_spot: "May miss relational timing signals"
  },
  
  pressure_response: {
    primary_shift: "Accelerates to action",
    secondary_shift: "Narrows to fewer variables",
    strain_pattern: "Low signal means relational cues get missed",
    recovery_path: "Build explicit feedback loops"
  },
  
  development_priorities: [
    "Build relational awareness (signal) before speed",
    "Practice collaborative pacing without losing direction",
    "Integrate present-state context into future framing"
  ],
  
  communication_style: {
    message_structure: "Direction-first, context-later",
    effectiveness_peak: "When team already shares urgency",
    friction_point: "Can feel too directive in consensus cultures"
  },
  
  environment_fit: {
    thrives_in: "Fast-moving orgs that reward decisive action",
    struggles_in: "Cultures that over-index on process and consensus",
    unlocks_when: "Given autonomy + strategic context"
  }
}
```

**THIS is canonical.**

It's not just dimension labels.  
It's not just generic bodies.  
It's **semantic intelligence** that interprets raw scores into strategic behavioral insight.

---

## THE PIVOT ARCHITECTURE

### New Layer: Canonical Interpreter

**Location in pipeline:** AFTER buildProfileInput, BEFORE GPT generation

```
Assessment Answers
  ↓
buildProfileInput (scoring + dimension ranking)
  ↓
🆕 CANONICAL INTERPRETER ← NEW LAYER
  ↓ (generates authoritative semantic interpretation)
canonicalProfile = {
  profile_type,
  operating_signature,
  leadership_approach,
  decision_architecture,
  pressure_response,
  development_priorities,
  communication_style,
  environment_fit,
  ...
}
  ↓
GPT Generation (with canonical context)
  ↓
Template Injection
  ↓
HTML Report (rich semantics, strategic depth)
```

---

## WHAT THE CANONICAL INTERPRETER DOES

### 1. Profile Type Classification
Maps dimension combinations to behavioral archetypes:
- Command/Perspective (Vector-Horizon)
- Relational/Structure (Signal-Framework)
- Precision/Tempo (Fidelity-Velocity)
- etc.

### 2. Operating Signature Generation
Synthesizes top 2-3 dimensions into one-line strategic frame:
- "Decisive directive with long-range framing"
- "Relational calibration through structured process"
- "Precision-first execution at high tempo"

### 3. Behavioral Pattern Recognition
Interprets dimension interactions:
- High vector + low signal = "Fast action, misses relational timing"
- High framework + low flex = "Process-driven, struggles with pivot"
- High horizon + low velocity = "Strategic but slow to execute"

### 4. Strategic Framing
For each major section (leadership, decisions, communication, etc.):
- Primary behavioral driver
- Stabilizing force
- Challenge surface
- Development path

### 5. Narrative Coherence
Ensures all content connects back to:
- Profile type
- Operating signature
- Core dimension interactions

---

## WHAT CHANGES (AND WHAT DOESN'T)

### DOES NOT CHANGE
- ✅ Async architecture (Redis, polling, stages)
- ✅ Template HTML files (structure preserved)
- ✅ Field injection logic (still string replacement)
- ✅ Frontend delivery (still renders HTML)
- ✅ Questions (24 assessment questions)
- ✅ Stripe integration
- ✅ Visual design (CSS/styling)

### DOES CHANGE
- 🔄 Content generation quality (richer semantic input)
- 🔄 GPT prompts (include canonical interpretation)
- 🔄 Field population (guided by canonical data)
- 🔄 Fallback logic (uses canonical patterns, not generic text)

### NEW ADDITIONS
- 🆕 `api/engine/canonicalInterpreter.js` — The interpreter
- 🆕 Canonical profile schema
- 🆕 Behavioral pattern library
- 🆕 Strategic framing templates

---

## IMPLEMENTATION APPROACH

### Phase 1: Build Canonical Interpreter
**File:** `api/engine/canonicalInterpreter.js`

**Function:** `interpretProfile(profileInput)`

**Returns:** `canonicalProfile` object

**Logic:**
1. Extract dimension rankings
2. Classify profile type
3. Generate operating signature
4. Build behavioral patterns for:
   - Leadership
   - Decision architecture
   - Communication
   - Pressure response
   - Development priorities
   - Environment fit
5. Create strategic framing for each section
6. Return complete canonical interpretation

### Phase 2: Integrate Into Pipeline
**Location:** `api/engine/miniV2StagedExecutor.js`

**In:** `executeFirstPassGeneration()`

```javascript
// After buildProfileInput
const profileInput = await buildProfileInput({ answers })

// NEW: Generate canonical interpretation
const { interpretProfile } = await import('./canonicalInterpreter.js')
const canonicalProfile = interpretProfile(profileInput)

// Store both in job
await updateJob(job.job_id, {
  profileInput,
  canonicalProfile  // ← NEW
})

// Pass canonical data to GPT
let reportContent = await generateReportContent(profileInput, canonicalProfile)
```

### Phase 3: Enhance GPT Prompts
**File:** `api/prompts/moremindmapMiniV2Prompt.js`

**Old prompt:**
"Generate report from dimension scores..."

**New prompt:**
```
Generate behavioral profile report for:

Profile Type: Command/Perspective (Vector-Horizon)
Operating Signature: "Decisive directive with long-range framing"

Leadership Approach:
- Primary mode: Establishes direction before consensus
- Team experience: Clear where we're going, may feel hard to slow down
- Challenge surface: Speed can outpace shared understanding

[Include full canonical interpretation]

Generate rich, specific content that reflects this exact behavioral signature.
```

### Phase 4: Update Fallback Logic
**File:** `api/engine/completeMissingMiniV2Fields.js`

**Current:** Uses dimension labels generically

**New:** Uses canonical patterns

```javascript
function getSmartBody(fieldName, profileInput, canonicalProfile) {
  if (fieldName.includes('leadership')) {
    return canonicalProfile.leadership_approach.primary_mode + ". " +
           canonicalProfile.leadership_approach.team_experience + ". " +
           canonicalProfile.leadership_approach.challenge_surface;
  }
  // etc.
}
```

---

## SUCCESS METRICS

### Before Canonical Pivot
- ✅ 0 placeholders
- ⚠️ Generic fallback text
- ⚠️ Weak semantic depth
- ⚠️ Formulaic phrasing
- ⚠️ Missing strategic coherence

### After Canonical Pivot
- ✅ 0 placeholders
- ✅ Profile-specific behavioral insight
- ✅ Strategic depth and framing
- ✅ Coherent narrative throughout
- ✅ Matches PDF reference quality

---

## GUIDING PRINCIPLES

### 1. Canonical = Authoritative
The canonical interpretation is the **single source of truth** for what this profile means.

All content generation flows FROM canonical, not invented independently.

### 2. Interpretation Before Generation
Don't ask GPT to both interpret AND generate.

Interpret FIRST (deterministic).  
Generate SECOND (guided by interpretation).

### 3. Semantic Precision Over Volume
Better to have fewer fields with rich semantics than many fields with weak content.

Canonical interpreter ensures every field reflects real behavioral insight.

### 4. Preserve What Works
Async architecture, templates, injection logic — all proven.

Don't rebuild infrastructure. Add intelligence layer.

### 5. Progressive Enhancement
Start with core canonical interpretation (profile type, operating signature).

Expand to full behavioral pattern library over time.

---

## THE TRANSFORMATION

### Before
```
"This profile leads by establishing command early and maintaining 
momentum through perspective. Team members experience clear direction 
but may need explicit permission to challenge assumptions."
```
*Generic dimension-label substitution*

### After
```
"This is a Command/Perspective profile—you establish direction before 
consensus forms and frame decisions through a multi-move lens. Teams 
experience clarity about where you're going but may struggle to slow you 
down once momentum builds. Your challenge surface appears when speed 
outpaces shared context: you've already oriented to the future state 
while others are still processing the current one. Effectiveness increases 
when you invest 30 seconds upfront explaining the 'why behind the where' 
—this builds permission to move fast without feeling like you're running 
ahead of the team."
```
*Strategic framing from canonical behavioral signature*

---

## NEXT STEPS (AFTER FREEZE)

1. **Design canonical profile schema**
2. **Build behavioral pattern library**
3. **Implement `canonicalInterpreter.js`**
4. **Integrate into staged executor**
5. **Enhance GPT prompts with canonical context**
6. **Update fallback logic to use canonical patterns**
7. **Test with real profiles**
8. **Validate semantic quality improvement**

---

**THE FREEZE PRESERVES THE WORKING RENDERER.**

**THE PIVOT BUILDS THE MISSING INTELLIGENCE LAYER.**

**CANONICAL INTERPRETATION IS THE PATH TO PROFESSIONAL-GRADE SEMANTIC QUALITY.**
