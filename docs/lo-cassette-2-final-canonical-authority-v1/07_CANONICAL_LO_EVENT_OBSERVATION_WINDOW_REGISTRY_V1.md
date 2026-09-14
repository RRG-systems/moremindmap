# Canonical LO Observation Window, Cohort, and Event Definition Registry V1

Registry ID: `loan-originator-business-event-definitions-v1`

## Canonical windows

| Window | Purpose | Required metadata |
| --- | --- | --- |
| `TRAILING_12_MONTHS` | primary current-business baseline | start/end/as-of; subject; purpose; unit; definition; cohort basis; provenance |
| `TRAILING_90_DAYS` | current trajectory when compatible | same metadata; maturity/pending flag; seasonal/context caveat |
| `FORWARD_12_MONTHS` | primary goal/backsolve horizon | start/end; subject; purpose; metric/unit; customer authority |
| `CUSTOM_COMPATIBLE` | permitted only when a governed system uses another window | exact start/end and reason; never silently mixed with default windows |

## Metric envelope

Every material metric uses this canonical envelope:

```json
{
  "metric_id": "...",
  "value": 0,
  "unit": "...",
  "definition_id": "...",
  "subject_scope": "INDIVIDUAL|TEAM|BRANCH|OTHER",
  "purpose_scope": ["PURCHASE", "REFINANCE", "OTHER"],
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "as_of": "YYYY-MM-DD",
  "cohort_basis": "ENTERED_WINDOW|COMPLETED_WINDOW|MATURE_ENTRY_COHORT|POINT_IN_TIME|OTHER",
  "maturity_state": "MATURE|PARTIAL|OPEN|UNKNOWN",
  "evidence_class": "OBSERVED|DERIVED|MODELED_REQUIREMENT|BENCHMARK|SCENARIO|MISSING",
  "provenance": "...",
  "confidence": "...",
  "applicability": "...",
  "contradiction_links": []
}
```

## Cohort rules

1. Conversion/pull-through uses the same purpose, event definitions, subject, unit, entry cohort, and sufficient maturity.
2. Completed-window production and entered-window funnel counts may both be displayed but cannot be divided without an explicit compatible model.
3. Open/pending share remains visible; incomplete outcomes do not silently become fallout.
4. Purchase and Refinance cohorts remain separate where mechanics differ.
5. Aggregation is allowed only when definitions, periods, cohort bases, units, subjects, and applicability are mathematically compatible.
6. Ninety-day trajectory may be compared with the 12-month baseline only as a labeled `DERIVED` pace/trajectory, never as an unlabeled forecast.
7. A material incompatibility activates one bounded contradiction clarification; unresolved calculations become `MISSING`.

## Canonical event IDs

| Canonical event ID | Customer label | Applicability | Required definition boundary |
| --- | --- | --- | --- |
| `lo.opportunity.v1` | Opportunity | all purposes | plausible current mortgage need; contact alone excluded |
| `lo.application.v1` | Application | all purposes | customer/company-declared alias; no TRID/HMDA/LOS silent equivalence |
| `lo.purchase.qualified-preapproved.v1` | Qualified/Preapproved | Purchase | aggregate company event; no MORE underwriting |
| `lo.purchase.active-transaction.v1` | Active Purchase Transaction | Purchase | declared active property/transaction event |
| `lo.refinance.qualified.v1` | Qualified | Refinance | aggregate company event; no Purchase preapproval requirement |
| `lo.refinance.active-loan.v1` | Active Refinance Loan | Refinance | declared active refinance-loan event |
| `lo.approval.v1` | Approval | applicable purposes | explicit company event |
| `lo.lock.v1` | Lock | applicable purposes | explicit lock event/date definition |
| `lo.close-fund.v1` | Close/Fund | applicable purposes | exact close/fund/disburse alias retained |
| `lo.explicit-non-funded-outcome.v1` | Non-funded outcome | applicable purposes | explicit aggregate outcome/reason category only |

## Definition custody

- Definition aliases are versioned evidence, not overwritten strings.
- A customer correction creates supersession lineage.
- Event definitions never infer borrower qualification, creditworthiness, protected traits, referral legality, consent, servicing rights, or contact authority.
- Current legal/program/platform facts are dated external evidence and do not enter durable event truth automatically.
