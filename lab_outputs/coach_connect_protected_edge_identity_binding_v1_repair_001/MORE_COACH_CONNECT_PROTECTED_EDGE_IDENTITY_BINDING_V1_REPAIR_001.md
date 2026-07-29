# Protected Edge Identity Binding V1 — Bounded Repair 001

## Campaign

`MORE_CAMPAIGN_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_BINDING_V1_REPAIR_001`

Starting HEAD: `1862385201a7bb6221115ea2a2122bed99ffaec7`

Final verdict: `PROTECTED_EDGE_IDENTITY_BINDING_REPAIRED_PROVIDER_CONFIGURATION_REQUIRED`

## Scope

This campaign repaired only findings `PEIB-RV-001`, `PEIB-RV-002`, and `PEIB-RV-003`. It did not alter identity authority, entitlement, tester authority, Profile ID authority, Subscription Runtime authority, Coach Connect authority, the qualified remote adapter, public access, provider resources, environment bindings, or deployment state.

## PEIB-RV-001 — resolved

Protected-edge `deployment_id` is now an immutable SHA-256 deployment identity, not a project reference, alias, branch, environment name, or domain.

The server-side configuration contract requires:

`MORE_PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_SHA256`

The value must be exactly 64 lowercase hexadecimal characters and must match the protected-edge configuration document. The existing live attestation continues to retain `vercel_project_reference` separately. Missing, malformed, project-only, or mismatched deployment identity fails closed. No live value was created or bound.

The existing internal assertion contract remains `protected-edge-identity-v1`; its existing `deployment_id` field now carries the immutable digest and remains part of assertion verification and replay fingerprints.

## PEIB-RV-002 — resolved

`SESSION_BOUND` no longer treats identical bearer-token reuse as proof of a valid session.

For every protected-edge binding attempt, the adapter creates a server-generated transaction reference using cryptographic randomness. The raw reference is immediately HMAC-pseudonymized and is included with environment, immutable deployment, method, and route in the binding-context hash. The atomic upstream replay claim includes that context and is always strict one-time.

Consequences:

- the first valid token use may succeed;
- same-route reuse denies;
- cross-route reuse denies;
- a different server transaction denies;
- concurrent reuse produces at most one winner;
- replay-state outage denies;
- missing or malformed server transaction generation denies;
- browser-supplied deployment, session, or transaction binding headers deny;
- no raw transaction reference is logged, returned, or persisted.

## PEIB-RV-003 — resolved

JWT temporal ordering is now validated independently of clock skew.

The verifier requires integer NumericDate values and rejects:

- `exp <= iat`;
- `exp <= nbf`;
- malformed `exp`, `iat`, `nbf`, or `auth_time`;
- `auth_time > iat`;
- `auth_time >= exp`.

Clock skew remains available only for comparison against server time. Internal assertions require `expires_at > issued_at`, a finite authentication time, `authenticated_at <= issued_at`, and `authenticated_at < expires_at`.

## Bounded repairs

- Repair 001: implement the three reviewed source repairs and focused tests.
- Repair 002: normalize two legacy test fixtures that unintentionally combined expiry/not-before cases with the newly prohibited contradictory time ordering. No production behavior changed in Repair 002.

No further repair iteration was required.

## Validation

- Repair-specific cases added: 7/7
- Protected-edge implementation tests: 25/25
- Direct affected suites: 31/31
- Combined focused: 71/71
- Targeted: 241/241
- Safe Intelligence Fabric regression: 624/624
- Deterministic build: `d13d0be2df339946c93e92fb658d6dbb5c1498c17966a395d98a72ffdb2d5d75`
- Lint: PASS
- Import/export: PASS
- Schema validation: PASS
- Dependency cycles: 0
- Protected roots: unchanged
- Qualified remote adapter: unchanged
- Provider/environment/deployment calls: 0/0/0
- Commit/push/staging/activation: none

## Remaining limit

Source implementation is complete, but a later authorized provider-configuration campaign must bind the actual immutable deployment SHA-256, supported upstream issuer/JWKS references, signing-key reference, and private-live environment documents. This campaign created or inspected none of those values.

Recommended next action: `REPEAT_INDEPENDENT_IMPLEMENTATION_REVIEW`
