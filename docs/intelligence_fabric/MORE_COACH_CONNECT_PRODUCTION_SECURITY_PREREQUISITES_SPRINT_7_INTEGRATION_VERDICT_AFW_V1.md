# Coach Connect Production Security Prerequisites — Sprint 7 AFW V1

Status: pre-authored architecture work frame; implementation not authorized.

## 1. Outcome

Revalidate every cross-sprint dependency, replay the threat model, run the full
regression and evidence plan, and issue one honest production-prerequisite
verdict. This sprint cannot fill an unresolved authority decision or convert
synthetic proof into production certification.

## 2. Entry state

Sprints 1–6 must each provide `COMPLETE`, an explicit blocker, or `FAILED`,
with authority records, versioned contracts, changed-file inventories, tests,
attack results, repair receipts, and no-production-action proof.

The decision register must cover:

- `SUBSCRIBER_AUTHORITY_SOURCE`
- `SUBSCRIBER_SESSION_OWNER`
- `SHARED_STATE_PLATFORM`
- `RETENTION_POLICY_AUTHORITY`
- `TRANSCRIPT_BACKING_STORE`
- `BACKUP_RESTORE_HORIZON`
- `HISTORICAL_ERASURE_STRATEGY`
- `PRODUCTION_HOSTING_TRUST`
- `HSTS_DIRECTIVES`
- `OPERATOR_IDENTITY_AUTHORITY`
- `OPERATOR_ENTITLEMENT_POLICY`

Any unresolved required decision blocks the success verdict.

The authoritative source is
`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`.
Its current rows are `RECOMMENDED_PENDING_HUMAN_DECISION`; recommendation is
not approval. Sprint 7 must validate human choice, approver, approval date,
decision-specific attachments, packet hash, and explicit `APPROVED` status for
every mandatory row. `REJECTED` or `DEFERRED` is carried as a blocker. Sprint 7
cannot issue `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_COMPLETE` while
any row is missing, deferred, rejected, incomplete, or merely recommended.

## 3. Integration dependency graph

```text
subscriber subject -> session elevation -> developer capability enforcement
shared state -> replay/rate/revocation/epoch/lease enforcement
retention authority + store inventory + backup horizon
  -> deletion lifecycle -> transcript/history erasure verification
hosting trust -> client address verification + verified HTTPS -> HSTS
operator identity -> entitlement + audit -> governed deletion execution
all six sprint results -> threat replay + regression -> final verdict
```

No alternate product, billing, identity, persistence, or authorization path may
be introduced to make this graph pass.

## 4. Conditional implementation allowlist

- `src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js`
- `src/lib/intelligenceFabric/index.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.integration.test.js`
- `scripts/verifyCoachConnectProductionSecurityPrerequisites.mjs`
- `lab_outputs/coach_connect_production_security_prerequisites_v1/`

Only the union of separately approved Sprint 1–6 allowlists may accompany
these paths. No environment file, secret, runtime data, build output,
production snapshot, transcript, or unrelated dirty path may be staged or
packaged.

## 5. Campaign-wide validation

Run:

- all sprint-local contract, positive, negative authorization, cross-tenant,
  replay/idempotency, failure-injection, default-off, and audit tests;
- complete Intelligence Fabric regression;
- focused security and API suite;
- cross-sprint integration and threat-model scenario replay;
- build and lint;
- secret and sensitive-data scan;
- changed-file and protected-root comparison;
- evidence manifest and archive integrity verification;
- worktree/package byte comparison;
- production-denial proof for deployment, live shared state, providers,
  credentials, deletion, migration, and Stripe.

The planned commands and evidence classes are controlled by Part 3. At most two
bounded repairs are permitted per failed gate. Each repair emits the Part 2
receipt; scope expansion or repair exhaustion stops the campaign.

## 6. Final implementation package

A later authorized implementation campaign creates exactly one indexed:

`COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_IMPLEMENTATION_REVIEW_V1.zip`

It includes approved AFWs, sprint artifacts, change/repair receipts, artifact
and evidence manifests, changed files, tests, threat/attack results, decision
records, environment/trust records, executive handoff, AI handoff, and exactly
one final campaign verdict. It contains no secret, raw sensitive data, runtime
data, or unrelated file.

## 7. Verdict rules

- `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_COMPLETE` only if all nine
  prerequisites and all required human decisions are resolved and verified.
- `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_COMPLETE_WITH_LIMITS` only
  for bounded items that do not block Deployment Readiness; it cannot hide any
  identity, state, policy, deletion, HSTS/proxy, or operator prerequisite.
- `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_BLOCKED` for any unresolved,
  unproven, unavailable-authority, unnamed-adapter, or inconsistent
  prerequisite.
- `COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_FAILED` for material
  architecture, protected-root, security-doctrine, or evidence-integrity
  violation.

Green tests never override missing authority, synthetic-only shared-state
proof, an unverified backing store, or an unsupported physical deletion claim.

## 8. Stop and handoff rules

Stop if evidence is inconsistent, a protected root changed, production action
would be required, a verdict would overstate proof, any sprint no longer fits
the architecture, or a gate fails after two bounded repairs.

The executive handoff identifies resolved and blocked prerequisites, evidence
classes/counts, human decisions, physical-deletion truth, transport/store
limits, protected-root result, no-deployment result, and verdict.

The AI handoff identifies source commit and dirty boundary, exact allowlist,
contract/policy versions, commands/results, decision/dependency registers,
repair receipts, hashes, and the prohibition on inferring Deployment
Readiness.

Even `COMPLETE` does not authorize deployment. The next campaign may be
Deployment Readiness only after human review. Production, deployment,
certification, production Redis or another live store, live providers, secrets,
destructive deletion, migration, and Stripe remain unauthorized.

Any refinement requires a change receipt covering contracts, files, tests,
scope, and risk.
