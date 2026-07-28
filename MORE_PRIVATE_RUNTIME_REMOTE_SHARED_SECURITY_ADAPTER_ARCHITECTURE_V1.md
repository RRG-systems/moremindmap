# MORE Private Runtime Remote Shared Security Adapter Architecture V1

Mission ID:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_V1`

Mission type:
`TIER_1_ARCHITECTURE_CAMPAIGN`

Repository:
`/Users/rrg/.openclaw/workspace/moremindmap-live`

Repository HEAD:
`46308958085fb84cd3ff6f2f081b8f2944774ecd`

Architecture date:
`2026-07-27`

Implementation authorized: `false`

Provider activation authorized: `false`

Credential access authorized: `false`

Environment change authorized: `false`

Vercel inspection authorized: `false`

Deployment authorized: `false`

Staging, commit, and push authorized: `false`

---

## 1. Executive summary

MORE MindMap should implement one deployment-grade remote adapter for
`shared-security-state-async-v2` using one dedicated, paid, single-region
Upstash Redis database as the initial private-live security store.

That recommendation is conditional, not an activation decision. Current
Upstash documentation describes Redis reads as eventually consistent because
reads may be served by replicas. Ordinary `GET`, `MGET`, pipelines, read
replicas, Global Database reads, SDK caches, or process-local caches therefore
cannot satisfy MORE's authority contract. The Upstash adapter is acceptable
only if a later qualification campaign proves that every authority query and
atomic command executes as one write-routed, primary-authoritative Lua
operation, with server time, compared state, mutations, TTLs, idempotency, and
mandatory audit in that same operation. If the selected Upstash plan, region,
API, or failover behavior cannot prove this, implementation must stop. A
transactional database architecture review is then required; the application
must not compensate with stale reads or application-layer transactions.

The architecture has five non-negotiable layers:

```text
private internal handler
  -> PrivateRuntimeLiveCompositionV2
  -> CanonicalAsyncSecurityServiceV2
  -> AsyncSecurityStatePortV2
  -> one RemoteSharedSecurityAdapterV1
  -> one isolated authoritative provider database
```

Only the Canonical Async Security Service makes security decisions. The
adapter owns provider mechanics, not policy. The provider database contains
one versioned security record set and privacy-safe audit; there is no second
authority store, dual write, V1 fallback, local authority cache, or in-memory
live fallback.

The record model stores keyed digests and opaque references only. It never
stores raw tokens, credentials, access codes, assertions, cookies, names,
email addresses, Profile IDs, network or physical addresses, customer
content, Business Engine payloads, transcripts, prompts, model output, billing
data, or Stripe data.

All security methods remain Promise-native. Only a settled, schema-valid,
internally consistent, provider-time-evaluated result may advance:

```text
authenticated subject
  -> canonical subject
  -> private-test approval
  -> temporary SUBDEV1 entitlement
  -> private-runtime authority
  -> existing runtime attachments
```

Emergency disable and security epochs dominate every path. `UNCONFIGURED`,
`DEGRADED`, `UNAVAILABLE`, `PARTITIONED`, and `RECOVERING` all deny.

Dependency status is explicit: the approved V2 architecture and AFW package
exist, but the V2 implementation files are not present at repository HEAD.
This architecture campaign may complete, but remote-adapter implementation,
qualification, credential binding, and deployment are blocked until the
Promise-only V2 implementation campaign is reviewed and committed.

Architecture verdict:

`PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_ARCHITECTURE_COMPLETE`

## 2. Authoritative inputs

### 2.1 Required prerequisite evidence

| Input | Verified repository fact |
|---|---|
| Async-security architecture packet | Desktop and repository copies both SHA-256 `8c117ab7e40fde69536d67d43558e69dfa3d078f10eaeb0ff88105cfa9117046` |
| Architecture verdict | `PRIVATE_RUNTIME_ASYNC_SECURITY_ENTITLEMENT_ARCHITECTURE_REPAIRED` |
| AFW review package | `PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_AFW_REVIEW_V1.zip` |
| AFW review SHA-256 | `40174c1a9b628fcf5030f69c17aae2bbc997ad874eac01f080b7cc9030b8cbef` |
| AFW artifact count | 12 exact artifacts |
| AFW final verdict | `PRIVATE_RUNTIME_ASYNC_SECURITY_ENTITLEMENT_AFW_EXPANSION_COMPLETE` |
| AFW next campaign | `MORE_CAMPAIGN_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_V1` |
| Repository HEAD | `46308958085fb84cd3ff6f2f081b8f2944774ecd` |
| Live-wiring root-cause receipt | SHA-256 `85e072be173cd3e6c7f24daad4efffc946ecda14edb9a9a70674a27d0bc099ad` |

The authoritative architecture source is:

`/Users/rrg/Desktop/MORE_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_ARCHITECTURE_REPAIR_V1.md`

The repository copy is byte-identical.

### 2.2 Reviewed repository packages

| Package | SHA-256 |
|---|---|
| `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_IMPLEMENTATION_REVIEW_V1.zip` | `28a8f1c9c86618c15adb42a4d095e20a079581ff2f0f114de4e2f930cdae061c` |
| `COACH_CONNECT_DEPLOYMENT_READINESS_IMPLEMENTATION_REVIEW_V1.zip` | `2d4e720423e892b44ed4699f70a0ec78de714f7faf8b760870ac1395973f1305` |
| `COACH_CONNECT_INTERNAL_DEFAULT_OFF_DEPLOYMENT_IMPLEMENTATION_REVIEW_V1.zip` | `9f52981e5759c78faf95a19c6e503206a7b1028a4dad8687c5e027abee50b304` |
| `COACH_CONNECT_PRIVATE_LIVE_TEST_DEPLOYMENT_IMPLEMENTATION_REVIEW_V1.zip` | `c60caf3dcc2d8de8cb4dae2e4e3038ef4830d32d700eebbd7c2bab5facc6ec54` |

These packages are evidence. They do not authorize provider access,
configuration, credentials, or deployment.

### 2.3 Governing ratification

The Production Security Prerequisites ratification is
`APPROVED_WITH_RATIFIED_REFINEMENTS` and preserves:

- Auth0 behind a provider-neutral OIDC assertion contract;
- a server-owned opaque rotating BFF session;
- a conditional Upstash Redis shared-security adapter;
- Vercel as the initial hosting edge;
- later private unversioned S3 transcript storage, outside this adapter;
- security control-metadata backup retention no longer than 30 days;
- no transcript backup;
- deletion epochs and tombstones restored before restored state becomes
  readable.

The Upstash decision is conditional on durable authoritative state, atomicity,
server time and TTL, backup/restore, regional placement, outage handling,
read-after-eviction durability, and fail-closed behavior. Eviction is not
deletion proof. This packet applies those refinements literally.

## 3. Repository grounding

### 3.1 Current V1 and synthetic state

The repository currently contains:

- `productionSecurity/sharedSecurityStatePorts.js`, a synchronous V1
  deployment-capability contract;
- `productionSecurity/inMemorySharedSecurityState.js`, synthetic and
  non-deployment-grade;
- `security/ports.js` and `security/inMemorySecurityStateStore.js`, the
  separate synchronous developer-access store;
- private-runtime subject, authority, activation, composition, and attachment
  contracts;
- default-off internal handlers;
- an inactive, injected Redis-shaped product event-store pattern under
  `src/lib/intelligenceFabric/production/`.

The product event-store adapter is not a security store and is a protected
root. It may inform dependency-injection style only. It must not be imported,
extended, dual-written, or treated as an authority fallback.

### 3.2 Ratified provider context

Repository ratification and deployment doctrine are consistent:

| Concern | Ratified initial choice | Boundary |
|---|---|---|
| Shared security state | Upstash Redis, conditional | One isolated remote security database only |
| Hosting edge | Vercel | Provider classification does not imply public launch |
| Subscriber identity | Auth0 behind OIDC port | Outside this adapter; no provider activation |
| Later transcript/object storage | Private unversioned S3 | Not part of security authority; no transcript activation |

No repository evidence authorizes replacing these choices silently. No
repository evidence requires such replacement for architecture.

### 3.3 Current and repaired call graphs

Current:

```text
default private handlers
  -> disabled/null factory bindings
  -> deny

developer access
  -> synchronous in-memory developer store
  -> missing canonical subject and runtime authority resolvers
  -> deny in deployment-shaped environments

private-runtime bridge
  -> available only through injected composition
  -> one Business Engine
  -> existing Subscription Runtime
  -> existing Coach Connect
```

Repaired architecture:

```text
default-off internal handler
  -> one V2 live composition
  -> one CanonicalAsyncSecurityServiceV2
  -> one AsyncSecurityStatePortV2
  -> one RemoteSharedSecurityAdapterV1
  -> one environment-isolated Upstash security database

authority query
  -> one write-routed primary Lua snapshot
  -> provider server time
  -> mapping + session + approval + entitlement + epoch
  -> one versioned result
  -> service policy evaluation
  -> existing private-runtime bridge
```

No handler calls Upstash. No product runtime calls Upstash. No provider record
is exposed above the adapter.

## 4. Exact dependency status

The approved V2 contract is architecturally complete but not implemented at
the verified HEAD. The following expected implementation files are absent:

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSharedSecurityStatePort.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/syntheticAsyncSecurityStateAdapter.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/canonicalAsyncSecurityService.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/developerAccessSecurityFacade.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/eligibility.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js
```

Dependency decision:

```text
architecture work: MAY PROCEED
remote adapter implementation: BLOCKED
remote adapter qualification: BLOCKED
provider credential binding: BLOCKED
private-live deployment: BLOCKED
```

Remote adapter implementation may start only after:

1. the seven-sprint V2 implementation has an approved review package;
2. the V2 implementation is committed;
3. the committed contract schemas match this packet materially;
4. a separate AFW explicitly authorizes adapter implementation;
5. the implementation allowlist is reconciled against the committed V2
   imports.

Any material V2 drift requires architecture review, not improvisation in the
adapter.

## 5. Provider evaluation

### 5.1 Evaluation criteria

The provider must support:

- connectionless or serverless-safe access;
- one-command compare/read/mutate/audit atomicity;
- authoritative server time and TTL;
- durable state and restart recovery;
- distributed rate limiting and replay claims;
- internally consistent authority snapshots;
- explicit timeouts and normalized failures;
- isolated databases or equivalent hard environment boundaries;
- TLS, credential rotation, encryption at rest, backup, restore, monitoring,
  and named operator controls;
- bounded cost and no product-content storage.

### 5.2 Comparison

| Option | Fit | Strengths | Material risks and cost/operations |
|---|---|---|---|
| Dedicated regional Upstash Redis | Recommended, conditional | HTTP/REST is serverless-safe; Lua and transactions; Redis TTL/data structures; persistence; paid replication; ratified repository choice; low application impedance | Upstash documents reads as eventually consistent; ordinary reads are disqualified. Primary/write routing for read-only authority scripts must be proven. Prod Pack is a material fixed add-on; backup retention in current standard plans is shorter than MORE's 30-day maximum, which is acceptable only if the approved actual schedule is documented. |
| Redis Cloud paid/Pro | Qualified fallback candidate, not selected | Managed Redis, TLS/RBAC, persistence options, backups, Lua/transactions, mature operational controls | TCP connection lifecycle or provider-specific serverless connectivity adds complexity; plan and topology must prove primary-authoritative reads; switching would depart from ratified initial choice and requires review. |
| Transactional Postgres, such as Neon | Architectural fallback, not selected | ACID transactions, constraints, row locks, serializable patterns, durable relational audit, serverless HTTP/WebSocket drivers | TTL, distributed rate limiting, expiry cleanup, and high-frequency security commands need more schema and operations; interactive transactions have serverless connection constraints; this is a provider change requiring ratification. |

### 5.3 Official provider evidence used

The future AFW must re-check current provider documentation before
implementation. Architecture grounding on `2026-07-27`:

- Upstash serverless HTTP, durability, and Redis compatibility:
  `https://upstash.com/redis`
- Upstash durability:
  `https://upstash.com/docs/redis/features/durability`
- Upstash consistency and replica behavior:
  `https://upstash.com/docs/redis/features/consistency`
- Upstash replication:
  `https://upstash.com/docs/redis/features/replication`
- Upstash Global Database eventual consistency:
  `https://upstash.com/docs/redis/features/globaldatabase`
- Upstash REST transactions and scripting:
  `https://upstash.com/docs/redis/features/restapi`
- Upstash Lua `EVAL`:
  `https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval`
- Upstash key-based locking:
  `https://upstash.com/docs/redis/features/key-locking`
- Upstash command compatibility, including server time:
  `https://upstash.com/docs/redis/overall/compatibility`
- Upstash backup and restore:
  `https://upstash.com/docs/redis/features/backup`
- Upstash production checklist:
  `https://upstash.com/docs/redis/help/production-checklist`
- Upstash pricing:
  `https://upstash.com/pricing/redis`
- Redis Cloud TLS, persistence, and backup:
  `https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/`,
  `https://redis.io/docs/latest/operate/rc/databases/configuration/data-persistence/`,
  `https://redis.io/docs/latest/operate/rc/databases/back-up-data/`
- Neon serverless driver:
  `https://neon.com/docs/serverless/serverless-driver`

This architecture does not rely on marketing claims as proof of qualification.
Live capability is established only by the later qualification gates.

## 6. Recommended initial provider

### 6.1 Decision

Recommend:

```text
provider: Upstash Redis
topology: dedicated regional database
plan: paid plan plus Prod Pack or an enterprise configuration meeting every gate
read regions: none
Global Database: prohibited for V1 authority
runtime placement: same reviewed primary region as the isolated private-live runtime
transport: server-side HTTPS REST
authority operation: versioned write-routed Lua script only
eviction: disabled unless read-after-eviction durability is independently proven
telemetry: provider SDK telemetry disabled
```

No product data may share the database. Preview and private
production-classified environments require separate databases and separate
credentials, not only prefixes.

### 6.2 Why Upstash fits

- HTTP eliminates persistent socket and pool assumptions across serverless
  cold starts.
- Lua can compare records and conditionally mutate them as one atomic
  operation.
- Redis native expiry suits sessions, CSRF, replay, rate limits, and temporary
  entitlements.
- Redis Streams can hold privacy-safe audit in the same provider and atomic
  script.
- Persistence and backup support restart and recovery evidence.
- The repository has already ratified Upstash conditionally.
- Provider-specific code can stay below one V2 adapter, containing lock-in.

### 6.3 Consistency qualification gate

Upstash's documented eventual-consistency model is the central risk.

The adapter must never call ordinary read commands for security authority.
Every query, including `READ_AUTHORITY_SNAPSHOT`, must execute through a
provider operation that qualification proves:

1. is routed to the current primary/leader path;
2. observes every previously acknowledged security write required by the
   operation;
3. reads all compared keys at one logical point under the required lock;
4. uses provider server time;
5. is not served from a read replica, client cache, edge cache, or local
   cache;
6. fails during leader ambiguity or partition rather than returning a
   potentially stale allow.

The initial candidate primitive is write-class `EVAL`/`EVALSHA`, with a
bounded security-epoch heartbeat mutation in the same script so that the
operation is not classified as read-only. `EVAL_RO`, `EVALSHA_RO`, `GET`,
`MGET`, pipelines, Global Database nearest-region reads, and read-region
endpoints are prohibited.

Provider documentation found during this campaign does not by itself prove
the six requirements. The future qualification must obtain provider
attestation and live disposable-namespace evidence. Failure is
`PRIMARY_AUTHORITY_NOT_PROVEN` and stops Upstash implementation.

### 6.4 Atomicity qualification gate

`MULTI/EXEC` is not enough for commands whose mutations depend on values read
inside the command. Redis-style transactions also do not roll back runtime
errors. Each complex command therefore uses a versioned Lua script that:

- validates all arguments before mutation;
- reads and compares all required records;
- decides allow/deny;
- performs every mutation and TTL change;
- appends the mandatory audit record;
- writes the idempotency result;
- returns one normalized result.

Any uncaught script error after mutation is a qualification failure. Scripts
must be designed so all possible error-producing validation occurs before the
first mutation and all later operations are type-safe and bounded.

### 6.5 Latency, operational complexity, and cost

The adapter must record p50, p95, p99, cold-start, retry, and provider-time
latency during qualification. Architecture budgets are:

| Operation | Per-attempt timeout | Total operation deadline |
|---|---:|---:|
| `describeCapability()` configuration-only | 25 ms | 25 ms |
| `health()` active canary | 1,500 ms | 3,000 ms |
| `serverTime()` | 750 ms | 1,500 ms |
| authoritative query | 750 ms | 1,500 ms |
| atomic command | 1,500 ms | 3,000 ms |

These are fail-closed ceilings, not provider SLA claims. Qualification must
set lower operational alerts from measured behavior; a later deployment
cannot raise them without review.

At the time of this packet, Upstash publishes usage-based or fixed plans and
a material per-database Prod Pack add-on for SLA, multi-zone HA, encryption at
rest, and monitoring. Exact prices are procurement inputs and may change.
Cost qualification must count Lua subcommands, audit growth, backups,
replication bandwidth, canaries, and worst-case retry traffic. Cost pressure
may never disable audit, durability, isolation, or fail-closed behavior.

### 6.6 Vendor-lock-in containment

Provider-specific concepts are confined to:

- the Upstash adapter;
- Lua script sources and script digests;
- configuration normalization;
- error-code mapping;
- capability/health evidence.

Canonical service inputs, outputs, records, decisions, and failure codes stay
provider-neutral. No provider client, response, exception, key name, Lua
return tuple, or credential leaks above `AsyncSecurityStatePortV2`.

## 7. Provider-neutral adapter boundary

### 7.1 Boundary

```text
CanonicalAsyncSecurityServiceV2
  owns: identity order, eligibility, entitlement policy, runtime policy

AsyncSecurityStatePortV2
  owns: Promise-only contract and schema validation

RemoteSharedSecurityAdapterV1
  owns: provider configuration, key encoding, atomic scripts, queries,
        TTL, server time, retries, health, normalized errors

provider database
  owns: durable records and execution primitives
```

No adapter method accepts a request/response object, cookie, raw token,
identity assertion, access code, product object, transcript, or model data.

### 7.2 Exact interface

```js
{
  describeCapability(): Promise<CapabilityDescription>,
  health(): Promise<HealthDecision>,
  serverTime(): Promise<ServerTimeReceipt>,
  queryAuthoritative(query): Promise<QueryResult>,
  executeAtomic(command): Promise<CommandResult>
}
```

Every method must return a native Promise immediately, settle once, validate
after settlement, and either return an exact versioned result or reject with a
normalized adapter error. A synchronous return is
`ASYNC_SECURITY_CONTRACT_VIOLATION`.

### 7.3 No-provider-client leakage

The adapter translates:

```text
provider HTTP status / body / timeout / script tuple
  -> RemoteSecurityAdapterErrorV1 or exact V2 result
```

Callers never receive:

- a Redis client;
- REST URL or token;
- HTTP headers;
- provider request IDs that contain unsafe data;
- raw provider error text;
- Redis records or key names;
- script SHA internals, except an approved digest in capability evidence;
- provider-specific retry hints as authority.

## 8. Adapter contract

### 8.1 Capability description

Required deployment candidate values:

```json
{
  "contract_version": "shared-security-state-async-v2",
  "adapter_contract_version": "remote-shared-security-adapter-v1",
  "adapter_id": "opaque-reviewed-id",
  "adapter_class": "REMOTE_DEPLOYMENT_CANDIDATE",
  "provider_class": "REMOTE_SHARED_SECURITY_STATE",
  "provider_name": "UPSTASH_REDIS",
  "environment_id": "opaque",
  "namespace_digest": "sha256",
  "available": true,
  "deployment_grade": false,
  "promise_native": true,
  "authoritative_reads": "PRIMARY_ATOMIC_SCRIPT_REQUIRED",
  "atomic_command_model": "VERSIONED_LUA_SCRIPT",
  "server_time_ttl": true,
  "durable_security_records": true,
  "durable_privacy_safe_audit": true,
  "restart_safe": true,
  "outage_behavior": "FAIL_CLOSED",
  "partition_behavior": "FAIL_CLOSED",
  "no_local_fallback": true,
  "stores_product_content": false,
  "stores_transcripts": false,
  "stores_raw_identity_material": false,
  "live_connection_verified": false,
  "script_manifest_digest": "sha256",
  "configuration_digest": "sha256"
}
```

Architecture or implementation alone must leave `deployment_grade` and
`live_connection_verified` false. Only a separately authorized qualification
receipt may set them true for one exact adapter artifact, configuration
digest, environment, namespace, provider account, region, and script manifest.

### 8.2 Input envelopes

Queries keep the approved `async-security-query-v2` schema. Commands keep the
approved `async-security-command-v2` schema. The adapter adds no
authority-bearing fields. It rejects:

- unknown fields or versions;
- missing environment, correlation, idempotency, or fingerprint fields;
- raw token-like, cookie-like, assertion-like, code-like, email-like, address,
  content, prompt, or transcript values;
- noncanonical JSON, oversized values, duplicate keys, unsafe Unicode
  normalization, or unbounded arrays;
- environment or namespace mismatch;
- query consistency other than `PRIMARY_OR_LINEARIZABLE`.

Maximum serialized envelope size is 16 KiB. Record-specific limits are lower
and must be declared in the script manifest.

### 8.3 Output schemas

Queries return only `async-security-query-result-v2`. Commands return only
`async-security-command-result-v2`. Health and time use:

```json
{
  "decision_version": "remote-security-health-decision-v1",
  "state": "HEALTHY",
  "allowed_for_security": true,
  "environment_id": "opaque",
  "adapter_id": "opaque",
  "provider_class": "REMOTE_SHARED_SECURITY_STATE",
  "server_time_ms": 0,
  "configuration_digest": "sha256",
  "script_manifest_digest": "sha256",
  "primary_authority_proven": true,
  "atomic_script_proven": true,
  "canary_receipt_ref": "opaque",
  "evaluated_at_ms": 0,
  "expires_at_ms": 0,
  "failure_code": null
}
```

```json
{
  "receipt_version": "remote-security-server-time-v1",
  "server_time_ms": 0,
  "source": "PROVIDER_SERVER_TIME_INSIDE_PRIMARY_SCRIPT",
  "maximum_observed_skew_ms": 0,
  "receipt_ref": "opaque"
}
```

`allowed_for_security` is true only in `HEALTHY`.

### 8.4 Timeout and retry semantics

- timeout is an ambiguous outcome, never a denial proof or success proof;
- ambiguous command results enter idempotent recovery using the exact same
  key and fingerprint;
- operation deadline includes all attempts;
- aborting the HTTP request does not prove provider cancellation;
- late provider responses are discarded;
- no caller receives an allow from a response that arrives after deadline;
- provider 401/403, malformed response, wrong script digest, region mismatch,
  or namespace mismatch opens the breaker immediately;
- provider 429/5xx/timeout fails closed.

### 8.5 Idempotency

Every retryable command includes:

```text
idempotency_key_hash = HMAC-SHA-256(environment key, stable operation id)
fingerprint = SHA-256(canonical command type + canonical safe arguments)
```

The atomic script compares both. Same key and same fingerprint returns the
committed result reference. Same key and different fingerprint returns
`IDEMPOTENCY_FINGERPRINT_CONFLICT`. The result contains no raw secret or
identity data.

### 8.6 Error normalization

Exact adapter error families:

```text
UNCONFIGURED
CONFIGURATION_INVALID
ASYNC_SECURITY_CONTRACT_VIOLATION
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

Raw provider messages are retained only in provider-controlled logs available
to named operators. Application logs contain normalized code, safe receipt
reference, environment ID, adapter ID, and correlation reference only.

## 9. Record and keyspace model

### 9.1 Common rules

All live keys use:

```text
more:cc:security:v2:{<environment_digest>}:<record-family>:<opaque-digest>
```

The literal environment digest is a keyed digest of the reviewed immutable
environment identifier. The hash tag keeps one environment's atomic keys in a
single Redis cluster slot if a compatible provider later shards data.

Preview and private production-classified environments use separate
databases. The key prefix is defense in depth, not their isolation boundary.

Every record includes:

```text
record_type
record_version
environment_digest
created_at_ms
updated_at_ms
status
security_epoch
record_etag
```

Provider server time supplies all timestamps. Unknown record type/version,
missing fields, impossible chronology, TTL mismatch, environment mismatch, or
digest mismatch denies and emits a corruption signal.

Raw secrets are represented by keyed digests:

```text
token_lookup = HMAC-SHA-256(token_hash_key, raw token)
external_subject_lookup = HMAC-SHA-256(identity_hash_key, issuer + subject)
scope_digest = HMAC-SHA-256(scope_hash_key, canonical exact scope)
```

Hash keys are independently rotatable server-side secrets. Records carry only
non-secret key IDs. Raw values never cross the adapter boundary or enter the
store.

### 9.2 Exact records

| Record | Key pattern | TTL and deletion | Mutability and indexes | Privacy |
|---|---|---|---|---|
| `CanonicalSubjectMappingV1` | `...:subject:external:<external_subject_digest>` plus uniqueness key `...:subject:scope:<scope_digest>` | No operational TTL while active. Disable before deletion; tombstone retained under approved schedule. Restore applies tombstone before readability. | Immutable subject/scope binding; status, security version, and disable metadata may advance. Two keys are created/compared atomically. | Restricted security metadata; opaque refs and keyed digests only. |
| `AuthenticatedSubscriberSessionV1` | `...:session:token:<token_lookup>` | TTL at `min(session expiry, policy maximum)`; revoked terminal record retained until original expiry plus bounded replay window. | Status, rotation ref, session epoch, last authoritative access bucket. Indexed by opaque session ref and subject-session set. | Restricted; no cookie or identity assertion. |
| `PrivateTestApprovalV1` | `...:approval:<subject_ref_digest>:<scope_digest>` | Exact approval expiry; revoked/expired terminal status. No auto-renewal. | Governed issuer ref, purpose, approval epoch, status, version. No route can create it. | Restricted control metadata. |
| `TemporaryPrivateEntitlementV2` | `...:entitlement:token:<token_lookup>` | TTL is earliest of entitlement, session, approval, environment activation, and policy expiry. Terminal status never reactivates. | Status, session ref, subject ref, scope, epochs, false authority flags. Indexed by session and subject for bounded revocation. | Restricted; no raw `SUBDEV1`, token, or billing data. |
| `CsrfGrantV2` | `...:csrf:<grant_lookup>` | Short single-use TTL; consumed or expired records kept only through replay window. | Session/browser/route/intent bindings; status changes `ACTIVE -> CONSUMED`. | Restricted; keyed digest only. |
| `SecurityReplayClaimV2` | `...:replay:<idempotency_key_hash>` | Command-specific TTL at least the maximum ambiguous-retry and response-recovery window; never shorter than related CSRF/session race window. | Fingerprint immutable; state `CLAIMED -> COMPLETED`; content-free result ref. | Internal security metadata. |
| `SecurityRateLimitV2` | `...:rate:<policy_id>:<dimension_digest>:<window_id>` | Window plus cooldown and clock-skew allowance. | Atomic count, limit, reset time, denial count; server time only. | Pseudonymous security metadata; no raw IP or address. |
| `SecurityEpochV1` | `...:epoch:<scope_digest>` and `...:epoch:environment` | No TTL while environment or scope exists. Deletion only after terminal decommission proof. | Monotonic integer, reason code, last audit ref. Never decremented, including restore. | Restricted control metadata. |
| `PrivacySafeSecurityAuditV2` | Redis Stream `...:audit` plus `...:audit-unique:<audit_id_hash>` | Online retention no more than approved schedule, maximum 30 days. Backup retention maximum 30 days. | Append-only event; correction is a new event. Unique key prevents duplicate append. | Pseudonymous security event only; exact field allowlist. |
| Adapter health metadata | `...:adapter:canary:<nonce_digest>` and `...:adapter:recovery` | Canary TTL 60 seconds; recovery metadata retained no more than 30 days. | Health generation, script/config digests, safe canary refs. Never used as a cached allow. | Operational metadata only. |

### 9.3 Record schemas

`CanonicalSubjectMappingV1`:

```json
{
  "record_type": "canonical-subject-mapping-v1",
  "record_version": 1,
  "environment_digest": "hmac-sha256",
  "external_subject_digest": "hmac-sha256",
  "subscriber_subject_ref": "opaque",
  "scope_digest": "hmac-sha256",
  "subject_security_version": 1,
  "status": "ACTIVE_OR_DISABLED",
  "subscriber_confirmed": true,
  "auto_enrolled": false,
  "security_epoch": 1,
  "created_at_ms": 0,
  "updated_at_ms": 0,
  "record_etag": "sha256"
}
```

`AuthenticatedSubscriberSessionV1`:

```json
{
  "record_type": "authenticated-subscriber-session-v1",
  "record_version": 1,
  "environment_digest": "hmac-sha256",
  "session_ref": "opaque",
  "token_lookup": "hmac-sha256",
  "subscriber_subject_ref": "opaque",
  "scope_digest": "hmac-sha256",
  "browser_binding_digest": "hmac-sha256",
  "subject_security_version": 1,
  "session_epoch": 1,
  "security_epoch": 1,
  "status": "PRE_AUTH_OR_ACTIVE_OR_ROTATED_OR_REVOKED",
  "issued_at_ms": 0,
  "expires_at_ms": 0,
  "rotated_to_ref": "opaque-or-null",
  "created_at_ms": 0,
  "updated_at_ms": 0,
  "record_etag": "sha256"
}
```

`PrivateTestApprovalV1`:

```json
{
  "record_type": "private-test-approval-v1",
  "record_version": 1,
  "environment_digest": "hmac-sha256",
  "approval_ref": "opaque",
  "subscriber_subject_ref": "opaque",
  "scope_digest": "hmac-sha256",
  "purpose": "TEMPORARY_PRIVATE_SUBSCRIPTION_TEST",
  "status": "ACTIVE_OR_REVOKED_OR_EXPIRED",
  "approval_epoch": 1,
  "security_epoch": 1,
  "issued_at_ms": 0,
  "expires_at_ms": 0,
  "created_at_ms": 0,
  "updated_at_ms": 0,
  "record_etag": "sha256"
}
```

`TemporaryPrivateEntitlementV2`:

```json
{
  "record_type": "temporary-private-entitlement-v2",
  "record_version": 2,
  "environment_digest": "hmac-sha256",
  "entitlement_ref": "opaque",
  "token_lookup": "hmac-sha256",
  "subscriber_subject_ref": "opaque",
  "session_ref": "opaque",
  "scope_digest": "hmac-sha256",
  "browser_binding_digest": "hmac-sha256",
  "subject_security_version": 1,
  "session_epoch": 1,
  "approval_epoch": 1,
  "security_epoch": 1,
  "status": "ACTIVE_OR_EXPIRED_OR_REVOKED_OR_ROTATED_OR_EMERGENCY_REVOKED",
  "source": "TEMPORARY_INTERNAL_SUBSCRIPTION_ENTITLEMENT",
  "access_type": "MORE_MONTHLY_INTELLIGENCE",
  "temporary": true,
  "paid_entitlement": false,
  "admin_authority": false,
  "operator_authority": false,
  "deployment_authority": false,
  "billing_authority": false,
  "canonical_mutation_authority": false,
  "issued_at_ms": 0,
  "expires_at_ms": 0,
  "created_at_ms": 0,
  "updated_at_ms": 0,
  "record_etag": "sha256"
}
```

`CsrfGrantV2`:

```json
{
  "record_type": "csrf-grant-v2",
  "record_version": 2,
  "environment_digest": "hmac-sha256",
  "grant_ref": "opaque",
  "grant_lookup": "hmac-sha256",
  "session_ref": "opaque",
  "browser_binding_digest": "hmac-sha256",
  "route_id": "allowlisted-opaque",
  "intent": "allowlisted-opaque",
  "session_epoch": 1,
  "security_epoch": 1,
  "status": "ACTIVE_OR_CONSUMED",
  "issued_at_ms": 0,
  "expires_at_ms": 0,
  "consumed_at_ms": 0,
  "created_at_ms": 0,
  "updated_at_ms": 0,
  "record_etag": "sha256"
}
```

`SecurityReplayClaimV2`:

```json
{
  "record_type": "security-replay-claim-v2",
  "record_version": 2,
  "environment_digest": "hmac-sha256",
  "idempotency_key_hash": "hmac-sha256",
  "fingerprint": "sha256",
  "command_type": "allowlisted",
  "state": "CLAIMED_OR_COMPLETED",
  "result_ref": "opaque-or-null",
  "claim_expires_at_ms": 0,
  "created_at_ms": 0,
  "updated_at_ms": 0,
  "record_etag": "sha256"
}
```

`SecurityRateLimitV2`:

```json
{
  "record_type": "security-rate-limit-v2",
  "record_version": 2,
  "environment_digest": "hmac-sha256",
  "policy_id": "allowlisted",
  "dimension_digest": "hmac-sha256",
  "window_id": "server-time-derived",
  "count": 0,
  "limit": 0,
  "window_started_at_ms": 0,
  "resets_at_ms": 0,
  "blocked_until_ms": 0,
  "created_at_ms": 0,
  "updated_at_ms": 0,
  "record_etag": "sha256"
}
```

`SecurityEpochV1`:

```json
{
  "record_type": "security-epoch-v1",
  "record_version": 1,
  "environment_digest": "hmac-sha256",
  "scope_digest": "hmac-sha256-or-environment",
  "epoch": 1,
  "status": "ACTIVE_OR_EMERGENCY_DISABLED_OR_RETIRED",
  "reason_code": "allowlisted",
  "last_audit_receipt_ref": "opaque",
  "created_at_ms": 0,
  "updated_at_ms": 0,
  "record_etag": "sha256"
}
```

`PrivacySafeSecurityAuditV2`:

```json
{
  "record_type": "privacy-safe-security-audit-v2",
  "record_version": 2,
  "audit_id_hash": "hmac-sha256",
  "event_type": "allowlisted",
  "decision": "ALLOWED_OR_DENIED_OR_OBSERVED",
  "failure_code": "allowlisted-or-null",
  "environment_digest": "hmac-sha256",
  "subject_ref": "opaque-or-null",
  "scope_digest": "hmac-sha256-or-null",
  "session_ref": "opaque-or-null",
  "entitlement_ref": "opaque-or-null",
  "security_epoch": 1,
  "correlation_ref": "opaque",
  "occurred_at_ms": 0,
  "adapter_id": "opaque",
  "configuration_digest": "sha256",
  "details": {}
}
```

`details` has event-specific exact schemas. Arbitrary key/value details are
forbidden.

### 9.4 TTL rules

- the provider's server time, never application time, determines expiry;
- every TTL is written inside the same atomic script as the record;
- scripts store `expires_at_ms` and set `PEXPIREAT`;
- queries require both `server_time_ms < expires_at_ms` and a compatible
  positive provider TTL;
- missing TTL on an expiring active record is corruption and denies;
- an unexpectedly shorter TTL denies and alerts;
- an unexpectedly longer TTL cannot extend authority beyond
  `expires_at_ms`;
- backup retention never extends runtime validity after restore because
  server time, status, and epoch are revalidated.

### 9.5 Encryption assumptions

- TLS is mandatory in transit;
- provider encryption at rest is mandatory for Preview and private
  production-classified databases;
- independent provider credentials exist per environment;
- keyed digests prevent raw-token and raw-subject storage;
- application-level encryption may protect optional opaque, non-compared
  metadata only;
- fields used by scripts for comparisons, increments, indexes, time, or
  atomic decisions cannot be client-encrypted in a way that defeats those
  operations;
- the packet makes no cryptographic-erasure claim for provider backups.

## 10. Authoritative queries

### 10.1 Query doctrine

Every query is one versioned primary-authoritative Lua script. A query script
may perform a bounded heartbeat write to force the provider's write/leader
path. Query results carry script digest, server time, environment digest,
record versions, and a safe receipt ref. No security decision is assembled
from multiple provider round trips.

| Query | Compared records | Result and denial rules |
|---|---|---|
| `RESOLVE_CANONICAL_SUBJECT` | External-subject mapping, inverse scope mapping, environment epoch | Returns exactly one active mapping whose forward and inverse records agree. Unknown, disabled, duplicate, mismatched, or corrupt denies. Never binds. |
| `RESOLVE_EXACT_SCOPE` | Scope uniqueness key, subject mapping, environment/scope epochs | Returns one scope ownership decision. Ambiguity or subject mismatch denies. |
| `GET_SESSION_BY_TOKEN_HASH` | Session, mapping, session/subject/environment/scope epochs, TTL | Returns active session only if all versions and bindings match at provider time. |
| `GET_TEMPORARY_ENTITLEMENT_BY_TOKEN_HASH` | Entitlement, session, approval, mapping, epochs, TTLs | Returns active temporary unpaid entitlement only when every binding matches. |
| `GET_PRIVATE_TEST_APPROVAL` | Approval, mapping, scope/environment epochs, TTL | Returns active exact approval; no broad subject-only approval. |
| `READ_AUTHORITY_SNAPSHOT` | Mapping, inverse scope, session, approval, entitlement, environment epoch, scope epoch | Returns one internally consistent snapshot and a single maximum validity instant. Any missing, stale, mismatched, unhealthy, expired, paid, or elevated-authority field denies. |
| `GET_SECURITY_EPOCH` | Environment and exact-scope epoch | Returns monotonic maximum and status. Missing epoch in a configured live namespace denies. |
| `GET_REPLAY_RESULT` | Replay claim/result, command type, fingerprint, TTL | Returns only exact matching completed content-free result. Conflict, claimed-incomplete, or expired denies/recovery-pends. |

### 10.2 `READ_AUTHORITY_SNAPSHOT`

The script must:

1. validate environment, namespace, script version, and all input digests;
2. obtain provider server time;
3. read environment and scope epochs;
4. read the session by token lookup;
5. read the canonical mapping and inverse scope binding;
6. read the exact private-test approval;
7. read the temporary entitlement by token lookup;
8. validate record types, versions, status, TTL, and `expires_at_ms`;
9. compare environment, subject, scope, browser, security version, session
   epoch, approval epoch, and entitlement bindings;
10. require every entitlement authority flag except temporary subscription
    access to be false;
11. require emergency disable false at both environment and scope;
12. compute `snapshot_valid_until_ms` as the earliest relevant expiry;
13. perform the qualified write-path heartbeat;
14. return one normalized snapshot or one normalized deny code.

The service still evaluates requested runtime/action allowlists. The adapter
does not grant Business Engine, Subscription Runtime, Coach Connect, operator,
admin, deployment, billing, coach, or canonical truth authority.

### 10.3 Cache rule

Positive authority results are never cached. A process may cache:

- immutable script source by reviewed digest;
- validated non-secret static configuration;
- a circuit-breaker denial;
- a capability description whose `deployment_grade` remains false until
  exact qualification.

It may not cache a mapping, session, approval, entitlement, epoch, rate limit,
replay result, provider time, health allow, or runtime allow.

## 11. Atomic commands

### 11.1 Command doctrine

Each command maps to one reviewed Lua script version. The script manifest
binds:

```text
command type
script source SHA-256
allowed record types and versions
maximum key count
maximum argument size
maximum audit size
expected return schema
required provider primitive
```

All preconditions and potentially error-producing type checks occur before the
first mutation. No application-layer `read -> decide -> write` sequence may
claim atomicity. A command returns success only if its mandatory audit receipt
and idempotency result committed in the same script.

### 11.2 `BIND_APPROVED_CANONICAL_SUBJECT`

- Preconditions: separately governed subscriber confirmation; immutable
  verified external-subject digest; approved subscriber ref and exact scope;
  current environment/scope epoch; no emergency disable; no runtime route
  origin.
- Compared records: external mapping, inverse scope mapping, epochs,
  idempotency claim.
- Atomic mutations: create forward and inverse mapping with `NX`; append audit;
  complete idempotency result.
- TTL: no active mapping TTL; replay and audit use their schedules.
- Race: competing bindings serialize. Exact same binding and fingerprint is
  idempotent; any different subject or scope is
  `CANONICAL_SUBJECT_CONFLICT`.
- Failure/rollback: no mapping key may exist without its inverse and audit.
  Script validation or audit failure leaves all absent.
- Primitive: one write-routed Lua script.

### 11.3 `BEGIN_PRE_AUTH`

- Preconditions: source-default-on decision already reviewed at composition;
  protected-edge context; valid route/browser-binding digests; health
  `HEALTHY`; emergency disable false.
- Compared records: environment epoch, rate-limit record, replay claim, any
  existing active pre-auth record for the same browser intent.
- Atomic mutations: apply the pre-auth rate limit; create one pre-auth session
  with nonce digest and short TTL; append audit; complete idempotency result.
- TTL: pre-auth TTL is policy bounded and never extends a browser or edge
  attestation.
- Race: one active pre-auth per exact intent; same command replay returns same
  safe session ref, never a duplicate secret.
- Failure/rollback: denial may update rate limit and denial audit; no pre-auth
  session is created.
- Primitive: one write-routed Lua script.

### 11.4 `ELEVATE_AUTHENTICATED_SESSION`

- Preconditions: verified identity assertion has already been validated by the
  identity port; active pre-auth record; nonce match; active canonical
  mapping; exact scope; current epochs; server-time validity.
- Compared records: pre-auth, mapping and inverse mapping, prior session if
  rotating, environment/scope epochs, replay claim.
- Atomic mutations: consume pre-auth/nonce; create new session token lookup;
  mark prior session rotated; advance session epoch; invalidate prior CSRF and
  entitlements by epoch/index; append audit; complete idempotency result.
- TTL: new session TTL is the minimum of policy, assertion eligibility, and
  environment limits; prior record retained terminal through its replay
  window.
- Race: two callbacks on one pre-auth cannot create two sessions. The first
  wins; exact retry returns the same content-free result ref.
- Failure/rollback: unknown/ambiguous subject, used nonce, stale epoch, or
  expired pre-auth changes no session authority.
- Primitive: one write-routed Lua script.

### 11.5 `ISSUE_CSRF_GRANT`

- Preconditions: active authenticated session; matching browser, scope,
  subject, session and security epochs; allowlisted route and intent; healthy
  state.
- Compared records: session, mapping, epochs, existing grant, replay claim.
- Atomic mutations: create single-use grant lookup with `NX`; append audit;
  complete idempotency result.
- TTL: short fixed TTL no longer than session or activation.
- Race: one grant per idempotent intent. Duplicate fingerprint returns the
  original ref; a different intent conflicts.
- Failure/rollback: no grant without audit.
- Primitive: one write-routed Lua script.

### 11.6 `CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT`

- Preconditions: active session and mapping; active exact private-test
  approval; active single-use CSRF; matching environment, subject, scope,
  browser, versions and epochs; server-side constant-time `SUBDEV1`
  verification result; configuration enabled; emergency disable false.
- Compared records: mapping/inverse, session, approval, CSRF, environment and
  scope epochs, rate limit, active session-entitlement index, replay claim.
- Atomic mutations: increment rate limit; consume CSRF for every accepted
  request evaluation; on valid code and within limit create exactly one
  entitlement token lookup and session index; append allow/deny audit;
  complete idempotency result.
- TTL: entitlement expiry is the earliest of session, approval, environment,
  code-policy, and configured maximum. CSRF becomes terminal consumed.
- Audit: never stores the submitted code, code digest, token, cookie, or raw
  identity. It records only `CODE_MATCHED` or safe denial code.
- Race: the first valid consume wins. Exact retry returns the same result ref;
  another grant is required for a new attempt. Parallel attempts cannot issue
  two active entitlements for the same session/scope.
- Failure/rollback: invalid code, rate limit, stale approval, revocation, or
  epoch mismatch may commit rate/CSRF/denial audit but never an entitlement.
  An allowed result cannot commit without entitlement and audit.
- Primitive: one write-routed Lua script. The canonical service computes only
  the constant-time code-match Boolean and safe fingerprint; the raw code
  never enters the adapter.

### 11.7 `CLAIM_REPLAY`

- Preconditions: valid command type, idempotency hash, fingerprint, and bounded
  recovery TTL.
- Compared records: existing replay claim and relevant environment epoch.
- Atomic mutations: `SET NX` a `CLAIMED` record or return exact existing state;
  append conflict/claim audit when policy requires.
- TTL: at least the command's maximum ambiguous-result recovery window.
- Race: one fingerprint wins. Same fingerprint observes the same claim;
  different fingerprint fails closed.
- Failure/rollback: no downstream command may execute after a conflict.
- Primitive: one write-routed Lua script. Commands may embed this logic rather
  than make a separate round trip.

### 11.8 `COMPLETE_REPLAY`

- Preconditions: matching `CLAIMED` record, command type, fingerprint, and
  owner result ref.
- Compared records: replay claim and command result metadata.
- Atomic mutations: transition to `COMPLETED`, attach content-free result ref,
  preserve expiry, append audit if independently invoked.
- TTL: never shortened below recovery policy.
- Race: first matching completion wins; exact duplicate is idempotent;
  divergent result conflicts.
- Failure/rollback: does not alter the security mutation. Allowed mutations
  normally complete replay inside their own script so this standalone command
  is reserved for non-authority recovery workflows.
- Primitive: one write-routed Lua script.

### 11.9 `REVOKE_TEMPORARY_ENTITLEMENT`

- Preconditions: exact entitlement ref/token lookup, subject/session/scope
  bindings, expected version, current epoch or a stronger emergency epoch.
- Compared records: entitlement, session, entitlement indexes, epochs, replay
  claim.
- Atomic mutations: mark terminal `REVOKED` or
  `EMERGENCY_REVOKED`; remove active index membership; append audit; complete
  idempotency result.
- TTL: terminal record retained until original expiry plus bounded replay
  window; revocation never extends access.
- Race: expiry, logout, and revocation converge to a terminal deny. Exact retry
  returns terminal result.
- Failure/rollback: missing record is a safe idempotent deny only when the
  expected terminal receipt exists; ambiguity never claims successful
  revocation.
- Primitive: one write-routed Lua script.

### 11.10 `REVOKE_RUNTIME_ACCESS`

- Preconditions: authenticated logout/revocation authority or emergency
  operator authority outside `SUBDEV1`; exact environment/scope; expected
  epochs.
- Compared records: session, entitlement, mapping, CSRF/session indexes,
  environment and scope epochs, replay claim.
- Atomic mutations: revoke session; revoke known active entitlement; invalidate
  all session CSRF and entitlement authority through session/security epoch;
  monotonically advance scope or environment epoch; append audit; complete
  idempotency result.
- TTL: terminal records retain their bounded recovery TTL; epoch has no TTL.
- Race: logout versus runtime action is decided by the primary serialization
  order. An authority snapshot before revocation is action-specific and
  short-lived; every protected action must perform its own snapshot
  immediately before the action. Once epoch advances, later actions deny.
- Failure/rollback: no success unless revocation, epoch, and audit commit
  together. During outage, the browser cookie may be cleared but the server
  response must say `LOGOUT_REVOCATION_UNCONFIRMED`.
- Primitive: one write-routed Lua script.

### 11.11 `ADVANCE_SECURITY_EPOCH`

- Preconditions: governed revocation/emergency authority, expected epoch, exact
  reason code; never `SUBDEV1`.
- Compared records: current environment/scope epoch and replay claim.
- Atomic mutations: compare-and-increment monotonically; update status/reason;
  append audit; complete idempotency result.
- TTL: none while the environment/scope exists.
- Race: concurrent advances serialize. A stale expected epoch may return the
  already-higher epoch as a safe idempotent dominance result only if the
  requested security effect is already met.
- Failure/rollback: epoch and audit are indivisible.
- Primitive: one write-routed Lua script.

### 11.12 `APPLY_RATE_LIMIT`

- Preconditions: exact allowlisted policy, keyed dimension digest, server-time
  window rules, idempotency key/fingerprint.
- Compared records: rate window, cooldown, replay claim, environment epoch.
- Atomic mutations: initialize/increment count exactly once per idempotency
  key; calculate allowed/denied and reset time; append required denial or
  observation audit; complete replay result.
- TTL: window plus cooldown and skew allowance.
- Race: concurrent requests serialize on the same dimension/window. Different
  instances cannot bypass the limit.
- Failure/rollback: unavailable or malformed rate state denies the protected
  action; no local limiter substitutes.
- Primitive: one write-routed Lua script.

### 11.13 `APPEND_SECURITY_AUDIT`

- Preconditions: exact event schema, allowlisted keys and values, unique audit
  ID hash, correlation ref, environment/config/script digests.
- Compared records: audit uniqueness key, retention configuration, epoch.
- Atomic mutations: create uniqueness key and append one Redis Stream event.
- TTL/retention: uniqueness key covers the deduplication window; stream
  retention follows approved schedule, maximum 30 days.
- Race: one audit ID produces one event. Same event is idempotent; different
  fingerprint conflicts.
- Failure/rollback: standalone observation may fail closed without another
  state mutation. An allowed security mutation must embed audit append in its
  own command script and cannot call this afterward.
- Primitive: one write-routed Lua script.

## 12. Consistency and atomicity model

### 12.1 Required model

The adapter contract requires:

- linearizable-equivalent behavior for one atomic command;
- one-point-in-time, primary-authoritative reads for one query;
- monotonic security epochs;
- read-after-acknowledged-write for relevant security records;
- server-authoritative time;
- no positive authority during leader ambiguity, partition, or recovery;
- no cross-operation transaction claim.

Each user action has its own atomic snapshot or command. The architecture does
not claim a serializable transaction spanning HTTP requests, identity-provider
verification, product runtime calls, or multiple user actions.

### 12.2 Internally consistent authority

`READ_AUTHORITY_SNAPSHOT` is the only runtime-authority data source. Separate
calls to session, approval, entitlement, and epoch queries are useful for
diagnostics or earlier lifecycle stages but cannot be combined into an allow.

The snapshot returns:

```text
snapshot_generation
provider_server_time_ms
environment_epoch
scope_epoch
mapping_etag
session_etag
approval_etag
entitlement_etag
snapshot_valid_until_ms
safe receipt ref
```

The canonical service validates all fields after awaiting the Promise.

### 12.3 No fake transactions

Prohibited:

- REST pipeline for compare/mutate;
- application `GET` followed by `SET`;
- `Promise.all()` over independent reads as a snapshot;
- `MULTI/EXEC` where later commands depend on earlier results;
- a distributed lock followed by non-atomic reads/writes;
- local mutexes;
- stale cache plus background refresh;
- dual writes to Redis and another store;
- success before audit append;
- exception compensation described as rollback.

### 12.4 Failover ambiguity

Because provider replication may be asynchronous, provider failover can create
ambiguity about the latest acknowledged state. Qualification must test
acknowledged-write visibility across forced failover or obtain a provider
contract sufficient to prove it. Until the recovery gate verifies epochs,
canaries, script digests, and authoritative reads, state is `RECOVERING` and
access is denied.

## 13. Retry and idempotency doctrine

### 13.1 Allowed retries

| Operation | Retry rule |
|---|---|
| `describeCapability()` | No network retry; configuration-only |
| `health()` | One retry within total deadline; never grants runtime authority by itself |
| `serverTime()` | One retry only after no valid response; no allow is based on it alone |
| Authoritative query | At most one retry against the same reviewed primary path after timeout/transport/5xx, within total deadline |
| Atomic command with idempotency key and fingerprint | At most one ambiguous-result recovery attempt with the exact same key and fingerprint |
| Atomic command without exact idempotency fields | No execution; schema rejection |
| Configuration, auth, namespace, script, record, or fingerprint error | No retry |
| Provider 429 | No automatic retry for the request; fail closed and alert |

### 13.2 Unsafe retry prohibitions

Never:

- create a new session token for a retry;
- create a new entitlement token for a retry;
- regenerate a CSRF grant to hide an ambiguous consume;
- use a new idempotency key;
- retry a different command representation;
- append a second success audit;
- split revocation into retryable substeps;
- re-run a rate-limit increment without its replay record;
- fail over to a secondary provider, V1 store, in-memory store, local file, or
  product persistence.

### 13.3 Fingerprint canonicalization

Fingerprint input is deterministic canonical JSON containing:

```text
command_version
command_type
environment_digest
subject_ref if permitted
scope_digest
safe record refs
expected versions
safe Boolean/code-free arguments
```

It excludes timestamps that the provider supplies, raw secrets, provider
request IDs, and unordered maps. Unknown or reordered semantic input cannot
reuse a fingerprint.

## 14. Health and recovery state machine

### 14.1 States

```text
UNCONFIGURED
  -> HEALTHY only after configured qualification and readiness proof

HEALTHY
  -> DEGRADED on threshold/latency/error warning
  -> UNAVAILABLE on repeated provider failure
  -> PARTITIONED on consistency/leader/region ambiguity

DEGRADED | UNAVAILABLE | PARTITIONED
  -> RECOVERING after first successful full canary

RECOVERING
  -> HEALTHY after complete recovery gate
  -> previous failure state on any failed gate
```

Only `HEALTHY` permits:

- pre-authentication state creation;
- authentication elevation;
- session continuation;
- approval use;
- CSRF issuance;
- entitlement issuance;
- runtime authority;
- protected logout success.

Every other state denies.

### 14.2 State meanings

| State | Meaning | Behavior |
|---|---|---|
| `UNCONFIGURED` | Missing/invalid config, dependency, credential reference, or source-default-off | Deny without provider call |
| `HEALTHY` | Exact config/script digests, primary authority, server time, atomicity, read/write canary, and latency are valid | Operations may proceed, each still performing its own authoritative provider operation |
| `DEGRADED` | Provider responds but latency/error/replication evidence crosses threshold | Deny; collect safe operational signal |
| `UNAVAILABLE` | Timeout, connection, 429, 5xx, or failed canary | Deny; breaker open |
| `PARTITIONED` | leader ambiguity, stale read, region mismatch, nonmonotonic epoch/time, or conflicting canary | Deny; highest-severity alert |
| `RECOVERING` | Provider has begun responding after failure but authority has not been re-proven | Deny until full gate passes |

### 14.3 Health probe

The active health probe is one bounded script that:

1. verifies environment and namespace digests;
2. verifies expected script manifest digest;
3. obtains provider server time;
4. writes a random canary digest with 60-second TTL;
5. reads and compares it inside the same primary operation;
6. performs a compare-and-increment on a canary epoch;
7. appends a privacy-safe canary audit;
8. returns one proof tuple.

It stores no customer, identity, token, session, entitlement, or product data.
It cannot run in this architecture campaign.

### 14.4 Thresholds and circuit breaker

- one configuration/auth/namespace/script mismatch: immediate
  `UNAVAILABLE` or `PARTITIONED`;
- one nonmonotonic epoch, stale canary, time regression greater than 1 second,
  or region mismatch: immediate `PARTITIONED`;
- three provider timeouts/5xx within 30 seconds: `UNAVAILABLE`;
- p99 above the relevant operation timeout: `DEGRADED`;
- any malformed provider response: `UNAVAILABLE`;
- breaker open interval: 15 seconds minimum, then one half-open canary;
- local breaker state may only accelerate denial; it never supplies health
  authority.

### 14.5 Recovery gate

Return to `HEALTHY` requires:

1. three successful full canaries at least five seconds apart;
2. monotonic provider time and canary epoch;
3. exact configuration and script manifest digests;
4. primary-authority routing proof;
5. write then authoritative read of a disposable record;
6. atomic compare/mutate/audit proof;
7. one known revoked synthetic record remains denied;
8. one expired synthetic record remains denied;
9. no open critical monitoring alert;
10. a privacy-safe recovery audit receipt.

No automatic recovery may skip a gate.

### 14.6 Operator-visible signals

Required signals:

```text
health_state
adapter_id
environment_id
configuration_digest
script_manifest_digest
primary_authority_proven
server_time_skew_ms
query and command p50/p95/p99
timeout/429/5xx/malformed counts
breaker state
partition suspicion
recovery generation
last safe canary receipt ref
backup age
restore-test age
cost/budget threshold
```

No signal contains raw identities, addresses, tokens, codes, content, or
provider credentials.

## 15. Serverless and Vercel compatibility

- the adapter uses bounded HTTPS requests and native `fetch` or an explicitly
  reviewed connectionless client;
- no socket, pool, file, process memory, warm instance, or background task is
  authority;
- cold start reconstructs only validated non-secret configuration and script
  manifest;
- all methods complete within explicit deadlines shorter than the handler
  budget;
- no handler responds before the security Promise settles and validates;
- retries are bounded within the same invocation and idempotency contract;
- abandoned HTTP requests do not imply provider cancellation;
- request-local references are discarded after response;
- Preview and provider-classified Production both reject synthetic,
  unqualified, wrong-environment, or wrong-namespace adapters;
- source-default-off remains the default;
- Vercel project/configuration is not inspected or modified by this campaign.

Provider classification does not change privacy or access doctrine. A future
provider-classified Production target remains private, isolated,
outer-protected, named-operator-controlled, SUBDEV1-only, Stripe-off,
public-registration-off, and free of production customer data.

## 16. Environment isolation

### 16.1 Isolation matrix

| Environment | Remote database | Credentials | Namespace | Permitted data |
|---|---|---|---|---|
| Local synthetic | None | None | In-memory synthetic only | Fixtures with no real identity |
| Automated test | Disposable/emulator only under qualification authority | Test-only, short-lived | Unique per run | Synthetic records only |
| Private Preview | Dedicated provider database | Preview-only | Fixed reviewed digest | Approved private-test control metadata only |
| Private production-classified | Dedicated paid provider database | Production-classified private-only | Fixed reviewed digest | Approved private-test control metadata only |

No environment shares sessions, entitlements, mappings, approvals, CSRF,
replay, rate limits, epochs, audit, backups, credentials, or monitoring
authority.

### 16.2 Namespace collision prevention

The adapter refuses to start unless:

- environment identifier is from an exact enum;
- provider database identifier digest matches the reviewed configuration;
- namespace prefix and digest match;
- provider region matches;
- adapter ID and contract version match;
- a namespace ownership marker is absent for creation or exactly matches the
  environment;
- no other environment ownership marker exists.

Namespace ownership is immutable. An environment rename creates a new empty
namespace under separate migration authority; it does not alias keys.

### 16.3 Production data prohibition

The adapter rejects customer/product record types at schema validation. No
production customer identity, Business Engine data, BA/BOS, Five Futures, One
Move, Profile ID, dossier, subscription billing, Coach Connect content,
transcript, prompt, or model output may enter any environment.

## 17. Audit architecture

### 17.1 Events

Audit covers:

- pre-auth begin/deny;
- authentication elevation/deny;
- canonical subject resolution/ambiguity;
- private-test eligibility allow/deny;
- CSRF issue/consume/reuse;
- entitlement issue/deny/expiry/revocation;
- session rotation/continuation/expiry;
- runtime authority allow/deny;
- logout and revocation;
- security epoch advance;
- rate-limit decision;
- replay claim/conflict/completion;
- provider outage/partition/recovery;
- adapter configuration-digest change;
- script-manifest change;
- emergency disable;
- backup/restore test.

### 17.2 Atomic audit rule

Every allowed security mutation appends its audit entry in the same Lua script
and provider database. It cannot report success otherwise.

Denied reads and provider outages are different:

- a healthy provider appends the denial audit;
- if the provider is unavailable, the request denies without a false durable
  audit claim;
- approved external monitoring may emit a privacy-safe availability signal,
  but it is not security authority and not a local audit queue;
- after recovery, one recovery event records the observed outage interval and
  explicit audit gap without inventing per-request events.

### 17.3 Retention and access

- online audit retention: the approved schedule, never more than 30 days;
- backup retention: never more than 30 days;
- unique audit ID: keyed digest of environment, event type, correlation ref,
  command fingerprint, and provider-time bucket;
- correction: append a new correction event; never mutate history;
- operator access: named MFA-backed security/privacy operators only;
- `SUBDEV1` grants no audit access;
- application handlers have append-only rights and no audit export/delete
  rights;
- exports are privacy-safe sorted NDJSON plus a schema version, per-event hash,
  manifest SHA-256, environment/config/script digests, and bounded time range.

### 17.4 Audit field denylist

The adapter rejects fields resembling:

```text
token, cookie, secret, credential, password, code, assertion, email, name,
address, ip, profile, transcript, prompt, message, model_output, business,
billing, stripe
```

Exact safe field schemas take precedence; merely renaming sensitive content is
not allowed.

## 18. Backup, retention, and deletion

### 18.1 Backup policy

- owner: named security infrastructure owner;
- privacy approval: named privacy/legal authority for the actual schedule;
- scope: security control metadata only;
- transcripts and product content: excluded;
- encryption: provider encryption at rest plus provider-controlled encrypted
  backup;
- schedule: sufficient to meet ratified recovery objectives;
- retention: maximum 30 days, with shorter provider-supported retention
  preferred for ephemeral private-live state;
- restore test: at least quarterly and before first private-live activation;
- restore destination: new isolated empty database, never in-place over the
  active database;
- restore authorization: separate named operator authority;
- evidence: backup ID digest, timestamps, configuration digest, record counts
  by type, zero-sensitive scan, restore validation, teardown receipt.

Current Upstash documentation says standard daily-backup retention can be one
or three days, while enterprise options may differ. A shorter schedule is
compatible with MORE's 30-day maximum if it meets the separately approved
recovery objective. This architecture does not activate backups.

### 18.2 Restore safety

Before restored state becomes readable:

1. keep the target environment disabled;
2. verify backup and namespace provenance;
3. apply current environment and scope security epochs;
4. replay revocation tombstones and deletion epochs newer than the backup;
5. expire records using current provider time;
6. reject unknown versions and corrupt indexes;
7. run authority snapshots for revoked, expired, and active synthetic cases;
8. complete privacy/sensitive-content scan;
9. obtain named recovery approval;
10. change state from `RECOVERING` to `HEALTHY` only after the recovery gate.

### 18.3 Retention by record class

- sessions, CSRF, replay, rate limit, and entitlements: provider TTL plus
  bounded terminal/replay window;
- private-test approvals: exact approval expiry and governed terminal
  retention;
- canonical mapping: active until governed disable/deletion; not session TTL;
- security epoch: retained while environment/scope could be restored;
- audit/recovery metadata: approved schedule, maximum 30 days;
- backups: maximum 30 days;
- no record gains authority from backup retention.

### 18.4 Deletion semantics

- cache eviction is not deletion;
- `EXPIRE` is not proof that backups no longer contain data;
- subject deletion first disables mapping and advances security epoch;
- active sessions, CSRF, entitlements, and approvals are revoked before key
  removal;
- inverse indexes are removed atomically with primary records where possible;
- deletion tombstone survives until every eligible backup has expired;
- provider deletion proof requires provider control-plane receipt and backup
  expiry, under separate destructive authority;
- cryptographic erasure is claimed only when a reviewed key hierarchy and
  provider behavior prove it. This packet makes no such claim.

## 19. Configuration and secrets

### 19.1 Configuration schema

Future deployment configuration uses
`remote-shared-security-adapter-config-v1`:

```json
{
  "config_version": "remote-shared-security-adapter-config-v1",
  "enabled": false,
  "emergency_disabled": true,
  "provider": "UPSTASH_REDIS",
  "provider_endpoint_ref": "opaque-reference",
  "provider_credential_ref": "opaque-reference",
  "environment_id": "LOCAL_SYNTHETIC_OR_TEST_OR_PRIVATE_PREVIEW_OR_PRIVATE_PRODUCTION_CLASSIFIED",
  "provider_database_id_digest": "sha256",
  "provider_region": "reviewed-region-id",
  "namespace_prefix": "more:cc:security:v2",
  "namespace_digest": "sha256",
  "adapter_id": "reviewed-opaque-id",
  "contract_version": "shared-security-state-async-v2",
  "adapter_contract_version": "remote-shared-security-adapter-v1",
  "script_manifest_digest": "sha256",
  "query_timeout_ms": 750,
  "command_timeout_ms": 1500,
  "operation_deadline_ms": 3000,
  "query_retry_limit": 1,
  "command_retry_limit": 1,
  "breaker_failure_threshold": 3,
  "breaker_window_ms": 30000,
  "breaker_open_ms": 15000,
  "recovery_success_threshold": 3,
  "audit_retention_days": 0,
  "backup_retention_days": 0,
  "token_hash_key_ref": "opaque-reference",
  "token_hash_key_id": "opaque",
  "identity_hash_key_ref": "opaque-reference",
  "identity_hash_key_id": "opaque",
  "scope_hash_key_ref": "opaque-reference",
  "scope_hash_key_id": "opaque",
  "telemetry_enabled": false
}
```

Retention values remain zero/unconfigured until approved. Preview and private
production-classified activation reject zero, values over 30 days, or values
without named authority receipts.

### 19.2 Secret handling

Secrets:

- remain server-side in an approved secret manager;
- are referenced, not serialized into review artifacts;
- never appear in repository files, client bundles, evidence, logs, provider
  key names, errors, or metrics;
- are never accepted from a request or client environment;
- use least-privilege data-plane credentials, distinct from provider account
  administration credentials;
- are unique per environment;
- are independently rotatable;
- have named owners, creation/rotation/revocation dates, and emergency
  revocation runbooks;
- are not shared with Auth0, S3, Stripe, models, or product persistence;
- support overlapping keyed-digest verification only through a reviewed
  rotation window; new writes use the current key ID;
- default to disabled if resolution fails.

Credential binding is a separate authority phase. This architecture neither
requests nor inspects any credential.

### 19.3 Configuration validation

Validation rejects:

- raw endpoint or credential material in non-secret config/evidence;
- unknown provider, environment, version, region, adapter, or script;
- Global Database or read regions;
- shared Preview/Production database digest;
- shared credential ref;
- enabled true with emergency disabled absent/false before approval;
- telemetry enabled;
- timeout/retry values outside exact bounds;
- missing encryption, backup, monitoring, or owner attestations;
- synthetic adapter in Preview or Production;
- secret-like configuration values in client-exposed prefixes.

Configuration digest is canonical SHA-256 of non-secret configuration plus
opaque secret version IDs. Secret values are excluded.

## 20. Threat model

| Threat | Control | Required proof |
|---|---|---|
| Stolen session token | Keyed token lookup, browser binding, short TTL, session/security epochs, rotation | Old token denied after rotation/logout/restart |
| Stolen entitlement token | Session/subject/scope/browser/epoch binding, earliest-expiry TTL, temporary-only flags | Token alone and wrong session both deny |
| Token replay | Atomic replay claim and fingerprint, action-specific snapshot | Concurrent duplicate tests produce one effect |
| CSRF reuse | Single-use grant consumed in entitlement script | Exactly one attempt consumes; reuse denies |
| Session rotation race | One atomic elevation script, old session terminal, session epoch advance | Parallel callbacks yield one active session |
| Approval revocation versus entitlement issue | Approval and epoch compared inside issue script | Serialization yields either issue-before-revoke then epoch denial, or no issue |
| Logout versus runtime action | Every action performs fresh snapshot; logout atomically advances epoch | Post-logout action denies; no cached allow |
| Epoch advance versus authority read | Snapshot reads epoch in one primary script; no local cache | Concurrent race has provider-defined total order and later reads deny |
| Cross-subject/scope collision | Forward/inverse mappings, keyed environment digests, exact scope comparisons | Collision and ambiguity tests deny without mutation |
| Namespace collision | Separate databases, immutable ownership marker, config/database digests | Wrong namespace/database cannot become healthy |
| Stale provider read | No ordinary reads; write-routed script; recovery gate | Replica-stale/failover injection never allows |
| Provider partition | Immediate `PARTITIONED`, breaker, no fallback | Partition tests deny all protected operations |
| Malicious/malformed provider response | Exact schema/version/digest/time/record validation | Fuzzed tuples and wrong versions deny |
| Credential leak | Least privilege, server-only secret refs, rotation/revocation, no logs | Secret/client-bundle scans and rotation test |
| Audit tampering | Append-only stream, uniqueness keys, atomic audit, export hashes, restricted operator access | Mutation without audit cannot succeed; altered export fails manifest |
| Denial of service | Distributed provider-time rate limit, bounded payloads, timeouts, breaker, cost alerts | Cross-instance rate and overload tests |
| Rate-limit bypass | Exact keyed dimensions and atomic increments, no local limiter | Parallel multi-instance test holds limit |
| Accidental public exposure | Outer protection, source-default-off, named activation, no public routes/registration | Unauthenticated/public registration probes deny |
| Unsafe fallback | Capability contract, no V1/synthetic/local/product fallback imports | Static import scan and outage tests |
| Raw-data persistence | Exact schemas/denylist/keyed digests | Sensitive-content and provider-record scans |
| Backup resurrection | epoch/tombstone replay before read, current provider time | Restore test preserves revocation and expiry |
| Emergency-disable bypass | config kill switch plus environment/scope epoch, checked before every allow | Disable denies login, issuance, continuation, and runtime |

## 21. Provider qualification plan

Qualification is a separate, explicitly authorized campaign. Passing it means
one adapter artifact is technically qualified for one isolated environment; it
does not activate the environment or deploy MORE.

### 21.1 Gate 1 — offline contract

Using synthetic records and a provider simulator:

- all five V2 methods return native Promises;
- synchronous, multiply settling, malformed, and late returns fail;
- all envelopes and records validate exact versions and fields;
- raw-data and oversized inputs reject before provider invocation;
- provider errors normalize exactly;
- no provider client type escapes;
- no V1, in-memory, local-file, product-store, or second-provider fallback is
  importable;
- script manifest hashes are deterministic;
- configuration remains default-off.

### 21.2 Gate 2 — provider emulator or disposable namespace

Under later provider-test authority only:

- use a disposable empty database or namespace containing synthetic data;
- use dedicated short-lived test credentials;
- prove key encoding, TTL, server time, Streams, Lua, and script response
  parsing;
- prove every command and query against exact schemas;
- prove cleanup inventory and teardown receipt;
- prove zero production/customer data.

An emulator can prove application behavior but cannot prove live consistency,
durability, failover, backup, latency, or cost.

### 21.3 Gate 3 — atomicity and races

At minimum 100 synchronized attempts for each:

- two canonical bindings for one external subject;
- two subjects for one exact scope;
- duplicate pre-auth;
- duplicate authentication callback;
- session rotation versus session use;
- two CSRF consumes;
- parallel valid entitlement issuance;
- approval revocation versus entitlement issue;
- logout versus authority snapshot;
- epoch advance versus authority snapshot;
- duplicate replay claim with same fingerprint;
- replay key with different fingerprint;
- parallel rate-limit increments across instances;
- audit uniqueness race.

Expected results are exact: one winner where a winner is allowed, zero
duplicate sessions, zero duplicate entitlements, one canonical mapping, one
scope owner, monotonic epochs, exact rate count, and one success audit.

### 21.4 Gate 4 — consistency and primary authority

Qualification must:

- demonstrate that the chosen Lua invocation is write-routed to the
  primary/leader path;
- show acknowledged writes are visible to the next relevant authority script;
- inject stale replica responses and prove they are never consumed;
- prove Global/read-region endpoints are absent;
- force or simulate failover and leader election;
- prove epoch and revocation monotonicity after failover;
- prove `READ_AUTHORITY_SNAPSHOT` sees one consistent generation;
- prove no `GET`, `MGET`, `EVAL_RO`, `EVALSHA_RO`, pipeline, cache, or
  read-replica call can reach authority code.

Required evidence includes provider documentation/attestation plus live
disposable evidence. Either alone is insufficient.

### 21.5 Gate 5 — failure injection

Inject:

- DNS failure;
- connect/HTTP timeout;
- slow response beyond deadline;
- 401, 403, 429, 500, and 503;
- malformed JSON and truncated body;
- wrong environment, namespace, database, region, adapter, and script digest;
- server-time regression;
- script runtime error;
- audit append error;
- backup lag;
- provider partition/leader ambiguity;
- ambiguous response after committed command;
- circuit-breaker open and half-open recovery.

Every protected action denies. Ambiguous commands recover only through exact
idempotency. No local or V1 fallback occurs.

### 21.6 Gate 6 — restart and recovery

Prove across fresh serverless processes:

- session and entitlement continuation from provider state;
- expired records remain denied;
- revoked records remain denied;
- rotated session token remains denied;
- consumed CSRF remains consumed;
- replay result recovers without duplicate mutation;
- epochs remain monotonic;
- attachments are rebuilt from canonical references without duplicate runtime;
- no process-local state is required.

### 21.7 Gate 7 — backup and restore

In a disposable empty destination:

- create an authorized provider backup;
- record backup configuration and digest;
- restore without overwriting the source;
- replay deletion epochs and revocation tombstones;
- apply current provider time and expiry;
- prove revoked/expired state remains denied;
- prove active synthetic state only when still valid;
- scan records for forbidden content;
- delete/retire the destination under separate authority;
- record the provider's backup-deletion and residual-retention limits.

Restore tests cannot use real identity or customer data.

### 21.8 Gate 8 — performance, cost, and serverless

Measure:

- warm/cold p50, p95, p99 for every method;
- payload and script size;
- commands/subcommands and bandwidth per operation;
- retry amplification;
- canary and audit cost;
- database and backup growth;
- Vercel function budget margin;
- provider 429 behavior;
- monthly cost projection at private-test maximum.

Pass requires p99 within architecture deadlines, no unbounded growth, and an
approved cost ceiling. Budget exhaustion must fail closed, not downgrade the
security model.

### 21.9 Gate 9 — security and privacy

- repository, artifact, log, client-bundle, evidence, provider-key, and
  provider-record secret scans;
- sensitive-content scans using exact forbidden categories;
- TLS and encryption-at-rest attestation;
- least-privilege credential test;
- credential rotation and old-credential revocation;
- named MFA operator proof;
- audit access denial for application and `SUBDEV1`;
- no public endpoint or registration;
- zero Stripe, voice, Luna, media, model, transcript, product-persistence, and
  customer-data calls.

### 21.10 Qualification verdicts

```text
REMOTE_SHARED_SECURITY_ADAPTER_QUALIFIED_NOT_ACTIVATED
REMOTE_SHARED_SECURITY_ADAPTER_QUALIFICATION_BLOCKED
```

The first verdict does not authorize credential binding to a deployment,
environment activation, tester authorization, or private-live deployment.

## 22. Activation boundary

The following are separate authority events:

| Phase | Output | Does not authorize |
|---|---|---|
| Architecture | This packet | Source implementation or provider access |
| AFW expansion | Reviewed seven-sprint instructions | Implementation |
| Adapter implementation | Default-off source and offline evidence | Live provider qualification |
| Adapter qualification | Exact artifact/provider capability evidence in disposable namespace | Deployment or activation |
| Provider credential binding | Exact environment secret refs and configuration digest | Application deployment or tester access |
| Private-live deployment | Immutable artifact on isolated protected target | Public access or broad onboarding |
| Environment activation | Default-off gate changed under named authority after all safety gates | Tester authorization |
| Tester authorization | Exact founder/named tester approval | Admin/operator/deployment/billing/canonical authority |

No phase may infer the next. Rollback at every later phase returns to
source-default-off and advances security epoch where provider state exists.

## 23. Exact implementation allowlist proposal

This is a proposed union for a future AFW, not implementation authority. The
AFW must reconcile it with the reviewed, committed V2 implementation and may
narrow it. Expansion requires architecture review.

### 23.1 New adapter files

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/contracts.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/keyspace.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/recordSchemas.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/atomicCommands.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/health.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/index.js
```

`upstashRedisAdapter.js` must use platform-native HTTPS `fetch` unless a later
review explicitly authorizes a dependency. `package.json` and lockfiles remain
protected.

### 23.2 Existing V2 seams, only after committed

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSharedSecurityStatePort.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js
```

Allowed edits are limited to adapter registration, exact contract
conformance, and exports. Canonical service policy and handler behavior are not
adapter concerns.

### 23.3 Focused tests

```text
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.contract.test.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.keyspace.test.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.commands.test.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.queries.test.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.health.test.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.races.test.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.recovery.test.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.privacy.test.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.integration.test.js
```

Provider-live qualification tests must be separately tagged, default-skipped,
require an explicit disposable-namespace attestation, and fail before any
connection when the authority token is absent.

### 23.4 Verifier and evidence

```text
scripts/verifyCoachConnectPrivateRuntimeRemoteSharedSecurityAdapter.mjs
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/**
```

The evidence directory is not open-ended. Each AFW must enumerate exact files.
Evidence contains no secrets, raw provider identifiers, tokens, customer data,
or product content.

### 23.5 Prohibited files

At minimum:

```text
api/internal/**
src/lib/intelligenceFabric/coachConnect/privateRuntime/**
src/lib/intelligenceFabric/coachConnect/security/**
src/lib/intelligenceFabric/production/**
src/lib/businessEngine/**
src/lib/businessAssessment/**
api/engine/**
api/business-assessment/**
api/stripe/**
src/lib/stripe/**
src/lib/intelligenceFabric/coachConnect/liveSession/**
src/lib/intelligenceFabric/coachConnect/internalDeployment/**
vercel.json
package.json
package-lock.json
```

If adapter implementation genuinely requires a handler, canonical-service,
product, deployment, package, or environment file change, stop for
architecture review.

## 24. Protected roots

Do not redesign, modify, migrate, or reinterpret:

- Business Engine;
- Business Assessment;
- BOS;
- Five Futures;
- One Move;
- Profile ID;
- canonical dossier;
- Subscription Runtime;
- Coach Connect product semantics;
- private-runtime authority order;
- `SUBDEV1` bootstrap semantics;
- public onboarding;
- Stripe or billing;
- model routing;
- Luna;
- voice or media;
- transcript persistence;
- Vercel deployment adapter;
- production product/event persistence;
- package manifests and lockfiles;
- CI;
- environment files.

Exact protected paths include:

```text
src/lib/businessEngine/**
src/lib/businessAssessment/**
api/engine/**
api/business-assessment/**
src/lib/intelligenceFabric/production/**
src/lib/intelligenceFabric/coachConnect/activation.js
src/lib/intelligenceFabric/coachConnect/contracts.js
src/lib/intelligenceFabric/coachConnect/service.js
src/lib/intelligenceFabric/coachConnect/stateMachines.js
src/lib/intelligenceFabric/coachConnect/projections.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/**
src/lib/intelligenceFabric/coachConnect/security/**
src/lib/intelligenceFabric/coachConnect/liveSession/**
src/lib/intelligenceFabric/coachConnect/internalDeployment/**
src/lib/intelligenceFabric/coachConnect/deploymentReadiness/**
api/internal/**
api/stripe/**
src/lib/stripe/**
vercel.json
package.json
package-lock.json
```

The future AFW may allow only the three committed V2 seams listed in Section
23.2; that narrow exception does not unprotect adjacent files.

The current worktree contains pre-existing modified Business Engine and
Business Assessment files and unrelated untracked evidence. They are user
work, outside this architecture mission, and must remain untouched. A future
campaign must take a fresh protected-root baseline that includes those
pre-existing bytes and compare exact paths without cleaning or reverting them.

## 25. Recommended multi-sprint structure

### Sprint 1 — Provider-Neutral Adapter Contract and Schemas

- reconcile against committed V2;
- implement adapter config/capability/error schemas;
- enforce Promise-only and no-leakage boundaries;
- add record validators and sensitive-input rejection;
- remain offline and default-off.

### Sprint 2 — Record and Keyspace Architecture

- implement deterministic key encoding;
- implement record schemas, TTL validation, indexes, and environment ownership;
- prove namespace isolation and no raw-data persistence;
- use simulator only.

### Sprint 3 — Atomic Command Implementation Design

- implement versioned Lua scripts for all commands;
- embed idempotency, provider time, TTL, audit, and results;
- run race and error-before-mutation tests;
- prohibit application-layer transactions.

### Sprint 4 — Authoritative Query and Snapshot Design

- implement primary-authoritative query scripts;
- implement one internally consistent authority snapshot;
- prove no ordinary/cached/replica reads;
- fail if primary routing cannot be represented.

### Sprint 5 — Health, Recovery, Retry, and Idempotency

- implement health states, canary, breakers, timeouts, normalization, recovery,
  and exact retry rules;
- prove every non-healthy state denies;
- remain offline or emulator-only unless separately authorized.

### Sprint 6 — Audit, Retention, Backup, and Environment Isolation

- implement atomic audit schema, retention validators, backup/restore
  runbooks, configuration digest, secret-reference boundaries, and environment
  isolation;
- do not create backups or bind secrets without separate authority.

### Sprint 7 — Provider Qualification and Cross-System Validation

- offline integration first;
- under separate provider qualification authority only, use one disposable
  empty namespace;
- run consistency, failover, race, recovery, privacy, performance, cost,
  backup/restore, and teardown proofs;
- emit qualified-not-activated or blocked;
- never deploy or activate MORE.

Each sprint validates before continuation, permits at most two bounded repairs
per failed gate, emits a repair receipt for every repair, and stops on
architecture, provider, credential, privacy, protected-root, authority,
deployment, persistence, or customer-data conflict.

## 26. Validation plan

### 26.1 Architectural proofs

| Required proof | Architecture mechanism |
|---|---|
| One provider adapter | One `RemoteSharedSecurityAdapterV1` below one V2 port |
| One canonical security service | Only `CanonicalAsyncSecurityServiceV2` decides |
| One authoritative record set | One isolated provider database contains all authority records and audit |
| No V1 fallback | V1 imports forbidden; outage denies |
| No in-memory live fallback | Synthetic capability rejected in Preview/Production |
| No dual writes | No second authority provider/store or audit store |
| No local cache authority | Positive mappings, sessions, entitlements, epochs, health, and allows never cached |
| No fake transactions | One Lua script per query/command; no application sequence claims atomicity |
| Promise-native | Exact five V2 Promise methods |
| Consistent snapshot | One primary-authoritative script reads all authority records |
| Idempotent/prohibited retry | Exact key+fingerprint or no retry |
| Outage/partition fail closed | Only `HEALTHY` permits progress |
| Emergency disable dominates | Config kill switch and monotonic environment/scope epochs |
| Namespace isolation | Separate databases and credentials, plus ownership/digest checks |
| No raw token/secret persistence | Keyed digests and exact record schemas |
| No customer/product content | Schema rejection and sensitive scans |
| No public access | Adapter has no public route and deployment remains unauthorized |
| No Stripe/voice/Luna/transcripts | No contracts, imports, records, or calls for those systems |

### 26.2 Offline validation

- exact schema fixtures and adversarial fuzzing;
- Promise conformance;
- deterministic key/record/script/config digests;
- Lua static validation and simulator execution;
- all command precondition/mutation/audit/idempotency cases;
- all query consistency and corruption cases;
- race tests;
- timeout/retry/breaker/recovery simulations;
- backup/restore model tests;
- import/export and dependency-cycle checks;
- focused lint;
- deterministic build;
- full async-security V2 regression;
- Production Security Prerequisite regressions;
- Deployment Readiness regressions;
- Private Runtime regressions;
- relevant developer-access, Subscription Runtime, and Coach Connect
  regressions;
- safe complete Intelligence Fabric regression;
- secret and sensitive-content scans;
- protected-root comparison;
- changed-file allowlist;
- evidence-manifest and archive-integrity validation.

### 26.3 Provider qualification evidence

Required exact artifacts:

```text
provider capability attestation
primary-authority proof
server-time proof
atomic-script proof
READ_AUTHORITY_SNAPSHOT consistency proof
race matrix
failure-injection matrix
restart/recovery proof
partition/failover proof
retry/idempotency proof
audit atomicity proof
backup/restore proof
retention/deletion proof
environment-isolation proof
credential-rotation proof
performance/latency report
cost report
zero-customer-data proof
zero-forbidden-provider-call proof
teardown proof
secret/sensitive scans
protected-root proof
test manifest
evidence manifest
final qualification verdict
```

Qualification evidence uses opaque provider resource digests, never secrets or
raw database URLs.

### 26.4 Regression failure rules

- no test may downgrade an expected `HEALTHY` check to capability metadata;
- no emulator result can satisfy a live capability gate;
- no static analysis can prove provider consistency;
- no successful `PING` can prove atomicity, durability, backup, primary reads,
  or recovery;
- no in-memory restart simulation can prove serverless durability;
- no UI message can prove entitlement or revocation;
- no deployment classification can prove privacy or access control.

## 27. Stop conditions

Stop architecture or a future campaign if:

- the async-security V2 contract is materially inconsistent or incomplete;
- V2 implementation is not reviewed and committed before adapter
  implementation;
- Business Engine, Subscription Runtime, or Coach Connect semantics must
  change;
- a second security authority or second authority provider store is required;
- audit cannot commit in the same store and atomic boundary as an allowed
  mutation;
- atomic commands cannot be implemented truthfully;
- primary-authoritative, non-stale reads cannot be proven;
- `READ_AUTHORITY_SNAPSHOT` would use independent or cached reads;
- a local, V1, synthetic, product-persistence, or file fallback is required;
- Upstash `EVAL` routing, failover, or acknowledged-write visibility cannot
  meet the consistency gate;
- provider credentials or live access are required for architecture;
- Vercel inspection or deployment is required;
- production/customer data is required;
- Stripe, billing, public onboarding, model routing, Luna, voice, media, or
  transcript persistence must change;
- package manifests, lockfiles, CI, environment files, deployment adapter, or
  another protected root must change;
- privacy/legal authority has not approved actual audit/backup retention
  before activation;
- backup restore would make deleted/revoked state readable;
- emergency disable, rollback, monitoring, credential revocation, or teardown
  cannot be proven;
- more than two bounded repairs are needed for a failed sprint gate.

An Upstash qualification stop does not authorize an automatic switch to Redis
Cloud or Postgres. It returns to architecture review.

## 28. Future AFW and implementation authority boundary

The next documentation mission should be:

`MORE_CAMPAIGN_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_AFW_V1`

It may expand this packet into the seven sprints in Section 25. It must:

- verify the exact committed V2 implementation and review SHA;
- reconcile exact imports and schemas;
- keep provider implementation default-off;
- separate offline implementation from live qualification authority;
- keep real credentials, environment changes, and deployment unauthorized;
- pre-author exact file and evidence allowlists;
- preserve the provider-consistency stop gate;
- preserve one provider, one service, one record set, and no fallback.

A later implementation authorization may build the adapter and offline tests.
A separate qualification authorization may connect only to a disposable empty
namespace. A separate credential-binding campaign may configure one isolated
environment. A separate private-live deployment campaign may deploy. None is
authorized here.

## 29. No-provider/no-deployment statement

This architecture campaign:

- made no provider API or data-plane call;
- created no provider account, database, namespace, backup, or credential;
- did not request, inspect, create, rotate, or revoke a secret;
- made no environment change;
- did not inspect Vercel;
- did not activate Auth0, Upstash, Redis, S3, Stripe, model, voice, media,
  Luna, transcript, or production persistence;
- did not deploy or broaden access;
- did not stage, commit, or push;
- did not change source implementation, tests, package manifests, lockfiles,
  CI, or protected roots;
- created only this architecture packet and its mandatory byte-identical
  Desktop handoff.

## 30. Final verdict

Prerequisites:

```text
architecture_packet_hash: PASS
architecture_verdict: PASS
afw_package_exists: PASS
afw_verdict: PASS
repository_head_identified: PASS
ratified_provider_context_consistent: PASS
v2_implementation_present: NO
v2_implementation_dependency_explicit: PASS
```

Architecture:

```text
one_provider_adapter: PASS
one_canonical_security_service: PASS
one_authoritative_record_set: PASS
no_v1_fallback: PASS
no_in_memory_live_fallback: PASS
no_dual_writes: PASS
no_local_cache_authority: PASS
no_application_fake_transactions: PASS
promise_native: PASS
consistent_authority_snapshot: PASS_BY_REQUIRED_DESIGN
idempotent_or_prohibited_retries: PASS
outage_and_partition_fail_closed: PASS
emergency_disable_dominant: PASS
namespace_isolation: PASS
no_raw_token_or_secret_storage: PASS
no_customer_or_product_content: PASS
no_public_access: PASS
no_stripe_voice_luna_transcripts: PASS
no_provider_activation_or_deployment: PASS
```

Provider recommendation:

`UPSTASH_REDIS_DEDICATED_REGIONAL_PAID_WITH_PRIMARY_SCRIPT_QUALIFICATION_REQUIRED`

Implementation dependency:

`BLOCKED_UNTIL_ASYNC_SECURITY_V2_IMPLEMENTATION_IS_REVIEWED_AND_COMMITTED`

Qualification stop gate:

`BLOCK_IF_PRIMARY_AUTHORITATIVE_WRITE_ROUTED_LUA_READS_CANNOT_BE_PROVEN`

Final verdict:

`PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_ARCHITECTURE_COMPLETE`

Stop for Spock architecture review.
