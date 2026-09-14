# Canonical LO Evidence, Missingness, Provenance, and Contradiction Contract V1

Authority ID: `loan-originator-evidence-truth-v1`

## Field-level truth envelope

Every material claim retains:

- stable evidence ID;
- claim/value and unit;
- evidence class;
- provenance/source actor/system;
- customer-stated versus system-measured distinction;
- subject/purpose/applicability scope;
- definition ID;
- period/cohort/as-of/freshness;
- confidence/precision;
- contradiction/supersession links;
- missing reason and requested next evidence where material;
- privacy/authority boundary flags.

## Evidence classes

| Class | Meaning | Prohibited promotion |
| --- | --- | --- |
| `OBSERVED` | governed customer-specific reported/measured reality | customer statement is not independent verification |
| `DERIVED` | deterministic calculation from compatible observed inputs | never survive invalidated inputs silently |
| `MODELED_REQUIREMENT` | requirement calculated for a goal | never displayed as current fact |
| `BENCHMARK` | compatible external comparison | never fills missing customer truth |
| `SCENARIO` | explicit what-if assumption | never treated as forecast/commitment without authority |
| `MISSING` | unknown, unavailable, contradictory, stale, or unsafe to claim | never zero/no/none/solo/NA by inference |

## Question/applicability states

- `ANSWERED`: governed customer response exists.
- `UNANSWERED`: no governed response.
- `NOT_APPLICABLE`: explicit purpose/scope makes the mission/field irrelevant.

Screen presentation state is separate: `SHOWN`, `SKIPPED_EVIDENCE_SATISFIED`, `SKIPPED_NOT_APPLICABLE`, or `TERMINATED_OUT_OF_SCOPE`. Skipping does not rewrite field truth.

## Contradiction protocol

1. Detect material conflict across definition, period, cohort, unit, subject, purpose, attribution, or duplicate values.
2. Preserve both original claims and provenance.
3. Make one bounded customer clarification attempt only when the conflict would change diagnosis/backsolve.
4. If corrected, append a new customer-confirmed claim and explicit supersession; never erase history.
5. If unresolved, preserve contradiction/uncertainty and move on.
6. Mark unsafe derivations `MISSING` with conflict references.
7. Box 1 and downstream consumers must display localized contradiction/abstention rather than false precision.

## Missingness behavior

Missing evidence narrows the affected conclusion, not the entire assessment when other surfaces can speak truthfully. The next evidence request should be specific and decision-relevant. Subscription may naturally pursue meaningful missing evidence later; BA must not turn this into deterministic coaching choreography.

## External/current evidence

Rates, programs, guidelines, limits, laws/regulations, market conditions, incentives, and volatile benchmarks remain dated external evidence. They may constrain an analysis but never silently become customer truth or durable authority.

## Coach/domain-expert evidence

- Operator diagnosis: customer-stated hypothesis.
- Coach observation: high-value typed evidence, not automatically objective fact.
- Coach interpretation: hypothesis until confirmed/validated.
- Customer-confirmed fact: customer provenance retained.
- Darren/domain-expert content: versioned expert evidence source, not automatic authority.

## Privacy

Only aggregate business evidence is needed. Sensitive borrower/underwriting/protected-class data is rejected, not merely hidden. Raw provider bodies and secrets are outside evidence custody.
