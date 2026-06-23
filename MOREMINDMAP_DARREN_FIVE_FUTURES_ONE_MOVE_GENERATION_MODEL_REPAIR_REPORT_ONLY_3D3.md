# Darren Five Futures + One Move Model Resolution Repair

Phase: MM-ADMIN-3D.3

## Executive Summary

Verdict: MOREMINDMAP_DARREN_GENERATION_MODEL_RESOLUTION_REPAIR_COMPLETE_WITH_LIMITS

Classification: MOREMINDMAP_DARREN_GENERATION_MODEL_RESOLUTION_REPAIR_DEFINED_WITH_LIMITS

Highest allowed readiness: READY_FOR_CONTROLLED_PRODUCTION_GENERATION_SMOKE_TEST

This sprint repairs Darren generation model resolution so unsupported shared `OPENAI_MODEL` values do not break the route.

## Root Cause / Best Diagnosis

The safe-debug production response showed:

- selected model: `gpt-5.5`
- snapshot loaded: false
- OpenAI requested: false
- generation stage: `unhandled_generation_failure`

Best diagnosis: the route accepted the shared production `OPENAI_MODEL` value before snapshot loading. That shared value is not safe for this route's current chat-completions JSON call pattern.

## Model Resolution Repair

The Darren generation route now:

- uses `DARREN_INTELLIGENCE_OPENAI_MODEL` only when explicitly configured to a safe allowlisted model
- ignores shared `OPENAI_MODEL` for this route
- falls back to `gpt-4o-2024-08-06`

Intentional rule:

> Darren generation uses a route-specific safe model fallback because shared OPENAI_MODEL may be set to a future/non-chat-compatible value.

## Selected Default Model

- `gpt-4o-2024-08-06`

## Ignored Shared Model Values

Shared model values such as `gpt-5.5` are ignored by this route unless a route-specific safe value is explicitly configured through `DARREN_INTELLIGENCE_OPENAI_MODEL`.

## Token Parameter Behavior

For `gpt-4o-2024-08-06`, the route uses the standard chat-completions `max_tokens` parameter.

The route keeps `max_completion_tokens` only for newer completion-token model families if a future allowlisted model requires it.

## Privacy / Safety

- no raw canonical dossier returned
- no raw assessment answers returned
- no prompt returned
- no raw model output returned
- no environment values returned
- no storage keys exposed
- no lane-check framing
- no literal celebrity comparison
- no Redis persistence
- no canonical profile mutation
- no assessment mutation

## Validation

- `node --check api/admin/darren-intelligence-generate.js`
- `python3 -m json.tool runtime_traces/moremindmap_darren_five_futures_one_move_generation_model_repair_3d3.json`
- `git diff --check`
- `npm run build`
- invalid admin code local test returns `403`
- invalid admin code with `debug=1` returns `403` and no diagnostic
- static privacy scan of changed files

## Production Smoke Test Plan

After deploy approval:

1. Deploy the committed repair.
2. Confirm invalid generation auth still returns `403`.
3. Run exactly one valid generation request.
4. Report only shape/count/safety fields, or safe debug fields if it fails.

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
