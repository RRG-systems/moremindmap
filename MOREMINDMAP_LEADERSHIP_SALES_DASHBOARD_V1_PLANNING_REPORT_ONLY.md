# MORE MindMap Leadership Sales Dashboard V1 Planning

Report-only phase: MM-ADMIN-1

## Executive Summary

Verdict: MOREMINDMAP_LEADERSHIP_SALES_DASHBOARD_V1_PLANNING_COMPLETE_WITH_LIMITS

Classification: MOREMINDMAP_ADMIN_SALES_DASHBOARD_V1_PLAN_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_HUMAN_REVIEW_OF_ADMIN_DASHBOARD_V1_PLAN

This planning sprint inventories the current MORE MindMap data paths for a future internal Leadership Sales Dashboard V1. The dashboard appears medium difficulty: the core profile vault has useful indexes and durable records, but Business Assessment has only date/type/latest-by-profile indexes and no global count, monthly aggregate, payment ledger, or follow-up event model.

The safest V1 should be a read-only admin dashboard accessed from the existing Leadership Portal without breaking `DARRENDEMO`. A second access-code path can later route `MOREADMIN26` to an internal dashboard while preserving the current Darren demo flow.

No code, routes, frontend UI, Redis data, profile records, assessment records, generation logic, payment logic, or production behavior were changed in this sprint.

## Files Created

- `MOREMINDMAP_LEADERSHIP_SALES_DASHBOARD_V1_PLANNING_REPORT_ONLY.md`
- `runtime_traces/moremindmap_leadership_sales_dashboard_v1_planning_01.json`

## Current Data Inventory

### Behavior Profiles / Canonical Dossiers

Canonical profiles are saved through `api/engine/vault/saveCanonicalProfile.js`.

Primary saved record:

- `vault:profile:{profile_id}`

Additional saved artifact:

- `vault:markdown:{profile_id}`

Profile record fields currently visible from the save path include:

- `profile_id`
- `job_id`
- `person_name`
- `email`
- `company_name`
- `company_slug`
- `created_at`
- `assessment_version`
- `model`
- `canonical_profile_json`
- `vector_scores`
- `profile_signature`
- `intake_answers`
- `quality_score`
- `metadata`

Identity and organization fields can also exist inside canonical metadata from Page 0A:

- `metadata.identity.full_name`
- `metadata.identity.email`
- `metadata.identity.phone`
- `metadata.organization.company`
- `metadata.organization.role_title`
- `metadata.organization.industry`
- `metadata.organization.department`
- `metadata.organization.reports_to`

### Business Assessments

Business Assessments are saved through `api/business-assessment/start.js`.

Primary saved record:

- `business_assessment:{assessment_id}`

Auxiliary keys:

- `business_assessment_by_profile:{owner_profile_id}`
- `business_assessment_job:{job_id}`

Business Assessment record fields currently visible from the save path include:

- `assessment_id`
- `owner_profile_id`
- `assessment_type`
- `status`
- `created_at`
- `updated_at`
- `version`
- `inputs.answers`
- `inputs.team_profile_ids`
- `inputs.financial_text`
- `profile_context`
- `output`
- `metadata`

Later generation layers update the same assessment record with:

- `output.business_intelligence_draft`
- `output.executive_diagnostic_briefing_v1`
- `output.five_futures_v1`
- `output.one_move_v1`
- status values such as `business_intelligence_draft_ready`, `executive_diagnostic_briefing_ready`, and `five_futures_and_one_move_ready`
- controlled failure metadata such as `metadata.last_briefing_generation_error` and `metadata.last_futures_generation_error`

## Existing Redis Key / Index Inventory Inferred From Code

### Profile Vault Indexes

Existing profile indexes:

- `vault:index:date:{YYYY-MM-DD}`: profile IDs created on a date
- `vault:index:email:{email}`: profile IDs by email
- `vault:index:company:{company_slug}`: profile IDs by company slug
- `vault:index:department:{department_slug}`: profile IDs by department when organization metadata exists
- `vault:index:role:{role_slug}`: profile IDs by role title when organization metadata exists
- `vault:index:manager:{manager_slug}`: profile IDs by manager when organization metadata exists
- `vault:index:industry:{industry_slug}`: profile IDs by industry when organization metadata exists
- `vault:index:org_context:{context_slug}`: profile IDs by org context
- `vault:metadata:count`: total profile count counter

Existing profile listing helpers:

- `api/engine/vault/listCanonicalProfiles.js`
- `api/engine/vault/queryProfilesByOrg.js`
- `api/diagnostic/list-all-profiles.js`

Important limitation: `listRecentProfiles` currently uses `redis.keys('vault:profile:*')` and full profile reads. That can work for small admin V1 data, but it is not ideal as the dataset grows.

### Business Assessment Indexes

Existing Business Assessment indexes:

- `business_assessment:index:date:{YYYY-MM-DD}`: assessment IDs created on a date
- `business_assessment:index:type:{assessmentType}`: assessment IDs by type
- `business_assessment_by_profile:{profile_id}`: latest assessment ID for one owner profile
- `business_assessment_job:{job_id}`: intake job record

Missing Business Assessment indexes:

- no global assessment count found
- no all-assessment ID set found
- no monthly aggregate found
- no status index found
- no company index found
- no promo/payment index found
- no follow-up/sales activity index found

## Available Dashboard Fields Today

The following fields can be built from existing records and indexes if a read-only admin API is added:

- total canonical dossiers / behavior profiles from `vault:metadata:count`
- profiles this month by unioning `vault:index:date:{YYYY-MM-DD}` for days in the month
- profile IDs
- profile created dates
- names when saved as `person_name` or metadata identity
- emails when saved as `email` or metadata identity
- phone numbers when Page 0A metadata was saved and preserved
- company names and company slugs
- role/title when Page 0A organization metadata is present
- organization indexes for company, department, role, manager, industry, org context
- total Business Assessments only if derived from scanning known date indexes or type indexes; no dedicated counter exists
- Business Assessments this month by unioning `business_assessment:index:date:{YYYY-MM-DD}` for days in the month
- assessment IDs
- owner profile IDs
- assessment type
- assessment status
- assessment created/updated dates
- completion-stage booleans from output presence
- generation failure metadata when present
- latest assessment by profile ID through `business_assessment_by_profile:{profile_id}`

## Missing Fields

The following are not reliably available today without new indexing, event logging, or payload persistence:

- reliable paid/free status per profile
- reliable paid/free status per Business Assessment
- reliable promo code used per Business Assessment
- durable Stripe checkout/session/payment status in the profile or assessment record
- revenue totals
- dashboard-grade global Business Assessment count
- status-based Business Assessment aggregate
- last user activity across profile and assessment without scan/merge logic
- sales follow-up owner/status/notes
- notification delivery history
- RRG readiness status as a dedicated field
- durable admin audit trail

## Paid / Free / Promo Availability

Behavior Profile promo codes are currently known in frontend code:

- `FATHOMFREE`
- `MOREFREE26`

Business Assessment promo code currently known in frontend code:

- `BA5FREE`

Current limitation:

- Behavior Profile promo state is used on the frontend to unlock flow and choose Mini V2, but the current backend save path does not clearly persist the promo code as a first-class field in the vault record.
- Business Assessment promo validation is frontend-only and the `/api/business-assessment/start` payload does not include the promo code.
- Payment success is detected in `src/Profile.jsx` from the `payment_success` query parameter, but a durable payment record or Stripe session linkage was not found in the examined save records.

Recommendation: V1 should label paid/free/promo as `unavailable` unless a real persisted field is present. Do not infer revenue or payment status from dashboard appearance.

## Existing Leadership Portal Inventory

The homepage already links to `/leadership`.

Current files:

- `src/LeadershipPortal.jsx`
- `src/LeadershipDemo.jsx`
- `src/main.jsx`
- `src/lib/leadershipDemoSlides.js`

Current behavior:

- User enters access code at `/leadership`.
- `DARRENDEMO` is represented as lowercase `darrendemo` in `src/LeadershipPortal.jsx`.
- Valid demo access stores `sessionStorage.leadershipDemoAccess = 'true'`.
- User is routed to `/leadership-demo`.
- `/leadership-demo` renders the existing Darren demo/presentation experience.

Important implementation constraint:

- Do not break `DARRENDEMO`.
- Do not remove or redesign the existing Darren demo slide/presentation behavior.
- Add a second path only after human approval.

## Proposed Dashboard Route

Recommended future frontend route:

- `/leadership-dashboard`

Reason:

- It keeps `/leadership` as the existing access-code entry point.
- It preserves `/leadership-demo` for `DARRENDEMO`.
- It lets `MOREADMIN26` route to a distinct internal sales dashboard without mixing demo and admin surfaces.

Alternative route:

- `/admin/sales-dashboard`

This is acceptable, but `/leadership-dashboard` aligns better with the existing portal vocabulary.

## Proposed Backend API Route

Recommended future read-only API:

- `GET /api/admin/sales-dashboard`

Request pattern:

- header: `x-admin-code: {code}`
- optional query params: `month=YYYY-MM`, `limit=100`, `include=summary|tables`

Response shape:

- `success`
- `generated_at`
- `summary`
- `profiles`
- `business_assessments`
- `companies`
- `follow_up_queue`
- `missing_data_notes`
- `source_integrity`

The API should return dashboard-specific summary rows, not raw canonical dossiers or full assessment answer payloads.

## Proposed Admin Access Method

Recommended V1:

- Frontend access code entered through existing `/leadership` portal.
- Preserve `DARRENDEMO` branch to `/leadership-demo`.
- Add `MOREADMIN26` branch to `/leadership-dashboard`.
- Prefer env-configurable admin code:
  - `MOREMINDMAP_ADMIN_DASHBOARD_CODE=MOREADMIN26`

Important limitation:

- Vite frontend env vars are public if embedded in client code. A frontend-only access code is a gate, not security.

Recommended safer V1:

- Use the portal code for navigation only.
- Require the backend API to validate an env-backed admin code server-side before returning dashboard data.
- Do not hardcode private admin secrets in frontend code.
- If a public-friendly route code is used client-side, treat it as convenience gating only, not data authorization.

## Proposed V1 Dashboard Layout

### Top Summary Cards

- Total Behavior Profiles
- Total Business Assessments
- Profiles This Month
- Business Assessments This Month
- Completed Executive Diagnostics
- Completed Five Futures + One Move
- Missing Data / Unavailable Payment Status count

### Monthly Activity

- Profiles by date for current month
- Business Assessments by date for current month
- Completion stage counts if derivable

### Profiles Table

Columns:

- Name
- Email
- Phone availability or phone value in admin-only view
- Company
- Role/title
- Profile ID
- Created date
- Latest Business Assessment ID if linked
- Promo/paid status: real value or `Unavailable`
- Follow-up signal: rough, derived from completion and recency

### Business Assessments Table

Columns:

- Assessment ID
- Owner Profile ID
- Name from profile context
- Company from owner profile if available
- Assessment type
- Status
- Created date
- Updated date
- Business Intelligence Draft present
- Executive Diagnostic present
- Five Futures present
- One Move present
- Last generation error stage if any

### Promo / Free / Paid Breakdown

V1 should show:

- `Payment status unavailable from current persisted records`
- `Promo status unavailable unless explicitly persisted`

Do not show fake totals.

### Company Adoption List

Use `vault:index:company:{company_slug}` and profile records to show:

- company name
- profile count
- known assessment count if linked
- latest profile date

### Follow-up Queue

Rough V1 signals only:

- completed Behavior Profile but no Business Assessment
- Business Assessment intake saved but generation incomplete
- Business Assessment complete and ready for sales follow-up
- missing phone/email warning
- recent profiles with company present

These are operational cues, not CRM records.

### System Health / Missing-Data Notes

Show:

- payment status unavailable
- promo code not persisted
- Business Assessment global count requires date/type scan until new index exists
- dashboard is read-only
- source labels for each metric

## Safety / Privacy Rules

V1 must:

- require backend admin-code validation before returning private dashboard data
- never expose raw canonical dossiers by default
- never expose full assessment answers by default
- never expose Redis keys or env vars
- never expose raw JSON/debug output in public UI
- label every metric by source
- label missing payment/promo/revenue data as unavailable
- avoid fake paid/free totals
- avoid fake revenue
- avoid fake RRG readiness claims
- preserve `DARRENDEMO`
- avoid storing or changing user records
- be read-only

## Stop Conditions For Implementation

STOP if:

- `DARRENDEMO` no longer opens the existing demo
- dashboard route exposes data without backend admin-code validation
- raw canonical dossiers are exposed by default
- full answers are exposed by default
- Redis keys/env vars appear in the UI
- payment or promo totals are fabricated
- dashboard shows paid/free values without persisted source evidence
- Business Assessment totals are guessed instead of sourced from indexes/scans with labels
- route fails
- retrieval fails
- build fails
- raw JSON/debug output appears
- Craig Fox/Fathom demo content leaks into the admin dashboard unintentionally
- frontend claims data exists when backend returns unavailable
- code touches generation logic, Stripe, subscriptions, Outcome Ledger, Executive Diagnostic, Business Map, Five Futures, or One Move

## Recommended MM-ADMIN-2 Implementation Scope

Recommendation: C. Split into two implementation sprints.

MM-ADMIN-2A:

- Create read-only backend API from existing indexes only.
- Add backend admin-code validation.
- Return summary/table data with missing-data notes.
- Do not add new indexes yet.
- Keep frontend untouched or minimal only if explicitly approved.

MM-ADMIN-2B:

- Add the Leadership Portal `MOREADMIN26` branch and internal dashboard UI.
- Preserve `DARRENDEMO`.
- Render source-labeled dashboard fields.

Future MM-ADMIN-3:

- Add minimal new analytics indexes going forward if MM-ADMIN-2A proves existing indexes are too scan-heavy.
- Candidate indexes: global Business Assessment count, all assessment IDs, status index, month index, promo/payment status fields if payment work is approved later.

## Explicit Limits

This sprint does not enable:

- dashboard runtime
- admin route
- frontend UI
- auth implementation
- Stripe
- subscriptions
- Outcome Ledger
- RRG runtime
- production deploy
- production data scan
- private data exposure

This sprint only enables human review of the Leadership Sales Dashboard V1 plan.
