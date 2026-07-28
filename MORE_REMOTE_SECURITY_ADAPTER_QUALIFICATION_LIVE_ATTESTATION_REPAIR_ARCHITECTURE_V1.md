# MORE Remote Security Adapter Qualification / Live Attestation Repair Architecture V1

Mission: `MORE_REPAIR_PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_001`

Verdict: `PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_REPAIR_COMPLETE`

## 1. Executive summary

The qualified Upstash Redis implementation is sound, but its current
authorization gate conflates two different facts:

1. the adapter implementation was qualified in a disposable namespace; and
2. a particular environment and namespace may use that implementation.

The repair separates those facts without changing the Async Security State
Port V2, Redis commands, authoritative queries, retry rules, health state
machine, or provider. The repaired trust chain is:

```text
Qualified Adapter Implementation
-> implementation-bound Qualification Certificate
-> environment-bound Live Environment Attestation
-> persistent private security namespace
-> separately governed runtime activation
```

`QUALIFICATION` and `PRIVATE_LIVE` are the only modes. Mode is an explicit
constructor input and is never inferred from a namespace string.

## 2. Authoritative inputs and repository grounding

- repository head:
  `5a93d6124c4282acd685904f6e2e05a0582e3549`;
- blocked architecture packet:
  `MORE_PRIVATE_RUNTIME_LIVE_BINDINGS_AND_ENVIRONMENT_AUTHORITY_ARCHITECTURE_V1.md`;
- packet SHA-256:
  `6e634d025e48cba5506d11e447f2a01a30f97392341c3112f292fd9a650f7544`;
- blocked verdict:
  `PRIVATE_RUNTIME_LIVE_BINDINGS_ENVIRONMENT_AUTHORITY_ARCHITECTURE_BLOCKED`;
- Async Security contract:
  `shared-security-state-async-v2`;
- remote adapter contract:
  `remote-shared-security-adapter-v1`;
- qualified implementation verdict:
  `PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_QUALIFIED_WITH_LIMITS`.

The repository proves 12/12 atomic commands, 8/8 authoritative queries,
11/11 race/failure scenarios, mandatory same-script audit coupling, restart
recovery, namespace isolation, and a final qualification key count of zero.
Those proofs are preserved and are not repeated against a provider here.

The decisive source locations are:

- `remoteSharedSecurity/upstashRedisAdapter.js`, where
  `qualificationMatches()` requires `disposable_namespace === true`;
- `remoteSharedSecurity/configuration.js`, where an enabled configuration
  requires a boolean currently named `qualification_authorized`; and
- the adapter capability/health projection, which is deployment-grade only
  when that qualification match is true.

No disposable condition exists in the atomic command or authoritative query
implementation. No live handler currently performs this check.

## 3. Exact root cause

The field is `qualification_attestation.disposable_namespace`. It is enforced
inside adapter authorization, then indirectly controls configuration
validation, transport readiness, capability projection, and health
projection.

Current:

```text
enabled configuration
-> qualificationMatches(exact environment + exact namespace)
-> requires disposable_namespace == true
-> configuration qualification_authorized
-> transport and deployment-grade capability
```

This is correct for qualification and false for a persistent private-live
namespace. Removing the boolean check would be unsafe because it would leave
no replacement environment authority.

## 4. Repaired attestation model

### 4.1 Explicit mode

```text
RemoteSecurityOperatingModeV1 =
  QUALIFICATION
  | PRIVATE_LIVE
```

Missing, inferred, or unknown modes deny. Exactly one authority bundle is
accepted:

- `QUALIFICATION`: one exact qualification attestation; or
- `PRIVATE_LIVE`: one Qualification Certificate plus one Live Environment
  Attestation.

Mixing the bundles denies.

### 4.2 Qualification Certificate

The certificate is implementation-bound and provider-class-bound. It contains
no environment ID, database ID, namespace prefix, namespace digest, endpoint,
credential, tester, or Profile ID.

Required fields:

```text
certificate_version
adapter_implementation_id
adapter_source_sha256
contract_version
adapter_contract_version
provider_class
qualification_review_package_name
qualification_review_package_sha256
attestation_repair_review_package_name
attestation_repair_review_package_sha256
qualified_script_manifest_sha256
qualification_verdict
qualified_at
review_due_at
capabilities {
  promise_native
  provider_native_atomic_commands
  authoritative_primary_queries
  authority_snapshot_internally_consistent
  race_failure_qualified
  mandatory_audit_coupled
  restart_recovery_proven
  fail_closed_outage_proven
  namespace_isolation_proven
}
known_limits[]
zero_customer_data
qualification_namespace_teardown_proven
certificate_sha256
```

The digest is SHA-256 over canonical JSON excluding `certificate_sha256`.
The certificate must match an immutable adapter-source digest supplied by the
reviewed build boundary, the exact adapter implementation ID, both contract
versions, the provider class, the qualification review package digest, this
attestation-repair review package digest, the unchanged qualified script
manifest digest, the approved verdict, and an unexpired review date. This
explicit evidence chain avoids falsely claiming that the earlier provider
qualification package hashed the later gate-repair source bytes.

### 4.3 Live Environment Attestation

The attestation binds exact operating authority and contains:

```text
attestation_version
operating_mode = PRIVATE_LIVE
environment_id
vercel_project_reference
provider_classification
deployment_target
provider_class
persistent_namespace = true
disposable_namespace = false
private_live_only = true
public_access = false
production_customer_rollout = false
namespace_prefix
namespace_digest
adapter_implementation_id
adapter_source_sha256
qualification_certificate_sha256
contract_version
adapter_contract_version
configuration_digest
protected_edge = true
named_identity_only = true
mfa_backed_operator = true
runtime_default_state = OFF
runtime_activation_approved = false
emergency_disable_supported = true
emergency_disable_state = READY
retention_class
backup_class
deletion_class
approved_tester_scope_digest
approved_profile_id_scope_digest
activation_owner_ref
rollback_owner_ref
operator_approval_ref
issued_at
review_due_at
attestation_sha256
```

Its digest is SHA-256 over canonical JSON excluding `attestation_sha256`.
All environment, namespace, configuration, implementation, certificate, and
contract fields must match exactly. Private-live authority is limited to
`PRIVATE_PREVIEW` or `PRIVATE_PRODUCTION_CLASSIFIED`. This repair recognizes
only source-default-off preparation; runtime activation remains a later,
separate authority.

## 5. Mode gates

### 5.1 Qualification mode

Qualification mode requires:

- explicit `QUALIFICATION`;
- the existing exact qualification attestation;
- `disposable_namespace === true`;
- exact environment, namespace, configuration, script, and adapter binding;
- primary authority, atomic scripts, live connection, zero customer data, and
  an unexpired qualification window.

It rejects a persistent namespace and rejects any live certificate or live
environment attestation. The disposable teardown invocation additionally
requires explicit `QUALIFICATION`.

### 5.2 Private-live mode

Private-live mode requires:

- explicit `PRIVATE_LIVE`;
- a valid implementation-bound Qualification Certificate;
- a valid exact Live Environment Attestation;
- `persistent_namespace === true`;
- `disposable_namespace === false`;
- protected edge, named identities, and MFA-backed operator authority;
- public access and customer-wide rollout false;
- runtime default off and no activation approval in this campaign;
- emergency disable support ready;
- exact environment, namespace, config, implementation, certificate, and
  contract cross-binding.

It rejects a qualification attestation and cannot authorize disposable
teardown.

## 6. Configuration and capability behavior

The configuration record and its digest do not gain a mode field. This avoids
invalidating the qualified implementation by changing the configuration
wire format. Instead, configuration validation receives a validated
`operating_authorized` result from the adapter gate. The legacy
`qualification_authorized` input remains only as a compatibility boundary for
existing qualification callers; the adapter does not use it for private-live
authority.

The Async Security V2 capability schema remains unchanged. Deployment-grade
and live-connection capability may be projected only after:

1. the explicit mode authority is valid;
2. the existing health controller reaches `HEALTHY`; and
3. the existing primary-read and atomic-canary proofs pass.

Offline simulation never becomes deployment-grade.

## 7. State machines

Qualification:

```text
UNCONFIGURED
-> QUALIFICATION_ATTESTED
-> HEALTHY
-> QUALIFICATION_OPERATIONS
-> TEARDOWN_REQUIRED
-> TORN_DOWN
```

Private live:

```text
UNCONFIGURED
-> CERTIFICATE_VALID
-> ENVIRONMENT_ATTESTED_DEFAULT_OFF
-> HEALTHY_SECURITY_ADAPTER
-> separate activation authority required
-> PRIVATE_TEST_ENABLED
-> EMERGENCY_DISABLED
-> RECOVERING
-> ATTESTED_DEFAULT_OFF
```

This mission stops at `ENVIRONMENT_ATTESTED_DEFAULT_OFF` in architecture and
offline validation. It creates no attestation for a real environment.

## 8. Exact implementation allowlist

Source and tests:

1. `src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/attestations.js`
2. `src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js`
3. `src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js`
4. `src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/index.js`
5. `test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.liveAttestation.test.js`
6. `test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.health.test.js`
7. `test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.integration.test.js`
8. `test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.privacy.test.js`
9. `scripts/verifyPrivateRuntimeRemoteSecurityAdapterLiveAttestationRepair.mjs`

Governance and evidence:

10. `MORE_REMOTE_SECURITY_ADAPTER_QUALIFICATION_LIVE_ATTESTATION_REPAIR_ARCHITECTURE_V1.md`
11. `MORE_REMOTE_SECURITY_ADAPTER_QUALIFICATION_LIVE_ATTESTATION_REPAIR_AFW_V1.md`
12. `lab_outputs/coach_connect_private_runtime_remote_security_adapter_live_attestation_repair_v1/**`

## 9. Protected roots

No change is authorized in:

- atomic command or Lua script semantics;
- authoritative query semantics;
- Async Security V2;
- Business Engine, BA, BOS, Five Futures, or One Move;
- Profile ID or canonical dossier;
- Subscription Runtime or Coach Connect;
- SUBDEV1 authority order;
- live handlers or deployment adapters;
- Vercel configuration, environment files, CI, package manifests, or
  lockfiles;
- Stripe, public onboarding, model routing, Luna, voice, media, or transcript
  persistence.

## 10. Validation plan

Focused validation proves:

- qualification remains disposable-only;
- private-live is persistent-only;
- both modes are explicit and cannot be inferred;
- certificate and attestation presence, exact digests, source digest, dates,
  contract, environment, namespace, public exposure, default-off, and
  emergency state fail closed;
- qualification teardown is mode-bound;
- offline transport cannot report deployment grade; and
- private-live authority reaches capability only after the existing health
  gate.

Regression validation covers the complete remote adapter, Async Security V2,
Private Runtime, Production Security, Deployment Readiness, and safe
Intelligence Fabric suites, followed by two deterministic builds, lint,
imports/exports, cycles, protected roots, allowlist, secrets, and sensitive
content.

## 11. Security and authority proofs

- one provider adapter implementation;
- one Async Security State Port V2;
- one canonical security service;
- one authoritative remote record set;
- no atomic-command or query change;
- no V1, local, synthetic-live, or cached authority;
- implementation qualification is not namespace authority;
- live namespace authority is not implementation qualification;
- qualification teardown cannot be authorized by private-live evidence;
- no qualification namespace reuse;
- no public/customer activation;
- no product content in security state;
- no provider call, credential, environment change, deployment, or activation
  in this mission.

## 12. Stop conditions and boundary

Stop if the repair requires command/query changes, Async Security V2 drift, a
second adapter or authority, provider requalification beyond attestation
separation, product semantics, protected roots, credentials, or deployment.

After this repair, the blocked live-bindings architecture can be reviewed
again and move from blocked to complete because its decisive adapter
incompatibility is removed. The historical blocked packet is not rewritten.
Subscriber assertion and product attachment adapters, exact private-live
configuration authority, deployment, runtime activation, and named tester
activation remain separate future work.

## 13. Final verdict

The architecture is coherent, provider-neutral at the authority boundary,
bounded to attestation/configuration validation, and requires no provider or
deployment action.

`PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_REPAIR_COMPLETE`
