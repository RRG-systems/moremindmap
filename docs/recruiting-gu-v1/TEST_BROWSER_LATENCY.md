# Recruiting GU V1 test, browser, and latency report

## Automated gates

| Gate | Result |
|---|---|
| ESLint on all changed/new JS and JSX | PASS |
| Vite production build | PASS |
| Focused GU/Leadership/authority/runtime tests | 33/33 PASS |
| Relevant Recruiting + Leadership + BOS + BA + Five Futures + One Move + Business Twin matrix | 215/215 PASS |
| `git diff --check` | PASS |
| Subscription implementation diff from base | NONE |
| Authored BOS/BA renderer diff from base | NONE |

The build emits the repository's existing advisory that the main minified JavaScript chunk exceeds 500 kB. It is not a compile failure and was not broadened into a code-splitting campaign.

## Browser acceptance performed

- Darren HOME and standard-manager HOME composition.
- Clean Darren/Jordan synthetic open.
- YOU: complete BOS, 15/15 governed surfaces, all nine authored destinations present; Work & Role clicked and rendered.
- YOUR BUSINESS: complete Business Twin, all five authored destinations present; Five Possible Futures clicked and rendered.
- Back and Next movement; PLAN has Back only.
- Persistent conversation through BOS → GU → BOS → BA → GU → BA → PLAN.
- People/role, relationship, visual comparison, Five Futures/trajectory, evidence, hypothesis revision, purpose change, and bounded scenario recomposition.
- Manual scenario control: released hours changed from 8 to 9; modeled result changed from +$650 to +$1,256 (+$606); surface remained visibly labeled `Modeled—not observed`.
- PLAN proposal v1, ADJUST to v2, YES completion, NOT NOW second offer, second offer YES receipt, and graceful-close branch.
- Refresh/resume and one-time-CSRF recovery.
- iPad portrait and landscape; no page-level horizontal overflow/collision after containment pass.
- Final frozen rail audit: no speaker toggle, Reset, canned opening block, or PLAN Next button.

## Frontier and progressive latency observations

| Acceptance action | Progressive state | Provider | Notes |
|---|---:|---:|---|
| People/role environment | recorded | 17,931 ms | Frontier selected trend + hypotheses + person primitives |
| Five Futures/trajectory | 537 ms | 10,336 ms | Exact returned model recorded as `openai/gpt-5.6-luna` |
| Relationship/comparison | 797 ms | 11,794 ms | Relationship and comparison primitives selected |
| Hypothesis revision | 784 ms | 11,116 ms | Prior hypothesis superseded with a visible revision reason |
| Material purpose change | 775 ms | 19,514 ms | Recomposition returned to Five Futures while conversation persisted |
| Scenario environment | 793 ms | 10,335 ms | Safe interactive scenario controls |
| Scenario follow-up | recorded | 11,361 ms | 30,519 ms observed wall time included the QA polling cadence, not provider time |
| PLAN proposal v1 | 798 ms | recorded in receipt | Approximate observed wall time 21,375 ms |
| PLAN proposal v2 after ADJUST | 788 ms | recorded in receipt | Approximate observed wall time 24,328 ms |

Cold local route transitions were approximately 280 ms HOME selection, 281 ms selected HOME → YOU, and 286 ms YOU → YOUR BUSINESS.

The UX does not pretend frontier reasoning is instantaneous: a meaningful progressive state appears under one second while the governed plan is generated and validated. Invalid plans, invented references, prohibited persuasion/score language, unsafe actions, and stale bindings fail closed; no deterministic semantic router manufactures a substitute answer.
