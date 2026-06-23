# MM-ADMIN-4I.1 Adaptive Strategy Draft Route Repair

## Verdict

MOREMINDMAP_DARREN_ADAPTIVE_STRATEGY_DRAFT_REPAIR_COMPLETE_WITH_LIMITS

## Classification

ADAPTIVE_DRAFT_ROUTE_REPAIRED_PENDING_REVIEW_NON_REPLACEMENT

## Root Cause

The Adaptive Strategy Draft route could safely reach the model, but draft field normalization used the same strict bounded text validator as user-entered evidence fields. If the model omitted a required draft field, exceeded a field bound, or used wording that triggered the safe text validator, the route returned a controlled HTTP 400 and no draft was saved.

## Repair Summary

The repair keeps the route safe while making draft creation resilient:

- Added safe draft text normalization with fixed fallback copy.
- Added safe draft array normalization for model limits.
- Normalized `adoption_recommendation` to `adopt_now`, `review_first`, or `wait_for_more_evidence`.
- Preserved `draft_status: pending_review`.
- Preserved the boundary: “This draft does not replace the active strategy until reviewed/adopted.”

## Policy Preserved

- Active/latest generated strategy is not replaced.
- `generated_strategy_latest` is not mutated by draft creation.
- Canonical dossier is not mutated.
- Assessment records are not mutated.
- No raw model output is returned.
- No raw prompt is returned.
- No numeric future probability scoring is introduced.

## Production Smoke Plan

After deploy:

- Capture latest active strategy before draft.
- POST one adaptive strategy draft request exactly once.
- Confirm HTTP 200, `draft_saved: true`, `draft_status: pending_review`.
- Confirm `source_strategy_id` equals the active/latest strategy.
- Confirm latest generated strategy is unchanged after draft creation.
- Confirm outcome event count is unchanged by draft generation.
- Confirm latest draft retrieval returns the pending-review draft.
- Confirm no unsafe exposure.

## Limits

- Draft adoption remains future work.
- Adaptive draft does not replace active strategy.
- Automatic learning is not fully live.
- Future scoring remains band-based and non-numeric.
