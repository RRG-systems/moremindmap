# Coach Connect Production Security Prerequisites — AFW Decision-Authority Repair Receipt V1

Mission:
`MORE_REPAIR_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_DECISION_AUTHORITY_001`

Date: `2026-07-24`

Repository baseline: `d42b52a27e8dae0ea4f53a444ee073a752fcdecd`

Repair verdict:
`COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_AFW_DECISION_AUTHORITY_REPAIRED`

## 1. Trigger and bounded scope

The V1 AFW package was structurally valid but left all eleven human gates as
unresolved stop conditions. This repair adds an unsigned decision packet with
concrete recommended defaults and makes the AFW enforce explicit approval
semantics before implementation.

Authorized scope:

- architecture documentation inspection and repair;
- decision recommendation and tradeoff analysis;
- AFW cross-reference and gating repair;
- machine-index and archive repair;
- V2 package validation.

Not authorized or performed:

- source implementation;
- staging or commit;
- deployment or production activation/certification;
- production Redis/shared-state access;
- live provider, model, media, identity, object-store, or hosting access;
- credential/secret creation or change;
- production migration or destructive deletion;
- Stripe activation;
- protected product redesign.

## 2. Decision-authority rule added

Every decision now has:

1. an exact question;
2. a recommended default architecture;
3. current-stage rationale;
4. viable alternatives;
5. security, privacy, operations, cost, and migration tradeoffs;
6. repository/contract impact;
7. unlocked files/tests;
8. reversibility;
9. required human authority;
10. explicit approval fields;
11. deferral consequence.

`RECOMMENDED_PENDING_HUMAN_DECISION` grants no authority. Only explicit
`APPROVED` with a human choice, approver, date, and required attachments can
satisfy a sprint gate. `REJECTED` requires AFW revision. `DEFERRED` blocks only
the affected sprint and dependent completion. Sprint 7 cannot issue
`COMPLETE` while any mandatory row is not approved.

## 3. Exact artifact change receipt

| Artifact | V1 state | V2 repair and reason |
|---|---|---|
| `MORE_CAMPAIGN_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_PART_1_V1.md` | Human gates listed without decision-ready choices | References the Human Decision Packet; defines recommended-versus-approved semantics and affected-sprint deferral |
| `MORE_CAMPAIGN_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_PART_2_V1.md` | Required decisions but no canonical approval record | Adds the approval-record contract, validation fields, and rejection/deferral routing |
| `MORE_CAMPAIGN_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_PART_3_V1.md` | V1 12-file package and generic human evidence | Adds unsigned-recommendation evidence class, packet validation, Sprint 7 prohibition, and exact 14-file V2 package |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_CROSS_PART_CONSISTENCY_V1.md` | Confirmed unresolved blockers | Verifies decision-ready recommendations, non-approval, scoped deferral, and repaired consistency |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_EXPANSION_INDEX_V1.json` | Eleven `UNRESOLVED` entries and V1 archive | Adds recommended architecture/status and blank human fields for every decision; indexes exact V2 archive |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_1_IDENTITY_SESSION_AFW_V1.md` | Identity decisions had no selectable default | References recommended Auth0 subject authority and rotating server session; requires both approvals |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_2_SHARED_SECURITY_STATE_AFW_V1.md` | Platform decision unnamed | References recommended paid single-primary Upstash security store; preserves no-live-Redis boundary |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_3_RETENTION_DELETION_STATE_AFW_V1.md` | Policy/horizon unresolved | References recommended governance and proposed horizon; requires signed schedule/horizon without inventing legal policy |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_4_TRANSCRIPT_HISTORICAL_ERASURE_AFW_V1.md` | Store/backup/strategy unresolved | References S3/metadata and store-replacement-plus-crypto recommendations; preserves JSONL logical-denial truth |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_5_TRANSPORT_NETWORK_TRUST_AFW_V1.md` | Hosting/HSTS unresolved | References one-edge Vercel trust and staged HSTS recommendations; requires exact human-approved hosts/directives |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_6_OPERATOR_IDENTITY_AFW_V1.md` | Operator provider/policy unresolved | References separate Auth0 operator authority and scoped entitlement/dual-control policy; preserves `SUBDEV1` separation |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_7_INTEGRATION_VERDICT_AFW_V1.md` | Unresolved decisions blocked success generally | Adds exact packet completeness checks and categorical prohibition on `COMPLETE` while any row is not approved |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md` | Absent | New authoritative unsigned decision-resolution packet for all eleven IDs |
| `MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_AFW_DECISION_AUTHORITY_REPAIR_RECEIPT_V1.md` | Absent | New complete change/authority/validation receipt for this repair |

No source implementation file is included in the changed-artifact allowlist.

## 4. Recommendation status

All eleven decisions are:

`RECOMMENDED_PENDING_HUMAN_DECISION`

All human choice, approver, approval date, and approval-status fields remain
blank/null. No recommendation is represented as human approval. The proposed
30-day backup horizon is explicitly a technical recommendation requiring
Privacy/Legal approval, not an invented legal retention period.

## 5. Preserved truth and boundaries

- Local append-only JSONL remains `LOGICAL_DENIAL_ONLY`.
- No physical deletion of historical JSONL bytes is claimed.
- Sensitive production records are recommended for deletion-capable and
  cryptographic-erasure-capable storage; no store is activated.
- All functionality remains default-off.
- Business Engine, Coach Connect behavior, Five Futures, One Move, BA/BOS,
  scoring, Profile ID, subscription UX, Stripe/billing, persistence
  architecture, and existing committed evidence remain protected.
- `SUBDEV1` remains separate from operator identity and entitlement.
- Implementation remains unauthorized even if humans later approve the packet.

## 6. V1 source baselines

| Artifact | V1 SHA-256 |
|---|---|
| Part 1 | `3cb01e9e8799f44cdc5c14d07921a0685b5ed905e7ec86be2e1dd9ae43fbfb5b` |
| Part 2 | `ede2f415f175930f9e24da04893e763a0f3585601f3c8db846acf02fa8efec8c` |
| Part 3 | `a8eb5f9f5ff8c7758f5b74288c0f7eb146bc80cb6a3427b012a23563d5b9ac8f` |
| Cross-part consistency | `3ea2cd5ea2111f0ea0c81b51b54914d6df8f19551bf017168c0456a43f6b29df` |
| Expansion index | `cc7de9586a85a986b818a104c2abe86a23fd40553a61dc4c028f2ed9c01e3313` |
| Sprint 1 | `0d2bea7345b554b9ef14f95012f8d2d507c367496fd4c63d8d35eb8925843856` |
| Sprint 2 | `b79657b83f087c4823548b838feac29005353051726d67e7fb222f49b3022cbb` |
| Sprint 3 | `daa751887074a3ae120fa7de8e27d041af263961a70b78786d56419c31f2fd0f` |
| Sprint 4 | `cfa386f31b4db8d46e71a7801fe048c2946b99c5adb4353333c16d2a911af8d8` |
| Sprint 5 | `bb14562049137f7446cca1aa6782a646200690892b0990a6544f5b3b3d6f53d3` |
| Sprint 6 | `2b952f86fbdf60e6b96909c74fbbe032cd1d1189f2b3fe115511fe84f91805c7` |
| Sprint 7 | `f72e159deea5850e6132cab29f335e3891afd19f74fcc26b11c08a50d0668648` |
| V1 ZIP | `b0034ebac7e115d90fc7891ccd7e7407f0a66b591251507a1d52a7f08423568d` |

## 7. Validation receipt

Final V2 validation status: `PASS`

| Gate | Result |
|---|---|
| Exact indexed artifacts | PASS — 14 |
| JSON/index parse | PASS |
| Manifest hashes | PASS — 13 content hashes plus index self-hash exclusion |
| Decision completeness | PASS — 11 decisions × 11 required fields |
| Tradeoff coverage | PASS — security, privacy, operations, cost, migration |
| Human approval honesty | PASS — 0 preselected approvals; all human fields blank/null |
| Packet references | PASS — Parts 1–3, cross review, and Sprints 1–7 |
| JSONL deletion honesty | PASS — logical-denial-only; no physical deletion claim |
| Secret/credential patterns | PASS — 0 matches across 7 high-risk pattern classes |
| Source implementation boundary | PASS — no implementation file added to the 14-file allowlist |
| Protected-root boundary | PASS — pre-existing unrelated tracked changes unchanged in scope |
| Git boundary | PASS — HEAD unchanged; staging empty; no commit |
| Archive entry safety | PASS — 14 regular relative files; no directory, symlink, absolute path, `..`, duplicate, or case collision |
| Archive integrity | PASS — decompression test and exact source/package byte comparison |
| Production action | PASS — none |

One bounded documentation repair added the canonical Human Decision Packet
filename to the cross-part consistency artifact after the first reference gate
identified a descriptive-only reference. The rerun passed. No second repair
was required.

## 8. Receipt verdict

`AFW_DECISION_AUTHORITY_REPAIR_RECEIPT_COMPLETE`
