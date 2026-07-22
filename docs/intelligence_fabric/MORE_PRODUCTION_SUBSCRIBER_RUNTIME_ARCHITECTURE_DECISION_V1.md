# ADR: Production Subscriber Runtime Foundation V1

## Status

Accepted for an inactive production-shaped foundation. Production traffic and migration are not authorized.

## Decision

Use the repository's existing `ioredis` dependency and `REDIS_URL` operational convention for a future tenant-partitioned authoritative Intelligence Fabric event store. Derived projections, checkpoints, idempotency records, quarantine, recovery, and audit records use separate Redis key families. The implementation accepts an injected Redis-compatible client and an explicit activation capability; it never constructs a client, reads environment variables, or contacts production Redis.

## Repository evidence

The application already uses `ioredis` for canonical profile vaults, Business Assessment records, job state/locks, Visual DNA metadata, admin state, and Stripe access state. Adding another vendor or package is forbidden. Existing Intelligence Fabric contracts already prove append-only history, replay, corrections, idempotency, bitemporal reconstruction, and checkpoints through a test adapter.

## Store and transaction design

- Authoritative store: immutable event envelope per tenant/profile/business sequence, plus an ordered event index.
- Derived stores: projection snapshots and checkpoints, explicitly rebuildable.
- Idempotency: scoped command key records semantic command hash and resulting event ID.
- Concurrency: expected aggregate sequence checked atomically with sequence allocation and event/idempotency writes.
- Transaction boundary: one future Lua/MULTI-compatible atomic append operation. Projection refresh occurs after commit and is retryable.
- Tenant partitioning: every key begins with a versioned tenant/profile/business root. No global subscriber event index exists.
- Versioning: envelope and payload schema versions are explicit; unsupported versions fail closed.
- Corrections: append new events referencing immutable prior events.
- Recovery: replay the authoritative ordered event index; discard/rebuild derived records; quarantine corrupt or unsupported records without affecting other scopes.

## Security and activation

Authorization precedes storage access. Privacy is machine-enforced before prompts, logs, projections, and telemetry. Configuration defaults to global off, writes off, models off, synthetic-only, with empty allowlists and emergency disable active. No public route is added.

## Model boundary

Replaceable providers sit behind a governed membrane. Only minimized scoped context is supplied. Provider output remains a proposal and cannot append evidence, authorize One Move, share coach content, promote learning, or assert calibration/causality.

## Alternatives considered

- New relational database: rejected because it introduces a new vendor/service and migration outside authority.
- Existing Redis with direct production wiring: rejected because traffic, credentials, migration, and live access are forbidden.
- Filesystem persistence: rejected as inconsistent with serverless deployment and repository production mechanisms.
- In-memory only: retained for tests but insufficient as the selected production architecture.

## Rollback and migration posture

Activation is a later campaign. A future migration must be separately approved, dual-written or shadow-validated, tenant allowlisted, reversible, and preceded by backup/replay proof. Rollback disables flags, stops writes/providers, preserves authoritative events, and rebuilds derived state after correction.

## Limits and risks

No Lua script is executed against Redis here; atomicity is represented by adapter capabilities and synthetic transactional tests. Redis durability, backups, cluster topology, encryption, ACLs, retention values, deletion legal policy, load capacity, and SLOs require separate operational approval and validation.
