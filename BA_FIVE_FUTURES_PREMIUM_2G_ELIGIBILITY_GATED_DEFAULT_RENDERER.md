# BA Five Futures Premium 2G: Eligibility-Gated Default Renderer

Phase: BA-FIVE-FUTURES-PREMIUM-2G  
Trace type: eligibility_gated_default_renderer

## Verdict

The Five Futures route now uses an eligibility-gated default policy.

Default behavior is `auto`:

- eligible record -> premium renderer
- ineligible record -> legacy renderer or existing not-found/error state
- explicit `renderer=legacy` -> legacy renderer
- explicit `renderer=premium` -> premium only if eligible, otherwise legacy
- explicit `renderer=auto` -> premium if eligible, otherwise legacy
- invalid renderer value -> auto

This is not blanket premium enablement. Premium still requires the existing provenance guardrails.

## Files Changed

- `src/BusinessAssessmentFiveFutures.jsx`
- `BA_FIVE_FUTURES_PREMIUM_2G_ELIGIBILITY_GATED_DEFAULT_RENDERER.md`
- `runtime_traces/ba_five_futures_premium_2g_eligibility_gated_default_renderer.json`

## Old Behavior

Before 2G:

- Default route rendered legacy unless `VITE_BA_FIVE_FUTURES_PREMIUM=true`.
- `?renderer=premium` rendered premium only if `hasPremiumFiveFuturesData(data)` passed.
- Premium eligibility already required complete One Move provenance after 2E.
- Render errors fell back to legacy through `PremiumRendererBoundary`.
- Legacy renderer remained available.

## New Behavior

The route now resolves renderer mode from the query string:

- `renderer=legacy`
- `renderer=premium`
- `renderer=auto`
- missing/invalid -> `auto`

Selection policy:

```js
if (mode === 'legacy') render legacy
if (mode === 'premium' || mode === 'auto') {
  if (hasPremiumFiveFuturesData(data)) render premium inside boundary
  else render legacy
}
```

`hasPremiumFiveFuturesData(data)` still requires:

- usable futures
- at least three future records
- generated One Move provenance:
  - raw title
  - raw root constraint
  - raw recommendation
  - raw modeled shift
  - raw proof/rationale

## Guardrails Preserved

- Incomplete One Move provenance cannot render premium.
- Missing One Move title cannot appear as generated premium intelligence.
- Missing root constraint fails premium eligibility.
- Missing recommendation fails premium eligibility.
- Missing modeled shift fails premium eligibility.
- Missing proof/rationale fails premium eligibility.
- Missing confidence alone does not block premium, but displays `Confidence not indexed`.
- Premium render exception falls back to legacy.
- Legacy renderer is preserved.

## Expected Production Smoke

Known eligible profile:

`mm-20260531-asovnjz4`

Expected route behavior:

- default route -> `premium-five-futures`
- `renderer=auto` -> `premium-five-futures`
- `renderer=premium` -> `premium-five-futures`
- `renderer=legacy` -> `legacy-five-futures`
- invalid renderer, such as `renderer=potato` -> `premium-five-futures` because it is treated as auto and record is eligible

Known non-eligible/not-found profile:

`mm-20260526-r8362esx`

Expected:

- no false premium render
- existing not-found/error state or legacy fallback
- no fake One Move intelligence

## What Did Not Change

- No prompts changed.
- No generation logic changed.
- No scoring changed.
- No stored records mutated.
- No backend/API files changed.
- No OpenAI/model wiring changed.
- No canonical dossier logic changed.
- No Universal Translator changes.
- No Darren Strategy Chat changes.
- No Leadership Demo changes.
- No Visual Lab changes.
- Five Futures and One Move visuals were not redesigned.

## Production Readiness Verdict

Ready to deploy as an eligibility-gated default selection policy once build and smoke tests pass.
