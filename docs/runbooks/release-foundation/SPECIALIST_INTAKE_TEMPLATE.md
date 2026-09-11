# Specialist to Home Base release intake

Use this as the body of the verified Notion work package. Replace every bracketed
field; remove unused optional gates. Never paste credentials, customer data or
provider/model assignments.

## Ownership and exact custody

- Original specialist Scotty / task: `[builder and task link]`
- Home Base Spock review: `[review link]`
- Candidate purpose: `[one bounded user-visible outcome]`
- Candidate branch / commit / tree: `[exact values]`
- Current canonical baseline deployment / commit / tree / checkpoint: `[exact values]`
- Changed-file manifest and digest: `[path and SHA-256]`
- Existing evidence to reuse: `[links, hashes and limits]`

## Finite missing work for the original builder

1. `[specific behavior or integration gap]`
2. `[specific private-runtime/browser/provider gap]`
3. `[specific evidence or custody gap]`

Do not redesign adjacent Products or repeat already valid evidence. A local green
package is not release-ready until every applicable private-runtime gate below is
green.

## Expected behavior

- Role / user: `[who]`
- Entry path: `[route or action]`
- Visible result: `[observable behavior]`
- Durable result after save/reopen: `[state contract]`
- Denied behavior: `[negative boundary]`

## Applicable acceptance checks

- [ ] exact candidate and current baseline custody
- [ ] isolated synthetic identity and record scope
- [ ] role and permission boundaries
- [ ] Profile / relationship continuity
- [ ] durable save, reopen and restart (when state changes)
- [ ] explicit change-specific tests
- [ ] protected Product regressions affected by the change
- [ ] build, nonempty scoped lint, syntax/diff and privacy/secret checks
- [ ] private route and exact Origin agreement
- [ ] browser launch/close and responsive rendered QA (when UI changes)
- [ ] actual approved provider proof (when model behavior changes)
- [ ] non-human delivery success/failure/retry/idempotency (when mail changes)
- [ ] compatibility-aware private rollback and recovery

## Protected boundaries

- No Production alias/configuration/customer mutation without Home Base authority.
- No real customer, real charge or customer email in private proof.
- No secret value, provider assignment or blind model assignment in evidence.
- Preserve `[Products, namespaces, invitations, plans, outbox, consent and frozen evidence]`.
- `[release-specific Founder locks and STOP conditions]`

## Evidence required on return

- Exact branch, commit, tree, status and source/file manifest.
- Commands/check manifests and sanitized receipts with hashes and durations.
- Private deployment/configuration identity kept separate from code identity.
- Browser/provider/delivery/persistence proof only where applicable.
- Failing-gate receipts and repairs; no waived failures.
- Known limitations and unperformed gates stated plainly.
- Rollback compatibility, target and ordered procedure.

## Return route

The specialist returns the exact candidate and evidence to Home Base Spock.
Spock compares them with this package and either returns one finite missing-work
packet to the same builder or hands the accepted candidate to Home Base. Home
Base then re-resolves canonical Production, reconciles integration, runs the
affected protected release checks, and alone performs any authorized
Production-target deployment, promotion, live verification and canonical
closeout.
