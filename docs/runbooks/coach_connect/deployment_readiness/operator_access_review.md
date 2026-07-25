# Operator Access Review — Readiness Runbook V1

## Authority

Human Identity and Security Governors own operator approval. No deployment or platform action is authorized.

## Prerequisites

Named operator identity reference, MFA requirement, entitlement policy, expiry, environment binding, and audit reference.

## Stop conditions

Stop if operator identity is SUBDEV1, shared, anonymous, expired, unbound, or lacks an approved role.

## Ordered procedure

1. Validate named identity and environment binding.
2. Verify MFA and least-privilege entitlement references.
3. Verify approval expiry and separation from subscriber/developer identity.
4. Record only opaque content-free references.

## Verification

SUBDEV1 remains separate from operator identity and no entitlement is inferred.

## Evidence outputs

Operator-access review and gate-authority receipts.

## Rollback and escalation

Deny access and escalate unresolved identity authority.

## Prohibited actions

No account creation, credential change, entitlement grant, platform login, bypass token, or production action.
