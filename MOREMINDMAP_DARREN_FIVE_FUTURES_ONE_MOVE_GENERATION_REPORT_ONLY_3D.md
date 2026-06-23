# Darren Five Futures + One Move Generation

Phase: MM-ADMIN-3D

## Executive Summary

Verdict: MOREMINDMAP_DARREN_FIVE_FUTURES_ONE_MOVE_GENERATION_IMPLEMENTED_WITH_LIMITS

Classification: MOREMINDMAP_DARREN_FIVE_FUTURES_ONE_MOVE_GENERATION_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_HUMAN_REVIEW_OF_DARREN_FIVE_FUTURES_ONE_MOVE_GENERATION

This sprint adds a backend admin generation endpoint and a button-driven frontend path for generating Darren's actual MMM + RRG Five Futures and One Move from the existing Darren Intelligence Snapshot.

This is not chat. It does not add Outcome Ledger runtime, subscriptions, Stripe, RRG runtime, canonical profile writes, assessment writes, or raw dossier/answer exposure.

## Files Changed

- `api/admin/darren-intelligence-generate.js`
- `src/components/DarrenLeadershipIntelligencePanel.jsx`
- `MOREMINDMAP_DARREN_FIVE_FUTURES_ONE_MOVE_GENERATION_REPORT_ONLY_3D.md`
- `runtime_traces/moremindmap_darren_five_futures_one_move_generation_3d.json`

## API Route Created

- `POST /api/admin/darren-intelligence-generate`

Access model:

- accepts `Authorization: Bearer <code>`
- accepts `X-Admin-Code: <code>`
- accepts `?code=<code>` or `?admin_code=<code>`
- checks `MOREMINDMAP_ADMIN_DASHBOARD_CODE` if configured
- falls back to `MOREADMIN26` for V1
- returns controlled `403 admin_generation_access_denied` before snapshot/model access when code is missing or invalid

## Generation Grounding

The endpoint calls the existing Darren Intelligence Snapshot route internally and sends only the sanitized snapshot fields to the model:

- Momentum Machine operating mode
- dashboard metrics
- Strategic Build Map summary
- $250M scenario ambition
- $15M-$30M gross revenue lens as assumption, not fact
- multi-path model
- partner capital path
- channel distribution path
- E->P lens
- unavailable fields
- proof targets
- overclaim boundaries

## Persistence Decision

Persistence decision: return-only V1.

Reason:

- This sprint can safely prove generation without adding a new Redis artifact lifecycle.
- No canonical dossier is mutated.
- No assessment record is mutated.
- No prompt is saved.
- Separate persistence for latest generated Darren intelligence should be added only after retrieval/update expectations are reviewed.

## Frontend Sections Added

The Darren Leadership Intelligence panel now includes:

- Generate Darren Five Futures + One Move button
- Generated Five Futures
- One Move This Week
- Evidence Gaps
- Next Proof Targets
- What Not To Overclaim
- Model Limits

## Privacy Guardrails

- no raw canonical dossier returned
- no raw assessment answers returned
- no raw JSON rendered
- no console logging of private payloads
- no Redis keys exposed
- no environment values exposed
- no prompt returned
- no model metadata returned to the client
- no lane-check framing
- no literal celebrity comparison
- no fake revenue
- no fake valuation certainty
- no fake partner funding
- no fake channel adoption
- no fake RRG readiness

## Limits

- No chat.
- No GPT/model call on page load.
- Generation runs only when Darren clicks the button.
- Generated result is not persisted in V1.
- If model/env is unavailable, the UI shows a controlled error.
- Five Futures and One Move are generated from the current snapshot only.

## Validation Checklist

- `node --check api/admin/darren-intelligence-generate.js`
- `python3 -m json.tool runtime_traces/moremindmap_darren_five_futures_one_move_generation_3d.json`
- `git diff --check`
- `npm run build`
- invalid admin code returns controlled `403`: passed
- controlled generation test: skipped locally because `OPENAI_API_KEY` and `REDIS_URL` are not configured
- static privacy scan of changed frontend files and backend forbidden terms: passed

## Recommended Next Step

Human review, then deploy approval if generation output quality and safety are accepted.
