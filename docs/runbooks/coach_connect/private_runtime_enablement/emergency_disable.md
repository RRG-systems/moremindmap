# Private Runtime Emergency Disable

## Purpose and authority

Describe the dominant fail-closed emergency control for private runtime composition.

## Preconditions

- Human incident authority.
- Exact environment scope.
- Authoritative shared-security-state port.
- Current environment security epoch.

## Exact safe sequence

1. Assert the global private-runtime disable.
2. Advance the exact environment security epoch atomically.
3. Deny new elevation, capability issuance, and attachment.
4. Treat all earlier capabilities and attachment handles as stale.
5. Stop new mutations and structured sessions.
6. Preserve the canonical Business Engine.
7. Emit the privacy-safe emergency receipt.

## Failure and stop behavior

Any inability to assert disable or advance the epoch is a hard stop and requires human incident escalation. Never use local state as a substitute.

## Emergency disable

This runbook defines emergency disable. It remains asserted until separate human authority approves recovery; implementation completion does not clear it.

## Receipt and evidence outputs

Record prior/new epoch, disabled gate states, detached handles, preserved-engine boolean, and zero external calls.

## Prohibited actions

No canonical rollback, destructive deletion, provider action, production-data access, public activation, deployment, staging, or commit.

## Escalation owner

`INCIDENT_COMMANDER_TBD`
