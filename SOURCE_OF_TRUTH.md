# SOURCE_OF_TRUTH.md

**Updated:** Mon May 26, 2026 16:30 MST  
**Status:** STEP 3.5 COMPLETE - BEHAVIORAL INTELLIGENCE RENDER LAYER OPERATIONAL

---

## CANONICAL DOSSIER IS THE PRIMARY PRODUCT

### Architecture Declaration

The **canonical semantic dossier** (JSON structure stored in Vault) is the authoritative source of truth for behavioral intelligence.

**NOT:**
- PDFs (downstream renders)
- HTML reports (visual presentations)
- Email summaries (convenience formats)
- Markdown exports (document format)

**YES:**
- Canonical JSON in Vault (semantic structure)
- Indexed by email (retrieval key)
- Persisted long-term (source of record)
- Query-able by profile ID (primary identifier)

---

## DOCTRINE: ASSESSMENT → CANONICAL → BI EXTRACTION → RENDERS

```
User Assessment (28 questions)
         ↓
    Async Job Executor
         ↓
Canonical Dossier Generator (12 narratives, contradictions, evidence)
         ↓
    Vault Storage (persistent, indexed by email)
         ↓
Behavioral Intelligence Extraction (11 domains, tier 1-3 confidence)
         ↓
    RenderContract Layer (mapping BI → UI sections)
         ↓
    Content Depth Renderer (renderBIContent by domain)
         ↓
    WebProfileReport (8-page dashboard)
         ↓
    Render Outputs:
    - HTML (interactive, web-native)
    - PDF (static, downloadable)
    - Markdown (portable)
    - Email summary (convenience)
```

The canonical dossier is stable. BI extraction is read-only. Renders can change. The source never does.

---

## STEP 3.5: BEHAVIORAL INTELLIGENCE RENDER LAYER (2026-05-26)

### Complete Architecture

**Backend:** api/engine/canonical/extractIntelligence.js
- Extracts 11 BI domains from canonical dossier
- Pure read-only transformation
- No mutations to canonical

```
Domains (tier 1-3 confidence):
  ✅ operatingSystem (tier_1_high)
  ✅ worldExperience (tier_2_medium_high)
  ✅ othersExperience (tier_3_medium)
  ✅ pressureMechanics (tier_2_medium_high)
  ✅ contradictions (tier_3_medium)
  ✅ scalingConstraint (tier_2_medium)
  ✅ decisionArchitecture (tier_2_high)
  ✅ organizationalConsequences (tier_3_medium)
  ✅ facilitatorNotes (tier_3_medium)
  ✅ fiveFuturesStarter (tier_3_low)
  ✅ theOneMove (tier_3_low)
```

**Frontend Data Flow:** src/components/reports/WebProfileReport.jsx
```
Profile.jsx receives canonical + behavioral_intelligence_v1
         ↓
WebProfileReport accepts both as props
         ↓
RenderContract maps domains to sections + defines field paths
         ↓
extractSectionContent pulls BI domain data
         ↓
renderBIContent(domain, content) renders full structure
         ↓
Each page displays rich subsections with interpretations
```

### Critical Fixes (STEP 3.5 Complete)

**1. Data Flow Fixed** ✅
- Profile.jsx now stores `behavioral_intelligence_v1` in result state
- WebProfileReport receives it as prop
- All 8 pages receive BI data

**2. Domain Mapping Corrected** ✅
- `howOthersExperience` → `othersExperience` (backend actual name)
- `fiveFutures` → `fiveFuturesStarter` (backend actual name)

**3. Data Structure Handling** ✅
- FiveFuturesRenderer handles `futures: []` array
- Renders 5 distinct future cards with title + likelihood + trajectory + org_experience

**4. Content Depth Rendered** ✅
- Replaced simple `formatBIContent()` with `renderBIContent(domain, content)`
- Each domain renders ALL nested fields with proper subsections
- No single-field extractions anymore

**5. CSS Styling** ✅
- `.bi-subsection` with gold left border + subtle background
- `.zone-progression:empty` hides empty sections
- No vertical gap waste

### Live Test Profile

**Current Status:** MM-20260523-mqlev9c9  
**All sections rendering with full BI content:**
- ✅ Five Futures: 5 distinct cards visible
- ✅ Pressure Mechanics: primary + secondary escalation shown
- ✅ Others Experience: first impression + communication + listening + relational
- ✅ World Experience: perception + info processing + decision + time horizon + risk
- ✅ Facilitator Notes: guidance + structural + context
- ✅ The One Move: move + reasoning + impact
- ✅ Scaling Constraint: ceiling + coordination + infrastructure
- ✅ No blank titled sections
- ✅ No giant empty gaps

### Production Status

| Component | Status | Verification |
|-----------|--------|--------------|
| BI Extraction (11 domains) | ✅ Complete | Backend generates all domains |
| Domain Mapping (11 sections) | ✅ Complete | RenderContract correctly maps |
| Data Flow | ✅ Complete | Profile.jsx passes BI to all pages |
| Content Routing | ✅ Complete | Each page extracts correct domain |
| Content Depth | ✅ Complete | All nested fields rendered |
| CSS Styling | ✅ Complete | Subsections styled, gaps collapsed |
| Build | ✅ Pass | 122.51 kB gzip |
| Live Test | ✅ Pass | MM-20260523-mqlev9c9 renders cleanly |

### Latest Commits

```
a727487 - STEP 3.5 CONTENT DEPTH FIX: Render full BI nested structures
ec686da - STEP 3.5 RENDER AUDIT + FIX: Content injection fixes
4105379 - STEP 3.5: Content injection + redundancy cleanup
```

### Safe to Enhance / DO NOT TOUCH

**Safe to Enhance:**
- ✅ Render templates (WebProfileReport.jsx only)
- ✅ CSS styling (add more domain-specific styles)
- ✅ Content depth (add more fields if BI provides them)

**DO NOT TOUCH:**
- ❌ Backend BI extraction — working correctly
- ❌ Canonical dossier structure — stable and complete
- ❌ V3 Narrative layer — orthogonal, unfaffected
- ❌ Vault storage model — source of truth

---

## BENCHMARK PROFILE

**Reference Production Profile:**

```
Profile ID:    MM-20260523-mqlev9c9
Status:        ✅ STEP 3.5 COMPLETE
Created:       2026-05-26
Quality:       All BI domains rendering at full depth

Proof Points:
  - Five Futures: 5 cards rendered
  - Pressure Mechanics: Dual escalation shown
  - Others Experience: 4-pattern relational view
  - World Experience: 5-subsection decision model
  - Facilitator Notes: 3-part guidance
  - The One Move: Structured recommendation
  - Scaling Constraint: 3-mechanism framework
  - No blank sections
  - No empty gaps
```

This profile proves STEP 3.5 content injection and depth rendering complete.

---

**Last Updated:** 2026-05-26 16:30 MST  
**Doctrine Status:** STEP 3.5 COMPLETE, READY FOR LIVE PRODUCTION TESTING
