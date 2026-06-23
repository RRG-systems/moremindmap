# MM-ADMIN-3D.6 Darren Generation Safety Repair Report

## Executive Verdict

MOREMINDMAP_DARREN_GENERATION_SAFETY_REPAIR_COMPLETE_WITH_LIMITS

## Classification

MOREMINDMAP_DARREN_GENERATION_SAFETY_REPAIR_DEFINED_WITH_LIMITS

## Files Changed

- `api/admin/darren-intelligence-generate.js`
- `MOREMINDMAP_DARREN_FIVE_FUTURES_ONE_MOVE_GENERATION_SAFETY_REPAIR_REPORT_ONLY_3D6.md`
- `runtime_traces/moremindmap_darren_five_futures_one_move_generation_safety_repair_3d6.json`

## Observed Failure

The dashboard button reached generation but returned the controlled frontend message: "Generated intelligence failed a safety check and was not returned."

That means the route likely reached parsed/generated output and then blocked the result during its privacy/framing safety scan.

## Safety Failure Diagnosis

The prior scan used broad serialized substring matching. One rule blocked a bare two-letter initials fragment. That can falsely match ordinary useful words such as "adjust" and fail otherwise acceptable strategic output.

The scan also evaluated the entire normalized response object, rather than only the generated user-facing strategy fields.

## Repair Made

- Replaced broad substring scanning with explicit rule objects.
- Added targeted phrase/regex matching for private-source exposure, storage references, environment references, prompt references, provider payload references, forbidden initials framing, celebrity comparison framing, and lane-policing language.
- Narrowed the scan to generated user-facing fields only:
  - Five Futures
  - One Move
  - evidence gaps
  - next proof targets
  - truth boundaries
  - model limits
- Added safe debug metadata for safety failures:
  - `safety_check_failed`
  - `safety_failure_code`
  - `safety_failure_category`
  - `failed_field_path`
  - `matched_rule_id`
- Added scan stage tracking:
  - `privacy_scan_started`
  - `privacy_scan_failed`
  - `privacy_scan_passed`

## Preserved Protections

- Private source content exposure remains blocked.
- Private response-set exposure remains blocked.
- Storage reference exposure remains blocked.
- Environment reference exposure remains blocked.
- Prompt/reference payload exposure remains blocked.
- Provider payload exposure remains blocked.
- Forbidden initials framing remains blocked.
- Celebrity comparison framing remains blocked.
- Lane-policing framing remains blocked.
- Truth boundaries remain required.

## Diagnostic Boundary

Safe debug can identify category, field path, and rule id. It does not return matched text, field contents, prompt text, provider payload, private source values, or exception internals.

## Validation Plan

- `node --check api/admin/darren-intelligence-generate.js`
- JSON trace parse
- `git diff --check`
- `npm run build`
- local invalid admin-code tests
- static privacy scan of changed files

## Highest Allowed Readiness

READY_FOR_CONTROLLED_PRODUCTION_GENERATION_SMOKE_TEST

## Limits

This repair does not claim production generation success. It prepares the route for one controlled production generation smoke test after deployment approval.
