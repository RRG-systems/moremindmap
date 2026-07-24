# MORE Campaign — Coach Connect Security and Privacy Hardening — Part 1 V1

Status: `AFW EXPANSION — ARCHITECTURE ONLY`  
Generated: `2026-07-24`  
Repository: `/Users/rrg/.openclaw/workspace/moremindmap-live`  
Grounded commit: `fe1f24e6c2119c2d94c6451189a217db1e915469`  
Source packet: `MORE_CAMPAIGN_COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_V1`  
Implementation authority: `NOT GRANTED`

## 1. Mission

Harden the existing default-off, synthetic-only Coach Connect and Live Session runtime against realistic misuse without broadening the product or weakening human authority.

The target security equation is:

```text
verified identity
+ active exact-scope relationship
+ valid entitlement
+ use-time consent
+ least-privilege capability
+ current resource version
+ request integrity
+ privacy policy
+ durable audit decision
= permitted operation
```

Any missing, stale, revoked, expired, malformed, mismatched, replayed, or ambiguous input denies the operation.

This expansion does not authorize code changes, commits, pushes, deployment, production activation, production Redis, live providers, Stripe activation, public access, or destructive deletion.

## 2. Repository grounding

### 2.1 Predecessor state

The grounded predecessor commit is `fe1f24e`, `feat coach connect production persistence and service wiring v1`.

Observed predecessor evidence reports:

- focused durable tests: `13 passed, 0 failed`;
- Coach Connect and entitlement tests: `51 passed, 0 failed`;
- Intelligence Fabric tests: `235 passed, 0 failed`;
- ESLint, build, client-secret scan, evidence-manifest validation, and `git diff --check`: `PASS`;
- default-off internal JSONL durability survives a fresh service instance;
- canonical promotion replay appends exactly once;
- the internal developer capability is consumed at a server-side entitlement boundary;
- production readiness was not claimed.

These are predecessor observations, not present-campaign validation.

### 2.2 Current worktree boundary

At expansion start, `main` is ahead of `origin/main` by eight commits and behind by one. The worktree contains unrelated modified and untracked Business Engine, BA Visual, cleanup-preservation, Intelligence Fabric documentation, lab-output, and bridge files.

The five expansion artifacts are additive under `docs/intelligence_fabric/`. No unrelated file may be edited, staged, reverted, moved, or packaged. No branch synchronization is authorized.

### 2.3 Existing security-relevant surfaces

| Surface | Repository truth | Hardening implication |
|---|---|---|
| `api/internal/developer-access-security.js` | Server-side expected code, timing-safe comparison, signed 15-minute token, environment denial, HttpOnly/SameSite cookie, in-process attempt map and nonce revocation set | Preserve the good controls; replace instance-local security state, bind claims to subject/scope/environment, add rotation and request-integrity controls |
| `api/internal/developer-access.js` | GET/POST/DELETE handler, `Cache-Control: no-store`, generic client response, no origin/CSRF validation | Add same-origin enforcement, CSRF for mutations, method-specific request validation, safe structured audit |
| `api/internal/subscription-entitlement.js` | Valid capability grants only temporary `more_monthly_intelligence`; explicitly denies billing, admin, coach, and canonical authority | Keep entitlement equivalence narrow; require bound subject/scope and current revocation/security version |
| `src/components/businessAssessment/DeveloperAccessPanel.jsx` | Visible panel beneath `MAKE MY MAP ALIVE`; refreshes entitlement from server | Keep placement and generic errors; add CSRF bootstrap/use without exposing secrets or capability material |
| `src/lib/intelligenceFabric/auth/*` | Coach actor/session contracts, expiry, rotation, revocation, security version, browser-bound pending acceptance context | Reuse session concepts; do not claim they are already connected to an external auth provider or Coach Connect HTTP route |
| `src/lib/intelligenceFabric/coachConnect/*` | Exact subscriber scope, active relationship/entitlement architecture, coach proposal path, subscriber confirmation, no coach canonical authority | Centralize policy checks at every read/write entry point and prove negative actor/scope cases |
| `coachConnect/liveSession/*` | Granular consent, privacy classes, event sequence, transcript references, review, proposal, confirmation, recovery, and default-off activation | Enforce current consent and relationship state during use and replay, not only at session authorization |
| `coachConnect/liveSession/durable/*` | Exact five-key scope, integrity hash, optimistic versioning, local JSONL restart proof, idempotent canonical promotion | Add deletion epochs/tombstones and security-state ports; do not represent local JSONL as deployment-grade shared state |
| `src/lib/intelligenceFabric/production/security.js` | Exact-scope role authorization, redaction helper, audit record, destructive workflows blocked, retention classes `NOT_CONFIGURED` | Reuse concepts while defining Coach Connect-specific policy; human approval is required before destructive retention execution |
| `vercel.json` | Rewrites and function duration only; no repository-level security headers | A narrow header plan is needed; production-only HSTS remains unresolved |

### 2.4 Repository-grounded gaps

The following are design inputs, not accusations of production exposure:

1. developer unlock throttling and revocation are process-memory only;
2. developer capability claims are not bound to a subscriber identity, tenant, profile, business, browser/session, environment identifier, issuer, audience, or security version;
3. capability verification has no signing-key identifier or rotation window;
4. `x-forwarded-for` is accepted without a grounded trusted-proxy policy;
5. POST and DELETE on the developer endpoint have no explicit Origin, Referer, or CSRF validation;
6. Coach Connect has no public or production HTTP route surface beyond the internal developer-access endpoint;
7. authorization is distributed across services rather than one mandatory policy decision point;
8. some use-time consent checks exist, but review, confirmation, refresh, and durable replay do not all independently re-evaluate current consent/relationship state;
9. no deletion epoch or tombstone blocks replay of content deleted under a later policy decision;
10. raw transcript content is forbidden in contracts, but referenced content lifecycle and backing-store deletion are not implemented;
11. retention classes are expressly `NOT_CONFIGURED`;
12. global deployment headers and production-only HSTS are not configured;
13. the local JSONL journal stores full snapshots and has no compaction, encryption-at-rest proof, record erasure, or privacy-aware log-safety wrapper;
14. multi-instance rate limiting, revocation, nonce consumption, and suspicious-replay correlation require a shared store not currently authorized for activation.

## 3. Scope and hard boundaries

Included:

- threat model and trust boundaries;
- identity/session/capability hardening design;
- centralized authorization and use-time consent;
- tenant, subscriber, coach, and object isolation;
- CSRF, Origin, nonce, timestamp, idempotency, and replay policy;
- abuse controls and security observability;
- privacy classification, redaction, minimization, secure logs;
- retention, deletion planning, tombstones, and replay-after-deletion denial;
- security headers and secret-safe scanning;
- adversarial and regression proof plans.

Excluded:

- new commercial features or product redesign;
- live auth, billing, model, media, or Redis activation;
- production data reads or writes;
- public routes or public access;
- Stripe record creation or price/checkout changes;
- broad changes to BOS, BA, Business Engine, Five Futures, One Move, scoring, Fathom, Profile ID, pricing, or unrelated UI;
- external penetration testing or legal/compliance certification;
- destructive deletion before retention policy approval.

## 4. Core doctrine and invariants

1. `One Business Engine` remains canonical.
2. Coach proposes; subscriber confirms; canonical history appends.
3. A coach never gains direct canonical mutation authority.
4. Consent never substitutes for identity, relationship, entitlement, or ownership.
5. Developer unlock grants only temporary subscriber-intelligence entitlement.
6. Developer unlock grants no coach, operator, billing, admin, audit, or canonical authority.
7. Tokens and secrets never enter client bundles, logs, proof artifacts, URLs, or review ZIPs.
8. Raw transcript is more sensitive and shorter-lived than reviewed structured intelligence.
9. Private coach content is not subscriber-visible, canonical, or learning-eligible without a separately authorized transition.
10. Every read and write is exact-scope and object-ownership checked.
11. Replay re-runs current authorization, consent, deletion-epoch, and version policy.
12. Security denials are safe, structured, rate-limited, and auditable without sensitive payloads.
13. Default-off, synthetic-only, emergency-disabled behavior survives every phase.
14. No implementation result authorizes deployment.

## 5. Threat model

### 5.1 Assets

- subscriber identity and exact tenant/profile/business/subscriber scope;
- coach identity, session, verification, and relationship state;
- developer access code and capability signing keys;
- capability cookies, session tokens, CSRF tokens, nonces, and idempotency keys;
- Live Session events, transcript references, structured artifacts, reviews, proposals, confirmations, and recovery checkpoints;
- canonical Business Engine history and promotion receipts;
- private coach observations and subscriber-visible projections;
- retention policy, deletion epochs, tombstones, revocation state, audit events, and evidence bundles;
- environment configuration and deployment header policy.

### 5.2 Actors

| Actor | Legitimate authority | Explicit non-authority |
|---|---|---|
| Anonymous user | View already-public product surfaces only | No Coach Connect, transcript, projection, unlock status, audit, or mutation authority |
| Subscriber | Read own authorized projection; submit own confirmation; revoke own consent within policy | No coach review, cross-tenant read, admin/audit read, or unconfirmed canonical mutation |
| Coach | Read and review only within active exact-scope relationship and granted consent; propose changes | No other-subscriber access, subscriber impersonation, direct canonical write, or universal-learning promotion |
| Developer-unlocked subscriber | Same subject-bound subscriber authority plus temporary monthly-intelligence entitlement | No Stripe evidence, coach/admin/operator authority, or transferable bearer authority |
| Internal operator | Policy-approved security/audit actions through explicit operator identity | No content access by environment assumption; no product/canonical mutation without separate authority |
| Service process | Execute a single named capability for exact scope under current policy | No ambient tenant access, role escalation, or bypass of deletion/consent/version checks |
| Attacker | None | All protected operations |

### 5.3 Trust boundaries

```text
Browser
  |  untrusted input, Origin, cookies, CSRF token
  v
HTTP request-integrity boundary
  |  normalized request + correlation id
  v
Identity/session/capability verifier
  |  actor + subject binding + security version
  v
Central authorization policy
  |  exact scope + relationship + entitlement + consent + action
  v
Coach Connect / Live Session service
  |  versioned command + idempotency + privacy class
  v
Durable adapter / security-state port
  |  integrity hash + optimistic version + deletion epoch
  v
Local internal persistence or future deployment-approved shared store

Provider/model/media, Stripe, production Redis, and canonical append remain
separate protected boundaries and are not activated by this campaign.
```

Boundary rules:

- browser state is never authority;
- an opaque ID is never ownership proof;
- the internal route name is not access control;
- an environment flag is necessary but never sufficient;
- local process memory is not durable revocation or distributed rate limiting;
- cached projection authorization is rechecked before response;
- recovery and replay are new security decisions, not trusted historical decisions;
- canonical append requires a current subscriber confirmation and exact base version.

### 5.4 Attack surfaces

- developer unlock POST, entitlement GET, and revoke DELETE;
- cookies, forwarded client-address headers, Origin/Referer, JSON bodies, and error responses;
- session IDs, relationship IDs, transcript/artifact/proposal/confirmation IDs;
- content references and projection caches;
- replay/recovery endpoints or service entry points;
- local JSONL journal, lock files, snapshots, and proof directories;
- logs, telemetry, test fixtures, built client assets, source maps, environment files, and ZIP archives;
- future adapters for provider, shared persistence, and canonical append.

### 5.5 High-impact failure modes

- cross-subscriber or cross-tenant disclosure;
- stolen or copied capability accepted for another subject or environment;
- revoked consent ignored during replay;
- stale relationship accepted from cached session state;
- duplicate confirmation or canonical append;
- transcript or secret disclosure through errors/logs/build/proof ZIP;
- deletion followed by resurrection from journal, checkpoint, backup, or projection;
- rate-limit bypass across instances;
- operator or developer entitlement converted into broader authority;
- security headers changing protected public behavior without review.

## 6. Authorization matrix

Every allowed row also requires: default-off activation gates, exact object ownership, current policy version, safe audit, and no deletion-epoch violation.

| Actor | Action | Required Identity | Required Relationship | Required Entitlement | Required Consent | Required Capability | Required Version | Audit Requirement | Failure Mode |
|---|---|---|---|---|---|---|---|---|---|
| Subscriber | Projection read | Current subscriber session bound to exact scope | Not required for self read | Active paid or valid subject-bound temporary entitlement where feature-gated | Current consent for each projected sensitive category | `READ_OWN_PROJECTION` | Current projection and security version | Allow/deny without payload | `AUTHENTICATION_FAILED`, `ENTITLEMENT_INVALID`, `TENANT_SCOPE_VIOLATION` |
| Coach | Projection read | Current verified coach session | Active exact-scope coach/subscriber relationship | Active Coach Connect entitlement | `COACH_SHARING` or purpose-specific active consent | `READ_COACH_PROJECTION` | Relationship, consent, projection, and policy versions current | Allow/deny with hashed refs | `RELATIONSHIP_INVALID`, `CONSENT_REVOKED`, `TENANT_SCOPE_VIOLATION` |
| Subscriber | Transcript read | Current subscriber session | Self ownership | Active session entitlement | Current `TRANSCRIPTION`; recording consent if source is recording | `READ_OWN_TRANSCRIPT` | Transcript and consent versions current | Access event; never log content | `CONSENT_MISSING`, `RETENTION_EXPIRED`, `AUTHORIZATION_DENIED` |
| Coach | Transcript read | Current verified coach session | Active exact-scope relationship and participant membership | Active Coach Connect entitlement | Current `TRANSCRIPTION` and coach access scope | `READ_COACH_TRANSCRIPT` | Relationship, transcript, consent versions current | Access/denial with hashed transcript ref | `RELATIONSHIP_INVALID`, `CONSENT_REVOKED`, `TENANT_SCOPE_VIOLATION` |
| Coach | Review write | Current verified coach session | Active exact-scope relationship and authorized participant | Active Coach Connect entitlement | Current `STRUCTURED_EXTRACTION` and purpose-specific sharing consent | `WRITE_COACH_REVIEW` | Artifact expected version | Before/after hashes; no content | `AUTHORIZATION_DENIED`, `REQUEST_REPLAY_DETECTED`, `CONSENT_REVOKED` |
| Coach | Proposal creation | Current verified coach session | Active exact-scope relationship | Active Coach Connect entitlement | Current `BUSINESS_ENGINE_EVALUATION` | `PROPOSE_ENGINE_CHANGE` only | Reviewed artifact and Business Engine base version | Proposal decision and source hashes | `RELATIONSHIP_INVALID`, `CONSENT_REVOKED`, `AUTHORIZATION_DENIED` |
| Subscriber | Confirmation submission | Current subscriber session for proposal owner | Self ownership | Active session/feature entitlement | Current Business Engine evaluation consent | `CONFIRM_OWN_PROPOSAL` | Pending confirmation expected version and unexpired window | Immutable response receipt | `AUTHORIZATION_DENIED`, `REQUEST_REPLAY_DETECTED`, `SESSION_EXPIRED` |
| Service process | Canonical promotion | Named service identity | Current relationship revalidated | Current entitlement revalidated | Current Business Engine consent | `PROMOTE_CONFIRMED_PROPOSAL` with no actor substitution | Exact proposal, confirmation, base-engine, deletion-epoch versions | Exactly-once promotion receipt and append result | `AUTHORIZATION_DENIED`, `REQUEST_REPLAY_DETECTED`, `CONSENT_REVOKED` |
| Recovery operator/service | Replay | Explicit recovery identity/capability | Revalidated for the session scope | Revalidated | All purposes needed by replay are current | `REPLAY_SESSION` | Contiguous sequence, checkpoint, policy, deletion epoch | Start/end/denial and suspicious replay | `REQUEST_REPLAY_DETECTED`, `CONSENT_REVOKED`, `DELETION_REQUIRED` |
| Recovery operator/service | Recovery | Explicit recovery identity/capability | Revalidated | Revalidated | Current participation and processing consent | `RECOVER_SESSION` | Current checkpoint and security version | Recovery decision, count, hashes | `SESSION_REVOKED`, `RELATIONSHIP_INVALID`, `RETENTION_EXPIRED` |
| Subscriber or authorized coach | Session closure | Current participant session | Active or terminal relationship according to close-only policy | Not required to safely terminate | Revocation cannot prevent safe teardown | `CLOSE_SESSION` | Current session version | Closure and unresolved-work receipt | `AUTHORIZATION_DENIED`, `REQUEST_REPLAY_DETECTED` |
| Anonymous user | Developer unlock | No protected identity before code check; successful issue requires current subscriber/browser binding established server-side | None | None before issue | Not applicable | `ISSUE_TEMPORARY_SUBSCRIBER_ENTITLEMENT` only | Current signing key and security version | Attempt outcome, throttled identifiers, no code | `CAPABILITY_INVALID`, `RATE_LIMITED`, `ORIGIN_VALIDATION_FAILED` |
| Developer-unlocked subscriber | Capability revoke/logout | Current bound browser/session or valid capability plus CSRF | None | Current temporary entitlement | Not applicable | `REVOKE_OWN_CAPABILITY` | Current capability version | Revocation receipt without token | `CSRF_VALIDATION_FAILED`, `CAPABILITY_REVOKED` |
| Internal operator | Audit inspection | Strong operator identity | No content relationship; separate audit policy | Explicit operator entitlement | Content remains redacted | `READ_SECURITY_AUDIT` | Current operator and policy version | Audit-of-audit | `AUTHORIZATION_DENIED`, `TENANT_SCOPE_VIOLATION` |

All unlisted actor/action combinations deny with `AUTHORIZATION_DENIED`. A service process cannot use its own technical identity to satisfy a missing subscriber or coach decision.

## 7. Consent matrix

| Purpose | Granting actor | Checked at | Revocation effect | Replay rule | Retention effect |
|---|---|---|---|---|---|
| `PARTICIPATION` | Subscriber; coach accepts own participation | Authorize, connect, recover, active processing | Stop new processing and move active session to consent-blocked/closing | Replay may reconstruct only enough state to enforce the revocation and close safely | Session governance receipt retained; content follows stricter classes |
| `TRANSCRIPTION` | Subscriber and all legally required participants | Capture, read, extract, replay | Stop capture/read/extraction; schedule transcript redaction/deletion | No transcript content may be rehydrated after effective revocation | Raw/content reference enters expedited deletion |
| `RECORDING` | All required participants | Start/read/retain recording | Stop recording; retention workflow begins | Recording replay denied | Shortest approved retention |
| `STRUCTURED_EXTRACTION` | Subscriber | Extract, re-extract, replay | No new extraction; existing reviewed artifacts handled by their own policy | Historical extraction is not re-executed | Unreviewed derivatives expire with transcript; reviewed artifacts follow structured policy |
| `COACH_SHARING` | Subscriber and authorized coach-share workflow | Coach read, subscriber response projection | Future coach access and new sharing denied | Cached shared projection must be re-authorized | Private source remains private; shared derivative follows subscriber-private policy |
| `BUSINESS_ENGINE_EVALUATION` | Subscriber | Propose, evaluate, confirm, promote, replay | Blocks new evaluation/promotion; no hidden canonical change | Historical proposal may be audited but not promoted | Confirmed canonical receipt is preserved under canonical audit policy |
| `FUTURE_LEARNING` | Subscriber through separate explicit purpose | Candidate creation and every promotion/use | Future learning use stops; candidate becomes ineligible | Replay cannot recreate eligibility | Private data is removed; minimal withdrawal receipt may remain |

Rules:

- absence is not consent;
- `UNKNOWN`, `REQUESTED`, `RESTRICTED`, `REVOKED`, and `EXPIRED` deny unless a narrower explicitly modeled operation is allowed;
- consent must match tenant, subject, purpose, scope, data categories, parties, and effective time;
- consent does not grant relationship, entitlement, ownership, or canonical authority;
- revocation time is compared to event/use time and current decision time;
- safe teardown and deletion may proceed despite revoked processing consent.

## 8. Privacy classification matrix

The campaign vocabulary is authoritative for Live Session objects. Existing Intelligence Fabric privacy classifications remain the storage/governance mapping; conversion may only preserve or increase restriction.

| Class | Allowed content | Permitted recipients/use | Output and logging rule | Learning rule | Existing mapping |
|---|---|---|---|---|---|
| `SUBSCRIBER_PRIVATE` | Subscriber-owned structured state and confirmations | Owning subscriber; narrowly authorized services | Exact-scope response; hashed refs in logs | Ineligible unless separately reclassified with explicit consent | `COACH_SESSION_PRIVATE` |
| `COACH_SHARED` | Reviewed content intentionally shared within active relationship | Owning subscriber and active authorized coach | Field allowlist; no private source leakage | Ineligible by default | `COACH_ATTRIBUTED_SHAREABLE` |
| `BUSINESS_ENGINE_ELIGIBLE` | Reviewed, attributed proposal material | Business Engine evaluation path after consent | Reference/structured fields only; never direct canonical write | Still ineligible for universal learning by default | `TENANT_PRIVATE_BUSINESS_ENGINE` |
| `RESTRICTED_SENSITIVE` | Transcript references, sensitive personal/financial/behavioral material | Minimum named service/actor set | No-store, field minimization, no raw logs, shortest retention | Prohibited | `COACH_SESSION_PRIVATE` or stricter repository class |
| `REDACTED` | Sanitized derivative with trace of removed fields | Purpose-authorized recipients | Only approved fields; redaction trace contains hashes, not removed values | Determined by source policy; redaction alone does not grant eligibility | `SYSTEM_INTERNAL` |
| `LEARNING_INELIGIBLE` | Private coach/subscriber material and unapproved derivatives | Original authorized purpose only | Must carry explicit `learning_eligible: false` | Prohibited | `COACH_SESSION_PRIVATE` |
| `LEARNING_CANDIDATE` | Minimized, reviewed candidate with explicit future-learning consent | Isolated candidate-review process only | No direct identity refs; never universal merely by label | Requires separate human/policy promotion; revocation reverts to ineligible | `COACH_SESSION_PRIVATE` until separately authorized |

Privacy enforcement order:

```text
classify source
-> authorize purpose
-> apply field policy
-> redact/minimize
-> verify no forbidden fields
-> label response
-> audit hashes only
```

Failure to classify or redact denies the response with `REDACTION_FAILED`.

## 9. Retention matrix

These are conservative engineering proposals, not legal advice or authorization. They prevent accidental indefinite persistence in the design. Phase 1 implementation must stop before destructive execution until the human approves or replaces the policy values and resolves backup/legal-hold obligations.

| Record type | Default retention | Minimum | Maximum | Revocation behavior | Deletion behavior | Audit behavior | Replay behavior |
|---|---|---|---|---|---|---|---|
| Unlock attempt/rate-limit state | Rolling 24 hours | Active window + 1 hour | 30 days | Not applicable | Expire counters automatically | Keep outcome and keyed-hash dimensions only | Never replay as authority |
| Capability issue/revocation metadata | Expiry + 24 hours | Through expiry + clock skew | 30 days | Revoke immediately; rotate security version when needed | Delete nonce metadata after anti-replay horizon | Preserve issued/revoked outcome without token | Expired/revoked token always denies |
| Coach/subscriber auth session metadata | Terminal state + 30 days | Through terminal state + 24 hours | 180 days | Mark terminal immediately | Erase client/binding detail; retain minimal security receipt | Preserve hashed actor/session refs | Terminal session never reactivates |
| Relationship and entitlement decision snapshots | Active lifetime + 90 days | Through linked open workflow | 2 years after terminal state | Stop future access immediately | Remove cached projections; authoritative business record follows separately approved policy | Preserve decision/version hashes | Historical active state cannot override current terminal state |
| Live Session metadata/events | 90 days after closure | 30 days after closure | 365 days | Processing stops; close safely | Delete content-bearing values; tombstone session identity | Preserve event type/sequence/hash without payload | Must pass deletion epoch and current policy |
| Raw transcript/content reference | 7 days after finalization | Zero after safe reviewed derivative exists, subject to incident hold | 30 days | Stop access and begin expedited deletion within 24 hours | Delete backing content and keys; mark transcript `REDACTED`/`RETENTION_EXPIRED` | Record deletion proof only | Content rehydration forbidden |
| Unreviewed extracted artifacts | 14 days | Until review window closes | 30 days | Freeze and expire with source consent | Delete content reference and derived payload | Preserve aggregate count/status only | Re-extraction requires current consent and source |
| Reviewed structured intelligence | 365 days | 90 days | 2 years | No new use; existing subscriber-controlled history follows approved policy | Redact or delete content, preserve minimal provenance hash | Preserve decision chain without sensitive fields | Cannot regain broader eligibility |
| Private coach artifact | 90 days after session closure | Zero after authorized shared derivative and review window | 365 days | Sharing and learning stop immediately | Delete private source content; retain share-decision hash | No private content in audit | Never reconstructed from shared derivative |
| Proposal/confirmation/promotion receipt | 2 years after terminal decision | Life of referenced canonical version + dispute window | 7 years pending policy approval | Unpromoted work becomes ineligible | Remove proposal content; preserve confirmation/promotion proof hashes | Immutable decision receipt | No duplicate confirmation or promotion |
| Projection/cache | 24 hours or source-version change | Zero | 7 days | Invalidate immediately | Purge exact-scope cache entries | Log purge count/hash only | Rebuild only after fresh authorization |
| Security/audit event | 365 days | 90 days | 2 years | Not deleted merely because access consent is revoked; redact subject detail as required | Cryptographic erasure/pseudonymization under approved policy | Audit-of-audit required | Never grants authority |
| Deletion tombstone/scope epoch | Tenant lifecycle plus maximum backup replay horizon | Longest backup restore horizon | 7 years after tenant closure pending policy approval | Advance epoch immediately | Contains only scope hash, epoch, reason, time, policy version | Preserve creation/expiry | Any older record denies and is re-deleted |
| Test fixture/proof artifact | Delete after review checkpoint + 30 days | Through review completion | 90 days | Not applicable | Remove local copies after approved review/retention step | Keep manifest/hash only | Never imported into runtime |

Additional rules:

- legal hold is an explicit, audited exception; it does not silently broaden access;
- a backup restore must reapply current deletion epochs before any content becomes readable;
- deletion is idempotent and verifies primary data, derivatives, projections, indexes, and local proof copies;
- canonical Business Engine history is not silently erased by this campaign; content minimization and legal policy require explicit human disposition;
- no destructive executor is implemented or enabled while retention policy is unapproved.

## 10. Exact candidate implementation file plan

This is a frozen candidate allowlist for later human authorization. It is not implementation authority.

### 10.1 New security modules

- `src/lib/intelligenceFabric/coachConnect/security/constants.js`
- `src/lib/intelligenceFabric/coachConnect/security/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/security/policy.js`
- `src/lib/intelligenceFabric/coachConnect/security/requestIntegrity.js`
- `src/lib/intelligenceFabric/coachConnect/security/abuseControls.js`
- `src/lib/intelligenceFabric/coachConnect/security/privacy.js`
- `src/lib/intelligenceFabric/coachConnect/security/retention.js`
- `src/lib/intelligenceFabric/coachConnect/security/audit.js`
- `src/lib/intelligenceFabric/coachConnect/security/ports.js`
- `src/lib/intelligenceFabric/coachConnect/security/inMemorySecurityStateStore.js`
- `src/lib/intelligenceFabric/coachConnect/security/index.js`

### 10.2 Narrow existing-source modifications

- `api/internal/developer-access-security.js`
- `api/internal/developer-access.js`
- `api/internal/subscription-entitlement.js`
- `src/components/businessAssessment/DeveloperAccessPanel.jsx`
- `src/lib/intelligenceFabric/auth/contracts.js`
- `src/lib/intelligenceFabric/auth/service.js`
- `src/lib/intelligenceFabric/coachConnect/constants.js`
- `src/lib/intelligenceFabric/coachConnect/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/service.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/constants.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/service.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/businessEngine.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/extraction.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/review.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/projections.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/recovery.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/adapter.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/checkpointReplay.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/localJsonlDriver.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/service.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/serviceRegistry.js`
- `src/lib/intelligenceFabric/index.js`
- `vercel.json`

`vercel.json` is conditional: edit only after proving that the selected headers do not change protected routes unexpectedly and resolving production-only HSTS.

### 10.3 New and extended tests

- `test/intelligenceFabric.coachConnect.security.contracts.test.js`
- `test/intelligenceFabric.coachConnect.security.policy.test.js`
- `test/intelligenceFabric.coachConnect.security.requestIntegrity.test.js`
- `test/intelligenceFabric.coachConnect.security.abuse.test.js`
- `test/intelligenceFabric.coachConnect.security.privacy.test.js`
- `test/intelligenceFabric.coachConnect.security.retention.test.js`
- `test/intelligenceFabric.coachConnect.security.adversarial.test.js`
- `test/api.internal.developerAccess.security.test.js`
- the existing auth, Coach Connect, Live Session durable, production security, BA Visual DNA, and Intelligence Fabric tests only where a narrow regression assertion is required.

### 10.4 Validation helper and proof directory

- `scripts/verifyCoachConnectSecurityHardening.mjs`
- `lab_outputs/coach_connect_security_privacy_hardening_v1/`

The helper must report secret findings without printing matched values. `.env.local`, `.runtime-data/`, build outputs, and any ZIP are inspection inputs only and must never be staged.

### 10.5 Forbidden files unless separately authorized

- BOS/BA canonical intelligence and Business Engine reasoning files;
- Five Futures, One Move, scoring, Fathom role-fit, Profile ID, pricing, and Stripe implementation;
- live provider, live Redis activation, production migration, and unrelated UI;
- Vercel environment values or any secret-bearing file.

If implementation requires a file outside the candidate allowlist, stop and request a revised allowlist.

## 11. Phases and acceptance gates

| Phase | Deliverable | Acceptance gate |
|---|---|---|
| 1 | Revalidate repository, threat model, matrices, file allowlist, retention decisions | Human approves/replaces retention policy; no unresolved ownership/auth contradiction |
| 2 | Identity, session, and capability hardening | Copied/stale/expired/revoked/fixed capabilities fail; rotation and subject/scope/environment binding proven |
| 3 | Central authorization and tenant isolation | All object reads/writes require exact ownership and current relationship/entitlement |
| 4 | Use-time consent, CSRF, Origin, nonce, replay | Mutations reject missing/mismatched integrity evidence; revoked consent survives recovery/replay |
| 5 | Rate limiting, abuse detection, observability | Deterministic synthetic controls pass; deployment-grade shared-store dependency remains explicit |
| 6 | Privacy classification, redaction, minimization | Forbidden fields never reach response/log/error/evidence; negative redaction tests pass |
| 7 | Retention/deletion | No destructive execution until policy approval; tombstone/deletion-epoch and synthetic deletion proof pass |
| 8 | Headers and secret scanning | Safe headers present where grounded; sensitive responses no-store; scans disclose no values; HSTS disposition explicit |
| 9 | End-to-end adversarial proof | All 20 scenarios and regressions pass; artifact/evidence manifests validate |

Each phase begins with `git status --short`, exact authorized-file review, default-off verification, and protected-root comparison. Each failed gate permits at most two bounded repair cycles.

## 12. Stop conditions and unresolved decisions

Stop rather than guess if:

- subscriber identity cannot be bound at the server boundary;
- exact ownership cannot be proven for a read or write;
- an existing route would need material public behavior change;
- retention/legal-hold/backup policy remains unapproved at the destructive-execution gate;
- a deployment-grade shared security-state store is required to claim deployment readiness;
- HSTS cannot be restricted to production;
- a secret is client-exposed and bounded removal is insufficient;
- protected intelligence or canonical state must be rewritten;
- local JSONL record deletion cannot be made safe without destructive journal surgery;
- production credentials or live services are required;
- two bounded repair cycles fail.

Open decisions at expansion:

1. human approval or replacement of proposed retention durations;
2. identity source and subject-binding contract for subscriber developer unlock;
3. deployment-approved shared store for revocation, nonce use, throttling, and deletion epochs;
4. trusted-proxy/client-address policy;
5. production-only HSTS mechanism;
6. backing-store contract for transcript content references and deletion proof;
7. backup restore horizon used by deletion epochs;
8. operator identity and audit-inspection entitlement.

## 13. AFW review ZIP instructions

Create `~/Desktop/COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_AFW_REVIEW_V1.zip` with exactly:

1. `MORE_CAMPAIGN_COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_PART_1_V1.md`
2. `MORE_CAMPAIGN_COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_PART_2_V1.md`
3. `MORE_CAMPAIGN_COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_PART_3_V1.md`
4. `MORE_COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_CROSS_PART_CONSISTENCY_V1.md`
5. `MORE_COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_EXPANSION_INDEX_V1.json`

Use flat archive paths. Verify archive integrity, exact entry count, exact names, duplicate absence, uncompressed content hashes, ZIP size, and ZIP SHA-256. Do not include source, tests, `.env*`, runtime data, lab outputs, manifests from prior campaigns, or the source packet.

## 14. Part 1 verdict

`PART_1_ARCHITECTURE_COMPLETE_WITH_EXPLICIT_IMPLEMENTATION_GATES`

The threat model, trust boundaries, authority, consent, privacy, retention proposal, exact candidate file plan, protected boundaries, phases, acceptance gates, and stop conditions are defined. Implementation remains unauthorized.
