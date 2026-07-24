# MORE Coach Connect Security and Privacy Hardening — Cross-Part Consistency V1

Status: `AFW EXPANSION CONSISTENCY REVIEW`  
Generated: `2026-07-24`

## 1. Consistency verdict

`CROSS_PART_CONSISTENT_WITH_EXPLICIT_IMPLEMENTATION_STOP_GATES`

Parts 1, 2, and 3 agree on mission, authority, protected boundaries, actor authority, exact scope, consent, privacy, retention posture, candidate file plan, phase order, failure taxonomy, proof requirements, terminal verdicts, and non-authorizations.

No part claims current implementation, deployment readiness, physical deletion, shared-store durability, or legal/compliance certification.

## 2. Cross-part matrix

| Concern | Part 1 architecture | Part 2 implementation playbook | Part 3 proof/terminal gate | Result |
|---|---|---|---|---|
| Authority | Architecture expansion only | Requires separate implementation authority | Issues no implementation verdict now | Consistent |
| One Business Engine | Coach proposes; subscriber confirms; history appends | Central policy cannot grant coach canonical write | Scenario 4 and promotion replay require append count zero/one | Consistent |
| Developer access | Temporary subscriber entitlement only | Opaque subject/scope/browser/environment-bound capability | Copied, expired, production, fixation, brute-force, bundle-secret scenarios | Consistent |
| Identity/session | Current identity, expiry, revocation, rotation | Security version, binding, fixation resistance, restart-safe revocation | Boundary, substitution, restart, rotation tests | Consistent |
| Tenant isolation | Exact composite ownership before response | Scoped lookup and cache keys; non-enumerating denial | Scenarios 1, 2, 9, 13, 16 | Consistent |
| Consent | Purpose-specific use-time checks | Recheck before every protected use/replay | Revoked-consent and matrix-negative suites | Consistent |
| CSRF/Origin | Required defense in depth | Same-origin plus server-recorded one-time CSRF grant | Scenario 8 and request-integrity suite | Consistent |
| Replay | Current policy, version, consent, deletion epoch | Timestamp, nonce, fingerprint, idempotency, sequence | Scenarios 10, 11, 12, 19 | Consistent |
| Rate limiting | Shared atomic state required for deployment claims | Injected port; in-memory store is synthetic only | Scenario 17 and store-class labeling | Consistent |
| Privacy classes | Seven required Live Session classes | Explicit creation/transition and field allowlists | Class matrix and canary leak tests | Consistent |
| Logs/audit | Hashes/reason codes, no sensitive payload | Central redactor and safe events | Scenarios 14, 20 and log-safety scans | Consistent |
| Retention | Proposed durations; human approval required | Planning allowed; destructive execution gated | Retention suite and blocked verdict if unresolved | Consistent |
| Deletion | Tombstone/epoch plus content/backing-store deletion | Logical denial separated from physical erasure | Scenario 19; final verdict cannot overclaim | Consistent |
| Local JSONL | Restart-durable internal only | Physical erasure needs compaction/key erasure/store replacement | Old-snapshot detection and honest limitation | Consistent |
| Headers | Narrow review; production-only HSTS unresolved | Conditional `vercel.json`; no broad unsafe header | Route/header matrix; limited/blocked verdict | Consistent |
| Secret scanning | No values in source/client/log/proof/ZIP | Secret-safe helper reports metadata only | Five scan reports and archive-content scan | Consistent |
| Default-off | Production/live/public activation prohibited | Flags remain default-off/synthetic-only | Activation and no-network scans | Consistent |
| Repairs | Two cycles per failed phase | Preserve failure, smallest allowlisted repair | Block/fail after exhausted cycles | Consistent |
| Review ZIP | Five expansion files only at AFW checkpoint | No implementation ZIP yet | Later implementation ZIP separately specified | Consistent |

## 3. Vocabulary consistency

The exact internal failure taxonomy is identical across the parts:

```text
AUTHENTICATION_FAILED
SESSION_EXPIRED
SESSION_REVOKED
SESSION_FIXATION_DETECTED
AUTHORIZATION_DENIED
RELATIONSHIP_INVALID
ENTITLEMENT_INVALID
CONSENT_MISSING
CONSENT_REVOKED
TENANT_SCOPE_VIOLATION
CSRF_VALIDATION_FAILED
ORIGIN_VALIDATION_FAILED
REQUEST_REPLAY_DETECTED
RATE_LIMITED
CAPABILITY_INVALID
CAPABILITY_EXPIRED
CAPABILITY_REVOKED
CAPABILITY_ENVIRONMENT_DENIED
SECRET_EXPOSURE_DETECTED
REDACTION_FAILED
RETENTION_EXPIRED
DELETION_REQUIRED
DELETION_FAILED
LOG_SAFETY_VIOLATION
SECURITY_HEADER_MISSING
```

Existing lower-case developer-access response codes may remain client-safe compatibility aliases during a bounded migration, but the new central policy and proof use the uppercase taxonomy. No alias may weaken denial semantics.

The seven Live Session privacy classes are identical across the parts:

```text
SUBSCRIBER_PRIVATE
COACH_SHARED
BUSINESS_ENGINE_ELIGIBLE
RESTRICTED_SENSITIVE
REDACTED
LEARNING_INELIGIBLE
LEARNING_CANDIDATE
```

## 4. File-plan consistency

Part 1 owns the complete candidate allowlist. Part 2 freezes and narrows it after a later authorization. Part 3 validates changed-file equality against that narrowed allowlist.

Consistent restrictions:

- all expansion files are additive under `docs/intelligence_fabric/`;
- implementation source/tests/proof are not created in this expansion;
- `vercel.json` is conditional;
- environment files and `.runtime-data/` are read-only scan inputs and never staged;
- protected BOS/BA/Business Engine/Five Futures/One Move/scoring/Fathom/pricing/Stripe logic is excluded;
- any implementation path outside the allowlist requires a stop and revised human authorization.

## 5. Retention consistency

Part 1 provides required engineering defaults, minimums, maximums, revocation, deletion, audit, and replay behavior for every current record class.

All parts label those values `PROPOSED_NOT_AUTHORIZED`. They agree:

- no destructive executor runs before human policy approval;
- legal hold is explicit and audited;
- raw transcript/content references are shorter-lived than reviewed structured intelligence;
- deletion epoch/tombstone must precede content erasure;
- backup restore re-applies deletion epochs before exposure;
- appending a tombstone to the current JSONL journal proves logical denial, not physical erasure;
- a completion verdict cannot hide unresolved physical deletion.

## 6. Required-scenario consistency

Part 1 threat surfaces and authority matrix cover all 20 source-packet scenarios. Part 2 assigns controls to each scenario. Part 3 names one required artifact for each and supplies the expected terminal behavior.

No scenario requires a live provider, production Redis, Stripe, production data, external penetration target, or public activation.

## 7. Unresolved architecture conflicts

These are not silently resolved by the expansion:

| ID | Conflict | Consequence | Required disposition |
|---|---|---|---|
| `RETENTION_POLICY_AUTHORITY` | Repository truth says retention is `NOT_CONFIGURED`; proposed durations are not human/legal policy | Phase 7 destructive execution blocked | Human approves or replaces durations, legal-hold rule, and audit exceptions |
| `SUBSCRIBER_SUBJECT_BINDING` | Developer endpoint has no grounded subscriber identity input today | Subject-bound developer entitlement cannot be safely issued | Identify and authorize the server-side subscriber identity/session contract |
| `SHARED_SECURITY_STATE` | Attempts and revocations are process-local; production Redis activation is excluded | Multi-instance revocation, nonce, rate, and deletion-epoch proof unavailable | Approve a shared-store adapter contract and later environment-specific activation/certification |
| `LOCAL_JSONL_PHYSICAL_DELETION` | Append-only full snapshots retain old bytes after a logical tombstone | Physical erasure cannot be claimed | Approve cryptographic erasure, verified compaction, or a deletion-capable store |
| `TRANSCRIPT_BACKING_STORE` | Contracts store content references, but the referenced content store/deleter is not grounded | End-to-end transcript deletion cannot be proved | Identify backing-store ownership, key/deletion adapter, and backup behavior |
| `PRODUCTION_ONLY_HSTS` | Current `vercel.json` has no environment-conditional header mechanism | HSTS could affect preview/local if applied broadly | Ground a production-only mechanism or accept a blocked/limited header verdict |
| `TRUSTED_CLIENT_ADDRESS` | Current code reads forwarded address without a grounded trusted-proxy contract | Network-dimension throttling can be spoofed or unavailable | Document hosting-attested client address or use reduced-signal policy |
| `OPERATOR_IDENTITY_AND_AUDIT_ENTITLEMENT` | No grounded operator auth/entitlement surface exists for audit inspection | Audit inspection action cannot be safely exposed | Define a separate strong operator identity and least-privilege audit capability |

The current unrelated dirty worktree is an implementation hygiene constraint, not an architecture conflict. It requires exact allowlisting and protected before/after evidence.

## 8. Conflict severity and expansion disposition

The eight conflicts do not prevent architecture expansion because each has a fail-closed design and explicit stop gate.

They do prevent a present claim of:

- full implementation readiness without decisions;
- destructive retention/deletion completion;
- multi-instance abuse resistance;
- physical local-journal erasure;
- end-to-end transcript backing-store deletion;
- complete production header posture;
- deployability or production certification.

If implementation is later authorized without resolving them, Phase 1 or the affected phase must return `COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_BLOCKED`.

## 9. Non-authorization consistency

Every part prohibits:

- implementation during this expansion;
- commit and push;
- deployment, promotion, and public access;
- production activation and migration;
- Stripe activation or records;
- production Redis;
- live auth/provider/model/media;
- production credentials/data;
- external penetration testing;
- destructive production deletion;
- legal/compliance certification.

## 10. AFW archive consistency

The AFW ZIP must contain exactly the five flat expansion artifacts and no source packet, implementation source, tests, proof directory, environment files, runtime data, build output, prior campaign artifacts, or unrelated work.

Archive integrity, exact sorted names, count `5`, entry hashes, ZIP size, and ZIP SHA-256 are required.

## 11. Final expansion verdict

`COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_AFW_EXPANSION_COMPLETE_WITH_EXPLICIT_IMPLEMENTATION_BLOCKERS`

The architecture is internally consistent and reviewable. Implementation, commit, push, deployment, production activation, public access, Stripe, production Redis, live providers, and destructive deletion remain unauthorized.
