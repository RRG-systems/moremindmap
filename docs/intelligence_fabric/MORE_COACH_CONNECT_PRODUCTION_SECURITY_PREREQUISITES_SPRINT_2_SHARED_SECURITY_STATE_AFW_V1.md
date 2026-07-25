# Coach Connect Production Security Prerequisites — Sprint 2 AFW V1

Status: pre-authored architecture work frame; implementation not authorized.

## 1. Outcome

Define deployment-grade coordination semantics for replay prevention, rate
limits, revocation, epochs, leases, and idempotency. Produce only synthetic
multi-instance proof until a platform is approved. Production Redis and every
other live shared store remain prohibited.

## 2. Entry authority

`SHARED_STATE_PLATFORM` must approve a deployment store contract, owner,
availability and durability SLO, server-time/TTL behavior, failure policy,
namespace, encryption, backup, and operational responsibility.

Without that decision, only the interface, deterministic in-memory test double,
and blocked evidence may be implemented under separate authority. The sprint
verdict remains `SPRINT_2_BLOCKED_BY_SHARED_STATE_PLATFORM`.

Decision source:
`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`.
The packet recommends a dedicated paid single-primary Upstash Redis security
store with primary-only authorization reads and feature-tested atomics. This
is `RECOMMENDED`, not `APPROVED`, and it performs no Redis action. Sprint 2 is
unlocked only by a completed human choice, approver, date, and explicit
`APPROVED` status. `REJECTED` requires AFW revision; `DEFERRED` blocks Sprint 2
and state-dependent completion, not every independent sprint.

## 3. Scope and invariants

The shared-state port must support:

- atomic compare-and-set and insert-if-absent;
- server-time TTL;
- consume-once nonce and CSRF state;
- session and capability revocation;
- atomic rate windows and cooldowns;
- monotonic security and deletion epochs;
- idempotency result storage;
- retention/deletion execution leases with fencing;
- append-only attributable audit receipts;
- a capability descriptor that cannot call process memory deployment-grade.

Protected production operations fail closed on unavailable, ambiguous,
partitioned, stale, or unsupported state. Preview and production modes never
fall back to process memory. The adapter and all integration flags are
default-off.

## 4. State and failure model

```text
UNCONFIGURED -> SYNTHETIC_READY -> PLATFORM_SELECTED -> ADAPTER_VERIFIED
```

Only a later, separately authorized readiness campaign may advance beyond
`ADAPTER_VERIFIED`. Failure states include `UNAVAILABLE`, `PARTITIONED`,
`STALE_FENCE`, `CLOCK_UNTRUSTED`, `CAPABILITY_MISMATCH`, and
`LOCAL_FALLBACK_FORBIDDEN`.

Two simulated instances must observe the same nonce consumption, replay
result, rate window, revocation, epoch, lease fence, and idempotency outcome.

## 5. Conditional implementation allowlist

- `src/lib/intelligenceFabric/coachConnect/productionSecurity/constants.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/sharedSecurityStatePorts.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/inMemorySharedSecurityState.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/activation.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js`
- `src/lib/intelligenceFabric/coachConnect/security/ports.js`
- `src/lib/intelligenceFabric/coachConnect/security/policy.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.sharedState.test.js`

The selected deployment adapter path is deliberately unnamed and requires a
change receipt plus architecture approval. Existing Redis-shaped code can be
studied but cannot be contacted, configured, or relabeled as proof.

## 6. Validation and attack cases

Required cases:

- insert race, compare-and-set race, duplicate nonce, replay across instances,
  concurrent rate windows, concurrent revocation, and stale lease fence;
- TTL boundary with server time and skewed application clocks;
- dependency outage, timeout, partition, reconnect, stale read, capability
  downgrade, corrupted value, and unsupported atomicity;
- preview/production local-fallback denial;
- audit persistence failure prevents a protected success where required;
- deterministic synthetic results, default-off activation, and zero network
  access.

Planned command:

```text
node --test test/intelligenceFabric.coachConnect.productionSecurity.sharedState.test.js
```

Evidence:

- `sprint_2/platform_decision.json`
- `sprint_2/capability_matrix.json`
- `sprint_2/multi_instance_results.json`
- `sprint_2/failure_injection_results.json`
- `sprint_2/no_network_action.json`
- `sprint_2/changed_files.json`

## 7. Stop and exit rules

Stop if the platform or SLO is guessed, production protection falls back
locally, live credentials/network access are needed, semantics cannot be made
atomic, a protected root changes, or two bounded repairs fail.

Allowed sprint verdicts:

- `SPRINT_2_COMPLETE`
- `SPRINT_2_BLOCKED_BY_SHARED_STATE_PLATFORM`
- `SPRINT_2_FAILED`

Sprint 3 may depend on the port contract but cannot claim deployment-grade
state until the approved adapter is independently verified. Completion does
not authorize production, deployment, live providers, production Redis,
Stripe, or Deployment Readiness.

Any refinement requires a change receipt covering contracts, files, tests,
scope, and risk.
