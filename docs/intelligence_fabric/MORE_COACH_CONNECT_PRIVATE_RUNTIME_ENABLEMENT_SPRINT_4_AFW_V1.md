# MORE Coach Connect Private Runtime Enablement — Sprint 4 AFW V1

Sprint: `4 — Subscription Runtime Attachment`

Implementation authorized: `false`

Deployment authorized: `false`

## 1. Purpose

Prepare exact-scope composition of the existing Subscription Runtime behind the
authenticated subject/session and temporary `SUBDEV1` entitlement. Preserve
all existing activation, authorization, confirmation, idempotency, and
canonical-write gates.

Sprint verdicts:

- `PRIVATE_RUNTIME_SPRINT_4_SUBSCRIPTION_ATTACHMENT_COMPLETE`
- `PRIVATE_RUNTIME_SPRINT_4_BLOCKED`

## 2. Dependencies and repository grounding

Requires Sprints 1–3 complete. Reuses:

- existing `createSubscriberRuntimeService` command/query contract;
- existing default-off runtime flags;
- existing temporary entitlement translation;
- the Sprint 3 canonical Business Engine attachment.

Subscription Runtime semantics are protected and unchanged.

## 3. Exact allowed files

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/composition.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/attachments.js
api/internal/subscription-entitlement.js
api/internal/private-runtime-bootstrap.js
src/components/businessAssessment/PrivateRuntimeAttachmentHost.jsx
test/intelligenceFabric.coachConnect.privateRuntime.subscription.test.js
lab_outputs/coach_connect_private_runtime_enablement_v1/sprint_4/**
```

## 4. Exact prohibited files and actions

Prohibited:

- every file outside Section 3;
- `src/lib/intelligenceFabric/production/**`;
- Business Engine and Coach Connect product source;
- Stripe/checkout/billing files;
- public routes/registration/onboarding;
- production/customer-data adapters or namespaces;
- live store/provider/model, environment, migration, transcript, deployment,
  staging, or commit.

## 5. Contracts

- `subscription-runtime-attachment-v1`;
- exact command/query envelope derived server-side;
- existing `temporary_internal_subscription_entitlement`;
- allowlisted reads/interactions from Part 2;
- bootstrap response containing attachment receipts, never authority material;
- isolated injected test-state adapter description with
  `production_namespace=false`, `customer_data=false`, `migration=false`.

## 6. State machine

```text
BUSINESS_ENGINE_ATTACHED
-> VALIDATING_TEMPORARY_ENTITLEMENT
-> VALIDATING_SUBSCRIPTION_SCOPE
-> CREATING_EXISTING_RUNTIME_HANDLE
-> SUBSCRIPTION_ATTACHED

Failure -> DISCARD_RUNTIME_HANDLE -> BUSINESS_ENGINE_ATTACHED_READ_ONLY
```

No failure creates paid access or an alternate runtime.

## 7. Implementation sequence

1. Verify predecessor attachment and subject/session/capability receipts.
2. Bind subscription entitlement validation to the current session/epoch.
3. Construct existing runtime envelopes from exact canonical scope.
4. Inject existing runtime service; do not copy its command/query logic.
5. Apply exact private action allowlist.
6. Define default-off bootstrap handler and receipt-only client host.
7. Prove isolated synthetic test state and zero production namespace access.
8. Emit Sprint 4 evidence.

## 8. Required tests

- default flags and emergency disable deny;
- current exact subject/session/entitlement required;
- expired/revoked/cross-browser/cross-scope capability denies;
- Business Engine and subscription scope/hash agree;
- approved queries and session interactions use existing service;
- unknown/unallowlisted actions deny;
- confirmed evidence still requires existing confirmation state;
- repeat idempotency key with same semantics replays safely;
- conflicting replay denies;
- paid entitlement, Stripe, checkout, production persistence, migration, and
  live model calls remain zero;
- bootstrap exposes no tokens, code, PII, or product private content.

## 9. Evidence

```text
subscription_attachment_contract.json
temporary_entitlement_binding_proof.json
subscription_action_allowlist_proof.json
isolated_test_state_proof.json
no_paid_entitlement_stripe_proof.json
```

Plus standard sprint-local evidence.

## 10. Sprint-local validation

- focused subscription tests and existing entitlement regressions pass;
- existing Subscription Runtime tests pass unchanged;
- exact allowlist/protected-root/import/export checks pass;
- external call capture is all zero;
- evidence, secret, and sensitive-content scans pass;
- no deployment, provider, persistence activation, staging, or commit.

## 11. Bounded repair

At most two Section 3-only repairs. No repair may modify Subscription Runtime
semantics, activate writes/providers, weaken entitlement/session binding, or
invent a paid/parallel subscription path.

## 12. Stop conditions

Stop if:

- existing Subscription Runtime cannot be composed by injection;
- a production/customer namespace or migration is required;
- Stripe/paid entitlement is required;
- canonical mutation bypass is required;
- a protected Subscription Runtime or Business Engine file must change;
- a new product experience rather than an attachment host is required.

## 13. Expected outputs

- composition and subscription attachment logic;
- narrow entitlement/bootstrap/host integration;
- one focused test;
- indexed Sprint 4 evidence and verdict.

## 14. No-deployment statement

Sprint 4 performs offline injected proof only; it does not activate a runtime,
provider, store, or deployment.
