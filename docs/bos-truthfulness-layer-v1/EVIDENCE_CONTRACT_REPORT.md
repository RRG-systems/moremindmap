# BOS Truthfulness Layer V1 — Evidence Contract Report

## Result

Layer 2 exposes one deterministic evidence contract for every generated claim.
The contract is additive at render time and is not written into the canonical
dossier.

Each contract includes:

- `claim_id`, rendered claim, proposed claim, and classification
- bounded evidence references with source path, question, role, excerpt, and signal IDs
- provenance with source, path, extraction method, and Layer 2 version
- numeric confidence, confidence band, calibration disclosure, and basis
- evidence count, minimum evidence, and sufficiency status
- validation failures, abstention reason, and alternative explanations

When evidence or validation is insufficient, the rendered claim and
classification are exactly `Insufficient Evidence`. The proposed claim remains
available only for auditability; it is not presented as a supported conclusion.

## Boundary proof

- Layer 1 scores are read, never modified.
- No Layer 2 field is added to the canonical dossier.
- Layer 2 data is not added to the GPT request.
- The customer view-model retains its established field and section shapes.

## Verification

`test/bosTruthfulnessLayer.test.js` proves that all 24 Layer 2 claims have the
required evidence, provenance, confidence, sufficiency, validation, and
abstention fields.
