# Production P0 diagnostic exposure — incident and repair evidence

Status: repair candidate under verification; not yet deployed or canonical.

## Exact base custody

- Production deployment at repair start: `dpl_DEkqERow5keMcirKiLiGEQKqTiVS`
- Canonical source: `a4787a70af9016ecf83726d78739e937313402cb`
- Canonical tree: `abc053cb5b3142206763afa6914712d3edf4c545`
- Preserved rollback deployment: `dpl_FrB1fZhdJX26NWkGoXetFcRWXV9K`
- Repair branch: `codex/home-base-v2-p0-diagnostic-containment`

## Exact reported 25-route classification

Legend: H = harmless read-only probe; P = customer or PII projection; C = raw canonical/job-state projection; R = Redis, runtime-config, or secret exposure; M = mutation/provider-cost capability.

| # | Former deployable source | Class | Source-derived capability |
|---:|---|---|---|
| 1 | `api/diagnostic-repair.js` | R, M | Anonymous provider-backed repair invocation and stack projection. |
| 2 | `api/diagnostic.js` | R | Runtime/provider configuration metadata projection. |
| 3 | `api/diagnostic/dump-job.js` | P, C, R | Arbitrary job and persisted diagnostic projection. |
| 4 | `api/diagnostic/get-latest-profile.js` | P, C | Latest Profile and full canonical record projection. |
| 5 | `api/diagnostic/get-profile-by-job.js` | P, R | Profile/job relationship and Redis-key projection. |
| 6 | `api/diagnostic/get-vault-profile.js` | P, C, R | Full Profile/markdown plus complete Redis connection credential projection and logging. |
| 7 | `api/diagnostic/inspect-vault-save.js` | P, C, R | Recent Profile and vault-diagnostic projection. |
| 8 | `api/diagnostic/list-all-profiles.js` | P | Bulk Profile identity enumeration. |
| 9 | `api/diagnostic/list-recent-jobs.js` | P, C | Recent job/Profile enumeration. |
| 10 | `api/diagnostic/redis-vault-check.js` | P, R, M | Redis metadata projection plus write/delete/index mutation. |
| 11 | `api/diagnostic/retrieve-by-email.js` | P, C | Email-index lookup and full Profile/markdown projection. |
| 12 | `api/diagnostic/seed-selected-archetypes.js` | M | Bearer-protected synthetic Profile/index writes. |
| 13 | `api/diagnostic/test-vault-keys-endpoint.js` | P, R | Hard-coded Profile and Redis-key/index projection. |
| 14 | `api/diagnostic/test-vault-keys.js` | P, C, R | Module-load Redis scans and raw-value logging. |
| 15 | `api/get-raw-job.js` | P, C | Arbitrary complete job projection. |
| 16 | `api/moremindmap/start-test.js` | H | Static POST probe. |
| 17 | `api/moremindmap/start-test2.js` | H | Import/capability probe. |
| 18 | `api/moremindmap/start-test3.js` | H | Redis-helper import probe without an operation. |
| 19 | `api/moremindmap/start-test4.js` | H | UUID probe. |
| 20 | `api/moremindmap/start-test5.js` | H | UUID/Redis-helper capability probe without an operation. |
| 21 | `api/moremindmap/start-test6.js` | H | Async-generator import probe. |
| 22 | `api/ping-test.js` | H | Static timestamp probe. |
| 23 | `api/test-redis.js` | R, M | Anonymous Redis ping/set/get/delete and config-presence projection. |
| 24 | `api/test-update-job.js` | M | Anonymous job creation/update and persistent index/TTL state. |
| 25 | `api/test.js` | H, R | Import probe with full stack projection on failure. |

No route remained unknown after static source and deployed-function inventory reconciliation. Only `seed-selected-archetypes.js` contained an authentication guard; the other 24 did not.

## Adjacent non-production surface

The repair also quarantines five adjacent deployable non-production handlers that meet the same boundary:

- `api/moremindmap/inspect-job.js`
- `api/moremindmap/mini-profile-v2.js`
- `api/moremindmap/ping.js`
- `api/engine/testMiniProfileGenerator.js`
- `api/engine/testScore.js`

All 30 files retain their bytes and history under `quarantined-api-source/`, outside the deployable `api/` tree. Legitimate internal diagnostic and vault libraries remain in place.

## Narrow source hardening

- `saveCanonicalProfile.js` no longer logs or returns Redis connection material.
- The retained Product Profile retrieval handler no longer returns storage-key attempts, stack fragments, or raw error messages and no longer logs Profile storage keys.
- The retained Product job-status projection no longer returns internal diagnostics, canonical diagnostics, storage keys, company metadata, or raw failure text.
- New BOS operator-only diagnostic/repair capability no longer trusts the attacker-controlled HTTP `Host` header as platform authority. A constant-time, server-bound authority secret is now required; absence fails closed.
- Two tracked historical evidence copies of the live Redis credential were replaced in the candidate tree with the marker `[REDACTED_ROTATED_REDIS_CREDENTIAL]`; Git history is preserved.

## Credential decision

Actual reusable Redis credential exposure is proven from deployed source, not inferred. The anonymous `get-vault-profile` handler returned the complete `REDIS_URL` even for a valid-format nonexistent Profile ID, and the active vault library logged the same material. Retained runtime-log metadata also proves Redis-URL-bearing messages occurred; values were not copied into this evidence.

Required response: rotate only the implicated Redis credential through the existing Vercel-managed integration after the repaired surface is live, then redeploy the exact source-identical repair so the new binding is materialized. No other provider credential is implicated by the exact route inventory.

## Acceptance boundary

This repair contains the non-production diagnostic/test/raw/debug incident. It does not claim that the separate, intentional Product retrieval authorization model is already repaired. `api/moremindmap/retrieve-profile.js` and `api/business-assessment/retrieve.js` remain ID-based Product routes until the separately authorized public Profile ownership gate is implemented. Final V2.1 readiness must not be declared before that gate is green.

## Candidate verification ledger

| Gate | State | Receipt |
|---|---|---|
| Exact 25 + adjacent 5 absent from deployable source | PASS | `test/p0DiagnosticContainment.test.js` |
| Quarantine not imported by deployable source | PASS | focused static regression |
| Redis connection material absent from active vault source | PASS | focused static regression |
| Tracked non-test source free of authenticated Redis URI | PASS | focused static regression |
| Host spoof cannot grant New BOS operator authority | PASS | focused runtime regression |
| Product Profile storage/raw-error debug removed | PASS | focused static regression |
| Product job-status internal diagnostics/raw failures removed | PASS | focused runtime regression |
| Canonical protected Product regression matrix | PASS | 129/129 on exact repair tree |
| Supplemental Leadership/Recruiting/Subscription matrix | PASS | 151/151 on exact repair tree |
| Candidate-owned scoped lint | PASS | zero findings across eight changed active JS/test files |
| Production build | PASS | Vite 8.0.3, 188 modules; inherited large-chunk warning only |
| Diff and syntax checks | PASS | working-tree and index whitespace checks; Node test imports executed |
| Unaliased deployment manifest contains none of the 30 paths | PENDING | Prove from Vercel metadata |
| All 30 unaliased routes return minimal 404 | PENDING | Request without IDs or bodies only |
| Pre-rotation live containment | PENDING | Promote only after canary green |
| Redis credential rotated in place | PENDING | Write-only provider control; never record value |
| Source-identical post-rotation deployment | PENDING | Verify source/tree identity |
| Canonical tag, Ship's Log, and sealed evidence | PENDING | Complete only after live green |

## Rollback and sequencing

1. Re-resolve exact Production immediately before each deployment or promotion.
2. Deploy this repair commit to an unaliased Preview deployment.
3. Prove the deployment manifest and all retired 404s without Profile IDs or request bodies.
4. Promote only this narrow repair; preserve `dpl_DEkqERow5keMcirKiLiGEQKqTiVS` as the immediate pre-repair rollback.
5. Rotate only the Vercel-managed Redis credential, then redeploy the exact same repair source.
6. Verify non-mutating Product health and synthetic-only protected paths.
7. Canonicalize exact source/tree/deployment, tag it, update the Ship's Log, and seal final evidence.
8. Reconcile the exact reviewed 77-path Public Site V2.1 set onto that new canonical HEAD; never import the 130 evidence-only paths.
