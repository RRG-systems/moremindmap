# MMM API / Model Wiring Trace and Repair 3D

Phase: `MMM-API-MODEL-WIRING-3D`  
Timestamp: `2026-07-01T01:29:59Z`  
Verdict: `UNIVERSAL_TRANSLATOR_MODEL_WIRING_REPAIRED_WITH_ROUTE_SPECIFIC_FALLBACKS`
Deployment: `https://moremindmap-ahmtw52rk-rrg-systems-projects.vercel.app`
Production alias: `https://moremindmap.com`

## Executive Summary

Darren Strategy Chat was preserved and remains Darren-specific. The production failure reproduced on Universal Translator as:

```json
{"ok":false,"error":"universal_translator_model_request_failed"}
```

Root cause: `api/universal-translator.js` defaulted to `gpt-4o-mini`, which is not in the currently confirmed project model allowlist, and the route had no fallback retry. The route also had stale allowed model entries and no GPT-5-class token-parameter guard if a GPT-5 model was configured later.

Repair made: Universal Translator now defaults to `gpt-4o-2024-08-06`, accepts `UNIVERSAL_TRANSLATOR_MODEL` / `UNIVERSAL_TRANSLATOR_OPENAI_MODEL` only from a safe allowlist, retries once with `gpt-4o-2024-08-06` when a non-default primary fails, uses `max_completion_tokens` for GPT-5/o-class models and `max_tokens` for GPT-4o-class models, returns `model_used` and `fallback_used`, and preserves the existing frontend response shape.

Global `OPENAI_MODEL` was not changed.

## Files Changed

- `api/universal-translator.js`
- `MMM_API_MODEL_WIRING_TRACE_AND_REPAIR_3D.md`
- `runtime_traces/mmm_api_model_wiring_trace_and_repair_3d.json`

## Routes Discovered

| File | Purpose | Model Source | API Method | Token Param | Status | Action |
| --- | --- | --- | --- | --- | --- | --- |
| `api/universal-translator.js` | Universal Translator comprehension layer | `UNIVERSAL_TRANSLATOR_MODEL` or `UNIVERSAL_TRANSLATOR_OPENAI_MODEL`, default `gpt-4o-2024-08-06` | `chat/completions` via `fetch` | `max_tokens` or `max_completion_tokens` by model class | broken, repaired | Route-specific model repair and fallback added |
| `api/admin/darren-strategy-chat.js` | Darren Strategy Chat | `DARREN_STRATEGY_CHAT_MODEL`, fallback `gpt-4o-2024-08-06` | `chat/completions` via `fetch` | model-class aware | working | No change |
| `api/admin/darren-adaptive-loop-core.js` | Darren Adaptive Strategy Draft | `DARREN_ADAPTIVE_STRATEGY_OPENAI_MODEL`, default `gpt-4o-2024-08-06` | `chat/completions` via `fetch` | `max_tokens` | untested | No change |
| `api/admin/darren-intelligence-generate.js` | Darren generated strategy / Five Futures / One Move | `DARREN_INTELLIGENCE_OPENAI_MODEL`, default `gpt-4o-2024-08-06` | `chat/completions` via `fetch` | model-class aware, current allowlist excludes GPT-5 | untested | No change |
| `api/business-assessment/generate-futures.js` | Business Assessment Five Futures + One Move | `BUSINESS_ASSESSMENT_OPENAI_MODEL || OPENAI_MODEL || gpt-4o-2024-08-06` | `chat/completions` via `fetch` | `max_completion_tokens` | untested / incompatible-risk if global model changes unexpectedly | No change |
| `api/business-assessment/generate-briefing.js` | Executive Diagnostic Briefing | `BUSINESS_ASSESSMENT_BRIEFING_MODEL || gpt-4o-2024-08-06` | `chat/completions` via `fetch` | `max_completion_tokens` | untested | No change |
| `api/moremindmap/narrative-v3.js` | Narrative V3 section generation | hardcoded `gpt-4o-2024-08-06` | `chat/completions` via `fetch` | `max_tokens` | untested | No change |
| `api/moremindmap/visual-dna/generate.js` | Visual DNA image generation/edit | `VISUAL_DNA_IMAGE_MODEL || gpt-image-1` | OpenAI SDK `images.edit` | image params | untested | No change |
| `api/engine/generateReportContent.js` | Engine report content helper | `OPENAI_MODEL || gpt-5.5` | OpenAI SDK chat completions | `max_completion_tokens` | incompatible-risk due global model dependency | No change |
| `api/engine/rescoring/gptBehavioralRescore.js` | GPT behavioral rescoring helper | hardcoded `gpt-4o`; output schema asks for `gpt-5.5` | `chat/completions` via `fetch` | `max_tokens` | incompatible-risk / schema mismatch risk | No change |
| `api/admin/rescore-profile.js` | Admin GPT rescore route | calls `gptBehavioralRescore` | indirect | indirect | incompatible-risk / mutating admin route | No change |
| `api/diagnostic.js` | Diagnostic model metadata | reads env only | none | none | informational | No change |

## Model Assignments

- Darren Strategy Chat: `DARREN_STRATEGY_CHAT_MODEL=gpt-5.5`, fallback `gpt-4o-2024-08-06`. Preserved.
- Universal Translator: `UNIVERSAL_TRANSLATOR_MODEL=gpt-4o-2024-08-06` recommended, with code defaulting to the same model if the env var is absent.
- Business Assessment / Five Futures: unchanged. Do not change unless separately smoke-tested.
- Business Briefing: unchanged.
- Profile / narrative generation: unchanged.
- Visual DNA image generation: unchanged.
- GPT behavioral rescoring: unchanged, but should be audited separately because the code’s model call and expected output model label do not align.

## Environment Variables

Required new env vars: none.

Recommended optional production env var:

```text
UNIVERSAL_TRANSLATOR_MODEL=gpt-4o-2024-08-06
```

Do not change `OPENAI_MODEL` for this repair.

## Safety Boundaries

- Universal Translator remains read-only.
- Original MORE MindMap output remains the source of truth.
- No canonical dossier, assessment output, Five Futures, One Move, evidence ledger, dashboard state, or future movement mutation was added.
- Darren Strategy Chat behavior, model selection, and mutation policy were not changed.
- No public profile generation, business assessment generation, checkout, Stripe, Visual DNA, or public intake flow was changed.

## Validation Results

- `git diff --check`: passed
- `node --check api/universal-translator.js`: passed
- `python3 -m json.tool runtime_traces/mmm_api_model_wiring_trace_and_repair_3d.json`: passed
- `npm run build`: passed with existing Vite large chunk warning

## Production Smoke Plan

Completed after deploy:

1. Public routes: `/`, `/profile`, `/business-assessment`, `/leadership-dashboard` all returned 200.
2. Universal Translator succeeded for:
   - `plain_english`: 200, `ok: true`, translation present, `model_used: gpt-4o-2024-08-06`, `fallback_used: false`
   - `explain_like_busy`: 200, `ok: true`, translation present, `model_used: gpt-4o-2024-08-06`, `fallback_used: false`
   - `coach_me_through_this`: 200, `ok: true`, translation present, `model_used: gpt-4o-2024-08-06`, `fallback_used: false`
3. Darren Strategy Chat returned 200, `ok: true`, reply present, `model_used: gpt-5.5`, `fallback_used: false`, `mutation_performed: false`.
4. Smoke scan found no raw JSON leakage, no automatic mutation claim, no future percentage movement claim, no valuation certainty, and no employee/team People Reality expansion.

## Remaining Risks

- `api/engine/rescoring/gptBehavioralRescore.js` has a naming/schema mismatch: comments and validation expect `gpt-5.5`, but the actual model request uses `gpt-4o`. This was not the Universal Translator failure and was not changed.
- `api/engine/generateReportContent.js` depends on global `OPENAI_MODEL`, so future global model changes can alter profile/report behavior. This was not changed.
- Business Assessment futures uses `OPENAI_MODEL` as a secondary fallback. It already uses `max_completion_tokens`, but should be smoke-tested before any global model change.

## Production Readiness Verdict

Production smoke passed with limits.
