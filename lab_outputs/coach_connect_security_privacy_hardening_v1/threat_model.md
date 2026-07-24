# Threat Model

Evidence class: `STATIC`

The hardened boundary treats browser input, identifiers, cookies, Origin/Referer/fetch metadata, CSRF proofs, replay keys, provider/session references, and recovered journal state as untrusted. Protected assets are subscriber identity and exact scope, Coach Connect relationship and consent, transcript/artifact references, Business Engine canonical state, temporary developer capability state, audit state, and deletion epochs.

Covered attacker actions include guessed or foreign object IDs, cross-subscriber and cross-tenant reads, actor-role substitution, canonical writes by coaches, copied/expired/production capability use, CSRF, stale relationships, revoked-consent replay, sequence and confirmation replay, cache leakage, transcript/error leakage, brute-force unlock, session fixation, and replay after logical deletion.

Controls are exact-scope server authorization, subject/session/browser-bound opaque capabilities, one-time CSRF proof, exact origin validation, idempotency and replay fingerprints, injected atomic synthetic state, allowlist response shaping, recursive redaction, safe structured audit, deletion epochs, no-store headers, and fail-closed default flags.

Not claimed: external penetration testing, distributed shared-state behavior, production identity binding, legal retention approval, backing-content deletion, physical append-only journal erasure, production-only HSTS, deployment readiness, or production certification.
