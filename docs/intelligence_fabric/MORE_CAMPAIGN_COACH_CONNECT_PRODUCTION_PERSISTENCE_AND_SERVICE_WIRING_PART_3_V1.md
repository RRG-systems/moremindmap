# MORE Campaign — Coach Connect Production Persistence and Service Wiring — Part 3 V1

Status: INDEPENDENT VALIDATION AND HANDOFF AFW

## 1. Purpose

Independently validate any later implementation of Parts 1 and 2. Validation is synthetic-only and default-off. It does not authorize implementation, repair outside the approved plan, production Redis, live providers/models, Stripe mutation, production traffic, deployment, activation, commit, or push.

## 2. Preconditions

1. Read Parts 1 and 2 plus the cross-part report and index.
2. Capture HEAD, worktrees, status, changed files, and protected-root hashes.
3. Confirm implementation stopped at Phase 6 unless a separately authorized safe server validator exists.
4. Confirm no evidence was fabricated or copied from the V1 Live Session predecessor.

If the changed-file set exceeds the authorized plan, stop before tests and report exact paths.

## 3. Static boundary validation

Prove:

- no direct Redis import/connection/environment lookup in the new durable domain;
- no production credential, URL, key material, or live provider/model invocation;
- activation defaults remain off, writes disabled, migration disabled, and emergency-disabled;
- no new or modified public API route;
- no Stripe, billing, dependency, deployment, or unrelated UI change;
- no client occurrence of `SUBDEV1`, its hash, or a reversible equivalent;
- no second Business Engine/canonical append implementation;
- no coach authority for confirmation or canonical mutation;
- existing production and Live Session protected files are unchanged except authorized dormant exports.

## 4. Contract and persistence validation

Independently verify schema versions, scope isolation, event-envelope hashes, aggregate and recorded sequences, idempotency semantic hashes, optimistic version checks, quarantine behavior, checkpoint validation, derived-object separation, unresolved-work retention, and deterministic reads.

Use a fresh synthetic driver. Never infer durable behavior from unit mocks alone.

## 5. Recovery validation

For each scenario capture initial state, command, injected failure, persisted records, final state, retry marker, and canonical append count:

- clean replay/checkpoint;
- corrupt event;
- sequence gap;
- stale or corrupt checkpoint;
- replay failure;
- checkpoint read/write failure;
- provider teardown failure;
- retry after recovery failure.

ACTIVE requires successful replay plus successful checkpoint. CLOSED/COMPLETE requires successful teardown. Every failure must preserve attributable evidence and unresolved work. Canonical append count must remain zero.

## 6. Authority and Business Engine validation

Run service-driven flows for subscriber accept, subscriber reject, coach reject/accept attempts, absent/expired/mismatched confirmation, duplicate confirmation, canonical append failure, and retry. Compare Business Engine version/state, Confidence Reality, and projections before and after.

Only a valid subscriber ACCEPT may produce one canonical append. Rejection and all failures must produce zero. Projections must be rebuildable and match the accepted event history.

## 7. Activation, privacy, and isolation validation

Exercise every default flag, emergency disable, synthetic requirement, tenant/profile allowlist, read-only gate, writes gate, model gate, and migration gate. Cross-tenant/profile/business/subscription/session reads and writes must fail closed. Inspect evidence for transcript/media content, secrets, tokens, raw protected identifiers, or unlock material.

## 8. Developer Access validation

If Phase 6 remains blocked, verify no UI or access files were added and record the blocker without lowering other proof.

If separately authorized and implemented, verify exact placement below `MakeYourMapAlivePanel`, server-side comparison, non-public transport, no secret persistence/logging/client bundle occurrence, default-off capability grant, and no Stripe behavior change. If any element cannot be proven, verdict is blocked and the surface must remain inactive.

## 9. Migration validation

Confirm the migration operates exclusively on synthetic fixtures through injected storage. Run it twice and compare receipts/hashes. Replay migrated events from zero and compare state and projection hashes. Execute synthetic rollback. Confirm production migration remains disabled.

## 10. Command matrix

Record exact commands, timestamps, exit codes, pass/fail/skip counts, and relevant failure output for:

1. focused durable Live Session tests;
2. all Coach Connect tests;
3. all Intelligence Fabric tests;
4. focused ESLint over every changed JS/JSX file;
5. build;
6. JSON parse and schema checks;
7. evidence hash and artifact-index validation;
8. secret/client-bundle scan;
9. protected-boundary and route/dependency/deployment diff checks;
10. `git diff --check`.

No production or live-system product test is permitted.

## 11. Required proof directory

Create `lab_outputs/coach_connect_production_persistence_service_wiring_v1/` containing at least:

- `repository_grounding_report.md`
- `architecture_report.md`
- `implementation_report.md`
- `authorized_file_plan.json`
- `changed_files.json`
- `durable_contract_inventory.json`
- `service_registry_inventory.json`
- `authority_matrix.json`
- `privacy_matrix.json`
- `activation_matrix.json`
- `persistence_trace.json`
- `checkpoint_trace.json`
- `replay_trace.json`
- `recovery_failure_trace.json`
- `teardown_failure_trace.json`
- `confirmation_trace.json`
- `business_engine_before_after.json`
- `confidence_reality_before_after.json`
- `projection_before_after.json`
- `migration_inventory.json`
- `migration_dry_run.json`
- `migration_rollback.json`
- `synthetic_happy_path_trace.json`
- `adversarial_trace.json`
- `recovery_trace.json`
- `durability_before_after.json`
- `protected_root_before.json`
- `protected_root_verification.json`
- `test_results.json`
- `test_manifest.json`
- `artifact_index.json`
- `evidence_manifest.json`
- `final_verdict.json`
- `executive_handoff.md`
- `ai_handoff.json`

When Phase 6 is resolved also require `developer_access_security_report.md`, `ui_placement_proof.json`, and `client_bundle_secret_scan.txt`. If blocked, the verdict and both handoffs must name that blocker explicitly.

Every artifact must identify whether it is observed evidence, deterministic synthetic output, or inference. The evidence manifest must hash every proof artifact except itself using SHA-256 and reject undeclared extras.

## 12. Review package after implementation

Only after an authorized implementation and validation, create:

`~/Desktop/COACH_CONNECT_PRODUCTION_PERSISTENCE_AND_SERVICE_WIRING_IMPLEMENTATION_REVIEW_V1.zip`

Include the complete authorized implementation, tests, five governing campaign documents, and complete proof directory. Preserve repository-relative paths. Stop instead of creating an incomplete archive. Verify it opens, contains exactly the declared inventory, and report byte size, SHA-256, file count, and top-level paths.

This instruction does not authorize creation of the implementation package during AFW expansion.

## 13. Final report

Report campaign verdict; phase-by-phase result; exact changed files; exact test commands/results; happy, adversarial, recovery, migration, Business Engine, Confidence Reality, and projection proofs; protected-boundary result; Phase 6 disposition; remaining limits/blockers; artifact/manifest paths; executive handoff; and AI handoff.

## 14. Acceptance verdict

The maximum valid verdict without Phase 6 resolution is `PASS_WITH_PHASE_6_DEFERRED_BY_HUMAN`. A fully passing synthetic implementation is not production readiness and grants no activation authority.
