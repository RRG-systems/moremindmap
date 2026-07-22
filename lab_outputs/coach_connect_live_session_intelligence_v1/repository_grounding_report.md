# Repository Grounding Report

Revalidated: 2026-07-22

- Existing `auth/` remains the identity/session prerequisite and grants no Coach Connect authority.
- Existing `coachConnect/` remains authoritative for invite, exact-scope relationship, entitlement, cockpit authorization, compact sessions, and promotion ladder.
- Existing compact session states were not changed; live states are additive.
- Existing `runtime/` and `production/` remain the governed Business Engine and production-shaped injected persistence boundaries.
- No approved live media/transcription provider exists; only `SyntheticMediaProvider` was implemented.
- Only the approved new live-session, testing, focused-test, proof paths and two one-line dormant exports changed.
- Pre-existing unrelated work was preserved. The legacy BA fixture output touched by its validator was restored byte-for-byte.
