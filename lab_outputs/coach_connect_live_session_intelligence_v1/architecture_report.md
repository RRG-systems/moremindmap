# Architecture Report

Campaign: `MORE_CAMPAIGN_COACH_CONNECT_LIVE_SESSION_INTELLIGENCE_V1`

The implementation is an additive `coachConnect/liveSession/` aggregate. It does not reinterpret the existing compact coaching-session aggregate. It reuses existing Coach Connect authority through an injected evaluator, keeps provider mechanics behind `MediaProviderPort`, persists normalized events through an injected append-only store, emits extraction candidates with no canonical authority, requires immutable coach review and exact subscriber confirmation, and reaches the one Business Engine only through an injected canonical append.

Authoritative events, checkpoints, projections, idempotency results, transcript references, artifacts, proposals, confirmations, and failures remain distinct. Subscriber and coach projections carry the same Business Engine ID/version. All features default off; emergency disable is asserted; live media, live model, production traffic, public routes, Redis, Stripe, and provider SDKs are absent.
