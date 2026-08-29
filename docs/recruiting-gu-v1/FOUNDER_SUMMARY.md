# MORE Recruiting GU V1 — Founder review summary

## Outcome

The promotion-capable Recruiting GU V1 candidate is implemented locally on the real Recruiting authority substrate and is ready for Founder/Darren review. It is one shared four-room product:

`HOME → YOU → YOUR BUSINESS → PLAN`

The local synthetic Darren/Jordan acceptance route is:

`http://127.0.0.1:5197/recruiting-gu-v1/demo`

This is not deployed and is not represented as Production-ready.

## What Founder can evaluate

- Darren HOME with the two real manager entrances plus the isolated synthetic-demo entrance.
- Standard-manager HOME with only the two approved real entrances and intentional whitespace.
- The complete current `NewBosExperience` inside YOU, independently clickable and scrollable.
- The complete current `BusinessTwinApp` inside YOUR BUSINESS, independently clickable and scrollable.
- One persistent meeting conversation across authored rooms and temporary GU recomposition.
- Frontier-selected people/role, relationship, comparison, Five Futures/trajectory, hypothesis revision, purpose change, evidence, and bounded scenario environments.
- Sparse PLAN opening; frontier-generated proposal; ADJUST lineage; YES completion; NOT NOW second offer; second YES/NO; truthful synthetic three-month receipt.
- Desktop, iPad landscape, and iPad portrait behavior.

## Architectural result

The build is a promotion candidate, not a disposable demo. Real manager authority uses the existing Recruiting V1 membership, invitation, consent, relationship, entitlement, CSRF, audit, persistence, and canonical-read boundaries. The Darren demo uses the same GU product with an isolated browser-bound synthetic capability and an in-memory synthetic adapter.

The Shared Business Session is Recruiting-owned, relationship-scoped, durable in the real runtime, revision/CAS protected, append-only in its event lineage, and unable to mutate canonical BOS/BA truth. MORE-ID creates no authority until the profile owner explicitly approves the disclosed consultation relationship.

The PLAN fulfillment seam is idempotency-shaped but inert in this campaign. No Stripe charge, entitlement, email, reminder, calendar event, customer write, canonical write, or Production mutation was executed.

## Frontier runtime

- Gateway: OpenRouter
- Required provider: OpenAI
- Model: `openai/gpt-5.6-luna`
- Reasoning: `low`
- Structured output: strict JSON schema
- Provider fallbacks: disabled
- Storage: `store:false`
- Timeout: 75 seconds
- Deterministic semantic fallback: none

Observed useful-environment provider latency was 10,336–19,514 ms in the recorded acceptance run. The first truthful progressive state appeared in 537–798 ms. Exact observations and the exceptional 30,519 ms wall-clock polling run are recorded in `TEST_BROWSER_LATENCY.md`.

## Quality gates

- ESLint: pass.
- Production build: pass; existing bundle-size advisory only.
- Relevant regression matrix: 215/215 pass.
- Focused GU/authority/runtime matrix: 33/33 pass.
- Browser acceptance: desktop, iPad landscape, iPad portrait, authored BOS/BA interaction, GU return/continuity, scenario control, full PLAN decision tree, refresh/resume, and synthetic isolation exercised.

## Blunt verdict

The ball moves. The product behaves as a current thinking environment around a real authored BOS/Business Twin meeting instead of as decorated chat or a handcrafted dashboard. The architecture survives contact with actual software: the frontier chooses substantive temporary composition, humans can return to the authored products without losing the relationship, and the same session reaches a bounded mutual decision.

The remaining risk is bounded rather than architectural: Founder/Darren acceptance, any polish found in that review, then the separately authorized sponsored-three-month fulfillment tail and Home Base airlock.

**RECRUITING_GU_V1_PROMOTION_CAPABLE_BUILD_COMPLETE_READY_FOR_FOUNDER_DARREN_REVIEW**
