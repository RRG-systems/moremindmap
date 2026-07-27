# Private Runtime Incident Response

## Purpose and authority

Describe offline decision boundaries for a private-runtime security, privacy, attachment, or availability incident.

## Preconditions

- Privacy-safe incident correlation reference.
- Current default-off and emergency-control status.
- Current shared-state health and security epoch receipts.
- Named human incident authority placeholder.

## Exact safe sequence

1. Assert emergency disable when authority or privacy is uncertain.
2. Stop new calls and detach unpublished/active runtime handles.
3. Preserve canonical engine state and content-free audit receipts.
4. Classify the failure using stable private-runtime codes.
5. Verify zero provider, persistence, transcript, Stripe, and deployment calls.
6. Compare protected roots and changed-file allowlists.
7. Require separate human authority before any recovery attempt.

## Failure and stop behavior

Stop on unknown scope, ambiguous subject, surviving capability, sensitive evidence, protected-root drift, or nonzero external call.

## Emergency disable

Emergency disable remains dominant throughout triage and is never cleared by an automated verifier.

## Receipt and evidence outputs

Record opaque incident/correlation refs, safe failure codes, gate booleans, counts, root hashes, and escalation status.

## Prohibited actions

No secrets in tickets, raw customer content, provider console action, deletion, migration, public messaging, deployment, staging, or commit.

## Escalation owner

`INCIDENT_COMMANDER_TBD`
