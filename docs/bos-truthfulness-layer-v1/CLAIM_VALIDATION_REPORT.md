# BOS Truthfulness Layer V1 — Claim Validation Report

## Implemented validation

Before a claim is eligible for presentation, Layer 2 checks for:

- missing evidence or provenance
- unsupported certainty language
- quotations not present in the cited source text
- unsupported numeric timelines
- unsupported percentages or multiplier outcomes

A failed validation converts the claim to `Insufficient Evidence`; it does not
soften or paraphrase the unsupported conclusion into a customer claim.

Narrative V3 then applies the claim gate after Layer 3 translation. This means a
GPT or local-fallback rendering cannot override evidence sufficiency. The gate
preserves section schemas for Team Experience, Five Futures, One Move, and
facilitator notes.

## Customer-path correction

The customer presentation layer previously reconstructed confident executive,
scaling, team, and future prose after Narrative V3 completed. V1 detects the
truthfulness contract and preserves the same customer view-model schema while
using only evidence-gated claim text or `Insufficient Evidence`.

## Test proof

Focused tests reject unsupported `always`/`will` statements, 30-day claims,
25-percent outcomes, and fabricated quotations. They also prove that the old
premium-prose phrases do not reappear in the truthfulness-aware customer path.
