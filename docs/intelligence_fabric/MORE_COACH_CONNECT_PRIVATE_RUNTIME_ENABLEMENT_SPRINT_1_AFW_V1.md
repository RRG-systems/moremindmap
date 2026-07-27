# MORE Coach Connect Private Runtime Enablement — Sprint 1 AFW V1

Sprint: `1 — Canonical Subject Resolution`

Implementation authorized: `false`

Deployment authorized: `false`

## 1. Purpose

Prepare a deterministic provider-neutral bridge from a verified subscriber
assertion to exactly one active canonical subject and exact four-key scope.
Prove atomic uniqueness, idempotency, recovery/versioning, auditability, and no
auto-enrollment.

Sprint verdicts:

- `PRIVATE_RUNTIME_SPRINT_1_SUBJECT_RESOLUTION_COMPLETE`
- `PRIVATE_RUNTIME_SPRINT_1_BLOCKED`

## 2. Dependencies and repository grounding

Required inputs:

- Architecture Packet SHA
  `42291cdc467a7895b65f2e313d81751febf55ca7ab90bec6dce0a3d538401765`;
- Parts 1–3;
- existing canonical subject and verified assertion validators under protected
  `productionSecurity`;
- existing one-to-one registry behavior;
- baseline HEAD and dirty-worktree receipt.

This sprint consumes protected exports; it does not edit their semantics.

## 3. Exact allowed files

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/failureCodes.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/subjectRegistryPort.js
test/intelligenceFabric.coachConnect.privateRuntime.subject.test.js
lab_outputs/coach_connect_private_runtime_enablement_v1/sprint_1/**
```

No other file is writable in Sprint 1.

## 4. Exact prohibited files and actions

Prohibited:

- every file outside Section 3;
- all `productionSecurity/**`, Business Engine, Subscription Runtime, Coach
  Connect, BA/BOS/Five Futures/One Move/Profile ID sources;
- API/UI/route files;
- provider SDK/import/wiring, credentials, store connections, migrations;
- real identity records, founder data, customer data, Profile IDs, or
  `SUBDEV1` values;
- staging, commit, deployment.

## 5. Contracts

Implement offline contracts from Part 2:

- `private-runtime-verified-assertion-v1`;
- `private-runtime-tester-approval-v1`;
- canonical exact scope;
- canonical subject registry port;
- `private-runtime-subject-receipt-v1`;
- stable subject failure codes.

The registry port exposes exact atomic operations without selecting or
connecting a provider.

## 6. State machine

```text
UNMAPPED
  -> BINDING_AUTHORIZED
  -> ACTIVE
  -> RECOVERY_PENDING
  -> ACTIVE | DISABLED | DELETED

Any conflicting bind
  -> SUBJECT_MAPPING_AMBIGUOUS
  -> no state change
```

Repeat identical binding is `IDEMPOTENT_BINDING`.

## 7. Implementation sequence

1. Verify architecture hash, baseline, and exact allowlist.
2. Define strict validators and stable failure codes.
3. Define the provider-neutral registry port and capability description.
4. Implement an injected deterministic adapter only inside the test file or
   approved test harness; do not label it deployment-grade.
5. Implement binding/resolution receipts with hashed references.
6. Prove both uniqueness directions and recovery/version increments.
7. Run Sprint 1 validation and write content-free evidence.

## 8. Required tests

- valid assertion + active approval + exact scope binds;
- repeat binding is idempotent;
- one external subject to two scopes denies;
- two external subjects to one scope deny;
- wrong issuer/audience/status/version denies;
- disabled/recovery/deleted/stale subject denies;
- expired approval denies;
- email, name, URL, Profile ID, browser storage, and `SUBDEV1` cannot bind;
- unknown fields carrying token/cookie/credential/authority deny;
- receipts exclude PII, raw assertion, secrets, and product content;
- no provider/network/store action.

## 9. Evidence

Required Sprint 1 additions:

```text
subject_contract_manifest.json
subject_uniqueness_proof.json
subject_recovery_proof.json
subject_receipt_privacy_proof.json
```

Plus every Part 2 Section 23 sprint-local file.

## 10. Sprint-local validation

- focused subject tests pass;
- source exports import;
- contract versions exact;
- architecture and protected-root hashes unchanged;
- changed paths equal Section 3 subset;
- default-off/no-network scan passes;
- JSON evidence parses and hashes verify;
- secret/sensitive-content scan passes;
- no staging, commit, or deployment.

## 11. Bounded repair

At most two cycles. Repairs may touch only Section 3 files and must not weaken
uniqueness, validation, or privacy. Each repair emits a receipt. A third failure
returns `PRIVATE_RUNTIME_SPRINT_1_BLOCKED`.

## 12. Stop conditions

Stop if:

- mapping requires email/name/Profile-ID inference or self-enrollment;
- one-to-one atomicity cannot be expressed provider-neutrally;
- a protected security contract must change;
- a live provider/store/credential is required;
- real identity or customer data is required;
- any non-allowlisted file must change.

## 13. Expected outputs

- three source contract/port files;
- one focused test file;
- indexed Sprint 1 evidence;
- verdict receipt.

## 14. No-deployment statement

Sprint 1 performs no provider inspection, store connection, deployment, or
activation.
