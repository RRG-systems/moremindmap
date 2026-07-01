# Universal Translator Mode Simplification 3E

Phase: `UNIVERSAL-TRANSLATOR-MODE-SIMPLIFICATION-3E`  
Timestamp: `2026-07-01T01:47:07Z`  
Verdict: `PENDING_VALIDATION_AND_DEPLOYMENT`

## Summary

Universal Translator was simplified from three visible modes to two:

Before:

- Plain English
- Explain it like I'm busy
- Coach me through this

After:

- Plain English
- Coach Me Through This

`explain_like_busy` remains accepted server-side as a legacy/internal compatibility mode, but it is no longer shown in the UI.

## Files Changed

- `src/components/universalTranslator/UniversalTranslatorDrawer.jsx`
- `api/universal-translator.js`
- `UNIVERSAL_TRANSLATOR_MODE_SIMPLIFICATION_3E.md`
- `runtime_traces/universal_translator_mode_simplification_3e.json`

## UI Change

The drawer now renders only two mode buttons:

- `plain_english`
- `coach_me_through_this`

This affects all current Universal Translator drawer usage, including BOS/profile and Business Assessment contexts, because they share `UniversalTranslatorDrawer.jsx`.

## Backend Behavior

Model wiring was not changed. Universal Translator still uses the existing route-specific model behavior from 3D:

- Default model: `gpt-4o-2024-08-06`
- Optional env: `UNIVERSAL_TRANSLATOR_MODEL`
- Fallback behavior preserved
- `OPENAI_MODEL` unchanged

Backend mode compatibility:

- `plain_english`: active visible mode
- `coach_me_through_this`: active visible mode
- `explain_like_busy`: legacy/internal compatibility mode only

## Mode Distinction

Plain English now instructs the model to:

- translate into clear, simple, direct language
- use fewer words than coaching mode
- avoid adding strategy
- avoid over-coaching
- avoid turning the response into an action plan unless the source clearly calls for it

Coach Me Through This now instructs the model to:

- act like a practical business coach
- explain what the section is really saying
- explain why it matters
- identify the signal, risk, or opportunity to notice
- provide a useful coaching question or next step
- preserve the source truth

The response contract remains backward-compatible. The existing `translation` object is preserved, and optional fields were added/rendered only when present:

- `headline`
- `what_to_watch`
- `coaching_question`

## Boundaries Preserved

- Translator remains a comprehension layer only.
- Original output remains the source of truth.
- No source content mutation was added.
- No canonical dossier mutation was added.
- No profile generation, business assessment generation, Darren Strategy Chat, Stripe, checkout, Visual DNA, public intake, or global model behavior changed.

## Validation Results

- `git diff --check`: passed
- `node --check api/universal-translator.js`: passed
- `npm run build`: passed with existing Vite large chunk warning
- `python3 -m json.tool runtime_traces/universal_translator_mode_simplification_3e.json`: passed

## Smoke Plan

After deployment:

- Public routes return 200.
- Universal Translator `plain_english` returns 200, `ok: true`, translation present, `model_used: gpt-4o-2024-08-06`.
- Universal Translator `coach_me_through_this` returns 200, `ok: true`, translation present, `model_used: gpt-4o-2024-08-06`.
- Coach output is meaningfully more coaching-oriented than Plain English.
- Darren Strategy Chat still returns 200, `ok: true`, `model_used: gpt-5.5`, `fallback_used: false`.
- `mutation_performed` remains false.
- No raw JSON leakage.

## Production Readiness

Ready for commit, deployment, and production smoke.
