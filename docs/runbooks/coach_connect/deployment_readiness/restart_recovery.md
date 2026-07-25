# Restart and Recovery — Readiness Runbook V1

## Authority

Recovery is simulated in memory. No deployment or platform action is authorized.

## Prerequisites

Validated recovery receipt, idempotency keys, compatibility range, and default-off configuration.

## Stop conditions

Stop on local-state fallback, duplicate replay/promotion, provider or persistence call, missing limitation, or active result state.

## Ordered procedure

1. Load a synthetic prior-state reference.
2. Simulate restart and replay unique keys.
3. Reject duplicates and local fallback.
4. Verify healthy inactive state with zero external writes.

## Verification

Receipt states `HEALTHY_INACTIVE`, `NO_PRODUCTION_PERSISTENCE_PROOF`, and `LOCAL_JSONL_LOGICAL_DENIAL_ONLY`.

## Evidence outputs

Recovery receipt, replay counts, and restart proof.

## Rollback and escalation

Keep service disabled and escalate unavailable deployment-grade state.

## Prohibited actions

No production restart, Redis/Upstash, object store, transcript store, data restore, or physical JSONL deletion claim.
