# Implementation and authority trace

## Trace before edit

### Canonical BOS first-party answers

The existing read-only path already existed and was extended rather than replaced:

1. `createReadOnlyCanonicalReader({ redis }).read(profileId)` retrieves the profile-bound canonical envelope.
2. `adaptCanonicalProfileToNewBosRawEvidence({ envelope, expectedProfileId })` validates the expected subject and exposes the underlying BOS question/answer set to the server runtime.
3. Any read/adapter failure is converted into an explicit `UNAVAILABLE:<code>` source receipt. No fallback or invented answer path exists.

Implementation: `api/engine/recruitingGuV1/frontierContext.js:169`.

### Canonical BA first-party answers

The existing `createReadOnlyBaAuthorityReader` resolves the canonical profile-to-assessment authority path and returns `business_evidence.answers` only after its existing subject, assessment, vertical, question-state, hash, and sufficiency checks. GU maps question IDs to the real-estate intake definitions for model understanding. YOU never calls this reader.

Implementation: `api/engine/recruitingGuV1/frontierContext.js:180`.

### Existing gaps found

Before this experiment, GU supplied a single combined public world to both rooms and did not pass the canonical underlying answer sets into the frontier request. The prior prompt also contained accumulated compositional/conversational choreography. The trusted renderer, Creation Language, validator, Shared Business Session, authored BOS/BA surfaces, and canonical readers were already present and were preserved.

## Exact implementation changes

### Server-only governed understanding context

- Added `api/engine/recruitingGuV1/frontierContext.js`.
- Preserves complete BOS/BA governed semantics while omitting only duplicated authored rendering packets.
- Marks first-party answers `INTERNAL_REASONING_ONLY_SENSITIVE`, `renderable_evidence: false`.
- Marks the full reasoning envelope as having neither public rendering nor persistence authority.
- Loads DJ doctrine through the existing doctrine retriever.
- Loads the full frozen Real Estate authority library; the synthetic receipt proves 16 registered, hash-verified authorities.
- Records explicit source availability or source gap instead of fabricating access.

### Two independent room boundaries

- `src/lib/recruitingGuV1/world.js` now scopes public objects/evidence by room.
- YOU receives only the governed Jordan person/BOS object and `ev-jordan-bos`.
- YOUR BUSINESS receives the fused whole-person and whole-business world.
- `api/engine/recruitingGuV1/realRuntime.js` builds the private context only after existing relationship and membership authority resolves.
- `api/engine/recruitingGuV1/runtime.js` passes private context to the frontier only; browser responses receive a safe availability receipt, never raw context.

### Minimal free-frontier doctrine

`api/engine/recruitingV2/frontierPrompt.js` now uses the Founder-locked instructions verbatim and adds only the hard operating boundaries required by the trusted renderer:

- whole-state understanding below, progressive human understanding above;
- one important idea, one clear explanation, one short self-discovery question;
- up to four coordinated blocks;
- broad MORE-native representation choice;
- no raw private answers, invented facts, BA evidence in YOU, persuasion, canonical truth promotion, or executable external action.

The 24-body research is not encoded as 24 rules, and no deterministic dialogue tree or canned coaching script was added.

### Privacy and state validation

`src/lib/recruitingV2/frontierContract.js` adds:

- schema-level four-block maximum;
- one question-only `nextCue`, maximum 140 characters;
- protected-answer phrase and sensitive-detail leakage denial;
- model/validator/schema-mechanics prose denial;
- exact six-field state binding comparison that is order-insensitive but refuses missing, extra, or changed values.

Invalid plans never reach projection materialization or session persistence.

### Shared-session compatibility

`src/lib/recruitingGuV1/session.js` preserves one durable conversation while limiting model context to the compatible room lineage:

- YOU: HOME + YOU conversation and hypotheses;
- YOUR BUSINESS: HOME + YOU + YOUR BUSINESS conversation and hypotheses;
- YOU does not inherit BA/PLAN decision content.

### Exact suggested questions and progress state

`src/recruitingGuV1/RecruitingGuV1App.jsx` contains the four Founder-locked questions exactly. The progressive state sequence now includes `Finding the one idea that matters most now…` without removing the existing immediate governed-evidence and composing states.

### Live experiment harness

Added `scripts/runRecruitingGuV1FreeFrontierCoachingExperiment.mjs` to exercise the real provider with a same-session four-turn synthetic conversation. It records sanitized plan summaries, availability receipts, model/provider configuration, and latency. Raw request/response payloads and protected answers are not persisted.

## Files changed

- `api/engine/recruitingGuV1/demoRuntime.js`
- `api/engine/recruitingGuV1/frontierContext.js` (new)
- `api/engine/recruitingGuV1/realRuntime.js`
- `api/engine/recruitingGuV1/runtime.js`
- `api/engine/recruitingV2/frontierPrompt.js`
- `api/engine/recruitingV2/frontierRuntime.js`
- `src/lib/recruitingGuV1/session.js`
- `src/lib/recruitingGuV1/world.js`
- `src/lib/recruitingV2/frontierContract.js`
- `src/lib/recruitingV2/syntheticWorld.js`
- `src/recruitingGuV1/RecruitingGuV1App.jsx`
- `test/recruitingGuV1.test.js`
- `scripts/runRecruitingGuV1FreeFrontierCoachingExperiment.mjs` (new)
- this evidence package

## Explicitly untouched

Recruiting V1, the authored Recruiting V2 product, Production, Darren Demo deployment, customer/canonical state, secrets, Stripe, email, entitlements, reminders, and external systems were not changed.

