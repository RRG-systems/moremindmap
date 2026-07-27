# Private Runtime Logout and Revocation

## Purpose and authority

Describe fail-closed logout and revocation for the temporary entitlement and server-owned session.

## Preconditions

- Current authenticated session reference.
- Current temporary capability hash.
- Current environment security epoch.
- Injected authoritative shared-security-state port.

## Exact safe sequence

1. Stop accepting new runtime calls.
2. Revoke the temporary capability.
3. Revoke the authenticated session.
4. Invalidate CSRF state and advance the security epoch.
5. Clear both secure cookies.
6. Detach runtime handles.
7. Emit a content-free logout receipt.

## Failure and stop behavior

If any authoritative revocation step fails, deny further work and escalate. Never report logout success from UI state alone.

## Emergency disable

Emergency disable may be asserted at any point and dominates the logout path; it must still leave new calls denied.

## Receipt and evidence outputs

Record capability/session revoked, epoch advanced, cookies cleared, handles detached, and no surviving authority.

## Prohibited actions

No physical product-data deletion claim, provider contact, production persistence mutation, deployment, staging, or commit.

## Escalation owner

`SECURITY_AUTHORITY_OWNER_TBD`
