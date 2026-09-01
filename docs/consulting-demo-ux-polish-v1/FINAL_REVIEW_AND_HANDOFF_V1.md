# DarrenDemo Consulting Demonstration UX Polish V1

## Verdict

`DARRENDEMO_CONSULTING_UX_POLISH_V1_GREEN_READY_FOR_HOME_BASE_PRODUCTION_AIRLOCK`

The bounded candidate is locally green. It has not been deployed or promoted.

## Authority and custody

- Canonical Production source: `847dd578a1e6f614abe074635879b3de86cb16e5`
- Canonical Production tree: `264ce971e6859fb0f76ddb323f27dbfb69db3971`
- Live Production deployment: `dpl_4hY8LR9sbxXuHwZ8ph4yCxz23seC`
- Rollback source: `b8d084bbb299078a9191323abf2ff643ba3c1a25`
- Rollback deployment: `dpl_762248GWfQrpGJVJXmw4iVDstV8E`
- Isolated branch: `codex/consulting-demo-ux-polish-v1`

Home Base and all unrelated specialist worktrees were left untouched.

## Root causes and smallest repairs

### 1. Product switching

The DarrenDemo launcher capability remains valid for its governed lifetime, but each product launch correctly consumes a one-time CSRF. Browser back/forward cache could restore the launcher React tree with the already-consumed token, so the next product exchange failed with no need to reauthenticate the underlying launcher capability.

The repair refreshes only the launcher CSRF after a persisted browser restoration and after a failed exchange. It clears a token before sending it, prevents duplicate reuse, and leaves the launcher capability, same-origin check, product-cookie exchange, entitlement, and real-product authorization unchanged.

### 2. Reset Demo

The runtime already had a subject-scoped `RESET_SYNTHETIC_DEMO` operation that deletes only demo relationship sessions and returns explicit `external_mutation: false` and `canonical_mutation: false` receipts. The customer-facing control was missing.

The repair mounts `Reset Demo` directly after `SYNTHETIC | PATRICIA`, calls the existing bounded reset, validates its receipt, clears only Consulting demo presentation/session state, and returns to HOME. Synthetic and Patricia sessions are proven independent. Patricia's authored BOS and BA remain read-only and untouched. A code-level warning states that this control must never mount in a future live Consulting customer product.

### 3. iPad Five Futures collision

Standalone New BA already owned the correct selected-card container-query behavior. The Consulting embed rendered `BusinessTwinApp` without the wrapper and stylesheet that activate those rules. At the reproduced 203.359 px selected-card header width, the title's rendered width collapsed to zero.

The repair reuses the existing proven New BA responsive contract by adding its exact wrapper around the embedded Business Twin. No Futures data, support values, order, wording, confidence, WBM, projection, or customer truth changed.

## Acceptance evidence

- Product-switch sequence completed without launcher reauthentication.
- Reset Demo is visible, subject-scoped, returns HOME, and restores a fresh synthetic session.
- Patricia BOS and Business Twin rendered from the current read-only Production authority; deterministic reset proof shows Patricia session deletion cannot touch canonical authority.
- Five Futures selected-card title/support/confidence do not overlap at desktop, iPad landscape, iPad portrait, or narrow split width.
- Document horizontal overflow is absent at all tested widths.
- No provider calls, customer writes, canonical writes, emails, Redis mutations, Stripe/billing actions, fulfillment, deployments, or domain changes occurred.
- Focused tests: 18/18 PASS.
- Protected tests: 65/65 PASS.
- Repository Node comparison: three new passing tests and zero new failures; the unchanged 20-test Coach Connect baseline remains outside scope.
- Scoped lint: PASS.
- Production build: PASS.
- Diff check and privacy/secret scan: PASS.

## Production airlock recommendation

Promote only the five source/test files in `SOURCE_CHANGE_MANIFEST_V1.json` from this bounded checkpoint onto the then-current canonical Production source. Re-run the exact launcher switching journey, Patricia read-only reset, synthetic reset, Subscription destination, and literal Five Futures width matrix against the protected candidate before Production promotion.

Do not replay local QA configuration, generated caches, benchmark outputs, or any unrelated worktree content.
