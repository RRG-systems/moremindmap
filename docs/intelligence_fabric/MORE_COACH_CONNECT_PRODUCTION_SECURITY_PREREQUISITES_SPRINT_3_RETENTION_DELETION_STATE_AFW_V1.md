# Coach Connect Production Security Prerequisites — Sprint 3 AFW V1

Status: pre-authored architecture work frame; implementation not authorized.

## 1. Outcome

Define authoritative retention governance, data classification, deletion
eligibility, legal holds, lifecycle states, and receipts without inventing
business, privacy, or legal policy.

## 2. Entry authorities

The sprint requires:

- `RETENTION_POLICY_AUTHORITY`: named owners and approvers, approved rules,
  request handling, legal-hold behavior, execution entitlement, audit
  retention, effective dates, and migration disposition.
- `BACKUP_RESTORE_HORIZON`: approved backup classes, horizons, restore
  obligations, and deletion-epoch application.

Without either, contracts and a decision register may be prepared under later
implementation authority, but execution remains blocked and the sprint verdict
is `SPRINT_3_BLOCKED_BY_RETENTION_AUTHORITY`.

Decision source:
`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`.
The packet recommends Privacy-owned, Legal-and-Product-approved retention
governance and a proposed bounded backup horizon. The recommendation supplies
no legal retention period and is not approval. Sprint 3 is unlocked only when
both rows are explicitly `APPROVED`, the retention schedule attachment is
complete, the chosen horizon is recorded, and human approver/date fields are
present. `REJECTED` requires AFW revision; `DEFERRED` blocks Sprint 3.

## 3. Scope and governance

`RetentionPolicyV1` uses the Part 1 section 9.4 authority fields and states
`DRAFT`, `APPROVED`, `SUPERSEDED`, or `REVOKED`. Only an effective `APPROVED`
version may authorize an execution. Code cannot choose a period, exception,
legal basis, or backup horizon.

Deletion states:

```text
ACTIVE -> HIDDEN -> LOGICALLY_DELETED -> SCHEDULED -> ATTEMPTED -> VERIFIED
```

Exception states:

```text
FAILED | IMPOSSIBLE_CURRENT_STORE | RETAINED_LEGAL_HOLD
```

Every transition records policy version, authority, target inventory, request
source, monotonic deletion epoch, idempotency key, prior/new state, reason, and
receipt references. Partial completion is not `VERIFIED`.

## 4. Authority matrix

The approved policy must separately assign who may:

- draft, approve, supersede, and revoke policy;
- classify data and place/release a legal hold;
- accept subscriber or coach requests;
- determine eligibility;
- schedule, execute, retry, and verify deletion;
- inspect audit evidence;
- approve exceptional retention or migration.

Developer access, `SUBDEV1`, content ownership, and application code do not
confer these authorities. Operator execution remains dependent on Sprint 6.

## 5. Conditional implementation allowlist

- `src/lib/intelligenceFabric/coachConnect/productionSecurity/constants.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/retentionAuthority.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/deletionLifecycle.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/audit.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/activation.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js`
- `src/lib/intelligenceFabric/coachConnect/security/retention.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.retention.test.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.deletion.test.js`

No transcript store, backup system, policy database, or migration path is
implicitly added.

## 6. Validation and proof

Required cases:

- draft, future, superseded, revoked, malformed, unsigned, and unauthorized
  policy denial;
- exact policy version/effective-time boundary;
- legal hold placement/release authority and distinct subscriber/coach
  requests;
- duplicate schedule/execute/retry idempotency;
- partial target results, stale epoch, lease loss, audit failure, and restore
  with a deletion epoch;
- cross-tenant denial and operator entitlement dependency;
- no arbitrary retention period in code or fixture;
- default-off behavior and no store/provider contact.

Planned command:

```text
node --test \
  test/intelligenceFabric.coachConnect.productionSecurity.retention.test.js \
  test/intelligenceFabric.coachConnect.productionSecurity.deletion.test.js
```

Evidence:

- `sprint_3/authority_decisions.json`
- `sprint_3/policy_contract_results.json`
- `sprint_3/deletion_state_results.json`
- `sprint_3/authority_matrix.json`
- `sprint_3/changed_files.json`
- `sprint_3/no_production_action.json`

## 7. Stop and exit rules

Stop if policy is guessed, privacy/legal uncertainty remains, partial deletion
would be called success, an execution lacks attributable authority, restore
semantics are unknown, a protected root changes, or two bounded repairs fail.

Allowed sprint verdicts:

- `SPRINT_3_COMPLETE`
- `SPRINT_3_BLOCKED_BY_RETENTION_AUTHORITY`
- `SPRINT_3_FAILED`

Sprint 4 receives the approved policy version, target classification, deletion
state contract, and backup obligations. Completion does not authorize deletion,
migration, production, deployment, Redis, providers, Stripe, or Deployment
Readiness.

Any refinement requires a change receipt covering contracts, files, tests,
scope, and risk.
