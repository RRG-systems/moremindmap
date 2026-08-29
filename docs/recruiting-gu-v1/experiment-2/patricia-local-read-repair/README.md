# Recruiting GU V1 Experiment 2 — Patricia local-read repair

## Outcome

Patricia is available for Founder testing at `http://127.0.0.1:5197/recruiting-gu-v1/demo` through the existing Experiment 2 **PATRICIA** tab.

The repair is limited to a server-side, profile-scoped Redis projection. It permits `GET` for Patricia's canonical dossier, current authored BOS realization, current authored BA realization, and governed BA answer record. It refuses unrelated keys and refuses `SET`, `EVAL`, and every write path before a command reaches Redis.

The Shared Business Session remains in memory. No coach prompt, coach runtime, optional GU compiler, Creation Language, validator, authored BOS/BA renderer, Recruiting V1, canonical schema, or Production route changed.

## Exact source changes

- `api/engine/recruitingGuV1/readOnlyCanonicalRedis.js` — new Patricia-only `GET` façade, key-scope enforcement, write refusal, and non-sensitive audit receipt.
- `api/engine/recruitingGuV1/demoRuntime.js` — binds only the PATRICIA experiment subject to that façade using the existing BOS/BA canonical readers.
- `scripts/verifyRecruitingGuV1PatriciaLocalRead.mjs` — read-only live proof; provider calls are disabled.
- `test/recruitingGuV1.experiment2.test.js` — proves unrelated reads and write commands are rejected and zero writes reach the injected client.

No client/UI source changed.

## Local binding

- Existing configuration contract: `REDIS_URL` plus the existing derived namespaces.
- Local BOS namespace: `nonprod:new-bos:production-canary:v1`.
- Local BA namespace: `nonprod:new-ba:v1`.
- BA BOS-authority namespace: `nonprod:new-bos:production-canary:v1`.
- The credential was injected into the local process from an existing authorized local credential source. It was not copied into source, a new fixture, a new `.env`, or this evidence package.
- Vercel marks the project value as sensitive, so ordinary `env pull` correctly returned an empty value. No Vercel or Production configuration was changed.

## Live read proof

At `2026-08-29T14:45:25Z`:

- Patricia BOS loaded with 15 complete surfaces.
- Patricia Business Twin loaded complete.
- YOU: BOS present; BA absent; BA answers `0`; cassette authorities `0`.
- YOUR BUSINESS: BOS present; BA present; BOS answers `24`; governed BA answers `12`; selected cassette authorities `2`.
- Direct proof reader: 14 `GET` operations, 0 denied reads, 0 denied writes, 0 writes forwarded.
- Demo runtime: 8 `GET` operations, 0 denied reads, 0 denied writes, 0 writes forwarded.
- BOS and BA artifact hashes were identical before and after the complete proof.
- Provider calls during the read proof: `0`.

Machine-readable details: `READ_ONLY_RECEIPT.json`.

## Browser proof

- PATRICIA opened and displayed “Patricia Gutierrez” in the complete authored BOS.
- The authored BOS destination “How You Operate” opened normally.
- YOUR BUSINESS displayed “Patricia's Business Twin” and the complete five-destination authored BA.
- The authored BA Evidence destination opened normally.
- Switching to SYNTHETIC restored Jordan's control session.

Screenshots:

- `patricia-you-canonical-bos.jpg`
- `patricia-your-business-canonical-ba.jpg`

## Verification

- Focused GU V1 / Experiment 2: 15 passed, 0 failed.
- Protected New BOS, New BA, Recruiting V1, and Recruiting GU V1: 140 passed, 0 failed.
- Changed-file ESLint: passed.
- Production build: passed, 182 modules transformed; existing large-chunk warning remains.
- `git diff --check`: passed.

## Boundary

No Redis write, canonical mutation, provider call, customer-state write, Recruiting V1 mutation, Production configuration change, deployment, push, merge, Stripe, email, entitlement, reminder, or external effect occurred.

`RECRUITING_GU_V1_EXPERIMENT_2_PATRICIA_LOCAL_READ_REPAIR_COMPLETE_READY_FOR_FOUNDER_TESTING_NO_PRODUCTION_AUTHORITY`
