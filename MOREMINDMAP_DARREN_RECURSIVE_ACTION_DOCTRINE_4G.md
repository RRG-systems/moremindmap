# MM-ADMIN-4G - Darren Recursive Action Doctrine

## Purpose

Define the doctrine and action proposal contract that lets Darren Strategy Chat identify likely next actions without mutating strategy, One Move status, or Outcome Ledger records automatically.

## Current Live Spine

- Generated strategy persistence is live.
- Latest generated strategy retrieval is live.
- One Move status tracking is live.
- Outcome Ledger v0 is live.
- Since Last Snapshot v0 is live.
- Darren Strategy Chat Foundation is live.
- Chat is context-aware and non-mutating.
- Automatic learning and future movement scoring are not live.

## Doctrine

- Chat is natural.
- Mutation is explicit.
- Memory is structured.
- Evidence gates movement.
- Human confirms action.
- The system suggests.
- The user confirms.
- The ledger remembers.
- The future only moves when evidence deserves it.

## Mutation Law

Natural language cannot write to strategy, One Move status, Outcome Ledger, canonical profile records, or assessment records. A mutation requires an explicit action proposal, user confirmation, route-level validation, and a separate write endpoint.

## Action Proposal Law

Chat may propose a structured action card. A proposed action is not a mutation. It is a draft of what a later confirmed write might do.

Required proposed action fields:

- `action_type`
- `action_label`
- `reason`
- `confidence_band`
- `requires_confirmation: true`
- `mutation_allowed_without_confirmation: false`
- `target_route`
- `payload_preview`
- `evidence_impact`
- `future_movement_policy`
- `user_options`

## Confirmation Law

Every proposed action must offer `confirm`, `edit`, and `cancel`. In 4G, confirm and edit are not live; cancel only dismisses the proposal locally.

## Evidence Law

Evidence impact is only possible after a confirmed ledger write. A chat suggestion, partner comment, or sales idea is not evidence until recorded through an explicit confirmed action.

## Memory Law

Chat is not durable memory in 4G. Structured memory remains in generated strategy records, One Move status fields, Outcome Ledger events, and future linked records.

## Future Movement Law

Future movement remains unchanged until evidence-weighted ledger events are evaluated by a later movement layer. No probability, scoring, or automatic learning claim is allowed in 4G.

## Prohibited Behaviors

- Mutating records from natural language.
- Creating Outcome Ledger events from chat in this sprint.
- Updating One Move status from chat in this sprint.
- Mutating generated strategy from chat in this sprint.
- Claiming automatic learning is live.
- Claiming a future moved without evidence.
- Exposing raw dossiers, raw assessment answers, Redis keys, env vars, prompts, raw model output, or raw errors.
- Reintroducing supervisory lane-check framing or literal celebrity comparisons.

## Allowed Action Proposal Types

- `update_one_move_status`
- `create_outcome_ledger_event`
- `add_result_note`
- `suggest_proof_target`
- `suggest_follow_up_ask`
- `suggest_pitch_language`
- `flag_overclaim_risk`
- `no_action`

## Proposed Action Contract

```json
{
  "action_type": "create_outcome_ledger_event",
  "action_label": "Log this as a partner signal",
  "reason": "The user described a lender conversation that may be worth tracking, but it is not proof until confirmed and recorded.",
  "confidence_band": "possible",
  "requires_confirmation": true,
  "mutation_allowed_without_confirmation": false,
  "target_route": "/api/admin/darren-outcome-ledger-event",
  "payload_preview": {
    "event_type": "partner_signal",
    "signal_type": "partner_capital",
    "evidence_weight": "early"
  },
  "evidence_impact": "early",
  "future_movement_policy": "Future movement remains unchanged until a confirmed ledger event is evaluated by a later evidence gate.",
  "user_options": ["confirm", "edit", "cancel"]
}
```

## Next Sprint Implementation Path

1. Add confirm/edit/cancel handling for proposed action cards.
2. Route confirmed actions through existing validated write endpoints.
3. Keep action writes separate from chat text.
4. Add post-write refresh of One Move status, Outcome Ledger, and Since Last Snapshot.
5. Add durable chat summaries only after safe session-summary storage is designed.
