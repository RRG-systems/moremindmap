# MORE Campaign — Private Runtime Async Security and Entitlement Bootstrap — Part 1 V1

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_V1`

Part:
`1 — Grounding, Authority, Architecture, Boundaries, and Execution Map`

Status:
`AFW EXPANSION — DOCUMENTATION ONLY`

Authoritative architecture packet:
`/Users/rrg/Desktop/MORE_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_ARCHITECTURE_REPAIR_V1.md`

Architecture SHA-256:
`8c117ab7e40fde69536d67d43558e69dfa3d078f10eaeb0ff88105cfa9117046`

Architecture verdict:
`PRIVATE_RUNTIME_ASYNC_SECURITY_ENTITLEMENT_ARCHITECTURE_REPAIRED`

Repository baseline:
`46308958085fb84cd3ff6f2f081b8f2944774ecd`

AFW expansion authorized: `true`

Implementation authorized: `false`

Provider-adapter implementation authorized: `false`

Deployment authorized: `false`

Staging, commit, and push authorized: `false`

## 1. Purpose

This package expands the repaired architecture into seven dependency-ordered
implementation AFWs. A later, separately authorized implementation campaign
may implement only:

- Promise-only V2 shared-security contracts;
- one canonical async security service;
- one synthetic async security adapter;
- one developer-access compatibility facade backed by that service;
- canonical-subject and private-test eligibility decisions;
- non-circular temporary `SUBDEV1` entitlement issuance;
- session, revocation, restart recovery, and emergency disable;
- source-default-off composition of the existing internal handlers;
- offline cross-system validation.

The campaign stops before a real remote adapter, provider connection,
credential, environment mutation, deployment, or live qualification.

## 2. Governing execution contract

The canonical MMM multi-sprint execution contract applies:

1. pre-author all seven AFWs before implementation;
2. execute the seven sprints in order;
3. inspect `git status --short` and freeze the exact sprint allowlist before
   each edit;
4. preserve unrelated work and protected roots;
5. validate each sprint before advancing;
6. allow no more than two bounded repairs for a failed sprint gate;
7. emit a repair receipt for every repair;
8. emit one change receipt when evidence changes a later implementation
   assumption without leaving this architecture;
9. stop on architecture, authority, identity, privacy, provider, credential,
   deployment, persistence, public-access, Stripe, migration, deletion, or
   protected-root conflict;
10. distinguish static, synthetic, deployment-shaped-offline, and future live
    evidence;
11. run one campaign-wide consistency, regression, and integration review;
12. produce one indexed implementation-review package under later authority;
13. never treat implementation completion as provider or deployment approval.

No sprint may compensate for a failed earlier gate with another store,
identity, authority path, runtime, handler, provider, or fallback.

## 3. Authority boundary

### 3.1 Authorized by this AFW expansion

- read-only repository and package grounding;
- Parts 1–3;
- Sprint AFWs 1–7;
- exact future source, test, verifier, and evidence allowlists;
- contracts, schemas, state machines, tests, and validation planning;
- cross-part consistency review;
- expansion index and twelve-entry AFW review ZIP.

### 3.2 Not authorized

- source, test, verifier, or runtime implementation;
- a real provider adapter or provider SDK;
- Auth0, Redis, Upstash, Vercel, database, model, media, or voice access;
- credentials, secrets, environment variables, live namespaces, or health
  checks;
- production or transcript persistence;
- public routes, public registration, onboarding, billing, or Stripe;
- Luna, model routing, Five Futures, One Move, BA, BOS, Profile ID, Business
  Engine, Subscription Runtime, or Coach Connect redesign;
- migration, destructive deletion, staging, commit, push, or deployment.

Passing this AFW review grants neither implementation nor deployment
authority.

## 4. Authoritative repository grounding

### 4.1 Reviewed inputs

| Evidence | Repository fact |
|---|---|
| Architecture repair packet | Hash and verdict shown above |
| Stopped live-wiring receipt | `lab_outputs/coach_connect_private_runtime_live_wiring_v1/root_cause_receipt.json` |
| Private Runtime Enablement | Committed bridge and reviewed implementation package |
| Production Security Prerequisites | Provider-neutral subject/session/security contracts remain default-off |
| Deployment Readiness | Static and synthetic proof cannot certify a provider or deployment |
| Current developer access | Uses the distinct synchronous `security` store |
| Current private-runtime handlers | Factory defaults are disabled and unbound |
| Current private-runtime bridge | Already attaches one canonical Business Engine and existing runtimes |

The reviewed packages remain evidence inputs, not implementation authority:

| Package | SHA-256 |
|---|---|
| `COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_IMPLEMENTATION_REVIEW_V1.zip` | `c788ed458ced9e5ad81bc8c897760d96682bddfc08bfb3093186e1905aa27ac1` |
| `COACH_CONNECT_PRIVATE_LIVE_TEST_DEPLOYMENT_IMPLEMENTATION_REVIEW_V1.zip` | `c60caf3dcc2d8de8cb4dae2e4e3038ef4830d32d700eebbd7c2bab5facc6ec54` |
| `COACH_CONNECT_PRIVATE_RUNTIME_LIVE_WIRING_IMPLEMENTATION_REVIEW_V1.zip` | `faaae7a48937bca7e54cffa3889fb790f486cf5981e2063dcec8335505819dc8` |

### 4.2 Exact root causes

1. `REMOTE_STATE_ASYNC_CONTRACT_MISMATCH`: synchronous consumers cannot
   truthfully use a remote, Promise-returning shared-state adapter.
2. `DUPLICATE_SECURITY_PORT_CONTRACTS`: developer access and production
   security hold incompatible synchronous store contracts and would create
   split authority if adapted separately.
3. `PRE_ENTITLEMENT_AUTHORITY_CYCLE`: production developer access demands a
   private-runtime allow decision before issuing `SUBDEV1`, while that runtime
   decision requires an active `SUBDEV1` entitlement.
4. `UNBOUND_DEFAULT_COMPOSITION`: current default serverless exports receive
   disabled gates or null functions and cannot be wired by scalar environment
   configuration alone.

The architecture repair resolves these without authorizing the absent remote
provider adapter.

### 4.3 Existing contracts consumed unchanged

- `productionSecurity/subjectBinding.js` canonical subject validation;
- `productionSecurity/sessionElevation.js` V1 synchronous behavior for
  existing tests only;
- `privateRuntime/composition.js` existing bridge;
- `privateRuntime/attachments.js` exact attachment validation;
- `privateRuntime/authority.js` existing authority semantics;
- existing canonical Business Engine attachment port;
- existing Subscription Runtime service;
- existing text-only Coach Connect service.

## 5. Current call graph

```text
private-runtime-login default
  -> enabled false or beginLogin null
  -> deny

private-runtime-callback default
  -> enabled false or completeLogin null
  -> deny

private-runtime-session default
  -> enabled false or inspectSession null
  -> deny

private-runtime-bootstrap default
  -> enabled false or bootstrap null
  -> deny

private-runtime-logout default
  -> enabled false or logout null
  -> deny

developer-access default
  -> getDefaultDeveloperSecurityStore()
  -> InMemorySecurityStateStore
  -> null canonical resolver
  -> null private-runtime authority resolver
  -> production denied

subscription-entitlement private path
  -> developer security store capability lookup
  -> unavailable default live bindings

private-runtime bridge
  -> reachable through injected composition only
  -> one Business Engine
  -> existing Subscription Runtime
  -> existing Coach Connect
```

## 6. Repaired call graph

```text
default internal handlers
  -> getPrivateRuntimeLiveCompositionV2()
  -> fully validated V2 composition or frozen UNCONFIGURED denial

login
  -> CanonicalAsyncSecurityServiceV2.beginPreAuth()
  -> AsyncSecurityStatePortV2.executeAtomic(BEGIN_PRE_AUTH)

callback
  -> separately approved subscriber assertion port
  -> CanonicalAsyncSecurityServiceV2.completeAuthentication()
  -> RESOLVE_CANONICAL_SUBJECT
  -> ELEVATE_AUTHENTICATED_SESSION

developer access
  -> resolveAuthenticatedContext()
  -> evaluatePrivateTestEligibility()
  -> issue and consume CSRF
  -> verify SUBDEV1 server-side
  -> CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT

subscription entitlement
  -> DeveloperAccessSecurityFacadeV2
  -> inspectTemporaryEntitlement()
  -> READ_AUTHORITY_SNAPSHOT
  -> temporary unpaid entitlement projection

session
  -> resolve authenticated context
  -> inspect temporary entitlement
  -> READ_AUTHORITY_SNAPSHOT

bootstrap
  -> evaluatePrivateRuntimeAuthority()
  -> existing private-runtime bridge
  -> exactly one canonical Business Engine
  -> existing Subscription Runtime
  -> existing text Coach Connect

logout
  -> REVOKE_RUNTIME_ACCESS
  -> revoke entitlement and session
  -> advance epoch
  -> clear cookies and detach handles
```

No handler calls an adapter directly. No response may be sent before every
security Promise required for that response has settled and validated.

## 7. Selected async architecture

### 7.1 Canonical security path

```text
internal handler
  -> PrivateRuntimeLiveCompositionV2
  -> CanonicalAsyncSecurityServiceV2
  -> AsyncSecurityStatePortV2
```

The service is the only security decision authority. The state port owns
durable atomic mechanics. The synthetic adapter models the port but reports:

```text
deployment_grade = false
live_connection_verified = false
provider_name = SYNTHETIC
```

Preview and Production must reject it.

### 7.2 Promise-only port

The exact V2 methods are:

```text
describeCapability(): Promise<CapabilityDescription>
health(): Promise<HealthDecision>
serverTime(): Promise<ServerTimeReceipt>
queryAuthoritative(query): Promise<QueryResult>
executeAtomic(command): Promise<CommandResult>
```

Non-thenable returns are contract failures. No V2 caller may accept a V1
object, coerce a Promise to truth, or authorize from a local cache.

### 7.3 One authority sequence

```text
EDGE_ATTESTED
-> AUTHENTICATED
-> CANONICAL_SUBJECT_RESOLVED
-> BOOTSTRAP_ELIGIBLE
-> TEMPORARY_ENTITLEMENT_ACTIVE
-> PRIVATE_RUNTIME_AUTHORIZED
-> ATTACHED
```

`SUBDEV1` neither authenticates nor establishes canonical identity. Eligibility
permits only a code attempt. Runtime authority requires the active temporary
entitlement.

## 8. Mandatory invariants

- one `CanonicalAsyncSecurityServiceV2`;
- one authoritative V2 record set;
- one active canonical subject for one exact scope;
- one canonical Business Engine;
- existing Subscription Runtime only;
- existing text Coach Connect only;
- no V1 fallback and no V1/V2 dual read or dual write;
- no mixed synchronous/asynchronous default composition;
- no auto-enrollment;
- authentication before eligibility;
- eligibility before entitlement;
- entitlement before runtime authority;
- `SUBDEV1` grants no administrator, operator, deployment, billing, coach, or
  canonical authority;
- every allow mutation includes its privacy-safe audit receipt atomically;
- emergency disable overrides every access path;
- outage, ambiguity, timeout, malformed state, partition, and recovery fail
  closed;
- source defaults remain deny;
- synthetic adapter is rejected in Preview and Production;
- paid entitlement, Stripe, model routing, Luna, voice, media, transcripts,
  production persistence, and public onboarding remain untouched.

## 9. Exact campaign implementation allowlist

This is the complete union available to a later implementation campaign.
Every sprint allowlist must be a strict subset. No inferred adjacent file is
allowed.

### 9.1 New production-security files

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSharedSecurityStatePort.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/syntheticAsyncSecurityStateAdapter.js
```

### 9.2 New private-runtime files

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/canonicalAsyncSecurityService.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/developerAccessSecurityFacade.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/eligibility.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js
```

### 9.3 Existing composition and export seams

```text
api/internal/developer-access-security.js
api/internal/developer-access.js
api/internal/subscription-entitlement.js
api/internal/private-runtime-login.js
api/internal/private-runtime-callback.js
api/internal/private-runtime-session.js
api/internal/private-runtime-bootstrap.js
api/internal/private-runtime-logout.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js
```

### 9.4 V1 metadata-only compatibility seams

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/sharedSecurityStatePorts.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/inMemorySharedSecurityState.js
src/lib/intelligenceFabric/coachConnect/security/ports.js
src/lib/intelligenceFabric/coachConnect/security/inMemorySecurityStateStore.js
```

These four files may receive only explicit V1, synchronous, synthetic-only
metadata or deprecation notices. Their method behavior must not change.

### 9.5 Exact focused tests

```text
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.contracts.test.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.developerAccess.test.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.adversarial.test.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.entitlement.test.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.recovery.test.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.handlers.test.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.integration.test.js
```

### 9.6 Verifier

```text
scripts/verifyCoachConnectPrivateRuntimeAsyncSecurityRepair.mjs
```

### 9.7 Evidence

Only the exact evidence files enumerated by Part 3 and each Sprint AFW are
allowed under:

```text
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/
```

The directory is not an open-ended source allowlist.

## 10. Sprint file ownership

| Sprint | Source owner |
|---|---|
| 1 | V2 port, schemas, synthetic adapter, V2 exports, V1 metadata notices |
| 2 | developer-access facade and its isolated tests |
| 3 | canonical async service, eligibility, private-runtime exports |
| 4 | entitlement methods, facade projection, subscription resolver |
| 5 | lifecycle methods and recovery behavior in the canonical service |
| 6 | live composition and seven default route surfaces |
| 7 | integration test, verifier, and campaign evidence only |

A later sprint may edit an earlier sprint source only when its own exact
allowlist names that file and predecessor tests rerun. An evidence-driven
continuation refinement requires a change receipt. Architecture or authority
change requires stop and review.

## 11. Protected roots

The future implementation must not modify:

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
src/lib/intelligenceFabric/coachConnect/liveSession/**
src/lib/intelligenceFabric/coachConnect/internalDeployment/**
src/lib/intelligenceFabric/coachConnect/deploymentReadiness/**
api/stripe/**
src/lib/stripe/**
vercel.json
package.json
package-lock.json
```

Also protected:

- Business Engine, BA, BOS, Five Futures, One Move, Profile ID, and canonical
  dossier semantics;
- Subscription Runtime and Coach Connect product behavior;
- model selection, pricing, public UI, public routes, registration, and
  onboarding;
- all provider adapters, migrations, CI configuration, credentials, and
  environment configuration.

The protected-root baseline digests recorded during this AFW expansion are:

```text
aggregate_roots_sha256=29d6dd0977bb3266b9b6823eccbffc6edbff5d298460dbbe053e41020d5790a7
explicit_files_sha256=6f58ba9b1a6d2f863081195bfb0e558955a48a1c7363f64bfebafccd33607577
```

These hashes include pre-existing user work. They prove preservation across
this documentation mission; a future implementation must record a fresh
preflight baseline and compare the same exact roots.

## 12. V1/V2 compatibility boundary

### 12.1 V1

- remains synchronous;
- remains available to named existing synthetic tests;
- remains non-deployment-grade;
- cannot be passed into a V2 service;
- cannot be the default handler store after V2 composition;
- cannot be consulted on V2 miss, rejection, timeout, or outage.

### 12.2 V2

- every port and service method returns a Promise;
- every security consumer awaits the result;
- every result is schema-validated after settlement;
- exact contract versions are required;
- adapters are capability-checked before use;
- one synthetic adapter proves behavior but cannot satisfy Preview or
  Production;
- default composition denies when V2 is absent or invalid.

### 12.3 Migration rule

There is no live record migration in this campaign:

1. add V2 contracts and synthetic tests;
2. move default internal composition to V2 while source-default-off;
3. retain named V1 synthetic tests;
4. perform no dual write and no fallback read;
5. leave V1 deletion to a separately reviewed cleanup;
6. leave real adapter implementation to the named next campaign.

## 13. Seven-sprint order

1. Async Shared-Security Contract
2. Developer-Access Security Unification
3. Canonical Subject and Private-Test Eligibility
4. `SUBDEV1` Entitlement Bootstrap
5. Session, Revocation, and Recovery
6. Live Handler Composition
7. Cross-System Validation

Each sprint consumes the complete receipt and hashes of every predecessor.

## 14. Dirty-worktree boundary

The repository contains pre-existing modified Business Engine and Business
Assessment files plus unrelated untracked campaign evidence. They are outside
this AFW package.

No AFW authorizes:

- staging the workspace wholesale;
- reverting or cleaning unrelated files;
- packaging unrelated artifacts;
- claiming the repository was clean;
- treating pre-existing protected changes as campaign implementation.

The later implementation must record baseline status and use explicit
file-level comparisons.

## 15. Campaign stop conditions

Stop if:

- the architecture packet hash, verdict, or baseline authority changes;
- a second identity, security service, record set, store, handler, Business
  Engine, Subscription Runtime, or Coach Connect runtime is required;
- a V1 store would serve a V2 request;
- a Promise can reach a Boolean decision before settlement and validation;
- canonical subject resolution requires auto-enrollment;
- `SUBDEV1` would authenticate or grant non-subscription authority;
- a real provider adapter, SDK, credential, environment, namespace, health
  check, or network request is required;
- Business Engine, Subscription Runtime, Coach Connect, deployment, Stripe,
  model, voice, Luna, or public semantics must change;
- production or transcript persistence, migration, or deletion is required;
- a protected or non-allowlisted file must change;
- a failed gate needs a third bounded repair.

## 16. Separate provider-adapter handoff

Successful implementation of these seven AFWs ends with default-off,
offline-tested composition and this required next campaign:

`MORE_CAMPAIGN_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_V1`

That campaign alone may seek authority to name and implement a real remote
adapter. It must not infer deployment authority.

## 17. AFW-expansion-only statement

Part 1 is documentation only. It performs no implementation, provider
inspection, credential access, environment change, Vercel inspection,
deployment, staging, commit, or push.
