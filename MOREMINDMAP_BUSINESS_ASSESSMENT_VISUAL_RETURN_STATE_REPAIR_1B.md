# MM-BA-UX-1B — Business Assessment Visual Return-State Repair

## Verdict

MOREMINDMAP_BUSINESS_ASSESSMENT_VISUAL_RETURN_STATE_REPAIRED_WITH_LIMITS

## Classification

VISUAL_CLOSE_RETURNS_TO_ASSESSMENT_RESULT_CONTEXT_NO_PAYMENT_ROUTE_REGRESSION

## Root Cause

The Visual DNA and Five Futures artifacts opened as separate routes. Their close link navigated back to a reconstructed Business Assessment URL, which forced the Business Assessment page to rehydrate from the profile id and could show the assessment entry/payment area before the result context was restored. From the user perspective, closing the visual looked like returning to the payment/start state instead of simply closing the visual.

## Repair Summary

- Visual launch links now save a minimal return-state marker in `sessionStorage`.
- Stored data is limited to the return URL and scroll position.
- No assessment answers, dossier content, or result payloads are stored.
- Visual close buttons now use browser history only when the visual was launched from a Business Assessment result in the same session.
- Direct visual URL access still falls back to `/business-assessment?id={profile_id}#business-assessment-results` when a profile id is available.
- Business Assessment restores the saved scroll position after route-based rehydration when fallback return is needed.

## Close Behavior

### Visual DNA

When opened from a Business Assessment result, Close returns to the existing result page history entry. If opened directly, Close returns to the safe Business Assessment result URL when possible.

### Five Futures

When opened from a Business Assessment result, Close returns to the existing result page history entry. If opened directly, Close returns to the safe Business Assessment result URL when possible.

## Boundaries

- Payment behavior was not changed.
- Stripe logic was not changed.
- Access grant logic was not changed.
- Assessment generation logic was not changed.
- Assessment records were not mutated.
- Canonical dossiers were not mutated.
- No new records were created.
- Direct visual routes remain supported.

## Production Smoke Plan

- `/business-assessment` returns 200.
- Direct `/business-assessment/visual-map?id={profile_id}` returns 200 for a valid id.
- Direct `/business-assessment/five-futures?id={profile_id}` returns 200 for a valid id.
- Open Visual DNA from a completed Business Assessment result, close it, and confirm the result context remains visible.
- Open Five Futures from a completed Business Assessment result, close it, and confirm the result context remains visible.
- Confirm no payment route is triggered.
