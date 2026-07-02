# BA Five Futures Premium 2C One Move Hero Intelligence

Phase: `BA-FIVE-FUTURES-PREMIUM-2C`

Verdict: `PENDING_VALIDATION`

## Summary

The premium Business Assessment Five Futures preview renderer now treats One Move as a second major intelligence artifact beneath the Five Futures map.

The generated One Move title remains intact and prominent. The new block derives its internal panels from existing normalized One Move / assessment fields only:

- `oneMove.title`
- `oneMove.rootConstraint`
- `oneMove.recommendation`
- `oneMove.whyThisMove`
- `oneMove.whyNow`
- `oneMove.probabilityShift`
- `oneMove.first30Days`
- `oneMove.successIndicators`
- `oneMove.confidence`

No AI generation, prompt change, scoring change, stored-record mutation, API/model change, or canonical dossier change was made.

## Files Changed

- `src/components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx`
- `src/BusinessAssessmentFiveFutures.jsx`
- `BA_FIVE_FUTURES_PREMIUM_2C_ONE_MOVE_HERO_INTELLIGENCE.md`
- `runtime_traces/ba_five_futures_premium_2c_one_move_hero_intelligence.json`

## What Changed

- Added a large `THE ONE MOVE ->` hero intelligence block.
- Preserved the generated One Move title as primary intelligence, not decorative copy.
- Added premium panels for:
  - Root Constraint
  - Recommended Move
  - Downstream Effects
  - Modeled Shift
  - Proof To Watch
- Added conservative downstream effect derivation from existing `whyThisMove`, `probabilityShift`, and `recommendation` language.
- Added Proof To Watch from existing `successIndicators` and `first30Days` fields when available.
- Increased premium preview artifact height only for the premium renderer path so the One Move section can breathe.

## Preserved

- Five Futures 2B section preserved.
- Five robust future cards preserved.
- Horizontal LDE / Assessment Analysis truth rail preserved.
- 8 evidence dots preserved.
- Legacy renderer preserved.
- Premium remains preview-only/default off.
- Fallback behavior preserved.

## Validation

- `git diff --check`: passed.
- `python3 -m json.tool runtime_traces/ba_five_futures_premium_2c_one_move_hero_intelligence.json`: passed.
- `npm run build`: passed with existing Vite large-chunk warning.

## Smoke Tests

Local browser smoke against production API data for `mm-20260531-asovnjz4`:

- Default route rendered `data-renderer="legacy-five-futures"`.
- `?renderer=premium` rendered `data-renderer="premium-five-futures"`.
- Five Futures 2B section remained present with 5 future cards.
- Truth rail remained present with 8 evidence dots.
- Normal cards did not show `SUPPORTING SIGNALS`.
- One Move hero block rendered.
- `THE ONE MOVE ->` label rendered.
- Generated One Move title rendered intact: `INSTALL A 90-DAY JUDGMENT TRANSFER CADENCE`.
- Root Constraint, Recommended Move, Downstream Effects, Modeled Shift, and Proof To Watch panels rendered.
- No generic filler phrases were detected.
- No horizontal overflow detected.
- No One Move panel overlap detected.
- No One Move panel clipping detected.
- No future-card clipping detected.
- No Five Futures stage / One Move hero overlap detected.

Production smoke after deployment:

- Deployment URL: `https://moremindmap-72v2oaxmh-rrg-systems-projects.vercel.app`
- Production alias: `https://moremindmap.com`
- `/`: 200
- `/profile`: 200
- `/business-assessment`: 200
- `/leadership-dashboard`: 200
- `/leadership-demo`: 200
- Legacy Five Futures route: 200 and rendered `data-renderer="legacy-five-futures"`.
- Premium preview route: 200 and rendered `data-renderer="premium-five-futures"`.
- Premium preview retained 5 future cards, truth rail, and 8 evidence dots.
- Premium preview rendered `THE ONE MOVE ->`, the generated One Move title, Root Constraint, Recommended Move, Downstream Effects, Modeled Shift, and Proof To Watch.
- No generic filler phrases were detected.
- No horizontal overflow, panel overlap, panel clipping, or future-card clipping was detected.

## Limits

- Downstream Effects are grounded in existing One Move language and may read as source-text excerpts when explicit downstream effects are unavailable.
- Proof To Watch uses existing success indicators / first-30-day items. It does not create new proof targets.
- Premium remains a preview renderer until separately approved for default use.
