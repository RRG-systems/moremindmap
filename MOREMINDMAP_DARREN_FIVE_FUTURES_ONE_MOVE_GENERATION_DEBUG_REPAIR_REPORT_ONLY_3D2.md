# Darren Five Futures + One Move Debug Repair

Phase: MM-ADMIN-3D.2

## Executive Summary

Verdict: MOREMINDMAP_DARREN_GENERATION_DEBUG_REPAIR_COMPLETE_WITH_LIMITS

Classification: MOREMINDMAP_DARREN_GENERATION_DEBUG_REPAIR_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_CONTROLLED_PRODUCTION_DEBUG_GENERATION_TEST

This sprint adds admin-safe debug response support to the Darren Five Futures + One Move generation route and improves internal stage tracking so the next production failure can be diagnosed without exposing private data.

## Root Cause / Best Diagnosis

The concrete production cause is still not identifiable from the prior deployed response because it returned generic `darren_intelligence_generation_failed` and Vercel did not surface the safe diagnostic object.

Best diagnosis: a runtime exception or model call failure is occurring outside the specific controlled branches. The route needed a diagnostic object carried through auth, snapshot loading, prompt construction, model request, model response parsing, schema validation, privacy scan, and final response.

## Debug Response Added

Safe debug response can be enabled only after valid admin auth by:

- query param `debug=1`
- header `X-Debug-Mode: safe`

Invalid admin code still returns `403 admin_generation_access_denied` with no diagnostic.

## Safe Debug Fields

The debug response may return:

- `generation_stage`
- `safe_error_code`
- `http_status`
- `model`
- `token_parameter`
- `snapshot_loaded`
- `snapshot_ok`
- `openai_requested`
- `openai_responded`
- `parsing_failed`
- `privacy_scan_failed`
- `schema_validation_failed`
- `timeout`
- `response_status`

## Forbidden Debug Fields

The debug response must not return:

- raw snapshot payload
- raw profile content
- raw assessment content
- prompt text
- raw model output
- environment values
- storage keys
- private user rows
- generated full futures or full One Move text

## Repair Made

- Added post-auth safe debug mode.
- Added a diagnostic object that is carried through the whole generation flow.
- Added explicit stage tracking:
  - `auth_passed`
  - `snapshot_load_started`
  - `snapshot_loaded`
  - `snapshot_load_failed`
  - `prompt_built`
  - `openai_request_started`
  - `openai_response_received`
  - `openai_response_failed`
  - `model_response_parse_started`
  - `model_response_parsed`
  - `model_response_invalid`
  - `schema_validation_failed`
  - `privacy_scan_failed`
  - `generation_complete`
  - `unhandled_generation_failure`
- Added generated output schema validation before returning success.
- Preserved return-only V1 persistence.

## Validation

- `node --check api/admin/darren-intelligence-generate.js`
- `python3 -m json.tool runtime_traces/moremindmap_darren_five_futures_one_move_generation_debug_repair_3d2.json`
- `git diff --check`
- `npm run build`
- invalid admin code local test returns `403`
- invalid admin code with `debug=1` still returns `403` and no diagnostic
- static privacy scan of changed files

## Production Smoke Test Plan

After deploy approval:

1. Deploy the committed debug repair.
2. Confirm normal invalid auth remains `403`.
3. Run exactly one valid generation request with safe debug enabled.
4. If it fails, report only the safe diagnostic fields.
5. If it succeeds, report only shape/count/safety fields.

## Limits

- No chat.
- No Outcome Ledger runtime.
- No subscriptions.
- No Stripe.
- No RRG runtime.
- No Redis persistence.
- No canonical profile mutation.
- No assessment record mutation.
- No production valid generation test is run in this sprint.
