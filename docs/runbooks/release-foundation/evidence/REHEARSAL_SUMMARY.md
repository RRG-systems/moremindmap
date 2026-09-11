# Reusable release setup rehearsal summary

Verdict: `HOME_BASE_REUSABLE_RELEASE_SETUP_REHEARSALS_GREEN`

These are two consecutive, non-mutating replays of already sealed private
rehearsals. They exercise the maintained acceptance/state/rollback procedure
without repeating model calls, email sends, state writes, deployments or alias
movement. The saved underlying runtime/browser/provider evidence remains the
authority for the Product behavior; these receipts prove that the reusable
release procedure can consume it consistently and fail closed.

## Shared setup

- Tool version: `home-base-release-foundation-v1`
- Tool SHA-256: `f09dc05458a102817381edc5be642fe031b00ac697bdb163ea0131c905e043e7`
- Environment definition SHA-256: `6a421aed421d5505ba23b6483859523017d8bccd236c4cf884ea0bc65abcb559`
- Private environment: `subscription-canary` / `env_M70a2uAYcMBZ9m6afKtSvBFaHGwv`
- Provider assignments hidden; secret values read: zero.
- External, Production and customer mutations: zero.

## Deliberate failing gate

- Run: `51df8a7e-e502-4969-9d21-534de766ca08`
- A single change-specific manager-two-box gate was intentionally marked failed.
- Result: `PROMOTION_BLOCKED` in 3 ms.
- Activation attempted: false. The fixed diagnostic contained only phase, code,
  field and a null HTTP status; it included no body or secret value.

## Rehearsal 1 — Subscription continuity Release 4

- Run: `063cdb4f-727f-4d85-974c-096756849d43`
- Plan SHA-256: `8a0a0a4bdf1b21a563586a421c1d1d89bbfb1737c67599afacbabf116e2cb293`
- Exact saved private candidate: `dpl_CLbo4VwR7Nh7ttLhanS98aXB1QCr`, source/tree
  `87a4a1e9fd0b7a32bdc244edc44ce1b11be574cf` /
  `fd209e905836fef6fe09e3605380c95f77383355`.
- The process stopped after validation, then a new process resumed from the same
  durable plan/environment/tool digests. Total observed time: 4,796 ms.
- Fourteen core and three change-specific checks passed.
- The declared compatible private rollback ran in verify-target → switch →
  verify order.
- A third invocation returned the same green run id as an idempotent completed
  resume; it did not repeat provider work.
- Manual steps recorded by the plan: 2.

## Rehearsal 2 — Recruiting two-box + Consulting Release 5

- Run: `da90d1db-1321-4952-b3bf-63930e2d5a42`
- Plan SHA-256: `027fd559813461ed3553a19fbecfa6b6d3a56401c22902acced8c36409a01b1d`
- Exact saved private candidate: `dpl_3EYk1UKzmGbTDWMUBBtDUyX3sfkY`, source/tree
  `8afa8d4a6c8bf222c8fc41c566a1492f4b1207d6` /
  `a2d975d526f6f6e124e9fe2af6e1bb05ed9b3c57`.
- Observed runner time: 3 ms.
- Fourteen core and four change-specific checks passed.
- The incompatible lease-to-legacy rollback correctly refused a direct switch
  and ran quarantine → 800-second declared drain → switch → verify in the
  private rehearsal ledger.
- Manual steps recorded by the plan: 2.

## Browser setup proof

The installed Google Chrome binary launched a local data URL and closed through
its browser control endpoint. Result: `BROWSER_LAUNCH_AND_CLOSE_GREEN`; observed
duration 1,054 ms; external navigation false. Browser stderr was counted but not
persisted.

## Remaining limits

- These release-foundation runs replay sealed evidence and do not claim fresh
  provider, delivery or customer-journey proof.
- The Custom Environment currently matches the Release 5 branch. Each future
  candidate must prove its required isolated-store/provider bindings materialize
  for that exact branch before stateful work; missing bindings fail closed.
- Environment metadata proves record identity/scope, not secret values or a
  provider's test/live mode.
- Public Production was not moved or changed to prove this setup.

## Final proportional validation

- Release-foundation contract/state/privacy tests: **13/13 PASS**.
- Protected Product smoke set: **42/42 PASS** across P0 quarantine,
  Leadership, public provider gates, Athlete Consulting and Subscription
  continuity.
- Full Product build, exact scoped lint, five maintained-script syntax checks,
  diff check and secret-pattern scan: PASS.
- Final read-only Production resolution remained READY on
  `dpl_F81jd5AsvoSN5jmqfSBGezX5pgi4`.
