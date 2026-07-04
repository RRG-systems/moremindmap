# BA Five Futures Premium 2F: Default Readiness Audit

Phase: BA-FIVE-FUTURES-PREMIUM-2F  
Trace type: default_readiness_audit  
Latest guardrail commit inspected: `8f3593c harden one move provenance guardrails`

## Verdict

Premium Five Futures + One Move is strong enough for continued preview and controlled internal review, but I would not flip it to default for all production users yet.

The renderer passed source inspection, production marker smoke, browser overflow checks, and local failure-mode checks. The blocker is sample size, not a specific observed runtime bug: only two real stored Business Assessment records with complete One Move provenance were available and both rendered premium correctly. That is not enough to justify default enablement across unknown records.

Default readiness verdict: `NOT_READY_NEEDS_LARGER_POPULATION_AUDIT`

## Plain Answers

1. Is premium ready to become default?  
   Not yet as a universal default. It is ready for controlled preview and a larger population audit.

2. If yes, with what limits?  
   It can be used for known eligible records and internal/demo review. It should not become blanket default until more real assessment records are checked.

3. If no, what blocks it?  
   Small real-record sample size. No source-level blocker was found in selector, provenance, or fallback behavior.

4. How many records were checked?  
   Ten known profile IDs were checked through the production retrieve route.

5. How many rendered premium?  
   Two records had complete One Move provenance and rendered premium in production preview.

6. How many fell back to legacy and why?  
   Eight checked IDs had no retrievable Business Assessment record in `/api/business-assessment/retrieve`, so they were not premium-eligible.

7. Did assessment truth remain intact?  
   Yes in the checked records. Future titles, probabilities, signals, One Move title, root constraint, recommendation, modeled shift, and proof/watch content came from existing normalized/generated data.

8. Did One Move provenance remain protected?  
   Yes. Premium eligibility requires raw title, root constraint, recommendation, modeled shift, and proof/rationale.

9. Did any fake/generated-looking fallback appear?  
   No in production smoke. Local fixtures confirmed missing title becomes `One Move intelligence unavailable`, missing confidence becomes `Confidence not indexed`, and incomplete core One Move provenance fails premium eligibility.

10. Is a larger population audit required before default?  
    Yes.

## Selector And Fallback Chain

Current source behavior:

- `VITE_BA_FIVE_FUTURES_PREMIUM=true` would enable premium globally, but production default remains off because the env flag is not required and the default branch is legacy.
- `?renderer=premium` requests controlled preview.
- If neither env flag nor preview query is present, the legacy renderer is used.
- If premium is requested but `hasPremiumFiveFuturesData(data)` fails, legacy is used.
- If premium throws during render, `PremiumRendererBoundary` falls back to legacy.

Premium eligibility requires:

- `data.hasFutures`
- `data.fiveFutures.futures` is an array
- at least three futures
- `hasGeneratedOneMoveIntelligence(data)`
- One Move provenance fields:
  - `completeForPremium`
  - `hasRawTitle`
  - `hasRawRootConstraint`
  - `hasRawRecommendation`
  - `hasRawModeledShift`
  - `hasRawProofSignals`

This means the premium preview cannot render the One Move hero as generated intelligence when core One Move provenance is missing.

## Production Records Checked

| Profile ID | Retrieve status | Assessment ID | Future count | One Move title | Premium eligible |
| --- | --- | --- | ---: | --- | --- |
| `mm-20260531-asovnjz4` | `five_futures_and_one_move_ready` | `ba-20260605-d2aa1165` | 5 | `Install a 90-Day Judgment Transfer Cadence` | yes |
| `mm-20260527-6zshuaao` | `five_futures_and_one_move_ready` | `ba-20260609-d379499d` | 5 | `Install a 90-Day Relationship-to-Close Operating Cadence` | yes |
| `mm-20260526-r8362esx` | `not_found` | n/a | 0 | n/a | no |
| `mm-20260527-kgppxg8e` | `not_found` | n/a | 0 | n/a | no |
| `mm-20260526-fqxptt3n` | `not_found` | n/a | 0 | n/a | no |
| `mm-20260523-mqlev9c9` | `not_found` | n/a | 0 | n/a | no |
| `mm-20260529-ceo8x7q2` | `not_found` | n/a | 0 | n/a | no |
| `mm-20260529-acc2f9d6` | `not_found` | n/a | 0 | n/a | no |
| `mm-20260529-cmp3j6z7` | `not_found` | n/a | 0 | n/a | no |
| `mm-20260529-eng7v5k3` | `not_found` | n/a | 0 | n/a | no |

## Production Render Smoke

For `mm-20260531-asovnjz4`:

- Default route rendered `legacy-five-futures`.
- Premium preview rendered `premium-five-futures`.
- Generated One Move title was present.
- Root Constraint was present.
- Recommended Move was present.
- Downstream Effects was present.
- Modeled Shift was present.
- Proof To Watch was present.
- LDE / Assessment Analysis rail was present.
- `Confidence: Moderate` fallback was not present.
- Generic hero title fallback was not present.
- No normal `+N supporting signals` hiding pattern was found.

For `mm-20260527-6zshuaao`:

- Premium preview rendered `premium-five-futures`.
- Generated One Move title was present.
- Root Constraint was present.
- Proof To Watch was present.
- `Confidence: Moderate` fallback was not present.

## Browser Layout Measurement

Production premium preview for `mm-20260531-asovnjz4` was measured with headless Chrome.

| Viewport | Renderer | Document overflow X | Stage overflow X | Clipped cards | Result |
| --- | --- | ---: | ---: | ---: | --- |
| 1440 x 1100 | premium | 0 | 0 | 0 | pass |
| 1024 x 900 | premium | 0 | 0 | 0 | pass |
| 390 x 900 | premium | 0 | 0 | 0 | pass |

The page scrolls normally; the artifact does not introduce horizontal page overflow in these measurements.

## Failure Mode Audit

Local-only fixture simulations used valid futures with targeted missing One Move fields.

| Failure mode | Expected behavior | Observed |
| --- | --- | --- |
| Missing One Move title | premium eligibility fails; no generated-looking title | passed |
| Missing root constraint | premium eligibility fails | passed |
| Missing recommendation | premium eligibility fails | passed |
| Missing modeled shift | premium eligibility fails | passed |
| Missing proof/rationale | premium eligibility fails | passed |
| Missing confidence | premium eligible if core provenance exists; confidence says not indexed | passed |
| Render exception | boundary falls back to legacy | source confirmed |
| Feature flag off/default route | legacy renders | production confirmed |

## Assessment Truth Audit

Five Futures:

- Probabilities come from normalized future records.
- Future titles come from normalized future records.
- Statuses/categories are mapped from generated keys/status when available.
- Signals come from `signal_bullets`, `signals`, or `evidence`.
- Interpretations come from `short_interpretation`, `central_insight`, or summary.
- No static mock futures were found in live premium output.

Assessment / LDE truth rail:

- Uses evidence-bearing categories: Financial Reality, Behavioral Profile, Business Model, Constraint, Confidence, Relationships, Accountability, Systems.
- Evidence dots are derived from local assessment evidence/status heuristics.
- No claims of live MOLT, real-time external intelligence, autonomous prediction, or guaranteed forecast were found.

One Move:

- Title comes from `one_move_v1.title`.
- Root constraint comes from `one_move_v1.root_constraint`.
- Recommendation comes from `one_move_v1.recommendation`.
- Modeled shift comes from `expected_probability_shift.explanation`.
- Downstream Effects are deterministic sentence excerpts from existing One Move fields.
- Proof To Watch uses `success_indicators`, falling back to `first_30_days`.
- Confidence displays generated confidence only when raw confidence exists; missing confidence is `Confidence not indexed`.

## Readiness Scores

| Category | Score | Reason |
| --- | ---: | --- |
| Visual readiness | 88 | Premium layout passed rendered marker and overflow checks and is presentation-grade for checked records. |
| Assessment truth preservation | 90 | Live output uses normalized generated/stored data; no mock future leakage found. |
| One Move provenance safety | 94 | Raw provenance guardrails are strong and failure fixtures behave correctly. |
| Fallback safety | 92 | Default route remains legacy; preview falls back when eligibility fails; render boundary exists. |
| Multi-record readiness | 45 | Only two complete real assessment records were available. |
| Mobile/responsive readiness | 78 | Browser measurements at 390px passed overflow/clipping checks, but deeper manual mobile review is still recommended. |
| Executive presentation readiness | 86 | Checked premium records render with strong Five Futures and One Move hierarchy. |
| Default-production readiness | 74 | Technically promising, but sample size is too small for blanket default. |

## Recommendation

Do not flip premium default yet.

Recommended next sprint:

`BA-FIVE-FUTURES-PREMIUM-2G — Population Audit + Limited Default Gate`

Scope:

- test a larger set of real generated Business Assessment records
- include records with partial/missing One Move fields
- verify premium fallback rate
- define default eligibility policy
- optionally enable premium only for records passing provenance guardrails, not globally

## Limits

- No runtime code was changed in this audit.
- No production records were mutated.
- No OpenAI calls were made.
- Only two production records with complete One Move provenance were available.
- Headless DOM/layout checks are useful but not a substitute for full human visual QA.
