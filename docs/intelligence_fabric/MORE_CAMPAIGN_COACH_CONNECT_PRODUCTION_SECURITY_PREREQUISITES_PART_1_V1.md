# MORE Campaign — Coach Connect Production Security Prerequisites — Part 1 V1

Status: `AFW EXPANSION — DOCTRINE AND ARCHITECTURE ONLY`
Generated: `2026-07-24`
Repository: `/Users/rrg/.openclaw/workspace/moremindmap-live`
Grounded predecessor: `d42b52a27e8dae0ea4f53a444ee073a752fcdecd`
Implementation authority: `NOT GRANTED`
Deployment authority: `NOT GRANTED`

## 1. Purpose

This part defines doctrine, repository truth, threat model, trust boundaries,
protected roots, the nine production-security prerequisite decisions, and the
human authority checkpoints for a later separately authorized implementation.

The companion
`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`
makes business, legal, hosting, identity-provider, and operations decisions
decision-ready through concrete recommendations. Those recommendations are not
human approval. This part does not claim Deployment Readiness.

## 2. Locked product and authority doctrine

The product sequence remains:

`Conversation → Evidence Collection → Reasoning → State Update → Trajectory Update → Next Conversation`

The customer has one primary intelligence chat, one canonical Business Engine,
one Living Business Map, Dynamic Five Futures, one current One Move, and Coach
Connect as governed human input.

The Business Engine is the only authoritative customer state. Coach-derived
material remains observation, proposal, or governed evidence until subscriber
confirmation and canonical promotion. Coaches, developers, sessions,
operators, security stores, and deletion workflows receive no alternate
canonical authority.

Machine reasons. Human decides.

## 3. Campaign authority

Authorized during this expansion:

- read-only repository inspection;
- threat-model and trust-boundary refinement;
- contract, state-machine, test, migration, and file planning;
- seven sprint AFWs;
- consistency and package validation;
- one AFW review ZIP.

Not authorized:

- source implementation;
- commit, push, deployment, or public access;
- production or preview activation;
- production Redis or any shared production store;
- credentials, secrets, or provider configuration;
- live providers, models, recording, or media;
- Stripe or billing changes;
- production migration or destructive deletion;
- Business Engine, Five Futures, One Move, BA/BOS, Profile ID, or customer UX redesign.

All future prerequisite features remain default-off until their complete
dependency graph is satisfied.

## 4. Repository grounding

### 4.1 Observed predecessor state

| Boundary | Repository evidence | Architectural consequence |
|---|---|---|
| Predecessor | HEAD equals `d42b52a27e8dae0ea4f53a444ee073a752fcdecd` | Security & Privacy Hardening V1 is protected predecessor architecture |
| Subscriber authentication | No grounded subscriber auth provider, canonical subscriber subject resolver, or authenticated `req.user`-style boundary was found | `SUBSCRIBER_AUTHORITY_SOURCE` remains a human/infrastructure decision |
| Default developer endpoint | `api/internal/developer-access.js` uses a default `resolveSubjectBinding = () => null` | Current endpoint fails closed rather than inventing subscriber identity |
| Capability binding | `developer-access-security.js` binds subject, scope, browser, environment, issuer, audience, key, expiry, and security version | Preserve and feed it only from a canonical authenticated subscriber binding |
| Coach auth | `auth/contracts.js` and `auth/service.js` have opaque subject references and rotate/revoke coach sessions | Reuse concepts; do not misrepresent coach auth as subscriber auth |
| Session fixation defense | Central security policy denies subject/session mismatch; scenario 18 proves mismatch and dual-cookie denial | Pre-auth subscriber session rotation remains unproven |
| Shared state | Security state is an injected port with `InMemorySecurityStateStore` explicitly not deployment-grade | No production or multi-instance claim is allowed |
| Production persistence foundation | `InactiveRedisRuntimeAdapter` is adapter-shaped, synthetic-only, and default-off | Patterns may be reused; production Redis activation remains prohibited |
| Retention | `coachConnect/security/retention.js` is `PROPOSED_NOT_AUTHORIZED` | No retention duration or destructive executor may be approved by code alone |
| Local journal | `LocalJsonlDurableLiveSessionDriver` appends full snapshots and declares physical deletion unsupported | Logical denial and deletion epochs are not physical erasure |
| Transcript content | Live Session stores content references; no authoritative backing-store deletion adapter is grounded | End-to-end transcript deletion cannot yet be claimed |
| HSTS | `vercel.json` contains build, rewrites, and duration only | Production-only HSTS mechanism is unresolved |
| Client address | Unlock controls accept an injected `trustedClientAddress`; no hosting-attested resolver is grounded | Forwarded headers remain untrusted |
| Operator identity | `INTERNAL_OPERATOR` is a policy role, not an authenticated operator subject or entitlement system | No operator route or audit-inspection authority may be exposed |
| Stripe | Existing paid entitlement and Stripe paths predate this campaign | Preserve exactly; SUBDEV1 cannot create billing or operator authority |

### 4.2 Dirty-worktree boundary

The worktree contains unrelated modified and untracked Business Assessment,
Business Engine, documentation, lab, cleanup, and bridge work. A later
implementation must begin every sprint with `git status --short`, use an exact
file allowlist, and never stage a directory that also contains unrelated work.

## 5. Protected predecessor architecture

Protected:

- `api/engine/businessAssessment/`
- `api/engine/canonical/`
- `api/engine/vault/`
- `api/stripe/`
- `src/lib/businessAssessment/`
- `src/lib/businessEngine/`
- `src/lib/intelligenceFabric/runtime/`
- `src/lib/intelligenceFabric/bootstrap/`
- `src/lib/intelligenceFabric/subscriber/`
- `src/lib/stripe/` and `src/lib/stripeCheckout.js`
- Five Futures and One Move customer contracts and renderers;
- BA/BOS scoring, report generation, Fathom role-fit, Profile ID, and canonical dossier identity;
- production Redis and live-provider configuration;
- customer-facing subscription UX except a separately approved narrow security adapter;
- deployment configuration unless Sprint 5 explicitly authorizes a reviewed, environment-conditional edit;
- committed Security & Privacy Hardening V1 evidence.

No prerequisite sprint may change canonical reasoning, scoring, customer truth,
pricing, billing, or promotion semantics.

## 6. Assets

1. Canonical subscriber subject and its tenant/profile/business/subscriber mapping.
2. Pre-auth and authenticated sessions, CSRF grants, and capabilities.
3. Coach identity, relationship, entitlement, and use-time consent.
4. Replay nonces, rate limits, revocations, idempotency, and security epochs.
5. Transcript/recording objects, temporary processing copies, caches, logs,
   exports, backups, derived evidence, and embeddings if later introduced.
6. Append-only local journal and its backups.
7. Retention policies, legal holds, deletion plans, leases, receipts, and audits.
8. Production transport configuration and trusted network boundary.
9. Authenticated operator identity, entitlements, sessions, and break-glass records.
10. The single canonical Business Engine and exactly-once promotion receipts.

## 7. Threat actors and abuse cases

| Actor | Abuse |
|---|---|
| Anonymous browser | supplies subscriber IDs, fixes a pre-auth session, replays CSRF or invite state |
| Authenticated subscriber | substitutes another tenant/profile/business/subscriber scope |
| Coach | accesses a non-related subscriber or attempts canonical mutation |
| Developer capability holder | transfers capability or escalates to billing/operator authority |
| Network attacker | spoofs forwarded headers, downgrades transport, or reuses old tokens |
| Compromised instance | relies on stale process-local revocation, nonce, or rate state |
| Operator | uses excessive entitlement, shared identity, missing reason, or cross-tenant access |
| Recovery process | restores pre-deletion content or stale security epochs |
| Deletion worker | reports success after partial deletion or only logical hiding |
| Configuration error | enables HSTS outside verified production HTTPS or enables production without dependencies |

## 8. Trust-boundary map

```text
Untrusted browser / client identifiers
  |
  v
Verified production transport + trusted proxy boundary
  |
  v
Canonical authentication assertion
  |
  v
Subscriber subject resolver -----> subject/scope mapping store
  |
  v
Session elevation boundary ------> shared security state
  |                                  nonce / replay / revocation /
  |                                  rate / epochs / leases
  v
Central Coach Connect policy
  |
  +--> Coach relationship + entitlement + consent
  +--> Operator identity + explicit entitlement + reason
  +--> Retention authority + legal hold + deletion state
  |
  v
Governed Live Session / evidence / canonical promotion
  |
  +--> transcript backing stores and deletion adapters
  +--> local journal (development only unless erasure is resolved)
  +--> one canonical Business Engine
```

No identifier crosses a boundary as authority merely because it is present.
Every protected mutation re-evaluates current subject, session, scope,
relationship, entitlement, consent, version, and security epoch.

## 9. Nine prerequisite decisions

### 9.1 Canonical subscriber subject binding

Required contract:

```text
subscriber_subject_id        stable opaque non-email identifier
issuer                       approved authentication issuer
audience                     exact MORE subscriber audience
tenant_id
profile_id
business_id
subscriber_id
mapping_version
security_version
status                       ACTIVE | DISABLED | DELETED | RECOVERY_PENDING
bound_at
effective_at
revoked_at
reassignment_prohibited      true
source_assertion_reference   keyed/opaque reference only
```

Decision: authorization uses this server-resolved object only. Email, display
name, invite metadata, session ID, profile ID, or request body cannot substitute.

Unresolved authority: select and authorize the canonical subscriber
authentication issuer, audience, assertion verification boundary, mapping
owner, account recovery authority, and durable mapping store.

### 9.2 Pre-auth to authenticated session rotation

Required states:

`PRE_AUTH → ELEVATION_PENDING → AUTHENTICATED`

Terminal states:

`EXPIRED | REVOKED | ROTATED | INVALID`

Authentication success must atomically create a new authenticated session,
invalidate the pre-auth session and old CSRF/capability state, and bind the new
session to canonical subject/security version/browser context. No authenticated
authority is available if rotation persistence fails.

Unresolved authority: the subscriber session/cookie owner and actual
authentication callback boundary do not exist in repository truth.

### 9.3 Deployment-grade shared security state

Required operations:

- atomic compare-and-set and insert-if-absent;
- TTL with server-time semantics;
- consume-once nonce/CSRF;
- capability/session revocation;
- atomic rate windows and cooldowns;
- security and deletion epochs;
- idempotency result storage;
- retention execution leases;
- append-only audit receipt persistence;
- health/capability description that cannot label a local adapter deployment-grade.

Decision: protected production operations never fall back to process memory.
Unavailability returns a stable fail-closed decision.

Unresolved authority: approve a deployment store and operational SLO. Existing
Redis patterns may inform a later adapter, but production Redis is not activated
or selected by this expansion.

### 9.4 Authoritative retention policy

Required authority record:

```text
policy_id / version / effective_at
owner_subject
approver_subjects
data_class
retention_rule
legal_hold_rule
subscriber_request_rule
coach_request_rule
operator_override_limit
deletion_eligibility
execution_entitlement
audit_rule
migration_disposition
status = DRAFT | APPROVED | SUPERSEDED | REVOKED
```

Decision: only `APPROVED` policy can authorize deletion execution. Code cannot
invent retention periods, legal exceptions, or backup horizons.

Unresolved authority: policy owner, approvers, periods, legal-hold rules,
request handling, audit retention, effective dates, and change migration.

### 9.5 Transcript backing-store deletion

Required inventory categories:

- application projection;
- primary transcript object;
- provider recording/transcript;
- temporary processing files;
- caches and indexes;
- logs;
- exports;
- backups;
- derived embeddings;
- extracted evidence and its independent retention basis.

Required states:

`ACTIVE → HIDDEN → LOGICALLY_DELETED → SCHEDULED → ATTEMPTED → VERIFIED`

Exception/terminal states:

`FAILED | IMPOSSIBLE_CURRENT_STORE | RETAINED_LEGAL_HOLD`

Decision: `VERIFIED` requires a receipt from every governed backing store.
`PHYSICALLY_DELETED` is forbidden unless all in-scope stores verify it.

Unresolved authority: identify the primary transcript owner/provider, backup
contract, derived-data policy, and deletion API/receipt semantics.

### 9.6 Append-only history erasure

Architecture decision gate compares:

- A: privacy-aware crash-safe compaction;
- B: per-scope/payload cryptographic erasure;
- C: production governed data moves to a deletion-capable store while JSONL
  remains non-sensitive development evidence only.

Recommendation for Spock review: select Option C as the default production
direction because it avoids dual claims and keeps JSONL explicitly local;
retain Option B only if event-lineage and backup key-destruction semantics are
approved. Option A is acceptable only with atomic replacement, rollback, backup
retirement, and byte-level proof.

This is a recommendation, not an authorized selection. Current JSONL remains
logical-denial-only.

### 9.7 Production-only HSTS

Policy inputs:

```text
environment == production
verified_https_termination == true
trusted_proxy_contract_version is approved
host is in exact production host allowlist
emergency_disable == false
```

Only then may HSTS be emitted. `max-age`, `includeSubDomains`, and `preload`
require explicit human decisions with rollback analysis. Local, test, preview,
staging, HTTP, ambiguous proxy, and unknown host omit HSTS and deny any readiness
claim.

### 9.8 Trusted proxy and client address

Required resolver:

- accepts only hosting-attested connection metadata;
- applies an explicit ordered trusted-proxy chain;
- ignores forwarded headers from untrusted peers;
- normalizes IPv4/IPv6;
- classifies private/reserved values without logging raw addresses;
- returns `VERIFIED`, `UNAVAILABLE`, or `AMBIGUOUS`;
- never lets `UNAVAILABLE` or `AMBIGUOUS` bypass subject/browser/scope limits.

Unresolved authority: hosting topology, trusted proxy identities/CIDRs or
platform-attested header, chain order, and privacy/legal treatment.

### 9.9 Operator identity and audit entitlement

Required subject:

```text
operator_subject_id
issuer / audience
status / security_version
environment_scope
role_ids
entitlement_ids
session_id / expires_at / auth_strength
reason_for_access
break_glass_reference
```

Every action requires least-privilege entitlement, exact tenant/environment
scope, current session/security version, reason, and immutable attributable
audit event. Destructive actions can require dual control. Developer access and
SUBDEV1 never confer operator authority.

Unresolved authority: operator identity provider, role owners, entitlement
approvers, break-glass policy, dual-control actions, session duration, and audit
review ownership.

## 10. Dependency graph

```text
Subscriber auth source
  -> canonical subject binding
  -> session elevation/rotation
  -> developer capability consumption

Deployment store decision
  -> shared security state
  -> multi-instance replay/revocation/rate/epoch proof

Retention authority + backing-store inventory + backup horizon
  -> deletion state machine
  -> transcript deletion proof
  -> JSONL/production erasure decision

Production hosting topology
  -> trusted proxy policy
  -> verified HTTPS termination
  -> production-only HSTS

Operator identity authority
  -> operator entitlement
  -> retention/deletion execution and audit inspection
```

An affected sprint stops at any missing upstream decision. An independent
sprint may proceed only when all of its own dependencies are explicitly
approved in the Human Decision Packet and implementation is separately
authorized.

## 11. Human decision register

| ID | Decision owner required | Blocks |
|---|---|---|
| `SUBSCRIBER_AUTHORITY_SOURCE` | Product/security owner for identity provider and canonical mapping | Sprints 1 and 7 |
| `SUBSCRIBER_SESSION_OWNER` | Authentication/application owner | Sprint 1 |
| `SHARED_STATE_PLATFORM` | Infrastructure/security owner | Sprint 2 |
| `RETENTION_POLICY_AUTHORITY` | Business/legal/privacy owners | Sprints 3, 4, 7 |
| `TRANSCRIPT_BACKING_STORE` | Product/provider/data owner | Sprint 4 |
| `BACKUP_RESTORE_HORIZON` | Infrastructure/privacy owner | Sprints 3 and 4 |
| `HISTORICAL_ERASURE_STRATEGY` | Security/privacy/architecture owners | Sprint 4 |
| `PRODUCTION_HOSTING_TRUST` | Infrastructure/security owner | Sprint 5 |
| `HSTS_DIRECTIVES` | Security/operations owner | Sprint 5 |
| `OPERATOR_IDENTITY_AUTHORITY` | Security/operations owner | Sprint 6 |
| `OPERATOR_ENTITLEMENT_POLICY` | Product/security/privacy owners | Sprint 6 |

No later AFW may relabel these decisions as implementation details.

### 11.1 Human Decision Packet authority

The authoritative decision-resolution artifact is:

`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`

It supplies a recommended architecture, alternatives, tradeoffs, repository and
test impact, reversibility, required authority, approval fields, and deferral
consequence for every row above.

The packet currently records each decision as
`RECOMMENDED_PENDING_HUMAN_DECISION`. `RECOMMENDED` is not `APPROVED`. A
decision unlocks its affected sprint only when a human supplies a concrete
choice, approver identity, approval date, any decision-specific attachment,
and explicitly selects `APPROVED`. `REJECTED` requires architecture revision;
`DEFERRED` blocks only affected sprints and dependent completion.

No Part 1 recommendation or repository observation can manufacture approval.

## 12. Architecture stop conditions

Stop rather than guess if:

- subscriber authority would derive from a client-supplied ID;
- authentication cannot prove issuer, audience, tenant, and active subject;
- pre-auth state cannot be atomically invalidated on elevation;
- production protection would fall back to process-local memory;
- retention or legal authority is absent;
- any deletion claim exceeds verified backing-store receipts;
- JSONL old bytes or backup copies remain while physical deletion is claimed;
- HSTS cannot be isolated to verified production HTTPS;
- forwarded headers require trust without a grounded infrastructure contract;
- operator actions lack attributable identity and explicit entitlement;
- protected product or billing roots require mutation;
- deployment, secrets, live services, or production data become necessary;
- two bounded repair cycles fail.

## 13. Part 1 verdict

`PART_1_ARCHITECTURE_COMPLETE_WITH_EXPLICIT_HUMAN_DECISION_GATES`

The nine prerequisites have explicit contracts, trust boundaries,
dependencies, stop conditions, and decision-ready human recommendations.
Identity, retention, infrastructure, hosting, erasure, and operator choices
remain unapproved until the Human Decision Packet is completed by the required
governors.
