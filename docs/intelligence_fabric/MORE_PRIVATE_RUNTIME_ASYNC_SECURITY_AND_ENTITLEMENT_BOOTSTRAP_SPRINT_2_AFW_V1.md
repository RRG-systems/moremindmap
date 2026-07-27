# MORE Private Runtime Async Security and Entitlement Bootstrap — Sprint 2 AFW V1

Sprint:
`2 — Developer-Access Security Unification`

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_V1`

Architecture SHA-256:
`8c117ab7e40fde69536d67d43558e69dfa3d078f10eaeb0ff88105cfa9117046`

Implementation authorized by this AFW expansion: `false`

Deployment authorized: `false`

## 1. Sprint purpose

Implement one developer-access facade that delegates every security decision
to an injected `CanonicalAsyncSecurityServiceV2`. The facade preserves safe
route and cookie projections but owns no store and creates no second truth.

## 2. Dependencies

- Sprint 1 verdict `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_1_COMPLETE`;
- exact Sprint 1 receipt and hashes;
- Parts 1–3;
- V2 contracts and synthetic adapter;
- current developer-access route and security-helper behavior as read-only
  grounding.

## 3. Exact allowlist

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/developerAccessSecurityFacade.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.developerAccess.test.js
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/sprint_receipt.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/changed_files.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/contract_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/focused_tests.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/race_failure_tests.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/protected_root_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/zero_provider_call_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/secret_scan.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/canonical_security_path_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/developer_access_facade_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/repair_receipt_1.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/repair_receipt_2.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_2/change_receipt.json
```

No current API handler changes in Sprint 2. Default handler binding belongs to
Sprint 6.

## 4. Prohibited files and actions

- every path outside Section 3;
- both V1 stores and ports;
- all API handlers;
- canonical subject, session, Business Engine, Subscription Runtime, Coach
  Connect, provider, deployment, Stripe, public UI, package, and environment
  files;
- provider or credential access, staging, commit, push, or deployment.

## 5. Contracts and schemas

Implement Part 2 `DeveloperAccessSecurityFacadeV2`:

```text
describe
resolveAuthenticatedContext
evaluateBootstrapEligibility
issueCsrf
issueEntitlement
inspectEntitlement
revokeEntitlement
```

Every method returns a Promise and delegates to the injected canonical service.
The facade stores no capability, CSRF, replay, rate-limit, audit, epoch, or
revocation record.

## 6. Implementation sequence

1. Verify Sprint 1 receipt, architecture hash, status, and protected baseline.
2. Define strict injected-service validation.
3. Implement Promise-only facade methods and safe result projection.
4. Reject absent, V1-shaped, synchronous, or wrong-version services.
5. Prove code values are passed only to canonical service verification.
6. Prove no default store, adapter, provider, or network import exists.
7. Run focused, predecessor, race, failure, and boundary gates.
8. Emit Sprint 2 evidence.

## 7. Focused tests

- all facade methods are Promise-native;
- GET projection requests CSRF and entitlement inspection from one service;
- POST requests eligibility, CSRF consumption, rate limit, and entitlement
  issuance through one service path;
- DELETE requests canonical revocation;
- facade has no store constructor or persistence method;
- safe cookie/response projection excludes internal authority data;
- raw `SUBDEV1`, token, cookie, and identity never enter logs or evidence;
- synchronous fake service rejects;
- V1 store cannot satisfy the facade dependency.

## 8. Race and failure tests

- two POSTs cannot create independent facade capabilities;
- two DELETEs remain idempotent through canonical service results;
- CSRF replay, rate limit, service rejection, timeout, malformed decision,
  denial-audit failure, and outage all deny;
- a delayed Promise cannot be mistaken for an allow decision;
- no response projection occurs before settlement.

## 9. Sprint-local validation

- Sprint 2 focused test passes;
- Sprint 1 focused and V1 security regressions pass;
- no facade import reaches either V1 store;
- no state mutation exists outside the injected service;
- exact changed-file allowlist and JSON schemas pass;
- import/export, cycles, secret scan, and sensitive-content scan pass;
- Git index remains empty and HEAD unchanged.

## 10. Protected-root comparison

Compare the exact Part 1 protected roots before and after. Any byte difference
blocks Sprint 2, regardless of focused test results.

## 11. Zero-provider-call proof

Record zero Auth0, Redis, Upstash, database, Vercel, model, media, voice, Luna,
transcript, production-persistence, Stripe, and deployment calls. The facade
must have no provider SDK, credential, environment, or network dependency.

## 12. Bounded repair

At most two Section 3-only repairs with numbered receipts. Repairs cannot add a
store, change V2 contracts, weaken response safety, or edit API handlers.

## 13. Stop conditions

Stop if:

- developer access needs a separate record or security decision;
- safe behavior cannot be projected from the canonical service;
- a synchronous/V1 dependency is required;
- API wiring or a provider is required to test the facade;
- a protected or non-allowlisted file must change;
- the second repair fails.

## 14. Evidence outputs

Create only Section 3 evidence. Prove one canonical decision path and zero
independent facade state.

## 15. Final sprint verdict options

- `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_2_COMPLETE`
- `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_2_BLOCKED`

## 16. No-deployment and no-provider statement

Sprint 2 implements only an offline facade under later authority. It performs
no provider adapter work, credentials, environment changes, deployment,
staging, commit, or push.
