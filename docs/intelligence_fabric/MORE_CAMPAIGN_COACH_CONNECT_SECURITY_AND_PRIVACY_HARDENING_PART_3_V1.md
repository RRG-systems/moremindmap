# MORE Campaign — Coach Connect Security and Privacy Hardening — Part 3 V1

Status: `AFW EXPANSION — VALIDATION AND REVIEW PLAN ONLY`  
Generated: `2026-07-24`  
Implementation authority: `NOT GRANTED`

## 1. Purpose

Part 3 defines the adversarial proof, regression gates, evidence contract, review ZIP, handoffs, and terminal verdict for a later separately authorized implementation.

It does not claim any hardening control is currently implemented or validated.

## 2. Preconditions

Before validation:

- Phase 1 policy decisions are resolved or explicitly block execution;
- the implementation has an exact changed-file inventory within the authorized allowlist;
- no unrelated work was modified;
- default-off/synthetic-only flags remain unchanged in effect;
- no real credential, private transcript, production data, live service, or external target is used;
- the security-state adapter under test identifies itself as synthetic/local or deployment-approved;
- retention execution identifies whether it proves logical denial, backing-content deletion, or physical journal deletion;
- the evidence directory is empty or preserved outside the new run; no prior evidence is overwritten silently.

## 3. Validation evidence classes

Every result is labeled:

- `OBSERVED`: produced by a command in the current implementation run;
- `SYNTHETIC`: deterministic test data and non-live adapters;
- `STATIC`: source/configuration inspection;
- `NOT_PROVEN`: required evidence absent;
- `BLOCKED`: a stop condition prevented proof.

No synthetic or static result may be described as live-production certification, distributed-store proof, external penetration testing, legal compliance, or deployment success.

## 4. Required adversarial scenarios

Each scenario needs a negative test, a valid same-scope positive control, the central policy decision, a safe audit event, and proof that the response/log contains no secret or private payload.

| # | Scenario | Attack setup | Expected terminal result | Required proof artifact |
|---:|---|---|---|---|
| 1 | Guessed session ID | Valid actor supplies syntactically valid foreign/nonexistent session ID | Non-enumerating denial; internal `AUTHORIZATION_DENIED` or `TENANT_SCOPE_VIOLATION` | `scenario_01_guessed_session_id.json` |
| 2 | Coach accesses another subscriber | Valid coach session plus other subscriber's IDs | `RELATIONSHIP_INVALID` or `TENANT_SCOPE_VIOLATION`; no object content loaded/returned | `scenario_02_cross_subscriber_coach.json` |
| 3 | Subscriber attempts coach action | Subscriber calls review/proposal coach action | `AUTHORIZATION_DENIED` | `scenario_03_subscriber_coach_action.json` |
| 4 | Coach attempts canonical write | Coach invokes promotion/canonical append directly | `AUTHORIZATION_DENIED`; canonical append count zero | `scenario_04_coach_canonical_write.json` |
| 5 | Copied developer capability | Valid token replayed under different subject/browser/scope | `CAPABILITY_INVALID`; no entitlement | `scenario_05_copied_capability.json` |
| 6 | Expired capability replay | Verify at expiry boundary and after expiry | `CAPABILITY_EXPIRED`; cookie clearing optional, authority denied | `scenario_06_expired_capability.json` |
| 7 | Capability used in production | Same token and config with production environment | `CAPABILITY_ENVIRONMENT_DENIED` | `scenario_07_production_capability.json` |
| 8 | CSRF against unlock or confirmation | Missing/wrong/expired/reused CSRF proof and cross-origin request | `CSRF_VALIDATION_FAILED` or `ORIGIN_VALIDATION_FAILED`; no state change | `scenario_08_csrf.json` |
| 9 | Stale relationship | Relationship version/status changed after session/cache issue | `RELATIONSHIP_INVALID`; cache invalidated | `scenario_09_stale_relationship.json` |
| 10 | Revoked consent replay | Historical granted event/checkpoint replayed after revocation | `CONSENT_REVOKED`; no content processing or projection | `scenario_10_revoked_consent_replay.json` |
| 11 | Sequence replay | Duplicate, gap, reordered, and conflicting sequence | `REQUEST_REPLAY_DETECTED`; no second append | `scenario_11_sequence_replay.json` |
| 12 | Confirmation replay | Accepted confirmation resubmitted identically and with conflict | Identical retry returns prior receipt; conflict denies; canonical append at most one | `scenario_12_confirmation_replay.json` |
| 13 | Projection cache leakage | Cache key/version from tenant A requested by tenant B or after revocation | `TENANT_SCOPE_VIOLATION`/not found; no A fields returned | `scenario_13_projection_cache_isolation.json` |
| 14 | Transcript leakage through logs | Canary transcript in nested error/request path | Canary absent from captured logs, errors, audit, evidence | `scenario_14_transcript_log_safety.json` |
| 15 | Client bundle secret exposure | Build with server secret variables configured | No secret/access-code/capability/signing material in `dist/` or source maps | `scenario_15_client_bundle_secret_scan.json` |
| 16 | Cross-tenant artifact lookup | Tenant B uses valid artifact ID from tenant A | Non-enumerating denial, internal `TENANT_SCOPE_VIOLATION` | `scenario_16_cross_tenant_artifact.json` |
| 17 | Brute-force unlock | Concurrent failures across limiter dimensions and restart | `RATE_LIMITED`; atomic counts; restart behavior matches store class | `scenario_17_unlock_bruteforce.json` |
| 18 | Session fixation | Pre-auth browser/session/capability identifiers retained after unlock attempt | Identifiers rotate; predecessor invalid; mismatch yields `SESSION_FIXATION_DETECTED` | `scenario_18_session_fixation.json` |
| 19 | Replay after deletion | Restore old checkpoint/journal record after deletion epoch advances | `DELETION_REQUIRED`/`RETENTION_EXPIRED`; record re-deleted, never exposed | `scenario_19_replay_after_deletion.json` |
| 20 | Sensitive error leakage | Malformed secrets, headers, content, and stack causes force failures | Generic client error; safe internal code; no sensitive values | `scenario_20_sensitive_error.json` |

## 5. Additional attack suites

### 5.1 Identity and session

- missing identity;
- actor substitution;
- suspended/revoked/locked coach;
- stale security version;
- expired, revoked, rotated, malformed, and unknown session;
- wrong browser binding;
- old and new cookie present together;
- clock boundary and invalid timestamp;
- unknown issuer/audience/key ID;
- token hash collision resistance assumptions recorded, not claimed beyond the primitive.

### 5.2 Authorization and ownership

- every actor/action cell not allowed by Part 1 denies;
- exact tenant/profile/business/subscriber/session composite scope;
- relationship absent, proposed, suspended, revoked, expired, superseded, wrong coach, wrong subscriber, and wrong version;
- entitlement absent, inactive, wrong type, wrong scope, and stale;
- object exists in another tenant but remains non-enumerable;
- internal operator lacks content access without separate purpose;
- service capability cannot substitute for human confirmation.

### 5.3 Consent

- consent absent, malformed, future-effective, expired, revoked, wrong purpose, wrong scope, wrong tenant, wrong data category, wrong party, and stale version;
- recording and transcription remain distinct;
- private coach content never becomes learning-eligible from generic consent;
- revocation allows safe teardown/deletion but blocks new processing;
- cached consent cannot authorize a new use.

### 5.4 Request integrity and replay

- absent/opaque/multiple/mismatched Origin;
- bad Referer and `Sec-Fetch-Site`;
- absent, wrong, expired, replayed, cross-route, cross-method, and cross-browser CSRF proof;
- stale/future timestamp;
- nonce reuse and concurrent consumption;
- idempotency-key reuse with different fingerprint;
- expected-version conflict;
- duplicate canonical promotion across fresh service instances.

### 5.5 Abuse controls

- exact limit boundary;
- rolling-window reset;
- exponential cooldown;
- concurrent atomic increment;
- dimension isolation and combined escalation;
- trusted-proxy unavailable mode;
- store unavailable behavior fails closed for protected mutations;
- no raw client address, token, or direct subject ID in state or audit.

### 5.6 Privacy, redaction, and logs

- every Part 1 privacy class;
- upward restriction permitted; unapproved downgrade denied;
- explicit output field allowlists;
- alternate key casing, nested arrays/objects, long strings, Error/cause, URL query, cookies, authorization headers, circular/oversized input;
- private coach source versus shared derivative;
- no direct identity in claimed anonymized output;
- unknown fields and unknown classes deny;
- audit record contains hashes and reason codes, not content.

### 5.7 Retention and deletion

- due/not-due boundaries;
- approved/unapproved policy;
- legal hold;
- content, derivative, projection, index, checkpoint, journal, backup, proof-copy inventory;
- idempotent partial failure and retry;
- tombstone and deletion-epoch atomicity;
- restore from pre-deletion backup;
- logical denial versus physical erasure labeled honestly;
- local JSONL old-snapshot detection;
- audit exception contains no deleted content.

## 6. Focused test sequence

Use explicit targets. Do not run repository-wide bare `node --test`; prior repository evidence says broad discovery can invoke unrelated live-Redis diagnostics and file-writing generators.

Planned commands:

```text
node --test test/intelligenceFabric.coachConnect.security.*.test.js
node --test test/api.internal.developerAccess.security.test.js
node --test test/intelligenceFabric.auth*.test.js
node --test test/intelligenceFabric.coachConnect*.test.js
node --test test/intelligenceFabric.production*.test.js
node --test test/intelligenceFabric.runtime*.test.js test/intelligenceFabric.predictive*.test.js test/intelligenceFabric.subscriber*.test.js
node --test test/intelligenceFabric*.test.js
```

The final `test/intelligenceFabric*.test.js` command is the complete safe Intelligence Fabric glob, not bare discovery.

Run focused ESLint on the exact changed JavaScript/JSX and test allowlist. Repository-wide lint is not a required green gate if unrelated pre-existing findings remain; record that limitation without modifying unrelated files.

## 7. BA Visual DNA and protected regression gate

Security wrappers must not change Business Assessment, Business Engine, Visual DNA, Five Futures, One Move, scoring, relationship provenance, or rendering semantics.

At Phase 1, snapshot the exact available commands and inputs. The current candidate protected checks include:

```text
node scripts/testBaVisualIndividualization.mjs
node scripts/testTrueRelationshipProvenance.mjs
node lab_outputs/mmm8_business_engine_contract/run_fixture_validation.mjs
node lab_outputs/mmm8_contract_visualization_semantics/run_fixture_validation.mjs
```

Because those files are currently dirty or untracked outside this campaign, do not rewrite their outputs, stage them, or treat new differences as campaign changes. Run only after confirming they are deterministic/read-only for the current worktree, or use preserved before/after hashes and record `BLOCKED_BY_UNRELATED_DIRTY_WORK`.

Also prove no diff under the protected BOS/BA/Business Engine/Five Futures/One Move/scoring/Fathom/pricing/Stripe roots attributable to this campaign.

## 8. Build and static gates

Required:

```text
npm run build
git diff --check
```

Also require:

- import/export verification for new modules;
- JSON parse for every JSON proof artifact and index;
- no circular dependency introduced in the security boundary;
- changed-file allowlist equality;
- default-off activation scan;
- production/live provider/Redis/Stripe/public-route negative scan;
- client bundle and source-map secret scan;
- sensitive response header tests;
- Vercel configuration parse and route/header compatibility test;
- CSP compatibility proof if CSP is changed;
- archive entry and secret scan.

Network access is neither required nor permitted for the proof.

## 9. Secret-safe scan protocol

The implementation helper `scripts/verifyCoachConnectSecurityHardening.mjs` must:

1. read expected secret values only from the process environment in memory;
2. never print, hash-prefix, quote, or serialize those values;
3. scan scoped source, `dist/`, source maps, logs, evidence staging, manifests, handoffs, and archive contents;
4. inspect environment files read-only and report only unsafe exposure category and safe path metadata;
5. detect Vite/client-exposed environment-variable misuse;
6. detect cookie, Authorization, raw token, raw transcript, private coach content, and canary leakage;
7. fail on unreadable or unscannable archive entries;
8. output counts and file SHA-256 only.

Architecture documents may name environment variable identifiers and failure codes. That is not a secret-value match. The scanner distinguishes identifier references from configured values without emitting either value.

Required scan reports:

- `client_bundle_secret_scan.json`
- `source_secret_scan.json`
- `log_safety_scan.json`
- `proof_staging_secret_scan.json`
- `implementation_zip_secret_scan.json`

Any confirmed value exposure returns `SECRET_EXPOSURE_DETECTED` and blocks ZIP creation until repaired and rescanned.

## 10. Security header proof

For each sensitive handler or route class, capture a synthetic response-header matrix:

```text
route class
method
status
environment
cache-control
pragma
content-type-options
referrer-policy
permissions-policy
frame policy
CSP/frame-ancestors
HSTS
result
```

Prove:

- sensitive responses are no-store on success and denial;
- no wildcard cross-origin policy is introduced;
- HSTS appears only on the approved production boundary;
- local/preview behavior does not accidentally set an unsafe HSTS policy;
- CSP does not break required same-origin client assets or separately authorized Stripe navigation;
- camera/microphone remain denied because live media is excluded.

If production-only HSTS cannot be represented and tested, record `SECURITY_HEADER_MISSING` and use a limited or blocked final verdict.

## 11. Required proof directory

Later implementation writes only:

`lab_outputs/coach_connect_security_privacy_hardening_v1/`

Required files:

### Architecture and policy

- `repository_grounding_report.md`
- `threat_model.md`
- `trust_boundary_map.md`
- `asset_inventory.json`
- `authorization_matrix.json`
- `consent_matrix.json`
- `privacy_matrix.json`
- `retention_matrix.json`
- `security_control_inventory.json`
- `approved_file_plan.json`
- `protected_root_before.json`

### Control proof

- `identity_session_hardening_proof.json`
- `capability_hardening_proof.json`
- `capability_restart_revocation_proof.json`
- `tenant_isolation_proof.json`
- `csrf_origin_proof.json`
- `replay_protection_proof.json`
- `rate_limit_proof.json`
- `security_observability_proof.json`
- `redaction_proof.json`
- `log_safety_proof.json`
- `retention_deletion_proof.json`
- `replay_after_deletion_proof.json`
- `security_header_matrix.json`
- `client_bundle_secret_scan.json`
- `source_secret_scan.json`
- `log_safety_scan.json`
- `proof_staging_secret_scan.json`
- `implementation_zip_secret_scan.json`

### Adversarial and regression proof

- `attack_simulation_report.md`
- `scenario_01_guessed_session_id.json` through `scenario_20_sensitive_error.json`
- `test_manifest.json`
- `test_results.json`
- `build_result.json`
- `lint_result.json`
- `ba_visual_dna_regression.json`
- `activation_boundary_scan.json`
- `protected_root_verification.json`
- `changed_files.json`

### Closeout

- `artifact_index.json`
- `evidence_manifest.json`
- `implementation_report.md`
- `executive_handoff.md`
- `ai_handoff.md`
- `ai_handoff.json`
- `final_verdict.json`

Proof JSON is deterministic where possible and carries:

```text
artifact_version
campaign_id
evidence_class
generated_at
source_commit
command_or_test_reference
status
limitations
```

No proof file contains raw private content, direct secrets, tokens, cookies, Authorization headers, or production identifiers.

## 12. Evidence-manifest and artifact-index validation

`artifact_index.json` enumerates every proof file except itself only if that convention is explicitly stated. `evidence_manifest.json` contains SHA-256 for every indexed artifact except itself to avoid recursion.

Validation requires:

- declared entry count equals directory inventory;
- no undeclared extras;
- no duplicate/case-colliding paths;
- every path is relative, normalized, and inside the proof root;
- every file hash matches;
- every JSON parses;
- every evidence class is allowed;
- final verdict and both handoffs agree;
- secret-safe scans pass after the final bytes are fixed.

## 13. Implementation review ZIP

After later implementation and validation, and only if the proof-staging scan passes, create:

`~/Desktop/COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_IMPLEMENTATION_REVIEW_V1.zip`

Include:

- all five expansion artifacts;
- the exact changed source, tests, validation helper, and `vercel.json` only if changed;
- the complete validated proof directory;
- implementation/executive/AI handoffs and final verdict.

Exclude:

- `.git/`, `.env*`, `.runtime-data/`, `node_modules/`, `dist/` unless a separately sanitized bundle-evidence subset is explicitly indexed, browser profiles, caches, raw logs, old proof runs, unrelated dirty files, source packet copies outside the five expansion artifacts, and any secret-bearing material.

Use a staging directory created specifically for the review package. Copy only allowlisted files, scan staging, build the archive, scan decompressed archive contents, then verify:

- archive integrity;
- exact file count;
- exact sorted entry list;
- no symlink, absolute path, `..`, duplicate, or case collision;
- per-entry SHA-256;
- ZIP byte size and SHA-256;
- secret/private canary absence.

ZIP creation does not authorize commit, push, deploy, activation, migration, or destructive cleanup.

## 14. Handoffs

### Executive handoff

State:

- what was actually hardened and proved;
- evidence class and exact test totals;
- open policy/architecture limits;
- logical versus physical deletion result;
- local versus deployment-grade store result;
- header/HSTS disposition;
- protected-boundary result;
- no-deployment statement;
- final verdict.

### AI handoff

State:

- source commit and dirty-worktree boundaries;
- exact changed-file allowlist;
- commands and outcomes;
- failure taxonomy and policy versions;
- default-off flags;
- unresolved decisions;
- evidence and archive hashes;
- explicit prohibition on inferring production readiness.

## 15. Final verdict logic

Allowed terminal verdicts:

### `COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_COMPLETE`

Use only when all phase gates, 20 scenarios, regressions, secret scans, retention/deletion requirements, header requirements, manifests, handoffs, and archive verification pass with no material unresolved control.

This verdict still does not authorize deployment.

### `COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_COMPLETE_WITH_LIMITS`

Use only when all in-scope default-off synthetic controls pass, no required security property is falsely claimed, and remaining limits are external deployment certification items such as an unactivated shared-store adapter. A missing in-scope protection, unapproved destructive policy, or unproven deletion behavior is not a cosmetic limit.

### `COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_BLOCKED`

Use when a stop condition prevents safe implementation or proof, including unresolved retention authority at the deletion gate, absent subject binding, unavailable required shared state for the claimed environment, physical deletion ambiguity, protected-boundary conflict, or production-only header ambiguity.

### `COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_FAILED`

Use when authorized bounded implementation was attempted, two repair cycles were exhausted, and a required phase remains unsafe or failing.

Never issue a completion verdict merely because tests are green if the tests do not exercise the required boundary.

## 16. Deployment-not-authorized statement

All reports, handoffs, verdicts, and ZIP metadata must contain:

```text
Deployment, push, production activation, public access, Stripe activation,
production Redis, live providers/models/media, production migration, and
destructive production deletion are not authorized by this campaign result.
```

## 17. Part 3 verdict

`PART_3_VALIDATION_AND_REVIEW_PLAN_COMPLETE_AWAITING_IMPLEMENTATION`

No implementation verdict is issued during architecture expansion.
