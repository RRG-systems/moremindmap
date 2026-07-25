# Privacy Incident — Readiness Runbook V1

## Authority

Only synthetic privacy-marker rejection is tested. No deployment or platform action is authorized.

## Prerequisites

Privacy-safe schema, forbidden-field list, evidence quarantine model, and human Privacy Governor escalation.

## Stop conditions

Stop packaging if any secret, token, identity, transcript, customer content, raw address, prompt, response, or production datum appears.

## Ordered procedure

1. Reject the synthetic sensitive canary.
2. Record only safe failure codes and opaque references.
3. Mark affected evidence invalid.
4. Escalate without copying sensitive material.

## Verification

Second package scan passes and rejected material is absent from evidence.

## Evidence outputs

Content-free privacy rejection and scan receipts.

## Rollback and escalation

Invalidate the package and escalate to the Privacy Governor.

## Prohibited actions

No disclosure, copying of sensitive material, transcript persistence, destructive deletion, or production action.
