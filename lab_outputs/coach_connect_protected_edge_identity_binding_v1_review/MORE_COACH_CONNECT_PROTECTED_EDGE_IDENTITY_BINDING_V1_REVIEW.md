# Protected Edge Identity Binding V1 — Independent Implementation Review

## Review identity

- Campaign: `MORE_CAMPAIGN_COACH_CONNECT_PROTECTED_EDGE_IDENTITY_BINDING_V1_REVIEW`
- Repository HEAD: `1862385201a7bb6221115ea2a2122bed99ffaec7`
- HEAD subject: `feat(private-runtime): wire private live runtime v2`
- Reviewed package: `COACH_CONNECT_PROTECTED_EDGE_IDENTITY_BINDING_V1_IMPLEMENTATION_REVIEW.zip`
- Reviewed package SHA-256: `34de85f86eee354fbf579d5e3a8ab7af3248f393c55f3b79696281603667731e`
- Claimed implementation verdict: `PROTECTED_EDGE_IDENTITY_BINDING_IMPLEMENTED_PROVIDER_CONFIGURATION_REQUIRED`
- Independent review verdict: `PROTECTED_EDGE_IDENTITY_BINDING_REPAIR_REQUIRED`

## Executive conclusion

The implementation and evidence package are internally consistent, default-off, privacy-safe, and materially preserve identity/entitlement separation. Cryptographic signature verification, explicit issuer/audience checks, key-ID selection, asymmetric-algorithm enforcement, token-source conflict detection, internal assertion signing, authoritative replay-state use, emergency denial, and absence of provider/deployment activity are all evidenced.

Commit authorization is withheld because three independently confirmed security defects remain:

1. The protected-edge `deployment_id` is bound to a Vercel project reference rather than an attested immutable deployment identity.
2. The allowed `SESSION_BOUND` mode has no trusted session binding; an identical upstream bearer token is accepted across different routes and can mint a new one-time internal assertion on every reuse.
3. The JWT temporal validator accepts contradictory signed temporal claims where `exp < iat` if both timestamps fall inside clock-skew tolerances.

The first two are high-severity identity-boundary defects. Approval criteria explicitly prohibit unresolved deployment-authority ambiguity and replay weakness. The defects are bounded and repairable, so rejection is not warranted.

## Pre-flight results

- Required HEAD and subject: PASS
- Git index empty before review: PASS
- Repository review ZIP SHA-256: PASS
- Desktop review ZIP SHA-256: PASS
- Repository/Desktop byte identity: PASS
- Unrelated pre-existing worktree changes recorded and excluded: PASS
- Commit, push, deployment, provider call, environment change, runtime activation, tester activation, Profile ID activation: all zero/false

The pre-existing unrelated tracked changes excluded from conclusions are:

- `api/engine/businessAssessment/buildBusinessIntelligenceDraft.js`
- `lab_outputs/mmm8_business_engine_contract/run_fixture_validation.mjs`
- `src/components/businessAssessment/BusinessEngineVisualV2.jsx`
- `src/lib/businessAssessment/inferEToPScores.js`
- `src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js`
- `src/lib/businessEngine/buildBusinessEngineContract.js`
- `src/lib/businessEngine/contractDisplaySemantics.js`
- `src/lib/businessEngine/contractVersion.js`
- `src/lib/businessEngine/projectBusinessEngineVisualV2.js`

## Security review results

The following mandatory properties are implemented and independently supported:

- Upstream identity is not trusted before RS256 verification.
- `alg=none`, algorithm downgrade, invalid signature, wrong issuer, wrong audience, unknown/missing key ID, expired/stale/not-yet-valid tokens, missing subject, missing MFA evidence, conflicting sources, query tokens, and browser-supplied internal assertions deny.
- Static JWKS material is digest-bound and unknown or ambiguous keys deny.
- Identity normalization emits opaque references and does not grant entitlement, tester, Profile ID, Subscription Runtime, Coach Connect, billing, canonical, deployment, or operator authority.
- Raw upstream tokens are neither returned nor persisted by the adapter; scans found no raw secrets or provider credentials.
- The internal assertion preserves `protected-edge-identity-v1`, is HMAC-authenticated, short-lived, context-bound, one-time replay claimed, and includes environment/deployment fields.
- Replay state uses the Promise-native Async Security V2 `CLAIM_REPLAY` command and fails closed on unhealthy or unavailable state.
- Emergency disable and incomplete/contradictory configuration deny.
- Provider-specific token profiles remain within the provider-neutral adapter contract.
- No public fallback, V1 fallback, synthetic live fallback, Profile ID inference, package/lockfile/Vercel/Auth0/Stripe/voice/media/transcript change, or product-runtime redesign was found.

These properties do not cure Findings `PEIB-RV-001` through `PEIB-RV-003`.

## Findings

### PEIB-RV-001 — HIGH — Project reference substituted for immutable deployment identity

Affected behavior:

- `configurationAuthority.js` passes `liveEnvironmentAttestation.vercel_project_reference` as the expected `deploymentId`.
- The protected-edge configuration and internal assertion then carry that project reference as `deployment_id`.
- Internal replay fingerprints also use the same value.

Impact:

All deployments in the same Vercel project can satisfy the same nominal deployment binding if they share configuration and keys. The assertion proves project membership, not the exact immutable deployment/artifact named by the security doctrine. This leaves cross-deployment authority ambiguity and fails the required environment-and-deployment binding proof.

Required repair:

- Add or use a reviewed immutable deployment identity in the exact live environment attestation, separate from `vercel_project_reference`.
- Require protected-edge configuration `deployment_id` to equal that immutable attested value.
- Preserve the field in internal assertion and replay fingerprints.
- Add same-project/different-deployment denial tests and stale/missing deployment-attestation tests.

Repair boundary:

- `privateRuntime/liveBindings/configurationAuthority.js`
- protected-edge configuration/attestation validation and exact related schemas only if separately authorized
- `protectedEdgeIdentity/internalAssertion.js` only if existing field semantics cannot be preserved
- the existing environment, contract, and assertion test files

Stop if the repair requires Vercel inspection, credentials, deployment, a second authority, protected-root change, or unreviewed attestation-schema expansion.

### PEIB-RV-002 — HIGH — `SESSION_BOUND` replay mode is not session-bound

Affected behavior:

- The upstream replay fingerprint contains only token identifier reference, canonical subject reference, environment ID, and deployment ID.
- It contains no trusted server session, browser transaction, login nonce, or equivalent binding.
- In `SESSION_BOUND`, `CLAIM_REPLAY` idempotent reuse is treated as allowed.
- The focused test explicitly expects the same bearer token to be accepted twice.
- An independent synthetic probe showed the same token accepted first on login and then on the session route.

Impact:

A stolen upstream bearer token can be reused until expiry from a different request context. Each reuse mints and consumes a fresh internal assertion, so one-time internal assertion replay protection does not prevent upstream-token replay. The durable idempotency fingerprint proves only token sameness, not session sameness.

Required repair:

- Either fail closed for `SESSION_BOUND` and use `ONE_TIME` until a trusted session binding is available, or
- bind reuse to a cryptographically established, server-derived session/transaction identifier that is unavailable to an attacker and included in the atomic replay fingerprint.
- Reject absent, mismatched, cross-route where disallowed, cross-session, concurrent, and post-logout reuse.
- Retain outage fail-closed and no-local-fallback behavior.

Repair boundary:

- `protectedEdgeIdentity/contracts.js`
- `protectedEdgeIdentity/adapter.js`
- `protectedEdgeIdentity/replayProtection.js`
- existing protected-edge focused/integration tests and configuration tests

Stop if the binding would be client-asserted, inferred from an untrusted header/cookie, depend on unqualified provider behavior, couple identity to entitlement, or require an architecture change.

### PEIB-RV-003 — MEDIUM — Contradictory temporal claims are accepted

Affected behavior:

The upstream verifier checks expiration/future issuance/max age but never requires `exp > iat`. A locally signed synthetic token with `iat = now + 10 seconds` and `exp = now + 5 seconds` was accepted under the configured 30-second skew. The internal assertion verifier likewise does not explicitly require `expires_at > issued_at`.

Impact:

Malformed but validly signed temporal claim sets can become authenticated identity. The accepted interval is bounded by `exp`, so this does not extend lifetime, but it violates the stated fail-closed temporal contract and creates inconsistent audit semantics.

Required repair:

- Require strict, coherent ordering for upstream `nbf`, `iat`, `auth_time`, and `exp`.
- Require internal assertion `expires_at > issued_at`.
- Retain bounded skew only for comparison to server time, not for contradictory ordering within the token.
- Add exact boundary and coercion tests.

Repair boundary:

- `protectedEdgeIdentity/jwtVerifier.js`
- `protectedEdgeIdentity/internalAssertion.js`
- existing protected-edge focused tests

Stop if provider-specific temporal semantics or contract widening becomes necessary.

## Adversarial review summary

- Algorithm confusion: denied.
- Issuer/audience confusion: denied.
- Key substitution/unknown key: denied; static digest makes altered JWKS fail closed.
- Duplicate sources/query token/spoofed internal header: denied.
- Replay races: authoritative atomic store is used, but `SESSION_BOUND` policy permits unsafe bearer reuse (Finding `PEIB-RV-002`).
- Cross-environment replay: environment participates in fingerprints and assertions.
- Cross-deployment replay: nominal field exists but carries project identity rather than immutable deployment identity (Finding `PEIB-RV-001`).
- Assertion laundering: browser internal header rejected; issued assertion is not exposed.
- Malformed temporal claims: contradictory ordering accepted (Finding `PEIB-RV-003`).
- Email-only authority/missing subject: denied.
- Emergency-disable/configuration fallback: denied/default-off.
- Token/claim leakage: no raw token or full claim-set evidence leak found.
- Entitlement/Profile ID coupling: none found.
- Denial over-disclosure: outward handler behavior remains generic; internal codes contain no token or subject material.

## Independent validation

- New tests: 19/19
- Combined focused tests: 64/64
- Targeted tests: 234/234
- Safe Intelligence Fabric regressions: 617/617
- Deterministic build run 1: `d13d0be2df339946c93e92fb658d6dbb5c1498c17966a395d98a72ffdb2d5d75`
- Deterministic build run 2: same digest
- Lint: PASS
- Import/export validation: PASS
- Schema validation: PASS
- Dependency cycles: 0
- Protected roots: unchanged
- Qualified Remote Shared Security Adapter files: unchanged
- Provider/environment/deployment calls: 0/0/0
- Runtime/tester/Profile ID activation: false/false/false

Passing tests confirm implemented behavior; they do not negate the three uncovered gaps because the current tests either do not model those cases or explicitly encode the unsafe `SESSION_BOUND` behavior.

## Package integrity

- Expected SHA-256: PASS
- Repository/Desktop byte identity: PASS
- Entry count: 45
- Sorted paths: PASS
- Duplicate paths: none
- Case collisions: none
- Symlinks: none
- Absolute/traversal paths: none
- ZIP integrity: PASS
- Decompressed byte equality to repository: 45/45
- Evidence manifest hashes: 27/27
- Repair 001: packaging byte-comparison correction only; no implementation/security semantic change

## Verdict and next action

Final verdict: `PROTECTED_EDGE_IDENTITY_BINDING_REPAIR_REQUIRED`

Commit authorization: **NO**

Recommended next action: authorize one bounded Protected Edge Identity Binding V1 repair campaign addressing `PEIB-RV-001`, `PEIB-RV-002`, and `PEIB-RV-003`; regenerate the implementation review package; then repeat this independent review. Do not configure a provider, deploy, activate runtime, authorize testers/Profile IDs, stage, commit, or push before approval.
