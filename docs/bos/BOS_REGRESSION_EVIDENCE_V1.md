# BOS Measurement Foundation Regression Evidence V1

## Automated results

| Gate | Result |
| --- | --- |
| `node --test test/bosMeasurementFoundation.test.js test/bosFusionInvariants.test.js` | 10/10 pass |
| `node --test test/*.test.js` | 69/69 pass |
| `npm run build` | pass |
| `git diff --check` | pass |
| New modules/tests focused ESLint | 0 findings |
| Business Engine contract validation | pass |
| Baseline/repaired contract structural signature | identical |

## Lint baseline

Focused ESLint over all modified tracked legacy files reports 107 existing findings. The same files at unmodified `HEAD` report 108 findings. The campaign introduced no new lint category or finding; it removed one prior unused-variable finding while replacing the stale written-question loop. The remaining findings are inherited unused-variable, Node-global, and constant-expression debt outside this campaign's measurement scope.

## Permanent regression cases

- Signed score semantics and no-evidence distinction
- Reachable low/high canonical branches
- Static absence of known legacy 0–10 comparison leaks
- Zero-safe fallback and customer score projection
- 28 unique question routes and ten written routes
- Q17 immediate pressure and Q24 sustained pressure
- Canonical resolver source/score/confidence precedence
- Deterministic schema-aware prompt compaction
- Identical behavioral rank/score semantics across BID/Executive/Futures/One Move
- Full BOS-to-BA-to-Business-Engine-to-BA-Visual-DNA invariant

## Build note

Vite reports the existing large-chunk advisory. The build succeeds; no bundling or deployment configuration was changed.
