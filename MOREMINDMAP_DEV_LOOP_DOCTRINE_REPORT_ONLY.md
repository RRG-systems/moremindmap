# MORE MindMap Development Loop Doctrine and Product Reality Boundary, Report-Only

Sprint: `MM-DL-1`

Verdict: `MOREMINDMAP_DEV_LOOP_DOCTRINE_COMPLETE_WITH_LIMITS`

Classification: `MOREMINDMAP_DEVELOPMENT_LOOP_DOCTRINE_DEFINED_WITH_LIMITS`

Highest allowed readiness: `READY_FOR_HUMAN_REVIEW_OF_MOREMINDMAP_DEV_LOOP_DOCTRINE`

This document defines doctrine only. It creates no runtime loop, no batch execution, no Codex automation, no active agents, no queues, no persistence layer, no UI, no routes, no Stripe work, no Formspree work, no subscription work, no Outcome Ledger work, no MOLT integration, and no production deploy authority.

## Core Product Law

No pretty demos.

Everything must be real.

Everything must work.

Every saved artifact must be retrievable.

Every failed layer must preserve state.

Every generation failure must return controlled diagnostics.

Every visible claim must be backed by source, extraction, model estimate, or admitted missing data.

No fake confidence.

No decorative intelligence.

No frontend illusion hiding backend weakness.

If a real person can touch it, it must behave like a real system.

## Current MORE MindMap Product Reality

V1 is assessment intelligence live. Current working outputs include Behavior Profile, Business Assessment, Business Intelligence Draft, Executive Diagnostic, Business Map, Five Futures, One Move, Profile ID retrieval, layered save-state, and controlled recovery for generation failures.

The recent Executive Diagnostic and Five Futures recovery work established the operating rule for complex intelligence:

- Save intake before generation.
- Save draft before briefing.
- Save briefing before futures.
- Generate Five Futures and One Move in stages.
- Validate before save.
- Never expose partial or broken artifacts.
- Return controlled diagnostics instead of silent server failure.
- Preserve user record state on failure.
- Verify production, not only local build.

## 1. Human Governor Doctrine

Human governs.

ChatGPT Think may architect, critique, and review.

Codex may build only the explicitly approved scope.

Codex may accelerate development, but Codex may not approve production truth. Codex may not lower validation standards. Codex may not fake saved artifacts. Codex may not expose partial intelligence. Codex may not deploy without human approval.

The development loop exists to make bounded sprint work safer. It does not transfer authority away from the human governor.

## 2. MORE MindMap Development Loop Roles

All roles below are report-only in `MM-DL-1`. None has production authority. None may deploy. None may lower validation. None may expose partial artifacts. None may fake success.

### HUMAN_GOVERNOR

- role_id: `HUMAN_GOVERNOR`
- role_name: Human Governor
- allowed_responsibilities: Define product intent, approve sprint scope, approve production deploys, accept or reject recommendations, decide whether a stop condition can be cleared.
- forbidden_responsibilities: None assigned by automation; human authority is not delegated to code.
- allowed_outputs: Approval, rejection, clarification, scope boundary, deploy authorization, stop-condition override.
- forbidden_outputs: Automated production changes without explicit action.
- authority_status: `NO_PRODUCTION_AUTHORITY` for this report-only doctrine artifact.
- can_modify_production: false
- can_deploy: false
- can_lower_validation: false
- can_expose_partial_artifacts: false
- can_fake_success: false
- report_only: true

### CHATGPT_ARCHITECT

- role_id: `CHATGPT_ARCHITECT`
- role_name: ChatGPT Architect
- allowed_responsibilities: Translate product intent into sprint scope, identify architecture risks, propose allowlists, define verification expectations, review Codex reports.
- forbidden_responsibilities: Modify code directly, deploy, approve production truth, bypass human review, lower validation standards.
- allowed_outputs: Architecture notes, sprint packet recommendations, risk review, review comments, stop-condition recommendations.
- forbidden_outputs: Runtime changes, production mutation, deploy authorization, fake pass reports.
- authority_status: `NO_PRODUCTION_AUTHORITY`
- can_modify_production: false
- can_deploy: false
- can_lower_validation: false
- can_expose_partial_artifacts: false
- can_fake_success: false
- report_only: true

### CODEX_BUILDER

- role_id: `CODEX_BUILDER`
- role_name: Codex Builder
- allowed_responsibilities: Implement explicitly approved scoped changes, run required checks, report files changed, report failures honestly, stop when stop conditions are hit.
- forbidden_responsibilities: Touch files outside allowlist, deploy without approval, implement unapproved product areas, hide errors, lower validation gates, expose partial artifacts.
- allowed_outputs: Code changes within allowlist when approved, verification output, failure diagnostics, final status report.
- forbidden_outputs: Unapproved runtime, unapproved routes, unapproved automation, fake success, partial intelligence exposed as complete.
- authority_status: `NO_PRODUCTION_AUTHORITY`
- can_modify_production: false
- can_deploy: false
- can_lower_validation: false
- can_expose_partial_artifacts: false
- can_fake_success: false
- report_only: true

### PRODUCT_REALITY_REVIEWER

- role_id: `PRODUCT_REALITY_REVIEWER`
- role_name: Product Reality Reviewer
- allowed_responsibilities: Check whether the implemented behavior is real, retrievable, source-backed, and not a frontend illusion.
- forbidden_responsibilities: Approve deployment, alter product scope, excuse missing backend behavior behind UI polish.
- allowed_outputs: Product reality review, gap list, pass/fail recommendation, stop-condition findings.
- forbidden_outputs: Deployment approval, validation downgrades, fake readiness claims.
- authority_status: `NO_PRODUCTION_AUTHORITY`
- can_modify_production: false
- can_deploy: false
- can_lower_validation: false
- can_expose_partial_artifacts: false
- can_fake_success: false
- report_only: true

### ARCHITECTURE_REVIEWER

- role_id: `ARCHITECTURE_REVIEWER`
- role_name: Architecture Reviewer
- allowed_responsibilities: Review layering, persistence, retrieval, failure boundaries, route/API contracts, and future extensibility.
- forbidden_responsibilities: Ship unapproved architecture, create active workers, add queues, approve production deploys.
- allowed_outputs: Architecture risk report, recommended constraints, refactor recommendations.
- forbidden_outputs: Runtime execution, production mutation, deploy approval.
- authority_status: `NO_PRODUCTION_AUTHORITY`
- can_modify_production: false
- can_deploy: false
- can_lower_validation: false
- can_expose_partial_artifacts: false
- can_fake_success: false
- report_only: true

### DATA_INTEGRITY_REVIEWER

- role_id: `DATA_INTEGRITY_REVIEWER`
- role_name: Data Integrity Reviewer
- allowed_responsibilities: Verify saved artifacts, retrieval behavior, schema discipline, source labels, validation gates, and controlled diagnostics.
- forbidden_responsibilities: Accept corrupted records, approve partial saves as complete, infer unsupported facts, lower schema requirements.
- allowed_outputs: Data integrity report, artifact save/retrieve findings, schema risk notes.
- forbidden_outputs: Fake data, hidden placeholder data, validation bypass.
- authority_status: `NO_PRODUCTION_AUTHORITY`
- can_modify_production: false
- can_deploy: false
- can_lower_validation: false
- can_expose_partial_artifacts: false
- can_fake_success: false
- report_only: true

### PRODUCTION_VERIFICATION_REVIEWER

- role_id: `PRODUCTION_VERIFICATION_REVIEWER`
- role_name: Production Verification Reviewer
- allowed_responsibilities: Verify production routes, records, artifacts, browser/runtime errors, and user-visible claims after an approved deployment.
- forbidden_responsibilities: Deploy, approve deploy, skip production verification, substitute local-only checks for production truth.
- allowed_outputs: Production verification report, route check results, runtime error count, caveats.
- forbidden_outputs: Deploy approval, unverified readiness claim, fake production pass.
- authority_status: `NO_PRODUCTION_AUTHORITY`
- can_modify_production: false
- can_deploy: false
- can_lower_validation: false
- can_expose_partial_artifacts: false
- can_fake_success: false
- report_only: true

### STOP_CONDITION_MONITOR

- role_id: `STOP_CONDITION_MONITOR`
- role_name: Stop Condition Monitor
- allowed_responsibilities: Detect stop conditions, require pause/report, prevent continuation when product reality is broken.
- forbidden_responsibilities: Override stop conditions, deploy through a stop condition, hide stop-condition evidence.
- allowed_outputs: Stop report, blocking reason, required human decision.
- forbidden_outputs: Silent continuation, fake pass, validation downgrade.
- authority_status: `NO_PRODUCTION_AUTHORITY`
- can_modify_production: false
- can_deploy: false
- can_lower_validation: false
- can_expose_partial_artifacts: false
- can_fake_success: false
- report_only: true

### EVIDENCE_AUDITOR

- role_id: `EVIDENCE_AUDITOR`
- role_name: Evidence Auditor
- allowed_responsibilities: Verify visible claims are backed by user-provided data, extraction, model estimate, or admitted missing data.
- forbidden_responsibilities: Accept decorative intelligence, accept unsupported certainty, convert guesses into facts.
- allowed_outputs: Evidence audit, unsupported-claim findings, source-label recommendations.
- forbidden_outputs: Unsupported claims, fake confidence, hidden source gaps.
- authority_status: `NO_PRODUCTION_AUTHORITY`
- can_modify_production: false
- can_deploy: false
- can_lower_validation: false
- can_expose_partial_artifacts: false
- can_fake_success: false
- report_only: true

## 3. MORE MindMap Product Reality Stop Conditions

Stop if any of the following occur:

- Build fails.
- Route fails.
- Retrieval fails.
- Saved artifact is missing.
- Frontend claims an artifact exists but backend did not save it.
- Raw JSON or debug output appears in user-visible product surfaces.
- Fake profile, fake company, or fake headshot appears.
- Craig Fox or Fathom placeholder content leaks where not intended.
- Payment state is ambiguous.
- Webhook verification fails.
- Subscription usage state is ambiguous.
- Outcome Ledger write fails.
- Generation corrupts a saved draft.
- Executive Diagnostic fails without controlled diagnostics.
- Five Futures fails without controlled diagnostics.
- One Move fails without controlled diagnostics.
- Codex touches files outside the approved allowlist.
- Production verification is incomplete.
- A user-visible feature cannot be retrieved after save.

Stop means pause, preserve state, report exact evidence, and require human review before further production-facing work.

## 4. Future Sprint Batch Packet Doctrine

This section defines a future packet shape only. It does not implement batch execution.

A future sprint batch packet should include:

- batch_id
- sprint_ids
- goal
- allowed_files
- forbidden_files
- allowed_behavior
- forbidden_behavior
- stop_conditions
- max_sprint_count
- max_repair_attempts
- human_approval_required
- production_deploy_allowed
- verification_required
- closure_report_required

No future batch packet may grant Codex authority to lower validation, fake saved artifacts, expose partial intelligence, or deploy without explicit human approval.

## 5. Future Codex Result Packet Doctrine

Every future Codex build should report:

- files changed
- code changed yes/no
- tests run
- build result
- route checks
- production checks if deployed
- artifact save/retrieve checks
- regressions checked
- raw JSON/debug checks
- banned placeholder checks
- failure diagnostics
- final git status
- recommendation

The result packet must distinguish local validation from production verification. It must clearly state whether production was touched.

## 6. MORE MindMap Development Loop Phases

- MM-DL-1: Development Loop Doctrine and Product Reality Boundary.
- MM-DL-2: Sprint Batch Packet Schema.
- MM-DL-3: Codex Builder Result Packet.
- MM-DL-4: Product Reality Review Packet.
- MM-DL-5: Stop Condition Schema.
- MM-DL-6: Repair / Archive / Human Approval Packet.
- MM-DL-7: Synthetic Canary Batch.
- MM-DL-8: First real bounded batch candidate, possibly Stripe + notification plumbing, only after human review.

## 7. First Real Batch Candidate

Candidate: Stripe one-time access + Darren notification events.

Possible sprints:

- Trace current ingress/payment/promo architecture.
- Implement Stripe one-time checkout for Behavior Profile and Business Assessment.
- Implement notification events for profile/assessment completion and ready states.
- Closure audit and production verification.

This is only a candidate. It is not approved automatically by this doctrine.

## 8. What This Enables

This enables report-only doctrine for a future governed MORE MindMap development loop. It gives later sprint packets a product reality boundary, authority model, stop-condition baseline, and reporting expectation.

## 9. What This Does Not Enable

This does not enable a runtime loop, batch execution, Codex automation, active agents, Stripe work, Formspree work, subscription work, Outcome Ledger work, MOLT integration, production deploys, frontend changes, API changes, or assessment generation changes.

## 10. Recommended Next Step

Recommended next sprint: `MM-DL-2`, Sprint Batch Packet Schema, after human review of this doctrine.
