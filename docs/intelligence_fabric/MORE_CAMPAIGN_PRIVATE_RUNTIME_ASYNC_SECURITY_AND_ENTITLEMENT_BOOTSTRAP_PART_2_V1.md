# MORE Campaign — Private Runtime Async Security and Entitlement Bootstrap — Part 2 V1

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_V1`

Part:
`2 — V2 Contracts, State Machines, Composition, and Sprint Requirements`

Architecture SHA-256:
`8c117ab7e40fde69536d67d43558e69dfa3d078f10eaeb0ff88105cfa9117046`

Implementation authorized: `false`

Provider-adapter implementation authorized: `false`

Deployment authorized: `false`

## 1. Purpose

Part 2 is the normative contract set for the seven future implementation
sprints. It defines a Promise-only state port, one canonical security service,
one developer-access facade, one non-circular entitlement bootstrap, explicit
lifecycle state machines, and one source-default-off handler composition.

All examples are schemas and pseudocode. They are not source implementation.

## 2. Contract catalog

| Contract | Version |
|---|---|
| Async security state port | `shared-security-state-async-v2` |
| Canonical security service | `private-runtime-canonical-security-service-v2` |
| Query envelope | `async-security-query-v2` |
| Atomic command envelope | `async-security-command-v2` |
| Capability description | `async-security-capability-description-v2` |
| Canonical subject decision | `canonical-subject-decision-v2` |
| Private-test approval | `private-test-approval-v1` |
| Bootstrap eligibility | `private-test-bootstrap-eligibility-v1` |
| Authenticated session | `authenticated-private-session-v2` |
| Temporary entitlement | `temporary-private-entitlement-v2` |
| Runtime authority | `private-runtime-authority-decision-v2` |
| Security receipt | `private-runtime-security-receipt-v2` |
| Live composition | `private-runtime-live-composition-v2` |

Unknown versions or unknown authority-bearing fields deny.

## 3. Promise-only shared-security port

### 3.1 Required interface

```js
{
  describeCapability(): Promise<CapabilityDescription>,
  health(): Promise<HealthDecision>,
  serverTime(): Promise<ServerTimeReceipt>,
  queryAuthoritative(query): Promise<QueryResult>,
  executeAtomic(command): Promise<CommandResult>
}
```

Every method must:

1. return a thenable immediately;
2. settle exactly once;
3. settle with an exact versioned result or reject;
4. never authorize from a local cache;
5. never return raw tokens, assertions, cookies, credentials, personal data,
   product content, or transcripts.

A non-thenable result is `ASYNC_SECURITY_CONTRACT_VIOLATION`.

### 3.2 Promise settlement rule

Every V2 security caller follows this logical order:

```text
invoke
-> prove thenable
-> await settlement
-> validate exact result schema and version
-> evaluate decision.allowed === true
-> shape safe response
```

Forbidden:

```text
if (port.queryAuthoritative(query)) allow
if ((await maybePromise)?.allowed !== false) allow
Promise.resolve(syncResult) to disguise a synchronous adapter
send response before all required decisions settle
```

Only `allowed === true` on a settled, validated decision permits the next
state transition.

## 4. Capability description schema

```json
{
  "contract_version": "shared-security-state-async-v2",
  "adapter_id": "opaque",
  "adapter_class": "SYNTHETIC_OR_DEPLOYMENT_CANDIDATE",
  "provider_class": "SYNTHETIC_OR_REMOTE_SHARED_SECURITY_STATE",
  "provider_name": "opaque",
  "environment_id": "opaque",
  "available": true,
  "deployment_grade": false,
  "promise_native": true,
  "authoritative_reads": "SYNTHETIC_LINEARIZABLE_MODEL",
  "atomic_command_model": "SYNTHETIC_SERIALIZABLE_MODEL",
  "server_time_ttl": true,
  "durable_security_records": false,
  "durable_privacy_safe_audit": false,
  "restart_safe": false,
  "outage_behavior": "FAIL_CLOSED",
  "partition_behavior": "FAIL_CLOSED",
  "no_local_fallback": true,
  "stores_product_content": false,
  "stores_transcripts": false,
  "stores_raw_identity_material": false,
  "live_connection_verified": false
}
```

The campaign synthetic adapter must use the non-deployment values above.
Preview and Production require `deployment_grade === true`,
`durable_security_records === true`, `restart_safe === true`, and
`live_connection_verified === true`; therefore they reject the synthetic
adapter.

No sprint may change those synthetic values to pass a gate.

## 5. Query envelope and authoritative query types

### 5.1 Query envelope

```json
{
  "query_version": "async-security-query-v2",
  "query_type": "READ_AUTHORITY_SNAPSHOT",
  "environment_id": "opaque",
  "correlation_ref": "opaque",
  "subject_ref": "opaque-or-null",
  "session_token_hash": "sha256-or-null",
  "entitlement_token_hash": "sha256-or-null",
  "exact_scope_hash": "sha256-or-null",
  "requested_runtime": "opaque-or-null",
  "requested_action": "opaque-or-null",
  "required_consistency": "PRIMARY_OR_LINEARIZABLE"
}
```

Raw token, cookie, assertion, email, Profile ID, address, or `SUBDEV1` value is
forbidden in a query.

### 5.2 Exact query types

| Query | Purpose |
|---|---|
| `RESOLVE_CANONICAL_SUBJECT` | Resolve one immutable external-subject mapping |
| `RESOLVE_EXACT_SCOPE` | Detect subject/scope conflicts |
| `GET_SESSION_BY_TOKEN_HASH` | Resolve one current authenticated session |
| `GET_TEMPORARY_ENTITLEMENT_BY_TOKEN_HASH` | Resolve one temporary entitlement |
| `GET_PRIVATE_TEST_APPROVAL` | Read exact environment/subject/scope approval |
| `READ_AUTHORITY_SNAPSHOT` | Read mapping, session, approval, entitlement, and epoch consistently |
| `GET_SECURITY_EPOCH` | Read environment/scope revocation epoch |
| `GET_REPLAY_RESULT` | Recover one completed idempotent result |

All are primary or linearizable reads. Runtime authority must use
`READ_AUTHORITY_SNAPSHOT`; it may not compose authority from unrelated reads.

### 5.3 Query result

```json
{
  "result_version": "async-security-query-result-v2",
  "ok": true,
  "query_type": "READ_AUTHORITY_SNAPSHOT",
  "consistency_proven": true,
  "server_time": "timestamp",
  "record_version": 1,
  "record": {},
  "failure_code": null,
  "receipt_ref": "opaque"
}
```

Missing, ambiguous, stale, malformed, wrong-version, or non-authoritative
results deny.

## 6. Atomic command envelope and types

### 6.1 Command envelope

```json
{
  "command_version": "async-security-command-v2",
  "command_type": "REVOKE_RUNTIME_ACCESS",
  "environment_id": "opaque",
  "idempotency_key_hash": "sha256",
  "fingerprint": "sha256",
  "correlation_ref": "opaque",
  "expected_versions": {},
  "arguments": {}
}
```

### 6.2 Exact atomic commands

| Command | Required atomic effects |
|---|---|
| `BIND_APPROVED_CANONICAL_SUBJECT` | Assert unused immutable subject and scope, bind, audit |
| `BEGIN_PRE_AUTH` | Create pre-auth state, nonce, TTL, audit |
| `ELEVATE_AUTHENTICATED_SESSION` | Consume pre-auth, reject replay, rotate session, invalidate stale CSRF/capabilities, audit |
| `ISSUE_CSRF_GRANT` | Create single-use session/browser/route-bound grant |
| `CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT` | Consume CSRF, apply rate limit, revalidate authority, issue hashed entitlement, audit |
| `CLAIM_REPLAY` | Claim idempotency key and fingerprint |
| `COMPLETE_REPLAY` | Attach content-free result reference |
| `REVOKE_TEMPORARY_ENTITLEMENT` | Mark entitlement revoked, audit |
| `REVOKE_RUNTIME_ACCESS` | Revoke entitlement and session, advance epoch, invalidate CSRF, audit |
| `ADVANCE_SECURITY_EPOCH` | Compare-and-set environment/scope epoch, audit |
| `APPLY_RATE_LIMIT` | Apply distributed counter using authoritative server time |
| `APPEND_SECURITY_AUDIT` | Append unique privacy-safe denial or observation |

An allow mutation is unsuccessful unless its audit receipt commits inside the
same modeled atomic boundary.

### 6.3 Command result

```json
{
  "result_version": "async-security-command-result-v2",
  "ok": true,
  "command_type": "REVOKE_RUNTIME_ACCESS",
  "committed": true,
  "idempotent_replay": false,
  "server_time": "timestamp",
  "new_versions": {},
  "result_refs": {},
  "failure_code": null,
  "audit_receipt_ref": "opaque"
}
```

`ok`, `committed`, exact command type, version, and mandatory audit reference
must all validate before a mutation is acknowledged.

## 7. Canonical security records

### 7.1 Canonical subject decision

```json
{
  "decision_version": "canonical-subject-decision-v2",
  "allowed": true,
  "external_subject_ref": "opaque",
  "subscriber_subject_ref": "opaque",
  "exact_scope_hash": "sha256",
  "subject_security_version": 1,
  "mapping_status": "ACTIVE",
  "auto_enrolled": false,
  "failure_code": null,
  "receipt_ref": "opaque"
}
```

Only an already verified immutable external subject may be resolved. Login,
developer access, and runtime bootstrap cannot invoke
`BIND_APPROVED_CANONICAL_SUBJECT`.

### 7.2 Private-test approval

```json
{
  "record_version": "private-test-approval-v1",
  "approval_ref": "opaque",
  "environment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "exact_scope_hash": "sha256",
  "purpose": "TEMPORARY_PRIVATE_SUBSCRIPTION_TEST",
  "status": "ACTIVE",
  "issued_at": "timestamp",
  "expires_at": "timestamp",
  "security_epoch": 1
}
```

Configuration activation and an active record are both required. Neither is
sufficient alone.

### 7.3 Authenticated session

```json
{
  "record_version": "authenticated-private-session-v2",
  "session_ref": "opaque",
  "session_token_hash": "sha256",
  "subscriber_subject_ref": "opaque",
  "exact_scope_hash": "sha256",
  "browser_binding_hash": "sha256",
  "subject_security_version": 1,
  "session_epoch": 1,
  "status": "ACTIVE",
  "issued_at": "timestamp",
  "expires_at": "timestamp"
}
```

Only token hashes are stored. Rotation invalidates prior CSRF and temporary
entitlements.

### 7.4 Bootstrap eligibility

```json
{
  "decision_version": "private-test-bootstrap-eligibility-v1",
  "allowed": true,
  "environment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "authenticated_session_ref": "opaque",
  "exact_scope_hash": "sha256",
  "approval_ref": "opaque",
  "security_epoch": 1,
  "evaluated_at": "timestamp",
  "expires_at": "timestamp",
  "may_attempt_subdev1": true,
  "runtime_access": false,
  "admin_authority": false,
  "operator_authority": false,
  "deployment_authority": false,
  "billing_authority": false,
  "coach_authority": false,
  "canonical_mutation_authority": false
}
```

### 7.5 Temporary entitlement

```json
{
  "record_version": "temporary-private-entitlement-v2",
  "entitlement_ref": "opaque",
  "entitlement_token_hash": "sha256",
  "environment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "authenticated_session_ref": "opaque",
  "browser_binding_hash": "sha256",
  "exact_scope_hash": "sha256",
  "subject_security_version": 1,
  "session_epoch": 1,
  "source": "temporary_internal_subscription_entitlement",
  "access_type": "more_monthly_intelligence",
  "status": "ACTIVE",
  "issued_at": "timestamp",
  "expires_at": "timestamp",
  "temporary": true,
  "paid_entitlement": false,
  "billing_evidence": false,
  "stripe_subscription_created": false,
  "admin_authority": false,
  "operator_authority": false,
  "deployment_authority": false,
  "billing_authority": false,
  "coach_authority": false,
  "canonical_mutation_authority": false
}
```

The raw entitlement token exists only in a Secure, HttpOnly, SameSite=Strict
cookie. The raw `SUBDEV1` value is never persisted, logged, echoed, or
receipted.

### 7.6 Runtime authority

```json
{
  "decision_version": "private-runtime-authority-decision-v2",
  "allowed": true,
  "authority_fingerprint": "sha256",
  "environment_id": "opaque",
  "subscriber_subject_ref": "opaque",
  "authenticated_session_ref": "opaque",
  "entitlement_ref": "opaque",
  "exact_scope_hash": "sha256",
  "security_epoch": 1,
  "requested_runtime": "BUSINESS_ENGINE_OR_SUBSCRIPTION_RUNTIME_OR_COACH_CONNECT",
  "requested_action": "allowlisted-action",
  "evaluated_at": "timestamp",
  "expires_at": "timestamp",
  "deployment_grade_security_state": false,
  "no_local_fallback": true,
  "admin_authority": false,
  "operator_authority": false,
  "deployment_authority": false,
  "billing_authority": false,
  "coach_authority": false,
  "canonical_mutation_authority": false
}
```

Offline synthetic authority cannot be relabeled as future live authority.

## 8. Privacy-safe receipt schema

```json
{
  "receipt_version": "private-runtime-security-receipt-v2",
  "event_type": "opaque-allowlisted-event",
  "decision": "ALLOWED_OR_DENIED",
  "failure_code": "opaque-or-null",
  "occurred_at": "timestamp",
  "correlation_ref": "opaque",
  "environment_id": "opaque",
  "subscriber_subject_ref": "opaque-or-null",
  "exact_scope_hash": "sha256-or-null",
  "session_ref": "opaque-or-null",
  "entitlement_ref": "opaque-or-null",
  "security_epoch": 1,
  "details": {}
}
```

Forbidden receipt data:

- raw identity assertion, token, cookie, access code, secret, or credential;
- name, email, Profile ID, browser address, network address, or physical
  address;
- Business Engine, BA, BOS, Five Futures, or One Move content;
- Coach Connect content or transcript;
- model prompt/output, media, Stripe, billing, or customer record.

## 9. Canonical async security service

### 9.1 Exact service interface

```js
{
  describe(): Promise<ServiceDescription>,
  health(): Promise<HealthDecision>,
  beginPreAuth(input): Promise<PreAuthDecision>,
  completeAuthentication(input): Promise<AuthenticationDecision>,
  resolveAuthenticatedContext(requestContext): Promise<AuthenticatedContextDecision>,
  evaluatePrivateTestEligibility(authenticatedContext): Promise<EligibilityDecision>,
  issueCsrfGrant(authenticatedContext, intent): Promise<CsrfDecision>,
  issueTemporaryEntitlement(input): Promise<EntitlementDecision>,
  inspectTemporaryEntitlement(requestContext): Promise<EntitlementDecision>,
  evaluatePrivateRuntimeAuthority(input): Promise<RuntimeAuthorityDecision>,
  revokeTemporaryEntitlement(input): Promise<RevocationDecision>,
  logout(input): Promise<LogoutDecision>,
  inspectRecovery(input): Promise<RecoveryDecision>
}
```

Only this service calls `AsyncSecurityStatePortV2`.

### 9.2 Service invariants

- exactly one active mapping per immutable subject and exact scope;
- no runtime auto-enrollment;
- one consistent authority snapshot for each runtime action;
- session, subject, scope, environment, browser, entitlement, version, epoch,
  runtime, and action all match;
- every allow result is short-lived and action-specific;
- emergency disable and shared-state health are checked before allow;
- the service never catches an adapter failure and consults V1;
- denial-audit failure never becomes access;
- service methods never return raw provider records to handlers.

## 10. Developer-access facade

### 10.1 Role

`DeveloperAccessSecurityFacadeV2` preserves the internal route’s safe HTTP and
cookie behavior while routing all security decisions to the canonical
service.

It owns no store and persists no independent capability, CSRF, replay,
rate-limit, epoch, or audit truth.

### 10.2 Exact facade interface

```js
{
  describe(): Promise<FacadeDescription>,
  resolveAuthenticatedContext(requestContext): Promise<AuthenticatedContextDecision>,
  evaluateBootstrapEligibility(requestContext): Promise<EligibilityDecision>,
  issueCsrf(requestContext, intent): Promise<CsrfDecision>,
  issueEntitlement(requestContext, submittedCode): Promise<EntitlementDecision>,
  inspectEntitlement(requestContext): Promise<EntitlementDecision>,
  revokeEntitlement(requestContext): Promise<RevocationDecision>
}
```

`submittedCode` is passed directly to constant-time service verification and
never enters facade logs, state, evidence, or responses.

### 10.3 Compatibility rule

Legacy cookie parsing and safe response helpers may remain reusable. Any helper
that reads or mutates V1 state is forbidden in the V2 route.

## 11. Non-circular entitlement bootstrap

### 11.1 Phase A — authentication

Proves:

- protected-edge context;
- verified subscriber assertion;
- one pre-existing canonical subject;
- one active server-owned session.

Grants authenticated context only.

### 11.2 Phase B — bootstrap eligibility

Proves:

- current authentication;
- exact environment/subject/scope activation;
- active private-test approval;
- healthy state;
- current epoch;
- emergency disable false.

Grants only permission to obtain CSRF and attempt `SUBDEV1`.

### 11.3 Phase C — temporary entitlement

Atomically:

- consumes single-use CSRF;
- applies the canonical rate limit;
- verifies `SUBDEV1` server-side in constant time;
- revalidates session, subject, scope, approval, and epoch;
- stores one entitlement token hash and TTL;
- appends one privacy-safe receipt.

### 11.4 Phase D — runtime authority

Requires one consistent snapshot containing:

- active mapping;
- active authenticated session;
- active approval;
- active temporary entitlement;
- matching environment, scope, subject, browser, versions, and epoch;
- allowlisted runtime and action;
- healthy state;
- emergency disable false.

Only then may the existing bridge attach.

## 12. State machines

### 12.1 Authentication and runtime

```text
NO_SESSION
-> PRE_AUTH
-> AUTHENTICATED
-> BOOTSTRAP_ELIGIBLE
-> ENTITLED
-> PRIVATE_RUNTIME_AUTHORIZED
-> ATTACHED

PRE_AUTH failure -> DENIED
AUTHENTICATED without approval -> INELIGIBLE
ENTITLED expiry/revocation -> AUTHENTICATED
ATTACHED epoch change -> EMERGENCY_DISABLED
any active state + logout -> LOGGED_OUT
outage or ambiguity -> DENIED
```

### 12.2 Temporary entitlement

```text
ABSENT
-> ACTIVE
-> EXPIRED | REVOKED | ROTATED | EMERGENCY_REVOKED
-> terminal
```

Terminal records never reactivate.

### 12.3 Shared-state health

```text
UNCONFIGURED
-> HEALTHY
-> DEGRADED | UNAVAILABLE | PARTITIONED
-> RECOVERING
-> HEALTHY only after authoritative proof
```

Only `HEALTHY` permits an allow decision. `RECOVERING` still denies.

### 12.4 Session lifecycle

```text
PRE_AUTH
-> atomic authenticated rotation
-> ACTIVE
-> ROTATED | REVOKED | EXPIRED | EMERGENCY_REVOKED
```

Rotation invalidates prior CSRF and temporary entitlement.

## 13. Logout, recovery, and emergency disable

### 13.1 Healthy logout

One `REVOKE_RUNTIME_ACCESS` command:

1. revokes the entitlement;
2. revokes the session;
3. advances the epoch;
4. invalidates CSRF;
5. appends the audit receipt.

Handlers then clear cookies and detach runtime handles.

### 13.2 Logout during outage

- clear browser cookies;
- deny further access;
- return `LOGOUT_REVOCATION_UNCONFIRMED`;
- never claim server-side revocation;
- create no local queue or fallback;
- require fresh authentication after recovery.

### 13.3 Restart recovery

After process restart:

1. rebuild the V2 composition from source-default-off scalar configuration;
2. validate the adapter contract and configuration digest;
3. validate health and server time;
4. hash presented cookies;
5. read one authoritative snapshot;
6. revalidate every authority dimension;
7. rebuild existing attachments from canonical references;
8. publish readiness only when all receipts agree.

No process-local snapshot is authority.

### 13.4 Emergency disable

Two controls dominate:

- a default-deny configuration gate checked before every allow decision;
- an authoritative environment/scope security epoch included in every
  snapshot.

`SUBDEV1` cannot change either control.

## 14. Source-default-off live composition

All seven route surfaces import:

```text
getPrivateRuntimeLiveCompositionV2()
```

The accessor returns:

- one fully validated V2 composition; or
- one frozen `UNCONFIGURED` composition whose Promise-returning methods deny.

It never returns null, never imports a V1 default store, never creates a
provider client, and never reads a credential.

The composition interface is:

```js
{
  beginLogin(requestContext): Promise<HttpDecision>,
  completeLogin(requestContext): Promise<HttpDecision>,
  inspectSession(requestContext): Promise<HttpDecision>,
  evaluateDeveloperAccess(requestContext): Promise<HttpDecision>,
  resolveSubscriptionEntitlement(requestContext): Promise<HttpDecision>,
  bootstrap(requestContext): Promise<HttpDecision>,
  logout(requestContext): Promise<HttpDecision>
}
```

Each handler:

1. obtains the composition;
2. awaits exactly one composition operation;
3. validates the settled decision;
4. applies safe headers and cookies;
5. sends one response.

No handler receives a state port or provider client.

## 15. Existing runtime attachment

After `PRIVATE_RUNTIME_AUTHORIZED`, the live composition calls the existing
`createCoachConnectPrivateRuntimeBridge`.

The bridge must continue to:

1. attach exactly one canonical Business Engine;
2. resolve the temporary internal subscription entitlement;
3. attach the existing Subscription Runtime;
4. resolve existing Coach Connect state;
5. attach existing text Coach Connect;
6. validate the complete attachment set;
7. discard every partial set.

The new security service supplies authority and references only. It does not
copy Business Engine payloads, create a second projection, change Profile ID,
change model routing, persist a transcript, or create a runtime.

## 16. Sprint-local implementation requirements

### Sprint 1 — Async Shared-Security Contract

- implement the Promise-only port, schemas, validators, synthetic adapter, and
  V2 exports;
- annotate V1 stores as synchronous synthetic-only without semantic change;
- reject synchronous returns and deployment use of the synthetic adapter.

### Sprint 2 — Developer-Access Security Unification

- implement the facade around an injected canonical-service contract;
- prove GET, POST, DELETE, CSRF, capability, replay, rate limit, audit, and
  revocation all use one service path;
- retain safe HTTP/cookie shaping without state ownership.

### Sprint 3 — Canonical Subject and Private-Test Eligibility

- implement the canonical service subject/session resolution subset;
- implement eligibility with configuration plus active approval;
- deny unknown/ambiguous subjects and all auto-enrollment.

### Sprint 4 — `SUBDEV1` Entitlement Bootstrap

- implement atomic CSRF consumption and temporary entitlement issuance;
- implement private subscription projection;
- keep paid entitlement and Stripe unreachable from private context.

### Sprint 5 — Session, Revocation, and Recovery

- implement inspection, rotation, expiry, revocation, logout, epoch, outage,
  and restart recovery behavior;
- never claim revocation during outage.

### Sprint 6 — Live Handler Composition

- implement the one default V2 composition accessor;
- bind login, callback, developer access, subscription entitlement, session,
  bootstrap, and logout;
- preserve source-default-off behavior;
- await all security decisions before sending responses.

### Sprint 7 — Cross-System Validation

- add only integration tests, verifier, and evidence;
- run all focused, regression, race, failure, and static gates;
- issue the honest default-off implementation verdict;
- hand off to the separate remote-adapter campaign.

## 17. Provider-neutrality boundary

The V2 port may describe future remote behavior. The seven sprints may not
implement or call:

- Redis, Upstash, database clients, provider scripts, transactions, or SDKs;
- provider credentials, URLs, namespaces, configuration, or health checks;
- Auth0 or another identity-provider adapter;
- Vercel or another deployment platform;
- any live persistence, model, media, voice, Stripe, or monitoring provider.

The synthetic adapter is deterministic, offline, and non-deployment-grade.

## 18. Part 2 stop conditions

Stop if:

- a service method cannot be Promise-native end to end;
- a handler would inspect an unsettled Promise;
- a provider-specific operation leaks above the V2 port;
- one atomic domain action requires two authoritative stores;
- a V1 fallback or dual write is proposed;
- eligibility would grant runtime authority;
- `SUBDEV1` would authenticate or establish canonical identity;
- runtime attachment requires product redesign;
- an adapter, credential, deployment, persistence, or protected-root change is
  required.

## 19. AFW-expansion-only statement

Part 2 defines future contracts only. It implements no source, provider
adapter, credential, environment setting, deployment, staging, commit, or
push.
