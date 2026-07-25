# Coach Connect Production Security Prerequisites — Sprint 6 AFW V1

Status: pre-authored architecture work frame; implementation not authorized.

## 1. Outcome

Define authenticated operator identity, least-privilege entitlement,
break-glass/dual-control boundaries, and attributable audit. Developer access
and `SUBDEV1` remain categorically separate from operator authority.

## 2. Entry authorities

Both decisions are mandatory:

- `OPERATOR_IDENTITY_AUTHORITY`: issuer, audience, verifier, session/security
  version, authentication strength, recovery/revocation, and identity store.
- `OPERATOR_ENTITLEMENT_POLICY`: role owners, entitlement approvers,
  environment/tenant scopes, action matrix, session duration, reason rules,
  break-glass policy, dual-control actions, and audit review owner.

Without both, the sprint verdict is
`SPRINT_6_BLOCKED_BY_OPERATOR_AUTHORITY`.

Decision source:
`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`.
The packet recommends a separate invite-only Auth0 operator authority with
WebAuthn MFA and deny-by-default RBAC plus attributes/dual control. These are
`RECOMMENDED`, not `APPROVED`. Sprint 6 is unlocked only when both human choice,
approver, date, and `APPROVED` fields are complete. `REJECTED` requires AFW
revision; `DEFERRED` blocks Sprint 6 and governed privileged execution.
`SUBDEV1` remains categorically separate.

## 3. Identity and authorization contracts

`OperatorSubjectV1` contains the Part 1 section 9.9 fields. Each privileged
decision validates active subject, exact issuer/audience, authentication
strength, session/security version, environment, tenant, entitlement, reason,
and break-glass context. Destructive actions identified by policy require a
second distinct active approver.

Authorization returns a stable allow/deny result with policy version and
privacy-safe audit reference. Missing, stale, revoked, ambiguous, wrong-scope,
or unauditable state denies. A shared administrator code, developer
capability, subscriber/coach identity, internal route access, or `SUBDEV1`
cannot substitute for an operator subject.

Audit records are append-only and attributable, minimize sensitive values, and
contain action, target reference, decision, policy/entitlement versions,
reason, environment/tenant scope, session reference, approver references, and
timestamp. Failure to persist a mandatory audit record prevents success.

## 4. Conditional implementation allowlist

- `src/lib/intelligenceFabric/coachConnect/productionSecurity/constants.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/operatorIdentity.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/audit.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/activation.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.operator.test.js`

The selected identity, entitlement, and audit adapters are deliberately
unnamed. They require architecture approval and a change receipt. Existing
developer-access files are test inputs for separation, not operator channels.

## 5. Validation and attack proof

Required cases:

- valid least-privilege action with attributable audit;
- unauthenticated, forged, disabled, revoked, stale-security-version,
  wrong-issuer/audience, weak-auth, expired-session, wrong-environment,
  wrong-tenant, missing-entitlement, and missing-reason denial;
- developer capability, `SUBDEV1`, subscriber, and coach identity escalation
  denial;
- cross-tenant target and confused-deputy denial;
- break-glass outside policy, reused approval, same-person dual control, stale
  approver, and missing audit persistence denial;
- entitlement revocation races and shared-state outage fail closed;
- default-off activation and no live identity/audit service access.

Planned command:

```text
node --test test/intelligenceFabric.coachConnect.productionSecurity.operator.test.js
```

Evidence:

- `sprint_6/authority_decisions.json`
- `sprint_6/entitlement_matrix.json`
- `sprint_6/authorization_results.json`
- `sprint_6/audit_results.json`
- `sprint_6/escalation_attack_results.json`
- `sprint_6/changed_files.json`
- `sprint_6/no_production_action.json`

## 6. Stop and exit rules

Stop if the provider or entitlement owner is guessed, developer access would
be elevated, actions cannot be attributed, dual control cannot prove distinct
subjects, audit failure would still allow success, a protected root changes,
production access is needed, or two bounded repairs fail.

Allowed sprint verdicts:

- `SPRINT_6_COMPLETE`
- `SPRINT_6_BLOCKED_BY_OPERATOR_AUTHORITY`
- `SPRINT_6_FAILED`

Sprint 7 receives explicit identity/entitlement versions and evidence
references. Completion does not authorize production operator use, deployment,
Redis, live providers, Stripe, or Deployment Readiness.

Any refinement requires a change receipt covering contracts, files, tests,
scope, and risk.
