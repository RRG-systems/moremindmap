# Private Runtime Subject Enrollment

## Purpose and authority

Describe the offline, human-approved enrollment boundary for one verified subscriber subject and one exact canonical scope. This runbook grants no provider, deployment, or customer-data authority.

## Preconditions

- Active human tester approval with purpose `FOUNDER_PRIVATE_RUNTIME_TEST`.
- Verified assertion reference from an injected verifier.
- Exact four-key canonical scope and matching approval hash.
- Healthy provider-neutral subject registry port.

## Exact safe sequence

1. Validate assertion version, issuer, audience, freshness, MFA strength, and session binding.
2. Validate tester approval, expiry, environment, subject reference, and scope hash.
3. Execute the registry port’s atomic one-to-one bind.
4. Resolve both directions and compare the exact mapping.
5. Emit only the privacy-safe subject receipt and uniqueness proof.

## Failure and stop behavior

Stop on unknown subjects without enrollment authority, conflicting mappings, expired approval, stale versions, real identity data, or any request for a live provider/store.

## Emergency disable

Do not begin enrollment while emergency disable is asserted. A disabled or recovery-pending subject cannot attach.

## Receipt and evidence outputs

Record the subject receipt version, opaque references, scope hash, mapping/security versions, result code, and zero external-call count.

## Prohibited actions

No self-enrollment, email/name/Profile ID inference, public registration, provider connection, production data, migration, staging, commit, or deployment.

## Escalation owner

`HUMAN_AUTHORITY_OWNER_TBD`
