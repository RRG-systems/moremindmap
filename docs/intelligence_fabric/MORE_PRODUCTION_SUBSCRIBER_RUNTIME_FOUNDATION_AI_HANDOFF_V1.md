# Production Subscriber Runtime Foundation V1 — AI Handoff

An inactive production-shaped subscriber foundation exists under `src/lib/intelligenceFabric/production/`. Redis is the selected future persistence mechanism because `ioredis` and Redis operational conventions already exist, but this implementation never imports live Redis utilities, reads environment variables, creates a client, or accesses production.

The event adapter requires an injected atomic driver and explicit capability. Authoritative events are separate from projections/checkpoints/idempotency. Exact-scope authorization, redaction, audit, retention/deletion/export placeholders, governed model proposals, internal command/query services, default-off activation, kill switch, readiness, telemetry, and rollback are implemented.

Final validation passed: `node --test test/intelligenceFabric*.test.js` at 171/171, `npx eslint src/lib/intelligenceFabric test/intelligenceFabric*.test.js` with zero findings, `npm run build` at 126 modules with the existing large-client-chunk warning, and `git diff --check`.

Review repairs require explicit confirmation before authoritative append, reject conflicting same-ID retries, invalidate checkpoints for late-effective and replacement history, apply tenant/profile/business replay filters, compare session expiry as parsed instants, and exclude captured Chrome profiles. Regression coverage is in the subscriber-cycle, replay, and production-security tests.

All flags default off; no public route exists. Do not activate traffic, create a Redis migration/Lua script, enable providers, or supply credentials without a separately approved campaign and operational/security review.

Commit the earlier Intelligence Fabric prerequisite allowlist first. Those files are untracked and absent from `HEAD`; Mission 002 is not a standalone commit without them. The synthetic driver still does not prove Redis capacity, HA, backup, TLS/ACL, production durability, load behavior, or operational readiness.

Next authorized artifact: `MORE_CAMPAIGN_COACH_CONNECT_INVITE_ENTITLEMENT_V1.md`. Do not begin automatically.
