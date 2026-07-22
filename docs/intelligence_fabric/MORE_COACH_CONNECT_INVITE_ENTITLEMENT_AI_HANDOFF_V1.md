# Coach Connect Invite & Entitlement V1 — AI Handoff

Verdict: `COACH_CONNECT_INVITE_ENTITLEMENT_CAMPAIGN_COMPLETE_WITH_LIMITS`

The authoritative implementation is `src/lib/intelligenceFabric/coachConnect/`. It depends on the provider-neutral coach auth foundation and existing Intelligence Fabric primitives. It exposes no public route and all production-impacting capabilities default off.

Invitation tokens are returned only inside opaque QR payloads; only hashes are stored. A verified signed-in coach consumes one invitation with explicit subscriber consent, producing one exact-scope relationship. A separate `$19.95/month` synthetic entitlement belongs to that relationship. Access requires valid auth session, actor, scope, consent, relationship, entitlement, resource/action/purpose, feature state, and no emergency disable.

The cockpit is an allowlisted projection of the one authoritative Business Engine. Structured non-voice sessions preserve observations, commitments, and evidence candidates without treating transcripts as intelligence. Coach judgment becomes a bounded attributed `COACHING_NOTE`, not missing evidence or canonical truth. Promotion must traverse all seven stages; final append delegates to an injected existing runtime and requires confirmation, evidence, and outcome validation.

Run `node --test test/intelligenceFabric.coachConnect*.test.js`, then the full validation commands in the evidence manifest. Ten proof packets live under `lab_outputs/coach_connect_invite_entitlement_v1/`.

Never assume live billing, Stripe products, Redis persistence, public routes, live auth, voice/video, recording, transcription, model providers, production data, deployment readiness, security certification, scale, universal learning, or coach canonical authority. The recommended next campaign is `MORE_CAMPAIGN_COACH_CONNECT_LIVE_SESSION_INTELLIGENCE_V1.md` because live session providers and production activation remain separately governed.
