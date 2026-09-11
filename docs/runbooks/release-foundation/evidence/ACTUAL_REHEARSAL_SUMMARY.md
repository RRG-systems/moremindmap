# Actual private release rehearsal summary

Verdict: `HOME_BASE_REUSABLE_RELEASE_SETUP_ACTUAL_REHEARSALS_GREEN`

This record covers the real `subscription-canary` release mechanism. It is
separate from the earlier sealed-evidence replays in `REHEARSAL_SUMMARY.md`.
No Product campaign, model request, email, payment, customer mutation, stateful
runtime request, public alias write or Production operation was repeated.

## Fixed custody

- Custom Environment: `subscription-canary` /
  `env_M70a2uAYcMBZ9m6afKtSvBFaHGwv`.
- Private stable host:
  `moremindmap-env-subscription-canary-rrg-systems-projects.vercel.app`.
- Captured and restored private baseline:
  `dpl_3EYk1UKzmGbTDWMUBBtDUyX3sfkY`, source/tree
  `8afa8d4a6c8bf222c8fc41c566a1492f4b1207d6` /
  `a2d975d526f6f6e124e9fe2af6e1bb05ed9b3c57`.
- Public Production remained `dpl_F81jd5AsvoSN5jmqfSBGezX5pgi4` at the same
  source/tree throughout both cycles.
- Binding-metadata projection stayed
  `3fb9a182aef71d4c8664f0a5e69b1be3f11f2b2c8e19db8c0b8ad498f8d35d89`.
  The read was decrypt-disabled; provider assignments and values are absent.

## Intentional failed pre-deploy gate

- Run: `0d2a77c2-0ff2-4f01-bb2c-290d60bad643`.
- Candidate: Release 4 source/tree
  `87a4a1e9fd0b7a32bdc244edc44ce1b11be574cf` /
  `fd209e905836fef6fe09e3605380c95f77383355`.
- Verdict: `PROMOTION_BLOCKED`.
- Deployment command spawned: false; activation attempted: false; private alias
  mutations: zero; public/customer/provider/stateful mutations: zero.

## Actual rehearsal 1 — Subscription continuity Release 4

- Run: `082bc7b4-e8c9-4e9e-8dd1-b0a2620d76c8`.
- Fresh exact candidate: `dpl_3EgbzQ9pkAKBJby6qQgjpUi6Vnnr`.
- Observed duration: 131,425 ms.
- The candidate and rollback each passed six direct-deployment and six
  stable-host status-only checks: public root 200, Step 1 200, Leadership 200,
  allowed-origin catalog 200, hostile-origin catalog 403 and P0 diagnostic 404.
- Direct and stable SSO protection passed. The exact private baseline was
  restored and reverified. Public Production and all four public aliases were
  unchanged.

## Actual rehearsal 2 — Recruiting Release 5 with stop/restart

The first attempt is preserved as failed, not relabeled. Fresh deployment
`dpl_3qXpaQVA7SCQCVXAKGfsZiJPC3jK` was READY and exact but Vercel left it
unselected. The bounded wait ended with
`PRIVATE_STABLE_ALIAS_PROPAGATION_TIMEOUT`; the tool restored and verified the
exact private baseline and returned
`PROMOTION_BLOCKED_PRIVATE_BASELINE_RESTORED`.

The contained adapter correction permits one write target only: the exact
private stable host. It first verifies READY state, exact source/tree/run
metadata, custom-environment identity, SSO protection, all public aliases and
ownership of the current private target. Generic promote, Production deploy,
public alias write and project-wide rollback remain absent and refused.

- Corrected run: `ca7e2e95-84c5-4d88-9f86-c1d1f54ac9b0`.
- Fresh exact candidate: `dpl_Bawoh9N5b7jDEyHu53EcuaSbLGbi`, source/tree
  `8afa8d4a6c8bf222c8fc41c566a1492f4b1207d6` /
  `a2d975d526f6f6e124e9fe2af6e1bb05ed9b3c57`.
- Selection method: explicit allowlisted private alias after Vercel again left
  the exact READY custom-environment deployment unselected.
- Process one stopped after exact private selection and wrote a durable paused
  receipt. Process two resumed the same run and deployment, ignored the
  already-satisfied stop marker, re-resolved custody and completed.
- Observed duration: 164,319 ms; resume count: 1; restart recovery: proven.
- Candidate and rollback each passed the same twelve direct/stable checks as
  rehearsal 1. The exact private baseline was restored and reverified. Public
  Production and all four public aliases were unchanged.

## Actual rollback scope

These actual cycles issued only status-only, read-only runtime requests. Their
candidate-to-baseline switch was therefore a compatible private selection
between READY deployments and required no drain. This does not supersede any
Product release plan that declares stateful protocol incompatibility; such a
plan still requires its stated quarantine and drain procedure.

## Manual steps and hard limits

- A future release must supply exact clean candidate and rollback worktrees,
  branch/upstream/remote custody, commit/tree, canonical Production custody,
  sealed plan and evidence manifest, and fresh external state/receipt paths.
- The fixed pre-deploy gate runs before either deployment or private alias
  selection. A failed run remains durably latched and cannot be resumed into
  activation. Recovery refuses to overwrite a private alias owned by any other
  run.
- The Custom Environment remains Preview-only, domainless and SSO-protected.
  Branch-specific bindings must independently materialize for each future
  candidate before any stateful work.
- Environment metadata proves record identity and scope, not secret value,
  provider mode or provider behavior.
- The prior temporary Release 5 controller push rejection remains preserved and
  binding. No retry or alternate publication route occurred.
- Product/browser/provider acceptance remains the sealed evidence named in each
  plan. These actual cycles prove the reusable release mechanism; they do not
  claim new model quality, email delivery, payment or customer-journey proof.
