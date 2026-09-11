# Home Base release rulebook

Version: 1.0
Owner: Home Base
Governing rule: exact Production first; two airlock lanes, one Production truth.

## Readiness

A release enters Home Base only with an identified builder, exact baseline and
candidate commit/tree, bounded change statement, changed-file manifest,
applicable checks, protected boundaries, evidence limitations and rollback
notes. Local or specialist green evidence is reusable input, not Production
authority.

Before any external action, re-resolve the canonical Ship's Log, live deployment,
source/tree, annotated checkpoint, rollback deployment, branch and worktree
cleanliness. A drifted baseline stops the release until it is reconciled without
discarding unique work.

## Authority

The Founder locks product intent. The specialist owns bounded implementation and
private proof. Home Base Spock writes finite missing-work instructions in the
verified Notion location. Home Base owns integration, exact-candidate release
checks, Production-target deployment, promotion, live verification, rollback and
canonical closeout.

A private rehearsal never grants Production authority. Production-target build,
alias movement, customer/provider mutation and promotion each require the
authority that governs that release.

## Fixed acceptance contract

Every release plan must pass the versioned contract in
`scripts/release-foundation/contract.mjs` and add change-specific checks. The
fixed checks cover:

- exact source, tree, deployment and environment custody;
- identity and customer-data isolation;
- least-privilege permissions;
- Profile/relationship continuity;
- durable save, close, reopen and restart behavior when state changes;
- protected Product and privacy/security boundaries;
- one private host used consistently for routing and Origin authorization;
- browser launch/close before rendered QA, then responsive rendered proof when
  the change has a UI surface;
- real provider and non-human email-sink proof only when the change requires it;
- compatibility-aware rollback.

An inapplicable provider, email, browser or persistence gate must be explicitly
marked `not-required` with a reason. A missing, failed or ambiguous required gate
blocks advancement. Test selection is explicit; a clean change set is a green
no-op and must never fall through to a whole-repository lint by accident.

## Private environment

Use only the existing `subscription-canary` Vercel Custom Environment described
by `PRIVATE_ENVIRONMENT.json`. It is Preview-only, SSO protected and backed by
isolated synthetic records. Ordinary Preview is prohibited for stateful
rehearsals because a general store record spans broader targets.

Secure bindings are referenced by provider metadata. Their values are never
read, printed, copied, logged, committed, placed in Notion or passed through the
release ledger. Before a new branch runs stateful work, prove that the custom
environment's isolated store and required provider classes materialize for that
exact branch. Fail closed if they do not; never fall back to a general or
Production store. A metadata-only branch attachment may be made only under the
release's authority and must preserve existing targets and values.

Keep synthetic identities, state namespaces and delivery sinks separate from
customers. Do not retarget or delete the Subscription experimentation sandbox.

## Procedure

1. Freeze authority, baseline, candidate, changed files and intended behavior.
2. Populate a release plan from a reviewed example; run its local contract and
   privacy checks before remote setup.
3. Verify the private environment, exact branch/runtime identity, secure-binding
   presence, stable private route and identical allowed Origin. Snapshot public
   aliases; unrequested alias movement is a stop condition.
4. Run the browser launch/data-URL/close preflight. Run explicit core and
   change-specific tests, build, scoped lint, syntax/diff and secret/privacy
   checks.
5. Deploy only to the named Custom Environment when a fresh deployment is
   required. The supported Vercel client may move the Custom Environment's one
   stable private alias automatically or leave the READY deployment unaliased;
   it does not support `--skip-domain` for this target. After exact metadata and
   SSO protection are proven, the adapter may select only that allowlisted
   private alias. Gate before either action and never use generic `promote` or
   project-wide `rollback` for this lane. Verify exact
   source/tree/config custody. Use isolated records and only the provider/email
   operations required by the change.
6. Run rendered desktop, iPad and mobile checks when applicable. Record fixed
   phases, numeric HTTP status and bounded error classes; never persist bodies,
   credentials or provider assignments.
7. Use `private-cycle.mjs` for an actual private deployment/target-selection/
   runtime/rollback cycle. Run `rehearse.mjs` only to replay a sealed Product
   evidence packet. Both use durable state paths. A stopped process resumes from
   the same plan/environment digests; drift is refused. Completed provider work
   is replayed from sealed receipts, not regenerated.
8. Exercise the declared private rollback. The actual-cycle tool may restore
   only its pre-captured stable private alias to a READY deployment in the same
   Custom Environment, and only while that alias still belongs to this run's
   candidate or captured baseline. A third deployment owner stops recovery
   without mutation. Direct switching is allowed only when protocols are
   compatible and no stateful work occurred. Otherwise quarantine, drain for at
   least the maximum in-flight duration, switch, then verify.
9. Seal sanitized receipts, durations, manual steps, limitations and hashes.
10. Only after separate Production authority: re-resolve Production again,
    create the exact Production-target candidate, validate it unaliased, promote
    only if green, verify live, publish the annotated checkpoint and update the
    canonical Ship's Log.

## Stop conditions

Stop on source/tree/config drift; missing private isolation; a required binding
that does not materialize; branch/runtime mismatch; route/Origin mismatch;
browser launch failure; required check failure; unexpected public alias movement;
secret material in evidence; customer-related state; incompatible undeclared
rollback; automatic-review rejection; or missing mutation/promotion authority.
Preserve the failed receipt and the last known-good rollback. Do not find a
different route around a denial.

## Live verification and rollback

Live verification is a separate gate from unaliased validation. It checks exact
deployment/source/tree, intended user-visible behavior, access boundaries,
privacy/CORS, protected Products, responsive rendering and rollback readiness.
Do not describe an authenticated workflow as live-tested when only its entry and
locked boundary were exercised.

Rollback changes only the application/configuration lane authorized by the
release. It does not rewrite customer state. Follow the plan's compatibility
steps, verify the disabled or prior target before switching, honor any drain,
then perform customer-safe read-only availability checks.

## Maintained assets

- Environment contract: `docs/runbooks/release-foundation/PRIVATE_ENVIRONMENT.json`
- Actual private-cycle contract: `docs/runbooks/release-foundation/ACTUAL_PRIVATE_CYCLE.md`
- Rehearsal plans: `docs/runbooks/release-foundation/rehearsals/`
- Contract and resumable runner: `scripts/release-foundation/`
- Tests: `test/releaseFoundation.test.js`
- Sanitized evidence: `docs/runbooks/release-foundation/evidence/`
- Specialist intake template: `docs/runbooks/release-foundation/SPECIALIST_INTAKE_TEMPLATE.md`
