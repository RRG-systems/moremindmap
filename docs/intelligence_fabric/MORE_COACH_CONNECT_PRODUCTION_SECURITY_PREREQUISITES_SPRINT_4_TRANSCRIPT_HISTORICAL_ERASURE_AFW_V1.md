# Coach Connect Production Security Prerequisites — Sprint 4 AFW V1

Status: pre-authored architecture work frame; implementation not authorized.

## 1. Outcome

Define honest transcript backing-store deletion and historical-record erasure.
The current append-only JSONL journal remains logical-denial-only unless a
future approved architecture supplies byte-, key-, or store-level proof.

## 2. Entry authorities

All are mandatory:

- `RETENTION_POLICY_AUTHORITY`;
- `TRANSCRIPT_BACKING_STORE`: complete owners, APIs, capabilities, receipts,
  provider behavior, derived-data inventory, and independent retention bases;
- `BACKUP_RESTORE_HORIZON`;
- `HISTORICAL_ERASURE_STRATEGY`: authorized selection of compaction,
  cryptographic erasure, or a deletion-capable production store.

Part 1 recommends the third strategy for production direction but does not
select it. Until a human selects a strategy, the sprint verdict is
`SPRINT_4_BLOCKED_BY_ERASURE_ARCHITECTURE`.

Decision source:
`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`.
The packet recommends encrypted unversioned S3 payload storage with
transactional metadata, a bounded approved backup horizon, and production-store
replacement plus scoped cryptographic erasure. Each remains `RECOMMENDED`, not
`APPROVED`. Sprint 4 is unlocked only when all four entry rows contain complete
human approval fields and any schedule/horizon attachments. `REJECTED` requires
AFW revision; `DEFERRED` blocks Sprint 4. Existing local JSONL remains
logical-denial-only.

## 3. Required inventory and claims

The target inventory covers application projections, primary transcript
objects, provider recording/transcript, temporary files, caches/indexes, logs,
exports, backups, embeddings, and extracted evidence.

Each target publishes capability, owner, identifier reference, policy basis,
delete/deny mechanism, retry rules, verification semantics, backup impact, and
receipt schema. `VERIFIED` requires every governed target receipt. Missing or
unsupported targets produce `FAILED` or `IMPOSSIBLE_CURRENT_STORE`.

Forbidden claims include:

- `PHYSICALLY_DELETED` for logical denial, hidden projections, tombstones, or
  newly appended JSONL snapshots;
- deletion of provider/backups/derived data without target receipts;
- cryptographic erasure without scoped key destruction and backup proof;
- compaction without crash-safe replacement, rollback, retired-copy, and byte
  proof.

## 4. Strategy-specific state model

All strategies use the Sprint 3 lifecycle and monotonic deletion epochs.

- Compaction: plan, exclusive fence, copy retained records, fsync, atomic
  replacement, verify bytes, retire recoverable old copies, publish receipt.
- Cryptographic erasure: prove key scope, destroy authorized keys, verify
  decrypt denial across primary and backups, publish receipt.
- Production-store replacement: prove no sensitive production write to JSONL,
  deletion-capable store receipts, migration disposition, and restore denial.

Crash, retry, lease loss, duplicate execution, rollback, and restore must
preserve the deletion epoch before any historical content becomes readable.
No dual write or ambiguous dual deletion claim is allowed.

## 5. Conditional implementation allowlist

- `src/lib/intelligenceFabric/coachConnect/productionSecurity/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/deletionLifecycle.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/erasureStrategy.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/audit.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/activation.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/adapter.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/checkpointReplay.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/localJsonlDriver.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.deletion.test.js`

An authority-selected transcript/provider/store adapter needs architecture
approval and a change receipt before its path can be named. A proof-of-concept
is permitted only under later explicit implementation authority.

## 6. Validation and proof

Required cases:

- full target inventory, missing target, unsupported deletion, partial receipt,
  forged receipt, provider outage, and backup delay;
- crash before/after each selected strategy boundary, concurrent retry, stale
  fence, rollback, restore, and deletion-epoch replay;
- byte recovery attempt for compaction, decrypt attempt for crypto erasure, or
  prohibited JSONL production write for store replacement;
- physical-deletion wording guard;
- default-off behavior and no live provider/store interaction.

Planned command:

```text
node --test test/intelligenceFabric.coachConnect.productionSecurity.deletion.test.js
```

Evidence:

- `sprint_4/authority_decisions.json`
- `sprint_4/store_inventory.json`
- `sprint_4/strategy_record.json`
- `sprint_4/failure_recovery_results.json`
- `sprint_4/erasure_verification.json`
- `sprint_4/deletion_claim_audit.json`
- `sprint_4/changed_files.json`

## 7. Stop and exit rules

Stop if any store or backup is unknown, policy authority is missing, the
strategy is unselected, proof cannot support the requested claim, JSONL old
bytes remain while physical deletion would be claimed, migration/dual write is
needed, a protected root changes, or two bounded repairs fail.

Allowed sprint verdicts:

- `SPRINT_4_COMPLETE`
- `SPRINT_4_BLOCKED_BY_ERASURE_ARCHITECTURE`
- `SPRINT_4_FAILED`

Sprint 5 receives no deletion-readiness inference. Completion does not
authorize destructive deletion, production migration, deployment, Redis,
providers, Stripe, or Deployment Readiness.

Any refinement requires a change receipt covering contracts, files, tests,
scope, and risk.
