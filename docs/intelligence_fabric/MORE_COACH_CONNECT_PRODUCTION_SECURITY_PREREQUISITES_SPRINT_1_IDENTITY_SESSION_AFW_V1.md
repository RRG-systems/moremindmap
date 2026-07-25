# Coach Connect Production Security Prerequisites — Sprint 1 AFW V1

Status: pre-authored architecture work frame; implementation not authorized.

## 1. Outcome

Define the canonical subscriber subject and the atomic transition from a
pre-authentication session to an authenticated subscriber session. This sprint
does not select an identity provider, create an authentication callback, or
activate an endpoint.

## 2. Entry authorities

Implementation cannot start until both decisions are approved:

- `SUBSCRIBER_AUTHORITY_SOURCE`: issuer, audience, assertion verifier,
  canonical mapping owner, recovery authority, and durable mapping store.
- `SUBSCRIBER_SESSION_OWNER`: callback boundary, cookie/session owner, rotation
  transaction boundary, and logout/privilege-reduction behavior.

If either is absent, the sprint verdict is `SPRINT_1_BLOCKED_BY_IDENTITY_AUTHORITY`.

Decision source:
`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`.
The packet recommends Auth0 OIDC subject binding and a server-owned rotating
opaque session. These are `RECOMMENDED`, not `APPROVED`. Sprint 1 is unlocked
only when both rows contain a human choice, approver, date, required detail,
and explicit `APPROVED` status. `REJECTED` requires AFW revision; `DEFERRED`
blocks Sprint 1 without blocking an otherwise independent sprint.

## 3. Scope and protected boundaries

In scope:

- canonical opaque subject binding;
- invite-to-subject and coach-relationship authorization binding;
- pre-auth session elevation and rotation;
- logout, revocation, recovery, and privilege-reduction invalidation;
- API enforcement planning and adversarial proof.

Out of scope:

- Business Engine, Five Futures, One Move, BA/BOS scoring, Stripe, billing,
  canonical dossier identity, or persistence redesign;
- production identity traffic, real cookies, secrets, deployment, or migration;
- using coach identity, email, profile ID, subscriber ID, invite data, or
  `SUBDEV1` as a subscriber authentication subject.

## 4. Locked contracts

`CanonicalSubscriberSubjectV1` contains the fields defined in Part 1 section
9.1 and is accepted only after exact issuer, audience, tenant, active-status,
mapping-version, and security-version verification.

`SessionElevationV1` is one atomic operation:

```text
PRE_AUTH -> ELEVATION_PENDING -> AUTHENTICATED
```

On success it creates a different authenticated session identifier, binds it
to the canonical subject and browser context, rotates CSRF state, and revokes
the pre-auth session and prior capabilities. Persistence failure produces no
authenticated authority. Terminal states are `EXPIRED`, `REVOKED`, `ROTATED`,
and `INVALID`.

No request-supplied identifier may resolve authorization. Account reassignment
is prohibited; recovery changes the security version and emits an attributable
audit event.

## 5. Conditional implementation allowlist

New files:

- `src/lib/intelligenceFabric/coachConnect/productionSecurity/constants.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/subjectBinding.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/sessionElevation.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/activation.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js`

Narrow integrations, only after the entry authorities name the real boundary:

- `api/internal/developer-access.js`
- `api/internal/developer-access-security.js`
- `api/internal/subscription-entitlement.js`

An authority-selected adapter path requires an AFW change receipt before it can
enter the allowlist. No other source path is authorized by this AFW.

## 6. Tests and attack proof

Planned tests:

- `test/intelligenceFabric.coachConnect.productionSecurity.subjectBinding.test.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.sessionElevation.test.js`
- `test/api.internal.developerAccess.productionSecurity.test.js`

Required cases:

- valid subject and rotation path;
- forged subject, wrong issuer/audience/tenant, disabled subject, stale mapping,
  and client-supplied ID denial;
- pre-auth fixation, replay, old-CSRF reuse, old-capability reuse, concurrent
  elevation, partial-write, logout, recovery, and privilege-reduction denial;
- cross-tenant coach/subscriber relationship denial;
- resolver absence and shared-state failure fail closed;
- activation remains default-off and no live identity service is contacted;
- attributable, identifier-minimized audit result.

## 7. Evidence and commands

Future implementation evidence:

- `sprint_1/authority_decisions.json`
- `sprint_1/contract_results.json`
- `sprint_1/attack_results.json`
- `sprint_1/changed_files.json`
- `sprint_1/no_production_action.json`

Planned focused command:

```text
node --test \
  test/intelligenceFabric.coachConnect.productionSecurity.subjectBinding.test.js \
  test/intelligenceFabric.coachConnect.productionSecurity.sessionElevation.test.js \
  test/api.internal.developerAccess.productionSecurity.test.js
```

The later implementation run must also verify the exact changed-file allowlist,
default-off state, secret absence, and no production action.

## 8. Stop and exit rules

Stop if authority is inferred from a client identifier, the session transition
cannot be atomic, the real callback/cookie boundary is unknown, a protected
root would change, production credentials are required, or two bounded repair
cycles fail.

Allowed sprint verdicts:

- `SPRINT_1_COMPLETE`
- `SPRINT_1_BLOCKED_BY_IDENTITY_AUTHORITY`
- `SPRINT_1_FAILED`

Sprint 2 receives only versioned contracts and proof references. Completion
does not authorize production, deployment, live providers, Redis, Stripe, or a
claim of Deployment Readiness.

Any refinement must issue a change receipt naming changed contracts, files,
tests, scope, and risk.
