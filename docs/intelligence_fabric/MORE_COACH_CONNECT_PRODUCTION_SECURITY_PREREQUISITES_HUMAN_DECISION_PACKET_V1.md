# Coach Connect Production Security Prerequisites — Human Decision Packet V1

Mission:
`MORE_REPAIR_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_DECISION_AUTHORITY_001`

Status: `RECOMMENDATIONS_READY — NO HUMAN APPROVAL RECORDED`

Generated: `2026-07-24`

Repository baseline: `d42b52a27e8dae0ea4f53a444ee073a752fcdecd`

## 1. Purpose and use

This packet converts the eleven unresolved authority gates in the V1 AFW into
questions a human governor can approve, reject, or defer before a separately
authorized implementation campaign. It recommends concrete defaults but does
not approve them.

The words have exact meanings:

- `RECOMMENDED`: Codex's architecture proposal for human review. It grants no
  implementation or production authority.
- `APPROVED`: a human governor selected a complete choice, supplied their
  identity and approval date, and satisfied every decision-specific attachment
  or precondition.
- `REJECTED`: the recommendation is not authorized; a replacement architecture
  requires AFW change review before implementation.
- `DEFERRED`: no implementation may cross that decision boundary; only the
  affected sprint is blocked unless another dependency connects it.

An approval is valid only when the decision's approval fields and the final
approval table agree. A recommendation, typed name without status, unchecked
box, incomplete required attachment, or machine-generated value is not
approval. Implementation remains separately unauthorized even after every row
is approved.

## 2. Locked boundaries

- All functionality remains default-off.
- No production Redis/shared state, provider, credential, deployment,
  migration, destructive deletion, or Stripe action is performed.
- Business Engine, Coach Connect product behavior, Five Futures, One Move,
  BA/BOS, scoring, Profile ID, subscription UX, and billing are not redesigned.
- `SUBDEV1` remains developer-only and never becomes an operator identity.
- Local append-only JSONL remains local development evidence with logical
  denial only. This packet never claims physical deletion of existing JSONL
  bytes.
- Sensitive production records should use deletion-capable or
  cryptographic-erasure-capable storage, subject to human approval.

## 3. Decision 1 — `SUBSCRIBER_AUTHORITY_SOURCE`

### Exact decision question

Will MORE use a dedicated Auth0 production tenant as the canonical subscriber
OIDC authority, with Authorization Code + PKCE, exact issuer/audience
verification, and a server-owned mapping from immutable Auth0 `sub` to MORE
tenant/profile/business/subscriber identifiers?

### Recommended default architecture

Approve a dedicated Auth0 production tenant and one subscriber application/API
audience. Use Authorization Code + PKCE, exact redirect allowlists, server-side
signature/JWKS, issuer, audience, expiry, nonce, and organization/tenant
validation. Persist the immutable `(issuer, sub)` pair as
`subscriber_subject_id`; keep email and MORE domain identifiers as mutable
attributes, never authorization subjects. Recovery changes `security_version`;
subject reassignment is forbidden and audited.

### Why this fits the current MORE stage

MORE has no grounded subscriber identity provider or canonical subject
resolver. A managed standards-based authority supplies the missing proof
boundary without creating a password/credential system inside the repository,
and it supports a default-off server adapter before any live wiring.

### Viable alternatives

- Clerk with server-side JWT verification and the same immutable mapping.
- Amazon Cognito using an exact user-pool issuer and API audience.
- A company-selected enterprise OIDC provider.
- Custom authentication is viable only after a separate credential-security
  architecture and is not recommended at this stage.

### Tradeoffs

| Dimension | Recommended Auth0 architecture | Alternatives |
|---|---|---|
| Security | Mature OIDC boundary; exact token verification; vendor compromise and configuration remain risks | Clerk/Cognito similar; custom auth creates much larger credential risk |
| Privacy | Provider receives identity metadata; minimize claims and retention | Self-hosting reduces vendor disclosure but expands stored credentials and breach surface |
| Operations | Managed keys, recovery, MFA, and incident tooling | Cognito can align with AWS; custom requires 24/7 identity operations |
| Cost | Recurring vendor cost grows with active users/features | Cognito may be cheaper at scale; custom has high engineering and assurance cost |
| Migration | Immutable external subject mapping permits provider migration through a versioned rebind process | Provider-specific IDs require mapping regardless of vendor |

### Repository and contract impact

Approves the `CanonicalSubscriberSubjectV1` issuer/audience/subject boundary and
permits naming an Auth0 adapter path by change receipt. It does not alter Profile
ID or canonical subscriber/domain state.

### Files and tests unlocked by approval

- `productionSecurity/subjectBinding.js`, `contracts.js`, `activation.js`
- conditional subscriber assertion-verifier adapter named by change receipt
- subject-binding and developer-access API tests in Sprint 1

### Reversibility

Partially reversible. The OIDC provider can change through versioned mapping
and forced session rotation; immutable subject history and audit lineage must
remain.

### Human authority required

Product owner and Security owner; Privacy reviews provider data processing.

### Explicit approval field

Human choice: `________________`  
Approved by: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 1 subject binding and authenticated subscriber enforcement remain
blocked. Independent Sprints 2, 3, 4, 5, and 6 may proceed only when their own
decisions and implementation authority are satisfied.

## 4. Decision 2 — `SUBSCRIBER_SESSION_OWNER`

### Exact decision question

Will the MORE server/API boundary own opaque subscriber sessions in the
approved shared security-state store and rotate the pre-auth session atomically
at the Auth0 callback using a `__Host-` HttpOnly, Secure, SameSite cookie?

### Recommended default architecture

Approve a backend-for-frontend session owner at the MORE authentication
callback. Store only a random opaque session identifier in
`__Host-more_session`; store canonical subject, tenant, security version,
browser binding, CSRF state, issued/expiry times, and revocation in shared
security state. Authentication atomically creates a new identifier and revokes
the pre-auth identifier, CSRF token, and pre-auth capabilities. Logout,
recovery, and privilege reduction revoke the authenticated identifier and bump
the relevant security version.

### Why this fits the current MORE stage

Server-owned opaque sessions minimize browser token exposure and give the
existing default-off internal API boundary one enforceable rotation/revocation
contract. They also avoid treating the future IdP token as an application
session.

### Viable alternatives

- Short-lived signed session cookies with a server-side revocation/epoch store.
- IdP access tokens held only in a BFF plus a separate MORE session.
- Browser-held bearer tokens are viable but not recommended because revocation,
  fixation, and XSS consequences are harder to contain.

### Tradeoffs

| Dimension | Recommended opaque BFF session | Alternatives |
|---|---|---|
| Security | Strong rotation/revocation and minimal browser authority | Signed cookies reduce reads but still need revocation; browser tokens increase exposure |
| Privacy | Cookie contains no identity attributes | Signed cookies may carry claims visible to the client |
| Operations | Requires highly available shared state | Stateless validation is simpler until revocation or security-version changes |
| Cost | Adds a state operation to protected requests | Signed cookies lower request cost but preserve state dependencies for serious controls |
| Migration | Session schema can be versioned and all sessions force-rotated | Token-based clients can be harder to migrate without compatibility windows |

### Repository and contract impact

Approves `SessionElevationV1` and the ownership boundary. Cookie names,
lifetimes, callback path, and Auth0 adapter configuration remain
implementation-time constants governed by this choice and security policy.

### Files and tests unlocked by approval

- `productionSecurity/sessionElevation.js`, `subjectBinding.js`
- narrow `api/internal/developer-access*.js` and entitlement integrations
- Sprint 1 fixation, rotation, logout, recovery, and replay tests

### Reversibility

Yes through schema-versioned session invalidation and forced reauthentication.

### Human authority required

Authentication/application owner and Security owner.

### Explicit approval field

Human choice: `________________`  
Approved by: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 1 session elevation and every authenticated subscriber path remain
blocked. No pre-auth session may be treated as authenticated.

## 5. Decision 3 — `SHARED_STATE_PLATFORM`

### Exact decision question

Will MORE standardize production security coordination on a dedicated paid
single-primary Upstash Redis database in the same primary region as the
production runtime, with TLS, no eviction, encryption at rest, backups,
primary-only security reads, and verified atomic transaction/script support?

### Recommended default architecture

Approve a dedicated Upstash Redis production security-state database, not a
general cache. Require paid production support/SLO, a single write-primary near
the runtime, no replica reads for authorization, TLS, ACL/least-privilege
credentials, encryption at rest, eviction disabled, monitored capacity,
backups, and exact namespacing. Before adapter approval, synthetically and
offline-contract-test `SET NX`, compare-and-set, `MULTI/EXEC` or Lua atomicity,
TTL/server time, fencing, idempotency, outage, and partition behavior. Runtime
unavailability fails protected operations closed; no local fallback.

This recommendation does not create, configure, connect to, or credential an
Upstash database.

### Why this fits the current MORE stage

The repository already has Redis-shaped patterns and serverless deployment
configuration, while the prerequisite workload is small, atomic, and
latency-sensitive. A managed serverless-compatible store minimizes initial
operations without weakening the port contract.

### Viable alternatives

- AWS ElastiCache/MemoryDB for Redis/Valkey in a controlled network.
- Redis Cloud with comparable atomicity, TLS, persistence, and SLO.
- Managed PostgreSQL using transactional rows/advisory locks and TTL cleanup.
- Process memory is not viable for deployment-grade state.

### Tradeoffs

| Dimension | Recommended Upstash design | Alternatives |
|---|---|---|
| Security | Dedicated least-privilege store and atomic controls; public service credentials require strict handling | VPC stores reduce public exposure; PostgreSQL reduces platform count |
| Privacy | Store only hashes/opaque IDs with short TTLs | Any platform remains a processor; relational storage can encourage over-retention |
| Operations | Low serverless overhead; provider limits and consistency must be feature-tested | ElastiCache/MemoryDB add network/ops work; PostgreSQL needs cleanup tuning |
| Cost | Usage-based early-stage fit; paid SLO/features required | Provisioned stores may cost more idle but become predictable at scale |
| Migration | Versioned port and namespace permit adapter replacement | Provider-specific Lua/limits can create coupling; keep scripts portable and tested |

### Repository and contract impact

Approves the deployment adapter class for
`SharedSecurityStatePortV1`. The existing in-memory adapter remains synthetic
only. Adapter path and configuration names enter the AFW through a change
receipt; production connection remains a later campaign.

### Files and tests unlocked by approval

- `sharedSecurityStatePorts.js`, `inMemorySharedSecurityState.js`
- authority-approved Upstash adapter named by change receipt
- `security/ports.js`, `security/policy.js`
- Sprint 2 multi-instance, atomicity, TTL, fencing, and failure tests

### Reversibility

Yes at the adapter layer, but cutover requires namespace/version migration,
drain/epoch reconciliation, and forced revocation validation.

### Human authority required

Infrastructure owner, Security owner, and budget/procurement owner.

### Explicit approval field

Human choice: `________________`  
Approved by: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 2 deployment-adapter work is blocked. Sprint 1 may define pure contracts
but cannot prove deployment-grade rotation/revocation; Sprints 3, 4, 6, and 7
cannot complete state-dependent execution proofs.

## 6. Decision 4 — `RETENTION_POLICY_AUTHORITY`

### Exact decision question

Will MORE adopt a Privacy-owned, Legal-and-Product-approved retention policy in
which every data class has an explicit purpose, collection basis, retention
trigger/period, legal-hold rule, deletion eligibility, backup treatment, and
audit requirement before sensitive production persistence is enabled?

### Recommended default architecture

Approve this governance model:

- Privacy owner drafts and owns the versioned policy.
- Legal and Product jointly approve each data-class schedule.
- Security/Operations may execute only approved policy through operator
  entitlement; they cannot set periods.
- Data Protection/Privacy owns subscriber and coach request handling.
- Legal owns legal-hold placement/release criteria; release can require dual
  control.
- Audit policy is independently versioned and cannot retain deleted content.
- Until the schedule attachment is complete, sensitive transcript/recording
  production persistence remains disabled; ephemeral processing must discard
  content at session termination or fail closed.

No retention period is approved by this recommendation. An `APPROVED` status is
valid only with an attached completed data-class schedule signed by Privacy,
Legal, and Product.

### Why this fits the current MORE stage

It prevents code from inventing legal/business policy while giving engineering
a stable authority and schema. The safe placeholder is non-collection or
ephemeral processing, not indefinite retention.

### Viable alternatives

- Outside privacy counsel owns the initial schedule with internal Product
  approval.
- A formal data governance committee approves schedules.
- Contract-specific tenant schedules, provided the base policy defines conflict
  and minimum/maximum rules.

### Tradeoffs

| Dimension | Recommended governance | Alternatives |
|---|---|---|
| Security | Least authority and explicit execution/audit roles | A single owner is faster but creates excessive authority |
| Privacy | Data-minimizing default and no invented periods | Indefinite placeholder is simpler but unacceptable for sensitive data |
| Operations | Versioned schedule supports automation | Multi-party approval takes time and needs an escalation path |
| Cost | Requires legal/privacy review before storage | Deferral avoids review cost only by keeping production persistence off |
| Migration | Each record carries policy version and deletion epoch | Tenant-specific policies make migration and conflict resolution more complex |

### Repository and contract impact

Approves `RetentionPolicyV1`, authority roles, status transitions, and the
requirement for a separately supplied schedule attachment. It does not modify
BA/BOS, subscriber UX, billing, or existing local JSONL bytes.

### Files and tests unlocked by approval

- `retentionAuthority.js`, `deletionLifecycle.js`, `audit.js`
- `security/retention.js`
- Sprint 3 policy authority/state tests

Execution tests involving a real period remain blocked until the signed
schedule attachment exists.

### Reversibility

Policy can be superseded prospectively. Historical decisions retain their
governing version; extending retention or changing legal basis requires human
review and cannot resurrect deleted content.

### Human authority required

Named Privacy owner, Legal approver, Product approver, Security/Operations
executor owner, and budget owner where external counsel is required.

### Explicit approval field

Schedule attachment/reference: `________________`  
Human choice: `________________`  
Approved by Privacy: `________________`  
Approved by Legal: `________________`  
Approved by Product: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 3 execution semantics and Sprint 4 deletion/erasure completion remain
blocked. Sensitive production transcript/recording persistence stays off.

## 7. Decision 5 — `TRANSCRIPT_BACKING_STORE`

### Exact decision question

Will MORE store sensitive production transcript content as one encrypted object
per transcript in a dedicated unversioned Amazon S3 bucket, with metadata and
deletion epochs in a transactional database, provider recording disabled by
default, and every derived artifact linked to the root deletion scope?

### Recommended default architecture

Approve:

- a dedicated private S3 bucket for transcript payloads, public access blocked,
  bucket versioning disabled for this data class, least-privilege access, and
  server-side KMS/envelope encryption;
- one opaque object key per transcript; no email/name in keys;
- transactional metadata containing tenant, owner, policy version, object
  reference, derivative inventory, deletion epoch, and state;
- raw media/provider recording off by default and not retained unless separately
  listed in the approved policy;
- derived embeddings/extracts either recomputable and deletable under the same
  root scope or governed by an explicitly approved independent basis;
- primary deletion proof that distinguishes object deletion, metadata
  tombstone, provider receipt, derivative receipts, and backup expiry.

S3 unversioned object deletion can remove the primary object, but this packet
does not call that whole-system physical deletion; backups, provider copies,
logs, and derivatives still require their own proof.

### Why this fits the current MORE stage

The current JSONL journal cannot honestly erase history. Separating encrypted
payload objects from transactional metadata gives a narrow, deletion-capable
content boundary while preserving audit and deletion-epoch control.

### Viable alternatives

- A deletion-capable managed PostgreSQL database with encrypted transcript rows.
- Another S3-compatible object store with equivalent deletion, encryption, and
  receipt contracts.
- Provider-only storage is viable only if its deletion/backup/derivative
  contract passes Sprint 4; it is not recommended as the system of record.

### Tradeoffs

| Dimension | Recommended S3 + metadata | Alternatives |
|---|---|---|
| Security | Private encrypted objects, narrow keys, separate control plane | Database rows simplify transactions but concentrate sensitive content |
| Privacy | Per-object delete scope and derivative lineage | Object-store logs/backups still require governance |
| Operations | Mature object API; two-store consistency needs idempotent workflow | Single database is simpler but can increase size and restore complexity |
| Cost | Low object-storage cost plus KMS/database operations | Provider-only may look cheaper but weakens control and portability |
| Migration | Opaque object references and exportable metadata aid portability | Moving encrypted content still requires controlled key and receipt migration |

### Repository and contract impact

Approves the target capability/inventory contracts but does not name a live
bucket, database, provider credential, or migration. JSONL remains local
logical-denial-only evidence.

### Files and tests unlocked by approval

- `deletionLifecycle.js`, `erasureStrategy.js`, `audit.js`
- transcript S3 and metadata adapter paths named by change receipt
- Sprint 4 inventory, partial-receipt, provider, derivative, and restore tests

### Reversibility

Yes at the storage-adapter level with a governed, receipt-backed migration.
Switching versioning/encryption strategy for existing objects is not a simple
configuration rollback.

### Human authority required

Product/data owner, Security owner, Privacy owner, and Infrastructure owner.

### Explicit approval field

Human choice: `________________`  
Approved by: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 4 remains blocked and no production transcript backing-store or physical
deletion claim may be created.

## 8. Decision 6 — `BACKUP_RESTORE_HORIZON`

### Exact decision question

Will MORE adopt encrypted rolling backups with a proposed maximum 30-day
technical horizon, no indefinite sensitive-data snapshot, restore-time
deletion-epoch replay before reads, and documented exceptions approved by
Privacy, Legal, and Infrastructure?

### Recommended default architecture

Approve a proposed 30-day maximum rolling technical horizon for control-plane
metadata and any authorized transcript backup, subject to the signed retention
schedule. Use encrypted backups, restricted restore operators, immutable
deletion-request/epoch ledgers stored separately, and a restore gate that
reapplies tombstones/key destruction before restored content becomes readable.
Do not mutate historical backup media in place unless the platform proves it;
expire it within the approved horizon and disclose the pending expiry in
deletion receipts.

Thirty days is a technical recovery proposal, not a legal retention finding.
An `APPROVED` status requires Privacy/Legal confirmation or a replacement
horizon entered as the human choice.

### Why this fits the current MORE stage

A bounded rolling horizon provides early operational recovery without making
indefinite copies of sensitive content. Restore-time deletion enforcement
prevents a recovered backup from resurrecting logically or cryptographically
erased records.

### Viable alternatives

- Seven-day horizon for lower recovery tolerance and stronger minimization.
- Fourteen-day horizon.
- No content backups, with only metadata/configuration backups.
- Longer horizon only with documented recovery evidence and explicit
  Privacy/Legal approval.

### Tradeoffs

| Dimension | Recommended proposed 30 days | Alternatives |
|---|---|---|
| Security | More recovery points increase compromise surface; strong encryption/access limits it | Shorter/no content backups reduce exposure |
| Privacy | Bounded expiry and restore deletion ledger | Longer horizons delay whole-system erasure |
| Operations | Reasonable recovery window for an early service | Seven days reduces recovery options; no content backup accepts data loss |
| Cost | Bounded storage and restore testing | Longer horizons cost more; no backups cost less but increase incident loss |
| Migration | Common epoch ledger applies across backup generations | Horizon changes must preserve prior expiry commitments |

### Repository and contract impact

Approves backup capability fields, restore gates, pending-expiry receipts, and
test parameters. It does not create backup configuration or settle the legal
schedule.

### Files and tests unlocked by approval

- `deletionLifecycle.js`, `erasureStrategy.js`, `audit.js`
- restore/epoch integration tests in Sprints 3 and 4
- authority-selected backup adapter path by change receipt

### Reversibility

The future horizon can be shortened prospectively; already created backups
follow their approved expiry/erasure plan. Lengthening requires new human
approval and cannot revive expired data.

### Human authority required

Infrastructure owner, Privacy owner, Legal approver, and Product recovery owner.

### Explicit approval field

Approved horizon or replacement: `________________`  
Approved by: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 3 restore proofs and Sprint 4 whole-system erasure verification remain
blocked. Production sensitive persistence stays off.

## 9. Decision 7 — `HISTORICAL_ERASURE_STRATEGY`

### Exact decision question

Will MORE select Option C plus cryptographic-erasure capability: prohibit
sensitive production JSONL writes, use the approved deletion-capable production
store, encrypt transcript payloads with scoped envelope keys, delete primary
objects, and destroy authorized key material so expired backups cannot reveal
deleted payloads?

### Recommended default architecture

Approve Option C for production-store replacement with Option B capability for
sensitive payloads:

- local JSONL remains development-only, contains no sensitive production
  transcript, and provides logical denial only;
- production transcript content uses the Decision 5 store;
- each transcript or approved privacy scope uses a data-encryption key wrapped
  by a narrowly scoped KMS key hierarchy;
- deletion first revokes access and increments the deletion epoch, then deletes
  primary/derived objects, destroys the authorized wrapped key material, and
  records per-store receipts;
- backups age out under Decision 6 and must fail decrypt after key erasure;
- metadata/audit contains opaque lineage, not deleted content.

Physical deletion is claimed only per verified target. Existing append-only
JSONL bytes are never called physically deleted.

### Why this fits the current MORE stage

It avoids building risky journal compaction into a local durability mechanism
and gives future production storage two independent privacy controls:
deletion-capable primary storage and cryptographic denial across backups.

### Viable alternatives

- Option A: crash-safe JSONL compaction with atomic replacement and retired-copy
  proof; not recommended for sensitive production data.
- Option B alone: per-scope cryptographic erasure while retaining encrypted
  event lineage.
- Option C without per-record keys: deletion-capable production store plus
  backup-horizon expiry.

### Tradeoffs

| Dimension | Recommended C + crypto capability | Alternatives |
|---|---|---|
| Security | Strong access denial after key destruction; key management becomes critical | Compaction has filesystem recovery risk; C-only relies more on backups expiring |
| Privacy | Best support for scoped erasure without false JSONL claims | Shared keys can make safe selective erasure impossible |
| Operations | More key/receipt workflow and failure modes | C-only is simpler; compaction requires locks, rollback, and disk proof |
| Cost | KMS operations and adapter complexity | Compaction is cheaper infrastructure but higher assurance engineering |
| Migration | Production data starts in the correct store; no sensitive JSONL migration | Existing non-sensitive dev journal remains local and outside production migration |

### Repository and contract impact

Approves `ErasureStrategyDecisionV1` as `STORE_REPLACEMENT_WITH_SCOPED_CRYPTO`
and keeps `localJsonlDriver.js` non-production. No migration or dual write is
authorized.

### Files and tests unlocked by approval

- `erasureStrategy.js`, `deletionLifecycle.js`
- narrow durable adapter/checkpoint/JSONL production-denial guards
- Sprint 4 key, byte, store, crash, retry, restore, and wording tests

### Reversibility

The adapter architecture can change prospectively. Key destruction and verified
deletion are intentionally irreversible. Any strategy replacement requires an
AFW change receipt and migration decision.

### Human authority required

Security, Privacy, Architecture, Infrastructure, and Product data owners.

### Explicit approval field

Human choice: `________________`  
Approved by: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 4 and the final erasure prerequisite remain blocked. JSONL stays
logical-denial-only, and sensitive production persistence remains off.

## 10. Decision 8 — `PRODUCTION_HOSTING_TRUST`

### Exact decision question

Will MORE treat one exact Vercel production project as the sole public edge,
permit no additional proxy/CDN in front for this campaign, allow only exact
production hosts, and derive client address only from Vercel-provided request
metadata after a contract test proves the platform overwrites untrusted
forwarded input?

### Recommended default architecture

Approve:

- one Vercel production project/environment and explicit apex/`www` host
  allowlist;
- no Cloudflare, custom reverse proxy, or other upstream hop during this
  campaign;
- exact runtime verification of production environment, deployment/project
  identity, host, and HTTPS termination;
- `x-vercel-forwarded-for`/platform request metadata accepted only after an
  official-contract and deployment-shaped test proves overwrite behavior;
- `VERIFIED`, `UNAVAILABLE`, or `AMBIGUOUS` resolver results;
- keyed/prefix-classified address references for security telemetry, with no
  raw address in packaged evidence;
- any future proxy addition automatically revokes this approval pending a new
  trust-chain decision.

### Why this fits the current MORE stage

The repository already targets Vercel and has no grounded multi-proxy topology.
A single attested edge minimizes spoofing and operational ambiguity while
keeping preview/local behavior clearly outside production trust.

### Viable alternatives

- Cloudflare as the sole public edge in front of Vercel with authenticated
  origin and an explicitly verified two-hop chain.
- AWS CloudFront/ALB plus a VPC runtime.
- Do not use client address as an authorization input; retain only
  subject/browser/rate controls.

### Tradeoffs

| Dimension | Recommended single Vercel edge | Alternatives |
|---|---|---|
| Security | Small trust chain; platform-header contract still needs proof | Extra edge can add WAF/DDoS controls but increases spoof/misconfiguration risk |
| Privacy | Address can be minimized immediately | More proxies create more processors and logs |
| Operations | Matches current repository deployment shape | Multi-edge routing adds certificates, origin auth, and incident ownership |
| Cost | Uses existing hosting direction | Cloudflare/AWS may add spend but offer stronger network controls |
| Migration | Trust policy is versioned; adding a proxy forces explicit review | Tightly coupled platform headers require resolver-adapter replacement |

### Repository and contract impact

Approves `TrustedClientAddressV1` inputs and production trust predicates. It
does not deploy or change `vercel.json`; that remains conditional in Sprint 5.

### Files and tests unlocked by approval

- `trustedProxy.js`, `transportPolicy.js`, `audit.js`
- Sprint 5 spoofing, host, chain, address-minimization, and ambiguity tests
- conditional `vercel.json` planning after proof and separate implementation
  authority

### Reversibility

Yes before HSTS preload or an upstream topology change. Any new edge requires a
new policy version and test matrix.

### Human authority required

Infrastructure owner, Security owner, Privacy reviewer, and production hosting
owner.

### Explicit approval field

Exact Vercel project/host references: `________________`  
Human choice: `________________`  
Approved by: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 5 trusted-address and verified-HTTPS/HSTS proof remains blocked. Preview
or forwarded headers cannot be treated as production evidence.

## 11. Decision 9 — `HSTS_DIRECTIVES`

### Exact decision question

Will MORE use a production-only staged HSTS policy—start at
`max-age=300` without `includeSubDomains` or `preload`, advance through
`86400` to `31536000` only after host/TLS/rollback evidence, and keep
`includeSubDomains` and preload outside this campaign?

### Recommended default architecture

Approve the staged policy:

1. HSTS is absent everywhere except exact verified production HTTPS.
2. Canary: `Strict-Transport-Security: max-age=300`.
3. After observed TLS/host/rollback success: `max-age=86400`.
4. After the approved observation gate: `max-age=31536000`.
5. `includeSubDomains` and `preload` remain false and require a future complete
   subdomain inventory plus separate approval.
6. An emergency disable stops new header emission but cannot erase browser
   state already cached; rollback analysis must acknowledge that fact.

### Why this fits the current MORE stage

MORE is not deployment-ready and has no verified production trust topology.
Staging limits irreversible browser cache consequences while still defining the
target production protection.

### Viable alternatives

- Immediate `max-age=31536000` after complete production proof.
- Include subdomains after an exact subdomain/TLS inventory.
- Browser preload only after long-duration HSTS operation and explicit
  organizational commitment.

### Tradeoffs

| Dimension | Recommended staged policy | Alternatives |
|---|---|---|
| Security | Short initial exposure window before reaching one year | Immediate one year protects sooner but magnifies a mistake |
| Privacy | No material additional personal data | Preload publicly commits domain policy |
| Operations | Measured rollback and host inventory | Multiple stages require monitoring and approvals |
| Cost | Minimal infrastructure cost; operational review time | Certificate/subdomain remediation may add cost |
| Migration | Easy before long max-age; increasingly sticky afterward | Preload and includeSubDomains are substantially harder to reverse |

### Repository and contract impact

Approves `HstsPolicyV1` directives and gates. `vercel.json` remains unchanged
until separate implementation authority and exact production-only proof.

### Files and tests unlocked by approval

- `transportPolicy.js`
- Sprint 5 exact environment/host/HTTPS presence and omission tests
- conditional deployment-header integration planning

### Reversibility

Partially reversible. Server configuration is reversible; browsers retain HSTS
until cached `max-age` expires. Preload is deliberately not approved.

### Human authority required

Security owner, Operations/hosting owner, and domain owner.

### Explicit approval field

Human choice: `________________`  
Approved by: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 5 HSTS implementation/proof remains blocked. No environment may claim
production transport readiness from an absent or generic header.

## 12. Decision 10 — `OPERATOR_IDENTITY_AUTHORITY`

### Exact decision question

Will MORE use a separate invite-only Auth0 operator tenant/application and API
audience, federated only to the approved company workforce identity source,
with phishing-resistant WebAuthn MFA and sessions/cookies isolated from
subscriber, coach, and developer access?

### Recommended default architecture

Approve a separate Auth0 operator authority boundary:

- separate tenant or security-isolated tenant boundary, application, audience,
  callback, signing-key validation, and cookie namespace;
- individual named workforce identities only; no shared admin account;
- invite/group allowlist and phishing-resistant WebAuthn MFA;
- immutable `(issuer, sub)` operator subject with security version and
  revocation;
- no subscriber/coach session reuse and no `SUBDEV1` or developer-capability
  conversion;
- default-off operator routes with no live provider wiring in this campaign.

### Why this fits the current MORE stage

Operator authority is high impact and the repository has no authenticated
operator plane. Reusing a managed OIDC provider while separating tenant,
audience, session, and entitlements reduces custom credential work without
collapsing customer and operator trust.

### Viable alternatives

- Okta Workforce Identity with WebAuthn.
- Google Workspace OIDC behind an approved zero-trust access layer.
- AWS IAM Identity Center for an AWS-centered operator surface.
- Same Auth0 tenant with rigorously separate application/audience is cheaper
  but offers weaker blast-radius separation.

### Tradeoffs

| Dimension | Recommended separate Auth0 operator boundary | Alternatives |
|---|---|---|
| Security | Strong audience/session/blast-radius separation and MFA | Same tenant is cheaper but configuration errors can cross boundaries |
| Privacy | Very small workforce dataset; identity vendor is a processor | Workforce IdP federation may minimize duplicate profile data |
| Operations | Two identity boundaries need key/config/incident ownership | One tenant is simpler; Okta/IAM Center may fit existing enterprise operations |
| Cost | Additional tenant/features and MFA support | Existing workforce provider may reduce incremental cost |
| Migration | Opaque operator mapping permits versioned rebind | Audit lineage must retain old subject references across migration |

### Repository and contract impact

Approves `OperatorSubjectV1` identity/authentication boundary only. Entitlement,
reason, break-glass, and dual-control decisions remain gated by Decision 11.

### Files and tests unlocked by approval

- `operatorIdentity.js`, `contracts.js`, `activation.js`
- operator assertion-verifier adapter named by change receipt
- Sprint 6 authentication, revocation, MFA, session, and separation tests

### Reversibility

Partially reversible through provider rebind and forced reauthentication.
Attributable audit history remains immutable.

### Human authority required

Security owner, Operations owner, workforce identity owner, and Privacy
reviewer.

### Explicit approval field

Workforce identity source: `________________`  
Human choice: `________________`  
Approved by: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 6 operator authentication and any privileged retention/deletion
execution remain blocked. Developer access cannot substitute.

## 13. Decision 11 — `OPERATOR_ENTITLEMENT_POLICY`

### Exact decision question

Will MORE adopt a deny-by-default RBAC-plus-attribute policy with distinct
read-only support, security review, privacy deletion, audit review, and
incident roles; exact tenant/environment scopes; mandatory reason; and
dual-control for destructive or break-glass actions?

### Recommended default architecture

Approve these initial roles and rules:

- `SUPPORT_READONLY`: metadata/status only; no transcript content or mutation.
- `SECURITY_REVIEWER`: security/audit review; no content deletion.
- `PRIVACY_OPERATOR`: execute an approved deletion plan; cannot approve policy
  or verify their own dual-control action.
- `AUDIT_REVIEWER`: inspect minimized audit receipts; no operational mutation.
- `INCIDENT_COMMANDER`: time-bounded break-glass coordinator; no automatic
  content access.

Every action requires an active operator subject, current security/entitlement
version, exact environment and tenant, named entitlement, reason, target
reference, and attributable audit. Cross-tenant access requires an explicit
case-bound entitlement. Legal-hold release, key destruction, transcript
deletion, policy override, and break-glass content access require a second
distinct active approver. Proposed session bounds are 30 minutes idle and
8 hours absolute, subject to human choice.

### Why this fits the current MORE stage

A small team is especially vulnerable to accidental shared-admin authority.
Five narrow roles and explicit attributes are understandable, testable, and
separate policy from identity-provider mechanics.

### Viable alternatives

- Policy-as-code ABAC without named roles.
- External privileged-access-management approval workflow.
- Fewer combined roles for a very small team, provided destructive dual control
  and separation from `SUBDEV1` remain.

### Tradeoffs

| Dimension | Recommended RBAC + attributes | Alternatives |
|---|---|---|
| Security | Least privilege, explicit scope, and dual control | Pure RBAC is simpler but risks broad roles; pure ABAC can be hard to review |
| Privacy | Purpose/reason and tenant scope minimize access | Break-glass needs strict review and minimized content disclosure |
| Operations | Clear role matrix and stable tests | Dual control can delay urgent work; PAM adds workflow dependency |
| Cost | Moderate policy/audit engineering | External PAM costs more but adds mature approval tooling |
| Migration | Versioned entitlements can evolve without identity rebind | Role consolidation requires audit-preserving policy migration |

### Repository and contract impact

Approves `OperatorEntitlementPolicyV1`, audit fields, dual-control action set,
and the categorical separation from developer access and `SUBDEV1`.

### Files and tests unlocked by approval

- `operatorIdentity.js`, `audit.js`
- Sprint 6 entitlement, tenant/environment, reason, break-glass, dual-control,
  and audit tests
- Sprint 3/4 governed execution integration tests

### Reversibility

Yes prospectively through policy versioning and immediate entitlement/security
version increments. Completed attributable audit events are not rewritten.

### Human authority required

Product owner, Security owner, Privacy owner, Operations owner, and Legal for
hold/break-glass implications.

### Explicit approval field

Session bounds or replacement: `________________`  
Human choice: `________________`  
Approved by: `________________`  
Approval date: `________________`  
Status: `[ ] APPROVED  [ ] REJECTED  [ ] DEFERRED`

### Consequence of deferral

Sprint 6 entitlement/audit completion and privileged deletion execution remain
blocked. `SUBDEV1` remains incapable of operator action.

## 14. Approval semantics and sprint routing

Only a row explicitly marked `APPROVED`, with a concrete human choice,
approver, approval date, and any required attachment, unlocks its affected
sprint contract. `RECOMMENDED` never unlocks implementation.

| Sprint | Mandatory decision approvals | Deferral effect |
|---|---|---|
| 1 | `SUBSCRIBER_AUTHORITY_SOURCE`, `SUBSCRIBER_SESSION_OWNER` | Blocks Sprint 1 |
| 2 | `SHARED_STATE_PLATFORM` | Blocks Sprint 2 and state-dependent completion downstream |
| 3 | `RETENTION_POLICY_AUTHORITY`, `BACKUP_RESTORE_HORIZON` | Blocks Sprint 3 |
| 4 | `RETENTION_POLICY_AUTHORITY`, `TRANSCRIPT_BACKING_STORE`, `BACKUP_RESTORE_HORIZON`, `HISTORICAL_ERASURE_STRATEGY` | Blocks Sprint 4 |
| 5 | `PRODUCTION_HOSTING_TRUST`, `HSTS_DIRECTIVES` | Blocks Sprint 5 |
| 6 | `OPERATOR_IDENTITY_AUTHORITY`, `OPERATOR_ENTITLEMENT_POLICY` | Blocks Sprint 6 |
| 7 | All mandatory decisions plus required Sprint 1–6 results | Prohibits `COMPLETE`; requires `BLOCKED` or `FAILED` as evidence dictates |

Independent sprints may proceed only under separate implementation authority
when all of their own decisions and dependencies are approved. An approved
architecture does not authorize provider connection, secrets, migration,
deployment, or production activation.

## 15. Final human approval table

This table is deliberately unsigned. Select exactly one status per row only
after completing the decision-specific approval fields above.

| Decision ID | Recommended choice | Human choice | Approved by | Approval date | Status: APPROVED / REJECTED / DEFERRED |
|---|---|---|---|---|---|
| `SUBSCRIBER_AUTHORITY_SOURCE` | Dedicated Auth0 subscriber OIDC tenant; immutable subject mapping | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |
| `SUBSCRIBER_SESSION_OWNER` | Server-owned opaque rotating BFF session | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |
| `SHARED_STATE_PLATFORM` | Dedicated paid single-primary Upstash Redis security store | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |
| `RETENTION_POLICY_AUTHORITY` | Privacy-owned, Legal-and-Product-approved schedule; storage off until complete | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |
| `TRANSCRIPT_BACKING_STORE` | Encrypted unversioned S3 payloads plus transactional metadata/deletion epochs | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |
| `BACKUP_RESTORE_HORIZON` | Proposed 30-day maximum rolling horizon with restore-time deletion replay | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |
| `HISTORICAL_ERASURE_STRATEGY` | Production-store replacement plus scoped cryptographic erasure | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |
| `PRODUCTION_HOSTING_TRUST` | One exact Vercel production edge; no upstream proxy; attested metadata | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |
| `HSTS_DIRECTIVES` | Production-only staged 300 → 86400 → 31536000; no subdomains/preload | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |
| `OPERATOR_IDENTITY_AUTHORITY` | Separate invite-only Auth0 operator authority with WebAuthn MFA | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |
| `OPERATOR_ENTITLEMENT_POLICY` | Deny-by-default RBAC + attributes + destructive dual control | `________` | `________` | `________` | `[ ] APPROVED [ ] REJECTED [ ] DEFERRED` |

Current machine-readable status for every row:
`RECOMMENDED_PENDING_HUMAN_DECISION`.

## 16. Capability references

These official references support technical capability assessment only. They
do not approve a vendor or production action:

- [Auth0 Authorization Code with PKCE](https://auth0.com/docs/api/authentication/authorization-code-flow-with-pkce/authorize-with-pkce)
- [Upstash atomic transaction/key-locking behavior](https://upstash.com/docs/redis/features/key-locking)
- [Upstash REST transaction API](https://upstash.com/docs/redis/features/restapi)
- [Amazon S3 object deletion semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeletingObjects.html)
- [Amazon S3 version deletion semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeletingObjectVersions.html)
- [Vercel request-header behavior](https://vercel.com/docs/headers/request-headers)

## 17. Packet verdict

`HUMAN_DECISION_PACKET_COMPLETE_RECOMMENDATIONS_NOT_APPROVED`

Implementation, deployment, production activation/certification, credentials,
live providers, production Redis/shared state, production migration,
destructive deletion, and Stripe remain unauthorized.
