# Coach Connect Live Session Intelligence V1 — Part 1 AFW

Artifact: `MORE_CAMPAIGN_COACH_CONNECT_LIVE_SESSION_INTELLIGENCE_PART_1_V1`
Authority: architecture and repository grounding only
Implementation, deployment, promotion, public activation: **NOT AUTHORIZED**

## Mission and doctrine

Produce the approved, repository-grounded architecture and file authorization plan for a governed live coaching session whose output is attributable Business Engine intelligence—not merely a transcript. One authoritative Business Engine serves subscriber and coach projections. A coach may observe, question, challenge, recommend, propose, interpret evidence, and help define commitments; a coach may not overwrite canonical state, Five Futures, or One Move, bypass confirmation, turn opinion into fact, or promote private session material into universal learning.

Every coach-derived item follows:

`Coach Observation → Structured Proposal → Business Engine Evaluation → Subscriber Confirmation where required → Supporting Evidence → Outcome Validation → Canonical Business State`

Confidence Reality preserves `KNOWN`, `OBSERVED`, `INFERRED`, `COACHING_NOTES`, `MISSING`, and `CONTRADICTIONS`. Coach guidance enters `COACHING_NOTES`. Outcomes—not opinions—may increase durable confidence.

## Product boundary

Coach Connect remains a per-subscriber entitlement. The existing `$19.95/month` contract is context, not implementation authority for pricing, Stripe, billing, or activation. Access requires authenticated coach + exact subscriber scope + active relationship + active entitlement + current policy authority. The subscriber stays in the subscriber experience; the coach receives a bounded cockpit projection and never enters the subscriber dashboard.

The campaign excludes public use, deployment, billing changes, generic video conferencing, automatic recording, inferred consent, autonomous coaching, direct canonical mutation, a second CRM or Business Engine, and universal learning from private sessions.

## Repository grounding procedure

1. Print repository path and `git status --short`; preserve all unrelated and untracked work.
2. Inspect only the surfaces named below. Do not run broad generators or live Redis diagnostics.
3. Record exact exports, contracts, flags, state transitions, persistence interfaces, and tests.
4. Compare findings to this packet. Classify each item `REUSE`, `EXTEND_ADDITIVELY`, `ADAPT`, `PROTECT`, or `BLOCKED`.
5. Reissue the authorized file list with exact paths before Part 2. Any path not on that list is prohibited.
6. Stop on a packet stop condition; do not invent policy, secrets, provider choice, or production wiring.

## Repository findings — 2026-07-22

| Concern | Repository truth | Decision |
|---|---|---|
| Coach identity/auth | `src/lib/intelligenceFabric/auth/` provides actors, sessions, acceptance continuation, fail-closed validation, and default-off activation. Acceptance context explicitly grants no Coach Connect authority. | Reuse through the public auth service; do not change identity semantics. |
| Invite / QR / relationship / entitlement | `src/lib/intelligenceFabric/coachConnect/` provides opaque single-use invites, exact-scope relationships, synthetic entitlement lifecycle, central authorization, projections, and audit-safe references. | Reuse authority inputs. Do not implement billing or alter the price contract. |
| Existing coaching session | `coachConnect` currently models a non-live structured session with `DRAFT`, `READY`, `IN_PROGRESS`, and terminal states. | Do not rename or reinterpret. Add a distinct live-session aggregate and an explicit link/adapter. |
| Promotion | Existing seven-stage `PROMOTION_STAGES` already matches the packet’s promotion ladder and final append is injected, confirmation/evidence/outcome gated. | Reuse semantics; adapt reviewed live artifacts into the existing promotion boundary. |
| Business Engine | `src/lib/intelligenceFabric/runtime/` contains append/replay, reality, belief, future, intervention, and outcome logic; `src/lib/businessEngine/` contains customer contract/projection logic. | Intelligence Fabric runtime is canonical mutation/evaluation boundary; customer renderers remain protected projections. |
| Confidence Reality | Existing `createCoachingNote` fixes coach material to `COACHING_NOTE`, bounded weight, noncanonical authority, and no universal learning. | Extend additively for claim-level live-session proposals; never auto-promote. |
| Persistence | Runtime interfaces separate events and versions. `production/` supplies an injected, production-shaped Redis adapter with append-only records, OCC/idempotency, derived projections/checkpoints, quarantine, recovery, and default-off activation. | Reuse injected interfaces. Synthetic proof uses an in-memory driver; no Redis connection or migration. |
| Privacy / consent | Core consent/privacy contracts distinguish permission, relationship, and runtime authorization. Coach Connect privacy classes are narrower than the packet’s live-session classes. | Add a live-session classification map without weakening existing classes. Recording consent stays separate from transcription/extraction/evaluation/learning consent. |
| Feature flags | Coach Connect and production foundation default off, emergency-disabled, synthetic-only constrained, with all live providers/traffic disabled. | Add subordinate live-session capabilities; all default false and unable to override parent gates. |
| UI / cockpit | Existing projections are deterministic, bounded view models; no public Coach Connect React route is authorized. | Part 2 may implement domain projection contracts only; no route or UI activation. |
| Providers | No approved live audio/video/transcription provider exists. | Define provider-independent interfaces and a deterministic synthetic adapter only. |
| Tests | Focused suites exist for auth, Coach Connect, runtime, subscriber, production, Business Engine, BA/BOS-aligned fixtures. | Extend focused tests and rerun protected regressions; never claim live-provider or production proof. |
| Deployment | No public routes, production provider wiring, or live session activation is approved. | Remain inactive, internal, synthetic-only, no commit/deploy/push. |

## Architecture map

1. `LiveSessionService` establishes a session by calling existing auth and Coach Connect authority boundaries.
2. `LiveSessionAuthority` snapshots exact participants, scope, consent rules, retention, provider permissions, policy version, issue time, and expiry.
3. `MediaProviderPort` isolates connection, media, transcription, recording, failure, and teardown; V1 proof uses only `SyntheticMediaProvider`.
4. `LiveSessionEventStore` appends normalized, idempotent, sequenced events and supports replay, gap detection, and checkpoints through injected persistence.
5. `ExtractionPort` emits candidates with speaker/source-span/model/confidence/privacy provenance; it has no canonical write capability.
6. `ReviewService` versions coach corrections and preserves the original extraction.
7. `ConfidenceRealityProposalAdapter` routes accepted items first to coaching notes and explicit update proposals.
8. `BusinessEngineEvaluationPort` evaluates conflict, fit, constraint, Five Futures, One Move, current version, and confirmation policy.
9. `SubscriberConfirmationPort` records immutable accept/reject/clarify/defer history.
10. `ProjectionCoordinator` refreshes subscriber and cockpit projections from the same committed Business Engine version, atomically or visibly failed.
11. `SessionClosureService` finalizes or labels partial transcript/artifacts, commitments, unresolved work, recovery state, and completion verdict.

## Canonical contract map

Part 2 must implement repository-native validators/builders for: `CoachLiveSession`, `LiveSessionAuthority`, `SessionEvent`, `ParticipantState`, `MediaState`, granular `ConsentState`, separate `RecordingState`, `TranscriptArtifact`, `StructuredSessionArtifact`, `CoachObservation`, `CoachCommitment`, `CoachInterventionProposal`, `CoachEvidenceCandidate`, `ConfidenceRealityUpdate`, `BusinessEngineProposal`, `PromotionRecord` adapter, `SubscriberConfirmationRequest`, and `ProjectionRefresh`.

All material objects require opaque identity, exact tenant/profile/business/subscriber scope, schema/policy version, provenance, privacy class, immutable history, timestamps, and version. Raw provider payloads are references, never domain contracts. Transcript completion alone is never success.

## State-machine map

- Live session: `CREATED → AUTHORIZING → READY → CONNECTING → ACTIVE → PAUSED → CLOSING → CLOSED`, with explicit `AUTHORIZATION_FAILED`, `CONSENT_BLOCKED`, `CONNECTION_DEGRADED`, `INTERRUPTED`, `RECOVERING`, `RECOVERY_FAILED`, `CANCELLED`, and `FAILED` transitions. Every path into `READY`, `CONNECTING`, recovery, or resumed processing rechecks authority and consent.
- Artifact: `EXTRACTED → PENDING_COACH_REVIEW → COACH_ACCEPTED|COACH_EDITED|COACH_REJECTED → PENDING_ENGINE_EVALUATION → ENGINE_ACCEPTED_AS_NOTE|PENDING_SUBSCRIBER_CONFIRMATION → SUBSCRIBER_CONFIRMED|SUBSCRIBER_REJECTED → PROMOTED → SUPERSEDED`. Branches must be explicit; no ordinal stage arithmetic across mutually exclusive states.
- Commitment: `PROPOSED → ACCEPTED → ACTIVE → EVIDENCE_PENDING → COMPLETED|PARTIALLY_COMPLETED|MISSED|CANCELLED → OUTCOME_VALIDATED` where legal.
- Proposal: `DRAFT → REVIEWED → SUBMITTED → EVALUATING → ACCEPTED_CONDITIONALLY|CONFIRMATION_REQUIRED|ACCEPTED|REJECTED|DEFERRED → SUPERSEDED` where legal.
- Consent: `UNKNOWN → REQUESTED → GRANTED|RESTRICTED → REVOKED|EXPIRED`; revocation retains audit but blocks future processing and applies retention policy.

## Authority and privacy maps

Authority is claim-type routed. Current facts prioritize verified subscriber evidence; goals prioritize subscriber-stated direction; interventions combine constraint, preference, behavioral fit, validated evidence, private coach guidance, and market context. Canonical promotion requires eligible policy, provenance, confirmation, evidence, conflict resolution, and outcome history.

Live-session classifications are `SUBSCRIBER_PRIVATE`, `COACH_SHARED`, `BUSINESS_ENGINE_ELIGIBLE`, `RESTRICTED_SENSITIVE`, `REDACTED`, `LEARNING_INELIGIBLE`, and `LEARNING_CANDIDATE`. Part 2 must define a lossless map to current core/Coach Connect classifications. `LEARNING_CANDIDATE` is not permission or promotion. Raw transcript is never included in a generic Business Engine or cockpit projection. Relationship/entitlement termination revokes interactive coach access while lawful audit retention remains policy-controlled.

## Provider and persistence decisions

Provider choice remains unresolved and unnecessary for V1. Implement ports plus deterministic synthetic provider events. Recording defaults prohibited and remains distinct from transcription. No secrets, SDK, network calls, package additions, or real adapter.

Reuse the injected production event-store shape and in-memory driver. Authoritative events, projections, checkpoints, and idempotency records remain distinct. Use aggregate-scoped monotonic sequence, semantic idempotency, OCC on Business Engine version, immutable supersession, late-event checkpoint invalidation, and quarantine of corrupt records.

## Authorized Part 2 file plan

Subject to a clean recheck immediately before implementation, Part 2 may create:

- `src/lib/intelligenceFabric/coachConnect/liveSession/constants.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/stateMachines.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/provider.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/persistence.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/extraction.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/review.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/businessEngine.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/projections.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/recovery.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/service.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/index.js`
- `src/lib/intelligenceFabric/testing/inMemoryLiveSessionDriver.js`
- focused `test/intelligenceFabric.coachConnect.liveSession*.test.js`
- proof files under `lab_outputs/coach_connect_live_session_intelligence_v1/`
- campaign documentation under `docs/intelligence_fabric/`

Narrow edits may be proposed—but not assumed—to `src/lib/intelligenceFabric/coachConnect/index.js` and `src/lib/intelligenceFabric/index.js` solely for dormant exports. Any change to existing contracts, services, state machines, runtime mutation logic, Business Engine modules, UI, API, Stripe, Redis configuration, or package files requires a stop and revised human authorization.

## Protected boundaries

Protect BOS/BA canonical intelligence and renderers, Profile ID logic, scoring, Fathom role-fit, pricing/Stripe, secrets, production Redis/data, deployment, public routes, canonical Five Futures/One Move doctrine, existing auth/relationship/entitlement semantics, and unrelated UI. No broad refactor, package replacement, migration, deletion, commit, push, or live service call.

## Phase plan and gates

Execute packet Phases 1–7 in order. Each phase must produce evidence before the next begins. Gates require: no duplicate Business Engine; no coach overwrite; exact authority; idempotent session/event operations; immutable extraction/edit history; coaching notes remain noncanonical; confirmation cannot be bypassed; stale proposals re-evaluate; both projections share one canonical version; recovery is replay-safe; synthetic proof invokes no production service.

At most two bounded repair cycles per failed gate. Each repair names the finding, stays within authorized files, preserves evidence, and reruns affected and protected tests. Exhaustion produces a blocked handoff.

## Stop conditions

Stop for conflicting canonical Business Engines; unclear relationship/entitlement or confirmation policy; incompatible provider consent; undetermined privacy/retention rule; required secret/public activation/migration/protected scoring change; second source of truth; irreducible coach overwrite; unrelated architectural corruption; or exhausted bounded repair.

## Part 1 terminal verdict

`PART_1_ARCHITECTURE_GROUNDED_WITH_CONFLICTS_RESOLVED_BY_ADDITIVE_BOUNDARY`

Part 2 is structurally specified but is not authorized by this artifact-generation run. The existing non-live session model remains intact; a future implementation run must confirm this file plan and receive implementation authority.
