# MORE Private Runtime Remote Shared Security Adapter — Sprint 2 AFW V1

Sprint:
`2 — Record and Keyspace Architecture`

Campaign:
`MORE_CAMPAIGN_PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_V1`

Architecture SHA-256:
`dbca624bf46540d1aae7b698dcffc81a845a10f43a28df70e8f7e22a1c4a0c8a`

Prerequisite commit:
`d0bde035a0519f8e89135204e88cd428ca0d5800`

AFW expansion implementation authority: `false`

## 1. Sprint purpose

Implement deterministic Redis key encoding, exact provider record schemas, service-facing projection maps, TTL/index validation, immutable namespace ownership, and strict privacy rejection using simulator fixtures only.

## 2. Dependencies

- Sprint 1 complete receipt
- frozen internal contracts and configuration schemas

No dependency may be inferred from provider availability, credentials, or a deployment.

## 3. Exact file allowlist

```text
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/keyspace.js
src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/recordSchemas.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.keyspace.test.js
test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.privacy.test.js
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/sprint_receipt.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/changed_files.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/contract_proof.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/focused_tests.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/race_failure_tests.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/environment_isolation_proof.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/secret_privacy_scan.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/protected_root_proof.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/provider_authority_boundary.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/repair_receipt_1.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/repair_receipt_2.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/change_receipt.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/record_keyspace_manifest.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/ttl_index_proof.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/namespace_isolation_proof.json
lab_outputs/coach_connect_private_runtime_remote_shared_security_adapter_v1/sprint_2/forbidden_material_rejection_proof.json
```

The two repair receipts and change receipt are conditional paths. Emit them only when the corresponding governed event occurs. Every other listed evidence file is mandatory. No glob expands this allowlist.

## 4. Prohibited files and actions

- every file outside Section 3;
- committed V2 contract, port, synthetic adapter, canonical service, facade, eligibility, live composition, handler, product, deployment, package, lockfile, CI, migration, and environment files;
- Business Engine, BA, BOS, Five Futures, One Move, Profile ID, Subscription Runtime, Coach Connect, Stripe, billing, model, Luna, voice, media, transcript, or public-onboarding changes;
- provider connection or credential activity except the explicitly gated Sprint 7 disposable qualification mode;
- staging, commit, push, Vercel inspection, deployment, environment activation, or tester authorization.

## 5. Contracts and schemas

- implement all ten architecture record families and exact record versions
- encode more:cc:security:v2:{environment_digest}:family:opaque_digest keys
- use keyed digests for token, subject, scope, browser, rate, replay, and audit lookups
- define forward/inverse mapping and session/entitlement revocation indexes
- validate provider-time expires_at plus PEXPIREAT agreement
- translate provider records to existing service-facing string versions without raw storage

## 6. Implementation sequence

1. verify Sprint 1 receipt and unchanged prior files
2. implement allowlisted key families and namespace ownership marker
3. implement closed record validators and record ETags
4. implement exact storage-to-service projection maps
5. implement TTL, terminal-status, index, tombstone, and epoch validators
6. run collision, Unicode, oversized, forbidden-material, and isolation tests
7. emit exact Sprint 2 evidence and receipt

## 7. Focused tests

- every record family has exact key, version, fields, privacy class, mutability, TTL, and indexes
- same logical input produces deterministic key and ETag
- different environments cannot collide
- unknown families, versions, fields, or corrupt TTLs deny
- service projections satisfy committed V2 consumers
- no raw value appears in keys or records

## 8. Concurrency and race tests

- two subjects cannot encode the same exact scope owner without an explicit conflict
- keyed digest collision fixture fails closed
- terminal revocation and expiry never reactivate
- concurrent namespace ownership claims have one exact owner

## 9. Outage and failure tests

- missing TTL on active expiring state, longer/shorter mismatch, wrong environment, corrupt index, unknown status, invalid chronology, and ETag mismatch deny
- projection cannot recover missing raw material by weakening privacy

## 10. Environment-isolation checks

- separate database digest plus environment hash tag and immutable ownership are required
- prefix-only isolation is explicitly insufficient for Preview/Production
- qualification fixtures require a unique run identifier and synthetic-only marker

## 11. Secret and privacy scans

- deny raw token, cookie, credential, access code, assertion, email, name, address, Profile ID, product content, transcript, prompt, or model output
- scan key names, provider records, indexes, fixtures, projections, and errors

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

- record projection requires raw identity or secret persistence
- namespace isolation requires shared live databases
- a migration or destructive deletion is required
- any protected or non-allowlisted file must change;
- a third repair would be required.

## 17. Evidence outputs

Create exactly the Section 3 evidence paths. Conditional receipts are absent when unused. Evidence must state class `STATIC`, `SIMULATOR`, or `DISPOSABLE_PROVIDER_QUALIFICATION` and may not overclaim a stronger class.

## 18. Final sprint verdict options

- `PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_SPRINT_2_COMPLETE`
- `PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_SPRINT_2_BLOCKED`

## 19. No-deployment and no-activation statement

Sprint 2 never authorizes provider credential binding to a MORE environment, Vercel inspection or configuration, deployment, environment activation, tester authorization, public access, Stripe, voice, Luna, media, model routing, transcript persistence, or production customer data. This AFW expansion itself authorizes no implementation or provider activity.

