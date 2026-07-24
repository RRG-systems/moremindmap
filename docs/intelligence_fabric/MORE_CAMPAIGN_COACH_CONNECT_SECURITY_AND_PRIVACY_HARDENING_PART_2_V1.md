# MORE Campaign — Coach Connect Security and Privacy Hardening — Part 2 V1

Status: `AFW EXPANSION — IMPLEMENTATION PLAYBOOK ONLY`  
Generated: `2026-07-24`  
Implementation authority: `NOT GRANTED`

## 1. Execution doctrine

Part 2 translates the Part 1 architecture into a bounded implementation sequence. It contains no present authorization to edit source or tests.

When implementation is separately authorized:

1. inspect `git status --short` before every phase;
2. preserve all unrelated work;
3. freeze a file-level allowlist from Part 1;
4. keep every activation surface default-off and synthetic-only;
5. deny unknown or ambiguous state;
6. write proof without secrets or private payloads;
7. stop after two bounded repair cycles for a failed phase;
8. do not commit, push, deploy, activate, or migrate unless separately authorized.

## 2. Frozen candidate file plan

The complete candidate allowlist is Part 1 section 10. It is approved for architecture planning, not for mutation.

Implementation must further narrow that list during Phase 1:

- unchanged files are removed from the allowlist;
- every retained file is mapped to one security control and one test;
- `vercel.json` remains conditional;
- no environment file is writable;
- `.runtime-data/`, `dist/`, ZIPs, and secret-bearing files remain unstaged;
- any new required path stops the phase for human review.

The intended module boundary is:

```text
coachConnect/security/constants.js
  failure codes, actions, event types, policy versions

coachConnect/security/contracts.js
  actor, resource, request, capability-record, deletion-epoch contracts

coachConnect/security/policy.js
  one mandatory authorization decision point

coachConnect/security/requestIntegrity.js
  same-origin, CSRF, timestamp, nonce, idempotency, replay decisions

coachConnect/security/abuseControls.js
  limiter policy over an injected atomic security-state port

coachConnect/security/privacy.js
  classification, field allowlists, response shaping, log/error redaction

coachConnect/security/retention.js
  approved policy lookup, expiry planning, deletion/tombstone verification

coachConnect/security/audit.js
  safe structured security events and audit-of-audit

coachConnect/security/ports.js
  atomic capability, nonce, limiter, deletion-epoch, and audit interfaces

coachConnect/security/inMemorySecurityStateStore.js
  deterministic synthetic tests only; never deployment proof
```

## 3. Phase 1 — Revalidation and frozen policy

### Work

- record HEAD, worktree status, protected-root hashes, relevant route inventory, activation flags, and current test inventory;
- re-read the actual auth, Coach Connect, Live Session, durable, developer-access, production-security, UI, and Vercel surfaces;
- confirm no new Coach Connect HTTP routes appeared;
- convert the Part 1 matrices into machine-readable fixtures;
- require human approval or replacement of retention durations, backup horizon, legal-hold handling, operator identity, subscriber subject binding, trusted-proxy policy, and shared-store disposition;
- produce an exact authorized-file JSON allowlist.

### Gate

Pass only if:

- exact subscriber and coach ownership can be represented without changing canonical product logic;
- destructive retention remains disabled;
- all unresolved policy values have an explicit human disposition;
- protected code changes are unnecessary;
- no production credentials or data are required.

Otherwise return `COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_BLOCKED`.

## 4. Phase 2 — Identity, session, and developer capability hardening

### 4.1 Capability record

Replace transferable self-contained authority with an opaque capability plus server-side record.

The browser cookie contains only a high-entropy opaque token. The server stores only a keyed token hash and:

```text
capability_id
purpose = temporary_internal_subscription_entitlement
subject_binding_hash
scope_binding_hash
browser_binding_hash
environment_id
issuer
audience
issued_at
not_before
expires_at
last_used_at
security_version
key_id
status
revoked_at
revocation_reason
rotation_parent_id
```

The record explicitly carries:

```text
stripe_subscription_created = false
billing_evidence = false
admin_authority = false
coach_authority = false
operator_authority = false
canonical_mutation_authority = false
```

No raw access code, raw capability, cookie, authorization header, or direct subscriber identifiers may be stored or audited.

### 4.2 Issue policy

Issuance requires:

- `COACH_CONNECT_DEVELOPER_ACCESS_ENABLED=true`;
- a non-production environment in an explicit allowlist;
- configured issuer, audience, environment identifier, signing/pepper key, and current key ID;
- trusted same-origin request;
- valid pre-auth CSRF proof;
- rate-limit allowance;
- timing-safe expected-code comparison;
- server-established subscriber subject and exact scope binding;
- a fresh random token and capability record;
- atomic issue plus audit.

If a subscriber identity source is not available at this boundary, do not issue a subscriber entitlement. Stop with `AUTHENTICATION_FAILED`; do not fall back to a browser-only identity.

### 4.3 Verify policy

Verification requires:

- one unambiguous cookie with the expected environment-specific name;
- keyed token hash match;
- active record;
- current issuer, audience, environment, subject binding, scope binding, browser binding, key ID, and security version;
- `not_before <= now < expires_at`;
- current developer-access flag and environment allowlist;
- no capability, session, subject, or security-version revocation;
- atomic last-used/rotation policy where required.

Unknown key IDs, dual old/new cookies, missing binding inputs, clock ambiguity, malformed tokens, and unavailable shared security state deny.

### 4.4 Rotation, fixation, logout, and revocation

- rotate the pre-auth browser/CSRF binding on successful unlock;
- rotate capability after configured risk events and never extend beyond the original maximum lifetime without reauthentication;
- invalidate the prior token atomically before returning the successor;
- logout/revoke requires same-origin and CSRF;
- revocation increments subject security version when compromise is suspected;
- cookie clearing is not revocation proof by itself;
- restart must preserve revocation in the selected security-state store;
- stale cookies must not restore entitlement after reset or replay.

### 4.5 Cookie policy

HTTPS/preview cookie:

```text
__Host-coach_connect_dev_capability=<opaque>
Path=/
HttpOnly
Secure
SameSite=Strict
Max-Age<=900
no Domain
```

Authorized local HTTP may use a distinct non-`__Host-` name without `Secure`. Verification must reject both cookie names appearing together. Production remains denied.

### 4.6 Key rotation

- key material remains in server environment only;
- records identify `key_id`, never the key;
- exactly one current issue key and a bounded verify-only previous-key window are permitted;
- unknown or retired keys deny;
- key rotation never prints key material and invalidates capabilities beyond the approved overlap;
- no source, fixture, client bundle, manifest, or ZIP contains key values.

### Phase 2 gate

Prove:

- copied token with different subject, scope, browser, or environment fails;
- expiry boundary fails closed;
- restart does not undo revocation;
- session/capability rotation prevents fixation;
- UI success comes only from verified server entitlement;
- production and disabled environments deny;
- no Stripe, coach, admin, operator, or canonical authority is granted.

## 5. Phase 3 — Central authorization and tenant isolation

### 5.1 Mandatory decision input

Every protected service entry point supplies:

```text
actor
authenticated_session
action
resource_type
resource_id
actor_scope
resource_scope
relationship
entitlement
consent_records
capability
expected_resource_version
current_policy_version
current_deletion_epoch
request_integrity_decision
occurred_at
correlation_id
```

The policy returns only:

```text
allowed
failure_code
policy_version
decision_id
safe_reason_codes
required_audit
```

It never returns private content or a raw token.

### 5.2 Object ownership

Object lookup order:

```text
validate opaque identifier shape
-> load by exact composite scope or keyed scope hash
-> verify stored ownership equals actor-authorized scope
-> verify relationship/entitlement/consent
-> verify version/deletion epoch
-> shape response
```

Do not load globally by guessed ID and then decide whether to return it. Cross-scope lookup should be indistinguishable from not found to unauthorized clients while still recording `TENANT_SCOPE_VIOLATION` internally.

### 5.3 Role constraints

- subscriber: self-owned reads and confirmation only;
- coach: active exact-scope relationship, participant membership, and named coach action only;
- developer-unlocked subscriber: subscriber actions only;
- internal operator: explicit audit capability only;
- service process: named action and exact scope only;
- anonymous: no protected reads or writes.

### 5.4 Cache rules

Projection and artifact caches must include:

- exact scope hash;
- resource version;
- relationship version;
- consent version;
- policy version;
- deletion epoch;
- expiry.

Cache hit does not skip authorization. Relationship/consent/revocation/deletion changes invalidate matching cache entries.

### Phase 3 gate

Negative tests cover guessed IDs, copied session IDs, actor substitution, coach-to-other-subscriber access, subscriber coach action, stale relationship, cross-tenant artifact and projection lookup, and coach canonical-write attempts.

## 6. Phase 4 — Consent, CSRF, request integrity, and replay

### 6.1 Use-time consent

Re-evaluate the relevant consent immediately before:

- connect and recovery;
- transcript capture/read;
- extraction and re-extraction;
- coach read/review/share;
- proposal/evaluation;
- confirmation;
- canonical promotion;
- projection refresh;
- replay of any content-bearing event.

The decision uses current consent state and the effective time. A historical `GRANTED` value embedded in a session or checkpoint cannot override a later revocation.

Safe closure, revocation, and deletion remain allowed through dedicated least-privilege actions.

### 6.2 Same-origin policy

For the developer endpoint:

- remove permissive CORS signaling that is not needed for same-origin use;
- compare normalized `Origin` to an explicit environment-specific allowlist;
- where browser semantics legitimately omit Origin, require a matching trusted Referer and `Sec-Fetch-Site` policy;
- reject multiple Origin values, opaque origins, wildcard origins, scheme/host/port mismatches, and unconfigured environments;
- do not derive trust from `Host` alone.

### 6.3 CSRF policy

Use a short-lived server-recorded CSRF grant:

- issue only on a safe same-origin bootstrap request;
- return a non-authority proof to same-origin JavaScript;
- bind the stored proof hash to browser binding, intended method, route, environment, issued time, expiry, and one-time nonce;
- require the proof in a custom header for POST and DELETE;
- consume one-time state atomically;
- rotate after successful unlock;
- never place capability tokens in JavaScript-readable storage.

SameSite=Strict is defense in depth, not the sole CSRF control.

### 6.4 Replay policy

State-changing requests require:

- bounded request timestamp;
- one-time nonce;
- operation-specific idempotency key;
- canonical request fingerprint;
- expected resource version;
- current policy/deletion epoch.

Atomic security state distinguishes:

- safe idempotent retry with identical fingerprint and prior result reference;
- conflicting reuse of idempotency key;
- consumed nonce reuse;
- stale timestamp;
- sequence gap or duplicate;
- duplicate confirmation;
- duplicate promotion.

Replay and recovery must not:

- reactivate revoked sessions or capabilities;
- revive revoked consent;
- cross a deletion epoch;
- restore expired content;
- append canonically more than once.

### Phase 4 gate

All POST/DELETE mutations deny missing or invalid Origin/CSRF proof. Consent revocation and deletion epochs survive restart and replay. Identical idempotent retries return the prior safe result; conflicting retries deny with `REQUEST_REPLAY_DETECTED`.

## 7. Phase 5 — Rate limiting, abuse detection, and observability

### 7.1 Atomic limiter

Rate limiting is implemented over an injected atomic port, never a module-global map for a deployment claim.

Dimensions use rotating keyed hashes:

- subject/browser binding;
- trusted client-network bucket when available;
- route and action;
- tenant/scope;
- capability ID;
- failure class.

No raw IP, access code, cookie, token, or private identifier is logged.

### 7.2 Minimum policies

| Operation | Baseline synthetic policy | Escalation |
|---|---|---|
| Developer unlock | 5 failures per 60 seconds; exponential cooldown; subject/browser plus trusted network bucket | Security-version rotation or operator review after configured sustained abuse |
| Session creation | Per actor and exact scope | Temporary deny and event |
| Confirmation | Per proposal and subscriber; one terminal response | Conflicting retry is replay, not another attempt |
| Transcript/artifact read | Per actor, scope, and object class | Deny burst and emit suspicious-access event |
| Recovery/replay | Per session and recovery identity | Serialize; deny concurrent or repeated suspicious replay |
| Failed authorization | Cross-action counter without payload | Escalate repeated tenant-scope violations |

The numbers are configuration defaults for synthetic validation. Human approval is required before deployment policy.

### 7.3 Trusted address policy

Do not trust `x-forwarded-for` unless the hosting boundary provides an authenticated, documented header contract. Prefer a platform-validated client address. If unavailable, rate limits must still work on subject/browser/scope dimensions and explicitly report reduced network-signal confidence.

### 7.4 Security events

Emit safe events for:

- authentication/session/capability failures;
- Origin/CSRF failure;
- rate limit;
- cross-tenant/object ownership attempt;
- stale relationship or revoked consent;
- suspicious replay or sequence conflict;
- retention expiry/deletion/tombstone;
- redaction failure;
- secret-scan or header-gate failure;
- audit inspection.

Event fields are limited to event type, time, decision/failure code, policy version, correlation ID, keyed actor/session/scope/resource refs, counter bucket, and before/after hashes where needed.

### Phase 5 gate

Synthetic concurrent tests prove atomic counters, reset windows, cooldowns, nonce consumption, and safe event shapes. Preview or production readiness remains blocked until a deployment-approved shared store passes the same contract tests.

## 8. Phase 6 — Privacy classification, redaction, minimization, and safe logs

### 8.1 Classification at creation and transition

Every session, event, transcript reference, artifact, review, proposal, confirmation, projection, audit event, and proof record carries a valid privacy class.

Classification transitions require:

- current source class;
- destination purpose;
- authorized actor/service;
- field policy;
- consent when applicable;
- redaction trace;
- source and output hashes;
- policy version.

Missing or less-restrictive unapproved transitions deny.

### 8.2 Response shaping

Use explicit per-resource field allowlists. Never serialize a whole internal record and then delete known bad keys.

Minimum forbidden output fields include:

```text
raw transcript or provider payload
private coach source content
content-bearing local journal snapshots
access code or comparison material
capability/session/csrf token
cookie or authorization header
signing key/pepper
direct security-store keys
internal deletion or abuse-control secrets
stack traces and environment values
```

### 8.3 Safe errors

Client errors are stable, generic, and non-enumerating. Internal events retain the specific failure taxonomy with keyed references. Stack traces and causes are not returned.

### 8.4 Safe logs and proof

- route and service logging uses the central redactor before serialization;
- deny logging if redaction cannot classify the object;
- test with nested arrays, alternate casing, long strings, Error causes, headers, cookies, URLs, and circular/oversized input;
- fixtures use synthetic identifiers and synthetic text only;
- proof artifacts contain counts, hashes, paths, statuses, and safe excerpts only;
- the secret scanner reports categories and file hashes, never matching values.

### Phase 6 gate

Canary secrets and transcript phrases are absent from logs, errors, client responses, `dist/`, source maps, evidence, and ZIP candidates. Every allowed response passes its field policy; deliberately unknown fields fail closed.

## 9. Phase 7 — Retention, deletion, and replay-after-deletion

### 9.1 Policy activation

Retention execution has three independent gates:

```text
retention_policy_approved
deletion_execution_enabled
synthetic_only
```

For this campaign, `synthetic_only` must remain true. If policy is unapproved, planning and due-item reporting may run, but destructive execution returns `DELETION_REQUIRED` or a policy-blocked status without modifying records.

### 9.2 Deletion plan

A deletion plan inventories:

- primary record and backing content reference;
- derivatives, reviews, proposals, confirmations, promotions;
- projections/caches/search indexes;
- checkpoints, journals, failures, and unresolved work;
- security/audit exceptions;
- proof/lab copies;
- backup horizon and legal hold;
- exact authorized executor and scope.

The plan is hash-bound and versioned before execution.

### 9.3 Tombstone and deletion epoch

Before erasing content:

1. atomically advance the scope deletion epoch;
2. persist a minimal tombstone with scope hash, prior/new epoch, policy version, reason code, and time;
3. invalidate projections and capabilities whose authorization depends on deleted state;
4. erase or redact content according to approved policy;
5. verify every inventory target;
6. persist a content-free deletion receipt.

All reads, replay, recovery, and backup restore compare record epoch to current epoch. Older content is denied and scheduled for re-deletion before exposure.

### 9.4 Local JSONL constraint

The current append-only snapshot journal cannot prove selective physical erasure merely by appending a tombstone; prior snapshots remain in the file. Therefore one of the following must be explicitly authorized:

- cryptographic erasure with per-scope keys and verified key destruction;
- privacy-aware compaction into a new file plus byte-level validation and recoverable retirement of the old file;
- replacement with an approved store that supports the deletion contract.

Until then, local JSONL deletion can prove logical denial and tombstoning only. It must not claim physical deletion.

### Phase 7 gate

Synthetic proof covers due calculation, legal hold, idempotent deletion, deletion epoch, projection invalidation, logical replay denial, and backing-content deletion adapter behavior. Physical local-journal deletion remains blocked unless the constraint above is resolved.

## 10. Phase 8 — Security headers and secret scanning

### 10.1 Sensitive responses

All developer-access, entitlement, transcript, artifact, confirmation, recovery, audit, and retention responses require:

```text
Cache-Control: no-store, max-age=0
Pragma: no-cache
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

Add `Content-Disposition: attachment` only for explicitly authorized downloads. JSON content types are exact.

### 10.2 Browser/deployment headers

Evaluate with route-level compatibility proof:

- CSP with explicit `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `font-src`, `frame-ancestors`, `base-uri`, `form-action`, and `object-src`;
- `Permissions-Policy` denying unused camera, microphone, geolocation, and other features;
- `X-Frame-Options: DENY` as legacy defense where compatible;
- `Referrer-Policy`;
- `X-Content-Type-Options`;
- production-only HSTS.

Do not add HSTS to preview/local responses or silently change provider/Stripe connectivity. If the current Vercel config cannot express production-only behavior, record `SECURITY_HEADER_MISSING` and stop that sub-gate rather than adding a broad unsafe header.

### 10.3 Secret-safe scanner

The validation helper must inspect:

- tracked and untracked source in scope;
- environment variable names and exposure patterns without printing values;
- Vite client-exposed prefixes and bundle strings;
- `dist/` and source maps;
- fixtures, logs, evidence, manifests, and handoffs;
- both review-ZIP staging directories and final ZIP entry contents;
- accidental cookies, Authorization headers, access-code literals, signing material, provider/Redis placeholders with values, and private transcript canaries.

Scanning `.env.local` is read-only. Reports contain only category, safe path, line number when safe, file hash, and PASS/FAIL.

### Phase 8 gate

All required safe headers are proven on intended routes, CSP compatibility is tested, no-store is present on sensitive responses, production-only HSTS is either correctly scoped or explicitly blocked, and no secret/private canary is present in client or proof artifacts.

## 11. Phase 9 — End-to-end adversarial proof

Execute Part 3 exactly:

- all 20 required scenarios;
- identity/session, authorization, tenant, consent, request-integrity, abuse, privacy, retention, and secret/header suites;
- all relevant predecessor regressions;
- BA Visual DNA regressions identified during preflight;
- all Intelligence Fabric tests;
- focused ESLint;
- build;
- JSON and archive validation;
- evidence hash and artifact-index validation;
- `git diff --check`;
- protected-root and changed-file comparison.

No real credentials, live traffic, production data, Stripe operations, Redis, provider, model, or media calls are permitted.

## 12. Failure taxonomy contract

External responses may collapse details to avoid enumeration. Internal decisions use these exact codes:

- `AUTHENTICATION_FAILED`
- `SESSION_EXPIRED`
- `SESSION_REVOKED`
- `SESSION_FIXATION_DETECTED`
- `AUTHORIZATION_DENIED`
- `RELATIONSHIP_INVALID`
- `ENTITLEMENT_INVALID`
- `CONSENT_MISSING`
- `CONSENT_REVOKED`
- `TENANT_SCOPE_VIOLATION`
- `CSRF_VALIDATION_FAILED`
- `ORIGIN_VALIDATION_FAILED`
- `REQUEST_REPLAY_DETECTED`
- `RATE_LIMITED`
- `CAPABILITY_INVALID`
- `CAPABILITY_EXPIRED`
- `CAPABILITY_REVOKED`
- `CAPABILITY_ENVIRONMENT_DENIED`
- `SECRET_EXPOSURE_DETECTED`
- `REDACTION_FAILED`
- `RETENTION_EXPIRED`
- `DELETION_REQUIRED`
- `DELETION_FAILED`
- `LOG_SAFETY_VIOLATION`
- `SECURITY_HEADER_MISSING`

Every code maps to HTTP status, retryability, client-safe message, event type, and audit policy in `security/constants.js`. The mapping must not expose whether another tenant's object exists.

## 13. Bounded repair

For each failed phase gate:

1. preserve the failing output and exact command;
2. classify the finding and affected boundary;
3. verify the repair files are already authorized;
4. make the smallest repair;
5. rerun the focused failing test;
6. rerun the phase gate and affected regressions;
7. record repair count and before/after evidence.

Maximum: two repair cycles per phase.

Stop after the second failed cycle, any protected-boundary conflict, secret exposure needing broad redesign, tenant ownership ambiguity, retention-policy ambiguity at destructive execution, or need for production credentials/services.

## 14. Non-authorizations

Part 2 does not authorize:

- implementation;
- destructive retention/deletion;
- commit or push;
- branch synchronization;
- deployment or promotion;
- production/public activation;
- Stripe changes;
- live auth, provider, model, media, or Redis;
- production data or migration;
- external penetration testing;
- legal/compliance claims.

## 15. Part 2 verdict

`PART_2_IMPLEMENTATION_PLAYBOOK_COMPLETE_AWAITING_SEPARATE_AUTHORITY`

The playbook is executable only after the Phase 1 decisions and a separate implementation authorization.
