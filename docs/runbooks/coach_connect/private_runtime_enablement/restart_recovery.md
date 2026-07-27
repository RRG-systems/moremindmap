# Private Runtime Restart and Recovery

## Purpose and authority

Describe authoritative restart and recovery validation without process-local authorization or production activation.

## Preconditions

- Injected shared-security-state port with validated capability.
- Existing persisted subject/session/capability control-plane records.
- Current approval and exact scope.
- No emergency disable.

## Exact safe sequence

1. Start a fresh composition instance with no retained process handles.
2. Revalidate shared-state capability and health.
3. Read the authenticated session from authoritative state.
4. Resolve the canonical subject and current mapping/security versions.
5. Revalidate approval, capability, browser binding, expiry, and epoch.
6. Rebuild all attachments from injected existing runtimes.
7. Publish ready only if every receipt agrees.

## Failure and stop behavior

Deny stale cache, missing record, uncertain time, partition, version drift, or partial attachment. Never authorize from a snapshot labeled local fallback.

## Emergency disable

If emergency disable is asserted during recovery, stop and leave all runtime handles detached.

## Receipt and evidence outputs

Record authoritative-read booleans, current versions/epoch, rebuilt attachment refs, governed failure codes, and zero external calls.

## Prohibited actions

No relabeling in-memory state, customer-data access, migration, physical deletion, provider contact, deployment, staging, or commit.

## Escalation owner

`RECOVERY_AUTHORITY_OWNER_TBD`
