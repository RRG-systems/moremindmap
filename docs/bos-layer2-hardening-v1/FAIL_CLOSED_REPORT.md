# Fail-Closed Report

## Finding

The Narrative V3 section catch path returned the pre-Layer-2 local fallback. The null-canonical fallback was also malformed and threw before returning a narrative.

## Hardening

- `applyTruthfulnessGate()` now contains its own exception boundary.
- Missing claims and gate exceptions use one schema-aware `buildInsufficientEvidenceSection()` path.
- Team Experience, Five Futures, Facilitator Notes, and One Move retain their established structured shapes while abstaining.
- Interpretation initialization failures return a complete ten-section Layer 2 narrative.
- A truthfulness-projection failure rebuilds a sparse deterministic Layer 2 contract and abstains.
- Null canonical input returns a complete, nonthrowing `truthfulness_fail_closed` narrative.
- No catch path returns confident legacy narrative text.

## Contract impact

All existing customer section shapes are preserved. Only the unsupported content is replaced with explicit `Insufficient Evidence`.

## Evidence

Focused tests inject truthfulness and canonical exceptions, exercise all ten sections, and prove no synthetic confident legacy sentence survives.
