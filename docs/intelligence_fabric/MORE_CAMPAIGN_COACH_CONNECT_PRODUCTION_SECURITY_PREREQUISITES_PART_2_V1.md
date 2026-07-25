# MORE Campaign — Coach Connect Production Security Prerequisites — Part 2 V1

Status: `AFW EXPANSION — CONTRACTS AND IMPLEMENTATION PLAYBOOK ONLY`
Generated: `2026-07-24`
Grounded predecessor: `d42b52a27e8dae0ea4f53a444ee073a752fcdecd`
Implementation authority: `NOT GRANTED`
Implementation is not authorized by this AFW expansion.

## 1. Execution doctrine

A later implementation must:

1. obtain the sprint-specific human decisions named in Part 1;
2. inspect `git status --short` before every sprint;
3. freeze an exact sprint file allowlist;
4. preserve unrelated dirty work and all protected product roots;
5. keep every new capability default-off;
6. use synthetic fixtures only;
7. deny unknown, unavailable, stale, ambiguous, or partial state;
8. distinguish architecture proof from deployment certification;
9. perform no deployment, production Redis, provider, Stripe, secret, or migration action;
10. stop after two bounded repairs per failed gate.

Sprints may be implemented separately only after separate authorization. A
later sprint may not silently compensate for a missing earlier decision.

### 1.1 Decision approval enforcement

All eleven gates are resolved through:

`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`

The packet's recommended choices are design inputs, not authority. A later
implementation must parse or transcribe a versioned decision record with:

```text
decision_id
recommended_choice_reference
human_choice
approved_by
approval_date
status = APPROVED | REJECTED | DEFERRED
required_attachment_references
packet_sha256
```

Only `APPROVED`, with non-empty human fields and every decision-specific
attachment, satisfies a sprint precondition. `REJECTED` requires AFW change
review. `DEFERRED` blocks the affected sprint and any dependent completion but
does not block an otherwise independent sprint. No implementation helper may
convert `RECOMMENDED_PENDING_HUMAN_DECISION`, an empty field, or a machine
recommendation into `APPROVED`.

## 2. Versioned contract family

Proposed namespace:

`src/lib/intelligenceFabric/coachConnect/productionSecurity/`

Version identifiers:

```text
production_security_prerequisite_schema = 1.0.0
subject_binding_policy = subscriber-subject-binding-v1
session_elevation_policy = subscriber-session-elevation-v1
shared_security_state_contract = shared-security-state-v1
retention_authority_contract = retention-authority-v1
deletion_lifecycle_policy = deletion-lifecycle-v1
erasure_strategy_contract = governed-erasure-v1
transport_trust_policy = production-transport-trust-v1
operator_entitlement_policy = operator-entitlement-v1
```

Unknown versions fail closed. Migrations are explicit, versioned, idempotent,
and never run automatically merely because new code exists.

## 3. Core contracts

### 3.1 Canonical subscriber subject

```js
{
  schema_version,
  subscriber_subject_id,
  issuer,
  audience,
  tenant_id,
  profile_id,
  business_id,
  subscriber_id,
  mapping_version,
  security_version,
  status,
  source_assertion_reference,
  bound_at,
  effective_at,
  revoked_at,
  reassignment_prohibited: true
}
```

Validation:

- IDs are opaque, bounded, and not email-shaped;
- exact composite scope is mandatory;
- issuer/audience must match an approved policy record;
- status is `ACTIVE | DISABLED | DELETED | RECOVERY_PENDING`;
- mapping/security versions are positive integers;
- reassignment is prohibited;
- source assertion is a keyed reference, not a raw credential or token;
- deleted/disabled/recovery-pending subjects cannot authorize product mutation;
- one active canonical subject cannot map to multiple active subscriber scopes;
- one active subscriber scope cannot map to multiple canonical subjects without
  an explicit account-recovery transition and audit.

### 3.2 Authentication assertion

```js
{
  assertion_reference,
  subject_id,
  issuer,
  audience,
  authenticated_at,
  auth_strength,
  security_version,
  session_binding_reference,
  status: 'VERIFIED'
}
```

The assertion enters through an injected verifier owned by the approved
authentication boundary. Request bodies, query strings, cookies without
verification, invite payloads, and profile IDs cannot construct it.

### 3.3 Pre-auth session

```js
{
  pre_auth_session_id,
  browser_binding_hash,
  csrf_generation,
  issued_at,
  expires_at,
  status: 'ACTIVE | ELEVATION_PENDING | ROTATED | REVOKED | EXPIRED | INVALID',
  grants_authenticated_authority: false
}
```

### 3.4 Authenticated subscriber session

```js
{
  authenticated_session_id,
  subscriber_subject_id,
  subject_security_version,
  browser_binding_hash,
  issuer,
  audience,
  auth_strength,
  issued_at,
  expires_at,
  last_seen_at,
  status: 'ACTIVE | ROTATED | REVOKED | EXPIRED | INVALID',
  rotation_parent_reference,
  csrf_generation,
  session_epoch
}
```

Raw session tokens are never stored. The authenticated session ID and token
must differ from all pre-auth values.

### 3.5 Session elevation receipt

```js
{
  elevation_id,
  pre_auth_session_ref,
  authenticated_session_ref,
  subscriber_subject_ref,
  invalidated_csrf_generation,
  invalidated_capability_refs,
  prior_session_status: 'ROTATED',
  new_session_status: 'ACTIVE',
  occurred_at,
  policy_version,
  correlation_id,
  audit_event_id
}
```

No success receipt exists unless old-state invalidation and new-state creation
are atomic under the shared security-state contract.

### 3.6 Shared security-state port

Required interface groups:

```text
describeCapability()
serverTime()
atomicCreateSession()
rotateSession()
getSession()
revokeSession()
consumeNonce()
claimReplay()
completeReplay()
rateLimit()
putCapabilityHash()
getCapabilityByHash()
revokeCapability()
getSecurityEpoch()
advanceSecurityEpoch()
getDeletionEpoch()
advanceDeletionEpoch()
acquireRetentionLease()
renewRetentionLease()
releaseRetentionLease()
appendAuditReceipt()
health()
```

`describeCapability()` returns:

```js
{
  contract_version,
  adapter_class: 'SYNTHETIC_LOCAL | DEPLOYMENT_CANDIDATE | DEPLOYMENT_APPROVED',
  deployment_grade,
  atomicity_model,
  ttl_clock_source,
  partition_behavior,
  durable_audit,
  environment_id
}
```

Production prerequisites require `DEPLOYMENT_APPROVED`; no caller can override
that description with a request or feature flag.

### 3.7 Retention authority

```js
{
  policy_id,
  version,
  status: 'DRAFT | APPROVED | SUPERSEDED | REVOKED',
  owner_subject_ref,
  approver_subject_refs,
  effective_at,
  supersedes_policy_id,
  rules: [{
    data_class,
    trigger,
    duration_or_event_rule,
    legal_hold_behavior,
    subscriber_request_behavior,
    coach_request_behavior,
    deletion_eligibility,
    execution_entitlement,
    audit_retention_rule,
    backup_disposition
  }],
  migration_disposition
}
```

The validator rejects placeholder owners, empty approver sets, missing
effective dates, unsupported classes, and arbitrary numeric defaults without a
human-approved source reference.

### 3.8 Legal hold

```js
{
  hold_id,
  exact_scope_hash,
  governed_data_classes,
  authority_subject_ref,
  reason_code,
  issued_at,
  review_at,
  released_at,
  status: 'ACTIVE | RELEASED | EXPIRED',
  policy_version,
  audit_event_id
}
```

Legal hold preserves content but grants no read authority.

### 3.9 Deletion job and target

```js
{
  deletion_job_id,
  exact_scope_hash,
  policy_id,
  policy_version,
  requested_by_subject_ref,
  approved_by_subject_refs,
  deletion_epoch,
  lease_fencing_token,
  state,
  targets: [{
    target_id,
    target_class,
    store_id,
    required_disposition,
    state,
    attempt_count,
    last_attempt_at,
    verification_receipt_ref,
    failure_code
  }],
  created_at,
  updated_at
}
```

Job states:

```text
PLANNED
  -> AUTHORITY_VERIFIED
  -> LEGAL_HOLD_CHECKED
  -> EPOCH_ADVANCED
  -> SCHEDULED
  -> ATTEMPTING
  -> PARTIALLY_VERIFIED
  -> VERIFIED

Any active state -> FAILED_RETRYABLE | FAILED_TERMINAL | RETAINED_LEGAL_HOLD
```

`VERIFIED` requires every mandatory target receipt. Logical invisibility alone
never produces `VERIFIED`.

### 3.10 Erasure strategy decision

```js
{
  decision_id,
  strategy: 'PRIVACY_AWARE_COMPACTION | CRYPTOGRAPHIC_ERASURE | PRODUCTION_STORE_REPLACEMENT',
  approved_by,
  effective_at,
  governed_data_classes,
  backup_disposition,
  crash_recovery_contract,
  rollback_contract,
  lineage_contract,
  dual_write_prohibited: true,
  local_jsonl_production_eligible,
  status: 'PROPOSED | APPROVED | REJECTED | SUPERSEDED'
}
```

No implementation selects a strategy by default. Until `APPROVED`, local JSONL
remains development-only for sensitive governed data and physical deletion is
`NOT_PROVEN`.

### 3.11 Transport environment policy

```js
{
  environment_id,
  environment_class,
  exact_host_allowlist,
  verified_https_termination,
  trusted_proxy_policy_id,
  hsts: {
    enabled,
    max_age_seconds,
    include_subdomains,
    preload
  },
  emergency_disabled,
  status: 'DRAFT | APPROVED | REVOKED'
}
```

HSTS emission requires all production predicates and an approved record.
Unknown host/environment/proxy/HTTPS state omits HSTS and blocks readiness.

### 3.12 Trusted proxy policy and resolved client address

```js
{
  proxy_policy_id,
  environment_id,
  trusted_peer_rules,
  forwarded_header_order,
  maximum_chain_length,
  private_reserved_policy,
  ipv4_mapped_ipv6_policy,
  status: 'DRAFT | APPROVED | REVOKED'
}

{
  resolution: 'VERIFIED | UNAVAILABLE | AMBIGUOUS',
  privacy_safe_network_bucket,
  chain_length,
  trusted_hop_count,
  reason_code,
  policy_version
}
```

Raw addresses are not written to application audit. Unverified forwarded values
never enter rate-limit keys.

### 3.13 Operator identity, session, entitlement, and decision

```js
{
  operator_subject_id,
  issuer,
  audience,
  status,
  security_version,
  role_ids,
  created_at,
  revoked_at
}

{
  operator_session_id,
  operator_subject_id,
  environment_id,
  auth_strength,
  issued_at,
  expires_at,
  status,
  security_version
}

{
  entitlement_id,
  operator_subject_id,
  action_allowlist,
  tenant_scope_allowlist,
  environment_scope,
  requires_reason,
  requires_dual_control,
  issued_by,
  issued_at,
  expires_at,
  status
}

{
  decision_id,
  operator_subject_ref,
  session_ref,
  entitlement_ref,
  action,
  exact_scope_hash,
  reason_code,
  approver_refs,
  allowed,
  failure_code,
  occurred_at,
  audit_event_id
}
```

Developer capability, access code, environment presence, or internal role name
cannot create an operator subject or entitlement.

## 4. State machines

### 4.1 Subject mapping

```text
PENDING_VERIFICATION -> ACTIVE
ACTIVE -> DISABLED | RECOVERY_PENDING | DELETED
RECOVERY_PENDING -> ACTIVE | DISABLED
DISABLED -> ACTIVE | DELETED
DELETED -> terminal
```

Reassignment creates a new versioned recovery transaction; it never edits the
old subject mapping in place.

### 4.2 Session elevation

```text
PRE_AUTH_ACTIVE
  -> ELEVATION_PENDING
  -> OLD_STATE_INVALIDATED
  -> AUTHENTICATED_ACTIVE

failure before atomic commit -> PRE_AUTH_ACTIVE or INVALID
failure after fencing commit -> authenticated result recoverable by idempotency key
```

### 4.3 Shared-state availability

```text
AVAILABLE -> DEGRADED -> UNAVAILABLE -> RECOVERING -> AVAILABLE
```

Protected mutation/read decisions:

- `AVAILABLE`: normal contract behavior;
- `DEGRADED`: only explicitly safe read/teardown actions;
- `UNAVAILABLE` or `RECOVERING`: fail closed; no local fallback.

### 4.4 Retention/deletion

As defined in contract 3.9. Epoch advancement occurs before content exposure can
resume from restore. Partial deletion remains partial and retryable; it is
never collapsed to success.

### 4.5 Operator access

```text
AUTHENTICATED -> ENTITLED -> REASON_CAPTURED -> DUAL_CONTROLLED_IF_REQUIRED -> EXECUTED -> AUDITED
```

Any missing or stale step denies. Audit append failure denies privileged
execution unless the separately approved action is a safe teardown.

## 5. Failure taxonomy

Proposed prerequisite codes:

```text
SUBJECT_ASSERTION_REQUIRED
SUBJECT_ASSERTION_INVALID
SUBJECT_MAPPING_NOT_FOUND
SUBJECT_MAPPING_AMBIGUOUS
SUBJECT_MAPPING_STALE
SUBJECT_DISABLED
SUBJECT_DELETED
SESSION_ELEVATION_REQUIRED
SESSION_ROTATION_FAILED
PRE_AUTH_SESSION_REPLAYED
PRE_AUTH_CSRF_REPLAYED
SHARED_SECURITY_STATE_REQUIRED
SHARED_SECURITY_STATE_UNAVAILABLE
SHARED_SECURITY_STATE_PARTITIONED
SECURITY_STATE_CLOCK_INVALID
RETENTION_POLICY_UNAPPROVED
RETENTION_AUTHORITY_INVALID
LEGAL_HOLD_ACTIVE
DELETION_TARGET_INCOMPLETE
DELETION_VERIFICATION_FAILED
BACKING_STORE_UNRESOLVED
PHYSICAL_DELETION_NOT_PROVEN
ERASURE_STRATEGY_UNAPPROVED
HSTS_POLICY_UNAPPROVED
HTTPS_TERMINATION_UNVERIFIED
TRUSTED_PROXY_POLICY_UNAPPROVED
CLIENT_ADDRESS_AMBIGUOUS
OPERATOR_AUTHENTICATION_REQUIRED
OPERATOR_ENTITLEMENT_INVALID
OPERATOR_REASON_REQUIRED
OPERATOR_DUAL_CONTROL_REQUIRED
OPERATOR_AUDIT_FAILED
PRODUCTION_PREREQUISITE_INACTIVE
```

External errors remain generic and non-enumerating. Audit records use keyed
references and never include raw tokens, assertions, addresses, transcript
content, secrets, or private coach material.

## 6. Candidate implementation file plan

This is an architecture allowlist, not implementation authority.

### 6.1 New modules

- `src/lib/intelligenceFabric/coachConnect/productionSecurity/constants.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/subjectBinding.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/sessionElevation.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/sharedSecurityStatePorts.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/inMemorySharedSecurityState.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/retentionAuthority.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/deletionLifecycle.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/erasureStrategy.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/transportPolicy.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/trustedProxy.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/operatorIdentity.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/audit.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/activation.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js`

### 6.2 Narrow conditional integrations

- `api/internal/developer-access.js`
- `api/internal/developer-access-security.js`
- `api/internal/subscription-entitlement.js`
- `src/lib/intelligenceFabric/coachConnect/security/ports.js`
- `src/lib/intelligenceFabric/coachConnect/security/policy.js`
- `src/lib/intelligenceFabric/coachConnect/security/retention.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/adapter.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/checkpointReplay.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/localJsonlDriver.js`
- `src/lib/intelligenceFabric/index.js`
- `vercel.json` only after Sprint 5 proves an exact production-only mechanism.

Conditional identity-provider, transcript-store, shared-store, and operator
adapter paths cannot be named until the responsible human selects those
boundaries. Their absence blocks the affected sprint rather than expanding this
allowlist silently.

### 6.3 Tests

- `test/intelligenceFabric.coachConnect.productionSecurity.subjectBinding.test.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.sessionElevation.test.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.sharedState.test.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.retention.test.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.deletion.test.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.transport.test.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.operator.test.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.integration.test.js`
- `test/api.internal.developerAccess.productionSecurity.test.js`

### 6.4 Validation and evidence

- `scripts/verifyCoachConnectProductionSecurityPrerequisites.mjs`
- `lab_outputs/coach_connect_production_security_prerequisites_v1/`

No environment files, credentials, runtime data, production snapshots, raw
transcripts, build output, or secret-bearing material may be staged.

## 7. Sprint execution gates

### Sprint 1 — Identity and session elevation

Precondition: `SUBSCRIBER_AUTHORITY_SOURCE` and `SUBSCRIBER_SESSION_OWNER`
approved.

Gate:

- exact issuer/audience/subject/scope binding;
- no client-ID authorization;
- pre-auth and authenticated identifiers differ;
- old CSRF/session/capability state denies;
- account recovery/reassignment is versioned and audited;
- default endpoint still fails closed without the real resolver.

### Sprint 2 — Shared security state

Precondition: `SHARED_STATE_PLATFORM` contract approved, without activation.

Gate:

- two simulated instances observe nonce, replay, rate, revocation, epoch, and lease state;
- adapter outage/partition fails protected operations closed;
- no local fallback in preview/production modes;
- clock/TTL/fencing behavior deterministic;
- adapter remains default-off and no live store is contacted.

### Sprint 3 — Retention authority and deletion state

Precondition: `RETENTION_POLICY_AUTHORITY` and `BACKUP_RESTORE_HORIZON` are
explicitly `APPROVED` in the Human Decision Packet, including the signed
schedule/horizon fields. A deferred decision produces a Sprint 3 blocked
verdict; it does not authorize placeholder execution.

Gate:

- draft policy cannot execute;
- legal hold and request behaviors are distinct;
- partial deletion is never success;
- policy versions/effective dates/migrations are deterministic;
- no arbitrary period enters implementation.

### Sprint 4 — Transcript and historical erasure

Precondition: backing-store inventory, backup horizon, and an approved erasure
strategy.

Gate:

- every store target has a capability and receipt contract;
- restore applies deletion epochs before exposure;
- crash/retry/rollback proof matches selected strategy;
- JSONL physical deletion is claimed only with byte/key/store proof;
- no dual write or silent migration.

### Sprint 5 — Transport and network trust

Precondition: production hosting topology and HSTS directives approved.

Gate:

- HSTS absent local/test/preview/staging/HTTP/ambiguous cases;
- HSTS present only exact verified production case;
- spoofed forwarded headers ignored;
- verified chain deterministic;
- raw address absent from logs/evidence;
- configuration remains default-off.

### Sprint 6 — Operator identity and entitlement

Precondition: operator identity provider and entitlement governance approved.

Gate:

- unauthenticated, developer, revoked, wrong-environment, wrong-tenant, and stale sessions deny;
- every action requires reason and attributable audit;
- dual-control actions require distinct active approver;
- no shared admin code or SUBDEV1 escalation.

### Sprint 7 — Cross-sprint integration

Precondition: Sprints 1–6 are complete or explicitly blocked, and the Human
Decision Packet status of every mandatory decision is carried into the
integration evidence.

Gate:

- all dependency edges revalidated;
- `COMPLETE` is prohibited while any mandatory decision is not explicitly
  `APPROVED`;
- no production action;
- protected roots unchanged;
- complete regression and threat replay;
- final evidence and one honest verdict.

## 8. Migration and compatibility constraints

- No migration runs during architecture or synthetic implementation.
- Existing coach auth records are not subscriber subjects.
- Existing profile/subscriber IDs remain domain identifiers, not auth subjects.
- Existing developer capabilities remain default-off and fail closed until a
  canonical subject resolver is injected.
- Security-state schema changes require explicit version translation; process
  memory is never a migration fallback.
- Retention policy changes preserve the policy version that governed each
  decision and require an explicit migration disposition.
- Deletion epochs are monotonic and survive restore before content reads.
- Erasure strategy changes prohibit dual claims and ambiguous dual write.
- HSTS rollout includes rollback implications before any config mutation.
- Operator entitlements are new governed records, not inferred from existing
  internal/developer roles.
- Existing Stripe and paid entitlement behavior is untouched.
- Existing Business Engine promotion and exactly-once semantics are untouched.

## 9. Repair receipts

Each bounded repair receipt states:

```text
receipt_id
sprint
failed_gate
evidence_reference
root_cause
files_touched
contracts_affected
tests_affected
scope_changed = false
risk_changed
repair_cycle = 1 | 2
result
```

If scope must change, stop for architecture review; do not issue a repair
receipt that disguises expansion.

## 10. Part 2 verdict

`PART_2_IMPLEMENTATION_PLAYBOOK_COMPLETE_WITH_CONDITIONAL_FILE_GATES`

The contract family, state machines, failure taxonomy, candidate allowlist,
sprint gates, tests, and migration constraints are defined. Implementation
remains unauthorized and authority-dependent adapters remain intentionally
unnamed.
