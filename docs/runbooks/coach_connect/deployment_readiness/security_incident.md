# Security Incident — Readiness Runbook V1

## Authority

Only synthetic incident handling is tested. No deployment or platform action is authorized.

## Prerequisites

Named operator role distinct from SUBDEV1, P0 rule, emergency-disable model, and content-free evidence channel.

## Stop conditions

Stop if operator identity is ambiguous, evidence contains sensitive material, P0 delivery fails, or containment needs live authority.

## Ordered procedure

1. Classify the synthetic event.
2. Assert global denial and emergency-disable precedence.
3. Deliver and acknowledge a synthetic P0.
4. Preserve content-free correlation and audit references.

## Verification

No subscriber content, token, address, transcript, prompt, response, or full exception appears.

## Evidence outputs

Monitoring event, alert receipt, and incident validation proof.

## Rollback and escalation

Remain disabled and escalate to the human Security Incident Commander.

## Prohibited actions

No credential access, account mutation, live provider/store operation, public statement, or production action.
