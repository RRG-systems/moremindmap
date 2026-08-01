# Regression Evidence

## Pre-change baseline

The established Layer 1, Layer 2, Narrative V3, and BOS to BA set passed 25 of 25 tests from clean `origin/main`.

## Focused hardening

Command:

```text
node --test test/bosLayer2Hardening.test.js
```

Result: 9 of 9 passed.

## Combined BOS invariants

Command:

```text
node --test test/bosLayer2Hardening.test.js test/bosTruthfulnessLayer.test.js test/narrativeV3.unifiedInterpreter.test.js test/bosMeasurementFoundation.test.js test/bosFusionInvariants.test.js
```

Result: 34 of 34 passed.

## Final validation

- `node --test test/*.test.js`: 86 of 86 passed.
- `npm run build`: passed; Vite transformed 135 modules and emitted the production bundle.
- Focused ESLint for the new classifier, cache, gate, start route, and hardening test: passed.
- Touched legacy files: 14 pre-existing `no-unused-vars` findings remain; no new finding. The clean `origin/main` baseline had those 14 findings plus eight `no-undef` findings in the broken null fallback.
- Whole-repository lint: 538 findings after hardening versus 546 on clean `origin/main`; the repository-wide pre-existing lint gate remains nonzero and was not expanded.
- `git diff --check`: passed.

## Direct sanitized proof

- active cache schema: 9;
- TTL ceiling: 24 hours;
- fresh and cache-hit truthfulness: `bos_truthfulness_v1`;
- complete answer count: 28;
- 27-answer classification: partial, quality 96;
- canonical contract extended: false;
- null fallback: `truthfulness_fail_closed`;
- customer tabs: 8;
- overview sections: 5; and
- executive summary and One Move populated.
