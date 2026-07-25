# MORE Campaign — Coach Connect Deployment Readiness — Part 1 V1

Status: `AFW EXPANSION — DOCTRINE AND ARCHITECTURE ONLY`

Generated: `2026-07-25`

Campaign: `MORE_CAMPAIGN_COACH_CONNECT_DEPLOYMENT_READINESS_V1`

Architecture packet:
`MORE_CAMPAIGN_COACH_CONNECT_DEPLOYMENT_READINESS_V1.md`

Architecture packet SHA-256:
`800d2689b5587657b57a802b2bcf6057fcfb7e2dcd237228a0864b42eac0b1e1`

Grounded predecessor commit:
`36fe72a01d34f64e3cd15d94018579da5bc02a1c`

AFW expansion authority: `APPROVED_FOR_AFW_EXPANSION`

Implementation authority: `NOT GRANTED`

Deployment authority: `NOT GRANTED`

## 1. Purpose

Part 1 binds all seven future deployment-readiness sprints to one approved
architecture. It records repository truth, authority, current activation
posture, trust boundaries, the environment and configuration model, the
selected internal topology, protected roots, and the dirty-worktree boundary.

This AFW expansion does not implement or deploy anything. It does not inspect
or modify Vercel or another platform. It creates no credential, secret,
environment, route, adapter, migration, provider connection, or public access.

## 2. Governing execution doctrine

The canonical MMM multi-sprint execution doctrine, as instantiated by the
committed predecessor Parts 1–3 and Sprint AFWs 1–7, requires:

1. pre-author all seven AFWs before implementation;
2. execute as one dependency-ordered campaign;
3. inspect `git status --short` and freeze an exact allowlist per sprint;
4. preserve unrelated work and protected roots;
5. run sprint-local validation before advancement;
6. permit no more than two bounded repairs per failed gate;
7. emit a repair receipt for every repair;
8. stop on authority, scope, secret, provider, production, deployment, public
   access, migration, deletion, persistence, or evidence ambiguity;
9. distinguish static, synthetic, deployment-shaped-offline, and future
   internal-live proof;
10. assemble one indexed review package and one honest verdict;
11. require separate human authority for implementation and for deployment.

No sprint may compensate for a missing earlier gate by creating an alternate
configuration, route, platform, source of truth, or authority path.

## 3. Authority

### 3.1 Authorized in this expansion

- read-only repository grounding;
- contract, schema, state-machine, test, proof, and runbook planning;
- Parts 1–3;
- Sprint AFWs 1–7;
- cross-part consistency review;
- expansion index and AFW review archive.

### 3.2 Not authorized

- implementation;
- deployment or platform inspection;
- Vercel project creation or modification;
- production or preview activation;
- public access or route activation;
- CI provider changes;
- credentials, secrets, or environment changes;
- Auth0, Upstash, Redis, object-store, media, model, or alert-provider access;
- transcript persistence, migration, destructive deletion, or Stripe;
- staging, commit, push, or protected product changes.

### 3.3 Human authorities for a later implementation

| Authority | Required decision |
|---|---|
| Founder / Product Owner | readiness implementation scope and product non-activation |
| Security Architecture | edge denial, gate integrity, secret and incident posture |
| Infrastructure / Operations | isolated-target topology, rollback and monitoring design |
| Privacy | safe logging and confirmation that sensitive persistence stays off |
| Spock / Architecture Reviewer | AFW consistency and no roadmap pull-forward |

Approval is not inferred from Git access, a build, a passing test, developer
capability, `SUBDEV1`, platform access, or a deployment receipt.

## 4. Repository grounding

### 4.1 Predecessor

The Production Security Prerequisites campaign is committed and closed at
`36fe72a01d34f64e3cd15d94018579da5bc02a1c` with verdict:

`COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_COMMITTED_AND_CLOSED_WITH_ACTIVATION_GATES`

Its evidence establishes:

- all prerequisite controls remain default-off;
- deployment readiness, production certification, and production authority are
  false;
- no deployment, live provider, production Redis, object store, transcript
  persistence, migration, destructive deletion, or Stripe action occurred;
- local JSONL remains development-only and logical-denial-only;
- physical deletion of local JSONL is not claimed.

### 4.2 Activation contracts

The repository has four independent default-deny families:

- Production Security Prerequisites;
- Coach Connect;
- Coach Auth;
- the inactive production runtime foundation.

Their defaults disable product capabilities, traffic, providers, writes,
migration, transcript persistence, destructive deletion, and Stripe while
asserting emergency disable. Deployment-readiness implementation may import
these contracts but may not edit, shadow, aggregate around, or weaken them.

### 4.3 Deployment configuration

`vercel.json` currently:

- builds the Vite application;
- outputs `dist`;
- routes `/api/*` to serverless handlers;
- routes all other paths to the SPA;
- contains no repository-enforced internal access policy.

The repository contains many existing API routes. Therefore repository
configuration alone cannot prove internal-only deployment. An unprotected
deployment, existing public project, custom domain, public alias, or public
preview is prohibited.

No committed repository CI workflow was found. Later readiness implementation
may create offline validators only; it may not add CI provider configuration or
hosted previews.

### 4.4 Runtime, persistence, recovery, and proof tooling

Grounded reusable concepts include:

- immutable event envelopes and version validation;
- injected persistence and shared-state ports;
- inactive Redis-shaped and synthetic drivers;
- idempotency, optimistic concurrency, replay and checkpoint recovery;
- emergency-disable-first rollback doctrine;
- content-free audit and privacy-safe telemetry;
- exact allowlists, evidence manifests, archive validation, and secret scans.

These concepts are design inputs only. They do not authorize a live adapter,
production store, provider, migration, transcript backing store, or live
monitoring sink.

### 4.5 Provider wording refinement

Implementation contracts use `provider-specific deployment adapter` and
provider-neutral ports where practical. Vercel remains the selected initial
internal target because the approved architecture and current repository
configuration identify it. This does not authorize a Vercel query, project,
credential, setting, or deployment.

## 5. Architecture invariants

1. Outer edge denial and application denial are independent.
2. Deployment never equals activation.
3. Effective capability is the restrictive intersection of all authorities.
4. Missing, stale, ambiguous, expired, or conflicting state fails closed.
5. Internal default-off deployment requires no Coach Connect application
   secret or live dependency.
6. The target must be isolated from every existing public project and domain.
7. Artifacts are immutable; emergency disable is non-enabling.
8. Code rollback never rolls back security/deletion epochs, tombstones, holds,
   audits, or subject security versions.
9. Logs and alerts are privacy-safe by construction.
10. Public production remains a later architecture and activation campaign.

## 6. Trust boundaries

```text
Untrusted Internet
  |
  v
Provider-specific edge-access adapter
  | exact isolated target
  | named platform identity + MFA
  | global protection for SPA, assets, APIs, errors, redirects, generated URLs
  v
Immutable application artifact
  | artifact/config/environment digests
  v
Deployment gate record
  | deployment may be permitted later
  | activation_permitted=false
  | public_access_permitted=false
  v
Existing application activation families
  | all capabilities disabled
  v
Provider-neutral ports with no live adapters
```

Platform deployment authority, application operator authority, subscriber
authority, coach authority, developer authority, billing authority, and
canonical Business Engine authority remain categorically separate.

## 7. Environment matrix

| Environment | Network posture | Capabilities | State | Providers/secrets | Permitted evidence | Prohibited |
|---|---|---|---|---|---|---|
| Local | loopback by default | OFF or explicit SYNTHETIC | in-memory/local development JSONL | synthetic fixtures only | unit, integration, restart | public bind, production data |
| CI | ephemeral, no inbound route | OFF or SYNTHETIC | ephemeral only | none | deterministic tests/build/scans | hosted preview, live network |
| Preview | build-only by default | OFF | none | none | route/config proof | public preview or alias |
| Internal staging | isolated globally protected target | OFF | none | no application secrets | future INTERNAL_LIVE access/health/rollback proof | public reachability, live adapters |
| Internal production-shaped | isolated globally protected target | OFF | none | no application secrets | future INTERNAL_LIVE restart/monitor/rollback proof | existing public project, data/provider activation |
| Future public production | later campaign | FUTURE | FUTURE | governed later | later campaign only | any action in readiness/internal deployment campaigns |

Unknown or conflicting environment identity returns `ENVIRONMENT_UNVERIFIED`.
Hosted preview creation without proved global edge protection is a stop
condition.

## 8. Configuration authority

### 8.1 Authoritative sources

Effective configuration is the restrictive intersection of:

1. immutable code defaults;
2. committed non-secret readiness policy;
3. environment-specific non-secret manifest;
4. provider-specific deployment-adapter attestation;
5. scoped human approval;
6. current emergency-disable state.

No source is last-writer-wins. A source may disable capability. Enabling
requires every relevant source plus separately authorized activation.

### 8.2 Environment-variable rules

- exact allowlist only;
- literal `true` and `false` only;
- no coercion, trimming, aliases, or unknown keys;
- `VITE_*` is public and never contains authority, token, bypass, or secret;
- no application secret is permitted in the internal default-off target;
- an enablement request without a credential fails; it never prompts for one;
- an unexpected credential while a capability is off also blocks readiness;
- `.env*` and platform exports never enter Git or evidence.

### 8.3 Secret classes

| Class | Treatment |
|---|---|
| Public non-sensitive schema/flag names | may be committed |
| Internal opaque references/digests | least disclosure; hash/opaque evidence |
| Credentials/tokens/URLs/signing material | prohibited in source, target, logs, evidence |
| Assertions/cookies/transcripts/emails/raw addresses/private content | prohibited everywhere in readiness proof |

### 8.4 Fail-closed configuration

Validation must parse strictly, bind exact artifact/environment/policy, reject
secrets and client authority, verify outer access policy, prove all application
capabilities and live dependencies off, prove emergency disable, bind rollback
and monitoring descriptors, and emit a canonical digest. Any failure returns
`CONFIGURATION_NOT_READY`.

## 9. Selected topology

The selected initial topology is one exact isolated Vercel project behind
global platform access protection, with named MFA identities, no upstream
proxy, no custom domain, no public alias, and no reuse of the existing public
project.

Application contracts describe this through a provider-neutral
deployment-adapter port. The exact Vercel project, team, region, URL inventory,
and protection setting remain inputs to the later separately authorized
Internal Default-Off Deployment campaign.

No Coach Connect live dependency is configured:

- no Auth0 activation;
- no Upstash/Redis;
- no object store;
- no model/media provider;
- no transcript persistence or backup;
- no migration;
- no destructive deletion;
- no Stripe.

HSTS remains separately gated. A protected deployment does not activate it.

## 10. Protected roots

Protected predecessor roots:

```text
api/engine/businessAssessment/
api/engine/canonical/
api/engine/vault/
api/stripe/
src/lib/businessAssessment/
src/lib/businessEngine/
src/lib/intelligenceFabric/runtime/
src/lib/intelligenceFabric/bootstrap/
src/lib/intelligenceFabric/subscriber/
src/lib/stripe/
src/lib/stripeCheckout.js
```

Additionally protected:

```text
vercel.json
package.json
package-lock.json
api/
src/lib/intelligenceFabric/coachConnect/productionSecurity/
src/lib/intelligenceFabric/coachConnect/activation.js
src/lib/intelligenceFabric/auth/activation.js
src/lib/intelligenceFabric/production/
.env*
.runtime-data/
```

Business Engine, Coach Connect, BA/BOS, Five Futures, One Move, Profile ID,
Stripe, subscription, canonical promotion, identity, scoring, and local JSONL
truth remain unchanged.

## 11. Dirty-worktree boundary

Unrelated modified and untracked work exists in Business Assessment, Business
Engine, docs, labs, cleanup, and bridge paths. A later implementation must:

- record pre-sprint `git status --short`;
- stage nothing during implementation unless separately authorized;
- use explicit file-level allowlists;
- compare protected-root bytes before and after;
- exclude unrelated work from proof staging and archives;
- stop if separation is unsafe.

## 12. Seven-sprint dependency order

1. Environment and Configuration Authority.
2. Deployment Topology and Activation Gates.
3. Rollback, Recovery, and Compatibility.
4. Monitoring, Alerting, and Privacy-Safe Operations.
5. Operational Runbooks and Incident Procedures.
6. Deployment Proof Harness and Adversarial Validation.
7. Cross-Sprint Integration and Readiness Verdict.

All seven AFWs are companion artifacts to Parts 1–3. Implementation of any
sprint remains unauthorized until all seven AFWs are reviewed and explicit
implementation authority is granted.

## 13. Part 1 verdict

`PART_1_DEPLOYMENT_READINESS_DOCTRINE_COMPLETE`

Repository truth, authority, invariants, boundaries, environments,
configuration authority, selected topology, protected roots, dirty-worktree
handling, and sprint order are fixed without implementation or deployment.
