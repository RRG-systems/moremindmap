# Darren Five Futures + One Move Generation Repair

Phase: MM-ADMIN-3D.1

## Executive Summary

Verdict: MOREMINDMAP_DARREN_FIVE_FUTURES_ONE_MOVE_GENERATION_REPAIR_COMPLETE_WITH_LIMITS

Classification: MOREMINDMAP_DARREN_GENERATION_500_REPAIR_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_CONTROLLED_PRODUCTION_GENERATION_SMOKE_TEST

This sprint repairs the Darren Five Futures + One Move generation route after the first production model-backed smoke test returned HTTP 500.

## Root Cause / Best Diagnosis

Best diagnosis: the OpenAI model request failure was being collapsed into a generic `500 darren_intelligence_generation_failed`.

The route did not preserve enough safe stage information to distinguish:

- model request failure
- token parameter/model compatibility issue
- invalid configured model value
- model response parse failure
- privacy scan failure
- timeout

The repair makes those layers controlled and diagnosable without exposing prompts, raw model output, secrets, raw dossier content, or private assessment data.

## Repair Made

- Added safe generation model resolution.
- Added fallback to `gpt-4o-2024-08-06` when configured model text is malformed.
- Added model-family token parameter selection:
  - `max_completion_tokens` for newer completion-token model families.
  - `max_tokens` for standard chat-completion model families.
- Added controlled error responses:
  - `darren_intelligence_snapshot_unavailable`
  - `darren_intelligence_model_not_configured`
  - `darren_intelligence_model_request_failed`
  - `darren_intelligence_model_response_invalid`
  - `darren_intelligence_generation_failed_privacy_scan`
  - `darren_intelligence_generation_timeout`
- Added safe server-side diagnostics with stage, safe error code, HTTP status, selected model name, and booleans for snapshot/model/parse/privacy state.

## Files Changed

- `api/admin/darren-intelligence-generate.js`
- `MOREMINDMAP_DARREN_FIVE_FUTURES_ONE_MOVE_GENERATION_REPAIR_REPORT_ONLY_3D1.md`
- `runtime_traces/moremindmap_darren_five_futures_one_move_generation_repair_3d1.json`

## Persistence Decision

Unchanged:

- return-only V1
- no Redis persistence
- no canonical profile mutation
- no assessment record mutation

## Privacy Guardrails

- no raw canonical dossier returned
- no raw assessment answers returned
- no prompt returned
- no raw model output logged
- no environment values logged
- no Redis keys exposed client-side
- no lane-check framing
- no literal celebrity comparison

## Validation

- `node --check api/admin/darren-intelligence-generate.js`
- `python3 -m json.tool runtime_traces/moremindmap_darren_five_futures_one_move_generation_repair_3d1.json`
- `git diff --check`
- `npm run build`
- invalid admin code local test returns controlled `403`
- static privacy scan of changed files

## Production Smoke Test Plan

After deploy approval:

1. Deploy the committed repair.
2. Confirm route/page health.
3. Confirm invalid generation code returns `403`.
4. Run exactly one valid generation request.
5. Report only shape/count/safety fields.

## Limits

- No chat.
- No Outcome Ledger runtime.
- No subscriptions.
- No Stripe.
- No RRG runtime.
- No persistence of generated Darren intelligence yet.
- No production valid generation test is run in this repair sprint.
