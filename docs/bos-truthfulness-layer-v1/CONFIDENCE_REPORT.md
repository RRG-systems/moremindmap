# BOS Truthfulness Layer V1 — Confidence and Abstention Report

## Classification policy

Layer 2 supports exactly these classifications:

- Measured
- Inferred
- Estimated
- Hypothesis
- Insufficient Evidence

Measured claims report preserved Layer 1 topology scores and require at least
three contributing answer signals. Inferred written-answer claims require the
question coverage defined for their domain. Hypotheses are explicitly labeled
as tests and never presented as proven interventions. Estimated claims that
would require external-observer or longitudinal evidence abstain.

## Confidence policy

Confidence is deterministic and bounded from 0 to 1. Insufficient claims are
capped below 0.40. Inferred claims are capped below 0.80. Confidence records
state `calibrated: false`; the current values are evidence-sufficiency controls,
not empirically calibrated probabilities.

## Required abstentions

Layer 2 returns `Insufficient Evidence` for:

- stable contradictions without independent behavioral observation
- team experience without external-observer evidence
- strategic ceiling without longitudinal outcome evidence
- future trajectories or timelines without longitudinal outcome evidence

Sparse profiles fail closed: the synthetic zero-evidence fixture produces zero
supported claims and 24 explicit abstentions.

## Remaining limitation

Empirical calibration against longitudinal observations is not part of V1.
Confidence therefore communicates relative evidence sufficiency, not validated
predictive accuracy.
