# MORE Coach Connect Private Runtime Enablement — Sprint 6 AFW V1

Sprint: `6 — Runtime Validation`

Implementation authorized: `false`

Deployment authorized: `false`

## 1. Purpose

Validate the complete private-runtime lifecycle and failure matrix: login,
session elevation, `SUBDEV1`, attachment, interaction, expiry, logout,
revocation, restart, recovery, partial-attachment rollback, emergency disable,
privacy-safe evidence, and zero external calls.

Sprint verdicts:

- `PRIVATE_RUNTIME_SPRINT_6_VALIDATION_COMPLETE`
- `PRIVATE_RUNTIME_SPRINT_6_BLOCKED`

## 2. Dependencies and repository grounding

Requires Sprints 1–5 complete. Uses all bridge contracts plus existing
security, Subscription Runtime, Coach Connect, Business Engine, and entitlement
regressions as read-only truth.

## 3. Exact allowed files

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/evidence.js
scripts/verifyCoachConnectPrivateRuntimeEnablement.mjs
docs/runbooks/coach_connect/private_runtime_enablement/subject_enrollment.md
docs/runbooks/coach_connect/private_runtime_enablement/login_session.md
docs/runbooks/coach_connect/private_runtime_enablement/runtime_attach.md
docs/runbooks/coach_connect/private_runtime_enablement/restart_recovery.md
docs/runbooks/coach_connect/private_runtime_enablement/logout_revocation.md
docs/runbooks/coach_connect/private_runtime_enablement/emergency_disable.md
docs/runbooks/coach_connect/private_runtime_enablement/incident_response.md
docs/runbooks/coach_connect/private_runtime_enablement/post_enablement_validation.md
test/intelligenceFabric.coachConnect.privateRuntime.validation.test.js
lab_outputs/coach_connect_private_runtime_enablement_v1/sprint_6/**
```

## 4. Exact prohibited files and actions

Every path outside Section 3 is prohibited. No product/security/provider/
deployment/persistence/Stripe source, environment, credential, platform,
staging, or commit action is allowed.

## 5. Contracts

- evidence allowlist/redaction and manifest contract;
- stable failure code coverage;
- logout/revocation/restart/emergency receipts;
- external-call capture with every count zero;
- runbook schema and validation;
- repair receipt schema.

## 6. State machines

Validate:

- session lifecycle from Part 2 Section 12;
- attachment lifecycle from Part 2 Section 18;
- shared-state availability lifecycle;
- logout ordering;
- restart reattachment;
- emergency epoch invalidation.

No validator changes product state.

## 7. Implementation sequence

1. Verify Sprint 1–5 receipts and evidence hashes.
2. Implement strict evidence shaping and sensitive-field denial.
3. Implement validator for files, exports, defaults, versions, receipts,
   one-subject/one-engine invariants, zero-call counters, and runbooks.
4. Author eight offline runbooks.
5. Execute the Part 3 adversarial matrix through injected ports.
6. Prove restart, logout, revocation, emergency disable, and partial rollback.
7. Emit Sprint 6 evidence and repair receipts.

## 8. Required tests

- all 47 adversarial scenarios;
- entitlement cannot outlive approval/session;
- logout leaves no active capability/session/attachment;
- restart rebuilds only from authoritative injected state;
- stale cache/process handles deny;
- partial attachment never publishes;
- emergency disable dominates in-flight/new work;
- no duplicate canonical action on replay;
- client responses are non-enumerating;
- evidence rejects secret/PII/private-content canaries;
- runbooks contain required sections and no live commands;
- all external-call counters zero.

## 9. Evidence

```text
failure_matrix_results.json
session_lifecycle_proof.json
restart_recovery_proof.json
logout_revocation_proof.json
emergency_disable_proof.json
partial_attachment_rollback_proof.json
external_call_capture.json
runbook_validation.json
sensitive_canary_proof.json
```

Plus standard sprint-local evidence.

## 10. Sprint-local validation

- focused validation tests pass;
- validator returns valid with no failures;
- eight runbooks validate;
- all evidence JSON and hashes validate;
- secret/sensitive scan passes;
- exact allowlist/protected roots/import cycles pass;
- no source outside Section 3 changed;
- no provider/store/deployment/Stripe/staging/commit action.

## 11. Bounded repair

At most two Section 3-only repairs with receipts. No repair may remove an
adversarial scenario, suppress a failure, lower a zero counter, or weaken
evidence privacy.

## 12. Stop conditions

Stop if:

- any required failure does not fail closed;
- emergency disable or logout leaves authority active;
- restart needs local fallback;
- evidence cannot exclude sensitive material;
- monitoring/receipt truth cannot be established offline;
- a protected/non-allowlisted file or live action is required.

## 13. Expected outputs

- evidence shaper;
- validator;
- eight runbooks;
- focused validation tests;
- indexed Sprint 6 evidence and verdict.

## 14. No-deployment statement

Sprint 6 is fully offline and performs no platform, provider, store, or
deployment action.
