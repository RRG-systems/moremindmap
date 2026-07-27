# MORE Campaign — Coach Connect Private Runtime Enablement — Part 1 V1

Campaign: `MORE_CAMPAIGN_COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_V1`

Part: `1 — Repository Grounding, Authority, Boundaries, and Execution Map`

Authoritative Architecture Packet:
`/Users/rrg/Desktop/MORE_CAMPAIGN_COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_V1.md`

Architecture SHA-256:
`42291cdc467a7895b65f2e313d81751febf55ca7ab90bec6dce0a3d538401765`

Architecture verdict:
`PRIVATE_RUNTIME_ENABLEMENT_ARCHITECTURE_COMPLETE`

AFW expansion authority only: `true`

Implementation authorized: `false`

Deployment authorized: `false`

---

## 1. Purpose

This seven-sprint campaign prepares the minimum server-side composition bridge
needed for:

```text
SUBDEV1
-> verified authenticated subscriber
-> one canonical subject and exact scope
-> one canonical Business Engine
-> existing Subscription Runtime
-> existing Coach Connect
```

The campaign does not create another Business Engine, another subscription
runtime, another Coach Connect runtime, a developer product, or a new
intelligence authority. It composes existing contracts and fails closed when
any prerequisite cannot be proven.

## 2. Governing authority

### 2.1 This AFW package grants

- documentation-only AFW expansion;
- repository-grounded design of exact future implementation actions;
- exact candidate file and action allowlists;
- sprint-local contracts, state machines, tests, evidence, repair limits, and
  stop conditions;
- one AFW review ZIP.

### 2.2 This AFW package does not grant

- implementation or source changes;
- live Auth0, Redis, Upstash, Vercel, model, media, object-store, or alert
  provider access;
- credentials, secrets, environment variables, or access-code changes;
- deployment, target inspection, public access, or private-live proof;
- production persistence or production/customer data;
- transcript persistence, migration, deletion, or physical JSONL deletion
  claims;
- Stripe, checkout, billing, or paid entitlement;
- activation, staging, commit, push, or certification.

### 2.3 Ratified predecessor decisions

The Human Decision Ratification dated `2026-07-24` remains controlling:

| Decision | Approved contract | AFW treatment |
|---|---|---|
| `SUBSCRIBER_AUTHORITY_SOURCE` | Auth0 OIDC initial adapter; immutable `(issuer, sub)` mapping; provider-neutral internal contract | Consume contract; no adapter wiring |
| `SUBSCRIBER_SESSION_OWNER` | Server-owned opaque rotating BFF session with atomic pre-auth invalidation | Consume unchanged |
| `SHARED_STATE_PLATFORM` | Upstash initial adapter conditional on deployment-grade capability proof | Define provider-neutral composition and offline conformance only |

No sprint may silently reopen or approve a provider connection.

## 3. Canonical execution contract

All seven sprints form one ordered campaign:

1. execute in dependency order;
2. validate every sprint locally before advancing;
3. permit at most two bounded repair cycles per failed sprint or phase gate;
4. emit a repair receipt for every repair;
5. emit a change receipt only when an earlier result changes a later
   implementation assumption without leaving the approved architecture;
6. stop on authority, protected-root, identity, privacy, provider, persistence,
   deployment, or architecture conflict;
7. run one campaign-wide consistency, regression, and integration review;
8. build one indexed implementation-review ZIP only under a later explicit
   implementation mission;
9. never treat implementation as deployment or activation.

## 4. Repository grounding

Baseline HEAD:
`d5a93c81d509b3ca71c398f78747018bd8125f62`

### 4.1 Exact blockers

| Blocker | Current source | Required bridge-only action |
|---|---|---|
| Environment-name denial | `api/internal/developer-access-security.js` hard-denies Production | Replace only with the full private-runtime authority decision; defaults remain deny |
| In-memory default store | `api/internal/developer-access-security.js` constructs `InMemorySecurityStateStore` | Inject a validated shared-state port through the private-runtime composition root; never fall back |
| Missing canonical resolver | exported `api/internal/developer-access.js` handler receives no canonical context resolver | Supply the bridge resolver and current session context |

### 4.2 Security contracts already present

- canonical subject validation and one-to-one mapping;
- provider-neutral authentication assertion shape;
- server-owned pre-auth and authenticated sessions;
- atomic rotation, CSRF generation, replay denial, revocation, and session
  epochs;
- shared-security-state method and deployment-capability validation;
- subject/session/browser-bound developer capability;
- temporary internal subscription entitlement with billing, Stripe, admin,
  coach, operator, and canonical authority false.

These are reused. Their semantics are protected.

### 4.3 Runtime contracts already present

- `BusinessEngineContract` is the existing canonical read projection;
- Subscription Runtime exposes its existing commands and queries behind
  activation, exact-scope authorization, confirmation, and idempotency;
- Coach Connect exposes existing services behind relationship, consent,
  entitlement, coach-auth, privacy, promotion, and capability gates;
- Coach Connect inspection already requires one Business Engine and no second
  engine;
- `DeveloperAccessPanel` already accepts a verified entitlement callback;
- the Business Assessment visual route already holds the canonical Business
  Engine contract.

### 4.4 Dirty-worktree boundary

The repository contains unrelated modified Business Engine and Business
Assessment files plus prior untracked campaign artifacts. They are user-owned
and excluded. Future implementation must snapshot `git status --short`, record
the starting hashes of every protected dirty file, and refuse any overlap that
cannot be separated safely.

No sprint may revert, stage, reformat, package, or claim unrelated work.

## 5. Trust and authority layers

```text
protected edge identity + MFA
  != authenticated subscriber assertion
  != canonical subscriber mapping
  != SUBDEV1 temporary entitlement
  != runtime attachment
  != operator/coach/billing/canonical authority
```

Every successful request requires:

1. approved private environment;
2. named edge identity and MFA attestation;
3. verified subscriber assertion;
4. exact active canonical mapping;
5. active server-owned session;
6. active founder/tester approval;
7. active `SUBDEV1` capability;
8. healthy deployment-grade shared security state;
9. exact-scope runtime attachment set;
10. allowlisted runtime action.

One missing item denies. A client-side unlocked flag is never authority.

## 6. Core invariants

1. One immutable external subject maps to one active exact canonical scope.
2. One exact scope maps to one active canonical subject.
3. One attachment set references exactly one canonical Business Engine.
4. Subscription Runtime and Coach Connect receive the identical scope and
   Business Engine reference.
5. `SUBDEV1` is evaluated only after authentication and session elevation.
6. Security state contains control-plane records only.
7. Private-test product state is isolated from production/customer namespaces.
8. Defaults remain false; emergency disable dominates every scoped grant.
9. No provider, persistence, transcript, migration, deletion, or Stripe
   capability is activated by implementation.
10. No local or process-memory fallback may authorize a hosted request.

## 7. Campaign-wide exact candidate allowlist

This is the union of all sprint allowlists. It remains candidate scope until a
separate implementation mission approves it.

### 7.1 New bridge source

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/activation.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/attachments.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/authority.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/composition.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/evidence.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/failureCodes.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/sessionResolver.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/subjectRegistryPort.js
```

No other source file may be added to that namespace without architecture
review.

### 7.2 Exact existing integration seams

```text
api/internal/developer-access-security.js
api/internal/developer-access.js
api/internal/subscription-entitlement.js
src/components/businessAssessment/DeveloperAccessPanel.jsx
src/BusinessAssessmentVisualMap.jsx
```

Allowed changes are limited to dependency injection, current-session binding,
the complete private-runtime authority decision, the existing `onUnlocked`
composition callback, and adjacent rendering of already implemented runtime
surfaces. No product, scoring, projection, or checkout behavior may change.

### 7.3 New internal-only handlers

```text
api/internal/private-runtime-login.js
api/internal/private-runtime-callback.js
api/internal/private-runtime-session.js
api/internal/private-runtime-bootstrap.js
api/internal/private-runtime-logout.js
```

Handlers remain default-off, provider-neutral, internally gated, and
nonfunctional without injected verified assertion and shared-state ports. They
must contain no provider SDK, credential lookup, public registration, or
product logic.

### 7.4 Narrow client composition host

```text
src/components/businessAssessment/PrivateRuntimeAttachmentHost.jsx
```

It consumes receipts and already implemented projections only. It is not a new
Business Engine, subscription product, or Coach Connect experience.

### 7.5 Focused tests

```text
test/intelligenceFabric.coachConnect.privateRuntime.subject.test.js
test/intelligenceFabric.coachConnect.privateRuntime.security.test.js
test/intelligenceFabric.coachConnect.privateRuntime.businessEngine.test.js
test/intelligenceFabric.coachConnect.privateRuntime.subscription.test.js
test/intelligenceFabric.coachConnect.privateRuntime.coachConnect.test.js
test/intelligenceFabric.coachConnect.privateRuntime.validation.test.js
test/intelligenceFabric.coachConnect.privateRuntime.integration.test.js
```

### 7.6 Validator, runbooks, and evidence

```text
scripts/verifyCoachConnectPrivateRuntimeEnablement.mjs
docs/runbooks/coach_connect/private_runtime_enablement/subject_enrollment.md
docs/runbooks/coach_connect/private_runtime_enablement/login_session.md
docs/runbooks/coach_connect/private_runtime_enablement/runtime_attach.md
docs/runbooks/coach_connect/private_runtime_enablement/restart_recovery.md
docs/runbooks/coach_connect/private_runtime_enablement/logout_revocation.md
docs/runbooks/coach_connect/private_runtime_enablement/emergency_disable.md
docs/runbooks/coach_connect/private_runtime_enablement/incident_response.md
docs/runbooks/coach_connect/private_runtime_enablement/post_enablement_validation.md
lab_outputs/coach_connect_private_runtime_enablement_v1/**
```

Evidence output is generated data, not implementation authority. It must
exclude secrets, identity data, private content, production data, and unrelated
work.

## 8. Exact prohibited files and roots

All paths not listed in Section 7 are prohibited. Explicit protected roots:

```text
src/lib/businessEngine/**
src/lib/businessAssessment/**
src/components/businessAssessment/BusinessEngineVisualV2.jsx
api/engine/**
api/business-assessment/**
src/lib/intelligenceFabric/production/**
src/lib/intelligenceFabric/coachConnect/activation.js
src/lib/intelligenceFabric/coachConnect/contracts.js
src/lib/intelligenceFabric/coachConnect/service.js
src/lib/intelligenceFabric/coachConnect/stateMachines.js
src/lib/intelligenceFabric/coachConnect/projections.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/**
src/lib/intelligenceFabric/coachConnect/internalDeployment/**
src/lib/intelligenceFabric/coachConnect/deploymentReadiness/**
src/lib/intelligenceFabric/coachConnect/liveSession/**
api/stripe/**
src/lib/stripe/**
vercel.json
package.json
package-lock.json
.github/**
.env
.env.*
```

Also protected:

- BA and BOS scoring;
- Five Futures and One Move contracts, identity, state, and authority;
- Profile ID generation, parsing, mapping, or retrieval;
- canonical append, consent, conflict, privacy, deletion, and promotion roots;
- deployment/provider adapters, target configuration, domains, aliases, and CI;
- public registration, onboarding, and customer-facing product semantics;
- credentials and secrets.

## 9. Sprint dependency map

```text
Sprint 1 subject contracts
  -> Sprint 2 security/session composition
    -> Sprint 3 Business Engine attachment
      -> Sprint 4 Subscription Runtime attachment
        -> Sprint 5 Coach Connect attachment
          -> Sprint 6 lifecycle/adversarial validation
            -> Sprint 7 cross-system integration and verdict
```

No sprint may skip a predecessor receipt or replace it with an assumption.

## 10. Sprint-to-file ownership

| Sprint | Primary writable candidates |
|---|---|
| 1 | `contracts.js`, `failureCodes.js`, `subjectRegistryPort.js`, subject tests/evidence |
| 2 | `activation.js`, `authority.js`, `sessionResolver.js`, developer-access seams, login/callback/session/logout handlers, security tests/evidence |
| 3 | `attachments.js`, Business Engine attachment tests/evidence |
| 4 | `composition.js`, `subscription-entitlement.js`, bootstrap handler, attachment host, subscription tests/evidence |
| 5 | `attachments.js`, `composition.js`, attachment host, Coach Connect tests/evidence |
| 6 | `evidence.js`, validator, runbooks, validation tests/evidence |
| 7 | `index.js`, narrow UI-host wiring, integration tests, final evidence |

Shared files may be touched by a later sprint only for the dependency described
above. Unrelated cleanup is prohibited.

## 11. Campaign stop conditions

Stop before implementation, or during a later implementation, if:

- the Architecture Packet hash differs;
- any sprint requires a non-allowlisted file;
- Business Engine, Subscription Runtime, Coach Connect, Five Futures, One
  Move, BA, BOS, Profile ID, security, deployment, provider, or Stripe
  semantics must change;
- exact one-to-one subject mapping cannot be proven;
- one canonical Business Engine cannot be proven;
- a duplicate runtime or developer product is required;
- shared security state would fall back to in-memory/local state;
- live Auth0, Redis, Upstash, persistence, media/model, transcript, migration,
  deletion, Stripe, deployment, or credentials are required for offline
  implementation proof;
- production/customer data is required;
- public access or self-registration is required;
- emergency disable, revocation, restart, or partial-attachment rollback
  cannot fail closed;
- unrelated dirty work cannot be separated;
- more than two bounded repairs are required for a failed gate.

## 12. Part verdict

`PRIVATE_RUNTIME_ENABLEMENT_PART_1_AFW_READY`

This verdict means the repository grounding, authority boundaries, exact union
allowlist, protected roots, dependency order, and stop conditions are ready
for AFW review. It does not authorize implementation or deployment.
