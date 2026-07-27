# MORE Private Runtime Async Security and Entitlement Bootstrap — Sprint 6 AFW V1

Sprint:
`6 — Live Handler Composition`

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_V1`

Architecture SHA-256:
`8c117ab7e40fde69536d67d43558e69dfa3d078f10eaeb0ff88105cfa9117046`

Implementation authorized by this AFW expansion: `false`

Deployment authorized: `false`

## 1. Sprint purpose

Bind the existing internal handler exports to one source-default-off V2
composition. Every handler becomes structurally bound to a Promise-returning
operation, but remains inaccessible without a separately implemented and
approved remote adapter.

## 2. Dependencies

- Sprints 1–5 `COMPLETE` with receipts and hashes;
- complete canonical service, facade, and lifecycle contracts;
- existing private-runtime bridge and attachment ports;
- current handler behavior and safe HTTP/cookie utilities;
- Parts 1–3.

## 3. Exact allowlist

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js
api/internal/developer-access-security.js
api/internal/developer-access.js
api/internal/subscription-entitlement.js
api/internal/private-runtime-login.js
api/internal/private-runtime-callback.js
api/internal/private-runtime-session.js
api/internal/private-runtime-bootstrap.js
api/internal/private-runtime-logout.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.handlers.test.js
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/sprint_receipt.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/changed_files.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/contract_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/focused_tests.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/race_failure_tests.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/protected_root_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/zero_provider_call_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/secret_scan.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/handler_binding_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/handler_await_settlement_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/repair_receipt_1.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/repair_receipt_2.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_6/change_receipt.json
```

`developer-access-security.js` may retain named V1 helpers for existing tests.
Its default V2 handler path must not instantiate or consult the V1 store.

## 4. Prohibited files and actions

- every path outside Section 3;
- Business Engine, Subscription Runtime, Coach Connect, activation doctrine,
  provider, deployment, Stripe, public UI, package, lockfile, environment,
  migration, and CI files;
- provider-adapter registry entries or provider imports;
- source defaults that allow access;
- staging, commit, push, deployment, or Vercel inspection.

## 5. Contracts and schemas

Implement:

- `private-runtime-live-composition-v2`;
- `getPrivateRuntimeLiveCompositionV2()`;
- frozen Promise-returning `UNCONFIGURED` denial composition;
- bound operations for login, callback, session, developer access,
  subscription entitlement, bootstrap, and logout;
- exact safe handler failure mapping;
- settled-decision validation before response.

No handler receives `AsyncSecurityStatePortV2` directly.

## 6. Implementation sequence

1. Verify predecessor receipts, hashes, status, and protected baseline.
2. Implement one composition accessor with default `UNCONFIGURED` denial.
3. Preserve factory injection for isolated tests without adding a live
   provider registry.
4. Bind login to `beginPreAuth`.
5. Bind callback to the injected assertion port and
   `completeAuthentication`; default absence denies.
6. Bind developer access through `DeveloperAccessSecurityFacadeV2`.
7. Bind private subscription resolution to the facade’s settled entitlement.
8. Bind session inspection to the canonical service.
9. Bind bootstrap to runtime authority and the existing bridge.
10. Bind logout to canonical atomic revocation and safe cookie clearing.
11. Ensure every handler awaits, validates, then sends exactly one response.
12. Run focused, predecessor, product regression, and boundary gates.

## 7. Focused tests

- default login is structurally bound and denies unconfigured;
- default callback is structurally bound and denies unconfigured;
- default session is structurally bound and denies unconfigured;
- default bootstrap is structurally bound and denies unconfigured;
- default logout is structurally bound and denies unconfigured;
- default developer access has canonical subject and authority paths;
- private subscription entitlement uses V2 facade;
- no default handler imports or creates a V1 store;
- each handler awaits a controllably delayed security Promise;
- no response begins before settlement;
- rejected, malformed, or synchronous decisions deny;
- bootstrap calls the existing bridge once and discards partial attachment;
- source defaults remain off and emergency disable remains dominant.

## 8. Race and failure tests

- client disconnect during pending security decision creates no allow or
  attachment;
- two bootstrap requests do not create duplicate runtimes;
- logout racing bootstrap leaves no published attachment;
- emergency disable racing an interaction denies;
- delayed Promise, rejection, timeout, malformed result, double settlement,
  outage, and recovery state deny;
- missing assertion port or remote adapter denies without fallback;
- handler never sends two responses.

## 9. Sprint-local validation

- Sprint 6 focused test passes;
- Sprints 1–5 focused tests rerun;
- current developer-access, private-runtime, subscription, Coach Connect, and
  Live Session regressions pass;
- static await audit passes for every V2 call;
- import graph contains one composition accessor and no handler-to-adapter
  edge;
- source defaults and emergency disable pass;
- exact allowlist, schemas, cycles, scans, and evidence pass;
- Git index remains empty and HEAD unchanged.

## 10. Protected-root comparison

Compare all Part 1 protected roots. The existing private-runtime bridge,
Business Engine, Subscription Runtime, Coach Connect, deployment, and public
surfaces remain byte-identical.

## 11. Zero-provider-call proof

Record zero Auth0, Redis, Upstash, database, Vercel, persistence, model, media,
voice, Luna, transcript, Stripe, and deployment calls. The default composition
may not inspect provider environment variables or health.

## 12. Bounded repair

At most two Section 3-only repairs. Repairs cannot activate a handler, add a
provider registry, weaken await/validation ordering, introduce V1 fallback, or
change product attachment semantics.

## 13. Stop conditions

Stop if:

- any handler must call an adapter directly;
- any response can precede security settlement;
- the default composition cannot stay deny;
- a real assertion or shared-state adapter is required;
- Business Engine or either runtime must change;
- a protected or non-allowlisted file must change;
- the second repair fails.

## 14. Evidence outputs

Create only Section 3 evidence. The binding proof names all seven surfaces; the
settlement proof demonstrates delayed Promises for every response path.

## 15. Final sprint verdict options

- `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_6_COMPLETE`
- `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_6_BLOCKED`

## 16. No-deployment and no-provider statement

Sprint 6 creates source-default-off offline composition only under later
authority. It does not implement a real adapter, inspect Vercel, change
environment configuration, deploy, stage, commit, or push.
