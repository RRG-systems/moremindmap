# Verify Inactive Deployment Shape — Readiness Runbook V1

## Authority

Verification is offline-only in this campaign. No deployment or platform action is authorized.

## Prerequisites

Validated environment, configuration, topology, gate, rollback, monitoring, and receipt contracts.

## Stop conditions

Stop if evidence class is `INTERNAL_LIVE`, a remote endpoint is needed, any digest differs, or deployment success is treated as activation.

## Ordered procedure

1. Recompute content digests.
2. Verify route classes all require outer access denial.
3. Verify application and live-dependency flags false.
4. Verify external call counters zero and activation inactive.

## Verification

All checks are deterministic and classified static, synthetic, or deployment-shaped-offline.

## Evidence outputs

Validation receipt and evidence hashes.

## Rollback and escalation

Reject the evidence package and return to the owning sprint on mismatch.

## Prohibited actions

No live probe, hosted preview, public route, credential, production data, or physical local JSONL deletion claim.
