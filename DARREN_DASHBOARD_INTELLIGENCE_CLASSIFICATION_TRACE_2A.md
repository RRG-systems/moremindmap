# DASH-TRACE-2A - Darren Dashboard Intelligence Classification Trace

## Verdict

DARREN_DASHBOARD_INTELLIGENCE_CLASSIFICATION_TRACE_COMPLETE_WITH_LIMITS

## Classification

TRACE_ONLY_DASHBOARD_INTELLIGENCE_MAP_READY_FOR_APP_STACK_DESIGN

## Plain Answers

1. GPT/API intelligent sections: Darren Strategy Chat, Generated Strategy, Generated Five Futures, One Move This Week, Adaptive Strategy Draft. Future Movement Gate is API/deterministic scoring today, while Adaptive Draft uses GPT.
2. Deterministic sections that feed intelligence: Darren Intelligence Snapshot, operating view, strategic goal, E->P lens, Opportunity Path Comparison, 9-Path Backbone, proof targets, overclaim guardrails, evidence gaps, One Move Status, Outcome Ledger, Since Last Snapshot, session summaries, sales/adoption counts, profile and assessment indexes.
3. Static/display-only or legacy panels: Strategic Build Map roadmap cards, Unavailable Revenue Fields, V1 Truth Boundary display, roadmap future phases, duplicate scaffold blocks once generated strategy exists.
4. The sections that matter most to Strategy Chat are latest generated strategy, One Move, Outcome Ledger, Since Last Snapshot, proof targets, 9-Path Backbone, operating style, and build map truth/limits.
5. Main redundancies: proof targets, evidence gaps, overclaim boundaries, path comparison vs 9-path map, Five Futures scaffold vs generated Five Futures, roadmap truth copy vs live truth boundary copy.
6. Future default-open candidates: Strategy Chat, Current Strategy/Five Futures/One Move, Evidence & Proof Targets, Outcome Ledger/Since Last Snapshot.
7. Collapse or move: 9-Path map collapsible, Adaptive Strategy Loop admin/advanced, Sales Visibility supporting stack, raw tables admin-only, roadmap/build map collapsed or archived.
8. Best subscription usage signals: profile count, assessment count, company adoption, generated strategy existence, chat/session summary count, One Move status, Outcome Ledger event count, Since Last Snapshot/future movement records, Adaptive Draft count.

## Section Classification

| Section | Category | Current source | Feeds Chat | Feeds Adaptive Draft | Feeds Since/Future Movement | Evidence mutation | Recommendation | Reason |
|---|---|---|---|---|---|---|---|---|
| V1 Read-Only Leadership Sales Dashboard shell | DETERMINISTIC_FEEDS_INTELLIGENCE | admin API data | partial | partial | partial | no | MOVE_TO_SUPPORTING_STACK | Gives adoption and activity context but is not the primary Darren operating surface. |
| Sales Visibility intro | DETERMINISTIC_FEEDS_INTELLIGENCE | admin API data + static copy | partial | partial | partial | no | MOVE_TO_SUPPORTING_STACK | Frames real activity counts and missing revenue fields. |
| Summary counters | DETERMINISTIC_FEEDS_INTELLIGENCE | `/api/admin/sales-dashboard` + local filtering | partial | partial | partial | no | MOVE_TO_SUPPORTING_STACK | Counts are useful for subscription and adoption signal tracking. |
| Strategic Build Map | STATIC_DISPLAY_OR_LEGACY_IDEA_PANEL | `src/data/leadershipBuildMap.js` | partial | no | no | no | KEEP_COLLAPSIBLE | It is roadmap/truth context; Strategy Chat includes compact build map truth but the full cards are not core Darren UX. |
| Darren Leadership Intelligence shell | DETERMINISTIC_FEEDS_INTELLIGENCE | `/api/admin/darren-intelligence-snapshot` | yes | partial | partial | no | PROMOTE_DEFAULT_OPEN | This is the source-labeled operating context container. |
| Darren Strategy Chat | API_POWERED_GPT_INTELLIGENT | `/api/admin/darren-strategy-chat` GPT route | yes | partial | partial | only on explicit user action through separate confirmed routes | PROMOTE_DEFAULT_OPEN | Primary conversational strategy interface; chat response itself remains non-mutating. |
| Momentum Machine operating view | DETERMINISTIC_FEEDS_INTELLIGENCE | snapshot builder/local interpretation | yes | partial | partial | no | PROMOTE_DEFAULT_OPEN | Core operating context for Darren-facing reasoning. |
| Strategic Goal / $250M scenario lens | DETERMINISTIC_FEEDS_INTELLIGENCE | snapshot builder/static user goal | yes | partial | no | no | KEEP_COLLAPSIBLE | Important guardrail, but should not dominate the app surface. |
| E->P Lens | DETERMINISTIC_FEEDS_INTELLIGENCE | snapshot builder/local interpretation | yes | partial | partial | no | KEEP_COLLAPSIBLE | Useful coaching frame, likely better as supporting context. |
| Opportunity Path Comparison | DETERMINISTIC_FEEDS_INTELLIGENCE | snapshot builder/static path list | yes | partial | partial | no | MERGE_WITH_RELATED_SECTION | Overlaps strongly with the 9-Path Backbone. |
| 9-Path Business Model Backbone | DETERMINISTIC_FEEDS_INTELLIGENCE | `src/data/darrenBusinessModelBackbone.js` + local coverage | yes | partial | partial | no | KEEP_COLLAPSIBLE | Durable route map used by Strategy Chat context and path reasoning. |
| Five Futures Scaffold | STATIC_DISPLAY_OR_LEGACY_IDEA_PANEL | snapshot scaffold | partial | no | no | no | CANDIDATE_FOR_REMOVAL_OR_ARCHIVE | Helpful before generation only; redundant after saved generated strategy exists. |
| One Move Scaffold | STATIC_DISPLAY_OR_LEGACY_IDEA_PANEL | snapshot scaffold | partial | no | no | no | CANDIDATE_FOR_REMOVAL_OR_ARCHIVE | Same as scaffolded futures; collapse once generated strategy exists. |
| Snapshot Proof Targets | DETERMINISTIC_FEEDS_INTELLIGENCE | snapshot builder | yes | partial | partial | no | MERGE_WITH_RELATED_SECTION | Duplicate of generated proof targets; should merge into one Evidence stack. |
| Snapshot What Not To Overclaim | DETERMINISTIC_FEEDS_INTELLIGENCE | snapshot builder | yes | partial | partial | no | MERGE_WITH_RELATED_SECTION | Duplicate of generated guardrails/model limits; keep as one truth boundary stack. |
| Unavailable / Not Yet Live | STATIC_DISPLAY_OR_LEGACY_IDEA_PANEL | snapshot builder/static limits | partial | no | no | no | KEEP_COLLAPSIBLE | Useful boundary copy, but not a primary interaction surface. |
| Snapshot Evidence Gaps | DETERMINISTIC_FEEDS_INTELLIGENCE | snapshot builder | yes | partial | partial | no | MERGE_WITH_RELATED_SECTION | Should be combined with generated evidence gaps and proof targets. |
| Generated Strategy control | API_POWERED_GPT_INTELLIGENT | `/api/admin/darren-intelligence-generate` | yes after saved | yes | yes | yes, creates saved strategy on explicit generate | PROMOTE_DEFAULT_OPEN | Produces the real Five Futures + One Move artifact. |
| Generated Five Futures | API_POWERED_GPT_INTELLIGENT | saved generated strategy records | yes | yes | yes | no | PROMOTE_DEFAULT_OPEN | Core generated strategic intelligence. |
| One Move This Week | API_POWERED_GPT_INTELLIGENT | saved generated strategy records | yes | yes | yes | no | PROMOTE_DEFAULT_OPEN | The most actionable Darren-facing generated output. |
| Generated Evidence Gaps | API_POWERED_GPT_INTELLIGENT | saved generated strategy records | yes | yes | partial | no | MERGE_WITH_RELATED_SECTION | Same conceptual stack as proof targets and guardrails. |
| Generated Next Proof Targets | API_POWERED_GPT_INTELLIGENT | saved generated strategy records | yes | yes | partial | no | PROMOTE_DEFAULT_OPEN | Direct next evidence collection target. |
| Generated What Not To Overclaim | API_POWERED_GPT_INTELLIGENT | saved generated strategy records | yes | yes | partial | no | MERGE_WITH_RELATED_SECTION | Keep, but merge with truth boundaries/limits. |
| Model Limits | API_POWERED_GPT_INTELLIGENT | saved generated strategy records | partial | yes | no | no | KEEP_COLLAPSIBLE | Important safety boundary but secondary to action. |
| One Move Status Tracking | DETERMINISTIC_FEEDS_INTELLIGENCE | `/api/admin/darren-one-move-status` + saved strategy | yes | yes | yes | only on explicit user action | PROMOTE_DEFAULT_OPEN | Starts the evidence loop by recording acceptance/status/signal. |
| Outcome Ledger v0 | DETERMINISTIC_FEEDS_INTELLIGENCE | `/api/admin/darren-outcome-ledger-*` + durable records | yes | yes | yes | only on explicit user action | PROMOTE_DEFAULT_OPEN | Core evidence collection layer. |
| Since Last Snapshot | DETERMINISTIC_FEEDS_INTELLIGENCE | `/api/admin/darren-since-last-snapshot` | yes | yes | yes | no | PROMOTE_DEFAULT_OPEN | Converts stored status/ledger evidence into a readable comparison. |
| Adaptive Strategy Loop v0 shell | DETERMINISTIC_FEEDS_INTELLIGENCE | local UI + adaptive routes | partial | yes | yes | only on explicit user action | KEEP_COLLAPSIBLE | Powerful but advanced/admin-like; should not crowd the main Darren view. |
| Session Memory | DETERMINISTIC_FEEDS_INTELLIGENCE | `/api/admin/darren-chat-session-summary` records | partial | yes | partial | only on explicit user action | KEEP_COLLAPSIBLE | Feeds Adaptive Draft; raw chat transcripts are not stored. |
| Future Movement Gate | DETERMINISTIC_FEEDS_INTELLIGENCE | `/api/admin/darren-future-movement-*` | partial | yes | yes | only on explicit user action | KEEP_COLLAPSIBLE | Evidence-band assessment, not GPT language generation. |
| Adaptive Strategy Draft | API_POWERED_GPT_INTELLIGENT | `/api/admin/darren-adaptive-strategy-draft` GPT route | partial | yes | partial | only on explicit user action creates pending draft | KEEP_COLLAPSIBLE | Generated review artifact; should remain advanced until adoption flow exists. |
| Company Adoption | DETERMINISTIC_FEEDS_INTELLIGENCE | sales dashboard API + local normalization | partial | partial | partial | no | MOVE_TO_SUPPORTING_STACK | Valuable for subscription/adoption tracking, less central to Darren chat UX. |
| V1 Truth Boundary | STATIC_DISPLAY_OR_LEGACY_IDEA_PANEL | sales dashboard API notes/limits | partial | no | no | no | KEEP_COLLAPSIBLE | Boundary copy is useful but duplicates other limits. |
| Behavior Profiles table | DETERMINISTIC_FEEDS_INTELLIGENCE | sales dashboard API / durable records | partial | partial | partial | no | KEEP_ADMIN_ONLY | Raw operational table; useful for admin/sales follow-up, not main Darren view. |
| Business Assessments table | DETERMINISTIC_FEEDS_INTELLIGENCE | sales dashboard API / durable records | partial | partial | partial | no | KEEP_ADMIN_ONLY | Raw operational table; useful for admin/sales follow-up, not main Darren view. |
| Unavailable Revenue Fields | STATIC_DISPLAY_OR_LEGACY_IDEA_PANEL | sales dashboard API note/static copy | no | no | no | no | KEEP_COLLAPSIBLE | Important limit, but should live inside a boundaries/supporting stack. |

## Duplicate / Redundant Intelligence

- Truth boundaries, what-not-to-overclaim, model limits, and V1 limits: merge into one Truth Boundaries / Limits stack, with generated guardrails first and roadmap/API limits collapsed.
- Evidence gaps and proof targets: merge into one Evidence & Proof Targets stack, showing next proof target before static gap lists.
- Opportunity Path Comparison and 9-Path Backbone: merge or nest Opportunity Path as a simplified summary above the 9-Path map.
- Generated Five Futures and 9-Path Backbone: keep separate because Five Futures are generated scenarios while 9-Path is durable route taxonomy.
- Five Futures Scaffold and generated Five Futures: archive/collapse scaffold after generated strategy exists.
- Strategic Build Map live/future roadmap and dashboard truth notes: collapse roadmap; keep only live truth near the relevant feature stack.

## Recommended Future App Stack

| Group | Default | Audience | Role | Subscription priority |
|---|---|---|---|---|
| Strategy Chat | default open | Darren-facing | GPT/API intelligent | high |
| Current Strategy / Five Futures / One Move | default open | Darren-facing | GPT/API intelligent | high |
| Evidence & Proof Targets | default open | Darren-facing | mixed generated + deterministic | high |
| Outcome Ledger / Since Last Snapshot | default open | Darren-facing with admin controls | deterministic evidence loop | high |
| 9-Path Business Model Map | collapsed | Darren-facing | deterministic context for reasoning | medium |
| Adaptive Strategy Draft | collapsed | admin/advanced | GPT/API intelligent draft generation | high later |
| Sales Visibility / Adoption Data | collapsed/supporting | admin-facing | deterministic adoption signals | high |
| Admin Tables / Raw Records | collapsed/admin-only | admin-facing | deterministic records | medium |
| Roadmap / Build Map | collapsed/archive | admin-facing | static roadmap | low |
| Truth Boundaries / Limits | collapsed but visible warning state | both | safety/context | medium |

## Recommended Next Sprint

`DASH-DESIGN-2B`: design the simplified app-stack dashboard hierarchy from this classification without changing backend behavior. Default-open should be chat, current strategy, proof/evidence, and since-last/outcome context. Raw tables, roadmap, and repeated boundary copy should become collapsed/admin/supporting stacks.

## Limits

- Trace only.
- No runtime code changed.
- No dashboard redesign implemented.
- No API routes changed.
- No prompts changed.
- No model selection changed.
- No records mutated.
- No deploy required.
- The PDF path provided is outside the allowed workspace, so this trace uses the section list from the prompt plus repo source inspection.
