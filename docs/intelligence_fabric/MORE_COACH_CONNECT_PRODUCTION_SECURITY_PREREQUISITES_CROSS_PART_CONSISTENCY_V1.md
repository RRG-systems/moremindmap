# Coach Connect Production Security Prerequisites — Cross-Part Consistency V1

Review date: 2026-07-24  
Repository baseline: `d42b52a27e8dae0ea4f53a444ee073a752fcdecd`  
Review type: architecture expansion only; implementation not authorized.

## 1. Review result

Parts 1–3 and Sprint AFWs 1–7 are consistent with the source architecture
packet and repository grounding. The Human Decision Packet makes every human
authority decision ready for explicit approval, rejection, or deferral without
silently approving it. The repaired expansion is complete enough for human
architecture decision review.

Canonical packet:
`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`.

Historical V1 expansion verdict:

`COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_AFW_EXPANSION_COMPLETE_WITH_EXPLICIT_BLOCKERS`

V2 decision-authority repair verdict:

`COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_AFW_DECISION_AUTHORITY_REPAIRED`

These are architecture verdicts, not implementation, production, deployment,
certification, or Deployment Readiness verdicts.

## 2. Requirement trace

| Source requirement | Expansion location | Result |
|---|---|---|
| Doctrine, grounding, threats, trust, protected roots | Part 1 sections 2–8 | Defined |
| Nine prerequisite decisions and human gates | Part 1 sections 9–12 | Defined; approval semantics repaired |
| Eleven decision-ready recommendations and approval fields | Human Decision Packet | Complete; unsigned |
| Contracts, states, file plan, tests, migrations | Part 2 sections 2–9 | Defined conditionally |
| Validation, adversarial proof, packaging, handoffs, verdicts | Part 3 sections 3–14 | Defined |
| Seven pre-authored sprint AFWs | Sprint 1–7 artifacts | Defined |
| Cross-part review | This artifact | Complete |
| Machine-readable index | Expansion index JSON | Required package member |
| Two bounded repairs per gate | Parts 2–3 and Sprint 7 | Consistent |
| Default-off and no production action | All parts and sprints | Preserved |
| One exact 14-artifact V2 AFW ZIP | Part 3 and index | Defined |

## 3. Blocker consistency matrix

| Production prerequisite | Part 1 authority | Part 2 contract/state | Part 3 proof | Sprint |
|---|---|---|---|---|
| Canonical subscriber subject binding | `SUBSCRIBER_AUTHORITY_SOURCE` | Subject binding | identity/tenant attacks | 1 |
| Pre-auth session rotation | `SUBSCRIBER_SESSION_OWNER` | Session elevation | fixation/replay/atomicity | 1 |
| Deployment-grade shared security state | `SHARED_STATE_PLATFORM` | Shared-state port | synthetic multi-instance/failure | 2 |
| Authoritative retention policy | `RETENTION_POLICY_AUTHORITY` | Policy authority | version/legal-hold/eligibility | 3 |
| Transcript backing-store deletion | `TRANSCRIPT_BACKING_STORE`, `BACKUP_RESTORE_HORIZON` | Deletion lifecycle | per-store receipts/restore | 4 |
| Append-only history erasure | `HISTORICAL_ERASURE_STRATEGY` | Erasure strategy | byte/key/store proof | 4 |
| Production-only HSTS | `PRODUCTION_HOSTING_TRUST`, `HSTS_DIRECTIVES` | Transport policy | exact presence/omission matrix | 5 |
| Trusted proxy/client address | `PRODUCTION_HOSTING_TRUST` | Trusted proxy resolver | spoof/chain/privacy attacks | 5 |
| Operator identity/audit entitlement | `OPERATOR_IDENTITY_AUTHORITY`, `OPERATOR_ENTITLEMENT_POLICY` | Operator and audit contracts | escalation/dual-control/audit | 6 |

Sprint 7 integrates these results but has no authority to change their status.

## 4. Decision register consistency

All eleven human decision IDs are identical across Part 1, affected sprint
AFWs, Sprint 7, the Human Decision Packet, and the expansion index. Part 2
leaves authority-selected adapter paths conditional on an approved choice and
change receipt. Part 3 makes missing authority a blocker regardless of green
synthetic tests.

The Human Decision Packet recommends:

- dedicated Auth0 subscriber identity and separate Auth0 operator identity;
- server-owned opaque rotating sessions;
- a dedicated paid single-primary Upstash Redis security store;
- Privacy-owned and Legal/Product-approved retention governance, with
  production sensitive storage off until the schedule is complete;
- encrypted unversioned S3 transcript payloads plus transactional metadata;
- a proposed bounded backup horizon requiring human Privacy/Legal approval;
- production-store replacement plus scoped cryptographic erasure;
- one exact Vercel edge with no upstream proxy;
- staged production-only HSTS with no subdomains/preload;
- deny-by-default operator roles, attributes, reason, audit, and dual control.

Every item is labeled `RECOMMENDED_PENDING_HUMAN_DECISION`. No human choice,
approver, date, or status is populated. Recommendations grant no implementation
or production authority. Legal retention periods are not invented as settled
policy.

## 5. Contract and state consistency

- Subject authorization always begins with a server-verified opaque subject;
  domain IDs, emails, invites, session IDs, and developer capability do not
  substitute.
- Session elevation is atomic and invalidates pre-auth, CSRF, and capability
  state; failure yields no authenticated authority.
- Protected production operations never fall back to process-local state.
- Only effective approved retention policy can authorize execution.
- Deletion `VERIFIED` requires all governed store receipts; partial completion
  is not success.
- The append-only JSONL journal is logical-denial-only in current repository
  truth. No physical deletion is claimed.
- HSTS is production-only after verified HTTPS and hosting trust.
- Forwarded headers are untrusted absent a grounded attested chain.
- Operator authority is attributable and separate from developer access and
  `SUBDEV1`.

State names and failure behavior agree across the three parts and sprint AFWs.

## 6. File and protected-root consistency

The candidate namespace, conditional integrations, test paths, verifier, and
proof directory in the sprint AFWs are subsets of Part 2. Provider-, identity-,
store-, and operator-adapter paths remain conditional until the relevant Human
Decision Packet row is explicitly approved and a change receipt names the
path.
`vercel.json` is conditional on Sprint 5 approval and proof; it is not changed
by this expansion.

Protected boundaries remain:

- canonical Business Engine contracts and promotion/exactly-once behavior;
- canonical subscriber/domain state and dossier/Profile ID identity;
- Dynamic Five Futures and probability history;
- One Move lifecycle/outcome validation;
- BA/BOS scoring and report generation;
- Stripe and billing;
- production Redis and live provider configuration;
- subscription UX outside narrowly authorized security handling;
- deployment configuration;
- committed campaign evidence;
- unrelated dirty worktree files.

The expansion adds documentation only. It does not stage or modify a protected
root.

## 7. Validation and evidence consistency

Sprint-local proof categories map to Part 3 scenarios and include positive,
negative authorization, cross-tenant, replay/idempotency, failure injection,
default-off, audit, no-production-action, and changed-file checks as
applicable.

Sprint 7 adopts the campaign-wide Part 3 gates: complete Intelligence Fabric,
focused security/API, integration, threat replay, build, lint, secret scan,
manifest/archive verification, package byte comparison, protected-root checks,
and production-denial proof.

Every failed gate permits no more than two bounded repair cycles. A repair
cannot change scope; scope change requires architecture review and a change
receipt.

## 8. Verdict and roadmap consistency

The implementation verdict family is unchanged:

- `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_COMPLETE`
- `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_COMPLETE_WITH_LIMITS`
- `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_BLOCKED`
- `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_FAILED`

The repaired expansion issues none of those implementation verdicts.
Independent implementation sprints can later proceed only after their own
decision rows are approved and implementation is separately authorized.
Sprint 7 cannot issue `COMPLETE` while any mandatory row remains recommended,
rejected, deferred, incomplete, or unverified.

The locked roadmap remains Production Security Prerequisites, Deployment
Readiness, Internal Default-Off Deployment, Private Real-World Testing, Live
Media Provider Selection and Controlled Wiring, Production Persistence
Activation, then Stripe Activation.

## 9. Non-authorization and final consistency verdict

Deployment, production activation/certification, production Redis or any live
shared state, live providers/models/media, credentials/secrets, production
migration, destructive production deletion, Stripe activation, source
implementation, staging, and commit are not authorized or performed.

Cross-part consistency verdict:

`CROSS_PART_CONSISTENCY_VERIFIED_DECISIONS_READY_RECOMMENDATIONS_NOT_APPROVED`
