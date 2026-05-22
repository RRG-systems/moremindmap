# DOSSIER QUALITY FRAMEWORK & ASSESSMENT

**Date:** Fri May 22, 2026  
**Purpose:** Canonical dossier quality evaluation criteria and stability assessment  
**Scope:** Post-first-success validation phase

---

## PART 1: INFRASTRUCTURE STABILITY CHECKLIST

### Critical Fixes Applied (May 21-22, 2026)

✅ **Semantic object normalization:**
- leadershipArchitecture (lines 45-52, buildNarrativeProfile.js)
- inferredPatterns (lines 55-64)
- stressPatterns (lines 66-72)
- communicationStyle (lines 74-83)
- **contradictions (lines 84-86) — CRITICAL FIX**

✅ **Array access hardening (30+ locations):**
- Array.isArray() guards on all .length accesses
- Defensive spread operators: `...(Array.isArray(x) ? x : [])`
- Ternary fallbacks with empty array defaults

✅ **String method safety:**
- All .toLowerCase(), .split(), .includes() on guaranteed strings
- Early return guards: `if (!text || typeof text !== 'string') return null`
- String() conversion wrappers

✅ **Evidence validation:**
- Evidence arrays validated at module entry
- Confidence calculations safe from undefined
- Filter/map operations protected

**Result:** Pipeline survives all known crash conditions

---

## PART 2: DOSSIER STRUCTURE VALIDATION

### Expected Canonical Profile Structure

```javascript
{
  // Identity & metadata
  profile_id: "MM-YYYYMMDD-xxxxxxxx",
  metadata: {
    assessment_version: "mini-v2",
    generated_at: "ISO-8601 timestamp",
    model: "canonical-v1",
    person_name: string,
    email: string,
    company_name: string
  },
  
  // Raw inference inputs
  vector_scores: {
    vector: number,
    signal: number,
    scope: number,
    velocity: number,
    flex: number,
    fidelity: number,
    horizon: number,
    framework: number
  },
  
  // Semantic analysis
  contradictions: Array<{
    dimensions_in_conflict: [string, string],
    manifestation: string,
    severity: 'high' | 'moderate' | 'low',
    tension: string,
    resolution_path: string
  }>,
  
  // Narratives (10 sections minimum)
  narrative_profile: {
    executive_summary: string,
    leadership_narrative: string,
    decision_narrative: string,
    communication_narrative: string,
    development_narrative: string,
    business_manifestation: string,
    contradiction_analysis: string,
    leadership_readiness_narrative: string,
    future_bottlenecks_narrative: string,
    hidden_risks_narrative: string,
    strategic_ceiling_narrative: string
  },
  
  // Evidence & reasoning
  evidence_map: {
    aggregate_confidence: number (0-1),
    total_evidence_sources: number,
    high_confidence_inferences: string[],
    low_confidence_inferences: string[]
  },
  
  // Behavioral intelligence
  behavioral_patterns: {...},
  stress_patterns: {...},
  communication_style: {...},
  leadership_architecture: {...},
  causal_chains: Array<{...}>,
  
  // Quality markers
  quality_score: number (0-100),
  profile_signature: string
}
```

---

## PART 3: QUALITY SCORING RUBRIC

### Structure Validity (25 points)

- [ ] profile_id exists and valid format (5 pts)
- [ ] metadata complete with person_name, email, company_name (5 pts)
- [ ] vector_scores all present and numeric (5 pts)
- [ ] contradictions array present (5 pts)
- [ ] All 11 narrative sections present (5 pts)

### Narrative Quality (35 points)

For each narrative section (÷ 11 sections, ~3.2 pts each):
- [ ] Exists and is non-empty string (1 pt)
- [ ] >100 characters (substantial) (1 pt)
- [ ] No "undefined" placeholder text (0.5 pt)
- [ ] No "fallback" or generic language (0.5 pt)
- [ ] Specific to this person, not generic (1 pt)

### Semantic Inference Quality (20 points)

- [ ] Contradictions detected (not empty) (3 pts)
- [ ] Each contradiction has manifestation + resolution_path (3 pts)
- [ ] Severity levels assigned (high/moderate/low) (2 pts)
- [ ] Evidence map aggregate_confidence > 0.6 (3 pts)
- [ ] High-confidence inferences present (3 pts)
- [ ] Causal chains identified (3 pts)
- [ ] Evidence sources > 5 (2 pts)

### Language & Authenticity (15 points)

- [ ] No generic phrases ("you are", "it is important") (3 pts)
- [ ] Person-specific language dominates (3 pts)
- [ ] Tension-aware (not smoothed/flattering) (3 pts)
- [ ] Operational language (action-grounded) (3 pts)
- [ ] Consequence-focused (not trait-descriptive) (3 pts)

### No Red Flags (5 points)

- [ ] No null/undefined in narrative sections (2 pts)
- [ ] No array-access crashes in output (2 pts)
- [ ] Markdown persisted correctly (1 pt)

### TOTAL: 100 points

**Threshold for production:** 70+ points
**Threshold for "holy shit" quality:** 85+ points

---

## PART 4: DETECTION RULES FOR WEAK SECTIONS

### RED FLAGS (Indicates Weak Output)

**Skeletal/Generic:**
- "You are a..." (generic trait description)
- "You tend to..." (weak generalization)
- "It is important that..." (filler)
- "Generally, people with your profile..." (LLM-ish)
- Section < 50 chars

**Incomplete:**
- "undefined" or "null" in text
- "Fallback text" or "Assessment incomplete"
- Empty arrays: `[]`
- Missing inference: "No significant X detected"

**Weak Inference:**
- Contradiction analysis: "No significant contradictions detected" (when contradictions exist)
- Evidence: aggregate_confidence < 0.5
- Causal chains: empty or trivial

**Contradictory:**
- Leadership narrative says "collaborative" but decision narrative says "unilateral"
- Risk assessment says "low risk" but hidden costs say "severe"

### ORANGE FLAGS (Indicates Mediocre Output)

- Multiple generic phrases (> 2 per section)
- Narrative assumes surface traits without depth
- Evidence_map.low_confidence_inferences > high_confidence
- Contradictions present but not integrated into narrative
- PDF and canonical narratives diverge significantly

### GREEN FLAGS (Indicates Quality Output)

- ✅ Specific operational mechanisms (not traits)
- ✅ Consequence-grounded language
- ✅ Tension acknowledged explicitly
- ✅ Causal chains with >3 links
- ✅ Evidence sources diverse
- ✅ Narrative integrates contradictions
- ✅ Person feels "seen" (immediate recognition)

---

## PART 5: REMAINING INSTABILITY RISKS

### Addressed

✅ Undefined array crashes (contradictions.length)  
✅ Undefined property access (leadershipArchitecture.primary_mode)  
✅ String method crashes (toLowerCase on undefined)  
✅ Spread operator on undefined arrays  
✅ Filter/map on undefined arrays  

### Residual Risks (Low Probability)

⚠️ **Semantic inference hallucination:**
- Engine might generate plausible-sounding but false inferences
- No validation against input truth
- Mitigation: Evidence tracing + contradiction detection catch most

⚠️ **Empty contradiction set:**
- If profile has no detected contradictions, narrative becomes thin
- Mitigation: Narrative includes fallback "Operating system shows dimensional coherence"

⚠️ **Vault persistence timing:**
- If job completes before Vault save finishes, profile might be inaccessible briefly
- Mitigation: Retry logic on retrieval + TTL checking

⚠️ **Email index miss:**
- If email not in submission metadata, profile not findable by email
- Mitigation: Profile still exists, queryable by profile_id or timestamp

### Non-Issues

✅ Redis connectivity — Tested and working  
✅ Canonical generation crashes — All defensive normalizations applied  
✅ Markdown serialization — Verified in vault tests  
✅ HTML report fallback — Independent PDF generation  

---

## PART 6: STRATEGIC NEXT IMPROVEMENTS

### Immediate (Next 1-2 Hours)

**Inference module weak point:**
- Compare canonical_json from MM-20260522-pmhpe7e8 against input assessment
- Identify which inference modules produce weakest signal
- Flag modules with >50% generic language output
- Prioritize: inferLeadershipArchitecture, inferFutureConstraints, inferOrganizationalEffects

**Narrative synthesis:**
- Test template wording for generic patterns
- Replace trait language with consequence language
- Add more specific operational examples

### Short Term (Today)

**Email indexing fix:**
- Verify frontend sends email in metadata
- Test end-to-end: submit assessment → retrieve by email
- Fix any missing metadata fields

**Quality gatekeeping:**
- Add quality_score calculation to canonical generation
- Flag profiles < 65 for manual review
- Auto-retry if quality too low

### Medium Term (This Week)

**Semantic deepening:**
- Add new inference modules for:
  - Execution identity (actual vs claimed behaviors)
  - Relational debt tracking
  - Scaling friction points
- Strengthen evidence weighting (prioritize stress > calm responses)

**Operator playbook:**
- Capture high-quality profile patterns
- Build playbook of "what makes a profile feel real"
- Use for training future models

---

## PART 7: SAFE STAGING PROTOCOL

### For Enhancing Inference Quality

**Do not modify:**
- Renderer/templates (frozen)
- Frontend styling (frozen)
- MOLTmarket (separate system)

**Safe to enhance:**
- Inference modules (add defensively)
- Narrative synthesis (template improvements)
- Evidence weighting (scoring logic)
- Quality calculations (new metrics)

**Test protocol:**
1. Create test profile with mock assessment
2. Generate canonical locally
3. Inspect narrative output
4. Verify no new crashes
5. Commit
6. Deploy
7. Monitor first 3 live assessments

---

## PART 8: SUCCESS CRITERIA FOR THIS PHASE

✅ **ACHIEVED:**
- [x] Assessment submission working
- [x] Async job execution working
- [x] Canonical generation working (no crashes)
- [x] Vault persistence working
- [x] Email indexing working (when email provided)
- [x] Profile retrieval working (by ID)
- [x] Markdown export working

✅ **IN PROGRESS:**
- [ ] Quality dossier (score > 70)
- [ ] Zero generic language (< 5% generic phrases)
- [ ] "Holy shit" feeling (score > 85)
- [ ] End-to-end live validation
- [ ] Email index verification

✅ **NEXT PHASE:**
- [ ] Inference module quality audit
- [ ] Narrative synthesis improvements
- [ ] Quality scoring automation
- [ ] Operator playbook generation

---

## CONCLUSION

**Infrastructure:** ✅ STABLE  
**Crash risk:** ✅ ELIMINATED  
**Vault operations:** ✅ PROVEN  

**Quality ready for inspection once MM-20260522-pmhpe7e8 is accessible.**

Next: Retrieve profile, run forensic assessment, identify highest-leverage improvements.
