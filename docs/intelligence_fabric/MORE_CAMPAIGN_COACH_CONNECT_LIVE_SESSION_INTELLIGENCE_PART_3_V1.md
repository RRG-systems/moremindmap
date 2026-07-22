# Coach Connect Live Session Intelligence V1 — Part 3 AFW

Artifact: `MORE_CAMPAIGN_COACH_CONNECT_LIVE_SESSION_INTELLIGENCE_PART_3_V1`
Authority: validation and handoff workflow specification only
Deployment and production activation: **NOT AUTHORIZED**

## Objective and prerequisites

Independently validate the implementation authorized by approved Part 1 and completed Part 2. Part 3 may test, inspect, and produce proof artifacts; it may not expand implementation scope. Enter only with Part 1 repository findings/file authorization, Part 2 changed-files inventory and terminal verdict, and a captured working-tree baseline. If either dependency is absent, inconsistent, or blocked, stop.

## Evidence rules

- Repository code, literal command output, deterministic traces, and machine-readable artifacts are evidence.
- Headings, plans, mocks without execution, historical counts, and assertions inside reports are not execution proof.
- Synthetic proof does not establish live media/model/provider, Redis, scale, security, legal/privacy compliance, deployment, or production readiness.
- Every claimed pass cites a command, exit status, test count where available, and artifact path.
- Sensitive content, raw tokens, secrets, full IDs, and transcript text are excluded; use opaque references, hashes, lengths, or suffixes.
- No rerun after a terminal failure beyond Part 2’s remaining bounded-repair allowance.

## Validation sequence

### 1. Preflight and scope

Record repository path, branch/HEAD when available, `git status --short`, Part 1 authorized paths, Part 2 changed files, and pre-existing unrelated work. Fail if changed implementation files exceed authority or protected roots changed without explicit approval. Verify no package, route, deployment, Stripe, production Redis, scoring, renderer, or secret file changed.

### 2. Static architecture proof

Inventory all required contracts, fields, validators, state machines, exports, flags, provider ports, persistence boundaries, and error codes. Prove:

- one Business Engine identity and injected canonical append;
- no coach canonical-write method;
- no provider-specific domain event names;
- no raw payload/transcript in projections, logs, telemetry, or evidence files;
- granular consent and separate recording state;
- default-off subordinate flags and parent-gate dominance;
- append-only/supersession behavior, OCC, schema/policy/model versions;
- no live provider SDK, secrets, network calls, public routes, or migrations.

### 3. Contract and state-machine proof

Run valid/invalid contract vectors and enumerate every legal edge. Test every prohibited skip, terminal transition, recovery path, expiry boundary, revocation, wrong scope, corrupt record, and unsafe privacy mapping. Verify edits/supersession preserve originals and revocation preserves audit.

### 4. Authorization and privacy proof

Test valid authority plus missing/wrong/expired/revoked coach, subscriber, relationship, entitlement, consent, scope, action, purpose, manifest, policy, and replay token. Demonstrate reauthorization at every critical transition.

Test unauthorized projection access, revoked access, raw transcript leakage, redaction, restricted data, learning-ineligible data, third-party data, generic Business Engine projection exclusion, and retention failure. `LEARNING_CANDIDATE` must remain noncanonical and unshared absent independent policy.

### 5. Idempotency, concurrency, and replay proof

Test duplicate create, provider event, segment, extraction command, review submission, confirmation, promotion, canonical append, and refresh. Test semantic collision under reused idempotency key. Test simultaneous proposals, stale Business Engine version, refresh conflict, review during subscriber update, crash after append/before checkpoint, late-effective event, and correction/supersession targeting checkpointed history.

Deterministic replay must reproduce state hashes and create zero duplicate canonical promotions.

### 6. Intelligence behavior proof

Use synthetic content references to distinguish observation, fact claim, goal, recommendation, commitment, contradiction, missing evidence, and inference. Test ambiguous speaker, insufficient context, contradictory spans, unsupported causality, unsafe regulated claims, sovereignty override, and extraction failure. Confirm source-span/speaker/version/confidence/privacy provenance and immutable original/reviewed successor.

### 7. End-to-end traces

Produce a machine-readable happy-path trace for:

`authority → consent → connect → normalized events → transcript → extraction → coach review → coaching note/proposal → engine evaluation → subscriber confirmation → evidence/outcome → canonical append → shared-version projections → closure`

Produce adversarial/failure traces for authorization denial, consent block/revocation, disconnect/reconnect, provider/transcript partial failure, sequence gap, duplicate, rejected extraction, rejected/deferred/timed-out confirmation, stale proposal, projection failure/retry, replay, and closure with unresolved work.

Each trace includes input references, state transitions, event sequence, authority decisions, expected/actual result, canonical append count, Business Engine version, projection versions, unresolved items, and final session verdict.

### 8. Before/after proof

For one accepted path and one rejected path, create redacted diffs for Business Engine, Confidence Reality, subscriber projection, and coach projection. Accepted-path proof must answer all fifteen packet questions: what changed; before/now; proposer; evidence/contradiction; reviewer; confirmation requirement/result; promotion policy; Business Engine version; Five Futures/One Move response; and future validating/falsifying outcome. Rejected path must prove no canonical change.

### 9. Regression and build proof

Run the literal Part 2 commands after verifying globs. Record actual current counts. Required families: new live-session tests; all Coach Connect; auth; production foundation; durable/runtime/predictive/subscriber Intelligence Fabric; Business Engine; relevant BA/BOS fixtures; focused lint; build; diff check; JSON parse; exports; cycle scan; privacy/activation/secret/provider/public-route scans.

Build warnings must be reported, not silently ignored. Any test not run is `NOT PROVEN`, never inferred from a similar validator.

### 10. Failure recovery and bounded repair

If a gate fails, first classify `IMPLEMENTATION_DEFECT`, `TEST_DEFECT`, `ENVIRONMENT_LIMIT`, `POLICY_ABSENCE`, `PROTECTED_BOUNDARY`, or `UNRELATED_CORRUPTION`. Use only the repair cycles still available under Part 2’s two-cycle-per-gate limit. Preserve the first failure, repair diff, and rerun output. Stop when the allowance is exhausted or the fix needs new authority.

## Required artifacts

Under `lab_outputs/coach_connect_live_session_intelligence_v1/`, require:

- `architecture_report.md`
- `repository_grounding_report.md`
- `contract_inventory.json`
- `state_machine_inventory.json`
- `authority_matrix.json`
- `privacy_matrix.json`
- `failure_taxonomy.json`
- `test_manifest.json`
- `test_results.json`
- `synthetic_session_trace.json`
- `failed_session_trace.json`
- `replay_trace.json`
- `business_engine_before_after.json`
- `confidence_reality_before_after.json`
- `projection_before_after.json`
- `protected_root_verification.json`
- `changed_files.json`
- `evidence_manifest.json`
- `artifact_index.json`
- `executive_handoff.md`
- `ai_handoff.json`
- `final_verdict.json`

Every JSON file must parse, use stable artifact/schema identifiers, and reference rather than duplicate sensitive evidence. The evidence manifest records SHA-256, producer command/process, and claim supported.

## Acceptance checklist

- Authorized session succeeds; unauthorized/stale authority fails closed.
- Consent and recording distinctions are enforced, including mid-session revocation.
- Event order, gap, duplicate, checkpoint, crash, and replay behavior are proven.
- Transcript is attributable/partial-aware; extraction is proposal-only; review preserves originals.
- Coach items enter coaching notes or governed proposals, never `KNOWN` automatically.
- Confirmation cannot be bypassed; stale proposals cannot overwrite; one canonical append occurs.
- Both projections derive from the same Business Engine version; partial refresh is not exposed.
- Closure preserves commitments, unresolved items, recovery, and honest verdict.
- No protected root, production service, secret, migration, deployment, commit, push, or public activation was touched.

## Handoff contents

The executive handoff summarizes outcome, limits, safety posture, and decision needed. The AI handoff identifies exact repository state, implemented modules, flags, commands, failures/repairs, remaining work, prohibited actions, and next authorized step. Neither may claim production readiness or recommend activation without a separate campaign, provider/legal/privacy/security review, secrets plan, production persistence validation, and human approval.

## Final verdict

Use exactly one campaign verdict:

- `COACH_CONNECT_LIVE_SESSION_INTELLIGENCE_COMPLETE_WITH_LIMITS`
- `COACH_CONNECT_LIVE_SESSION_INTELLIGENCE_COMPLETE`
- `COACH_CONNECT_LIVE_SESSION_INTELLIGENCE_BLOCKED`
- `COACH_CONNECT_LIVE_SESSION_INTELLIGENCE_FAILED`

`COMPLETE` still means synthetic, inactive implementation and **does not authorize deployment**. `COMPLETE_WITH_LIMITS` enumerates every unproven or deferred boundary. Architecture-document generation alone must not use an implementation-complete verdict.
