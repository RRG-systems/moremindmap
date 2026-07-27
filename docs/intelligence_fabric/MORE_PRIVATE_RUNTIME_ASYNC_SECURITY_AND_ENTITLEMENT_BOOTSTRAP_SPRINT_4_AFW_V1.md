# MORE Private Runtime Async Security and Entitlement Bootstrap — Sprint 4 AFW V1

Sprint:
`4 — SUBDEV1 Entitlement Bootstrap`

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_V1`

Architecture SHA-256:
`8c117ab7e40fde69536d67d43558e69dfa3d078f10eaeb0ff88105cfa9117046`

Implementation authorized by this AFW expansion: `false`

Deployment authorized: `false`

## 1. Sprint purpose

Remove the authority cycle by implementing temporary entitlement issuance
after authentication and eligibility but before private-runtime authority.
Project the entitlement into the existing private subscription response
without activating paid access or Stripe.

## 2. Dependencies

- Sprints 1–3 `COMPLETE` with receipts and hashes;
- canonical async service and developer-access facade;
- protected existing subscription entitlement semantics;
- Parts 1–3.

## 3. Exact allowlist

```text
src/lib/intelligenceFabric/coachConnect/privateRuntime/canonicalAsyncSecurityService.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/developerAccessSecurityFacade.js
src/lib/intelligenceFabric/coachConnect/privateRuntime/eligibility.js
api/internal/subscription-entitlement.js
test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.entitlement.test.js
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/sprint_receipt.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/changed_files.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/contract_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/focused_tests.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/race_failure_tests.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/protected_root_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/zero_provider_call_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/secret_scan.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/authority_order_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/temporary_entitlement_proof.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/repair_receipt_1.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/repair_receipt_2.json
lab_outputs/coach_connect_private_runtime_async_security_repair_v1/sprint_4/change_receipt.json
```

The paid entitlement branch in `subscription-entitlement.js` is protected
inside the allowed file and must remain semantically unchanged.

## 4. Prohibited files and actions

- every path outside Section 3;
- Stripe, billing, checkout, public onboarding, product runtimes, Business
  Engine, API developer-access handler, provider, deployment, package,
  environment, migration, and public UI sources;
- raw code/token persistence or logging;
- provider access, staging, commit, push, or deployment.

## 5. Contracts and schemas

Implement:

- `temporary-private-entitlement-v2`;
- service methods `issueCsrfGrant`, `issueTemporaryEntitlement`,
  `inspectTemporaryEntitlement`, and
  `evaluatePrivateRuntimeAuthority`;
- facade entitlement issue and inspection projections;
- atomic
  `CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT`;
- `READ_AUTHORITY_SNAPSHOT`;
- Promise-based private-runtime branch in
  `resolveSubscriptionEntitlement`.

Entitlement fields must assert temporary access, no billing evidence, no
Stripe creation, and no admin/operator/deployment/billing/coach/canonical
authority.

## 6. Implementation sequence

1. Verify predecessor receipts, hashes, status, and protected baseline.
2. Re-resolve current authenticated context and eligibility.
3. Issue a single-use route/method/browser/session-bound CSRF grant.
4. Apply the canonical distributed rate-limit command.
5. Compare the submitted code server-side in constant time.
6. Atomically consume CSRF and revalidate subject, session, approval, scope,
   version, epoch, health, and emergency disable.
7. Store one entitlement token hash and earliest-bound TTL with the audit
   receipt.
8. Set only the opaque secure cookie at the future handler boundary.
9. Project a temporary unpaid entitlement for private-runtime requests.
10. Preserve the existing paid branch and keep it unreachable from private
    context.
11. Run all sprint gates and emit evidence.

## 7. Focused tests

- unauthenticated `SUBDEV1` denies;
- authenticated but ineligible subject cannot attempt entitlement;
- eligibility alone grants no runtime access;
- valid ordered flow issues one temporary entitlement;
- entitlement is subject/session/browser/environment/scope/version/epoch
  bound;
- all non-subscription authority fields are false;
- private context ignores paid grant;
- no Stripe function is imported or called;
- raw code and token never enter state, log, response, or evidence;
- subscription projection waits for settled authority;
- runtime authority requires active entitlement.

## 8. Race and failure tests

- two CSRF consumes yield one winner;
- two concurrent entitlement issues yield one active outcome;
- approval revocation or epoch advance racing issuance denies;
- session rotation racing issuance denies;
- expired CSRF, wrong route/method/browser, rate-limit denial, invalid code,
  timeout, rejection, malformed result, audit failure, or outage denies;
- no paid fallback or V1 capability lookup occurs.

## 9. Sprint-local validation

- Sprint 4 focused test passes;
- Sprints 1–3 tests rerun;
- existing developer-access, subscription, and private-runtime subscription
  regressions pass;
- static order proof shows authentication, eligibility, entitlement, then
  runtime authority;
- Stripe and paid-branch semantic comparison pass;
- exact allowlist, schemas, imports, cycles, scans, and evidence pass;
- Git index remains empty and HEAD unchanged.

## 10. Protected-root comparison

Hash and compare all Part 1 protected roots. Business Engine, Subscription
Runtime implementation, Coach Connect, and Stripe roots remain byte-identical.

## 11. Zero-provider-call proof

Record zero Auth0, Redis, Upstash, database, Vercel, model, media, voice, Luna,
transcript, production-persistence, Stripe, billing-event, and deployment
calls.

## 12. Bounded repair

At most two Section 3-only repairs. Repairs cannot reorder authority, add a
paid fallback, weaken CSRF/rate limits, disclose code/token data, or touch
Stripe.

## 13. Stop conditions

Stop if:

- the cycle cannot be removed without granting eligibility runtime authority;
- `SUBDEV1` must authenticate or establish identity;
- entitlement needs Stripe, billing, or another store;
- atomic issuance cannot use the V2 command contract;
- a protected or non-allowlisted file must change;
- the second repair fails.

## 14. Evidence outputs

Create only Section 3 evidence. The authority-order proof must reject every
skip edge; the entitlement proof must show zero non-subscription authority.

## 15. Final sprint verdict options

- `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_4_COMPLETE`
- `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_4_BLOCKED`

## 16. No-deployment and no-provider statement

Sprint 4 is synthetic and offline under later authority. It does not activate
SUBDEV1 in a live environment, access Stripe or a provider, change
configuration, deploy, stage, commit, or push.
