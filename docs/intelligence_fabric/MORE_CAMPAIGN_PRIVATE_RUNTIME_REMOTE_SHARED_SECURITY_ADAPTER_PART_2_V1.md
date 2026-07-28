# MORE Campaign — Private Runtime Remote Shared Security Adapter — Part 2 V1

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_V1`

Part:
`2 — Contracts, Commands, Queries, Health, Audit, Retention, Backup, and Qualification Requirements`

Status:
`AFW EXPANSION — DOCUMENTATION ONLY`

Architecture SHA-256:
`dbca624bf46540d1aae7b698dcffc81a845a10f43a28df70e8f7e22a1c4a0c8a`

Prerequisite commit:
`d0bde035a0519f8e89135204e88cd428ca0d5800`

## 1. Contract layers

The implementation has three layers and one truth:

```text
CanonicalAsyncSecurityServiceV2
  -> exact committed AsyncSecurityStatePortV2
  -> RemoteSharedSecurityAdapterV1
       provider-neutral validation/state machine
       provider-specific Upstash REST and Lua mechanics
  -> one authoritative provider record set
```

The provider-neutral service owns policy. The adapter owns mechanics and
truthful state operations. The provider holds state. No handler, product
runtime, or second store becomes authority.

## 2. Exact V2 method conformance

| Method | Outward schema | Implementation rule |
|---|---|---|
| `describeCapability()` | exact `async-security-capability-description-v2` | configuration projection only; Promise-native; no provider call required |
| `health()` | exact `async-security-health-decision-v2` | active canary only when later authorized/configured; otherwise fail closed |
| `serverTime()` | exact `async-security-server-time-v2` | provider time from write-routed script |
| `queryAuthoritative(query)` | exact `async-security-query-result-v2` | one versioned primary-authoritative Lua script |
| `executeAtomic(command)` | exact `async-security-command-result-v2` | one versioned compare/read/mutate/audit Lua script |

Every method returns a native Promise immediately. Synchronous return,
synchronous throw, multiple settlement, late settlement after deadline,
malformed schema, unknown field, or Promise-object truthiness fails.

## 3. Internal adapter contracts

New provider-internal schemas:

```text
remote-shared-security-adapter-config-v1
remote-shared-security-adapter-capability-v1
remote-shared-security-health-receipt-v1
remote-shared-security-server-time-proof-v1
remote-shared-security-script-manifest-v1
remote-shared-security-script-result-v1
remote-shared-security-error-v1
remote-shared-security-namespace-ownership-v1
remote-shared-security-backup-restore-receipt-v1
```

These schemas may contain configuration, namespace, script, primary-route,
canary, and provider receipt digests. They never contain raw endpoint values,
credentials, provider tokens, key contents, raw database identifiers,
identity material, customer data, or product content.

No internal field may be appended to the committed V2 outward result.

## 4. Configuration validation

`remote-shared-security-adapter-config-v1` includes only non-secret values and
opaque secret references:

```text
enabled=false by default
emergency_disabled=true by default
provider=UPSTASH_REDIS
environment_id
provider_endpoint_ref
provider_credential_ref
provider_database_id_digest
provider_region
namespace_prefix
namespace_digest
adapter_id
contract_version=shared-security-state-async-v2
adapter_contract_version=remote-shared-security-adapter-v1
script_manifest_digest
query_timeout_ms=750 maximum
command_timeout_ms=1500 maximum
operation_deadline_ms=3000 maximum
query_retry_limit<=1
command_retry_limit<=1
breaker and recovery thresholds
audit_retention_days
backup_retention_days
key references and key IDs
telemetry_enabled=false
```

Validation rejects raw URLs or credentials in public configuration, unknown
versions or environments, Global Database, read-region configuration,
shared Preview/Production database or credentials, telemetry, retention over
30 days, zero live retention without approval, and any enabled state lacking
separate qualification and activation receipts.

No environment file is edited by this campaign.

## 5. Error normalization

Internal adapter families:

```text
UNCONFIGURED
CONFIGURATION_INVALID
ENVIRONMENT_MISMATCH
NAMESPACE_MISMATCH
CAPABILITY_MISMATCH
PRIMARY_AUTHORITY_NOT_PROVEN
ATOMICITY_NOT_PROVEN
SERVER_TIME_NOT_PROVEN
PROVIDER_AUTHENTICATION_FAILED
PROVIDER_FORBIDDEN
PROVIDER_RATE_LIMITED
PROVIDER_TIMEOUT
PROVIDER_UNAVAILABLE
PROVIDER_PARTITION_SUSPECTED
PROVIDER_RESPONSE_MALFORMED
SCRIPT_VERSION_MISMATCH
SCRIPT_RUNTIME_FAILURE
IDEMPOTENCY_FINGERPRINT_CONFLICT
RECORD_VERSION_MISMATCH
RECORD_CORRUPT
AUDIT_COMMIT_FAILED
RECOVERY_NOT_PROVEN
```

The port boundary maps these to existing committed V2 failures or rejects the
Promise. No new V2 failure code is added. Raw provider response bodies,
headers, request IDs, and messages do not cross the adapter.

## 6. Provider record schemas and service projections

Each provider record contains exact type/version, environment digest,
provider timestamps, status, epoch, ETag, and only record-specific allowlisted
fields.

The adapter projection matrix is mandatory:

| Provider record | Committed service-facing form |
|---|---|
| `CanonicalSubjectMappingV1` | `canonical-subject-mapping-v1` with exact opaque subject/scope references expected by the service |
| pre-auth session | `pre-auth-private-session-v2` and `session_class=PRE_AUTH` |
| authenticated session | `authenticated-private-session-v2` and `session_class=AUTHENTICATED` |
| `PrivateTestApprovalV1` | `private-test-approval-v1` |
| `TemporaryPrivateEntitlementV2` | `temporary-private-entitlement-v2` |
| `CsrfGrantV2` | internal command comparison; never exposed as raw provider record |
| `SecurityEpochV1` | exact `security_epoch` plus exact scope |
| authority snapshot | mapping, session, approval, entitlement, epoch, evaluation time in one V2 record |

Projection is deterministic, schema-tested, and content-free. It may echo an
already validated opaque query reference after a keyed-digest match; it may
not persist raw material.

## 7. Atomic command matrix

Every command executes in one reviewed write-routed Lua script.

| Command | Compared state | Atomic effect and required race result |
|---|---|---|
| `BIND_APPROVED_CANONICAL_SUBJECT` | forward/inverse mapping, epochs, replay | create both mappings plus audit or neither; one exact owner |
| `BEGIN_PRE_AUTH` | epoch, rate limit, replay, existing intent | rate decision, one pre-auth, audit, replay result |
| `ELEVATE_AUTHENTICATED_SESSION` | pre-auth, mappings, prior session, epochs, replay | consume pre-auth, rotate prior, create one session, invalidate old authority, audit |
| `ISSUE_CSRF_GRANT` | session, mapping, epochs, replay | one single-use grant plus audit |
| `CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT` | mapping, session, approval, CSRF, epochs, rate, active index, replay | consume CSRF; issue at most one temporary unpaid entitlement; audit allow/deny |
| `CLAIM_REPLAY` | replay key, fingerprint, epoch | one immutable claim or exact conflict |
| `COMPLETE_REPLAY` | matching claim and result reference | one completed content-free result |
| `REVOKE_TEMPORARY_ENTITLEMENT` | entitlement, session/index, epochs, replay | terminal revocation, remove active index, audit |
| `REVOKE_RUNTIME_ACCESS` | session, entitlement, mappings, indexes, epochs, replay | revoke all runtime authority and advance epoch with audit |
| `ADVANCE_SECURITY_EPOCH` | exact expected epoch and replay | monotonic compare/increment plus audit |
| `APPLY_RATE_LIMIT` | dimension/window, epoch, replay | exact cross-instance count and decision |
| `APPEND_SECURITY_AUDIT` | uniqueness key, retention, epoch | exactly one allowlisted stream event |

All validation and error-producing type checks precede the first mutation.
Allowed mutation, mandatory audit, and replay completion commit together.
No application `read -> decide -> write`, pipeline, `Promise.all`, local lock,
distributed lock plus separate calls, or compensating exception is atomic.

## 8. Authoritative query matrix

Every query executes as one primary/write-routed versioned Lua script using
provider server time.

| Query | Internally consistent compared state |
|---|---|
| `RESOLVE_CANONICAL_SUBJECT` | forward mapping, inverse scope mapping, environment epoch |
| `RESOLVE_EXACT_SCOPE` | inverse scope uniqueness, mapping, environment and scope epochs |
| `GET_SESSION_BY_TOKEN_HASH` | session, mapping, session/subject/environment/scope epochs, TTL |
| `GET_TEMPORARY_ENTITLEMENT_BY_TOKEN_HASH` | entitlement, session, approval, mapping, epochs, TTLs |
| `GET_PRIVATE_TEST_APPROVAL` | exact approval, mapping, environment/scope epochs, TTL |
| `READ_AUTHORITY_SNAPSHOT` | mapping, inverse, session, approval, entitlement, environment/scope epochs |
| `GET_SECURITY_EPOCH` | environment and exact-scope epoch |
| `GET_REPLAY_RESULT` | replay claim/result, type, fingerprint, TTL |

`READ_AUTHORITY_SNAPSHOT` is the only runtime-authority data source. Separate
queries may support lifecycle or diagnostics but may not be assembled into an
allow. Positive authority is never cached.

## 9. Primary-authority requirement

Prohibited authority primitives:

```text
GET
MGET
pipeline
EVAL_RO
EVALSHA_RO
Global Database nearest-region read
read-region endpoint
client cache
edge cache
process cache
```

Candidate query primitive is write-class `EVAL`/`EVALSHA` with a bounded
heartbeat mutation. Qualification must prove primary/write routing and
acknowledged-write visibility. Provider documentation alone or a successful
`PING` is insufficient.

Failure verdict:
`PRIMARY_AUTHORITY_NOT_PROVEN`.

## 10. Timeout, retry, and idempotency doctrine

| Operation | Retry |
|---|---|
| capability description | no network retry |
| health | at most one within total deadline; never grants authority alone |
| server time | at most one; no allow based on it alone |
| authoritative query | at most one against the same primary path |
| atomic command | at most one exact ambiguous-result recovery |
| configuration/auth/namespace/script/record/fingerprint error | none |
| provider 429 | none for the request; deny and alert |

Every command carries a keyed idempotency hash and canonical fingerprint.
Same key/fingerprint returns the committed safe result. Same key/different
fingerprint fails. A retry never creates a new token, grant, session,
entitlement, fingerprint, or audit.

## 11. Health, circuit breaker, and recovery

States:

```text
UNCONFIGURED
HEALTHY
DEGRADED
UNAVAILABLE
PARTITIONED
RECOVERING
```

Only `HEALTHY` permits a security operation. All other states deny.

The active canary, when separately authorized, proves environment/namespace,
script digest, provider time, write/read, compare/increment, TTL, and
privacy-safe audit in one bounded operation.

Local breaker state may accelerate denial only. Recovery requires three full
canaries, monotonic time and epoch, exact config/script digests, primary-route
proof, atomicity proof, revoked and expired synthetic denials, cleared
critical alert, and recovery audit.

Emergency disable dominates all states, retries, and recovery.

## 12. Audit architecture

Allowed security mutations do not report success unless privacy-safe audit
commits in the same script and authoritative store.

Audit field schemas deny raw or renamed forms of:

```text
token cookie secret credential password code assertion email name address ip
profile transcript prompt message model output business billing stripe
```

A healthy provider appends denial audit. A provider outage denies without
claiming a durable per-request audit. External availability monitoring is not
authority or a local audit queue. Recovery records the outage interval and
audit gap without fabricating events.

## 13. Retention, backup, restore, and deletion

- security TTLs use provider time;
- online audit and backup retention never exceed 30 days;
- actual retention requires named privacy/legal and security ownership;
- restore targets a new empty isolated database, never the active database;
- restored state remains `RECOVERING`;
- current epochs, revocation tombstones, and deletion epochs apply before
  reads;
- current provider time expires stale records;
- revoked or deleted authority never resurrects;
- cache eviction and expiry are not deletion proof;
- no cryptographic-erasure claim is made without separate proof;
- provider account/database deletion is separately authorized destructive
  work.

The AFWs may implement validators, models, and runbook evidence. They do not
create a backup, restore a database, or delete provider state unless a later
qualification prompt explicitly authorizes those disposable operations.

## 14. Provider qualification implementation requirements

Qualification has two gates:

### 14.1 Offline gate

- exact five-method Promise conformance;
- committed schema compatibility and no contract drift;
- deterministic config, record, key, script, and fingerprint digests;
- simulator execution of all commands and queries;
- race and failure matrices;
- restart/recovery model;
- no provider call, secret, customer data, or deployment.

### 14.2 Disposable-provider gate

Runs only under later explicit authority:

- one empty isolated disposable qualification database/namespace;
- temporary least-privilege qualification credentials;
- exact provider/database/namespace attestation;
- primary-authority and acknowledged-write proof;
- atomicity races and failure injection;
- restart, backup/restore, latency, cost, privacy, and teardown proof;
- zero production/customer data;
- verdict `REMOTE_SHARED_SECURITY_ADAPTER_QUALIFIED_NOT_ACTIVATED` or
  `REMOTE_SHARED_SECURITY_ADAPTER_QUALIFICATION_BLOCKED`.

Qualification never binds a deployment credential, modifies Vercel, deploys,
activates an environment, or authorizes a tester.

