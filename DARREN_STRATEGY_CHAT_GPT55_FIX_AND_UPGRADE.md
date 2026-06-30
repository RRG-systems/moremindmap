# Darren Strategy Chat GPT-5.5 Fix and Upgrade

Phase: Darren Strategy Chat GPT-5.5 repair and trial upgrade

## Verdict

`DARREN_STRATEGY_CHAT_GPT55_FIX_READY_FOR_DEPLOY_WITH_LIMITS`

The Darren Strategy Chat failure was isolated to the backend model request path. Production returned:

`{"ok":false,"error":"darren_strategy_chat_model_request_failed"}`

The route already used a Darren-specific model setting and did not change global MORE MindMap model behavior. The failure risk was that the route made one model request only. If the configured Darren model failed because of access, request shape, timeout, or provider error, the user saw Strategy Chat unavailable and the route did not retry the previous stable model.

## Root Cause

Likely root cause: the Darren Strategy Chat route had no fallback retry around the configured primary model. If `DARREN_STRATEGY_CHAT_MODEL` is set to a GPT-5.5 model and the provider rejects the model or request parameters, the route returns a model request failure.

Secondary issue repaired: the OpenAI request shape was not defensive for GPT-5-class models. The route now uses a completion-token parameter for GPT-5-class models and omits temperature there, while keeping the prior request style for the stable fallback.

## Files Changed

- `api/admin/darren-strategy-chat.js`
- `DARREN_STRATEGY_CHAT_GPT55_FIX_AND_UPGRADE.md`
- `runtime_traces/darren_strategy_chat_gpt55_fix_and_upgrade.json`

## Runtime Behavior Changed

Yes. Backend only, Darren Strategy Chat route only.

Frontend changed: no.

Global model behavior changed: no.

Other product routes changed: no.

## Model Selection Behavior

Primary model:

- Uses `DARREN_STRATEGY_CHAT_MODEL` when present and allowlisted.
- Also accepts the legacy Darren-only override `DARREN_STRATEGY_CHAT_OPENAI_MODEL`.
- Recommended trial value: `gpt-5.5`.

Fallback model:

- `gpt-4o-2024-08-06`

If the primary model fails, the route retries once with the fallback model. It does not loop.

If no Darren-specific model env var is set, the route continues to use the stable fallback model as the primary.

## Safe Response Metadata

Successful chat responses now include:

- `model_used`
- `fallback_used`
- `model_selection.primary_model`
- `model_selection.fallback_model`
- `model_selection.primary_model_failed`
- `model_selection.env_model_configured`

This is safe operational metadata only. It does not expose secrets, provider response bodies, hidden instructions, private source records, or full context payloads.

## Error Behavior

If both primary and fallback fail, the route returns a controlled JSON error with:

- `ok: false`
- safe error code
- `mutation_performed: false`
- compact model trace containing only model names and safe failure codes

No raw provider error body is returned to the browser.

## Mutation Boundary

Strategy Chat remains advisory/read-only.

The repair does not allow Strategy Chat to mutate Five Futures, One Move, records, evidence ledger, dashboard state, or future movement.

Confirmed action behavior was not changed.

## Context Boundary

Existing dashboard context injection was preserved:

- Current Operating State
- Five Realities labels
- financial/admin summary
- 9-path business model context
- confidence boundaries
- roadmap/live-vs-planned context
- workflow help context

No raw admin tables, private profile text, assessment response detail, secrets, tokens, or storage keys were added.

## Production Readiness

Ready to deploy after validation.

Production still runs the old route until deployed.

Set this Vercel production env var for the MORE MindMap project only:

`DARREN_STRATEGY_CHAT_MODEL=gpt-5.5`

Do not change global `OPENAI_MODEL`.

## Validation

Validation status is recorded in `runtime_traces/darren_strategy_chat_gpt55_fix_and_upgrade.json`.

## Limits

- No deploy was performed.
- No commit was performed.
- Local live model smoke depends on available runtime env vars.
- Production will not show the repair until the backend change is deployed.
