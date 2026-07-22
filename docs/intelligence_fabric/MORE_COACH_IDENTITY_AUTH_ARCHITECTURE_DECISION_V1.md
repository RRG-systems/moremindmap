# Architecture Decision: Coach Identity Auth Foundation V1

Status: accepted for synthetic, default-off foundation use
Date: 2026-07-21

## Decision

Use a provider-neutral identity boundary inside Intelligence Fabric. A durable coach actor references, but does not duplicate, a future external provider subject. Session storage holds only opaque token hashes. All authorization-shaped decisions pass through a fail-closed validator that checks activation controls, token binding, actor binding, account state, expiry instant, session state, and security version.

The acceptance context is an expiring, browser-bound continuation record. It may remember an opaque future invitation reference and resume after authentication, but it cannot contain subscriber scope or grant relationship, entitlement, consent, data-access, or Coach Connect authority.

## Threat model and controls

- Credential theft: no password store; raw bearer token is never persisted or audited.
- Session fixation/replay: service-generated token, hashed binding, rotation invalidates prior session, terminal states reject replay.
- Actor substitution: optional expected actor and acceptance actor/session binding fail closed.
- Account compromise: suspension, lock, revocation, and verification changes advance security version and invalidate prior sessions.
- Context theft: short expiry, opaque reference, browser hash, exact session/actor binding, consumption and revocation.
- Privilege escalation: future auth decision explicitly does not evaluate relationship, entitlement, or subscriber consent and grants no Coach Connect access.
- Unsafe activation: capability flags default off, synthetic-only is required, production traffic must remain false, emergency disable wins.
- Audit leakage: allowlisted event schema stores only opaque references and reason codes.

## Consequences

This provides stable contracts and deterministic tests without choosing or activating a live provider. Production provider integration, secure cookie transport, operational rate limiting, recovery/MFA policy, persistence migration, monitoring, and production readiness remain future work requiring explicit authorization.
