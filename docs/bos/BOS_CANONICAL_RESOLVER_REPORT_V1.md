# BOS Canonical Behavioral Resolver Report V1

## Decision

Business Intelligence Draft, Executive Diagnostic, Five Futures, and One Move now use one resolver for canonical unwrapping, rank selection, score precedence, confidence, and provenance.

## Canonical unwrapping precedence

1. `canonical_profile_json`
2. `canonical_dossier.canonical_profile_json`
3. `canonical_dossier`
4. direct canonical object

## Ranked-source precedence

1. `rescoring_gpt.ranked_dimensions`
2. `rescoring_v1.ranked_dimensions`
3. `ranked_dimensions`
4. `dimension_scores`

Only a non-empty valid array or object mapping wins. An empty higher-priority layer cannot mask a populated lower-priority layer.

## Score precedence

1. `display_score`
2. `gpt_rescored_score`
3. `rescored_score`
4. `support_adjusted_score`
5. `raw_score`
6. `score`

Explicit zero is preserved. Numeric strings are normalized only when finite. Confidence resolves from `confidence`, then `confidence_score`.

## Provenance

The resolver returns canonical shape, ranked source, ranked count, score-source field, and confidence-source field. Existing downstream output objects retain their prior schemas; provenance is used for audit and is not forced into protected consumer contracts.

## Validation

Permanent tests prove nested canonical unwrapping, GPT-over-deterministic precedence, explicit display-score precedence, zero-safe selection, and identical dimension/rank/score signatures across BID and all three prompt pathways.
