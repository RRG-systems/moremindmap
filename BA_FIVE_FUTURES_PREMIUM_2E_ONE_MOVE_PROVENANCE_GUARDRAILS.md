# BA Five Futures Premium 2E: One Move Provenance Guardrails

Phase: BA-FIVE-FUTURES-PREMIUM-2E  
Trace type: one_move_provenance_guardrails  
Base trace: `bdd10fa trace one move intelligence provenance`

## Verdict

The premium Five Futures renderer now requires real raw One Move provenance before it can render the premium experience. Missing One Move intelligence can no longer use the generic `One Move` title or fallback `Moderate` confidence as if those were generated truth.

Premium remains default-off. The legacy renderer is preserved as the fallback path.

## Files Changed

- `src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js`
- `src/components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx`
- `BA_FIVE_FUTURES_PREMIUM_2E_ONE_MOVE_PROVENANCE_GUARDRAILS.md`
- `runtime_traces/ba_five_futures_premium_2e_one_move_provenance_guardrails.json`

## Current Fallback Points Traced

Before this sprint, the risky One Move fallback points were:

- `oneMove.title || "One Move"` in the normalizer
- missing One Move confidence falling back to `"Moderate"`
- premium eligibility only requiring usable Five Futures data, not complete One Move provenance
- downstream/proof panels using conservative fallback sentences when generated source fields were absent

The last item is acceptable only when the core One Move object is real. The first three were hardened.

## Guardrails Added

### Raw One Move Provenance

The normalizer now adds:

```js
oneMove.provenance = {
  hasRawTitle,
  hasRawRootConstraint,
  hasRawRecommendation,
  hasRawModeledShift,
  hasRawProofSignals,
  hasRawConfidence,
  completeForPremium
}
```

`completeForPremium` requires:

- raw `one_move_v1.title`
- raw `one_move_v1.root_constraint`
- raw `one_move_v1.recommendation`
- raw `one_move_v1.expected_probability_shift.explanation` or equivalent raw modeled shift
- at least one proof/rationale source:
  - `success_indicators`
  - `first_30_days`
  - `why_this_move`
  - `why_now`

### Premium Eligibility

`hasPremiumFiveFuturesData(data)` now requires:

- existing futures readiness
- at least three future records
- `hasGeneratedOneMoveIntelligence(data) === true`

If One Move provenance is incomplete, the selector falls back to legacy rather than rendering the premium hero with missing intelligence.

### Title Fallback

The normalizer no longer maps a missing raw title to generated-looking `One Move`.

Missing title now maps to:

`One Move intelligence unavailable`

Because premium eligibility rejects incomplete provenance, this unavailable text should not occupy the premium One Move hero for incomplete records.

### Confidence Fallback

Missing raw One Move confidence no longer maps to `Moderate`.

Missing confidence now maps to:

`Confidence not indexed`

The premium renderer's final internal fallback also uses `Confidence not indexed`.

## Smoke Results

### Valid Production Record

Read-only production retrieve was checked for:

`mm-20260531-asovnjz4`

Normalized One Move result:

- title: `Install a 90-Day Judgment Transfer Cadence`
- confidence: `high`
- `hasRawTitle`: true
- `hasRawRootConstraint`: true
- `hasRawRecommendation`: true
- `hasRawModeledShift`: true
- `hasRawProofSignals`: true
- `hasRawConfidence`: true
- `completeForPremium`: true

Expected result: premium preview remains eligible for this record.

### Local Partial-Data Simulation

A local-only fixture with valid futures but empty `one_move_v1` returned:

- title: `One Move intelligence unavailable`
- confidence: `Confidence not indexed`
- `completeForPremium`: false

Expected result: premium eligibility fails and legacy fallback renders.

## What Did Not Change

- No prompts changed.
- No generation logic changed.
- No scoring changed.
- No stored records mutated.
- No backend/API files changed.
- No OpenAI/model wiring changed.
- No canonical dossier logic changed.
- No Universal Translator changes.
- No Darren Strategy Chat changes.
- No Leadership Demo changes.
- No Visual Lab changes.
- Premium was not enabled as production default.
- Legacy renderer was not removed.

## Remaining Limits

- This guardrail protects premium rendering. It does not prove population-level One Move uniqueness.
- The legacy renderer may still display fallback-safe normalized values if a record lacks One Move data, but premium will no longer treat that data as eligible.
- A larger record audit is still recommended before making premium default.

## Production Readiness Verdict

Ready to deploy behind the existing premium preview/default-off behavior once build and smoke validation pass.
