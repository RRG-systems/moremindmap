# Recruiting Release 5 execution activation

This release changes the Mini V2 job executor from the legacy document-only
lock to an atomic owner lease. `MINI_V2_EXECUTION_ACTIVATION_ID` is a nonsecret,
deployment-scoped safety epoch. It is required in every Production-target
deployment of this release and must not be stored as a shared Production
project value.

## Preview canary

- Bind one stable, nonsecret activation ID to the `subscription-canary` Custom
  Environment for the full canary sequence so a Preview redeploy does not make
  its own resumable synthetic jobs look legacy.
- Do not attach that Preview value to Production.
- Unaliased Preview requests cannot start or age the canonical transition
  drain. Legacy or differently stamped jobs therefore remain closed there.

## First Production activation

1. Create a fresh cryptographically random activation ID in operator memory.
2. Supply it only as a deployment-level environment value while creating the
   exact reviewed Production-target candidate.
3. Validate the unaliased candidate without advancing customer jobs.
4. Promote that exact deployment only after all release gates pass.
5. The first canonical request starts an activation-keyed Redis server-time
   barrier. No nonterminal Mini V2 job advances until the full 800-second
   outgoing invocation window has drained.
6. Before alias promotion, also create and validate a separate exact-source
   Production-target quarantine deployment with
   `MINI_V2_EXECUTION_DISABLED=true`. Keep it unaliased and retain its exact
   deployment custody solely as the first step of an emergency rollback.

Production execution fails closed if the activation ID is missing. Logs,
evidence, screenshots, and customer-visible responses may record only that the
binding exists; they must not record its value.

Every nonterminal Mini V2 advancement is denied on an unaliased
Production-target deployment. Provider-backed functional proof belongs in the
isolated Custom Preview environment; the unaliased Production target is for
read-only deployment, routing, privacy, and rollback validation.

## Rollback and re-promotion

- Rollback changes application code only. It does not rewrite, delete, or
  restore customer/job state.
- The v2 bridge publishes a legacy-visible lock horizon longer than the longest
  function invocation. That protects a legacy request that begins after the
  bridge is visible; it cannot stop a legacy request that read the job before
  the v2 claim. The mandatory quarantine below removes that overlap.
- Direct Release 5 v2 to legacy v1 alias rollback is prohibited.
- First alias the validated exact-source quarantine deployment whose server-side
  `MINI_V2_EXECUTION_DISABLED` binding is exactly `true`. Confirm the alias and
  binding metadata, and verify that canonical requests report no advancement.
- From the confirmed quarantine alias time, wait at least 800 seconds before
  moving the alias to the immediate pre-release legacy rollback deployment.
  Do not send legacy code mutating traffic during this drain.
- After the drain, alias the preserved immediate pre-release deployment and
  perform read-only routing plus ordinary customer-safe availability checks.
- Never re-alias a previously used Release 5 deployment after any rollback.
- To re-promote the same source commit, create a new Production-target
  deployment with a fresh activation ID, validate that new deployment, and
  then promote it. The fresh epoch forces a new full drain even when v1
  preserved an earlier v2 protocol marker while it was active.

The immediate pre-release Production deployment remains the code rollback
target. A rollback is not permission to alter Redis, provider credentials,
customer data, or canonical evidence.
