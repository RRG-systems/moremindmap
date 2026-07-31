# BOS Measurement Contract Report V1

## Decision

BOS uses one signed behavioral-topology coordinate from scored intake through canonical inference, rescoring, prompt construction, and customer score projection. The repair does not introduce a new psychological construct or change any persisted field name.

## Contract

- Positive: submitted-choice evidence supports expression of the dimension.
- Negative: inverse or antagonistic evidence is stronger than supporting evidence.
- Zero with evidence: neutral net evidence.
- Zero with `evidence_count: 0`: no evidence, not a low trait.
- Low: below `0.35` with evidence.
- Moderate: `0.35` through below `0.65`.
- High: `0.65` through below `0.85`.
- Extreme: `0.85` or above.
- Scores are not clamped in the canonical measurement layer. Customer percentage projection remains bounded to the existing 0–1 presentation contract.

The executable contract is `api/engine/measurement/measurementContract.js`.

## Metadata-derived reachable bounds

The following support-adjusted extrema were calculated from `QUESTION_MAP`, including MC options, ranking-first semantics, choose-two combination semantics, evidence averaging, and the existing support factor.

| Dimension | Minimum | Maximum |
| --- | ---: | ---: |
| Vector | -0.1667 | 1.3333 |
| Signal | -0.3000 | 1.5333 |
| Fidelity | -0.3333 | 1.3333 |
| Velocity | -0.5000 | 1.3333 |
| Leverage | 0.0000 | 1.1000 |
| Flex | -0.5000 | 1.0000 |
| Framework | -0.5000 | 1.1667 |
| Horizon | -0.5000 | 1.0000 |

All low, moderate, high, and extreme predicates are now reachable. Negative evidence is reachable for seven dimensions. Leverage has no negative option weight in current metadata.

## Repairs

- Rebased runtime canonical predicates from unreachable legacy 0–10 thresholds into the actual topology unit.
- Repaired legacy `+2` comparison gaps, a `6.0` default threshold, Narrative V3 `>1.5`, and structured-render `>2` leaks.
- Replaced fallback score `5` with the explicit no-evidence zero state.
- Prevented zero-evidence values from activating low/high flags or appearing as customer scores when evidence metadata explicitly says zero.
- Kept all canonical field names, score-bearing object shapes, rank fields, and customer projection shapes intact.
- Required GPT rescoring to remain in the supplied baseline topology unit and reject non-finite or unit-incompatible output.

## Reachability evidence

`test/bosMeasurementFoundation.test.js` proves band semantics, static legacy-threshold absence, high/low role-fit reachability, fallback behavior, negative rendering behavior, and no-evidence behavior.

## Boundary

This is an engineering measurement contract. It does not claim clinical validity, population norms, reliability coefficients, construct validity, or external psychometric validation.
