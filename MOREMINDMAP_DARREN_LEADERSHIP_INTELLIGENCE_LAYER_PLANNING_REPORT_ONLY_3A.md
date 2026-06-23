# Darren Leadership Intelligence Layer Planning

Phase: MM-ADMIN-3A

## Executive Summary

Verdict: MOREMINDMAP_DARREN_LEADERSHIP_INTELLIGENCE_LAYER_PLANNING_COMPLETE_WITH_LIMITS

Classification: MOREMINDMAP_DARREN_LEADERSHIP_INTELLIGENCE_LAYER_PLAN_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_HUMAN_REVIEW_OF_DARREN_LEADERSHIP_INTELLIGENCE_LAYER_PLAN

This is a report-only plan for adding Darren's own Leadership Intelligence experience inside the Leadership Sales Dashboard.

The core product pattern should be:

`Darren proposes. Dashboard measures. Evidence weighs. Five Futures updates. One Move focuses.`

The safest next product step is not chat. The next step is a structured Darren Intelligence Snapshot that can be generated, cached, source-labeled, and rendered before any GPT-5.5 strategy chat is exposed.

No code, routes, UI, Redis writes, profile writes, assessment writes, generation changes, Outcome Ledger runtime, RRG runtime, Stripe, subscriptions, Executive Diagnostic, Business Map, Five Futures, or One Move behavior were changed in this sprint.

## Product Thesis

Darren's dashboard should become the first Leadership Suite case study: a grounded leadership intelligence layer that connects Darren's Momentum Machine behavioral identity, MMM + RRG business ambition, real dashboard metrics, the Strategic Build Map, and evidence-weighted strategy output.

This is not generic chat and not motivational coaching. It is a governed leadership operating layer where ideas are treated as hypotheses until dashboard metrics, sales signals, financial data, and proof targets support them.

## Why This Layer Matters

The current dashboard tells Darren what is happening. The next layer should tell Darren what that activity means for the business he is trying to build.

For sales, it helps Darren explain:

- what exists now
- what is planned
- what should not be overclaimed
- what proof target matters next
- how MMM and RRG connect
- how the system could become a larger Leadership Suite and V2 platform if evidence accumulates

For product discipline, it prevents a sales-led roadmap from becoming unverified product truth.

## Current Dashboard Foundation

The Leadership Sales Dashboard V1 is live and already provides:

- real V1 activity visibility
- normalized company adoption
- displayed sales profile and assessment counts
- backend-sourced summary totals
- visible missing-data notes
- paid/free/promo/revenue unavailable boundary
- repo-backed Strategic Build Map in `src/data/leadershipBuildMap.js`

Access remains:

- `DARRENDEMO` routes to the existing Darren demo/presentation experience.
- `MOREADMIN26` routes to `/leadership-dashboard`.

## Darren Data Availability Inventory

Known Darren profile ID: `mm-20260527-6zshuaao`

Controlled read-only availability check:

- profile retrieval endpoint returned success
- canonical dossier is available
- behavioral intelligence summary is available
- visual DNA metadata was not found
- name category is available
- email category is available
- phone category was not available in the checked profile data
- company category is available
- role/title category was not available in the checked profile data

The report intentionally does not include raw profile text, raw canonical dossier content, answers, private identity values, or Redis keys.

## Darren Business Assessment Availability Inventory

Known possible assessment IDs:

- `ba-20260609-d379499d`
- `ba-20260609-1b9c8c7a`

Controlled read-only profile-linked assessment check for Darren:

- Business Assessment retrieval returned success
- linked assessment is available by Darren profile ID
- current status category: `five_futures_and_one_move_ready`
- Business Intelligence Draft is available
- Executive Diagnostic is available
- Five Futures is available
- One Move is available

The next implementation should resolve and store the exact assessment ID used by the snapshot without exposing raw assessment answers to the client.

## Dashboard / Build-Map Data Availability

Available from current dashboard/API and repo-backed source:

- total profile count
- total Business Assessment count for indexed assessment types
- profiles this month
- Business Assessments this month
- bounded recent profile summaries
- bounded recent Business Assessment summaries
- company adoption rows
- missing-data notes
- limits
- paid/free/promo/revenue unavailable label
- Strategic Build Map phases, status, sales meaning, current truth, and limits

Unavailable today:

- durable paid/free/promo totals
- durable revenue totals
- Stripe payment state connected to profile or assessment records
- subscription state
- Outcome Ledger state
- RRG transaction or recovery revenue
- recruiting intelligence output
- Leadership Suite runtime state
- V2 runtime leadership detection

## Proposed Darren Intelligence Snapshot

Create a backend-generated, cached snapshot before building chat.

Recommended fields:

- `snapshot_id`
- `generated_at`
- `darren_profile_id`
- `darren_assessment_id`
- `darren_profile_source_label`
- `darren_business_assessment_source_label`
- `dashboard_metrics_source_label`
- `build_map_source_label`
- `goal_source_label`
- `business_model_baseline_source_label`
- `darren_behavioral_summary`
- `role_boundary_summary`
- `dashboard_metric_summary`
- `strategic_build_map_summary`
- `goal`
- `assumptions`
- `unavailable_fields`
- `valuation_baseline`
- `revenue_engine_summary`
- `five_futures`
- `one_move`
- `evidence_gaps`
- `next_proof_target`
- `what_not_to_overclaim`
- `sales_talk_track`
- `cost_control_metadata`

Snapshot output should be saved only after validation passes. A failed snapshot generation should return controlled diagnostics and preserve the dashboard state.

## Source-Labeling Model

Every claim should carry one of these labels:

- `darren_profile`
- `darren_business_assessment`
- `dashboard_metric`
- `build_map`
- `user_provided_goal`
- `business_model_baseline`
- `model_interpretation`
- `assumption`
- `unavailable`

Rules:

- Darren's ideas are hypotheses, not truth.
- Dashboard metrics are evidence, but only within their source-label limits.
- Build map phases are repo-backed roadmap truth, not runtime truth.
- Financial claims remain unavailable until payment/revenue records exist.
- Model interpretation must never be presented as sourced fact.

## Multi-Path Valuation / $250M Baseline Model

Darren's $250M ambition should be modeled across multiple possible company archetypes, not as a single SaaS narrative.

The Leadership Intelligence Layer should help Darren compare strategic paths over time and choose the future that becomes most evidence-supported. It should not prescribe one path in advance.

Baseline math examples:

- At a 5x revenue multiple, a $250M valuation implies about $50M annual revenue.
- At an 8x revenue multiple, a $250M valuation implies about $31.25M annual revenue.
- At a 10x revenue multiple, a $250M valuation implies about $25M annual revenue.
- $25M ARR implies about $2.08M monthly recurring revenue.
- $31.25M ARR implies about $2.60M monthly recurring revenue.
- $50M annual revenue implies about $4.17M monthly revenue.

Strategic company archetypes to compare:

- SaaS / subscription intelligence company
- RRG-powered revenue recovery company
- mortgage-company infrastructure partner
- brokerage recruiting + retention intelligence platform
- leadership intelligence / LDE company
- hybrid MMM + RRG + Leadership Suite + Conversion Cloud company
- Partner Capital / Strategic Funding Path
- Channel / Distribution Power Path

Each path should include assumptions such as:

- pricing
- number of subscribers
- number of enterprise contracts
- contract value
- retention
- gross margin
- RRG transaction or recovery revenue assumptions
- valuation multiple
- evidence available
- evidence missing

Path comparison should weigh:

- dashboard activity
- adoption by company
- revenue data when available
- paid/free/promo source data when available
- partner response
- RRG activity
- sales-cycle friction
- implementation cost
- business model fit
- operational complexity
- product truth risk
- capital leverage
- control risk
- channel leverage
- channel risk
- next proof required

Do not claim valuation is guaranteed. The snapshot should say which path is currently most evidence-supported, which paths remain plausible, what evidence would shift the ranking, and what would invalidate each path.

## Partner Capital / Strategic Funding Path

Darren may help locate capital, funding, sponsorship, strategic partners, or channel partners before MMM/RRG has mature Stripe revenue.

This path should be evaluated separately from customer revenue. Partner interest is not funding. Funding conversations are not revenue. Strategic capital should be labeled separately from recurring revenue, one-time payments, or RRG operating revenue.

Potential partner-capital routes:

- mortgage-company strategic funding
- brokerage/network sponsorship
- enterprise pilot funding
- revenue-share partner funding
- channel partner investment
- strategic investor introductions
- acquisition-minded partner interest
- pilot-to-contract financing
- partner-funded RRG launch support

The system should help Darren evaluate:

- whether a partner is just interested or actually willing to fund
- whether the money comes with strategic leverage or dangerous control
- whether funding accelerates product proof or distracts from product truth
- whether partner capital supports the $250M path
- whether a partner wants MMM, RRG, Leadership Suite, or the whole ecosystem
- what proof a partner needs before writing a check

Evidence fields for partner-capital opportunities:

- partner type
- expressed interest
- funding likelihood
- strategic fit
- control risk
- proof requested
- expected check size if known
- timeline
- dependency on live product/revenue/results
- next proof target

Do not overclaim funding as likely unless evidence exists. Do not treat partner money as guaranteed. Do not mix partner capital with recurring revenue metrics.

## Channel / Distribution Power Path

Darren may help locate partners who do not immediately fund MMM/RRG but can provide distribution, access, pilots, introductions, salesforce leverage, brokerage access, mortgage-company access, conference/training access, or database/channel reach.

This path should be evaluated separately from customer revenue and separately from partner capital. Channel interest is not distribution. A warm introduction is not adoption. Audience access is not revenue. Distribution should be tracked separately from partner capital and customer revenue.

Potential channel/distribution routes:

- mortgage company salesforce access
- brokerage network access
- district/director access
- enterprise pilot access
- conference/training stage access
- lender/agent database access
- referral network access
- white-label distribution
- partner-led onboarding
- association/franchise/channel access

The system should help Darren evaluate:

- whether the partner has real audience/control or only enthusiasm
- whether the channel can produce profiles, assessments, paid users, RRG opportunities, or enterprise pilots
- whether distribution is exclusive, semi-exclusive, or open
- whether the channel partner can operationally execute
- whether channel access creates evidence faster than paid ads or direct sales
- whether the partner wants MMM, RRG, Leadership Suite, or the whole ecosystem
- what proof the channel partner needs before introducing MMM/RRG broadly

Evidence fields for channel/distribution opportunities:

- channel type
- audience size
- decision-maker access
- distribution authority
- activation likelihood
- expected profile volume
- expected assessment volume
- expected paid conversion
- expected RRG opportunity volume if known
- operational lift
- proof required
- timeline
- strategic fit
- channel risk
- next proof target

Do not overclaim channel access as adoption unless users actually enter the system. Do not mix channel reach with revenue. Do not treat partner enthusiasm as distribution proof.

## Multi-Vertical Expansion Model

MMM + RRG should not be modeled as limited to real estate and lending.

Real estate and lending are the beachhead verticals because current language, examples, dashboard records, Business Assessment flow, and RRG framing are strongest there. They are not the total addressable future.

The Darren Leadership Intelligence Layer should compare whether MMM + RRG should:

- stay focused in real estate/lending
- expand into adjacent verticals
- become a broader leadership/revenue intelligence platform
- operate as a hybrid beachhead-to-platform company

Potential strategic vertical paths:

- real estate + lending beachhead
- mortgage-company-powered revenue recovery
- brokerage/recruiting/retention intelligence
- professional services revenue recovery
- insurance/financial services relationship reactivation
- franchise/network sales intelligence
- enterprise leadership intelligence
- multi-vertical lifecycle detection engine / LDE platform

The cross-vertical thesis should be modeled around markets where:

- relationships go dormant
- revenue opportunity is hidden in existing databases
- individuals, teams, and companies need behavioral intelligence
- leaders need recruiting, retention, performance, and follow-up intelligence
- lifecycle/event signals can identify timing windows
- trust, timing, and behavioral fit drive conversion

Path comparison should distinguish:

- vertical-specific company path
- multi-vertical platform path
- hybrid beachhead-to-platform path

Evidence required before expanding beyond the beachhead:

- repeated adoption inside real estate/lending
- measurable RRG activity or recovery outcomes
- partner pull from adjacent verticals
- evidence that the core mechanism works outside real estate/lending
- repeatable onboarding and data capture
- operational ability to support another vertical without weakening the beachhead
- revenue proof or credible paid demand

Cross-vertical expansion must be labeled future/hypothesis unless supported by evidence. The system should help Darren evaluate expansion timing, not overclaim cross-vertical readiness.

## Revenue / Capital / Channel Engine Model

Potential revenue, capital, and channel streams should be separated.

Customer revenue streams and status:

- Behavior Profile access: live product capability, revenue attribution not persistently indexed
- Business Assessment access: live product capability, revenue attribution not persistently indexed
- one-time assessment payments: planned
- $23.95/month subscription: planned
- team assessment upgrades: future
- Leadership Suite licensing: future
- brokerage enterprise licensing: future
- mortgage partner licensing: future
- RRG pay-at-close revenue: future / unavailable in dashboard
- recruiting intelligence products: future
- coaching/training packages: future
- intelligence/data subscription: future

Partner-capital streams and status:

- mortgage-company strategic funding: future / hypothesis
- brokerage/network sponsorship: future / hypothesis
- enterprise pilot funding: future / hypothesis
- revenue-share partner funding: future / hypothesis
- channel partner investment: future / hypothesis
- strategic investor introductions: future / hypothesis
- acquisition-minded partner interest: future / hypothesis
- pilot-to-contract financing: future / hypothesis
- partner-funded RRG launch support: future / hypothesis

Channel/distribution streams and status:

- mortgage company salesforce access: future / hypothesis
- brokerage network access: future / hypothesis
- district/director access: future / hypothesis
- enterprise pilot access: future / hypothesis
- conference/training stage access: future / hypothesis
- lender/agent database access: future / hypothesis
- referral network access: future / hypothesis
- white-label distribution: future / hypothesis
- partner-led onboarding: future / hypothesis
- association/franchise/channel access: future / hypothesis

The snapshot must not show fake revenue totals, fake paid/free breakdowns, fake funding likelihood, or fake distribution proof. Partner capital should be evaluated as capital leverage, not customer revenue. Channel access should be evaluated as distribution leverage, not adoption or revenue.

## Evidence Scoring Model

Darren's plans should be scored as hypotheses.

Recommended dimensions:

- evidence available
- evidence missing
- business model fit
- build-stage fit
- revenue relevance
- RRG relevance
- partner-capital relevance
- funding likelihood
- strategic fit
- control risk
- proof requested
- expected check size if known
- timeline
- dependency on live product/revenue/results
- channel-distribution relevance
- channel type
- audience size
- decision-maker access
- distribution authority
- activation likelihood
- expected profile volume
- expected assessment volume
- expected paid conversion
- expected RRG opportunity volume if known
- operational lift
- channel risk
- risk
- next proof needed
- confidence level

The model should block direct conversion of Darren's ideas into product instructions. A proposed idea can become a build candidate only after it passes evidence, source-label, product reality, and human approval review.

Darren's ideas should also be mapped against each possible company path. The system should ask: does this idea strengthen the SaaS/subscription path, the RRG path, the mortgage infrastructure path, the brokerage recruiting path, the leadership intelligence/LDE path, the hybrid company path, the Partner Capital / Strategic Funding path, or the Channel / Distribution Power Path? If the answer is unclear, the idea should become an evidence gap or proof target, not a build instruction.

## Role-Boundary Model

Encode the operating boundary explicitly:

- Darren = momentum, sales, frontline adoption, relationship activation, market signal
- D.J. = vision, build, product architecture, validation, product truth
- Darren should sell what exists and gather market signal
- D.J. should architect, build, validate, and decide what becomes product
- the system should protect against Darren overclaiming future features
- the system should protect D.J. from becoming a sales follow-up clerk

The Leadership Intelligence Layer should give Darren action targets and sales language without handing him unverified product claims.

## Five Futures Model

Plan five MMM + RRG futures:

1. Conservative Continuation
   - Current V1 activity continues, but revenue and product proof remain thin.
2. Dashboard-Led Sales Traction
   - Leadership Dashboard plus assessment activity creates a useful sales cockpit and follow-up rhythm.
3. Channel Distribution Acceleration
   - Channel Distribution accelerates MMM + RRG adoption before full direct-sales maturity, if access produces real profiles, assessments, paid users, RRG opportunities, or enterprise pilots.
4. Strategic Partner Capital Acceleration
   - Strategic Partner Capital accelerates MMM + RRG before full organic revenue maturity, if a partner funds product proof without taking dangerous control.
5. Full V2 Leadership Intelligence Company Path
   - RRG activation, recruiting/retention intelligence, Leadership Suite, canonical dossiers, lifecycle detection, leadership detection, and runtime architecture become a broader intelligence platform.

Each future should include:

- name
- description
- current evidence
- missing evidence
- likely bottleneck
- upside
- danger
- what would make this future more likely
- what would invalidate it

## One Move Model

The One Move should be:

- weekly
- concrete
- sales-useful
- tied to current dashboard reality
- adapted to Darren's Momentum Machine profile
- tied to the $250M / $15M-$30M ambition without pretending it is guaranteed
- focused on the next proof target

Example shape:

- one target audience
- one sales conversation objective
- one proof metric
- one follow-up artifact
- one partner-capital proof target when a funding path is active
- one channel proof target when a distribution path is active
- one overclaim to avoid

## Coaching Style Model

Because Darren is Momentum Machine, coaching should:

- be direct
- be action-oriented
- give him targets
- give him sales language
- keep him moving
- warn against selling beyond evidence
- avoid burying him in architecture
- avoid overfeeding nuance
- avoid generic motivation

Preferred tone:

- short, clear, momentum-oriented
- strong on proof targets
- explicit about what he can say now versus what is planned

## GPT-5.5 Cost-Control Model

Do not build chat first.

Recommended cost-control plan:

- cached Darren profile summary
- cached Darren Business Assessment summary
- cached MMM + RRG business model summary
- cached dashboard metrics snapshot
- cached build map summary
- limited chat history
- structured Darren Intelligence Snapshot first
- GPT-5.5 only for strategic synthesis
- "Deep Strategy" generation button instead of continuous open-ended chat
- optional daily or monthly usage cap
- token budget diagnostics
- prompt/version metadata
- controlled timeout diagnostics

## Privacy / Safety Rules

- No raw dossier client exposure.
- No raw assessment answers.
- No unrestricted chat access to Redis.
- No fake financials.
- No ungrounded future claims.
- No hidden prompt injection from user notes or arbitrary text.
- No automatic product-building from Darren's ideas.
- No generated snapshot save unless validation passes.
- No Five Futures or One Move claims without source labels.
- No valuation certainty.
- No overclaiming planned roadmap phases as live.

## Stop Conditions

Stop implementation if:

- Darren profile cannot be safely retrieved
- Darren Business Assessment cannot be safely resolved
- raw dossier or raw answers would be exposed to the client
- snapshot validation fails
- source labels are missing
- generated output claims planned systems are live
- financial numbers are invented
- $250M valuation is presented as guaranteed
- dashboard metrics are unavailable but treated as evidence
- chat is proposed before a validated snapshot
- Redis writes are needed before a schema is reviewed
- generation failure would corrupt dashboard state
- cost diagnostics are missing

## Recommended Implementation Sequence

Recommended sequence:

1. MM-ADMIN-3B: backend Darren Intelligence Snapshot API
   - read-only inputs
   - source-labeled snapshot
   - validated output
   - controlled diagnostics
   - no chat
2. MM-ADMIN-3C: dashboard panel for the snapshot
   - goal
   - progress interpretation
   - evidence gaps
   - Five Futures
   - One Move
   - sales talk track
   - what not to overclaim
3. MM-ADMIN-3D: GPT-5.5 strategy chat grounded in the snapshot
   - bounded prompts
   - limited history
   - cost controls
4. MM-ADMIN-3E: optional recurring refresh and usage controls
   - only after snapshot and chat prove useful

## Build-Map Update Recommendation

When this layer moves from planned to live, update `src/data/leadershipBuildMap.js`:

- add a Leadership Intelligence phase or sub-bullet
- update status only when the backend snapshot and dashboard panel are deployed and verified
- keep GPT chat marked planned/future until grounded snapshot chat is actually live
- add current truth and limits for every new roadmap claim

## Limits

- This sprint is planning only.
- No product behavior changed.
- No code was added.
- No routes were created.
- No UI was created.
- No Redis records were modified.
- No generation was triggered.
- No chat was added.
- No Stripe, subscription, RRG, or Outcome Ledger work was implemented.
