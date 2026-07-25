# Emergency Disable — Readiness Runbook V1

## Authority

This campaign verifies precedence only. No deployment or platform action is authorized.

## Prerequisites

Versioned configuration, gate records, named operator role, and privacy-safe incident channel model.

## Stop conditions

Stop if emergency disable is missing, mutable by a client, lower precedence than another flag, or requires a secret/platform query to evaluate.

## Ordered procedure

1. Inject a synthetic emergency condition.
2. Assert emergency disable true.
3. Assert every product action, deployment, and activation decision denies.
4. Emit a content-free P0 monitoring event.

## Verification

Denial wins under every conflicting configuration and the P0 canary is acknowledged synthetically.

## Evidence outputs

Configuration, activation-boundary, and alert-canary proofs.

## Rollback and escalation

Remain disabled and escalate any precedence ambiguity.

## Prohibited actions

No toggle mutation outside the offline fixture, no bypass token, no remote call, and no production action.
