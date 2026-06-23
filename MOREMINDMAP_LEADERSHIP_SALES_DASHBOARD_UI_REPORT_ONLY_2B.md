# MORE MindMap Leadership Sales Dashboard UI

Phase: MM-ADMIN-2B

## Executive Summary

Verdict: MOREMINDMAP_LEADERSHIP_SALES_DASHBOARD_UI_IMPLEMENTED_WITH_LIMITS

Classification: MOREMINDMAP_ADMIN_SALES_DASHBOARD_UI_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_HUMAN_REVIEW_OF_ADMIN_DASHBOARD_UI

This sprint adds the frontend route and UI for the internal Leadership Sales Dashboard V1. The existing Leadership Portal is preserved and now supports two access paths:

- `DARRENDEMO` opens the existing `/leadership-demo` experience.
- `MOREADMIN26` opens the new `/leadership-dashboard` read-only dashboard.

No backend code, Redis records, assessment records, profile records, generation logic, Stripe, subscriptions, Outcome Ledger, RRG runtime, Executive Diagnostic, Business Map, Five Futures, or One Move logic were changed.

## Files Changed

- `src/LeadershipPortal.jsx`
- `src/main.jsx`
- `src/components/LeadershipSalesDashboard.jsx`
- `MOREMINDMAP_LEADERSHIP_SALES_DASHBOARD_UI_REPORT_ONLY_2B.md`
- `runtime_traces/moremindmap_leadership_sales_dashboard_ui_2b.json`

## Route Created

- `/leadership-dashboard`

## Portal Routing Behavior

The existing portal remains at `/leadership`.

Routing:

- `DARRENDEMO` stores demo access for the current browser session and routes to `/leadership-demo`.
- `MOREADMIN26` stores dashboard access for the current browser session and routes to `/leadership-dashboard`.

The dashboard access code is sent to the backend using the `X-Admin-Code` header. It is not placed in the dashboard URL.

## UI Sections Created

The dashboard renders:

- Header with `MORE MindMap Leadership Sales Dashboard`
- generated timestamp from the backend API
- `V1 Read-Only` label
- Summary cards
- Paid/free/promo/revenue unavailable panel
- Companies represented section
- Missing data and limits panel
- Profiles table
- Business Assessments table
- Loading, locked, denied, error, and empty states

## Backend API Consumed

- `GET /api/admin/sales-dashboard`

The UI expects the MM-ADMIN-2A response shape and renders only shaped dashboard fields.

## What Remains Unavailable

The UI explicitly shows paid/free/promo/revenue as unavailable when the backend reports unavailable. It does not invent totals.

Unavailable fields remain:

- paid/free totals
- promo usage totals
- revenue totals
- Stripe payment state
- subscription state
- Outcome Ledger state
- RRG readiness
- writable follow-up notes
- product feedback inbox
- recursive outcome capture

## Privacy Guardrails

The UI:

- does not render raw API JSON
- does not render raw canonical dossiers
- does not render raw Business Assessment answers
- does not log user rows or private dashboard data
- does not expose env vars
- does not expose Redis keys
- does not create writable notes
- does not modify records
- keeps missing-data notes visible

## Product Reality Review Outcome

Review verdict: PASS_NO_REPAIR_REQUIRED

Repairs made:

- None.

Routing decision:

- `DARRENDEMO` remains routed to the existing `/leadership-demo` presentation experience.
- `MOREADMIN26` routes to `/leadership-dashboard`.
- No public dashboard link was added to the homepage beyond the existing Leadership Portal entry.

Access decision:

- The UI sends the dashboard code using `X-Admin-Code`.
- The code is not placed in the dashboard URL.
- Session storage is accepted as a V1 convenience gate; the backend API remains the real data gate.

Privacy decision:

- PASS. Static scan found no raw JSON rendering, no raw dossier or raw answer key rendering, no Redis/env references, and no console logging in changed frontend files.

Deployment recommendation:

- Ready for commit, push, and production deploy after final validation.

## Validation Checklist

- `git diff --check`
- `npm run build`
- local invalid/no-access route state check if feasible
- local portal route behavior check if feasible

## Explicit Limits

- The dashboard access code is held only in `sessionStorage`.
- The frontend code path uses the public access code provided for this V1; backend server-side validation remains the real data gate.
- This sprint does not deploy.
- This sprint does not add admin notes, Outcome Ledger, RRG runtime, Stripe, subscriptions, or generation changes.

## Recommended Next Step

Human review of the MM-ADMIN-2B UI. If approved, commit and deploy in a separate step.
