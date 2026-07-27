# MORE Coach Connect Private Runtime Enablement — Sprint 3 AFW V1

Sprint: `3 — Business Engine Runtime Attachment`

Implementation authorized: `false`

Deployment authorized: `false`

## 1. Purpose

Prepare an exact-scope read attachment to the one existing canonical Business
Engine. Emit immutable reference/version/hash receipts and prove no copy,
developer engine, Profile ID mutation, or write authority.

Sprint verdicts:

- `PRIVATE_RUNTIME_SPRINT_3_BUSINESS_ENGINE_ATTACHMENT_COMPLETE`
- `PRIVATE_RUNTIME_SPRINT_3_BLOCKED`

## 2. Dependencies and repository grounding

Requires Sprints 1–2 complete. The canonical object doctrine and current
Business Assessment visual route establish `BusinessEngineContract` as the
existing read-side projection. Coach Connect inspection already declares
`one_business_engine=true` and `second_business_engine=false`.

Business Engine source is protected and read-only to this sprint.

## 3. Exact allowed files

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/attachments.js
test/intelligenceFabric.coachConnect.privateRuntime.businessEngine.test.js
lab_outputs/coach_connect_private_runtime_enablement_v1/sprint_3/**
```

## 4. Exact prohibited files and actions

Prohibited:

- every file outside Section 3;
- all Business Engine/BA/BOS/Five Futures/One Move/Profile ID files;
- canonical stores, routes, projection/scoring/renderer code;
- Subscription Runtime and Coach Connect composition;
- provider/persistence/deployment/Stripe actions;
- storing Business Engine payloads in the bridge;
- staging or commit.

## 5. Contracts

Implement only:

- `private-runtime-attachment-request-v1` validation relevant to exact scope;
- `business-engine-attachment-v1`;
- attachment port accepting injected canonical lookup/read functions;
- stable missing, ambiguous, and mismatch failures.

The adapter returns refs, version, contract hash, source, and authority
booleans. It cannot build or persist a Business Engine.

## 6. State machine

```text
DETACHED
-> VALIDATING_SUBJECT_SCOPE
-> READING_CANONICAL_ENGINE
-> VALIDATING_VERSION_AND_HASH
-> ATTACHED_READ_ONLY

Any failure -> DISCARD_HANDLE -> DETACHED
```

## 7. Implementation sequence

1. Verify predecessor receipts and protected Business Engine hashes.
2. Define injected canonical Business Engine lookup port.
3. Require exact four-key scope and active subject/session authority.
4. Validate source, ref, version, hash, and singular engine count.
5. Emit content-free attachment receipt.
6. Deny missing, duplicate, scope-mismatched, stale, or corrupt results.
7. Prove no payload copy, Profile ID change, or write authority.

## 8. Required tests

- one exact canonical engine attaches;
- wrong/missing subject/session/scope denies;
- zero engine returns not found;
- two engines return ambiguous;
- wrong source/version/hash/scope denies;
- repeat identical attachment is deterministic;
- bridge snapshot contains refs/hashes only;
- `business_engine_count=1`;
- `duplicate_engine_created=false`;
- `write_authorized=false`;
- protected Business Engine fixtures/hashes unchanged;
- zero external/persistence/deployment calls.

## 9. Evidence

```text
business_engine_attachment_contract.json
one_business_engine_proof.json
business_engine_hash_binding_proof.json
no_business_engine_copy_proof.json
profile_id_unchanged_proof.json
```

Plus standard sprint-local evidence.

## 10. Sprint-local validation

- focused Business Engine attachment tests pass;
- Business Engine contract fixtures pass unchanged;
- no import cycle or forbidden import;
- protected Business Engine roots byte/hash unchanged;
- exact allowlist, evidence hashes, and secret scans pass;
- no staging, commit, deployment, provider, persistence, or Stripe action.

## 11. Bounded repair

At most two repairs confined to Section 3. No repair may edit or mock away a
protected Business Engine invariant, weaken singularity, or permit payload
copy.

## 12. Stop conditions

Stop if:

- canonical Business Engine lookup is ambiguous;
- a Business Engine source or Profile ID change is required;
- a second/developer engine is required;
- attachment needs production/customer data for proof;
- a non-allowlisted path is needed;
- exact source/version/hash cannot be proven.

## 13. Expected outputs

- Business Engine attachment contract in `attachments.js`;
- one focused test file;
- indexed Sprint 3 evidence and verdict.

## 14. No-deployment statement

Sprint 3 uses injected synthetic canonical references only and performs no
deployment or live data access.
