# Fathom DD Agreement and Ancillary Role Fit Architecture Trace

Mission ID: `FATHOM_DD_AGREEMENT_REPLACEMENT_AND_ANCILLARY_ROLEFIT_TRACE`

Trace date: 2026-07-15

## Executive finding

The live District Director Role Fit Evaluator does not parse or dynamically consume an agreement. Before this mission, no agreement PDF, extracted text, Markdown, or JSON was tracked in the repository. The operative contract interpretation was manually encoded in `src/lib/leadership/roleModels/fathomDistrictDirectorV1.js` and consumed by deterministic scoring code.

The supplied full agreement is now the sole authoritative contract document stored in the repository. It is Fathom Realty Independent Contractor District Director Agreement C1, version 20250224. Its SHA-256 is `20b6826b0ebfdf72ec4242c6eed31aa2509af417e5ada5555b86bf104964caae`.

No scoring, BOS, evidence, UI, Redis, production-data, Stripe, deployment, or commit action was performed.

## 1. Current canonical agreement location

`docs/leadership/contracts/Fathom_Realty_District_Director_Agreement_C1_v20250224.pdf`

This PDF is the canonical legal source document. The role model remains a manually encoded product interpretation, not a duplicate canonical agreement.

## 2. Old agreement version discovered

No old agreement source document was found in the working tree, tracked files, or PDF/agreement paths in Git history. The only prior representation is the manually encoded baseline in `src/lib/leadership/roleModels/fathomDistrictDirectorV1.js`, identified generically as “DD Agreement 2025” and role-model version `1.1.0-v1b`. It already represented the 4% growth target, two-agent best practice, stock and Revenue Share recruiting incentives, and partner advocacy, but it was not a full agreement and did not identify a source file.

Because no prior source document exists, no old PDF could be archived. The encoded role model was intentionally not copied or renamed: it is active application code and changing it would violate this mission's scoring/product-behavior boundary.

## 3. New agreement location

`docs/leadership/contracts/Fathom_Realty_District_Director_Agreement_C1_v20250224.pdf`

The installed file is byte-identical to the supplied attachment. PDF metadata reports six physical pages; the agreement footer labels its pages “Page 1 of 7” through “Page 6 of 7.” This pagination discrepancy should be confirmed with Fathom, although the supplied attachment was treated as the requested full agreement.

## 4. Files replaced, archived, or updated

- Added the canonical source PDF above.
- Added this trace report.
- Added `docs/leadership/fathom_dd_agreement_and_ancillary_rolefit_trace.json`.
- Replaced: none, because no old agreement source file was present.
- Archived: none, because no old agreement source file was present.
- Application references updated: none. The application does not load a contract file at runtime.

There is one active repository contract document and no competing active agreement PDF/text copy.

## 5. Contract ingestion path

The contract is manually represented, not dynamically ingested:

1. Legal source: the canonical PDF in `docs/leadership/contracts/`.
2. Manual interpretation: `src/lib/leadership/roleModels/fathomDistrictDirectorV1.js` declares duties, dimensions, BOS signal mappings, and weights.
3. Model selection: `src/lib/leadership/roleModels/index.js` returns the default DD model.
4. Computation: `src/lib/leadership/buildDistrictDirectorFit.js` combines the role model, retrieved BOS profile, and optional evidence.
5. Scoring: `src/lib/leadership/roleFitScoring.js` calculates dimension and overall results.
6. Entry and display: `src/LeadershipRoleFitLab.jsx` runs analysis and `src/components/leadership/RoleFitDashboard.jsx` renders it.

There is no PDF parser, build-time extraction, database lookup, or runtime source-document fetch. Installing the PDF therefore does not change application behavior and does not require a build.

## Agreement provisions confirmed from the supplied PDF

- Development & Growth 1(a): DDs support recruiting and contribute to monthly Market Center growth of 4% or more.
- Development & Growth 1(a): directly recruiting at least two agents per month is stated as best practice.
- Stock Grants 3(b): $50 in stock for every new agent added to the Market Center, subject to listed exclusions; the agreement separately provides $10 in stock for each qualifying sales transaction.
- Revenue Share 4: eligibility applies to new-to-Fathom agents for whom the DD is solely and directly responsible for recruiting to the DD's Fathom Network, subject to Revenue Share rules.
- Position Overview and Support 2(d): DDs must promote, support, and advocate for Fathom Companies and Partners and support the Ambassador Program.
- Support 2(d): the goal is to reach and maintain 10% or more of all transactions including one or more Fathom Companies other than Fathom Realty and/or Partners.

## 6. Current Role Fit dimensions

All are declared in `src/lib/leadership/roleModels/fathomDistrictDirectorV1.js`:

| Dimension | BOS signals |
| --- | --- |
| Recruiting / Growth Drive | velocity, vector, leverage, horizon |
| Accountability / Follow-through | fidelity, framework, velocity |
| Agent Support / Service Orientation | signal, flex, leverage |
| Compliance Discipline | framework, fidelity |
| Training / Communication | signal, vector, framework |
| Operational Responsiveness | velocity, flex, fidelity |
| Partner / Ecosystem Advocacy | signal, leverage, horizon |

## 7. Current scoring weights

`FATHOM_DD_OVERALL_WEIGHTS_V1B` in `src/lib/leadership/roleModels/fathomDistrictDirectorV1.js` defines:

| Dimension | Weight |
| --- | ---: |
| Recruiting / Growth Drive | 40% |
| Accountability / Follow-through | 15% |
| Agent Support / Service Orientation | 12% |
| Compliance Discipline | 10% |
| Training / Communication | 10% |
| Operational Responsiveness | 10% |
| Partner / Ecosystem Advocacy | 3% |

Weights total 100%. This mission did not change them.

## 8. Current overall-score formula

`computeWeightedOverall()` in `src/lib/leadership/roleFitScoring.js` calculates the weighted mean of available dimension scores, renormalizing over scored weight:

`base = sum(dimension score × dimension weight) / sum(scored dimension weights)`

`computeGrowthWeightedOverall()` then applies an evidence calibration only when recruiting evidence is one-directional:

- Positive recruiting: `excellence = 0.58 × GrowthFit + 0.42 × base`; overall is `max(base, excellence)`.
- Negative recruiting: `underperformance = 0.62 × GrowthFit + 0.38 × base`; overall is `min(base, underperformance)`.
- Mixed or no special recruiting evidence: overall remains the base weighted score after any dimension-level evidence adjustments.

Results are rounded to one decimal place. The headline Overall is the Evidence-Adjusted score.

## 9. Behavioral Role Fit path

`buildDistrictDirectorFit()` calls `extractBosSignalMap()` to normalize the BOS dimensions, then maps every role-model dimension through `scoreRoleDimension()`. Each dimension averages its available BOS signals and maps the 0–1 average into an 18–96 percentage band. Those BOS-only dimensions pass to `computeGrowthWeightedOverall()` with both recruiting-evidence flags false. The result is returned as `behavioral_fit` and remains untouched by external evidence.

## 10. Evidence-Adjusted Role Fit path

The same BOS-only dimension array is copied through `applyEvidenceToDimensions()`. Bounded deterministic adjustments produce `evidenceDimensions`. Those dimensions then pass through `computeGrowthWeightedOverall()` with positive/negative recruiting flags derived from interpreted evidence. The result is returned as `evidence_adjusted_fit` and also becomes the headline `overall` result.

## 11. Existing evidence input and interpretation path

- Input: the “Known Performance Evidence” textarea in `src/LeadershipRoleFitLab.jsx`; state is component-local and explicitly not persisted.
- Client payload: `src/lib/leadership/buildRoleFitEvidencePayload.js` sends at most 4,000 characters plus deterministic context to `/api/leadership/dd-role-fit-evidence-interpretation`.
- Interpretation: `api/leadership/dd-role-fit-evidence-interpretation.js` asks the intelligence layer for structured classification, affected dimensions, signals, and bounded adjustment categories. It prohibits numeric final scores and invented facts.
- Fallback: `parsePerformanceEvidence()` in `src/lib/leadership/roleFitScoring.js` performs deterministic pattern matching if interpretation is unavailable.
- Resolution: `resolveEvidenceParse()` prefers a valid GPT interpretation unless deterministic mode is forced.
- Application: `applyEvidenceToDimensions()` alone applies numeric bounded adjustments. GPT interprets; deterministic code scores.

Positive recruiting evidence raises Growth Fit to bounded floors (82 modest or 93 material, ceiling 96). Negative recruiting evidence applies bounded drops/caps, with stronger treatment for sustained underperformance. Negative compliance/operations evidence subtracts bounded points from those dimensions. Support/training/partner evidence is handled through their existing dimension branches. Mixed evidence nets competing signals. Behavioral Role Fit is preserved separately throughout.

## 12. Current panel/rendering architecture

`src/components/leadership/RoleFitDashboard.jsx` is a single model-driven renderer. It renders:

- top row: Profile Overview, Analysis Context/Evidence Impact, Overall Fit;
- Score Stack: Behavioral, Evidence-Adjusted, Growth/Recruiting, Compliance/Ops Risk, Support Required;
- Role Fit Dimensions: a mapped card for every item in `model.dimensions`;
- Best Use, Risk/Wrong-Seat Pattern, and One Move;
- technical/source and disclaimer content.

Panels are mostly explicit JSX sections; dimension cards are data-driven from the role model/result array. There is no general panel registry.

## 13. Recommended Ancillary Services panel insertion point

For a future authorized build, add an `ancillary_services_capture` result object in `buildDistrictDirectorFit()` after evidence resolution/application and expose it adjacent to `score_stack`. Render one compact `AncillaryServicesCapturePotentialCard` in `RoleFitDashboard.jsx` immediately after `ScoreStackSection` and before the dimension-card grid. This preserves dashboard hierarchy, avoids a new evidence entry feature, and clearly separates an ancillary diagnostic from the seven core dimensions.

The behavioral baseline should be produced by a dedicated pure helper using existing normalized BOS signals (recommended: Signal, Leverage, Horizon, with Framework as a modest execution modifier). Label it explicitly as behavioral inference, not transaction performance. Apply factual evidence through the existing textarea, payload, interpreter, resolver, and deterministic adjustment guardrail.

## 14. Recommended limited overall-score influence

Recommended future range: 2%–4% effective weight, with 3% preferred and a hard cap of approximately ±3 overall percentage points attributable to ancillary capture. The safest implementation is a separately declared 3% dimension/overlay with deterministic delta caps and explicit tests. Do not add it on top of the current 100% weights without renormalization; in a future authorized scoring change, proportionally renormalize non-recruiting secondary weights or use a capped overlay whose mathematical bounds are transparent.

The exact method requires product approval because either approach changes scoring. No such change was made here.

## 15. How recruiting remains dominant

Keep Recruiting / Growth Drive at 40% and preserve the existing positive/negative recruiting calibration. At a 3% ancillary influence, recruiting remains more than thirteen times the direct ancillary weight. Ancillary evidence must never trigger recruiting excellence/underperformance flags, and ancillary scoring must not reuse or dilute the Growth Fit score.

## 16. How behavioral inference should work

Compute a BOS-only estimate from traits relevant to consultative adoption: reading people/context (Signal), multiplying adoption through others (Leverage), sustaining ecosystem opportunity awareness (Horizon), and modest execution discipline (Framework). Return an inference score plus an explicit explanation of which BOS signals contributed. Do not claim the person has achieved partner adoption from behavior alone. Preserve a separate factual-evidence field/status in the panel so inference and observed performance cannot be confused.

## 17. How factual evidence should raise or lower the ancillary score

Extend the existing interpretation schema and deterministic mapping to recognize concrete evidence such as verified partner-included transaction counts/rates, introductions, conversion, sustained adoption, missed targets, or documented non-promotion. Positive facts should raise the ancillary score; negative facts should lower it; vague opinions should be neutral or low-confidence. Mixed evidence should net transparently. Numeric changes must remain deterministic and bounded; the intelligence layer should continue to classify only.

## 18. How region size or transaction opportunity should affect negative evidence

Use opportunity exposure only when supported by factual context such as transaction count, Market Center volume, agent count, or region size. A failure at high opportunity should receive a larger negative ancillary adjustment than the same rate at low opportunity, because the unrealized impact is greater. Implement discrete, tested exposure bands and cap the additional penalty. Do not infer region/volume from BOS traits, and do not penalize missing context. Positive evidence should remain based on verified capture performance rather than raw opportunity alone.

## 19. Risks, calibration concerns, and unanswered questions

- The supplied PDF has six physical pages while its footer says “Page 1 of 7” through “Page 6 of 7”; confirm whether a seventh page/signature page is intentionally absent.
- No prior legal source was present, so historical contract-to-model differences cannot be forensically diffed.
- The existing 3% Partner / Ecosystem Advocacy dimension overlaps the proposed ancillary concept; product must decide whether ancillary replaces, complements, or derives from that dimension to avoid double counting.
- The current interpreter's canonical dimension list has no ancillary dimension; adding it requires coordinated client and API schema changes.
- “Region size,” “meaningful transaction volume,” measurement window, denominator, source of truth, and missing-data policy are not defined.
- The agreement's 10% goal applies to transactions containing one or more Companies/Partners; future scoring must define whether it uses transaction count, sides, closed/funded transactions, and which partner records qualify.
- A 2%–4% weight and ±3-point cap need fixture calibration around verdict thresholds to prevent small ancillary changes from creating disproportionate label changes.
- Evidence is free text and local-session only; factual verification remains external to this application.

## 20. Exact recommended Bridge Runner build scope

Recommended files a future, separately authorized Bridge Runner mission may change:

- `src/lib/leadership/roleModels/fathomDistrictDirectorV1.js` — declare ancillary metadata/BOS mapping and an approved limited influence.
- `src/lib/leadership/roleFitScoring.js` — pure baseline, evidence mapping, exposure modifier, caps, and tests-facing exports.
- `src/lib/leadership/buildDistrictDirectorFit.js` — assemble separate behavioral and evidence-adjusted ancillary results.
- `src/lib/leadership/buildRoleFitEvidencePayload.js` — include ancillary as an allowed interpreted category while reusing the same input.
- `api/leadership/dd-role-fit-evidence-interpretation.js` — extend the structured interpretation schema/prompt without allowing numeric scoring.
- `src/components/leadership/RoleFitDashboard.jsx` — render one compact dynamic panel.
- Existing/new focused tests for the files above, including score-cap, recruiting-dominance, evidence polarity, opportunity exposure, missing context, and inference-vs-fact labeling.
- This trace report/JSON only if the build must record its completed implementation.

Files and systems that future scope should explicitly forbid unless a later mission establishes a demonstrated technical need and grants separate authority:

- `src/LeadershipRoleFitLab.jsx` (no new input or dashboard redesign is needed).
- BOS extraction/profile-generation files outside `src/lib/leadership/roleFitScoring.js`.
- Profile retrieval APIs and canonical profile schema.
- Redis clients, keys, or persistence paths.
- Stripe/payment files.
- Production data, deployment configuration, unrelated dashboards, and unrelated styles.
- The canonical agreement PDF, except replacing it with a formally superseding legal source.

## Mission boundary result

The legal source is now repository-safe and canonical. The architecture is fully traced. Replacement is complete with the stated limit that there was no old source document to archive and no dynamic ingestion reference to update.
