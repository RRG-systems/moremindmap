# Coach Connect Invite & Entitlement V1 — Implementation

Date: 2026-07-21
Campaign: `MORE-CAMPAIGN-COACH-CONNECT-INVITE-ENTITLEMENT-V1`
Posture: production-shaped, synthetic-only, default-off, not deployed.

## Objective and grounding

Build the first governed Coach Connect relationship without duplicating the authoritative Business Engine. The implementation extends the committed Production Subscriber Runtime Foundation and the completed Coach Identity & Auth Foundation. Existing production Stripe, Redis, API, and deployment wiring remains untouched.

## Architecture and files

`src/lib/intelligenceFabric/coachConnect/` contains activation, constants, validators, reducers, injected storage, governed projections, and the domain service. `src/lib/intelligenceFabric/index.js` exports the domain. Focused proof is in `test/intelligenceFabric.coachConnect*.test.js`. Ten machine-readable scenario packets are under `lab_outputs/coach_connect_invite_entitlement_v1/`.

## Contracts

The implementation includes repository-native equivalents for Coach Invitation, Coach Identity binding through the prerequisite auth service, Coach Relationship, Coach Entitlement, Scoped Coach Authority, Coach Cockpit Projection, Coaching Session, Coach Judgment, Coach Commitment, Coach Intervention Proposal, Coach Evidence Proposal, Coach Confidence Record, and Business Engine Promotion Record.

## State machines

Deterministic fail-closed reducers cover invitation, relationship, entitlement, coaching session, judgment evidence, intervention, and the seven-stage promotion ladder. Terminal revocation cannot be restored by billing.

## Phase implementation

1. Contracts, threat boundaries, privacy classes, flags, reducers, and one-Business-Engine architecture.
2. Opaque, expiring, single-use QR invitation with revocation, supersession, hashing, replay denial, and no scope disclosure.
3. Verified prerequisite coach identity, explicit consent/acceptance, exact-scope relationship, duplicate prevention, revocation, and no broad listing.
4. Separate `$19.95/month` synthetic Stripe translation per relationship with verified events, exact mapping, idempotency, ordering, past-due, suspension, cancellation, dispute, and no live billing.
5. Central authority combines session, exact actor/scope, consent, relationship, entitlement, purpose/resource/action, feature flags, and emergency disable. Cockpit projections are allowlisted and redacted.
6. Default-off subscriber and coach view models plus non-voice structured session lifecycle, judgments, commitments, and evidence candidates.
7. Bounded `COACHING_NOTE` Confidence Reality records and a promotion ladder that can reach canonical state only through an injected existing-runtime append with explicit confirmation, evidence, and outcome validation.

## Feature controls

All production-impacting flags default off. Emergency disable wins. Production traffic, live auth, live billing, live models, and live voice/video are rejected even if subordinate flags are enabled. The service exposes no public routes.

## Security and privacy

QR payloads contain opaque token material only; stored invitations retain hashes only. Audit and telemetry use opaque references and reason codes. Coach-private content, raw transcripts, subscriber-private chat, model reasoning, secrets, and payment details are excluded from projections and audit. Exact-scope services provide no broad relationship enumeration.

## Billing

The existing Stripe dependency and product architecture are respected without importing Stripe or Redis. The V1 product metadata is centralized at 1,995 USD cents monthly per exact subscriber relationship. Synthetic events must be verified, non-live, monotonic, and exactly mapped.

## Business Engine integration

There is one authoritative Business Engine. Coach judgment has no canonical authority. Promotion cannot skip stages and final append requires the injected governed runtime, subscriber confirmation, supporting evidence, and outcome validation. Five Futures, One Move, universal learning, and canonical state cannot be directly edited by Coach Connect.

## Validation

Coach Connect focused tests: 20/20. Full Intelligence Fabric: 204/204. Business Engine: 6/6. Real-estate alignment: 14/14. BA renderer: 4/4. ESLint, build, and `git diff --check` pass. Ten evidence packets validate.

## Limits and deferred work

No production persistence, provider webhook, checkout session, public route, live auth, live billing, voice/video, recording, transcription, deployment, scale proof, formal security/compliance audit, or production data exists. UI is represented by deterministic inactive view models rather than public React routes.
