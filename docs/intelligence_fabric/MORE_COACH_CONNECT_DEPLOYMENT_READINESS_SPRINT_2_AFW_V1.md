# MORE Coach Connect Deployment Readiness — Sprint 2 AFW V1

## Authority and sprint purpose

Campaign: `MORE_CAMPAIGN_COACH_CONNECT_DEPLOYMENT_READINESS_V1`  
Sprint: `2 — Deployment Topology and Activation Gates`

Define a provider-neutral deployment adapter boundary and machine-verifiable
activation gates. Vercel remains the selected initial internal target, but this
AFW does not query, configure, inspect, or deploy to it.

## Dependencies and repository grounding

Sprint 1 must be complete. The approved topology requires an isolated,
globally edge-protected target with no public alias or custom domain. Current
repository routing does not prove internal-only access. Existing Production
Security Prerequisite activation flags remain authoritative and default-off.

## Exact allowed files

```text
src/lib/intelligenceFabric/coachConnect/deploymentReadiness/topology.js
src/lib/intelligenceFabric/coachConnect/deploymentReadiness/activationGates.js
test/intelligenceFabric.coachConnect.deploymentReadiness.topology.test.js
lab_outputs/coach_connect_deployment_readiness_v1/sprint_2_topology_proof.json
lab_outputs/coach_connect_deployment_readiness_v1/sprint_2_activation_gate_proof.json
lab_outputs/coach_connect_deployment_readiness_v1/sprint_2_deployment_receipt_contract.json
lab_outputs/coach_connect_deployment_readiness_v1/sprint_2_validation.json
```

## Exact prohibited files

`vercel.json`; package and lockfiles; CI configuration; every API route;
platform project configuration; environment and secret files; production
adapters; migrations; UI; protected product, scoring, Profile ID, Stripe,
persistence-authority, subscription, and canonical-authority roots.

## Contracts and schemas

Implement Part 2 `provider-neutral-topology-v1`,
`deployment-activation-gate-v1`, and `coach-connect-deployment-receipt-v1`.
The receipt must contain:

```text
deployment_receipt_version
deployment_window_id
artifact_sha
config_digest
environment_id
rollback_artifact
rollback_config_digest
deployment_operator
deployment_started
deployment_completed
deployment_result
activation_state
```

Extensions may only be those approved in Part 2. Deployment success and
activation are independent states. Any absent, expired, rejected, mismatched,
or unordered gate denies activation. Emergency-off and global-disable override
every approval. Provider-specific facts enter only through the adapter-shaped
input and are never inferred.

## Implementation sequence

1. Implement pure topology validation against the approved trust boundaries.
2. Implement gate records, ordering, expiry, subject, and artifact/config bind.
3. Implement deployment receipt validation and deployment/activation separation.
4. Add adversarial table tests and offline synthetic receipts.

## Tests and proof artifacts

Run `node --test test/intelligenceFabric.coachConnect.deploymentReadiness.topology.test.js`.
Prove rejected public aliases, missing global edge protection, cross-environment
reuse, gate bypass, stale approval, digest mismatch, emergency override,
operator mismatch, and `deployment_result=success` with activation still off.
Emit only the four allowlisted offline proofs.

## Sprint-local validation

Focused tests and import/export checks pass; receipt mandatory fields are exact;
provider-neutral language is preserved; Vercel is identified only as the
selected future internal target; allowlist, protected-root, HEAD, index, and
no-platform-action checks pass.

## Stop conditions

Stop if topology is ambiguous, internal-only reachability cannot be modeled,
gates can be bypassed, a platform query or credential is needed, an excluded
surface must change, or live providers, persistence, migration, deletion,
Stripe, public access, or deployment would be pulled forward.

## Bounded repair rules

Maximum two recorded, sprint-local fixes for schema, deterministic fixture, or
test defects. No repair may alter topology, gate authority, provider choice,
dependencies, or protected roots.

## Expected outputs and verdict

Expected outputs are two modules, one test, and four proof files.

- `DEPLOYMENT_READINESS_SPRINT_2_COMPLETE`
- `DEPLOYMENT_READINESS_SPRINT_2_BLOCKED`
- `DEPLOYMENT_READINESS_SPRINT_2_FAILED`

## No-deployment statement

Sprint 2 performs no deployment, Vercel inspection, platform mutation,
activation, public exposure, production connection, staging, commit, or push.
