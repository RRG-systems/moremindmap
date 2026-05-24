# MINI_V2_VISUAL_GAP_REPORT.md

**Updated:** Sat May 24, 2026 02:15 MST  
**Status:** V3 Narrative live + WebProfileReport wired. Visual ascension next phase.  
**Intelligence Architecture:** LOCKED (no more changes before visual design)  

---

## CURRENT STATUS: NOT REDESIGNING

**Decision:** DO NOT redesign visual templates during quality ascension phase.

**Reason:** Canonical dossier quality must reach 85+/100 before designing renders that match its intelligence level.

**Pathway:** Quality → Renders → Scale (not Renders → Quality → Scale)

---

## V3 NARRATIVE ENGINE: NOW LIVE (2026-05-24)

### What Changed

Intelligence layer now decoupled from visual layer:

**Before:**
```
Assessment → Canonical → Mini V2 PDF (visual system) → Output
(Intelligence + Design mixed)
```

**Now:**
```
Assessment → Canonical → V3 Narrative (GPT-5.5) → WebProfileReport (visual) → Output
(Intelligence separate from Design)
```

### 7 Sections Now Route Through GPT

1. profileDNA (operating model)
2. executiveSummary (behavioral briefing)
3. communicationStyle (meeting dynamics)
4. hiddenContradictions (paradox analysis)
5. strategicCeiling (scaling constraints)
6. coachingLeverage (tactical experiments)
7. recommendedNextStep (specific action)

All driven by canonical dossier, not manual content.

### WebProfileReport Integration

- Client renders V3 narrative sections
- Server endpoint: /api/moremindmap/narrative-v3 (Express)
- Cache bypass: ?nocache, ?v3-refresh
- Forensic signals: V3 Source, Fallback status, Signal verification

### Quality Proven

Endpoint verified live (commit 75de63d):
```
API_KEY_PRESENT: true
render_source: gpt55
SIGNAL_VERIFIED_55: live-endpoint-verified
fallback_used: false
```

All 7 sections tested and rendering with GPT-5.5 texture language.

---

## MINI V2 VISUAL SYSTEM: LOCKED & VALUABLE

### Architecture (Conceptually Locked)

The Mini V2 visual system remains the best-known reference for behavioral profiles:

**Pages locked conceptually:**
- Page 1: Cover + Person ID (locked)
- Page 2: Core operating DNA (locked)
- Pages 3-10: Deep intelligence (locked)
- YOUR PROFILE DNA decoder: Visual framework (locked)

**Template reference:** `mini-v2-clean-10pages-WITH-DNA-2026-05-07.html`

This is the gold standard for how behavioral intelligence should be presented.

### Visual Language

**What's working visually:**
- Navy/gold color scheme (professional, trustworthy)
- DNA helix iconography (scientific, biological)
- Clear section hierarchy (scannable, organized)
- Icon system (universal understanding)
- Narrative + cards (balance detail + summary)
- Timeline indicators (progression, change)

**This visual system is good.** Do not redesign it during quality work.

---

## CURRENT GAP: PDF IS LEGACY

### The Problem

Right now, the PDF/render layer is **not directly powered by canonical dossier**.

Instead:
```
Canonical dossier (JSON in Vault)
    ↓
Separate PDF generation layer
    ↓
HTML template (manual content)
    ↓
PDF output
```

The PDF contains good content, but it's not automatically derived from canonical.

### Why It Matters

If canonical quality improves (83 → 93/100), the PDF doesn't automatically benefit.
We'd need to manually update PDF content to match the improved intelligence.

This is inefficient and creates divergence.

---

## FUTURE TASK (Not Now)

### Before Redesigning Visuals

**Build:** Canonical → Mini V2 Content Translator

This engine would:
1. Read canonical JSON from Vault
2. Extract key narratives + insights
3. Format for Mini V2 HTML template
4. Auto-generate pages 1-10
5. Produce PDF that reflects current canonical quality

```
Canonical Dossier (JSON in Vault)
    ↓
Content Translator
    ↓
Mini V2 Template Filler
    ↓
HTML pages (1-10)
    ↓
PDF renderer
    ↓
PDF output (automatically updated)
```

**This is the path forward.** NOT visual redesign first, but automation of render generation.

---

## LOCKED MINI V2 REFERENCE

### Best Known Visual Template

**File:** `mini-v2-clean-10pages-WITH-DNA-2026-05-07.html`

**What's in it:**
- Page 1: Cover page with person ID
- Page 2: Executive summary + YOUR PROFILE DNA
- Pages 3-10: Deep intelligence sections
  - Operating architecture
  - Decision patterns
  - Communication style
  - Behavioral consequences
  - Hidden risks
  - Strategic ceiling
  - Development pathway
  - Supporting evidence
  
**What makes it work:**
- Visual hierarchy (scanning, not reading)
- DNA metaphor (accessible, scientific)
- Color coding (visual pattern recognition)
- Icons (universal communication)
- Whitespace (not cluttered)
- Mix of narrative + structured data

**Preserve this.** This is the template for future renders.

---

## VISUAL STRATEGY

### Phase 1 (Current): Quality Ascension
- Focus: Canonical dossier quality 83 → 85+
- Do NOT redesign visuals
- Locked: mini-v2-clean-10pages template
- Status: Frozen for this phase

### Phase 2 (Next): Automation
- Build: Canonical → Mini V2 Content Translator
- Output: Auto-generated Mini V2 HTML from canonical
- Update: PDFs generated directly from canonical
- Status: No visual redesign, just plumbing

### Phase 3 (Later): Scale & Optimize
- Once content automation works, optimize visual design
- By then, canonical will be 90+/100 quality
- Visuals can match intelligence level
- Status: Redesign only when content is ready

---

## DO NOT CHANGE (During Quality Phase)

- ❌ mini-v2-clean-10pages template
- ❌ Color scheme (navy/gold)
- ❌ DNA helix icons
- ❌ Page structure (10 pages)
- ❌ Narrative sections layout
- ❌ HTML rendering template

**Why:** Vertical velocity. Lock visuals, optimize canonical.

---

## KNOWN ISSUES (Won't Fix Yet)

**Generic language leakage**
- Some Mini V2 sections still use template text
- Fix: When canonical improves → regenerate PDFs

**Thin sections**
- Contradiction analysis (185 chars on page 5)
- Fix: Canonical deepening → auto-refill pages

**Inconsistent tone**
- Some sections use "you are" vs "demonstrates"
- Fix: Canonical language standardization → auto-apply

**Evidence citations**
- PDFs don't show evidence links yet
- Fix: Canonical-to-PDF translator will add this

---

## FUTURE WORKFLOW (Post-Quality Phase)

### When Canonical Hits 85+

1. Run canonical → Mini V2 translator
2. Extract 12 narratives + 2 contradictions + evidence
3. Fill Mini V2 template sections
4. Generate HTML (10 pages, using locked visual system)
5. Render to PDF
6. Persist to Vault alongside JSON

**Result:** Every canonical update automatically regenerates PDFs.

### Scalability

Once translator is built:
```
Batch Profile Generation:
  100 assessments submitted
    ↓ (18 sec each)
  100 canonicals generated + Vault saved
    ↓ (parallel)
  100 Mini V2 PDFs auto-generated
    ↓
  100 PDFs ready for download
```

This is the production model.

---

## MINI V2 STRENGTHS TO PRESERVE

### Visual Clarity
The 10-page structure with YOUR PROFILE DNA is intuitive.
Preserve this structure exactly.

### Content Hierarchy
Pages flow logically:
1. Identity → 2. DNA → 3-8. Deep dive → 9-10. Action

Don't change this flow.

### Icon System
DNA helix, contradictions, risks, ceiling, development arrows.
Universal visual language. Preserve it.

### Color Psychology
Navy (trust, authority) + Gold (premium, insight)
Professional + accessible. Don't change it.

---

## CANONICAL-TO-MINI V2 MAPPING (Future)

When building the translator, map canonical fields to Mini V2 pages:

| Canonical Field | Mini V2 Page | Rendering |
|---|---|---|
| executive_summary | Page 2 | Header |
| YOUR PROFILE DNA | Page 2 | DNA decoder visual |
| operating_architecture | Page 3 | Narrative + icons |
| decision_narrative | Page 4 | Flow chart style |
| communication_narrative | Page 5 | Communication model |
| contradictions | Page 6 | Tension diagram |
| hidden_risks_narrative | Page 7 | Risk matrix |
| strategic_ceiling_narrative | Page 8 | Bottleneck analysis |
| development_narrative | Page 9 | Growth pathway |
| evidence_map | Page 10 | Citations + confidence |

This mapping is the translator specification.

---

## LOCK CONFIRMATION

### During Quality Ascension (Now)

- ❌ Do NOT redesign Mini V2 template
- ❌ Do NOT change color scheme
- ❌ Do NOT modify page structure
- ❌ Do NOT update visual system
- ✅ DO: Focus on canonical quality (83 → 85+)
- ✅ DO: Plan content translator (future)

### After Quality Hits 85+ (Later)

- ✅ Build canonical → Mini V2 translator
- ✅ Auto-generate PDFs from canonical
- ✅ Optimize visual design (informed by content quality)
- ✅ Scale to production volumes

---

## SUMMARY

**Mini V2 visual system:** Gold standard. Locked. Don't touch.

**PDF/render layer:** Legacy architecture. Will be rebuilt with translator.

**Current priority:** Canonical quality (not visuals).

**Future priority:** Automation (not redesign).

**Rationale:** Quality → Renders → Scale. Not the other way around.

---

**Last Updated:** 2026-05-22 14:05 MST  
**Visual System Status:** LOCKED FOR QUALITY PHASE  
**Render Architecture Status:** LEGACY → AUTOMATION PLANNED
