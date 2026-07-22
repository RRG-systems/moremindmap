# MORE Campaign — Coach Connect Production Persistence and Service Wiring — Part 1 V1

Status: IMPLEMENTATION AFW — REPOSITORY GROUNDED — DEFAULT-OFF — SYNTHETIC-ONLY

## 1. Mission

Extend the completed Coach Connect Live Session Intelligence V1 domain with durable persistence ports, a production-shaped injected adapter, recovery/checkpoint wiring, and a single service composition path. This is an additive implementation plan only. It does not authorize implementation, commit, push, deployment, promotion, billing activation, live-provider use, production Redis, production traffic, public routes, or feature activation.

The runtime must remain subordinate to the existing Business Engine. Coach observations may become attributable evidence and proposals; they never become canonical mutations without subscriber confirmation.

## 2. Predecessor gate — PASS

- Repository: `/Users/rrg/.openclaw/workspace/moremindmap-live`
- Verified predecessor commit: `d783e6d50de77e668f1c2b60538b151e282dea5d`
- Commit subject: `feat coach connect live session intelligence v1`
- Focused predecessor command: `node --test test/intelligenceFabric.coachConnect.liveSession*.test.js`
- Result: 18 passed, 0 failed.
- `git diff --check`: passed.
- The existing Live Session implementation, tests, and proof directory are present.
- Unrelated untracked user files are present and are protected from staging or modification.

If this predecessor commit, its contracts, or its protected semantics materially differ at implementation time, stop before modifying code.

## 3. Repository truth

### Existing reusable production foundation

- `src/lib/intelligenceFabric/production/persistence.js` defines `ProductionEventStore`, derived stores, production envelopes, validation, and an injected `InactiveRedisRuntimeAdapter`.
- The adapter does not create a Redis connection. It delegates atomic storage operations to an injected driver.
- Event records are append-only; projections, checkpoints, and idempotency records are separate derived objects.
- `src/lib/intelligenceFabric/production/activation.js` is default-off and requires synthetic-only, allowlisted scope, explicit writes, and an open emergency gate.
- `src/lib/intelligenceFabric/production/subscriberService.js` supplies an activation-checked service pattern without creating routes.
- `src/lib/intelligenceFabric/runtime/persistence.js` contains the general event-store and durable-version-store contracts.
- The repository already uses `ioredis` and `REDIS_URL` in server-side API infrastructure. This campaign must reuse that ecosystem only through injection; it must not connect to production Redis.

### Existing Live Session surface

- `src/lib/intelligenceFabric/coachConnect/liveSession/` is the sole Live Session domain.
- `persistence.js` currently exposes an injected in-memory event-store path.
- `service.js`, `recovery.js`, state machines, review, Business Engine proposal, confirmation, and projection behavior are already tested.
- `src/lib/intelligenceFabric/testing/inMemoryLiveSessionDriver.js` is the synthetic reference driver.
- There is one Business Engine integration. No second canonical store or mutation path is permitted.

### Business Assessment placement

- `src/BusinessAssessmentVisualMap.jsx` mounts `MakeYourMapAlivePanel` as `BusinessArtifactViewer`'s `unscaledFooter`.
- `src/components/businessAssessment/MakeYourMapAlivePanel.jsx` is the production subscription conversion panel.
- `src/lib/stripe/subscriptionConversionIngress.js` defines the canonical Stripe product key and checkout ingress.
- The authorized temporary Developer Access placement is directly below this unscaled footer and its Stripe button, not on a hidden route or alternate screen.

### Developer unlock conflict

The current client is a Vite browser surface. A literal or equivalent secret in client code is extractable. The repository has no grounded private server validator that can be used without adding or behaviorally changing an API route. The campaign forbids public-route changes. Therefore Phase 6 must stop unless the human supplies a separately authorized, server-side, non-public validation boundary. `SUBDEV1`, its hash, or a reversible equivalent must never enter a client bundle, fixture, proof artifact, log, or telemetry record.

## 4. Invariants

1. Existing Live Session events remain authoritative and append-only.
2. Durable storage is injected; domain modules never import Redis or read production credentials.
3. Every key is tenant-, profile-, business-, subscription-, and session-scoped as applicable.
4. Atomic append enforces expected sequence, command idempotency, semantic hash, and event integrity.
5. Checkpoints and projections are derived and rebuildable from accepted events.
6. Recovery never restores ACTIVE state until replay and checkpoint persistence both succeed.
7. Failed replay, checkpoint, or provider teardown preserves unresolved work and attributable operator evidence.
8. Subscriber rejection and every failure path produce zero canonical Business Engine appends.
9. Coach actors cannot confirm, promote, or mutate canonical Business Engine state.
10. No second Business Engine, confirmation store, or projection authority is created.
11. All new flags are default-off, synthetic-only, allowlist-bound, and emergency-disabled.
12. No production Redis, Stripe mutation, live provider/model, production persistence, public route, or traffic is invoked.

## 5. Authorized additive file plan

Implementation may touch only the following code/test surfaces unless a stop-and-review explicitly expands the plan:

### New domain wiring

- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/ports.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/adapter.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/checkpointReplay.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/businessEngineStore.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/projectionStore.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/serviceRegistry.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/service.js`
- `src/lib/intelligenceFabric/coachConnect/liveSession/durable/index.js`
- `src/lib/intelligenceFabric/testing/inMemoryDurableLiveSessionDriver.js`

### Narrow dormant exports

- `src/lib/intelligenceFabric/coachConnect/liveSession/index.js`
- `src/lib/intelligenceFabric/coachConnect/index.js`
- `src/lib/intelligenceFabric/index.js`

Exports may expose the dormant durable module only. They may not activate it or alter existing behavior.

### Tests

- `test/intelligenceFabric.coachConnect.liveSession.durable.contracts.test.js`
- `test/intelligenceFabric.coachConnect.liveSession.durable.persistence.test.js`
- `test/intelligenceFabric.coachConnect.liveSession.durable.recovery.test.js`
- `test/intelligenceFabric.coachConnect.liveSession.durable.service.test.js`
- `test/intelligenceFabric.coachConnect.liveSession.durable.e2e.test.js`

### Conditional Phase 6 UI files — not authorized until the server-side gate is resolved

- `src/components/businessAssessment/DeveloperAccessPanel.jsx` (new)
- `src/BusinessAssessmentVisualMap.jsx` (narrow placement only)
- A server-side validation module/path must be separately identified and authorized before either UI file may be changed.

No literal unlock value may appear in either client file. No new or modified public API route is authorized by this AFW.

### Proof directory

- `lab_outputs/coach_connect_production_persistence_service_wiring_v1/`

Only evidence created by the implementation campaign may be added there.

## 6. Protected surfaces

Behavioral edits to the existing Live Session domain, Business Engine contracts/scoring, canonical profile storage, Stripe code, Redis helpers, production activation defaults, public routes, live providers/models, billing, and unrelated UI are prohibited. If an authorized additive adapter cannot compose without such an edit, stop.

## 7. Durable object model

The adapter must persist and validate these classes independently:

- immutable Live Session event envelopes;
- idempotency/command receipts;
- replay checkpoints with last accepted sequence and event hash;
- rebuildable session and projection snapshots;
- attributable failure artifacts and unresolved-work markers;
- Business Engine proposal records;
- subscriber confirmation records;
- promotion receipts that point to the one canonical append result.

Each record requires an explicit schema version, scope, object/version identity, correlation and causation references, integrity hash, recorded time, and privacy classification. Transcript/media payloads must use the existing privacy and retention policy; unresolved policy is a stop condition.

## 8. Migration doctrine

Migration is synthetic dry-run only. It inventories compatible in-memory state, converts it deterministically, writes only to the injected synthetic driver, replays from zero, compares hashes/projections, and produces a rollback plan. It may not read or write production data. The production migration flag stays false.

## 9. Phase gates

Execute the eight phases in Part 2 in order. Each gate must pass before advancement. A failed gate permits at most two bounded repairs within the authorized files. Exhaustion, scope expansion, credentials, live services, schema ambiguity, privacy ambiguity, or authority drift requires stop-and-report.

## 10. Expansion verdict

`AFW_EXPANSION_READY_WITH_PHASE_6_BLOCKER`

Parts 1–5, 7, and 8 can be implemented synthetically under later authorization. Phase 6 is intentionally blocked until a safe server-side, non-public validator is separately grounded and authorized. This does not authorize implementation.
