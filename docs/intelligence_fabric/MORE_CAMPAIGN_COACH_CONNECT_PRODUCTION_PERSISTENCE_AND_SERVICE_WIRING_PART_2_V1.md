# MORE Campaign — Coach Connect Production Persistence and Service Wiring — Part 2 V1

Status: EXECUTION AFW — REQUIRES SEPARATE IMPLEMENTATION AUTHORIZATION

## Execution doctrine

Run as one continuous, synthetic-only campaign. Revalidate Part 1 before any edit. Preserve unrelated work. Never connect to production Redis or providers, activate flags, alter public routes, expose the developer unlock, or create a second Business Engine. Run each gate before advancing. A gate receives at most two bounded repair cycles.

## Phase 1 — Repository revalidation and frozen plan

1. Confirm repository path, HEAD, branch, worktrees, and `git status --short`.
2. Confirm predecessor focused tests pass.
3. Re-read the production persistence/activation contracts and Live Session exports.
4. Confirm every proposed file is additive or an explicitly narrow export edit.
5. Capture protected-file hashes before implementation.

Gate: repository truth matches Part 1; no planned edit crosses a protected boundary. Otherwise stop.

Artifacts: `repository_grounding_report.md`, `authorized_file_plan.json`, `protected_root_before.json`.

## Phase 2 — Durable ports and injected adapter

1. Define versioned contracts for event append/read, derived write/read, idempotency, checkpoints, projections, failure records, and migration receipts.
2. Adapt the existing production event-envelope and activation semantics by composition; do not fork their authority rules.
3. Implement an injected driver adapter with no Redis import, connection creation, environment access, or implicit fallback.
4. Enforce scope, expected sequence, semantic idempotency, integrity hashes, schema versions, and quarantine/fail-closed reads.
5. Extend the synthetic driver for deterministic durable behavior.

Gate: contract and persistence tests pass; default flags reject all operations; no network or credential access is reachable.

Artifacts: `durable_contract_inventory.json`, `persistence_trace.json`, `activation_matrix.json`.

## Phase 3 — Checkpoint, replay, and unresolved work

1. Replay accepted events deterministically from zero or the last verified checkpoint.
2. Verify checkpoint scope, sequence, prior-event hash, state hash, and schema version.
3. Persist a new checkpoint only after replay succeeds.
4. Restore ACTIVE provider/media state only after replay and checkpoint success.
5. On replay/checkpoint failure, enter `RECOVERY_FAILED`, record attributable evidence, and preserve unresolved work.
6. On provider teardown failure, never emit CLOSED/COMPLETE; retain an operator-readable retry marker.

Gate: clean replay, corrupt record, sequence gap, stale checkpoint, checkpoint-write failure, and teardown failure tests pass; canonical append count is zero on every failure path.

Artifacts: `replay_trace.json`, `checkpoint_trace.json`, `recovery_failure_trace.json`, `teardown_failure_trace.json`.

## Phase 4 — One service registry and composition root

1. Build a dormant registry that accepts flags, clock, id generator, durable adapter, provider adapter, model membrane, telemetry, and canonical Business Engine append port.
2. Require exact tenant/profile/business/subscription/session scope and actor authorization.
3. Route commands through the existing Live Session service; do not duplicate its state machine.
4. Return explicit inactive/denied/failure results rather than silently falling back to memory.
5. Expose only a factory and contracts through narrow exports.

Gate: service tests prove default-off, synthetic allowlisting, dependency injection, isolation, idempotency, recovery, and no implicit global singleton.

Artifacts: `service_registry_inventory.json`, `service_wiring_trace.json`, `authority_matrix.json`.

## Phase 5 — Business Engine, confirmation, and projection durability

1. Persist proposals, confirmation decisions, and promotion receipts as separate scoped records.
2. Preserve the existing subscriber-only confirmation policy.
3. A rejected, missing, expired, mismatched, duplicated, or unauthorized confirmation blocks promotion.
4. Call the existing injected canonical append exactly once only after accepted confirmation.
5. Persist append outcome and rebuild projections from authoritative events.
6. Prove Business Engine version/state and Confidence Reality are unchanged on blocked/failure paths.

Gate: genuine subscriber accept/reject flows, coach rejection attempt, duplicate command, crash/retry, projection rebuild, and zero-mutation failure tests pass.

Artifacts: `business_engine_before_after.json`, `confidence_reality_before_after.json`, `projection_before_after.json`, `confirmation_trace.json`.

## Phase 6 — Temporary Developer Access — mandatory unresolved gate

Before editing UI, identify and document a server-side, non-public validation boundary that can compare the supplied value without placing `SUBDEV1`, its hash, or a reversible equivalent in the client. Confirm that using it requires neither a new public route nor a behavioral change to an existing public route.

If and only if separately authorized:

1. Add a temporary `DeveloperAccessPanel` immediately below the unscaled `MakeYourMapAlivePanel` in `BusinessAssessmentVisualMap`.
2. Keep the panel visible but all runtime features default-off until server validation succeeds.
3. Use the same Business Assessment visual language without changing Stripe behavior.
4. Do not persist or log the submitted secret.
5. Successful validation grants only the synthetic, allowlisted dormant surface; it grants no billing, production, canonical mutation, provider, or deployment authority.

Current gate result: BLOCKED. No safe eligible validator is grounded in Part 1. Stop here during implementation unless separate authorization resolves it. Do not substitute browser storage, build-time environment variables, hashes in JavaScript, hidden routes, query parameters, or Stripe state.

Artifacts if resolved: `developer_access_security_report.md`, `ui_placement_proof.json`, `client_bundle_secret_scan.txt`.

## Phase 7 — Synthetic migration dry run

This phase may execute independently only after the Phase 6 blocker is explicitly dispositioned by the human. Inventory synthetic V1 state, deterministically transform it, write to the synthetic durable driver, replay it, compare state/projection hashes, test rollback, and leave `migration_enabled=false`.

Gate: repeated dry runs are identical; rollback restores the baseline; no production keys, credentials, or services are read.

Artifacts: `migration_inventory.json`, `migration_dry_run.json`, `migration_rollback.json`.

## Phase 8 — End-to-end durable proof

Run one synthetic happy path and adversarial/recovery scenarios through the real service composition:

- create, authorize, connect, capture, review, propose, subscriber-confirm, promote, project, close;
- subscriber rejection;
- coach confirmation attempt;
- stale/mismatched confirmation;
- duplicate/idempotency replay;
- crash then successful recovery;
- replay failure;
- checkpoint failure;
- provider teardown failure;
- tenant/profile/session isolation;
- activation and emergency-disable denial.

Gate: accepted flow produces one canonical append; all rejected/failure flows produce zero; replayed projections match live projections; no production integration was contacted.

Artifacts: `synthetic_happy_path_trace.json`, `adversarial_trace.json`, `recovery_trace.json`, `durability_before_after.json`.

## Required validation commands

Use repository-native commands discovered at execution time. At minimum run:

```text
node --test test/intelligenceFabric.coachConnect.liveSession.durable.*.test.js
node --test test/intelligenceFabric.coachConnect*.test.js
node --test test/intelligenceFabric*.test.js
npx eslint <all changed JavaScript and JSX files>
npm run build
git diff --check
```

Also validate JSON artifacts, evidence hashes/index, protected-file hashes, secret scans, route diffs, dependency diffs, and exact changed-file inventory. Product tests that invoke live systems are prohibited.

## Stop conditions

Stop rather than guess if repository truth changed; a protected behavioral edit is needed; production credentials/services are required; privacy/retention is unresolved; a second source of truth would result; confirmation cannot fail closed; a public route must change; the developer secret would enter client-visible material; production migration/data is required; replay/checkpoint integrity is ambiguous; or two repair cycles fail.

## Implementation verdict vocabulary

- `PASS_SYNTHETIC_DEFAULT_OFF`
- `PASS_WITH_PHASE_6_DEFERRED_BY_HUMAN`
- `BLOCKED_PHASE_6_SERVER_VALIDATION_BOUNDARY`
- `BLOCKED_PROTECTED_BOUNDARY`
- `BLOCKED_VALIDATION`

Do not call the implementation production-ready or activated.
