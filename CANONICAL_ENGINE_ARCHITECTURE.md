# CANONICAL ENGINE ARCHITECTURE

**Created:** Wed May 20, 2026 10:01 MST  
**Phase:** Step 2A - Foundation Architecture

---

## THE CORE PRINCIPLE

**Canonical artifact becomes source of truth.**

**PDFs become render outputs only.**

**Behavioral intelligence is generated ONCE, rendered MANY TIMES.**

---

## THE SEPARATION

### What Is Canonical
**Canonical Profile** = Authoritative semantic interpretation of behavioral data

**Contains:**
- Profile type classification
- Operating signature
- Behavioral pattern intelligence
- Contradiction analysis
- Stress response patterns
- Communication architecture
- Leadership dynamics
- Development priorities
- Environment fit analysis
- Strategic narrative framing

**Format:** Structured JSON object

**Purpose:** Single source of truth for all downstream artifacts

---

### What Is Rendering
**Renderer** = Presentation layer that transforms canonical intelligence into visual formats

**Produces:**
- 10-page PDF reports
- Dashboard widgets
- Recruiter summaries
- Coaching overlays
- Email digests
- Future image systems

**Format:** HTML, PDF, images, etc.

**Purpose:** Make canonical intelligence consumable for specific use cases

---

## THE ARCHITECTURAL PIVOT

### Before (Current Frozen State)
```
Assessment Answers
  ↓
buildProfileInput (scoring)
  ↓
GPT Generation ("generate report from scores")
  ↓
Template Injection (mechanical replacement)
  ↓
HTML Report (0 placeholders, weak semantics)
```

**Problem:** No intelligence layer between data and presentation.

---

### After (Canonical Architecture)
```
Assessment Answers
  ↓
buildProfileInput (scoring)
  ↓
🆕 CANONICAL ENGINE
  ├─ inferVectorScores
  ├─ inferBehavioralPatterns
  ├─ inferContradictions
  ├─ inferStressPatterns
  ├─ inferCommunicationStyle
  ├─ inferLeadershipArchitecture
  └─ buildNarrativeProfile
  ↓
Canonical Profile (behavioral intelligence artifact)
  ↓
RENDER LAYER (consumes canonical)
  ├─ Mini V2 PDF Renderer
  ├─ Dashboard Widget Renderer
  ├─ Recruiter Report Renderer
  └─ Future Renderers
  ↓
Visual Outputs (PDFs, HTML, images, etc.)
```

**Solution:** Canonical engine generates intelligence once, renderers consume it many times.

---

## KEY ARCHITECTURAL DECISIONS

### 1. Answers Are Behavioral Traces
Assessment answers are NOT the profile.  
They are **behavioral traces** that reveal the underlying operating system.

The canonical engine **infers** the operating system from traces.

### 2. Inference Matters More Than Declarations
Don't ask "How do you lead?"  
Infer leadership patterns from:
- Dimension interactions
- Contradiction patterns
- Stress responses
- Communication priorities

Inference is more accurate than self-report.

### 3. Renderer Should Never Think
Renderers are presentation logic only.

**Renderer's job:**
- Take canonical intelligence
- Format for visual consumption
- Apply layout rules
- Inject into templates

**NOT renderer's job:**
- Interpret scores
- Generate behavioral insight
- Make strategic decisions
- Create narrative coherence

All intelligence happens in canonical engine.

### 4. Canonical Artifact Feeds Future Systems

**Today:** Mini V2 PDF reports

**Tomorrow:**
- RRG lead scoring integration (use canonical to score leads)
- Recruiter dashboard (show behavioral fit for roles)
- Coaching overlays (development path tracking)
- Team dynamics analysis (canonical profiles + team composition)
- Hiring scorecards (canonical + job requirements)
- Image generation (behavioral signature → visual metaphor)

**Canonical profile is reusable intelligence.**  
Don't rebuild behavioral interpretation for each new output format.

---

## CANONICAL ENGINE COMPONENTS

### Core Modules (Created)

**1. canonicalProfileSchema.js**
- Defines authoritative schema
- Documents all canonical fields
- Provides dimension labels + descriptions

**2. inferVectorScores.js**
- Extracts dimension scores from profileInput
- Normalizes to 0-10 scale
- Ranks dimensions by score
- Pure data extraction (no interpretation)

**3. inferBehavioralPatterns.js**
- Classifies profile type
- Generates operating signature
- Infers leadership approach
- Infers decision architecture
- Infers communication style
- Infers pressure response
- **CORE INTELLIGENCE LAYER**

**4. inferContradictions.js**
- Detects dimension conflicts
- Identifies high-high tensions
- Identifies high-low blind spots
- Describes behavioral manifestation
- Suggests resolution paths

**5. inferStressPatterns.js**
- Identifies primary stress response
- Identifies secondary stress shift
- Detects blind spot emergence
- Builds escalation chain
- Generates recovery paths

**6. inferCommunicationStyle.js**
- Determines message structure
- Infers channel preferences
- Identifies effectiveness peaks
- Identifies friction points
- Suggests calibrations

**7. inferLeadershipArchitecture.js**
- Identifies primary leadership mode
- Identifies stabilizing force
- Infers team experience
- Detects challenge surfaces
- Suggests leadership calibrations

**8. buildNarrativeProfile.js**
- Synthesizes executive summary
- Builds leadership narrative
- Builds decision narrative
- Builds communication narrative
- Builds development narrative

**9. canonicalProfileGenerator.js**
- Master orchestrator
- Coordinates all inference modules
- Assembles complete canonical artifact
- Returns authoritative behavioral intelligence

---

## INTEGRATION POINTS

### Where Canonical Engine Plugs In

**Current pipeline:** `api/engine/miniV2StagedExecutor.js`

**Stage:** `executeFirstPassGeneration()`

**Integration point:**
```javascript
// After buildProfileInput
const profileInput = await buildProfileInput({ answers })

// NEW: Generate canonical profile
const { generateCanonicalProfile } = await import('./canonical/canonicalProfileGenerator.js')
const canonicalProfile = await generateCanonicalProfile(profileInput)

// Store in job
await updateJob(job.job_id, {
  profileInput,
  canonicalProfile  // ← NEW
})

// Pass to GPT generation (enhanced prompts)
let reportContent = await generateReportContent(profileInput, canonicalProfile)
```

**No changes to:**
- Async architecture
- Redis structure
- Polling logic
- Template injection
- Frontend delivery

---

## WHAT CHANGES (AND WHAT DOESN'T)

### DOES NOT CHANGE
- ✅ Async timeout architecture
- ✅ Redis job queue
- ✅ Staged execution pipeline
- ✅ Template HTML files
- ✅ Field injection logic
- ✅ Frontend polling
- ✅ Questions
- ✅ Visual design
- ✅ Stripe integration

### DOES CHANGE
- 🔄 Content quality (richer semantic input)
- 🔄 GPT prompts (canonical context provided)
- 🔄 Field population (guided by canonical intelligence)
- 🔄 Fallback logic (uses canonical patterns)

### NEW ADDITIONS
- 🆕 `/api/engine/canonical/` directory (9 modules)
- 🆕 Canonical profile schema
- 🆕 Behavioral inference logic
- 🆕 Strategic framing intelligence

---

## FUTURE RENDERERS (BEYOND PDF)

### The Vault Will Store
1. **canonical_profile.json** ← SOURCE OF TRUTH
2. mini_report.html (rendered from canonical)
3. canonical_profile.md (markdown narrative)
4. profile_metadata.json
5. profile_signature (DNA code)

### Future Render Targets
All consume the SAME canonical profile:

**1. Mini V2 PDF** (current)
- 10-page behavioral report
- Template-based rendering

**2. Recruiter Dashboard**
- Behavioral fit scoring
- Role alignment analysis
- Team composition suggestions

**3. RRG Lead Scoring**
- Canonical profile → lead quality score
- Decision-maker identification
- Engagement strategy recommendations

**4. Coaching Overlays**
- Development path tracking
- Contradiction work
- Growth milestones

**5. Team Dynamics Analysis**
- Multiple canonical profiles
- Interaction pattern detection
- Team composition optimization

**6. Hiring Scorecards**
- Canonical profile + job requirements
- Behavioral fit scoring
- Interview guide generation

**7. Image Generation**
- Behavioral signature → visual metaphor
- Operating pattern → diagram
- Communication style → infographic

---

## IMPLEMENTATION SEQUENCE

### Phase 1: Foundation (CURRENT - Step 2A)
- ✅ Create canonical engine directory
- ✅ Create module skeletons
- ✅ Define schema
- ✅ Document architecture

### Phase 2: Core Inference (Step 2B)
- Implement inferVectorScores (data extraction)
- Implement inferBehavioralPatterns (core intelligence)
- Implement inferContradictions (tension detection)

### Phase 3: Pattern Libraries (Step 2C)
- Build behavioral pattern recognition library
- Build profile type classifier
- Build strategic framing templates

### Phase 4: Integration (Step 2D)
- Wire canonical engine into staged executor
- Enhance GPT prompts with canonical context
- Update fallback logic to use canonical patterns

### Phase 5: Validation (Step 2E)
- Test canonical generation quality
- Compare canonical vs current output
- Validate semantic improvements

---

## SUCCESS METRICS

### Canonical Quality
- Profile type classified correctly
- Operating signature captures essence
- Behavioral patterns reflect dimension interactions
- Contradictions identified accurately
- Strategic framing is coherent

### Render Quality
- GPT generates richer content (guided by canonical)
- Fallbacks use canonical patterns (not generic text)
- Narrative coherence across all sections
- Professional-grade semantic quality

### Reusability
- One canonical profile generates:
  - PDF report
  - Dashboard widget
  - Recruiter summary
  - Coaching overlay
  - Future formats

---

## GUIDING PRINCIPLES

### 1. Separate Intelligence from Presentation
**Intelligence:** Canonical engine  
**Presentation:** Renderers

Never mix the two.

### 2. Generate Intelligence Once
Canonical profile is expensive to generate (inference + validation).

Generate ONCE.  
Render MANY TIMES.

### 3. Preserve Working Infrastructure
Async architecture, templates, injection — all proven.

Don't rebuild what works.  
Add intelligence layer.

### 4. Progressive Enhancement
Start with core inference (profile type, operating signature).

Expand pattern library over time.

Build reusable intelligence, not one-off content.

---

**CANONICAL ENGINE ARCHITECTURE DEFINED**

**Next:** Implement core inference logic (Step 2B when authorized)
