# MORE Private Runtime Async Security and Entitlement Bootstrap — Sprint 3 AFW V1

Sprint:
`3 — Canonical Subject and Private-Test Eligibility`

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_V1`

Architecture SHA-256:
`8c117ab7e40fde69536d67d43558e69dfa3d078f10eaeb0ff88105cfa9117046`

Implementation authorized by this AFW expansion: `false`

Deployment authorized: `false`

## 1. Sprint purpose

Implement the canonical async security service’s authenticated-context,
canonical-subject, and private-test eligibility decisions. Resolve only a
pre-existing one-to-one mapping and ensure eligibility grants no runtime
authority.

## 2. Dependencies

- Sprint 1 and Sprint 2 `COMPLETE` verdicts and hashed receipts;
- V2 port, schemas, synthetic adapter, and developer-access facade;
- protected existing subject-binding contracts;
- Parts 1–3.

## 3. Exact allowlist

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/canonicalAsyncSecurityService.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/eligibility.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.adversarial.test.js
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/sprint_receipt.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/changed_files.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/contract_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/focused_tests.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/race_failure_tests.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/protected_root_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/zero_provider_call_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/secret_scan.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/canonical_subject_uniqueness_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/private_test_eligibility_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/repair_receipt_1.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/repair_receipt_2.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_3/change_receipt.json
```

## 4. Prohibited files and actions

- every path outside Section 3;
- existing subject-binding/session contracts, both V1 stores, API handlers,
  product runtimes, Business Engine, deployment, provider, Stripe, public UI,
  environment, package, and migration sources;
- canonical enrollment from login or runtime code;
- provider access, staging, commit, push, or deployment.

## 5. Contracts and schemas

Implement:

- `private-runtime-canonical-security-service-v2`;
- `canonical-subject-decision-v2`;
- `private-test-approval-v1`;
- `private-test-bootstrap-eligibility-v1`;
- service methods `describe`, `health`,
  `resolveAuthenticatedContext`, and
  `evaluatePrivateTestEligibility`;
- exact failure codes for missing, ambiguous, stale, disabled, recovery,
  wrong-scope, wrong-environment, unhealthy, expired, and emergency-disabled
  cases.

Eligibility must set runtime and all non-subscription authority fields false.

## 6. Implementation sequence

1. Verify predecessor receipts, hashes, status, and protected baseline.
2. Validate the injected V2 port and settled service results.
3. Resolve the authenticated session by hashed token.
4. query one immutable external-subject mapping and exact scope.
5. Deny missing, ambiguous, stale, disabled, deleted, or recovery-pending
   mappings; never bind or enroll.
6. Require exact activation plus one active private-test approval.
7. Check health, epoch, expiry, and emergency disable.
8. Produce privacy-safe subject and eligibility decisions.
9. Export only the reviewed V2 service and eligibility contracts.
10. Run focused, predecessor, race, failure, and boundary gates.

## 7. Focused tests

- authenticated active subject and exact scope resolve once;
- unknown subject denies without enrollment;
- ambiguous external subject or scope denies;
- email, name, Profile ID, URL, request body, browser value, `SUBDEV1`, and
  developer capability cannot establish identity;
- configuration without approval denies;
- approval without configuration denies;
- expired, revoked, wrong-purpose, wrong-environment, wrong-subject, or
  wrong-scope approval denies;
- eligibility permits only a code attempt;
- eligibility cannot attach Business Engine, Subscription Runtime, or Coach
  Connect;
- receipts contain only opaque references and hashes.

## 8. Race and failure tests

- two subjects competing for one scope produce at most one valid mapping;
- one subject exposed to two scopes denies ambiguity;
- approval revocation racing eligibility yields no runtime authority;
- epoch advance racing eligibility denies stale result;
- Promise rejection, timeout, malformed mapping, non-authoritative read,
  invalid server time, outage, partition, and recovery deny;
- no V1 lookup or local-cache authorization occurs.

## 9. Sprint-local validation

- Sprint 3 focused test passes;
- Sprints 1–2 tests rerun;
- existing subject-binding and private-runtime subject regressions pass;
- static scan proves no `BIND_APPROVED_CANONICAL_SUBJECT` call from runtime
  methods;
- exact allowlist, schemas, exports, cycles, secrets, and evidence pass;
- Git index remains empty and HEAD unchanged.

## 10. Protected-root comparison

Hash and compare every Part 1 protected root. Existing
`productionSecurity/subjectBinding.js` is consumed unchanged and must be
byte-identical.

## 11. Zero-provider-call proof

Record zero identity-provider, Redis, Upstash, database, Vercel, persistence,
model, media, voice, Luna, transcript, Stripe, and deployment calls. Only
opaque synthetic assertions and mappings are permitted.

## 12. Bounded repair

At most two Section 3-only repairs with numbered receipts. Repairs cannot add
auto-enrollment, loosen ambiguity denial, create another subject registry, or
edit protected identity contracts.

## 13. Stop conditions

Stop if:

- canonical mapping cannot be resolved without enrollment;
- a second identity or subject authority is required;
- eligibility needs entitlement or runtime authority;
- a provider credential or live assertion adapter is required;
- protected or non-allowlisted files must change;
- the second repair fails.

## 14. Evidence outputs

Create only Section 3 evidence. The uniqueness proof must cover both mapping
directions; the eligibility proof must show every authority field false.

## 15. Final sprint verdict options

- `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_3_COMPLETE`
- `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_3_BLOCKED`

## 16. No-deployment and no-provider statement

Sprint 3 uses synthetic verified assertions and approvals only. It does not
implement Auth0 or another provider, access credentials, enroll a live
subject, deploy, stage, commit, or push.
