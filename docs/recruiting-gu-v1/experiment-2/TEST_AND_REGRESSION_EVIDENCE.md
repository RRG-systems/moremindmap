# Test and regression evidence

## Focused Experiment 2 and GU V1

Command:

`node --test test/recruitingGuV1.test.js test/recruitingGuV1.experiment2.test.js`

Final result after the complete-sentence validator addition: 14 passed, 0 failed.

Coverage includes:

- four independently runnable conditions;
- coach/optional-compiler separation;
- no duplicate conversation turn on visual compilation;
- YOU BOS-only context;
- maximum two hash-verified Business authorities;
- protected-answer and invented-number refusal;
- incomplete visible-thought repair;
- Patricia ID absent from browser subject metadata;
- Patricia fail-closed without a canonical reader;
- fixed direct OpenAI strict/no-store request shape;
- stale revision refusal, plan flow, scenario binding, and MORE-ID consent regression.

## Protected Recruiting and Subscription regressions

Command covered GU V1, Recruiting V1, Campaign 2G/Recruiting V2 synthetic session, Subscription AFW 01–06, three-track living map, and private-runtime Subscription adapters.

Result: **153 passed, 0 failed**.

## Full repository test comparison

Current run: **925 total, 905 passed, 20 failed**.

Checkpoint evidence before Experiment 2: **922 total, 902 passed, 20 failed**.

Net: three new passing tests and zero new full-suite failures. All 20 failures remain in the pre-existing Coach Connect private-runtime async-security/attachment group; none touch Recruiting GU V1 or files changed by this experiment.

## Lint

- Changed-file ESLint: pass.
- Repository-wide `npm run lint`: pre-existing failure, 1,030 problems, dominated by generated `.vite-test-cache`, legacy narrative/report code, and existing React hook/refresh rules.
- No changed Experiment 2 file appears in the repository-wide error list.

The generated `.vite-test-cache` was removed after the run.

## Build and integrity

- `npm run build`: pass (182 modules transformed).
- Output: `dist/assets/index--SyIzmx6.js`, 1,992.14 kB, 486.79 kB gzip.
- Existing large-chunk warning remains.
- `git diff --check`: pass.
- Client bundle sensitive-boundary scan: pass; no Patricia profile ID, protected answer phrase, or `INTERNAL_REASONING_ONLY_DO_NOT_QUOTE` marker.

## Browser proof

- Local server verified on `127.0.0.1:5197`.
- Real provider returned `gpt-5.6-sol` through OpenAI Responses.
- Synthetic YOU and YOUR BUSINESS rendered with full authored surfaces and the distinct coach.
- Progressive status captured before frontier completion.
- Patricia tab captured at the explicit fail-closed read-only Redis boundary.
- No browser console/runtime error was required to produce the synthetic proof.
