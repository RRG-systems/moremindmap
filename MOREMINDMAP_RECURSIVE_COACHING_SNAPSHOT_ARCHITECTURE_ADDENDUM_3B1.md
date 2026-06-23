# Recursive Coaching Snapshot Architecture Addendum

Phase: MM-ADMIN-3B.1

## Executive Summary

Verdict: MOREMINDMAP_RECURSIVE_COACHING_SNAPSHOT_ARCHITECTURE_ADDENDUM_COMPLETE_WITH_LIMITS

Classification: MOREMINDMAP_RECURSIVE_COACHING_SNAPSHOT_ARCHITECTURE_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_HUMAN_REVIEW_OF_RECURSIVE_COACHING_SNAPSHOT_ARCHITECTURE

This report-only addendum generalizes the Darren Leadership Intelligence Snapshot architecture so it does not become a one-off snowflake.

Darren should remain the prototype instance, but the same architecture should later support recursive coaching subscriptions, weekly sessions, monthly refreshes, Outcome Ledger integration, Five Futures + One Move updates, and profile-aware subscriber intelligence.

No code, routes, UI, Redis writes, generation, chat, subscription logic, Outcome Ledger runtime, Stripe, RRG runtime, Executive Diagnostic, Business Map, Five Futures, or One Move behavior changed in this sprint.

## Why Darren Must Not Become A One-Off

The Darren route proves the first useful shape:

- retrieve a profile
- retrieve linked context
- source-label every claim
- expose a sanitized strategic mirror
- identify evidence gaps
- define proof targets
- prevent overclaiming
- scaffold Five Futures and One Move without generating final intelligence

That shape is bigger than Darren. It should become the standard pattern for future paid recursive coaching snapshots.

If Darren remains a snowflake, the system risks:

- duplicated snapshot logic
- inconsistent source labels
- different truth boundaries per user
- chat layers without grounded snapshots
- Outcome Ledger events that cannot be linked back to a strategic state
- subscription users receiving weaker or fake coaching experiences

## Current Darren-Specific Elements

The current `api/admin/darren-intelligence-snapshot.js` route includes Darren-specific elements:

- hardcoded profile ID: `mm-20260527-6zshuaao`
- hardcoded behavioral identity: `Momentum Machine`
- hardcoded role lane: `momentum + sales`
- D.J. context: `vision + build`
- $250M company goal
- $15M-$30M gross revenue scenario lens
- MMM + RRG business context
- partner capital path
- channel distribution path
- E->P lens tuned to Darren's momentum/sales role
- admin-only access through the Leadership Dashboard admin code
- Leadership Sales Dashboard metrics context
- Strategic Build Map context
- overclaim boundaries specific to valuation, partner interest, channel reach, RRG readiness, and cross-vertical claims

These should remain valid for Darren, but they should be represented as configuration/context over a generic snapshot shape.

## Reusable Snapshot Elements

Reusable elements from the Darren implementation:

- profile identity retrieval
- canonical profile availability check
- linked context retrieval
- source-labeling model
- sanitized identity summary
- behavioral summary
- dashboard/activity metric context
- goal model
- current business context
- E->P or other operating lens
- path comparison model
- unavailable fields
- truth boundaries
- evidence gaps
- proof targets
- what not to overclaim
- Five Futures scaffold
- One Move scaffold
- cost-control metadata
- controlled 403 access pattern
- read-only snapshot response
- no raw dossier / no raw answers guardrail

## Generic Recursive Coaching Snapshot Schema

Future generic snapshot should support:

- `snapshot_id`
- `profile_id`
- `user_type`
- `context_type`
- `created_at`
- `source_labels`
- `identity_summary`
- `behavioral_summary`
- `current_goal`
- `current_business_context`
- `financial_context`
- `dashboard_or_activity_metrics`
- `prior_snapshot_reference`
- `prior_one_move_reference`
- `outcome_ledger_references`
- `evidence_gaps`
- `proof_targets`
- `five_futures_scaffold`
- `one_move_scaffold`
- `coaching_style`
- `unavailable_fields`
- `truth_boundaries`
- `cost_control_metadata`

Future user/context types should include:

- real estate agent
- real estate team leader
- brokerage leader
- mortgage partner
- recruiting leader
- Darren/admin/internal leader
- future cross-vertical user

The snapshot should be the strategic mirror: current state, source labels, evidence gaps, proof targets, and action scaffold.

## Future Storage Model

Do not store ongoing chats directly inside canonical dossiers.

Recommended linked structures:

- `canonical_profile:{profile_id}` = who the person is
- `intelligence_snapshot:{snapshot_id}` = current interpretation
- `intelligence_latest:{profile_id}:{context_type}` = pointer to latest snapshot
- `coaching_session:{session_id}` = chat/session record
- `coaching_session_summary:{session_id}` = compact summary
- `outcome_ledger_event:{event_id}` = what happened after actions
- `one_move:{move_id}` = assigned action
- `future_state:{snapshot_id}` = Five Futures version

This keeps identity, interpretation, session history, action commitments, and outcome evidence separate.

## Outcome Ledger Relationship

The architecture should define clear responsibilities:

- Snapshot = current strategic mirror
- Outcome Ledger = history of what happened after action
- Chat = exploration interface
- One Move = action commitment
- Future refresh = updated trajectory based on evidence/outcomes

The snapshot should read prior Outcome Ledger events, not replace them.

Outcome Ledger should not become raw chat storage. It should store structured events such as:

- action assigned
- action completed
- action skipped
- result observed
- metric changed
- evidence added
- blocker encountered
- user self-report submitted

## Subscription Architecture Implications

For a future `$23.95/month` recursive coaching plan:

- entitlement check is required before paid coaching access
- usage limits are required
- weekly coaching session count is required
- monthly refresh count is required
- snapshot generation should be controlled and cached
- GPT-5.5 should only be used for strategic synthesis
- cheaper/cached responses should handle simple display
- every paid user should have source-labeled outputs
- no fake coaching
- no fake progress
- no chat without a grounded snapshot
- no outcome claims without Outcome Ledger evidence

Cost-control architecture should include:

- cached profile summary
- cached latest snapshot
- compact coaching session summaries
- monthly full refresh eligibility
- weekly coaching session eligibility
- prompt/version metadata
- model/token diagnostics
- controlled timeouts
- graceful failure diagnostics

## Future API Route Recommendations

Future recommendations only, not implemented:

- `GET /api/intelligence/snapshot?profile_id=...&context_type=...`
- `POST /api/intelligence/snapshot/generate`
- `GET /api/intelligence/latest?profile_id=...`
- `POST /api/coaching/session/start`
- `POST /api/coaching/session/message`
- `POST /api/outcome-ledger/event`

These routes should be added only after entitlement, source-label, storage, validation, cost-control, and privacy rules are reviewed.

## Darren Route Evolution Recommendation

Recommendation: keep the Darren-specific admin route for now, then refactor shared helper functions before chat.

Do not immediately refactor before the route is deployed and smoke-tested. The current route is useful as a prototype and review surface.

Do not wait until subscription infrastructure to extract shared logic. Chat and subscription work will become riskier if the generic snapshot shape is not separated first.

Recommended sequence:

1. Keep `GET /api/admin/darren-intelligence-snapshot` as the admin prototype.
2. Deploy and smoke-test the Darren route.
3. Before MM-ADMIN-3D chat, extract shared helpers:
   - profile identity extraction
   - context retrieval
   - source-label assembly
   - snapshot scaffold builder
   - truth-boundary builder
   - Five Futures scaffold builder
   - One Move scaffold builder
4. Build generic snapshot storage and latest-pointer model before recursive subscription rollout.

This gives Darren value quickly while preventing the chat/subscription layer from being built on a snowflake.

## Stop Conditions

Stop future generic implementation if:

- raw dossier exposure would occur
- raw answer exposure would occur
- uncontrolled GPT cost is possible
- chat is introduced without snapshot grounding
- outcome update has no clear event type
- subscription coaching lacks entitlement checks
- valuation/revenue claims lack source labels
- user ideas become build instructions automatically
- snapshot writes can corrupt canonical profiles
- latest snapshot pointers can point to invalid snapshots
- Outcome Ledger events cannot be retrieved
- paid users could see fake coaching or fake progress
- Five Futures or One Move refresh lacks validation

## Limits

- Report-only addendum.
- No code changes.
- No routes created.
- No UI created.
- No Redis writes.
- No generation triggered.
- No chat implemented.
- No subscription logic implemented.
- No Outcome Ledger runtime implemented.
- No deployment.
