# MORE MindMap Leadership Sales Dashboard Polish

Phase: MM-ADMIN-2C

## Executive Summary

Verdict: MOREMINDMAP_LEADERSHIP_SALES_DASHBOARD_POLISH_IMPLEMENTED_WITH_LIMITS

Classification: MOREMINDMAP_ADMIN_SALES_DASHBOARD_POLISH_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_HUMAN_REVIEW_OF_ADMIN_DASHBOARD_POLISH

This sprint polishes the live Leadership Sales Dashboard V1 as a cleaner sales cockpit without changing backend storage or raw records.

The polish is frontend display-only:

- Company names are normalized for display grouping only.
- Safely detectable internal QA/test rows are hidden from the default sales-view tables.
- Backend top-level totals remain true backend totals.
- Separate displayed sales-view counts are shown and labeled.
- Paid/free/promo/revenue and RRG readiness remain unavailable.

No Redis records, profile records, assessment records, generation logic, Stripe, subscriptions, Outcome Ledger, RRG runtime, Executive Diagnostic, Business Map, Five Futures, or One Move logic were changed.

## Files Changed

- `src/components/LeadershipSalesDashboard.jsx`
- `MOREMINDMAP_LEADERSHIP_SALES_DASHBOARD_POLISH_REPORT_ONLY_2C.md`
- `runtime_traces/moremindmap_leadership_sales_dashboard_polish_2c.json`

## Normalization Behavior

Company normalization is display-only and does not alter stored values.

Rules:

- `fathom realty`, `FATHOM REALTY`, `Fathom realty`, `Fathom Realty`, and `Fathom Realty LLC` display as `Fathom Realty`
- `Fathom Realty NC, LLC` displays as `Fathom Realty NC`
- `Fathom Realty MT, LLC` displays as `Fathom Realty MT`
- `the more companies`, `The MORE companies`, and `The MORE Companies` display as `The MORE Companies`
- missing, unknown, or unavailable company values display as `Missing Company Data`

## Test / Synthetic Filtering Behavior

The default sales view hides rows only when a test signal is safely detectable from already returned summary fields.

Rules:

- email contains `example.invalid`
- name contains a standalone `QA`
- company contains `QA Synthetic`
- company contains `Diagnostic Test`
- name/email contains `Smoke Test`
- name/email contains `synthetic fixture`

No data is deleted or changed. Filtering is frontend display-only.

## Counts

Backend summary cards remain backend-sourced totals.

The UI now also shows separate display counts:

- Displayed Sales Profiles
- Displayed Sales Assessments
- QA/test rows hidden

This avoids fake totals while making the sales cockpit cleaner.

## Sales Context Copy

A sales visibility panel was added near the top:

`This dashboard shows real V1 profile and assessment activity, company adoption signals, and follow-up targets. Paid/free/revenue and RRG readiness remain unavailable until those systems are persistently indexed.`

## What Remains Unavailable

- paid/free totals
- promo usage totals
- revenue totals
- Stripe payment state
- subscription state
- Outcome Ledger state
- RRG readiness
- Darren notes
- writable feedback capture
- Strategic Build Map

## Privacy Guardrails

The dashboard still:

- does not render raw API JSON
- does not render raw canonical dossiers
- does not render raw assessment answers
- does not expose Redis keys
- does not expose env vars or secrets
- does not log user rows or private data
- keeps missing-data notes and limits visible
- keeps backend API validation as the real data gate

## Validation Checklist

- `python3 -m json.tool runtime_traces/moremindmap_leadership_sales_dashboard_polish_2c.json`
- `git diff --check`
- `npm run build`
- local `/leadership-dashboard` route returns 200 if safe
- static privacy scan for `console.`, `JSON.stringify`, raw dossier/answer keys, Redis/env references

## Explicit Limits

- This sprint does not change backend data or storage.
- This sprint does not add notes, chat, RRG runtime, Outcome Ledger, Stripe, subscriptions, or generation changes.
- Company normalization is not canonical data cleanup.
- Test filtering is conservative and only hides obvious QA/test/synthetic rows.

## Recommended Next Step

Human review, then commit/push/deploy if approved and validation passes.
