# BOS Truthfulness Layer V1 — Deployment Evidence

## Status

Deployed with documented limits.

- Application source commit: `deb9344699609a884e12d9e3b777e6d905913cf5`
- Focused branch: `bos-truthfulness-layer-v1`
- Production branch: `main`
- Deployment mechanism: GitHub push to `main` through the connected Vercel production project
- Deployment ID: `dpl_4qRkZgKLrYzWDYeJUsvZK8croWa4`
- Production URL: `https://moremindmap.com`
- Immutable deployment URL: `https://moremindmap-bog9wrdwy-rrg-systems-projects.vercel.app`
- Deployment state: `READY`
- Deployed production asset: `https://moremindmap.com/assets/index-4tBNnj3e.js`

The release was produced from the isolated clean worktree:
`/private/tmp/moremindmap-bos-truthfulness-v1`. Before push, `HEAD` and the
fetched `origin/main` were both the authorized application commit, the
worktree was clean, and `origin/main` had not advanced from the campaign base.

## Validation gates

All required gates passed before deployment:

- focused truthfulness tests: 8/8 passed
- combined Layer 1, Layer 2, Narrative V3, and BOS-to-BA tests: 25/25 passed
- full repository test suite: 77/77 passed
- production build: passed
- `git diff --check origin/main..HEAD`: passed
- focused Layer 2 lint: passed
- new lint debt: none; the 16 findings in the two legacy files were reproduced
  unchanged from the exact pre-campaign `origin/main` baseline

The tests also confirmed that Layer 2 rendering does not mutate canonical
input, Layer 1 measurement remains intact, BOS-to-BA fusion remains intact,
and the Business Engine, Five Futures, and One Move contracts remain intact.

## Production smoke verification

Read-only production checks completed after the deployment reached `READY`:

- production root returned HTTP 200
- synthetic-format customer profile route returned HTTP 200
- `/api/moremindmap/ping` returned HTTP 200
- invalid profile retrieval returned HTTP 400 before any Redis lookup
- the deployed production bundle returned HTTP 200 and contained
  `bos_truthfulness_v1`, `evidence_sufficiency`, `deterministic_layer_2`,
  `Insufficient Evidence`, truthfulness-aware customer projection text, and
  the explicit `gpt_used_for_measurement` and `layer_1_scores_modified`
  boundary fields
- source-path inspection at the deployed commit confirmed truthfulness is
  applied after response normalization; no Layer 2 evidence is passed to the
  prompt builders or `callGPT55`

The exact deployed-commit synthetic regression proof confirmed:

- sparse input: 0 supported claims and explicit abstention for every claim
- measured claims retain evidence, provenance, confidence, sufficiency, and
  validation contracts
- unsupported certainty, timeline, quantified, and quotation claims fail closed
- customer BOS projection still produces 8 tabs and 5 overview sections
- BOS-to-BA, Business Engine, Five Futures, and One Move contracts remain valid

## Production safety

No customer record was read or changed for this release. No Redis or Vault
write was made. No profile was regenerated. No environment variable,
deployment configuration, Coach Connect, subscription runtime, Business
Assessment, Business Engine, Five Futures, or One Move change was made.

## Remaining limits

- Confidence scores are structurally bounded and explicitly marked
  `calibrated: false`; empirical calibration remains future work.
- The immutable Vercel deployment URL is protected from anonymous direct
  access by the project security boundary. `READY` state and build metadata
  were verified through Vercel, while customer-facing HTTP checks used the
  production alias.
- Production smoke execution used the deployed bundle plus synthetic fixtures
  on the exact deployed commit. No real customer profile was accessed because
  this campaign prohibited customer-data changes and did not require a
  customer-specific validation.

## Final deployment verdict

`BOS_TRUTHFULNESS_LAYER_DEPLOYED_WITH_LIMITS`
