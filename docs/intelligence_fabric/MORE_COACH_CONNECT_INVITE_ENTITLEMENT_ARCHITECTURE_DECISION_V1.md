# Architecture Decision: Coach Connect Invite & Entitlement V1

Status: accepted for default-off synthetic foundation use
Date: 2026-07-21

## Decision

Preserve one authoritative Business Engine and two separate subscription products. Coach Connect costs `$19.95/month` for each exact coach-subscriber relationship. Invitation, relationship, consent, entitlement, session, judgment, Confidence Reality note, and promotion are distinct records with deterministic transitions.

Authority requires a verified authenticated coach session, exact actor and tenant/profile/business/subscriber scope, granted consent, active relationship, active exact entitlement, allowed resource/action/purpose, enabled feature, and no emergency disable. Billing or QR possession alone grants nothing.

Coach cockpit and subscriber surfaces are governed projections. Structured session artifacts remain separate from raw sources. Coach judgment enters Confidence Reality as attributed `COACHING_NOTE`, never `MISSING`, with bounded weight and no canonical authority. Promotion follows all seven ordered stages and final mutation delegates to the existing confirmed Intelligence Fabric runtime.

Privacy classes are coach-session private, coach-attributed shareable, subscriber-visible coaching summary, tenant-private Business Engine, and system-internal. Creation-time classification controls projection, audit, model, and learning eligibility.

All capabilities default off. No public route, provider, Redis client, migration, production billing, live model, or voice/video integration is introduced.

## Threat model

Controls address QR theft/replay/tampering/enumeration, invitation substitution, wrong account, session fixation, cross-tenant scope, duplicate relationship, payment spoofing, webhook replay/order, stale entitlement, billing/consent divergence, client enumeration, cache/projection contamination, private-note and model-context leakage, canonical overwrite, promotion bypass, and feature bypass.

## Rejected alternatives

- Unlimited coach license: violates per-subscriber entitlement and isolation.
- Payment-only authority: payment cannot create consent or restore revocation.
- Direct coach edits: coach judgment is not canonical truth.
- Transcript-only sessions: conversation is input; structured intelligence is required.
- Duplicate coach Business Engine: violates one authoritative Business Engine.
- Automatic coach-evidence promotion: coach confidence does not equal evidence authority.
