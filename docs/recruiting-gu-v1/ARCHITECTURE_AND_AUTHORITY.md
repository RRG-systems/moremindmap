# Recruiting GU V1 architecture and authority receipt

## Source custody

- Dedicated worktree: `/Users/rrg/.openclaw/workspace/moremindmap-sidebar-future-lab-v1`
- Build branch: `codex/recruiting-gu-v1-build`
- Reconciled source commit: `3899c7371639631224e644096c82f727cdf7cf2b`
- Reconciled source tree: `0c5e57d2bab96c3551fea4d93dd05fd47f9c0f5a`
- Exact Production deployment represented at build start: `dpl_Ap6e9psbMXEqzo28ZC1CadF7xVJx`
- Preserved prior Sidebar lineage checkpoint: `56a80724dd6ae67b99ffcede98c63365b8ca1bfc` (not replayed wholesale)
- Prior Sidebar checkpoint tree: `7f166499fc37e3fdd88799e1bd78fd08bea75501`

The implementation was built from the reconciled source commit. Only bounded, reviewed runtime/renderer pieces were deliberately brought forward from the preserved experimental lineage.

## Runtime map

| Entry | Authority | Product/runtime | State/effects |
|---|---|---|---|
| Recruiting manager invitee click | Existing manager session + accepted Recruiting invitation | `/recruiting-gu-v1?candidate_id=…` → real GU runtime | Recruiting durable store; canonical derived read only |
| MORE-ID consultation | Manager session + owner approval + active consultation relationship | Real GU runtime | No private truth before approval; read-only relationship |
| Authenticated Darren HOME demo card | Darren master-control membership mints narrow demo capability | `/recruiting-gu-v1/demo` | Synthetic-only |
| Leadership Portal `darrendemo` | Existing one-time launcher/CSRF exchanges to browser-bound Recruiting demo capability | `/recruiting-gu-v1/demo` | Synthetic-only; no real Darren/customer authority |
| Local acceptance route | Explicit loopback-only local feature flag | Same GU component/runtime with synthetic adapter | In-memory synthetic state only |

## Existing Recruiting V1 substrate preserved

The build reuses and does not replace:

- Darren admin/master-control and unlimited semantics;
- standard manager five-per-month entitlement;
- manager setup, verification, session rotation, and one-time CSRF;
- invitation purpose disclosure, consent, acceptance, resend, revocation, and relationship binding;
- canonical BOS vault and BA readiness boundaries;
- Local Opportunity and truth-class separation;
- provider safety, persistence, locking, audit, and outbox infrastructure;
- isolated Darren demo capability architecture.

The bounded V1 integration changes are limited to: additive durable GU collections in the normalized state, the consultation approval notification kind, feature-gated invitee dispatch to GU V1, and an authorized fallback to the historical demo route when the GU flag is off.

## Authored product boundary

YOU mounts the actual `NewBosExperience` with a governed artifact override. YOUR BUSINESS mounts the actual `BusinessTwinApp` with the governed Business Twin view model. The source directories for those authored renderers are unchanged relative to the reconciled base.

The GU layer is temporary and validated. It cannot write BOS, BA, Local Opportunity, Recruiting V1 truth, customer state, or canonical state. Closing GU restores the full authored product and retains the same Shared Business Session conversation.

## Shared Business Session

Contract: `more_recruiting_gu_v1_shared_business_session_v1`.

The session binds relationship, manager membership/enterprise, subject/profile/candidate, world version, room, revision, and status. It records append-only actor-attributed events, human/MORE conversation, purpose-shaped projections, evidence references, hypotheses, scenario assumptions, proposal revisions, decisions, second-offer state, inert effect receipts, and completion.

Every mutation requires the current monotonic revision. Stale human mutations and stale model plans fail closed. Real sessions persist through the Recruiting store; the demo adapter is isolated and resettable.

Typed manager text is attributed to the authenticated manager. The UI does not provide a Darren/Jordan speaker toggle and does not falsely claim authenticated invitee attribution.

## MORE-ID authority

`MORE ID → canonical owner delivery address resolved server-side → purpose-disclosed request → owner approval/decline → active read-only consultation relationship`

The identifier alone reveals no private profile truth and creates no access. Approval is time-bound, token-digested, one-time-CSRF protected, and relationship-scoped. The relationship explicitly carries `canonical_write_authority:false`.

## PLAN and effect boundary

The frontier turns manager-authored rough commitments into a strict plan schema and may not add promises, money, dates, people, outcomes, or capabilities not supplied. Proposal versions preserve supersession lineage. YES records acceptance. ADJUST reopens the same conversation. NOT NOW enters the second offer; only a second decline closes gracefully.

The demo effect adapter returns an idempotency-keyed receipt only when `external_mutation:false`. The real fulfillment connector is intentionally absent.
