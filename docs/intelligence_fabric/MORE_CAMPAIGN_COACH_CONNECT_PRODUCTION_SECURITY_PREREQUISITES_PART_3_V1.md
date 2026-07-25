# MORE Campaign — Coach Connect Production Security Prerequisites — Part 3 V1

Status: `AFW EXPANSION — VALIDATION AND REVIEW PLAN ONLY`
Generated: `2026-07-24`
Grounded predecessor: `d42b52a27e8dae0ea4f53a444ee073a752fcdecd`
Implementation authority: `NOT GRANTED`

## 1. Purpose

This part defines sprint-local validation, campaign-wide adversarial proof,
evidence classes, proof artifacts, archive verification, handoffs, and final
verdict rules for a later separately authorized implementation.

It does not claim that any of the nine production prerequisites is resolved.
The Human Decision Packet makes all authority choices decision-ready but
records no human approval.

## 2. Preconditions

Before each sprint:

- the sprint's Part 1 human decisions are explicitly `APPROVED` in
  `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`
  with human choice, approver, approval date, and required attachments;
- implementation is separately authorized;
- `git status --short` is captured;
- an exact file allowlist is frozen;
- unrelated dirty work is preserved;
- protected roots need no change;
- test inputs are synthetic and contain no credentials/private content;
- all new flags are default-off;
- no production service, provider, Redis, Stripe, or deployment target is required;
- the predecessor BLOCKED verdict remains historical truth until final campaign review.

Missing preconditions produce `BLOCKED`, not a guessed implementation.

## 3. Evidence classes

- `OBSERVED`: current-run command or file result.
- `SYNTHETIC`: deterministic non-live fixture/adapter result.
- `STATIC`: source/configuration inspection.
- `HUMAN_APPROVED`: signed/versioned decision supplied by the responsible authority.
- `RECOMMENDED_NOT_APPROVED`: complete architecture recommendation with no
  human approval; it cannot satisfy a sprint precondition.
- `NOT_PROVEN`: required proof absent.
- `BLOCKED`: stop gate prevents proof.

Synthetic/static evidence is never described as production certification,
deployment success, legal approval, infrastructure SLO proof, or external
penetration testing.

## 4. Required prerequisite scenarios

Each scenario requires a negative attack, valid positive control, central
decision, privacy-safe attributable audit, zero protected side effects on
denial, and a dedicated JSON proof.

### 4.1 Subject binding

1. Client supplies another subscriber ID without a verified subject:
   `SUBJECT_ASSERTION_REQUIRED`.
2. Valid subject from tenant A requests tenant B:
   `SUBJECT_MAPPING_AMBIGUOUS` or scope denial.
3. Wrong issuer/audience assertion:
   `SUBJECT_ASSERTION_INVALID`.
4. Disabled/deleted/stale subject mapping:
   `SUBJECT_DISABLED | SUBJECT_DELETED | SUBJECT_MAPPING_STALE`.
5. Invite accepted then replayed against another subject:
   denial and no second binding.
6. Account recovery attempts silent reassignment:
   denial unless an approved recovery transaction exists.

### 4.2 Session elevation

7. Attacker fixes a pre-auth identifier before victim authentication.
8. Old pre-auth token, CSRF grant, or capability is used after elevation.
9. Elevation retries concurrently across two instances.
10. Shared-state failure occurs between invalidation and new-session creation.
11. Logout or privilege reduction leaves an old token active.

Expected: new identifiers, atomic/idempotent result, old state denied, no
authenticated authority after ambiguous failure.

### 4.3 Shared security state

12. Instance A revokes; instance B verifies.
13. Instance A consumes nonce; instance B replays.
14. Rate-limit attempts split across instances.
15. Security epoch advances while a stale instance authorizes.
16. Store becomes unavailable or partitioned.
17. TTL clock skew crosses the expiry boundary.
18. Two deletion workers acquire the same execution lease.

Expected: global synthetic coordination, fencing, exact expiry, and fail-closed
behavior with no process-local production fallback.

### 4.4 Retention authority

19. Draft/unapproved policy attempts execution.
20. Unknown owner/approver or stale policy version.
21. Active legal hold conflicts with deletion request.
22. Subscriber and coach requests have different authority.
23. Operator tries to override outside entitlement.
24. Policy changes effective date during an active deletion job.

Expected: explicit authority result and preserved policy version. No arbitrary
duration or destructive action.

### 4.5 Transcript deletion

25. One mandatory backing store is missing.
26. Provider deletion succeeds but cache/export fails.
27. Retry after partial failure.
28. Backup restore reintroduces an old transcript.
29. Derived evidence has an independent retention basis.
30. Legal hold applies to only some target classes.
31. Deletion receipt lacks target verification.

Expected: partial/failed/held states remain explicit; no physical-deletion claim.

### 4.6 Historical erasure

32. Selected strategy is not approved.
33. Compaction crashes before/after atomic replace.
34. Cryptographic erasure leaves an active key replica or backup key.
35. Store replacement attempts dual write.
36. Old JSONL or backup bytes remain.
37. Migration/replay violates lineage or idempotency.

Expected: `PHYSICAL_DELETION_NOT_PROVEN` until the chosen strategy's complete
verification contract succeeds.

### 4.7 Transport and proxy trust

38. Preview/local requests claim production.
39. Production label exists without verified HTTPS.
40. Host is outside exact allowlist.
41. HSTS directives are missing/ambiguous.
42. Direct client injects `X-Forwarded-For`.
43. Untrusted proxy adds a chain.
44. Chain is too long, malformed, mixed IPv4/IPv6, or ambiguous.
45. Verified platform/proxy path resolves a deterministic privacy-safe bucket.

Expected: HSTS only exact approved production case; spoofed/ambiguous network
identity cannot weaken limits or audit.

### 4.8 Operator identity

46. Unauthenticated operator action.
47. SUBDEV1 capability attempts operator action.
48. Revoked/stale operator session.
49. Wrong environment or tenant entitlement.
50. Missing reason for access.
51. Destructive action lacks distinct dual approver.
52. Audit append fails.
53. Shared/admin code attempts authentication.

Expected: attributable, least-privilege, audited decision or fail-closed denial.

### 4.9 Cross-sprint integration

54. Subject mapping changes while session/capability remains cached.
55. Shared-state outage during operator-approved deletion.
56. Restore occurs under a newer retention and deletion epoch.
57. Trusted-proxy policy is revoked while HSTS readiness is evaluated.
58. Operator entitlement tries to bypass subscriber confirmation/canonical promotion.
59. Production flags are enabled with one dependency unresolved.
60. Complete dependency graph is satisfied in a synthetic deployment-shaped harness.

Expected: blockers propagate; no alternate Business Engine or authority path;
even scenario 60 is not a deployment or production certification.

## 5. Sprint-local validation

Every sprint runs:

- contract validation and unknown-version denial;
- valid positive path;
- all sprint-specific negative authorization attacks;
- exact tenant/scope isolation;
- replay/idempotency/concurrency where applicable;
- failure injection and recovery;
- default-off/emergency-disable behavior;
- safe attributable audit;
- changed-file allowlist equality;
- protected-root diff;
- focused lint;
- JSON proof parse;
- secret/private-canary scan;
- no-production-action scan.

Up to two bounded repairs are allowed. Each repair emits the Part 2 receipt.

## 6. Planned focused commands

Later implementation uses explicit targets:

```text
node --test test/intelligenceFabric.coachConnect.productionSecurity.subjectBinding.test.js
node --test test/intelligenceFabric.coachConnect.productionSecurity.sessionElevation.test.js
node --test test/intelligenceFabric.coachConnect.productionSecurity.sharedState.test.js
node --test test/intelligenceFabric.coachConnect.productionSecurity.retention.test.js
node --test test/intelligenceFabric.coachConnect.productionSecurity.deletion.test.js
node --test test/intelligenceFabric.coachConnect.productionSecurity.transport.test.js
node --test test/intelligenceFabric.coachConnect.productionSecurity.operator.test.js
node --test test/intelligenceFabric.coachConnect.productionSecurity.integration.test.js
node --test test/api.internal.developerAccess.productionSecurity.test.js
node --test test/intelligenceFabric.coachConnect.security.*.test.js test/api.internal.developerAccess.security.test.js
node --test test/intelligenceFabric.auth*.test.js
node --test test/intelligenceFabric.coachConnect*.test.js
node --test test/intelligenceFabric.production*.test.js
node --test test/intelligenceFabric.runtime*.test.js test/intelligenceFabric.predictive*.test.js test/intelligenceFabric.subscriber*.test.js
node --test test/intelligenceFabric*.test.js
```

Do not run bare repository-wide `node --test`; broad discovery can invoke
unrelated live-Redis diagnostics or file-writing generators.

Run focused ESLint on the exact sprint/campaign allowlist. Run `npm run build`
only without network or production variables. Run protected BA/Business Engine
checks only after proving they are read-only, otherwise record
`BLOCKED_BY_UNRELATED_DIRTY_WORK`.

## 7. Campaign-wide gates

### 7.1 Identity and authority

- canonical subscriber subject source is human-approved and repository-bound;
- no client-supplied subscriber identifier authorizes mutation;
- session elevation and revocation are atomic/idempotent;
- coach/developer/operator authorities remain disjoint;
- canonical Business Engine promotion still requires subscriber confirmation.

### 7.2 Distributed security semantics

- shared-state adapter contract passes simulated multi-instance tests;
- no local fallback under production-shaped flags;
- partition, outage, TTL, clock, fencing, replay, revocation, rate, and epoch
  behavior are explicit;
- passing does not certify the selected live platform.

### 7.3 Retention and deletion

- policy is `HUMAN_APPROVED`;
- every target/backing store is inventoried;
- legal hold and requests behave according to approved policy;
- deletion receipts prove their exact class;
- JSONL/backup physical deletion is not claimed without selected-strategy proof.

### 7.4 Transport and operations

- production host/HTTPS/proxy policy is approved;
- HSTS is exact-condition only;
- forwarded spoofing tests pass;
- operator identity/entitlement/break-glass/audit is attributable;
- no developer capability grants operator authority.

### 7.5 Regression and packaging

- complete safe Intelligence Fabric suite passes;
- focused security/API and all sprint suites pass;
- build, focused lint, import/export/cycle checks pass;
- source/client/proof/archive secret scans pass;
- evidence manifest and artifact index match;
- worktree/package bytes match;
- protected roots have no campaign diff;
- no deployment, production Redis, provider, Stripe, credential, or migration action occurred.

## 8. Required implementation proof directory

Later implementation writes only:

`lab_outputs/coach_connect_production_security_prerequisites_v1/`

Architecture and governance:

- `repository_grounding_report.md`
- `threat_model.md`
- `trust_boundary_map.md`
- `dependency_graph.json`
- `human_decision_register.json`
- `protected_root_before.json`
- `approved_file_plan.json`
- `contract_inventory.json`
- `failure_taxonomy.json`

Sprint proof:

- `sprint_1_subject_binding_proof.json`
- `sprint_1_session_rotation_proof.json`
- `sprint_2_shared_state_contract_proof.json`
- `sprint_2_multi_instance_proof.json`
- `sprint_3_retention_authority_proof.json`
- `sprint_3_deletion_state_machine_proof.json`
- `sprint_4_backing_store_inventory.json`
- `sprint_4_erasure_decision.json`
- `sprint_4_erasure_verification_proof.json`
- `sprint_5_hsts_policy_proof.json`
- `sprint_5_trusted_proxy_proof.json`
- `sprint_6_operator_identity_proof.json`
- `sprint_6_operator_entitlement_proof.json`
- `sprint_7_integration_proof.json`
- `repair_receipts.json`

Adversarial and regression:

- `scenario_01.json` through `scenario_60.json`
- `attack_simulation_report.md`
- `test_manifest.json`
- `test_results.json`
- `build_result.json`
- `lint_result.json`
- `secret_scan.json`
- `activation_boundary_scan.json`
- `protected_root_verification.json`
- `changed_files.json`

Closeout:

- `artifact_index.json`
- `evidence_manifest.json`
- `implementation_report.md`
- `executive_handoff.md`
- `ai_handoff.md`
- `ai_handoff.json`
- `final_verdict.json`

Every JSON proof contains artifact version, campaign ID, evidence class,
generated time, source commit, command/test reference, status, and limitations.
No proof contains raw assertions, tokens, addresses, transcripts, credentials,
private coach content, or production identifiers.

## 9. Evidence and secret safety

The validation helper must:

- read expected canary/secret values only from process memory;
- never print, hash-prefix, quote, or serialize those values;
- scan exact source, build, proof staging, and decompressed archive entries;
- report only category, safe path, file hash, counts, and status;
- reject unreadable, symlinked, absolute, parent-traversal, duplicate, or
  case-colliding archive entries;
- detect cookies, Authorization values, identity assertions, raw network
  addresses, transcript/private content, provider/Redis credentials, and client-exposed variables;
- prove no production action via flags, imports/config, and captured adapter calls.

Any confirmed exposure returns `SECRET_EXPOSURE_DETECTED` and blocks packaging.

## 10. Implementation review ZIP

After later authorized implementation and full validation, create:

`COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_IMPLEMENTATION_REVIEW_V1.zip`

Include all approved AFWs, exact changed implementation/tests/helper, complete
proof directory, handoffs, and final verdict. Exclude `.git`, `.env*`,
`.runtime-data`, `node_modules`, raw `dist`, browser profiles, caches, logs,
production data, old proof runs, unrelated dirty work, and secrets.

Use a dedicated staging directory; exact-list copy; scan; archive; decompress
and rescan; verify integrity, sorted list, file count, per-entry hashes, ZIP
size/hash, no symlinks/absolute/`..`/duplicates/case collisions.

## 11. Repaired AFW decision-authority review ZIP

The decision-authority repair creates:

`COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_AFW_REVIEW_V2.zip`

It contains exactly:

1. Part 1.
2. Part 2.
3. Part 3.
4. Cross-part consistency review.
5. Machine-readable expansion index.
6. Sprint 1 AFW.
7. Sprint 2 AFW.
8. Sprint 3 AFW.
9. Sprint 4 AFW.
10. Sprint 5 AFW.
11. Sprint 6 AFW.
12. Sprint 7 AFW.
13. Human Decision Packet.
14. Decision-authority repair receipt.

No source packet copy, implementation source, V1 archive, prior evidence,
unrelated file, secret, or runtime data is included.

## 12. Handoffs

Executive handoff states:

- which prerequisites are resolved versus blocked;
- exact evidence class and test totals;
- human decisions still required;
- Human Decision Packet status and approval-record hashes;
- physical deletion truth;
- production-store and transport certification limits;
- protected-root result;
- no-deployment statement;
- final verdict.

AI handoff states:

- source commit and dirty-worktree boundary;
- exact changed-file allowlist;
- policy/contract versions;
- commands/outcomes;
- decision register and dependency graph;
- repair receipts;
- evidence/archive hashes;
- prohibition on inferring Deployment Readiness.

## 13. Final verdict logic

### `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_COMPLETE`

Only when all nine prerequisites are resolved with required human authority,
all contracts/tests/proofs pass, every backing store and historical-erasure
claim is verified, no production action occurred, and Deployment Readiness can
begin without security architecture ambiguity.

This verdict does not authorize deployment.

### `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_COMPLETE_WITH_LIMITS`

Only for bounded external certification items that do not block Deployment
Readiness. It cannot hide an unresolved prerequisite, authority, deletion
claim, identity source, shared state, HSTS/proxy policy, or operator boundary.

### `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_BLOCKED`

When any prerequisite is unresolved, unproven, lacks authority, requires an
unnamed adapter/provider, fails a protected boundary, or exhausts bounded repair.

### `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_FAILED`

When authorized implementation materially violates doctrine, protected roots,
security semantics, or evidence integrity.

Green tests never override missing human authority or unverified physical
deletion. Sprint 7 cannot issue `COMPLETE` while any mandatory Human Decision
Packet row is not explicitly `APPROVED`.

## 14. Deployment non-authorization

All reports, handoffs, verdicts, and package metadata state:

```text
Deployment, public or private production activation, production certification,
production Redis or other live shared-state access, live providers/models/media,
credentials or secrets, production migration, Stripe activation, and destructive
production deletion are not authorized by this campaign result.
```

## 15. Part 3 verdict

`PART_3_VALIDATION_AND_REVIEW_PLAN_COMPLETE`

No implementation verdict is issued during AFW expansion.
