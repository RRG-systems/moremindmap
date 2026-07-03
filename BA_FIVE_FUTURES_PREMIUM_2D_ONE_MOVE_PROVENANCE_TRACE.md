# BA Five Futures Premium 2D: One Move Provenance Trace

Phase: BA-FIVE-FUTURES-PREMIUM-2D  
Trace type: one_move_intelligence_provenance  
Profile traced: `mm-20260531-asovnjz4`  
Premium preview: `/business-assessment/five-futures?id=mm-20260531-asovnjz4&renderer=premium`

## Verdict

The visible One Move title for the traced profile, `Install a 90-Day Judgment Transfer Cadence`, is generated assessment intelligence stored in the Business Assessment record. It is not hardcoded in the renderer, not deterministic UI text, and not a static template found in source search.

The title is safe to treat as business-specific intelligence for this record, with a limit: uniqueness across the full user population is not proven by this trace. A small read-only check found two stored One Move records and two distinct titles, which argues against a static default, but a larger batch audit is required before claiming population-level uniqueness.

## Plain Answers

1. Is the One Move title generated intelligence, deterministic, hardcoded, fallback, or unknown?  
   For `mm-20260531-asovnjz4`, it is generated assessment intelligence stored at `assessment.output.one_move_v1.title`.

2. Where exactly does `Install a 90-Day Judgment Transfer Cadence` come from?  
   It comes from the production Business Assessment retrieve response for `mm-20260531-asovnjz4`, specifically `assessment.output.one_move_v1.title`. That object was created by the One Move generation stage in [api/business-assessment/generate-futures.js](/Users/rrg/.openclaw/workspace/moremindmap-live/api/business-assessment/generate-futures.js:409) using the One Move prompt built by [api/engine/businessAssessment/buildFiveFuturesPrompt.js](/Users/rrg/.openclaw/workspace/moremindmap-live/api/engine/businessAssessment/buildFiveFuturesPrompt.js:470).

3. Is it safe to treat it as person/business-specific intelligence?  
   Yes for the traced record, because it is stored generated output tied to that assessment/profile. Do not claim it is globally unique until more generated records are compared.

4. Which One Move panel fields are intelligence vs labels?  
   Labels such as `The One Move`, `Root Constraint`, `Recommended Move`, `Downstream Effects`, `Modeled Shift`, and `Proof To Watch` are static UI. The title, root constraint, recommendation, why-this-move, why-now, probability shift, first-30-days, success indicators, and confidence are generated assessment fields or deterministic excerpts of those fields.

5. Which fields are derived from existing intelligence?  
   `Downstream Effects` is derived by clipping sentences from `whyThisMove`, `probabilityShift`, and `recommendation`. `Proof To Watch` is derived from `successIndicators`, falling back to `first30Days` if needed. The LDE insight line `One Move: ...` derives from the generated title.

6. Are any fields placeholders?  
   Runtime source includes explicit fallbacks such as `One Move`, `One Move not available`, `One Move not generated yet`, `Modeled shift not available`, and conservative proof/downstream fallback sentences. These did not appear for the traced production record.

7. Are any fallback phrases at risk of looking like generated intelligence?  
   The main risk is [src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js](/Users/rrg/.openclaw/workspace/moremindmap-live/src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js:568), which maps a missing raw title to `One Move`. That is generic, but in the premium hero it could still occupy the generated-title position. `confidence` also falls back to `Moderate`, which can look more meaningful than an unavailable state.

8. Did any duplicate One Move titles appear in checked records?  
   No. Ten known profile IDs were checked read-only. Two had stored `one_move_v1` objects and both titles were distinct.

9. What is the provenance chain from URL/API/store/normalizer/renderer?  
   URL loads the Five Futures page with `renderer=premium` -> frontend fetches `/api/business-assessment/retrieve?id=mm-20260531-asovnjz4` -> [api/business-assessment/retrieve.js](/Users/rrg/.openclaw/workspace/moremindmap-live/api/business-assessment/retrieve.js:20) reads Redis assessment data -> response includes `assessment.output.one_move_v1` -> [src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js](/Users/rrg/.openclaw/workspace/moremindmap-live/src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js:567) maps it into `data.oneMove` -> [src/components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx](/Users/rrg/.openclaw/workspace/moremindmap-live/src/components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx:365) renders the One Move hero.

10. What should be fixed before premium becomes default?  
    Require raw `output.one_move_v1.title` and core One Move fields before premium rendering. Replace generated-looking normalized fallbacks with explicit unavailable states. Add a batch uniqueness/provenance audit over real generated assessments. Consider storing the actual One Move stage model separately from the Five Futures model metadata.

## Visible One Move Field Classification

| Visible field | Source | Classification | Notes |
| --- | --- | --- | --- |
| `The One Move ->` | Premium renderer | Static UI label | Section label only. |
| Generated title | `data.oneMove.title` | Generated assessment intelligence | For traced record: `Install a 90-Day Judgment Transfer Cadence`. |
| Framing line | Premium renderer | Static UI label | `The highest-leverage intervention selected from the trajectory field.` |
| `Trajectory Intervention` | Premium renderer | Static UI label | Aside heading. |
| Aside copy | Premium renderer | Static doctrine label | Explains proof boundary; not generated. |
| `Root Constraint` heading | Premium renderer | Static UI label | Panel heading. |
| Root constraint body | `oneMove.rootConstraint` | Generated assessment intelligence | Normalized from `one_move_v1.root_constraint`. |
| Why-now subtext | `oneMove.whyNow` | Generated assessment intelligence | Displayed under Root Constraint if present. |
| `Recommended Move` heading | Premium renderer | Static UI label | Panel heading. |
| Recommendation body | `oneMove.recommendation` | Generated assessment intelligence | Normalized from `one_move_v1.recommendation`. |
| Why-this-move subtext | `oneMove.whyThisMove` | Generated assessment intelligence | Clipped for display. |
| `Downstream Effects` heading | Premium renderer | Static UI label | Panel heading. |
| Downstream bullets | Derived from `whyThisMove`, `probabilityShift`, `recommendation` | Deterministically derived | No new AI generation; sentence extraction and clipping only. |
| `Modeled Shift` heading | Premium renderer | Static UI label | Panel heading. |
| Modeled shift body | `oneMove.probabilityShift` | Generated assessment intelligence | Normalized from `expected_probability_shift.explanation`. |
| Confidence line | `oneMove.confidence` plus static prefix | Generated field with static label | Risk: normalized fallback can show `Moderate`. |
| `Proof To Watch` heading | Premium renderer | Static UI label | Panel heading. |
| Proof bullets | `successIndicators`, fallback to `first30Days` | Generated or deterministically selected | Uses generated arrays; no new content unless fallback sentence is used. |
| One Move line in LDE Insight | `oneMove.title` plus static prefix | Derived from generated intelligence | Static prefix with generated title. |

## One Move Title Source

Source search found no hardcoded `Install a 90-Day Judgment Transfer Cadence`, `Judgment Transfer`, or `transfer cadence` phrase in runtime source. The phrase appears in the production retrieved record.

For `mm-20260531-asovnjz4`, production retrieve returned:

- `assessment_id`: `ba-20260605-d2aa1165`
- `status`: `five_futures_and_one_move_ready`
- `assessment.output.one_move_v1.title`: `Install a 90-Day Judgment Transfer Cadence`
- `root_constraint`: leadership/owner judgment transfer constraint
- `recommendation`: 90-day cadence for A/B relationship criteria, next actions, follow-up standards, handoff rules, and weekly scorecard review
- `metadata.futures_model`: `gpt-5.5-2026-04-23`
- `metadata.one_move_version`: `one_move_v1`
- `metadata.futures_generated_at`: `2026-06-06T05:49:55.666Z`

The renderer does not compose this title from smaller fields. It displays `oneMove?.title` at [src/components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx](/Users/rrg/.openclaw/workspace/moremindmap-live/src/components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx:373).

## Upstream Generation Origin

The One Move object is generated after the Five Futures object in [api/business-assessment/generate-futures.js](/Users/rrg/.openclaw/workspace/moremindmap-live/api/business-assessment/generate-futures.js:409). The route:

- resolves the saved assessment by profile or assessment ID
- loads the saved Business Intelligence Draft
- loads the Executive Diagnostic Briefing
- loads the canonical profile
- generates validated Five Futures
- builds a separate One Move prompt
- validates required One Move fields
- stores `one_move_v1` into the assessment record

The model source is `BUSINESS_ASSESSMENT_OPENAI_MODEL || OPENAI_MODEL || gpt-4o-2024-08-06` at [api/business-assessment/generate-futures.js](/Users/rrg/.openclaw/workspace/moremindmap-live/api/business-assessment/generate-futures.js:18). The traced record metadata indicates the model used was `gpt-5.5-2026-04-23`.

The One Move prompt is built in [api/engine/businessAssessment/buildFiveFuturesPrompt.js](/Users/rrg/.openclaw/workspace/moremindmap-live/api/engine/businessAssessment/buildFiveFuturesPrompt.js:470). It instructs the model to generate only `one_move_v1`, with title, root constraint, recommendation, why-this-move, probability shift, first-30-days, success indicators, confidence, and caveats. It explicitly requires a singular, specific, high-leverage, behavior-aware move grounded in validated Five Futures.

Input signal sources include:

- validated `five_futures_v1`
- executive diagnostic briefing sections
- primary constraint snapshot
- current trajectory signal
- confidence snapshot
- missing data
- business intelligence draft
- canonical profile snapshot
- real estate One Move model doctrine

## Multi-Record Uniqueness Check

Read-only production checks were run against ten known profile IDs. Two profiles had stored `one_move_v1` objects:

| Profile ID | Assessment ID | One Move title |
| --- | --- | --- |
| `mm-20260531-asovnjz4` | `ba-20260605-d2aa1165` | `Install a 90-Day Judgment Transfer Cadence` |
| `mm-20260527-6zshuaao` | `ba-20260609-d379499d` | `Install a 90-Day Relationship-to-Close Operating Cadence` |

Results:

- Records checked: 10
- Records with `one_move_v1`: 2
- Unique titles: 2
- Duplicate titles found: 0

This is useful evidence that the title is not a static code default. It is not enough evidence to prove population-level uniqueness.

## Fallback Risk Audit

| Field | Fallback | File | Production risk |
| --- | --- | --- | --- |
| One Move title | `One Move` | [normalizeBusinessVisualArtifactData.js](/Users/rrg/.openclaw/workspace/moremindmap-live/src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js:568) | Can render as a generic title if raw title is missing. Should be treated as unavailable before premium default. |
| One Move title | `One Move not available` | [BusinessAssessmentFiveFuturesPremium.jsx](/Users/rrg/.openclaw/workspace/moremindmap-live/src/components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx:373) | Honest fallback, but should only appear in preview/fallback edge cases. |
| Root constraint | `Root constraint not available.` | normalizer and premium renderer | Honest unavailable fallback. |
| Recommendation | `One Move not generated yet.` | normalizer and premium renderer | Honest unavailable fallback. |
| Why this move | `The probability shift has not been modeled yet.` | normalizer | Honest but could appear as subtext if missing. |
| Modeled shift | `Probability shift not available.` / `Modeled shift not available.` | normalizer and renderer | Honest unavailable fallback. |
| Confidence | `Moderate` | normalizer | Highest semantic risk; can look like generated confidence. Prefer `Not enough evidence indexed` before default. |
| Downstream effects | conservative proof-boundary sentence | premium renderer | Safe boundary fallback; not fake intelligence. |
| Proof to watch | conservative evidence-recording sentence | premium renderer | Safe boundary fallback; not fake intelligence. |

## Recommendations Before Premium Default

1. Strengthen premium compatibility checks to require raw `assessment.output.one_move_v1.title`, `root_constraint`, `recommendation`, `expected_probability_shift`, and at least one proof/success indicator.
2. Replace normalized `title: oneMove.title || 'One Move'` with a provenance-aware unavailable state before default-premium launch.
3. Replace missing confidence fallback `Moderate` with an explicit unavailable/evidence-thin state unless the raw One Move object actually provides confidence.
4. Add a batch uniqueness audit over a larger sample of generated Business Assessments before claiming One Move uniqueness.
5. Consider storing the actual One Move stage model in metadata as `one_move_model`; the current metadata records `futures_model` for the full generation run but does not separately distinguish the One Move model stage.
6. Keep legacy fallback until missing One Move fields fail honestly instead of rendering generic intelligence-looking fallbacks.

## Limits

- No OpenAI calls were made.
- No records were mutated.
- No runtime files were changed.
- This trace proves provenance for the checked record, not statistical uniqueness across all possible users.
- The production retrieve endpoint returns stored assessment output, but this audit did not inspect the underlying Redis record directly.
