# MORE Campaign — Private Runtime Remote Shared Security Adapter — Part 1 V1

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_V1`

Part:
`1 — Grounding, Dependency, Provider Decision, Boundaries, Allowlist, Records, and Isolation`

Status:
`AFW EXPANSION — DOCUMENTATION ONLY`

Authoritative architecture packet:
`MORE_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_ARCHITECTURE_V1.md`

Architecture SHA-256:
`dbca624bf46540d1aae7b698dcffc81a845a10f43a28df70e8f7e22a1c4a0c8a`

Architecture verdict:
`PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_ARCHITECTURE_COMPLETE`

Authoritative prerequisite commit:
`d0bde035a0519f8e89135204e88cd428ca0d5800`

Commit subject:
`feat(private-runtime): add async security and entitlement bootstrap v1`

AFW expansion authorized: `true`

Implementation authorized by this expansion: `false`

Provider connection, credentials, environment changes, deployment, staging,
commit, and push authorized: `false`

## 1. Purpose

This package expands the approved remote-adapter architecture into seven
dependency-ordered implementation AFWs for one deployment-grade adapter
implementing `shared-security-state-async-v2`.

The implementation target is one conditional Upstash Redis adapter below the
provider-neutral V2 port. Upstash remains only the reviewed initial provider
candidate. No sprint may weaken the primary-authority, atomicity, audit,
durability, privacy, recovery, or environment-isolation gates merely to make
that provider pass.

This AFW expansion creates documentation only. It does not implement the
adapter, contact a provider, request credentials, create a namespace, change
an environment, inspect Vercel, deploy, stage, commit, or push.

Source-default-off is mandatory for every adapter artifact, composition, and
qualification mode. Capability or qualification evidence never enables a
runtime by itself.

## 2. Governing seven-sprint execution contract

A later implementation mission must:

1. verify the architecture hash, prerequisite commit, V2 baseline digest,
   empty Git index, and fresh protected-root baseline;
2. execute Sprints 1–7 in order;
3. edit only the exact sprint-local allowlist;
4. preserve unrelated dirty-worktree bytes;
5. validate each sprint before continuation;
6. allow at most two bounded repairs for each failed sprint gate;
7. emit a numbered repair receipt for every repair;
8. emit a change receipt for an evidence-driven continuation refinement;
9. stop on architecture, contract, atomicity, consistency, authority,
   provider, credential, privacy, retention, backup, protected-root,
   environment, deployment, persistence, or customer-data conflict;
10. keep static, simulator, disposable-provider, and deployment evidence
    explicitly distinct;
11. run one campaign-wide regression and integration review;
12. package exact implementation and evidence for review;
13. stop before credential binding, deployment, environment activation, or
    tester authorization.

No sprint may compensate for failure with a second store, V1 path, local
cache, process memory, file, product persistence, dual write, or provider
switch.

## 3. Authoritative dependency confirmation

The architecture packet was written before V2 implementation. Its dependency
block is now satisfied by the prerequisite commit; this is a status
transition, not an architecture amendment.

Repository proof at AFW expansion:

| Check | Result |
|---|---|
| HEAD | `d0bde035a0519f8e89135204e88cd428ca0d5800` |
| Subject | `feat(private-runtime): add async security and entitlement bootstrap v1` |
| V2 implementation review SHA-256 | `99b0d88b6bc4087bd5be4c741b892263e43ad863ec2ee46a1200ac746c0b04e1` |
| Implementation verdict | `PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_IMPLEMENTED_WITH_LIMITS` |
| V2 baseline aggregate SHA-256 | `651e12449ea767a527363463e87453d46a7efe306a8c5c82fb5aa6eabc990bd9` |
| Async state contract | `shared-security-state-async-v2` |
| V2 methods | five Promise-native methods |
| V1 production fallback | prohibited |
| Synthetic live authority | rejected |
| Git index at expansion | empty |

The V2 baseline digest covers these exact committed files in lexical order:

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/canonicalAsyncSecurityService.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/developerAccessSecurityFacade.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/eligibility.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSharedSecurityStatePort.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/syntheticAsyncSecurityStateAdapter.js
```

Any material drift at a later implementation baseline stops the campaign for
architecture review.

## 4. Committed V2 compatibility reconciliation

### 4.1 Exact outward contract

The remote adapter must implement, without changing, the committed interface:

```text
describeCapability(): Promise<async-security-capability-description-v2>
health(): Promise<async-security-health-decision-v2>
serverTime(): Promise<async-security-server-time-v2>
queryAuthoritative(query): Promise<async-security-query-result-v2>
executeAtomic(command): Promise<async-security-command-result-v2>
```

The exact validators in `asyncSecurityContracts.js` reject additional fields.
Therefore architecture-level provider metadata such as namespace digest,
configuration digest, script-manifest digest, primary-route proof, and canary
receipt is internal adapter or qualification evidence. It must not be
appended to a V2 port result.

### 4.2 Required internal-to-V2 projection

```text
rich provider capability attestation
  -> validate remote-shared-security-adapter-capability-v1 internally
  -> project exact async-security-capability-description-v2

rich remote health/canary receipt
  -> validate internally
  -> project exact async-security-health-decision-v2

provider server-time proof
  -> validate internally
  -> project exact async-security-server-time-v2

provider script tuple or normalized error
  -> validate internally
  -> project exact V2 query/command result or reject Promise
```

No V2 schema extension, optional-field addition, alias, or fallback is
authorized. Provider-specific normalized error codes remain inside
`RemoteSecurityAdapterErrorV1`; the port boundary maps them to existing V2
failure codes or Promise rejection.

### 4.3 Record translation boundary

Provider records use the architecture's keyed-digest storage schemas.
Committed service-facing records use existing V2 field names and string
record versions. The adapter must maintain an exact, tested projection map.
It may derive a service-facing opaque reference from the validated query and
stored digest; it may not persist a raw identity, token, cookie, code,
assertion, email, address, Profile ID, or product content to make projection
easier.

The canonical service remains the policy authority. Provider records are not
returned raw.

## 5. Provider choice and non-negotiable qualification gate

Initial candidate:

```text
provider: Upstash Redis
topology: one dedicated paid regional database per live-classified environment
transport: server-side HTTPS REST
ordinary authority reads: prohibited
authority primitive: reviewed write-routed versioned Lua scripts
Global Database: prohibited
read regions: prohibited
client/process cache: prohibited
provider telemetry: disabled
```

Upstash is qualified only if a separately authorized disposable-namespace
campaign proves:

- primary/write routing for every authority script;
- acknowledged-write visibility;
- one internally consistent `READ_AUTHORITY_SNAPSHOT`;
- provider server time and TTL;
- truthful compare/read/mutate/audit atomicity;
- fail-closed leader ambiguity, partition, and recovery;
- durability, backup, restore, retention, teardown, latency, cost, and
  privacy gates.

If those facts cannot be proven, the verdict is blocked. The AFWs do not
authorize switching to another provider.

## 6. Authority and activation boundaries

The phases are independent:

| Phase | May occur under a later explicit prompt | Still does not authorize |
|---|---|---|
| Adapter source implementation | Default-off source and offline tests | Provider connection |
| Offline validation | Simulator and static evidence | Live qualification |
| Disposable provider qualification | One empty isolated namespace with explicit temporary qualification credentials | Credential binding, deployment, or activation |
| Credential binding | Separate campaign only | Deployment |
| Private-live deployment | Separate campaign only | Environment activation or tester access |
| Environment activation | Separate named authority only | Tester authorization |
| Tester authorization | Separate named approval only | Admin, operator, deployment, billing, or canonical authority |

This AFW package may describe the first three phases. It authorizes none of
them now and never authorizes phases four through seven.

Sprint 7 must stop before requesting or using a qualification credential
unless the later implementation prompt explicitly authorizes disposable
provider qualification.

## 7. Exact implementation allowlist

This union is exhaustive. A later sprint may use only its declared subset.

### 7.1 New provider-neutral adapter files

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/contracts.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/recordSchemas.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/health.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/index.js
```

`health.js` owns the provider-neutral state machine and denial-only local
circuit breaker. It receives provider canary operations through injection and
does not become authority.

### 7.2 New Upstash/Redis-specific adapter files

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/keyspace.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/atomicCommands.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js
```

These files contain key encoding, Lua sources, write-routed query/command
execution, REST transport, provider response normalization, and provider
capability proof. Native server-side `fetch` is required; package manifests
and lockfiles are protected.

### 7.3 Existing editable seam

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js
```

Only one additive export of `remoteSharedSecurity/index.js` is allowed.

### 7.4 Focused tests

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

### 7.5 Qualification tool

```text
scripts/verifyCoachConnectPrivateRuntimeRemoteSharedSecurityAdapter.mjs
```

No other script, CLI, migration, provider-management tool, or package
dependency is authorized. The verifier must default to offline mode. A
qualification mode must fail before network access unless an explicit
qualification authority receipt and temporary credential references are
supplied by a later authorized prompt.

### 7.6 Campaign evidence root

```text
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/
```

Exact global evidence:

```text
architecture_hash_receipt.json
dependency_commit_receipt.json
v2_contract_compatibility_proof.json
changed_files_inventory.json
exact_allowlist.json
protected_root_proof.json
test_manifest.json
regression_manifest.json
provider_qualification_manifest.json
secret_scan.json
sensitive_content_scan.json
zero_customer_data_proof.json
zero_deployment_activation_proof.json
evidence_manifest.json
repair_receipts.json
change_receipts.json
executive_handoff.md
ai_handoff.json
final_verdict.json
```

Each sprint may emit only the exact paths listed in its AFW. Conditional
`repair_receipt_1.json`, `repair_receipt_2.json`, and
`change_receipt.json` are allowed but are emitted only when the corresponding
event occurs.

## 8. Files consumed unchanged

The adapter may import or test these committed contracts, but no sprint may
edit them:

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSharedSecurityStatePort.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/syntheticAsyncSecurityStateAdapter.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/canonicalAsyncSecurityService.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/developerAccessSecurityFacade.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/eligibility.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js
api/internal/developer-access.js
api/internal/private-runtime-bootstrap.js
api/internal/private-runtime-callback.js
api/internal/private-runtime-login.js
api/internal/private-runtime-logout.js
api/internal/private-runtime-session.js
api/internal/subscription-entitlement.js
```

Product attachment, Business Engine, Subscription Runtime, and Coach Connect
files are regression inputs only.

## 9. Record and keyspace architecture

All provider keys use:

```text
more:cc:security:v2:{<environment_digest>}:<record-family>:<opaque-digest>
```

The braces form one environment hash tag. Provider key components are
allowlisted literals or keyed digests. No raw provider identifier is exposed
above the adapter.

| Record | Primary family | Required index/atomic relationship | Expiry |
|---|---|---|---|
| `CanonicalSubjectMappingV1` | `subject:external` | inverse `subject:scope` created and compared atomically | governed, no active TTL |
| `AuthenticatedSubscriberSessionV1` | `session:token` | session ref and bounded subject/session indexes | policy/session expiry |
| `PrivateTestApprovalV1` | `approval` | exact subject plus exact scope only | approval expiry |
| `TemporaryPrivateEntitlementV2` | `entitlement:token` | session and subject revocation indexes | earliest relevant expiry |
| `CsrfGrantV2` | `csrf` | exact session/browser/route/intent binding | short single-use TTL |
| `SecurityReplayClaimV2` | `replay` | key plus immutable fingerprint | recovery window |
| `SecurityRateLimitV2` | `rate` | provider-time dimension/window | window plus cooldown |
| `SecurityEpochV1` | `epoch` | environment and exact-scope monotonic values | none while restorable |
| `PrivacySafeSecurityAuditV2` | `audit` stream | uniqueness key and mandatory same-script append | approved, maximum 30 days |
| health/recovery metadata | `adapter` | canary and recovery generation only | 60 seconds or maximum 30 days |

Provider-time `PEXPIREAT` and stored expiry must agree. Missing, shorter,
longer, corrupt, wrong-version, wrong-environment, or wrong-namespace state
denies.

## 10. Environment isolation

| Environment | Provider authority | Required boundary |
|---|---|---|
| Local synthetic | none | committed synthetic adapter only |
| Automated offline test | simulator only | unique synthetic fixture namespace |
| Disposable qualification | later explicit authority only | empty dedicated database/namespace and temporary credentials |
| Private Preview | not authorized by these AFWs | separate database and credentials |
| Private production-classified | not authorized by these AFWs | separate paid database and credentials |

No two environments may share mappings, sessions, approvals, entitlements,
CSRF, replay, rate limits, epochs, audit, backups, database identifiers,
credentials, or namespace ownership.

Prefixes are defense in depth. Preview and private production-classified
environments require separate provider databases, not merely different
prefixes.

## 11. Protected roots

Exact protected paths:

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

The only existing-file exception is the single export seam in Section 7.3.
No adjacent production-security V1 file is editable.

Fresh implementation preflight must preserve pre-existing dirty protected
bytes rather than cleaning, reverting, or claiming they belong to this
campaign.

## 12. Prohibited redesign and activity

Do not modify or reinterpret:

- Business Engine, BA, BOS, Five Futures, One Move, Profile ID, or canonical
  dossier;
- Subscription Runtime or Coach Connect semantics;
- private-runtime authority order or temporary `SUBDEV1` semantics;
- deployment architecture or Vercel adapter;
- public onboarding, Stripe, billing, model routing, Luna, voice, media, or
  transcript persistence;
- product event persistence, migrations, CI, packages, lockfiles, or
  environment files.

This AFW expansion performs no provider or network operation and authorizes no
source change.
