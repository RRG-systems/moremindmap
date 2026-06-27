# DASH-HELP-2G - Darren Dashboard Help / Workflow Intelligence

## Verdict

DARREN_DASHBOARD_HELP_WORKFLOW_INTELLIGENCE_COMPLETE_WITH_LIMITS

## Classification

STRATEGY_CHAT_WORKFLOW_GUIDANCE_ADDED_NO_RECORD_MUTATION

## What Help / Workflow Intelligence Was Added

Strategy Chat now receives a compact `dashboard_workflow_context` inside the existing server-side `dashboard_intelligence_context`.

The new workflow context teaches Strategy Chat:

- What each app-stack panel is for.
- Which panels are top-visible, default-open, collapsed support, or collapsed admin.
- How Darren should use the dashboard day to day.
- How to recommend practical next actions from current operating state, proof targets, evidence strength, and reality completeness.
- How accepted decisions, One Move execution, proof recording, ledger events, Adaptive Strategy, and Future Movement relate.
- Which panels can be ignored unless Darren needs deeper support or admin evidence.

## Panel Map Created

The compact panel map covers:

- Strategy Chat
- Current Operating State
- Current Strategy / Five Futures / One Move
- Evidence & Proof / Outcome Loop
- Five Realities / System Status
- 9-Path Business Model Map
- Adaptive Strategy Draft
- Confidence / Truth Boundaries
- Financial/Admin Data
- Raw Profiles / Assessments / Adoption Records
- Build Map / Roadmap

Each panel now has compact fields for visibility, purpose, recommended user action, intelligence role, and primary reality.

## Recommended Workflow Created

The workflow tells Darren to:

1. Start with Current Operating State.
2. Use Strategy Chat for what changed, what to do next, what to say, or what not to overclaim.
3. Review Current Strategy / Five Futures / One Move.
4. Update Evidence & Proof / Outcome Loop after real action.
5. Check Five Realities / System Status to see what is thin, emerging, or strong.
6. Use the 9-Path map for major strategic direction.
7. Use Adaptive Strategy Draft only after enough new evidence exists.
8. Use Confidence / Truth Boundaries before claims or pitching.
9. Use Financial/Admin Data and Raw Records as support, not the main thinking surface.
10. Use Build Map / Roadmap to separate live capability from planned work.

## Next-Best-Action Logic

The helper now creates qualitative next-action rules:

- If evidence is thin, record proof before trying to move futures.
- If Financial Reality is thin or emerging, verify payment/revenue evidence before claiming traction.
- If Business Model Alignment is strong but Financial Reality is thin, convert one path into measurable revenue evidence or partner commitment.
- If Constraint Reality is emerging, clarify the One Move proof target and record whether the action happened.
- If Confidence Reality is thin or emerging, use Confidence / Truth Boundaries before pitching or presenting.
- If a One Move exists, execute or update it before generating new strategy.
- If a proof target exists, record an outcome against it.

## Strategy Chat Wiring

`api/admin/darren-strategy-chat.js` now tells the model to use `dashboard_workflow_context` for help and workflow intents.

Strategy Chat should now answer questions like:

- What are all these panels?
- How do I use this dashboard?
- Where should I start?
- What should I do next?
- How do I move the Five Futures?
- What proof should I record?
- What should I not overclaim?

The intended style is short, practical, and action-oriented.

## Boundaries

- Backend changed: yes.
- Frontend changed: no.
- Adaptive Strategy changed: no.
- Prompts changed: yes, Strategy Chat workflow guidance only.
- Model selection changed: no.
- Records mutated: no.
- Usage tracking added: no.
- Recursive Score built: no.
- MOLT/Grok built: no.
- Full admin rows added to prompts: no.
- Private profile content added: no.
- Assessment response detail added: no.
- Automatic future movement added: no.
- Active strategy replacement added: no.

People Reality boundary preserved:

> Darren build uses Darren's behavioral operating style only. Employee/team/org personality layers are future organizational intelligence, not part of this current Darren dashboard.

## Next Sprint

DASH-RECURSION-2H should audit recursive learning readiness. It should judge whether the system has enough accepted decisions, recorded proof, ledger events, session summaries, movement assessments, and adaptive drafts to responsibly discuss self-improving behavior.

## Validation

- `node --check api/admin/darren-dashboard-context-core.js`: passed
- `node --check api/admin/darren-strategy-chat.js`: passed
- `git diff --check`: passed
- `npm run build`: passed with existing Vite large chunk warning
- JSON trace parse: passed
- Static privacy/claim scan: passed after scenario-lens wording avoided watched phrases

## Limits

- Chat guidance only.
- No UI redesign.
- No frontend code changed.
- No records intentionally mutated.
- No usage tracking.
- No recursive score.
- No outside discovery integration.
- No new persistence.
