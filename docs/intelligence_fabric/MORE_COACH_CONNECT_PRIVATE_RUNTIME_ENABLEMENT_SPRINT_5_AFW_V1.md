# MORE Coach Connect Private Runtime Enablement — Sprint 5 AFW V1

Sprint: `5 — Coach Connect Runtime Attachment`

Implementation authorized: `false`

Deployment authorized: `false`

## 1. Purpose

Attach the existing Coach Connect service to the same canonical subject, exact
scope, Business Engine, and Subscription Runtime. Permit only already
implemented private subscriber and structured non-voice behavior while
preserving all identity, relationship, consent, entitlement, privacy,
idempotency, promotion, and provider gates.

Sprint verdicts:

- `PRIVATE_RUNTIME_SPRINT_5_COACH_CONNECT_ATTACHMENT_COMPLETE`
- `PRIVATE_RUNTIME_SPRINT_5_BLOCKED`

## 2. Dependencies and repository grounding

Requires Sprints 1–4 complete. Reuses protected
`createCoachConnectService`, activation, contracts, state machines,
projections, stores, and auth interfaces without semantic edits.

Coach Connect inspection must continue to report one Business Engine, no second
engine, no live billing/provider, and no implicit canonical writer.

## 3. Exact allowed files

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/attachments.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/composition.js
src/components/businessAssessment/PrivateRuntimeAttachmentHost.jsx
test/intelligenceFabric.coachConnect.privateRuntime.coachConnect.test.js
lab_outputs/coach_connect_private_runtime_enablement_v1/sprint_5/**
```

## 4. Exact prohibited files and actions

Prohibited:

- every path outside Section 3;
- all protected Coach Connect product/security/live-session sources;
- Business Engine and Subscription Runtime source;
- coach identity semantics;
- public UI/onboarding;
- provider/persistence/transcript/Stripe/deployment files/actions;
- fake relationships, consent, entitlement, coach authority, or canonical
  promotion;
- staging and commit.

## 5. Contracts

- `coach-connect-attachment-v1`;
- allowed capabilities:
  `SUBSCRIBER_PROJECTION` and
  `STRUCTURED_NON_VOICE_SESSION_WHEN_ALREADY_AUTHORIZED`;
- exact scope and Business Engine/subscription receipt references;
- live auth, billing, model, media, voice/video, transcript persistence,
  canonical mutation, and second Business Engine false;
- existing relationship/consent/coach-auth gates remain authoritative.

## 6. State machine

```text
SUBSCRIPTION_ATTACHED
-> VALIDATING_COACH_CONNECT_SCOPE
-> VALIDATING_EXISTING_RELATIONSHIP_AND_CONSENT
-> CREATING_EXISTING_COACH_CONNECT_HANDLE
-> COACH_CONNECT_ATTACHED

Missing optional Coach state
-> COACH_CONNECT_STATE_MISSING
-> no fabricated state
```

## 7. Implementation sequence

1. Verify all predecessor receipts and exact scope equality.
2. Inject the existing Coach Connect service/store/auth boundaries.
3. Enable only the reviewed private capability matrix within the synthetic
   request envelope; source defaults remain false.
4. Bind authoritative Business Engine and subscription references.
5. Require existing coach identity, relationship, consent, entitlement, and
   privacy decisions for coach-side operations.
6. Emit receipt-only host state.
7. Prove all provider/billing/promotion paths remain denied.
8. Emit Sprint 5 evidence.

## 8. Required tests

- same subject/scope/engine/subscription attaches;
- cross-scope or mismatched receipt denies;
- `business_engine_count=1` and `second_business_engine=false`;
- `SUBDEV1` grants no coach/operator/admin/billing/canonical authority;
- subscriber projection uses authoritative Business Engine reference;
- missing relationship/consent/entitlement/coach state fails closed;
- structured non-voice path requires existing authorization;
- private coach content is never exposed;
- invitation/cockpit/session actions respect existing capability gates;
- checkout/billing, model/media/voice/video, transcript, promotion, production
  persistence, and Stripe calls remain zero;
- no protected Coach Connect semantics change.

## 9. Evidence

```text
coach_connect_attachment_contract.json
one_engine_cross_runtime_proof.json
coach_authority_separation_proof.json
relationship_consent_privacy_proof.json
no_provider_transcript_promotion_proof.json
```

Plus standard sprint-local evidence.

## 10. Sprint-local validation

- focused Coach Connect attachment tests pass;
- existing Coach Connect, auth, privacy, and Live Session regressions pass;
- protected Coach Connect hashes/diffs unchanged;
- exact allowlist, import/export, external-call, evidence, and secret scans
  pass;
- no deployment, provider/persistence/Stripe activation, staging, or commit.

## 11. Bounded repair

At most two Section 3-only repairs. No repair may edit Coach Connect semantics,
invent state/authority, weaken privacy/consent/promotion, or enable a live
dependency.

## 12. Stop conditions

Stop if:

- Coach Connect product/state-machine changes are required;
- a coach relationship or consent must be fabricated;
- a second Business Engine/runtime is required;
- live provider, transcript persistence, Stripe, or canonical bypass is
  required;
- a protected/non-allowlisted file is needed.

## 13. Expected outputs

- Coach Connect attachment within shared bridge files;
- receipt-only host composition;
- one focused test;
- indexed Sprint 5 evidence and verdict.

## 14. No-deployment statement

Sprint 5 contacts no provider/store/platform and creates no live Coach Connect
state.
