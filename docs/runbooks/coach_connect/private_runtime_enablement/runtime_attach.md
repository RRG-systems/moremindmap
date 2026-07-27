# Private Runtime Attachment

## Purpose and authority

Describe exact-scope attachment of the one canonical Business Engine, existing Subscription Runtime, and existing Coach Connect. The bridge creates no duplicate runtime.

## Preconditions

- Current subject, session, approval, capability, and security epoch.
- One canonical Business Engine reference/version/hash.
- Injected existing Subscription Runtime and Coach Connect services.
- Exact scope agreement across every predecessor receipt.

## Exact safe sequence

1. Validate the attachment request and current authority.
2. Attach the canonical Business Engine read-only by reference/version/hash.
3. Attach the existing Subscription Runtime using the same scope and engine receipt.
4. Attach the existing Coach Connect using the same scope, engine, and subscription receipts.
5. Validate all cross-receipt references.
6. Publish the combined attachment set only after all three succeed.

## Failure and stop behavior

Discard partial handles on missing, duplicate, stale, ambiguous, or mismatched state. Preserve the canonical Business Engine unchanged.

## Emergency disable

Emergency disable prevents new attachment publication and makes prior attachment handles stale through the security epoch.

## Receipt and evidence outputs

Record receipt versions, opaque attachment refs, exact scope hash, one-engine count, no-duplicate booleans, and zero external calls.

## Prohibited actions

No Business Engine payload copy, new service/runtime, Profile ID mutation, provider call, production persistence, transcript, Stripe, migration, deployment, staging, or commit.

## Escalation owner

`RUNTIME_AUTHORITY_OWNER_TBD`
