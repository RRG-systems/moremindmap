# MORE Private Runtime Remote Shared Security Adapter — Sprint 4 AFW V1

Sprint:
`4 — Authoritative Query and Snapshot Design`

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_V1`

Architecture SHA-256:
`dbca624bf46540d1aae7b698dcffc81a845a10f43a28df70e8f7e22a1c4a0c8a`

Prerequisite commit:
`d0bde035a0519f8e89135204e88cd428ca0d5800`

AFW expansion implementation authority: `false`

## 1. Sprint purpose

Implement eight versioned authoritative query scripts, including one internally consistent READ_AUTHORITY_SNAPSHOT, using only a write-routed primary candidate primitive and no ordinary, cached, replica, or multi-round-trip authority read.

## 2. Dependencies

- Sprint 3 complete receipt
- frozen command/script manifest

No dependency may be inferred from provider availability, credentials, or a deployment.

## 3. Exact file allowlist

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.queries.test.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.races.test.js
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/sprint_receipt.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/changed_files.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/contract_proof.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/focused_tests.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/race_failure_tests.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/environment_isolation_proof.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/secret_privacy_scan.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/protected_root_proof.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/provider_authority_boundary.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/repair_receipt_1.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/repair_receipt_2.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/change_receipt.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/authoritative_query_matrix.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/authority_snapshot_consistency_proof.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/no_stale_read_proof.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_4/primary_route_requirement_proof.json
```

The two repair receipts and change receipt are conditional paths. Emit them only when the corresponding governed event occurs. Every other listed evidence file is mandatory. No glob expands this allowlist.

## 4. Prohibited files and actions

- every file outside Section 3;
- committed V2 contract, port, synthetic adapter, canonical service, facade, eligibility, live composition, handler, product, deployment, package, lockfile, CI, migration, and environment files;
- Business Engine, BA, BOS, Five Futures, One Move, Profile ID, Subscription Runtime, Coach Connect, Stripe, billing, model, Luna, voice, media, transcript, or public-onboarding changes;
- provider connection or credential activity except the explicitly gated Sprint 7 disposable qualification mode;
- staging, commit, push, Vercel inspection, deployment, environment activation, or tester authorization.

## 5. Contracts and schemas

- one primary-authoritative Lua script per query
- provider server time and versioned result in every query
- READ_AUTHORITY_SNAPSHOT compares mapping, inverse, session, approval, entitlement, environment epoch, and scope epoch in one operation
- bounded heartbeat mutation forces the candidate write path
- ordinary GET/MGET/pipeline/EVAL_RO/EVALSHA_RO/read-region/cache paths are prohibited

## 6. Implementation sequence

1. freeze Sprint 3 script manifest and V2 query allowlist
2. implement all eight query scripts and exact result projection
3. implement one authority-snapshot generation and earliest-validity computation
4. add static forbidden-primitive scan
5. simulate stale, corrupt, wrong-version, wrong-epoch, wrong-scope, expiry, and partition results
6. run query/snapshot concurrency and no-cache tests
7. emit exact Sprint 4 evidence and receipt

## 7. Focused tests

- all eight query types use one script each
- subject resolution never enrolls
- authority snapshot is not assembled from independent reads
- every positive result proves required consistency and provider time
- wrong or extra V2 result fields fail
- positive authority, mappings, epochs, health, and time are never cached

## 8. Concurrency and race tests

- binding versus resolution
- rotation/revocation/epoch advance versus snapshot
- approval revoke versus snapshot
- entitlement expiry versus snapshot
- stale generation versus current generation

## 9. Outage and failure tests

- stale replica, failover ambiguity, nonmonotonic time/epoch, partial record set, corrupt index, missing TTL, wrong digest, and malformed tuple deny
- primary-route capability not proven remains a hard qualification stop

## 10. Environment-isolation checks

- query script validates database/environment/namespace/region/script digests
- wrong-environment records cannot be projected
- no cross-namespace fan-out query exists

## 11. Secret and privacy scans

- query input and result fixtures contain keyed hashes or opaque refs only
- snapshot contains no raw tokens, identity, content, provider keys, or credentials

All evidence uses opaque references and synthetic fixtures. Raw provider identifiers and secret values are forbidden.

## 12. Sprint-local validation

- focused tests pass individually and with every earlier sprint suite;
- exact changed paths are a Section 3 subset;
- committed V2 baseline and files consumed unchanged retain their digests;
- schemas, script manifests, JSON evidence, imports, and dependency graph validate;
- race and failure expectations are deterministic;
- secret and sensitive-content scans pass;
- provider authority boundary receipt matches actual call count;
- protected roots match the fresh campaign baseline;
- Git index remains empty until a separate commit mission.

## 13. Protected-root comparison

Hash every Part 1 Section 11 protected path before and after the sprint. Preserve the pre-existing bytes. Any sprint-caused protected change blocks continuation.

## 14. Provider-call authority boundary

Provider call count must remain zero. Tests inject simulators or fake transport only. No credential may be requested, resolved, inspected, created, logged, or stored. This sprint does not create a namespace, backup, provider resource, or live health check.

## 15. Bounded repair

Repair 001 and Repair 002 are the maximum for a failed sprint gate. A repair must stay within Section 3, emit its numbered receipt, preserve every invariant, and rerun the failed and relevant prior gates. A change receipt may narrow a later assumption but cannot expand files, provider authority, credentials, or activation.

## 16. Stop conditions

- READ_AUTHORITY_SNAPSHOT requires independent reads
- primary-authoritative routing cannot be represented
- runtime authority would use cache or stale state
- any protected or non-allowlisted file must change;
- a third repair would be required.

## 17. Evidence outputs

Create exactly the Section 3 evidence paths. Conditional receipts are absent when unused. Evidence must state class `STATIC`, `SIMULATOR`, or `DISPOSABLE_PROVIDER_QUALIFICATION` and may not overclaim a stronger class.

## 18. Final sprint verdict options

- `PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_SPRINT_4_COMPLETE`
- `PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_SPRINT_4_BLOCKED`

## 19. No-deployment and no-activation statement

Sprint 4 never authorizes provider credential binding to a MORE environment, Vercel inspection or configuration, deployment, environment activation, tester authorization, public access, Stripe, voice, Luna, media, model routing, transcript persistence, or production customer data. This AFW expansion itself authorizes no implementation or provider activity.

