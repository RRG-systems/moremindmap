# MM-ADMIN-4A Recursive Leadership Intelligence System Plan

## Executive Summary

MM-ADMIN-4A defines the next architecture layer for MORE MindMap's recursive leadership intelligence system.

The current Darren Leadership Intelligence system is live, useful, and safe, but it is not fully recursive yet. It can create a source-labeled snapshot and generate Darren's Five Futures + One Move, but it does not yet persist generated strategy, track acceptance, record outcomes, compare snapshots over time, or move future likelihood based on evidence.

This plan defines the durable architecture required to make the system learn honestly over time without faking memory, progress, revenue, RRG readiness, or outcome validation.

## Product Thesis: I Used MORE MindMap To Build MORE MindMap

The doctrine is literal: MORE MindMap should use its own intelligence architecture to build itself.

Darren's internal leadership cockpit is the first proof case. It should become the same recursive pattern later used by:

- paid agent subscriptions
- weekly recursive coaching
- monthly full refresh
- team intelligence
- Leadership Suite
- RRG opportunity detection
- multi-vertical leadership and revenue intelligence

The core product law remains: no fake learning. The system can only say it learned when it has stored evidence, outcomes, decisions, or tracked changes.

## Current Foundation

Live today:

- Leadership Portal access through `MOREADMIN26`
- Sales Dashboard V1
- Strategic Build Map
- Darren Leadership Intelligence Snapshot
- Darren Five Futures + One Move generation
- quality validation
- safety/privacy validation
- no raw source profile exposure
- no raw assessment answer exposure
- no chat
- no persistence
- no Outcome Ledger

## What Is Recursive Now

The system has the first loop shape:

- snapshot gathers current understanding
- generation creates Five Futures + One Move
- safety and quality gates prevent unsafe or weak output
- dashboard renders the result

This is recursive architecture in outline, not yet in durable memory.

## What Is Not Recursive Yet

Not live yet:

- saved generated strategy
- saved One Move
- One Move acceptance/modification/rejection
- outcome tracking
- evidence-weighted memory
- future likelihood movement
- since-last-snapshot comparison
- proof target library
- Safe to Sell / Roadmap / Do Not Claim Yet panel
- strategy chat grounded in stored summaries
- subscription entitlement gates

## Target Recursive Architecture

Relationship model:

- Canonical Profile = who the person is
- Snapshot = what the system currently understands
- Generated Five Futures + One Move = what the system recommends now
- Coaching Session = what the person explores or decides
- Outcome Ledger = what actually happened afterward
- Next Snapshot = updated understanding based on evidence

Darren uses `profile_id: mm-20260527-6zshuaao` and `context_type: darren_leadership_intelligence`.

Future subscribers should use the same pattern with context types such as:

- `real_estate_agent_coaching`
- `team_leadership`
- `brokerage_leadership`
- `mortgage_partner_intelligence`
- `cross_vertical_revenue_intelligence`

## Persistence Model

Persistence means durable storage of linked records, not mutation of canonical dossiers.

Persisted records should include:

- generated strategy
- One Move
- source snapshot reference
- assumptions
- proof target
- acceptance/rejection/modification
- outcome/result
- next snapshot reference

Canonical dossiers remain stable identity/profile anchors. Recursive memory lives in linked records.

## Storage Model

Recommended linked structures:

- `intelligence_snapshot:{snapshot_id}`
- `intelligence_latest:{profile_id}:{context_type}`
- `generated_strategy:{strategy_id}`
- `generated_strategy_latest:{profile_id}:{context_type}`
- `one_move:{move_id}`
- `outcome_ledger_event:{event_id}`
- `coaching_session:{session_id}`
- `coaching_session_summary:{session_id}`
- `future_state:{future_state_id}`

Every record should include:

- `profile_id`
- `context_type`
- `created_at`
- `source_labels`
- `version`
- `status`

Rules:

- do not store ongoing chat directly inside canonical dossiers
- do not store raw prompt/provider payloads as product memory
- do not mutate profile or assessment records to fake recursion

## Evidence-Weighted Memory

Memory items should be tagged as:

- idea
- hypothesis
- claim
- action
- evidence
- proof
- outcome
- invalidated assumption
- open question
- partner signal
- channel signal
- funding signal
- revenue signal
- RRG signal

Each memory item should include:

- `evidence_weight`: none / weak / early / moderate / strong / validated / invalidated
- `source`
- `confidence`
- `next_proof_needed`
- `related_path`
- `related_future`
- `related_one_move`

Core rule: Darren's ideas are not truth. They are hypotheses until supported by evidence.

## Five Futures Likelihood Movement

Use bands, not fake percentages.

Each future should include:

- `future_id`
- `name`
- `current_likelihood_band`: low / emerging / moderate / strong / leading / invalidated
- `previous_likelihood_band`
- `movement`: up / down / unchanged / new / invalidated
- `reason_for_movement`
- `evidence_added`
- `evidence_missing`
- `what_would_make_it_more_likely`
- `what_would_invalidate_it`

Movement must be evidence-based. No fake probability precision.

## What Changed Since Last Time

The "Since Last Snapshot" section should compare the latest snapshot against the prior snapshot.

Track:

- profiles changed
- assessments changed
- companies changed
- paid/revenue changed when available
- RRG metrics changed when available
- One Move status changed
- new evidence added
- assumptions validated
- assumptions invalidated
- future likelihood movement
- proof targets completed/missed

Unavailable fields must remain visible and honest.

## Proof Target Library

Proof targets should be organized by path.

### SaaS / Subscription Intelligence Path

- What it proves: recurring demand for profile-aware coaching
- Minimum viable proof: users pay, return weekly, and complete One Move updates
- Stronger proof: retention, refresh usage, referrals, measurable outcomes
- What does not count: verbal interest without payment or usage

### RRG-Powered Revenue Recovery Path

- What it proves: dormant relationships can become tracked revenue opportunities
- Minimum viable proof: tracked opportunities and reactivated conversations after RRG is live
- Stronger proof: appointments, referrals, recovered transactions, closings
- What does not count: claiming RRG results before RRG metrics exist

### Mortgage-Company Infrastructure Path

- What it proves: mortgage partners see MORE MindMap as infrastructure, not a novelty
- Minimum viable proof: funded or scoped pilot with a budget owner
- Stronger proof: partner-led onboarding and repeat usage
- What does not count: enthusiasm without scope, budget, or user access

### Brokerage Recruiting / Retention Intelligence Path

- What it proves: behavior intelligence improves recruiting, retention, and leader follow-up
- Minimum viable proof: brokerage leaders use profiles/assessments in recruiting conversations
- Stronger proof: repeat usage, retained agents, recruiting wins
- What does not count: a leader liking the concept without adoption

### Leadership Intelligence / LDE Path

- What it proves: MORE MindMap can become a leadership detection and decision system
- Minimum viable proof: recurring leadership decisions use snapshots, futures, and outcomes
- Stronger proof: teams and leaders depend on it monthly
- What does not count: roadmap language without runtime evidence

### Hybrid Ecosystem Path

- What it proves: MMM + RRG + Leadership Suite reinforce each other
- Minimum viable proof: one partner uses multiple pieces together
- Stronger proof: cross-product usage produces revenue or retention evidence
- What does not count: bundling language without linked usage

### Partner Capital / Strategic Funding Path

- What it proves: partners will fund acceleration before mature organic revenue
- Minimum viable proof: funded pilot, written scope, budget owner, term sheet, signed agreement
- Stronger proof: strategic capital that accelerates product proof without dangerous control
- What does not count: interest, meetings, or funding conversations without commitment

### Channel / Distribution Power Path

- What it proves: partners can create adoption faster than direct sales
- Minimum viable proof: audience access that creates profiles, assessments, or partner-led onboarding
- Stronger proof: repeat channel activation and measurable conversion
- What does not count: a warm introduction, audience reach, or access without adoption

### Multi-Vertical Platform Path

- What it proves: the model expands beyond real estate/lending beachheads
- Minimum viable proof: adjacent vertical users complete profiles/assessments and create measurable outcomes
- Stronger proof: repeatable proof across multiple verticals
- What does not count: theoretical TAM without usage evidence

## Safe To Sell / Roadmap / Do Not Claim Yet Boundary

Categories:

- Safe to sell now
- Safe to describe as roadmap
- Do not claim yet
- Internal only
- Evidence emerging

Safe to sell now:

- Behavior Profiles
- Business Assessments
- profile IDs
- dashboard visibility
- completion notifications
- current Build Map
- generated Darren Five Futures + One Move as internal leadership intelligence

Safe to describe as roadmap:

- subscriptions
- Outcome Ledger
- recursive coaching
- recruiting intelligence
- Leadership Suite
- MOLT Lite
- V2 runtime / LDE

Do not claim yet:

- revenue traction
- RRG recovery results
- predictive accuracy
- cross-vertical proof
- funded partner commitments
- channel adoption
- subscription retention
- outcome-validated coaching

This boundary should eventually feed Darren sales talk tracks, One Move generation, strategy chat, Build Map updates, and partner/investor conversations.

## Darren Recursive Experience

Darren should eventually see:

- Latest Snapshot
- Generated Five Futures + One Move
- Since Last Snapshot
- Current One Move status
- evidence-weighted memories
- proof targets
- what became more/less likely
- Safe to Sell / Do Not Claim Yet
- strategy chat grounded in all of the above

Darren should be able to:

- accept / modify / reject One Move
- log what happened
- classify a partner/channel/funding conversation
- ask the chat to test an idea
- ask what changed
- ask which future is becoming more likely
- ask what he can safely say now
- ask what proof he needs next

## Subscription Reuse Model

For future $23.95/month agent subscriptions:

- profile + business assessment + weekly update + last One Move + outcome ledger = new coaching snapshot
- subscription entitlement required
- usage counters required
- monthly refresh tracking required
- no coaching without access state
- no fake progress without user-reported or system-tracked outcomes

The same architecture should support teams, leaders, brokerages, mortgage partners, and future cross-vertical users.

## Implementation Sequence

Recommended sequence:

1. MM-ADMIN-4B: Persist generated Darren strategy as linked artifact.
2. MM-ADMIN-4C: One Move status plus acceptance/modification/rejection.
3. MM-ADMIN-4D: Outcome Ledger v0 for Darren.
4. MM-ADMIN-4E: Since Last Snapshot comparison.
5. MM-ADMIN-4F: Proof Target Library.
6. MM-ADMIN-4G: Safe to Sell / Do Not Claim Yet panel.
7. MM-ADMIN-4H: Strategy Chat planning.
8. MM-ADMIN-4I: Strategy Chat v1.

Rationale: persistence must come before chat. Outcome records must come before the system claims learning or future movement.

## Stop Conditions

Stop if:

- storage would mutate canonical dossier directly
- generated strategy cannot be linked by `profile_id` and `context_type`
- outcomes cannot be source-labeled
- future movement would be fake or probabilistic without evidence
- chat would not have saved summaries
- subscription coaching would not verify entitlement
- any system claims it learned without evidence/outcome records
- raw source profile or raw assessment answers would be exposed
- safety/truth boundaries are weakened

## Limits

This is report-only planning.

It does not implement persistence, UI, routes, chat, Outcome Ledger runtime, subscriptions, Stripe, RRG runtime, or any production behavior change.
