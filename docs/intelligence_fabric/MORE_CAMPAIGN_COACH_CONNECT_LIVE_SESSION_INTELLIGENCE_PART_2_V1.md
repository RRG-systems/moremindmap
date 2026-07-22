# Coach Connect Live Session Intelligence V1 — Part 2 AFW

Artifact: `MORE_CAMPAIGN_COACH_CONNECT_LIVE_SESSION_INTELLIGENCE_PART_2_V1`
Authority: implementation workflow specification only
Execution prerequisite: explicit implementation authority plus approved Part 1 findings/file plan
Commit, push, deploy, public activation: **NOT AUTHORIZED**

## Objective and entry gate

Implement a dormant, synthetic-only Live Session Intelligence aggregate that turns a consent-governed coaching conversation into reviewed proposals for the one authoritative Business Engine. Do not begin unless Part 1 is approved, repository status is captured, its findings remain true, and every intended path is on its authorized list. If repository truth drifted, stop and revise Part 1; do not improvise.

## Global invariants

- Coach speech and model output are candidates, never truth or mutation authority.
- Existing auth, relationship, entitlement, promotion, Business Engine, Five Futures, and One Move semantics remain authoritative.
- All authority checks use exact actor and subscriber scope and fail closed when missing, stale, expired, revoked, or ambiguous.
- Participation, transcription, recording, extraction, coach sharing, Business Engine evaluation, and future-learning consent are separate.
- Recording defaults prohibited. Raw provider payloads and transcripts never enter generic projections, telemetry, or logs.
- Events are append-only; corrections and edits supersede rather than overwrite.
- All live-session flags default false beneath existing emergency, synthetic-only, live-provider, and production-traffic gates.
- No provider SDK, secret, Redis connection, migration, route, React surface, billing change, live model, or live media call.

## Authorized files

Only the additive paths and two optional export files listed in approved Part 1 may change. Before writing, resolve each path, verify it does not contain unrelated user work, and record a changed-files baseline. Treat all other files as read-only. If an existing module must change for behavior rather than a dormant export, stop.

## Phase 1 — contracts, reducers, and dormant activation

Implement closed constants and strict validators for every Part 1 contract. Preserve packet field semantics even where repository naming differs. Each validator rejects unknown/unsafe privacy escalation, raw secrets/provider payloads, missing scope/provenance/version, invalid timestamps, cross-scope links, and false canonical authority.

Implement explicit transition tables for session, artifact, commitment, proposal, consent, participant, media, recording, transcript, confirmation, projection, and recovery lifecycles. Illegal/skipped transitions fail without mutation. Revocation and terminal states are irreversible except policy-defined recovery paths.

Implement subordinate flags for session establishment, provider adapter, transcription, extraction, review, engine evaluation, confirmation, projection refresh, and synthetic proof. Defaults: all false; `synthetic_only: true`; live media/model/traffic false; emergency disable true. Parent Coach Connect and production-foundation decisions always win.

Gate: contract/state tests cover valid objects, every required field/class, illegal transitions, authority escalation, and activation permutations.

## Phase 2 — connect runtime

Implement session creation with opaque `session_id`, exact scope, coach/subscriber/relationship/entitlement/Business Engine binding, policy version, privacy, idempotency, and provenance. Call existing auth and Coach Connect authority services; never duplicate their truth.

Create an immutable `LiveSessionAuthority` snapshot with expiry and recheck triggers. Authorization occurs at create, ready, connect, reconnect/recover, transcription/extraction start, evaluation, confirmation dispatch, promotion, projection read, and close. Stale snapshots fail closed.

Define `MediaProviderPort`: create session, issue access reference, read connection status, normalize participant/media/transcript/recording/failure events, and teardown. Implement a deterministic synthetic adapter only. Provider tokens remain outside persisted domain objects.

Append normalized `SessionEvent` records with unique ID, aggregate-monotonic sequence, causal/correlation IDs, semantic idempotency, privacy, schema version, and payload reference. Detect duplicates and gaps; persist explicit partial/recovery state.

Gate: unauthorized/wrong-scope/expired/revoked sessions fail; duplicate create is idempotent; connection loss/reconnect replays without duplicate events; no extraction or canonical write occurs.

## Phase 3 — intelligence capture and coach review

Transcript segments preserve speaker attribution, source time, confidence, redaction/privacy state, provider reference, finalization and version. Never invent missing segments. Ambiguous speaker, partial provider delivery, contradictions, unsupported causality, third-party private data, unsafe regulated claims, and sovereignty-overriding instructions are flagged or rejected.

The extraction port receives minimized, authorized references and returns typed candidates: fact claim, goal, observation, recommendation, commitment, contradiction, missing evidence, or intervention. Every candidate stores speaker, source span, direct-statement/inference class, extractor/version, confidence, privacy, and provenance. Output has `canonical_authority: false`.

Coach review supports accept, reject, and edit. An edit creates a reviewed successor linked to the immutable extracted original. Submission requires explicit acceptance and actor/timestamp. Abandoned review remains visible and blocks closure where policy requires review.

Gate: every item is attributable; original extraction remains unchanged; no candidate becomes fact or canonical state; partial transcript stays visibly partial.

## Phase 4 — Business Engine proposal path

Map accepted material first to `COACHING_NOTES` or a `ConfidenceRealityUpdate` proposal. Preserve evidence class, confidence, conflicts, missing evidence, source artifacts, and privacy. Never map coach language directly to `KNOWN`.

Construct `BusinessEngineProposal` against an explicit current Business Engine version. Evaluation records unchanged fields, proposed changes, conflict analysis, behavioral fit, model alignment, primary constraint, current Five Futures/One Move effects, confirmation requirements, policy/version, and explanation.

Use claim-type authority routing. A stale version yields `DEFERRED`/re-evaluation, never last-write-wins. Subscriber confirmation presents the exact claim/change, source, reasoning, consequences, expiry, and accept/reject/clarify/defer choices. Nonresponse is preserved without coercion. Coach cannot answer for the subscriber.

Adapt only eligible, confirmed, supported, outcome-validated proposals to the existing promotion ladder and injected canonical append. Use immutable `PromotionRecord`; prevent duplicate promotion by semantic idempotency and OCC. Five Futures and One Move recompute from canonical inputs only.

Gate: confirmation bypass, stage skip, unsupported promotion, coach self-confirmation, stale overwrite, and duplicate append all fail closed.

## Phase 5 — projection refresh

Refresh coach and subscriber projections from the identical committed Business Engine ID/version. Include previous/current/trend/reason/evidence/last-updated without raw transcript or restricted content. Write a versioned `ProjectionRefresh` record. Publish neither view until required projections are consistent; on partial failure preserve the previous visible version and a recoverable failure record.

Gate: both views identify the same canonical version; neither stores alternate truth; refresh retry is idempotent; protected customer renderers are untouched.

## Phase 6 — closure and recovery

Implement interruption recovery from the last valid checkpoint; gap/duplicate handling; mid-session consent revocation; provider/transcript/extraction failure; review abandonment; confirmation timeout; OCC conflict; projection failure; closure failure; and retention-policy failure.

Consent revocation stops future affected processing and triggers configured retention handling without erasing audit. Session closure stops synthetic media, finalizes or labels partial artifacts, preserves unresolved items, commitments and next evidence requests, and records closure reason/recovery/completion verdict. Never mark `CLOSED` while policy-required work is unresolved; use an explicit incomplete/failure outcome.

Gate: deterministic replay creates no duplicate canonical update; partial data remains partial; unresolved sessions remain visible; operator evidence contains references/reason codes, not sensitive content.

## Phase 7 — synthetic proof implementation

Build a deterministic scenario with authorized coach/subscriber, active relationship/entitlement, granular consent, sequenced provider events, attributable transcript, structured candidates, immutable coach review, Confidence Reality proposal, Business Engine evaluation, subscriber confirmation, evidence/outcome-gated append, consistent projections, and closure.

Also build scenarios for unauthorized start, stale authority, consent refusal/revocation, recording prohibition, wrong scope, provider failure, disconnect/reconnect, sequence gap, duplicate event/segment/promotion, partial transcript, ambiguous speaker, rejected extraction, subscriber rejection/nonresponse, stale proposal, append conflict, projection failure/retry, replay after crash, and retention failure.

## Required test commands

Determine exact file globs after implementation, then record literal commands and counts. Minimum gates:

1. New contract, state-machine, service, provider, extraction/review, engine, projection, recovery, and E2E tests.
2. `node --test test/intelligenceFabric.coachConnect*.test.js`
3. `node --test test/intelligenceFabric.auth*.test.js`
4. `node --test test/intelligenceFabric.production*.test.js`
5. `node --test test/intelligenceFabric.runtime*.test.js test/intelligenceFabric.predictive*.test.js test/intelligenceFabric.subscriber*.test.js`
6. Existing Business Engine, BA, and BOS fixture suites identified by the refreshed Part 1 inventory.
7. Focused ESLint on changed JS/tests, `npm run build`, `git diff --check`, JSON parse, export/import, circular-dependency, privacy-leak, activation, secret, provider-network, public-route, and protected-root scans.

Do not reuse historical counts as current proof. Record actual counts and distinguish identical-validator evidence from independently rerun suites.

## Bounded repair

Allow at most two repair cycles per failed gate. A repair note must include exact failure, root cause, files changed, why within authority, affected retest, protected regression, and outcome. Never weaken assertions, flags, privacy, confirmation, or authority to make a test pass. After two failed cycles, stop with `COACH_CONNECT_LIVE_SESSION_INTELLIGENCE_BLOCKED` or `FAILED` and preserve evidence.

## Part 2 deliverables

Produce implementation report, contract/state/authority/privacy inventories, failure taxonomy, test manifest/results, changed-files inventory, protected-root verification, synthetic and failed traces, replay trace, before/after diffs, artifact/evidence indexes, executive handoff, and AI handoff. These are proof requirements, not permission to create them during this architecture-only run.

## Part 2 terminal verdict

Use only:

- `PART_2_IMPLEMENTATION_COMPLETE_WITH_LIMITS`
- `PART_2_IMPLEMENTATION_COMPLETE`
- `PART_2_IMPLEMENTATION_BLOCKED`
- `PART_2_IMPLEMENTATION_FAILED`

Completion means inactive synthetic implementation only. It does not authorize commit, push, deployment, production data, provider integration, public access, billing, or activation.
