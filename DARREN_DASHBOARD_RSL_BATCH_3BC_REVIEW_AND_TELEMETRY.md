# Darren Dashboard RSL Batch 3BC - Review and Telemetry Loop

Phase: DASH-RSL-BATCH-3BC

## Verdict

`DASH_RSL_BATCH_3BC_READY_FOR_VALIDATION_AND_DEPLOY`

This sprint adds the first governed human decision layer and the first minimal value telemetry layer for Darren's dashboard. The dashboard now has a way to record a review decision without changing Five Futures, One Move, active strategy, or future movement automatically. It also records a small set of product-value events so the system can begin learning which surfaces Darren actually uses.

## Files Changed

- `api/admin/darren-strategy-review-core.js`
- `api/admin/darren-strategy-review.js`
- `api/admin/darren-usage-event-core.js`
- `api/admin/darren-usage-event.js`
- `src/components/DarrenLeadershipIntelligencePanel.jsx`
- `src/components/LeadershipSalesDashboard.jsx`
- `src/components/dashboard/LeadershipAppStackPanel.jsx`
- `DARREN_DASHBOARD_RSL_BATCH_3BC_REVIEW_AND_TELEMETRY.md`
- `runtime_traces/darren_dashboard_rsl_batch_3bc_review_and_telemetry.json`

## Runtime Change

Runtime changed: yes.

Backend changed: yes.

Frontend changed: yes.

Persistence changed: yes, append-only Darren-specific records.

Global model behavior changed: no.

Strategy Chat GPT-5.5 wiring changed: no.

## New Routes

- `POST /api/admin/darren-strategy-review`
- `POST /api/admin/darren-usage-event`

Both routes require the existing admin code header and return controlled JSON.

## Strategy Review Schema

Review records include:

- `review_id`
- `subject_id`
- `subject_type`
- `source_type`
- `source_id`
- `source_title`
- `decision_status`
- `active_strategy_candidate`
- `human_notes`
- `evidence_basis`
- `linked_one_move`
- `linked_future_context`
- `created_at`
- `reviewed_at`
- `created_by`
- `mutation_scope`
- `no_auto_future_movement`

Allowed review statuses:

- `accepted`
- `rejected`
- `revised`
- `needs_discussion`
- `deferred`

Accepted reviews are marked only as `active_strategy_candidate` inside the review record. They do not promote, replace, or rewrite any generated strategy artifact.

## Telemetry Schema

Usage events include:

- `event_id`
- `subject_id`
- `event_type`
- `event_source`
- `panel_id`
- `action_id`
- `related_strategy_review_id`
- `related_one_move_id`
- `related_proof_target_id`
- `related_chat_session_id`
- `metadata`
- `created_at`

Tracked event types:

- `dashboard_opened`
- `panel_opened`
- `panel_collapsed`
- `strategy_chat_prompt_submitted`
- `strategy_chat_response_received`
- `strategy_review_opened`
- `strategy_recommendation_accepted`
- `strategy_recommendation_rejected`
- `strategy_recommendation_revised`
- `strategy_recommendation_deferred`
- `one_move_reviewed`
- `proof_target_reviewed`
- `evidence_added`
- `outcome_added`
- `future_movement_reviewed`

Telemetry is intentionally minimal. It does not track mouse movement, keystrokes, scroll depth, hesitation time, or raw private content.

## Frontend Changes

Added a compact Strategy Review area:

- Under Current Strategy / Five Futures / One Move
- Under Adaptive Strategy Draft when a draft exists

Added soft telemetry for:

- dashboard opened
- panel opened/collapsed
- Strategy Chat prompt submitted
- Strategy Chat response received
- strategy review decisions
- One Move reviewed
- evidence/outcome added
- future movement reviewed
- adaptive draft generation/review actions

Telemetry failures do not block dashboard functionality.

## Safety Boundaries

- No canonical dossier mutation.
- No Five Futures automatic mutation.
- No One Move automatic mutation.
- No future movement automatic mutation.
- No strategy replacement.
- No global model change.
- No public route change.
- No checkout/payment/Visual DNA/intake change.
- No employee/team people layer added.
- Human confirmation remains required for writes.

## Validation

Validation results are recorded in `runtime_traces/darren_dashboard_rsl_batch_3bc_review_and_telemetry.json`.

## Remaining Gaps

- Strategy reviews are append-only but not yet shown as a history list.
- Accepted review records do not yet create a new active strategy version.
- Usage telemetry is minimal and not yet surfaced in an admin insight view.
- Proof targets still need a full lifecycle with ID, owner, due date, status, and ledger linkage.
- Financial proof indexing remains a separate sprint.

## Estimated Score Improvement

- RSL: 54 -> 63
- Usage/value tracking: 12 -> 34
- Outcome Ledger/proof loop: 57 -> 65
- Subscription readiness: 35 -> 43
- Strategy Chat intelligence: 78 -> 81

## Deployment

Deploy is recommended after validation because runtime frontend and backend changed.
