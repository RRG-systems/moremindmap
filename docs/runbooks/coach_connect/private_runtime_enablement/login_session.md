# Private Runtime Login and Session

## Purpose and authority

Describe the default-off server-owned login/session boundary. This runbook is instructional and does not activate Auth0 or another identity provider.

## Preconditions

- Protected edge identity and MFA attestation.
- Injected verified assertion boundary.
- Active canonical subject mapping.
- Healthy deployment-grade shared-security-state capability.

## Exact safe sequence

1. Create a server-owned pre-auth session bound to the browser.
2. Validate the provider-neutral assertion against issuer, audience, nonce, and session binding.
3. Resolve the canonical subject and current security version.
4. Atomically rotate pre-auth into a new authenticated session and CSRF generation.
5. Store only token hashes and emit the content-free session receipt.
6. Evaluate temporary `SUBDEV1` only after authentication.

## Failure and stop behavior

Stop on replay, mismatch, expiry, stale versions, unhealthy shared state, missing deployment capability, or any local fallback.

## Emergency disable

Emergency disable denies new login, rotation, capability issuance, and attachment. Advance the environment epoch through the injected security-state port.

## Receipt and evidence outputs

Record rotation references, versions, epoch, CSRF generation, cookie policy booleans, and zero provider calls. Never record raw session material.

## Prohibited actions

No provider SDK, credential inspection, local hosted fallback, client-granted authority, public login, deployment, staging, or commit.

## Escalation owner

`SECURITY_AUTHORITY_OWNER_TBD`
