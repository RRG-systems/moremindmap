# SOURCE_OF_TRUTH.md

**Updated:** Fri May 22, 2026 14:05 MST  
**Status:** POST-FIRST-SUCCESS CANONICAL DOCTRINE  

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

## DOCTRINE: ASSESSMENT → CANONICAL → VAULT → RENDERS

```
User Assessment (28 questions)
         ↓
    Async Job Executor
         ↓
Canonical Dossier Generator (12 narratives, contradictions, evidence)
         ↓
    Vault Storage
    (JSON persisted, email-indexed, retrievable)
         ↓
    Render Layers (downstream, generated from canonical):
    - PDF reports (visual formatting)
    - HTML presentations (interactive display)
    - Markdown exports (document portability)
    - Email summaries (convenience)
```

The canonical dossier is stable. Renders can change. The source never does.

---

## BENCHMARK PROFILE

**First successful production canonical dossier:**

```
Profile ID:    MM-20260522-pmhpe7e8
Status:        ✅ COMPLETE PRODUCTION CYCLE
Email:         djbergiii@icloud.com
Person:        dj berg the III
Created:       2026-05-22T15:31:49 UTC
Quality:       83/100 (Commercial Ready)

Success Path:
  Assessment submitted
  → Async job executed (18 seconds)
  → Canonical generation succeeded (no crashes)
  → Vault persisted
  → Email indexed
  → Profile retrieved and verified
  → Forensic inspection completed
  → Artifacts exported and committed
```

This profile proves the entire pipeline works end-to-end.

---

## VAULT: CENTER OF GRAVITY

### Why Vault is the System Core

1. **Single source of truth**
   - All assessment data → Vault
   - All canonical dossiers → Vault
   - All metadata → Vault
   - Immutable once stored

2. **Email indexing for discovery**
   - Profile queryable by email
   - Non-repudiation (email proves access)
   - Privacy-preserving (only by email)

3. **Long-term persistence**
   - TTL-free storage (no expiration)
   - Recoverable history (if archival added)
   - Audit trail (if logging added)

4. **Render independence**
   - Renders are generated, not stored
   - Canonical generates renders on-demand
   - PDF failures don't corrupt data

### Vault as Microservice Contract

```
VAULT API:
  PUT /profiles/{profile_id}
    Body: Canonical dossier JSON
    Returns: Saved timestamp, email index key

  GET /profiles/{profile_id}
    Returns: Complete canonical structure

  GET /profiles/email/{email}
    Returns: List of profile IDs for that email

  GET /profiles/{profile_id}/markdown
    Returns: Markdown export (generated from canonical)
```

All integrations use Vault as the contract.

---

## PRODUCTION LOCKED DECISIONS

### Do Not Change

- ❌ Canonical schema (backward compat required)
- ❌ Vault storage model (source of truth anchor)
- ❌ Email indexing mechanism (discovery contract)
- ❌ Profile ID generation (stable identifier)

### Safe to Enhance

- ✅ Render templates (downstream only)
- ✅ Narrative modules (improve quality, not structure)
- ✅ Evidence weighting (tune inference, not schema)
- ✅ Quality metrics (add scoring, preserve existing)

---

## QUALITY BASELINE

First benchmark profile shows what production quality looks like:

```
Infrastructure Stability:     90/100  (All systems working, no crashes)
Narrative Quality:            82/100  (12 sections, 3.6K chars, some generic)
Inference Quality:            67/100  (2 contradictions, 0.72 confidence)
Operator Specificity:         79/100  (Command/infrastructure focused)
Executive Usefulness:         89/100  (Actionable ceiling identified)
"Feels Real" Factor:          90/100  (Contradictions authentic, grounded)
─────────────────────────────
Commercial Readiness:         83/100  (✅ VIABLE, approaching "holy shit" 85+)
```

This is the production baseline. All future profiles compared against this.

---

## MIGRATION PATHWAY

### Phase 1 (Complete)
- ✅ Canonical generation engine built
- ✅ Vault persistence proven
- ✅ Email indexing works
- ✅ Profile retrieval validated

### Phase 2 (In Progress)
- [ ] Generic language elimination
- [ ] Contradiction analysis deepening
- [ ] Evidence weighting optimization
- [ ] Target: 85+ quality score

### Phase 3 (Planned)
- [ ] Markdown export implementation
- [ ] Canonical-to-PDF renderer
- [ ] Batch profile generation
- [ ] Quality dashboard

### Phase 4 (Future)
- [ ] Operator playbook generation
- [ ] Historical profile tracking
- [ ] Comparative dossier analysis
- [ ] Long-term outcome tracking

---

## CANONICAL DOSSIER STRUCTURE

### Required Fields

```json
{
  "profile_id": "MM-YYYYMMDD-xxxxxxxx",
  "metadata": {
    "assessment_version": "mini-v2",
    "generated_at": "ISO-8601",
    "email": "person@domain.com",
    "person_name": "Name",
    "profile_id": "MM-YYYYMMDD-xxxxxxxx"
  },
  "vector_scores": { ... },
  "ranked_dimensions": [ ... ],
  "contradictions": [ ... ],
  "narrative_profile": {
    "executive_summary": "...",
    "leadership_narrative": "...",
    "decision_narrative": "...",
    "communication_narrative": "...",
    "development_narrative": "...",
    "business_manifestation": "...",
    "contradiction_analysis": "...",
    "leadership_readiness_narrative": "...",
    "future_bottlenecks_narrative": "...",
    "coaching_leverage_narrative": "...",
    "hidden_risks_narrative": "...",
    "strategic_ceiling_narrative": "..."
  },
  "evidence_map": { ... },
  "behavioral_patterns": { ... },
  "stress_patterns": { ... },
  "communication_style": { ... },
  "leadership_architecture": { ... },
  "causal_chains": [ ... ]
}
```

All fields populated. No nulls. No fallbacks in persisted structure (normalized at generation time).

---

## DO NOT TOUCH DURING QUALITY WORK

- ❌ `api/renderer/` — Frozen template system
- ❌ `api/templates/` — Locked HTML templates
- ❌ `frontend/src/styles/` — Frozen CSS
- ❌ `moltmarket/` — Separate system

These are immutable during quality ascension phase.

---

## NEXT ACTION

**Do NOT redesign renders yet.**

Build quality of canonical dossier first.

Once canonical is production-grade (85+), THEN design renders that match the intelligence level.

Current pathline: **Quality → Renders → Scale**

Not: **Renders → Quality → Scale**

---

**Last Updated:** 2026-05-22 14:05 MST  
**Doctrine Status:** LOCKED FOR PRODUCTION
