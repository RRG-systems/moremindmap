# MORE MindMap Leadership Sales Dashboard Backend API

Phase: MM-ADMIN-2A

## Executive Summary

Verdict: MOREMINDMAP_LEADERSHIP_SALES_DASHBOARD_BACKEND_API_IMPLEMENTED_WITH_LIMITS

Classification: MOREMINDMAP_ADMIN_SALES_DASHBOARD_BACKEND_API_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_HUMAN_REVIEW_OF_ADMIN_DASHBOARD_BACKEND_API

This sprint adds a backend-only, read-only admin API route for the future Leadership Sales Dashboard V1. It does not create frontend UI, alter the Leadership Portal, modify records, trigger generation, or deploy.

## Files Changed

- `api/admin/sales-dashboard.js`
- `MOREMINDMAP_LEADERSHIP_SALES_DASHBOARD_BACKEND_API_REPORT_ONLY_2A.md`
- `runtime_traces/moremindmap_leadership_sales_dashboard_backend_api_2a.json`

## API Route Created

Route:

- `GET /api/admin/sales-dashboard`

The route returns a bounded, sanitized dashboard summary only after admin-code validation.

## Admin Code Behavior

Accepted code locations:

- `Authorization: Bearer <code>`
- `X-Admin-Code: <code>`
- `?admin_code=<code>`
- `?code=<code>`

Validation:

- Prefer `process.env.MOREMINDMAP_ADMIN_DASHBOARD_CODE`
- Fallback to `MOREADMIN26` when the env var is missing
- Invalid or missing code returns controlled `403` with `admin_dashboard_access_denied`

No env values are returned in the API response.

## Real Data Returned

The endpoint returns:

- total profile count from the existing vault counter
- total Business Assessment count from indexed assessment type union
- profiles this month from profile date indexes
- Business Assessments this month from assessment date indexes
- bounded profile rows
- bounded Business Assessment rows
- company summary derived from returned rows
- source labels for each metric
- explicit missing-data notes

Profile rows include only:

- `profile_id`
- `name`
- `email`
- `phone`
- `company`
- `role`
- `created_at`
- `source`
- `completion_status`

Business Assessment rows include only:

- `assessment_id`
- `owner_profile_id`
- `name`
- `email`
- `phone`
- `company`
- `assessment_type`
- `created_at`
- `updated_at`
- `status`

## Unavailable Data

The API does not fake:

- paid/free counts
- promo usage totals
- revenue
- Stripe payment state
- subscription state
- Outcome Ledger state
- sales follow-up ownership

The response marks paid/free/promo status as unavailable:

`Paid/free/promo totals are unavailable until access source fields are persistently indexed.`

## Privacy Guardrails

The route:

- does not expose raw canonical dossiers
- does not expose raw assessment answers
- does not expose Redis keys
- does not expose env vars or secrets
- bounds returned rows to 100 profiles and 100 assessments
- uses source labels to distinguish exact, indexed, derived, and unavailable values
- is read-only and performs no Redis writes

## Product Reality Review Outcome

Review verdict: PASS_WITH_BOUNDED_REPAIR

Repairs made:

- Removed broad `Access-Control-Allow-Origin: *` from the admin endpoint.

CORS decision:

- The endpoint is intended for a same-origin future `/leadership-dashboard` UI.
- Broad public CORS is not needed for V1 and was removed.
- The route still responds to `OPTIONS` and declares allowed methods/headers, but does not explicitly authorize cross-origin browser access.

Privacy decision:

- PASS. The endpoint returns only bounded summary rows.
- Raw canonical dossiers are not returned.
- Raw Business Assessment answers are not returned.
- Redis key names, env values, and secrets are not returned.
- Internal error details are not returned to callers.

Deployment recommendation:

- READY_FOR_COMMIT_REVIEW after validation.
- Do not deploy until Darren approves the backend API and the production env/access-code plan.

Explicit limits:

- Fallback `MOREADMIN26` is a V1 convenience limit; production should prefer `MOREMINDMAP_ADMIN_DASHBOARD_CODE`.
- Valid-code local API testing was skipped because safe local Redis/environment access was not available in this review.
- No frontend dashboard exists yet.

## Limits

- Business Assessment total is exact only for currently indexed assessment types: `real_estate_agent` and `real_estate_team`.
- Profile listing uses bounded scan plus this-month indexed records.
- Company summary is derived from returned rows, not a full company analytics index.
- Paid/free/promo status requires future persistent access source fields.
- No frontend dashboard exists yet.

## Validation Checklist

- `node --check api/admin/sales-dashboard.js`
- `python3 -m json.tool runtime_traces/moremindmap_leadership_sales_dashboard_backend_api_2a.json`
- `git diff --check`
- `npm run build`

## Recommended Next Sprint

MM-ADMIN-2B: add the frontend Leadership Portal branch while preserving `DARRENDEMO`, then render a read-only `/leadership-dashboard` UI from this backend API.
