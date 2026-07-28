# MORE Remote Security Adapter Qualification / Live Attestation Repair AFW V1

Mission: `MORE_REPAIR_PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_001`

Authority: narrow architecture and implementation repair only.

## 1. Purpose

Separate implementation qualification from exact private-live environment
authority while preserving every qualified remote-security invariant.

## 2. Dependencies

- head `5a93d6124c4282acd685904f6e2e05a0582e3549`;
- blocked architecture packet SHA-256
  `6e634d025e48cba5506d11e447f2a01a30f97392341c3112f292fd9a650f7544`;
- adapter qualification verdict
  `PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_QUALIFIED_WITH_LIMITS`;
- contracts `shared-security-state-async-v2` and
  `remote-shared-security-adapter-v1`.

## 3. Frozen allowlist

Implementation:

- `src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/attestations.js`;
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js`;
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js`;
- `src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/index.js`.

Tests and verifier:

- `test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.liveAttestation.test.js`;
- `test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.health.test.js`;
- `test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.integration.test.js`;
- `test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.privacy.test.js`;
- `scripts/verifyPrivateRuntimeRemoteSecurityAdapterLiveAttestationRepair.mjs`.

Governance and evidence:

- the two mission documents;
- `lab_outputs/coach_connect_private_runtime_remote_security_adapter_live_attestation_repair_v1/**`.

All other files are prohibited.

## 4. Contracts

Implement:

- `REMOTE_SHARED_SECURITY_OPERATING_MODES = [QUALIFICATION, PRIVATE_LIVE]`;
- canonical-digest and validation functions for
  `RemoteSecurityQualificationCertificateV1`;
- canonical-digest and validation functions for
  `PrivateLiveEnvironmentAttestationV1`;
- one operating-authority evaluator that accepts exactly one mode bundle.

The Qualification Certificate must have an exact field set, exclude
environment and namespace identity, and bind implementation ID, source
digest, both contract versions, provider class, review package, verdict,
capabilities, limits, dates, zero customer data, and qualification teardown.

The Live Environment Attestation must have an exact field set and bind one
private-live environment, project reference, provider classification,
persistent namespace, configuration, implementation, certificate, protected
edge, public lockout, default-off state, emergency control, retention/backup/
deletion classes, scope digests, owners, approval, and dates.

## 5. Implementation sequence

1. Add pure schema/digest/validation functions.
2. Replace `qualificationMatches()` with the explicit operating-authority
   evaluator.
3. Authorize configuration and transport only from a valid operating bundle
   or an explicit TEST-only offline transport.
4. Preserve existing health, retry, command, query, and provider-client paths.
5. Bind disposable teardown construction to explicit `QUALIFICATION`.
6. Export the new contracts.
7. Update offline fixtures to state their mode explicitly.
8. Add all required denial and cross-binding tests.
9. Run the verifier and full validation.

## 6. Focused tests

Required cases:

1. qualification mode accepts an exact disposable attestation;
2. qualification rejects persistent;
3. private-live rejects disposable;
4. private-live requires both certificate and live attestation;
5. expired or mismatched certificate denies;
6. adapter source digest mismatch denies;
7. environment mismatch denies;
8. namespace mismatch denies;
9. contract mismatch denies;
10. public exposure denies;
11. default-on or activation-approved state denies;
12. missing emergency state denies;
13. namespace naming cannot infer mode;
14. qualification evidence cannot activate private-live;
15. private-live evidence cannot construct qualification teardown;
16. valid private-live authority remains default-off and only becomes
    deployment-grade after existing health recovery;
17. missing configuration stays asynchronous and fail-closed;
18. offline simulation stays non-deployment-grade.

## 7. Failure and mismatch matrix

Every schema error, digest mismatch, expired date, cross-mode artifact,
unknown mode, environment/namespace mismatch, public exposure, missing edge
gate, activation state, or emergency-control mismatch yields invalid operating
authority and zero provider calls.

No repair may turn a validation failure into a warning.

## 8. Validation

Run:

- focused repair tests;
- all remote-shared-security tests;
- Async Security V2, Private Runtime, Production Security, and Deployment
  Readiness suites;
- safe complete Intelligence Fabric regression;
- deterministic build twice;
- focused lint;
- import/export and dependency-cycle validation;
- exact changed-file allowlist;
- protected-root comparison;
- secret and sensitive-content scans.

Evidence must record test counts, build digests, source diff, protected-root
digest, provider/environment/deployment ledgers, and the final verdict.

## 9. Bounded repair

At most two localized iterations are allowed. A repair must remain in the
frozen allowlist and may not alter commands, queries, Async Security V2,
provider choice, product semantics, live handlers, or deployment.

Stop after Repair 002 or immediately on architecture drift, second authority,
protected-root impact, credential need, provider need, or deployment need.

## 10. Evidence and review package

Create
`PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_REPAIR_REVIEW_V1.zip`
with:

- executive summary and handoffs;
- root cause and current/repaired models;
- both schemas;
- exact source diff and changed-file manifest;
- focused mode/mismatch evidence;
- regression and build results;
- protected-root, secret, and sensitive scans;
- provider/environment/deployment zero-activity ledgers;
- artifact and evidence manifests;
- final verdict.

Archive paths must be sorted, relative, traversal-free, duplicate-free,
case-collision-free, and symlink-free. Validate decompressed bytes and a
byte-identical Desktop copy.

## 11. Verdicts

- `PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_REPAIR_COMPLETE`
- `PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_REPAIR_BLOCKED`

No deployment, credential binding, Vercel change, runtime activation, staging,
commit, or push is authorized.
