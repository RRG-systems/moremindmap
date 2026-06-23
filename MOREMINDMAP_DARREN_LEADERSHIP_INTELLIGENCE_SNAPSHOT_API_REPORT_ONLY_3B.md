# Darren Leadership Intelligence Snapshot API

Phase: MM-ADMIN-3B

## Executive Summary

Verdict: MOREMINDMAP_DARREN_LEADERSHIP_INTELLIGENCE_SNAPSHOT_API_IMPLEMENTED_WITH_LIMITS

Classification: MOREMINDMAP_DARREN_LEADERSHIP_INTELLIGENCE_SNAPSHOT_API_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_HUMAN_REVIEW_OF_DARREN_INTELLIGENCE_SNAPSHOT_API

This sprint adds a read-only backend API route for a source-labeled Darren Leadership Intelligence Snapshot scaffold.

The route does not call GPT, does not generate final Five Futures, does not generate final One Move, does not create chat, and does not write to Redis. It aggregates sanitized Darren profile context, linked Business Assessment status, dashboard metrics, the repo-backed Strategic Build Map, valuation truth boundaries, E->P operating lens, path comparison, evidence gaps, proof targets, and overclaim boundaries.

## Files Changed

- `api/admin/darren-intelligence-snapshot.js`
- `MOREMINDMAP_DARREN_LEADERSHIP_INTELLIGENCE_SNAPSHOT_API_REPORT_ONLY_3B.md`
- `runtime_traces/moremindmap_darren_leadership_intelligence_snapshot_api_3b.json`

## API Route

Route:

- `GET /api/admin/darren-intelligence-snapshot`

Access model:

- accepts `Authorization: Bearer <code>`
- accepts `X-Admin-Code: <code>`
- accepts `?code=<code>` or `?admin_code=<code>`
- checks `MOREMINDMAP_ADMIN_DASHBOARD_CODE` if configured
- falls back to `MOREADMIN26` for V1
- returns controlled `403` before data access when code is missing or invalid

## Snapshot Returns

The snapshot returns:

- snapshot version
- generated timestamp
- sanitized Darren identity fields
- Darren behavioral identity: `Momentum Machine`
- Darren role lane: `momentum + sales`
- D.J. role lane: `vision + build`
- Darren linked Business Assessment status and output availability flags
- $250M / $15M-$30M gross revenue scenario lens
- dashboard metric context
- Strategic Build Map context
- E->P operating lens
- path comparison model
- Five Futures scaffold
- One Move scaffold
- evidence gaps
- next proof targets
- what not to overclaim
- unavailable fields
- limits

## What Remains Unavailable

- verified revenue
- paid/free/promo totals
- Stripe payment state
- subscription state
- Outcome Ledger state
- RRG activity/recovery metrics
- partner capital pipeline
- channel distribution pipeline
- cross-vertical adoption metrics
- final GPT-generated Darren Five Futures
- final GPT-generated Darren One Move
- chat

## Data Sources Used

- Darren canonical profile lookup by `mm-20260527-6zshuaao`
- Darren linked Business Assessment lookup by profile key
- current admin dashboard-style Redis indexes and bounded scans
- repo-backed Strategic Build Map from `src/data/leadershipBuildMap.js`
- MM-ADMIN-3A and 3A.1 planning assumptions encoded as source-labeled constants

## Privacy Guardrails

The route:

- does not return raw canonical dossier
- does not return raw assessment answers
- does not return Redis keys
- does not return environment values
- does not expose secrets
- does not mutate records
- does not trigger generation
- does not call GPT
- does not merge partner capital with revenue
- does not merge channel reach with adoption or revenue
- does not claim valuation certainty

## Explicit Limits

- Snapshot is scaffold/data aggregation only.
- Five Futures and One Move are scaffolds, not final generated intelligence.
- The route is backend-only; no dashboard UI was added.
- Valid-code local test may require Redis/env availability.
- Production deploy is not included in this sprint.

## Validation Checklist

- `node --check api/admin/darren-intelligence-snapshot.js`: passed
- `python3 -m json.tool runtime_traces/moremindmap_darren_leadership_intelligence_snapshot_api_3b.json`: passed
- `git diff --check`: passed
- `npm run build`: passed with existing Vite chunk-size warning
- invalid admin code local test: passed, controlled `403 admin_snapshot_access_denied`
- valid admin code local test: skipped because local `REDIS_URL` is not configured

## Recommended Next Step

Human review, then deploy approval if the backend route is accepted.
