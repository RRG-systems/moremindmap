# MM-ADMIN-3D.4 Darren Generation Early-Stage Repair Report

## Executive Verdict

MOREMINDMAP_DARREN_GENERATION_EARLY_STAGE_REPAIR_COMPLETE_WITH_LIMITS

## Classification

MOREMINDMAP_DARREN_GENERATION_EARLY_STAGE_REPAIR_DEFINED_WITH_LIMITS

## Files Changed

- `api/admin/darren-intelligence-generate.js`
- `MOREMINDMAP_DARREN_FIVE_FUTURES_ONE_MOVE_GENERATION_EARLY_STAGE_REPAIR_REPORT_ONLY_3D4.md`
- `runtime_traces/moremindmap_darren_five_futures_one_move_generation_early_stage_repair_3d4.json`

## Root Cause / Best Diagnosis

The prior production debug response confirmed model resolution was repaired but still lost the useful early-stage failure location by overwriting the stage with `unhandled_generation_failure`.

Code review found two repair targets:

- The generic catch path overwrote the latest useful stage instead of recording a separate failure stage.
- The OpenAI call built prompt messages without passing the diagnostic object into `buildPrompt`, which could throw before the model request path completed.

## Repairs Made

- Added `failure_stage` while preserving the last useful `generation_stage`.
- Added early micro-stages from handler start through snapshot invocation.
- Wrapped the internal snapshot handler call with a controlled exception path.
- Added safe snapshot handler flags: invoked and returned.
- Expanded the internal capture response with compatible `getHeader`, `send`, and `headersSent` behavior.
- Fixed prompt construction so diagnostic state is passed into `buildPrompt`.
- Added sanitized exception class reporting only as `error_name`.

## Safety Boundary

- No chat added.
- No model output displayed in reports.
- No records modified.
- No persistent generation artifact added.
- No frontend changes.
- No Stripe, subscription, Outcome Ledger, or RRG runtime changes.
- No canonical profile or assessment mutation.

## Debug Response Boundary

Safe debug responses may include stage flags, selected non-secret model name, token parameter, status codes, and sanitized exception class name.

Safe debug responses must not include private source content, full strategy output, prompt text, provider response bodies, environment values, storage identifiers, exception internals, or private user rows.

## Validation Plan

- `node --check api/admin/darren-intelligence-generate.js`
- `python3 -m json.tool runtime_traces/moremindmap_darren_five_futures_one_move_generation_early_stage_repair_3d4.json`
- `git diff --check`
- `npm run build`
- Invalid admin code local test
- Invalid admin code with debug local test
- Static privacy scan of changed files

## Production Smoke Test Plan

After deploy approval, run at most one valid production generation request with safe debug enabled. If it fails, report only the safe diagnostic fields. Do not retry without approval.

## Highest Allowed Readiness

READY_FOR_CONTROLLED_PRODUCTION_GENERATION_SMOKE_TEST

## Limits

This sprint repairs diagnostics and an identified prompt-call bug only. It does not prove production generation succeeds until one approved production smoke test is run after deployment.
