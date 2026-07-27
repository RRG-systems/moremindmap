# MORE Coach Connect Private Runtime Enablement — Sprint 2 AFW V1

Sprint: `2 — Deployment-Grade Security Runtime`

Implementation authorized: `false`

Deployment authorized: `false`

## 1. Purpose

Prepare the default-off composition root for canonical subject/session
resolution against the existing shared-security-state contract. Prove
deployment-grade capability checks, atomic session lifecycle, restart,
revocation, replay denial, epochs, and fail-closed outage behavior offline.

Sprint verdicts:

- `PRIVATE_RUNTIME_SPRINT_2_SECURITY_RUNTIME_COMPLETE`
- `PRIVATE_RUNTIME_SPRINT_2_BLOCKED`

## 2. Dependencies and repository grounding

Requires Sprint 1 `COMPLETE` receipt. Reuses protected shared-state methods,
subject binding, session elevation, request-integrity, developer capability,
and privacy-safe audit contracts.

Current in-memory state reports `deployment_grade=false`; the default exported
developer handler lacks a canonical context resolver. This sprint composes
existing contracts without changing them.

## 3. Exact allowed files

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/activation.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/authority.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/sessionResolver.js
api/internal/developer-access-security.js
api/internal/developer-access.js
api/internal/private-runtime-login.js
api/internal/private-runtime-callback.js
api/internal/private-runtime-session.js
api/internal/private-runtime-logout.js
test/intelligenceFabric.coachConnect.privateRuntime.security.test.js
lab_outputs/coach_connect_private_runtime_enablement_v1/sprint_2/**
```

## 4. Exact prohibited files and actions

Prohibited:

- every path outside Section 3;
- `productionSecurity/**` semantics;
- provider adapters/SDKs/configuration and Auth0/Redis/Upstash calls;
- environment/secret/package/CI files;
- Business Engine, product runtime, UI, Stripe, deployment files;
- in-memory state relabeled as deployment-grade;
- staging, commit, deployment.

## 5. Contracts

- Part 2 activation flags and evaluation precedence;
- existing shared-state method/capability contract;
- current canonical subject and session validation;
- `private-runtime-capability-v1`;
- `private-runtime-session-receipt-v1`;
- secure cookie contracts;
- default-off internal login/callback/session/logout handler boundaries.

Provider verification and shared state are injected ports. Default handlers
return governed unavailable/disabled responses without configured composition.

## 6. State machines

Session:

```text
NO_SESSION -> PRE_AUTH -> AUTHENTICATED_NO_ENTITLEMENT
-> PRIVATE_ENTITLED
-> EXPIRED | REVOKED | EMERGENCY_DISABLED | LOGGED_OUT
```

Shared state:

```text
UNCONFIGURED -> HEALTHY
HEALTHY -> DEGRADED | UNAVAILABLE | PARTITIONED
DEGRADED | UNAVAILABLE | PARTITIONED -> RECOVERING -> HEALTHY
```

Only `HEALTHY` permits new elevation.

## 7. Implementation sequence

1. Verify Sprint 1 receipts and exact allowlist.
2. Implement immutable default-off activation and dominant emergency disable.
3. Compose subject registry, session, capability, and shared-state ports.
4. Bind canonical context resolver to developer access through injection.
5. Replace environment-name-only Production denial with the complete
   private-runtime decision; missing gates still deny.
6. Add default-off internal handler composition with no live provider.
7. Prove session rotation, cookie behavior, restart, revocation, epoch, outage,
   partition, and no fallback.
8. Emit Sprint 2 evidence.

## 8. Required tests

- all source defaults deny;
- Production provider classification alone grants nothing;
- in-memory adapter denied for hosted/private-live;
- incomplete deployment attestation denied;
- unavailable/degraded/partitioned/stale state denied;
- valid synthetic deployment-shaped adapter passes contract only;
- pre-auth rotation changes ID and CSRF generation;
- replayed pre-auth/nonce/CSRF denied;
- session/capability bound to subject/browser/environment/version/epoch;
- restart revalidates authoritative state;
- logout revokes capability/session and clears cookies;
- emergency epoch invalidates prior envelope;
- default handler without injected ports denies;
- zero Auth0/Redis/Upstash/provider/deployment calls.

## 9. Evidence

```text
activation_precedence_proof.json
shared_state_contract_proof.json
session_rotation_proof.json
restart_revocation_proof.json
no_local_fallback_proof.json
internal_handler_default_off_proof.json
```

Plus standard sprint-local evidence.

## 10. Sprint-local validation

- focused security tests pass;
- existing developer-access/security regressions pass;
- import/export and cookie-policy checks pass;
- no provider import/call/configuration;
- exact changed-file allowlist and protected-root comparison pass;
- evidence/secret scans pass;
- no staging, commit, deployment, or live store.

## 11. Bounded repair

At most two Section 3-only repair cycles. No repair may weaken deployment-grade
requirements, emergency dominance, atomic rotation, origin/CSRF, or binding.

## 12. Stop conditions

Stop if:

- live Auth0/Redis/Upstash/credential access is needed;
- no provider-neutral injected boundary can be maintained;
- productionSecurity semantics must change;
- in-memory/local fallback is required;
- protected edge, operator, subscriber, and `SUBDEV1` identities cannot remain
  separate;
- a non-allowlisted file is required.

## 13. Expected outputs

- three bridge composition files;
- four default-off internal session handlers;
- two narrow developer-access integration changes;
- one focused security test;
- indexed Sprint 2 evidence and verdict.

## 14. No-deployment statement

Sprint 2 performs only offline/synthetic composition proof and no provider or
platform action.
