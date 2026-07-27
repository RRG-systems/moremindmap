# MORE Private Runtime Async Security and Entitlement Bootstrap — Sprint 5 AFW V1

Sprint:
`5 — Session, Revocation, and Recovery`

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_V1`

Architecture SHA-256:
`8c117ab7e40fde69536d67d43558e69dfa3d078f10eaeb0ff88105cfa9117046`

Implementation authorized by this AFW expansion: `false`

Deployment authorized: `false`

## 1. Sprint purpose

Complete the Promise-native session lifecycle, entitlement expiry and
revocation, atomic logout, security epochs, outage denial, emergency disable,
and synthetic restart recovery without claiming provider durability.

## 2. Dependencies

- Sprints 1–4 `COMPLETE` with receipts and hashes;
- V2 port, canonical service, facade, subject, eligibility, and entitlement
  contracts;
- existing protected session semantics as read-only grounding;
- Parts 1–3.

## 3. Exact allowlist

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/canonicalAsyncSecurityService.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.recovery.test.js
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/sprint_receipt.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/changed_files.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/contract_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/focused_tests.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/race_failure_tests.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/protected_root_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/zero_provider_call_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/secret_scan.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/session_revocation_recovery_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/emergency_disable_outage_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/repair_receipt_1.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/repair_receipt_2.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_5/change_receipt.json
```

## 4. Prohibited files and actions

- every path outside Section 3;
- existing session elevation, shared-state, handler, Business Engine,
  Subscription Runtime, Coach Connect, provider, deployment, Stripe, public
  UI, package, environment, and migration files;
- local revocation queues or persistence;
- provider access, staging, commit, push, or deployment.

## 5. Contracts and schemas

Complete canonical service methods:

```text
beginPreAuth
completeAuthentication
resolveAuthenticatedContext
inspectTemporaryEntitlement
revokeTemporaryEntitlement
logout
inspectRecovery
```

Use atomic commands:

```text
BEGIN_PRE_AUTH
ELEVATE_AUTHENTICATED_SESSION
REVOKE_TEMPORARY_ENTITLEMENT
REVOKE_RUNTIME_ACCESS
ADVANCE_SECURITY_EPOCH
```

Use active, rotated, expired, revoked, and emergency-revoked terminal states
from Part 2.

## 6. Implementation sequence

1. Verify predecessor receipts, hashes, status, and protected baseline.
2. Implement pre-auth creation and atomic authenticated rotation.
3. Invalidate prior CSRF and entitlement during rotation.
4. Enforce earliest-bound session and entitlement expiry.
5. Implement entitlement revocation and healthy-state atomic logout.
6. Implement outage logout with cookie clearing and
   `LOGOUT_REVOCATION_UNCONFIRMED`.
7. Implement epoch-based emergency disable.
8. Implement recovery inspection from one authoritative snapshot.
9. Prove two service instances reconstruct decisions from the same injected
   synthetic shared-state model while retaining synthetic evidence class.
10. Run sprint gates and emit evidence.

## 7. Focused tests

- pre-auth rotates to one authenticated session;
- old session, CSRF, and entitlement deny after rotation;
- expiry uses authoritative server time;
- explicit revocation invalidates subsequent use;
- healthy logout atomically revokes session and entitlement and advances epoch;
- outage logout clears client authority but does not claim server revocation;
- emergency disable denies login, continuation, entitlement, and runtime;
- stale epoch denies;
- fresh service instance rebuilds the same synthetic authority decision from
  shared injected state;
- process-local-only state is never treated as deployment recovery.

## 8. Race and failure tests

- two concurrent callback rotations yield one active session;
- rotation racing entitlement issuance denies stale issue;
- logout racing runtime authority leaves no surviving allow;
- epoch advance racing snapshot denies stale action;
- repeated logout is safe and idempotent;
- timeout, rejection, invalid time, malformed state, degradation, outage,
  partition, and recovery all deny;
- revocation audit failure prevents success claim;
- no local fallback or queued mutation occurs.

## 9. Sprint-local validation

- Sprint 5 focused test passes;
- Sprints 1–4 focused tests rerun;
- existing session elevation, private-runtime security, and recovery
  regressions pass;
- lifecycle state coverage is complete;
- synthetic recovery evidence is not labeled deployment-grade;
- exact allowlist, schemas, imports, cycles, scans, and evidence pass;
- Git index remains empty and HEAD unchanged.

## 10. Protected-root comparison

Compare every Part 1 protected root. Existing
`productionSecurity/sessionElevation.js` and all product runtime sources are
consumed unchanged.

## 11. Zero-provider-call proof

Record zero Auth0, Redis, Upstash, database, Vercel, persistence, model, media,
voice, Luna, transcript, Stripe, and deployment calls. Synthetic restart tests
perform no filesystem or network persistence.

## 12. Bounded repair

At most two Section 3-only repairs. Repairs cannot claim false durability,
acknowledge unconfirmed revocation, weaken epoch dominance, or add local
fallback.

## 13. Stop conditions

Stop if:

- logout cannot remain honest during outage;
- restart requires local or provider persistence;
- emergency disable does not dominate;
- rotation leaves prior authority active;
- a protected or non-allowlisted file must change;
- the second repair fails.

## 14. Evidence outputs

Create only Section 3 evidence. Recovery receipts must say `SYNTHETIC` and
`deployment_grade=false`.

## 15. Final sprint verdict options

- `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_5_COMPLETE`
- `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_5_BLOCKED`

## 16. No-deployment and no-provider statement

Sprint 5 proves lifecycle semantics offline under later authority. It does not
activate durable storage, connect a provider, access credentials, deploy,
stage, commit, or push.
