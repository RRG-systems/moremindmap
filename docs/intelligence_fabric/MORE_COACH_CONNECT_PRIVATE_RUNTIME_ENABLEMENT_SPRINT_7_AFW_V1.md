# MORE Coach Connect Private Runtime Enablement — Sprint 7 AFW V1

Sprint: `7 — Cross-System Integration`

Implementation authorized: `false`

Deployment authorized: `false`

## 1. Purpose

Integrate all bridge contracts and prove one synthetic approved-founder path
through canonical subject, session, `SUBDEV1`, one Business Engine, existing
Subscription Runtime, existing Coach Connect, governed interaction, restart,
logout, revocation, and emergency disable. Produce the campaign verdict and
implementation-review evidence package under later authority.

Sprint verdicts:

- `PRIVATE_RUNTIME_SPRINT_7_INTEGRATION_COMPLETE`
- `PRIVATE_RUNTIME_SPRINT_7_BLOCKED`

## 2. Dependencies and repository grounding

Requires Sprints 1–6 `COMPLETE`, all receipts/hashes, all focused suites, and
the validated runbooks. The Architecture Packet and Parts 1–3 remain
authoritative.

## 3. Exact allowed files

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js
src/components/businessAssessment/PrivateRuntimeAttachmentHost.jsx
src/components/businessAssessment/DeveloperAccessPanel.jsx
src/BusinessAssessmentVisualMap.jsx
test/intelligenceFabric.coachConnect.privateRuntime.integration.test.js
scripts/verifyCoachConnectPrivateRuntimeEnablement.mjs
lab_outputs/coach_connect_private_runtime_enablement_v1/**
```

Changes to the two existing UI files are limited to the existing
`onUnlocked` callback and adjacent receipt-driven host composition.

## 4. Exact prohibited files and actions

Prohibited:

- all paths outside Section 3;
- Business Engine contract/projection/renderer/scoring changes;
- Subscription Runtime or Coach Connect semantic changes;
- new product/dashboard/registration/checkout behavior;
- provider/store/persistence/transcript/Stripe/deployment/environment action;
- staging, commit, push.

## 5. Contracts

- public bridge exports from the reviewed privateRuntime namespace;
- exact combined attachment set;
- integration interaction, restart, logout, revocation, emergency receipts;
- final test/evidence manifests;
- final implementation verdict contract;
- UI host accepts receipts/projections only and contains no authority.

## 6. Integration state machine

```text
APPROVED_SYNTHETIC_TESTER
-> VERIFIED_ASSERTION
-> CANONICAL_SUBJECT
-> AUTHENTICATED_SESSION
-> SUBDEV1_ENTITLEMENT
-> BUSINESS_ENGINE_ATTACHED
-> SUBSCRIPTION_ATTACHED
-> COACH_CONNECT_ATTACHED
-> GOVERNED_INTERACTION
-> RESTART_RECOVERED
-> LOGGED_OUT_OR_EMERGENCY_DISABLED
```

Any failure returns to a detached, denied state with the canonical engine
unchanged.

## 7. Implementation sequence

1. Verify all sprint receipts, hashes, repairs, and exact scope bindings.
2. Export reviewed bridge contracts only.
3. Wire the existing `onUnlocked` callback to the receipt-driven attachment
   host without changing Business Engine rendering or product semantics.
4. Run the synthetic end-to-end flow and all negative variants.
5. Run all focused and regression suites, build, lint, imports, cycles, scans,
   and protected-root comparisons.
6. Build and validate the indexed implementation-review evidence only under a
   later implementation mission.
7. Issue one final implementation verdict.

## 8. Required tests

- complete founder-path synthetic E2E;
- all three identity layers required;
- one canonical subject and exact scope;
- one canonical Business Engine across all runtimes;
- no duplicate runtime/service;
- allowed subscription interaction succeeds through existing service;
- allowed Coach Connect projection/structured flow succeeds only when existing
  gates pass;
- restart/revocation/logout/emergency paths;
- every unapproved subject/scope/action denies;
- UI callback cannot grant authority;
- no public registration/Stripe/provider/persistence/transcript/migration/
  deletion/canonical bypass;
- all Part 3 adversarial cases and regressions.

## 9. Evidence

```text
cross_system_integration_proof.json
one_subject_one_engine_proof.json
no_duplicate_runtime_proof.json
ui_authority_separation_proof.json
campaign_regression_results.json
changed_files_inventory.json
test_manifest.json
evidence_manifest.json
executive_handoff.md
ai_handoff.json
final_verdict.json
```

## 10. Sprint-local and campaign-wide validation

- Sprints 1–6 complete;
- all focused and required regression suites pass;
- deterministic build/focused lint/import/export/cycles pass;
- exact allowlist and protected-root comparison pass;
- all zero external-call proofs pass;
- evidence and archive validation pass;
- no unrelated files, secrets, runtime/provider/customer data;
- no deployment, provider wiring, persistence activation, Stripe, staging, or
  commit.

## 11. Bounded repair

At most two Section 3-only repairs. Repairs cannot change prior contracts,
weaken regressions, edit protected product semantics, or convert synthetic
proof into a live claim.

## 12. Stop conditions

Stop if:

- any predecessor sprint is incomplete;
- cross-receipt scope/authority/version differs;
- one subject/one Business Engine/no-duplicate-runtime proof fails;
- a protected root or product semantic change is needed;
- any external call is nonzero;
- implementation no longer fits the Architecture Packet;
- evidence cannot support an honest default-off verdict.

## 13. Expected outputs

- final bridge exports and narrow receipt-driven UI composition;
- integration test;
- complete indexed evidence;
- final implementation verdict and review archive under separate authority.

## 14. No-deployment statement

Sprint 7 proves offline composition only. It does not deploy, activate, inspect
providers, stage, or commit.
