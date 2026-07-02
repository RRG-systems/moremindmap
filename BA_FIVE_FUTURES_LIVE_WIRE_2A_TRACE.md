# BA Five Futures Live Wire 2A Trace

Phase: BA-FIVE-FUTURES-LIVE-WIRE-2A

## Existing Flow

- Route: `/business-assessment/five-futures`
- Route component: `src/BusinessAssessmentFiveFutures.jsx`
- Data retrieval: `GET /api/business-assessment/retrieve?id=<profile_id>`
- Data normalization: `src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js`
- Artifact frame/scaling: `src/components/businessAssessment/BusinessArtifactViewer.jsx`
- Current live renderer: `FiveFuturesCanvas` inside `src/BusinessAssessmentFiveFutures.jsx`
- Current canvas dimensions: `BUSINESS_ARTIFACT_WIDTH` x `FIVE_FUTURES_ARTIFACT_HEIGHT`

## Current Data Shape

The live renderer consumes normalized data:

- `profileId`
- `assessmentId`
- `ownerName`
- `ownerProfileType`
- `assessmentType`
- `currentTrajectory`
- `primaryConstraint`
- `answers`
- `eToP`
- `fiveFutures.title`
- `fiveFutures.subtitle`
- `fiveFutures.probabilityTotal`
- `fiveFutures.confidenceSnapshot`
- `fiveFutures.futures`
- `oneMove.title`
- `oneMove.rootConstraint`
- `oneMove.recommendation`
- `oneMove.probabilityShift`

Future records currently support:

- `key`
- `label`
- `title`
- `probability`
- `status`
- `signal_bullets`
- `signals`
- `evidence`
- `summary`
- `central_insight`
- `short_interpretation`

## Safest Insertion Point

The safest insertion point is inside `src/BusinessAssessmentFiveFutures.jsx`, after the saved assessment is retrieved and normalized, before rendering the canvas. This preserves retrieval, normalization, routing, and existing old renderer behavior.

The old renderer remains as `FiveFuturesCanvas`. The premium renderer can be imported as a separate component and selected only when:

- the feature flag or preview selector requests it
- compatible normalized data exists
- an error boundary does not catch a render failure

## Feature Flag Plan

- Env flag: `VITE_BA_FIVE_FUTURES_PREMIUM=true`
- Default state: off
- Controlled preview selector: `?renderer=premium`
- Fallback: existing `FiveFuturesCanvas`

## Boundaries

- No backend changes.
- No generation changes.
- No prompt changes.
- No scoring changes.
- No stored record mutations.
- No canonical dossier changes.
- No OpenAI/model wiring changes.
- No Universal Translator changes.
- No Darren Strategy Chat changes.
- No Leadership Demo changes.

## Validation

- `git diff --check`
- `python3 -m json.tool runtime_traces/ba_five_futures_live_wire_2a_trace.json`
- `npm run build`

Results:

- `git diff --check`: passed.
- JSON parse: passed.
- `npm run build`: passed with the existing Vite large chunk warning.
- Known read-only assessment retrieve for `mm-20260531-asovnjz4`: 200.
- Feature flag off/default: legacy renderer appeared, premium marker absent.
- Controlled premium preview using `?renderer=premium`: premium renderer appeared.
- Premium preview markers present: central current trajectory orb, LDE Analysis, LDE Insight, doctrine bars, supporting-signal compression.
- Premium fit checks: no horizontal overflow, no card/orb overlap, no card overlap, no clipped cards, rail inside stage, doctrine inside stage.
- Missing profile ID path: controlled route error before renderer; no records mutated.
- Production deploy: ready at `https://moremindmap-cxi9srqvw-rrg-systems-projects.vercel.app`.
- Production alias: `https://moremindmap.com` confirmed.
- Production public routes: `/`, `/profile`, `/business-assessment`, `/leadership-dashboard`, `/leadership-demo`, and both Five Futures paths returned 200.
- Production default Five Futures route: legacy renderer marker present, premium marker absent.
- Production premium preview path: `?renderer=premium` showed the premium renderer with no horizontal overflow, no card/orb overlap, no card overlap, no clipped cards, rail inside stage, and doctrine inside stage.

## Verdict

Feature-flagged premium renderer is deployed with production default off and a controlled premium preview path.
