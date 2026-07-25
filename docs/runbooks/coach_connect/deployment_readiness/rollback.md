# Rollback Simulation — Readiness Runbook V1

## Authority

This runbook models rollback offline. No deployment or platform action is authorized.

## Prerequisites

Immutable current and rollback artifact/config digests, emergency disable, compatibility proof, and non-decreasing security fields.

## Stop conditions

Stop on missing artifact, digest collision, edge-policy weakening, incompatible contract, or decreasing epoch/tombstone/hold/audit state.

## Ordered procedure

1. Validate rollback plan and idempotency key.
2. Apply synthetic transition to the offline state model.
3. Preserve all non-decreasing fields.
4. Verify inactive state and zero persistence mutation.

## Verification

Result is `VERIFIED_INACTIVE`; application rollback does not imply persistence rollback.

## Evidence outputs

Rollback, compatibility, and idempotency proof records.

## Rollback and escalation

Block the plan and escalate any irreversible or unmodeled persistence dependency.

## Prohibited actions

No live rollback, data restore, migration, destructive deletion, provider/store call, or physical JSONL deletion claim.
