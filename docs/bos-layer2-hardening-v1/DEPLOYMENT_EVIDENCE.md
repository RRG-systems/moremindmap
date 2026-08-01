# Deployment Evidence

## Release identity

- Hardening commit: `666c4b461d5b8dc83ad9c69154c49cd303ce0be4`
- Focused branch: `bos-layer2-hardening-v1`
- Production branch: `main`
- Deployment mechanism: fast-forward GitHub push to the connected Vercel production project
- Deployment ID: `dpl_P1uWWkqvS9pnr4EvoeXiZqu6jkfL`
- Production URL: `https://moremindmap.com`
- Immutable deployment URL: `https://moremindmap-721d71xqz-rrg-systems-projects.vercel.app`
- Production asset: `https://moremindmap.com/assets/index-vgZvR6d3.js`
- Deployment state: `READY`
- Deployment ready substate: `PROMOTED`
- Verified at: `2026-08-01T16:05:48Z`

Vercel metadata reports Git source `main` and commit SHA exactly matching the hardening commit.

## Read-only production smoke

- production root: HTTP 200;
- `/api/moremindmap/ping`: HTTP 200;
- synthetic-format profile route: HTTP 200;
- retrieval without a profile ID: HTTP 400 before any profile lookup;
- immutable deployment root: HTTP 200; and
- active production bundle: HTTP 200, 1,734,489 bytes.

The deployed bundle contains:

- `bos_truthfulness_v1`;
- `truthfulness_fail_closed`;
- `Insufficient Evidence`;
- cache memory-invariant invalidation; and
- cache storage-invariant invalidation.

The completeness classifier and topology repair are server-side modules, so their literal strings are not expected in the browser bundle. The exact deployed commit was verified to contain:

- question-metadata completeness classification in the start route;
- shared profile-input completeness in canonical diagnostics;
- count-derived diagnostic quality instead of hardcoded 100;
- `topologyThreshold(12.0)` for emotional smoothing; and
- schema-safe fail-closed narrative construction.

## Exact-commit synthetic proof

On the exact deployed source commit:

- fresh and cache-hit narratives both used `bos_truthfulness_v1`;
- cache schema 9 and a 24-hour TTL ceiling were active;
- complete intake retained 28 valid answers;
- 27 answers classified as partial with quality 96;
- null canonical input returned `truthfulness_fail_closed`;
- canonical output contained no Layer 2 or completeness extension;
- customer projection produced 8 tabs and 5 overview sections; and
- executive summary and One Move remained populated.

## Safety and scope

No customer profile was read, changed, or regenerated. No Redis or Vault read/write was used for the smoke proof. No environment variable or deployment configuration changed. No Coach Connect, subscription, Business Assessment, Business Engine, Executive Diagnostic, Five Futures, or One Move file changed.

## Limits

- Whole-repository lint remains nonzero due to pre-existing debt: 538 findings after hardening versus 546 on clean `origin/main`. Focused new/clean files pass, and no new lint finding was introduced.
- Production route verification was synthetic and read-only; no customer-specific profile was opened because this campaign did not authorize customer-data inspection or mutation.
- Scientific validation remains separate future work and is not an engineering hardening defect.

## Verdict

`BOS_LAYER2_HARDENING_COMPLETE_WITH_LIMITS`
