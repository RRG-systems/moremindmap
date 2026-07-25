# Coach Connect Production Security Prerequisites — Sprint 5 AFW V1

Status: pre-authored architecture work frame; implementation not authorized.

## 1. Outcome

Define production-only HSTS and trusted client-address derivation without
assuming hosting topology, TLS termination, proxy identities, or forwarded
header trust. Configuration remains default-off and no deployment occurs.

## 2. Entry authorities

Both decisions are mandatory:

- `PRODUCTION_HOSTING_TRUST`: exact production hosts, verified HTTPS
  termination, trusted proxy identities/CIDRs or platform-attested metadata,
  chain order, normalization, and privacy treatment.
- `HSTS_DIRECTIVES`: approved `max-age`, `includeSubDomains`, `preload`,
  emergency-disable authority, rollout, monitoring, and rollback.

Without either decision, the sprint verdict is
`SPRINT_5_BLOCKED_BY_HOSTING_TRUST_AUTHORITY`.

Decision source:
`MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md`.
The packet recommends one exact Vercel production edge with no upstream proxy
and a staged production-only HSTS policy. These are `RECOMMENDED`, not
`APPROVED`, and cause no deployment/configuration action. Sprint 5 is unlocked
only when exact project/host references, human choices, approvers, dates, and
both `APPROVED` statuses are present. `REJECTED` requires AFW revision;
`DEFERRED` blocks Sprint 5.

## 3. Transport contract

HSTS is emitted only when all inputs are true:

```text
environment == production
verified_https_termination == true
trusted_proxy_contract_version is approved
host is in exact production host allowlist
emergency_disable == false
```

Local, test, preview, staging, HTTP, unknown host, ambiguous proxy, and
unverified TLS omit HSTS and cannot support a readiness claim. HSTS omission
does not turn an otherwise protected operation into an allow.

The client-address resolver accepts only hosting-attested connection metadata,
walks an explicit ordered trusted chain, ignores untrusted forwarded headers,
normalizes IPv4/IPv6, and returns `VERIFIED`, `UNAVAILABLE`, or `AMBIGUOUS`.
Unknown address state never bypasses subject, browser, scope, replay, or rate
controls. Raw addresses are excluded from logs and evidence; approved
privacy-safe classification or keyed references are used instead.

## 4. Conditional implementation allowlist

- `src/lib/intelligenceFabric/coachConnect/productionSecurity/constants.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/contracts.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/transportPolicy.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/trustedProxy.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/audit.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/activation.js`
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js`
- `test/intelligenceFabric.coachConnect.productionSecurity.transport.test.js`
- `vercel.json`, only after every production-only predicate is grounded and
  synthetic tests prove exact omission/presence behavior.

No deployment file is changed merely to document a future mechanism. If the
approved platform requires a different integration path, a change receipt and
architecture review are required.

## 5. Validation and attack proof

Required cases:

- exact verified production HTTPS presence;
- local/test/preview/staging/HTTP/unknown-host/ambiguous-chain omission;
- case, port, alternate host, duplicate header, multiple hop, malformed
  IPv4/IPv6, private/reserved address, and unexpected chain handling;
- direct-client spoofing of every forwarded header;
- untrusted intermediate proxy, excess/fewer hops, stale trust version, and
  missing platform attestation;
- unknown address cannot bypass layered limits;
- no raw address in audit, logs, fixtures, or packaged evidence;
- emergency-disable authorization and rollback semantics;
- default-off state and zero deployment/network action.

Planned command:

```text
node --test test/intelligenceFabric.coachConnect.productionSecurity.transport.test.js
```

Evidence:

- `sprint_5/hosting_decision.json`
- `sprint_5/hsts_policy_results.json`
- `sprint_5/proxy_spoof_results.json`
- `sprint_5/privacy_log_scan.json`
- `sprint_5/changed_files.json`
- `sprint_5/no_deployment_action.json`

## 6. Stop and exit rules

Stop if topology or TLS termination is assumed, a forwarded header must be
trusted without attestation, HSTS could reach non-production, raw client
addresses enter evidence, deployment is needed, a protected root changes, or
two bounded repairs fail.

Allowed sprint verdicts:

- `SPRINT_5_COMPLETE`
- `SPRINT_5_BLOCKED_BY_HOSTING_TRUST_AUTHORITY`
- `SPRINT_5_FAILED`

Sprint 6 receives versioned transport results only. Completion does not
authorize deployment, production activation/certification, Redis, live
providers, Stripe, or Deployment Readiness.

Any refinement requires a change receipt covering contracts, files, tests,
scope, and risk.
