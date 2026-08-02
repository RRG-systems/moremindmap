# BOS Layer 3 Customer Intelligence V1 — Human Review Gate

## Gate status

**PENDING — deployment is not authorized by validation state yet.**

Automated validation can prove structural fidelity and reject known unsafe
claim forms. It cannot determine whether a customer genuinely recognizes their
lived operating pattern. The governing mission therefore requires a human
review before production activation or deployment.

## Review setup

1. Use a non-production review deployment with both Layer 3 feature flags on.
2. Use synthetic or consented review profiles; do not compare customers with
   one another.
3. Review the GPT translation and its bound Layer 2 claim side by side.
4. Review at least: Executive Summary, Core Operating Pattern, two score cards,
   One Move, Team abstention, Five Futures abstention, and Visual DNA.
5. Confirm no raw answers or identity appear in the model request or logs.

## Required ratings

Rate each sampled surface from 1 to 5.

| Criterion | Required result | Reviewer question |
| --- | --- | --- |
| Recognition | Median at least 4; no fabricated lived event | “Does this help the customer recognize a real pattern without claiming an event we did not observe?” |
| Readability | Median at least 4 | “Can a non-technical customer understand this on one read?” |
| Humility | Every item 5 | “Does the language preserve uncertainty and avoid diagnosis, prediction, or certainty?” |
| Scientific fidelity | Every item 5 | “Is every psychological statement supported by the bound Layer 2 claim?” |

## Review record

| Profile / fixture | Surface | Recognition | Readability | Humility | Scientific fidelity | Pass / fail | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
|  |  |  |  |  |  |  |  |

## Hard failures

Any one of these blocks deployment:

- changed score, rank, claim, evidence, provenance, confidence, or abstention;
- invented motive, memory, relationship reaction, outcome, future, or timeline;
- confident language where Layer 2 is insufficient;
- customer copy that sounds impressive but is not recognizable or faithful;
- a failed deterministic validator or a bypass around it;
- translation generated from raw answers, canonical data, or identity;
- failure of the deterministic fallback on timeout or model rejection.

## Approval

Reviewer name: ____________________

Review date: ____________________

Verdict: `APPROVED_FOR_LAYER3_DEPLOYMENT` / `REJECTED_FOR_REVISION`
