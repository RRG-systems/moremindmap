# MM-UX-2B.2 — Business Assessment Profile-Gated Payment and Dev Code Flow

## Verdict

MOREMINDMAP_BA_PROFILE_GATED_PAYMENT_AND_DEV_CODE_FLOW_COMPLETE_WITH_LIMITS

## Classification

BA_PROFILE_ID_REQUIRED_FOR_PAYMENT_AND_DEV_CODE_ACCESS_NO_PRICE_CHANGE

## Summary

The Business Assessment entry page now follows one rule across all panels: first validate your profile. Profile validation is required before Business Assessment checkout, MORE Monthly Intelligence checkout, or Dev Code access can proceed.

This was a frontend gating repair. Stripe product keys, price IDs, checkout mode, webhook behavior, access grants, Business Assessment questions, and generation logic were not changed.

## Root Cause

The page had a shared Profile ID validation path, but validation was treated as a direct path into the assessment flow. The Access/Codes panel showed a Begin Business Assessment action immediately after Profile ID validation, so a validated profile alone could start the test. Checkout buttons were also visually available before profile validation.

## Repair Summary

- Added shared validated Profile ID state for the Business Assessment entry page.
- Added clear "FIRST validate your profile" blocks to the Business Assessment, MORE Monthly Intelligence, and Access/Codes panels.
- Disabled the $49 Business Assessment checkout button until Profile ID validation succeeds.
- Disabled MORE Monthly Intelligence until Profile ID validation succeeds and a completed Business Assessment is detected through the existing retrieval endpoint.
- Renamed visible Promo Code copy to Dev Code.
- Changed free access so it requires validated Profile ID plus valid Dev Code.
- Moved Begin Business Assessment so it appears only after both Profile ID validation and Dev Code acceptance.
- Preserved the clean render split from MM-UX-2B.1.

## Panel 1 — Business Assessment

The $49 checkout panel now requires Profile ID validation first. The checkout button remains disabled until a profile is found. When checkout starts, the validated Profile ID is passed through the existing checkout payload.

## Panel 2 — MORE Monthly Intelligence

Monthly Intelligence requires a validated Profile ID and a previously completed Business Assessment. The existing Business Assessment retrieval endpoint is used to check completion. If completion is not found, the subscription checkout button stays disabled and the user sees: "First you must take the Business Assessment to unlock Monthly Intelligence."

## Panel 3 — Dev Code

The visible label is now Dev Code. Profile ID validation alone does not start the test. Dev Code alone does not start the test. Free Business Assessment access unlocks only after validated Profile ID plus valid Dev Code, then the user sees Begin Business Assessment.

## Checkout Profile ID Preservation

No backend change was required. The existing checkout route already accepts `profile_id`, uses it as `client_reference_id`, and stores it in Stripe session metadata. The frontend now sends only the validated Profile ID for Business Assessment and Monthly Intelligence checkout.

## Preserved Behaviors

- Stripe checkout session creation unchanged.
- Stripe price IDs unchanged.
- Stripe webhook/access grant logic unchanged.
- Business Assessment questions unchanged.
- Assessment save/generation unchanged.
- Completed assessment retrieval unchanged.
- Universal Translator, BOS/Profile, and Darren dashboard unchanged.

## Limits

- This sprint does not create new access grants.
- This sprint does not complete any checkout.
- Monthly Intelligence completion detection is based on the existing completed Business Assessment retrieval path.
- Live browser retest should verify BA5FREE plus a known valid Profile ID.

## Production Smoke Plan

- Confirm `/`, `/profile`, and `/business-assessment` return 200.
- Confirm initial Business Assessment page shows all three premium panels.
- Confirm Panel 1 checkout is disabled before Profile ID validation.
- Confirm Panel 2 subscription checkout is disabled before Profile ID validation and completed BA detection.
- Confirm Panel 3 says Dev Code, not Promo Code.
- Confirm Profile ID validation alone does not start the test.
- Confirm validated Profile ID plus BA5FREE shows Begin Business Assessment.
- Confirm Begin Business Assessment starts the clean focused question view.
- Do not start checkout during smoke.
