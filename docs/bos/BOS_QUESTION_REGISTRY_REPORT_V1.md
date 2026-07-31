# BOS Question Registry Report V1

## Decision

Question routing is derived from `QUESTION_MAP`; downstream code no longer owns competing written-question lists.

## Registry facts

- Total questions: 28
- Written questions: 10
- Written IDs: Q2, Q14, Q17, Q20, Q22, Q24, Q25, Q26, Q27, Q28
- Immediate-pressure evidence: Q17
- Sustained-pressure evidence: Q24
- Q15 remains ordinary MC intake and is not treated as written evidence.
- Every question ID is routed exactly once.
- Every evidence role is unique.

## Evidence roles

| Question | Role |
| --- | --- |
| Q2 | `life_direction` |
| Q14 | `setback_response` |
| Q17 | `immediate_pressure` |
| Q20 | `ambiguity_response` |
| Q22 | `leadership_self_assessment` |
| Q24 | `sustained_pressure` |
| Q25 | `misunderstanding_response` |
| Q26 | `business_operating_reality` |
| Q27 | `growth_tension` |
| Q28 | `systems_accountability` |

## Consumers unified

- Intake normalization uses the registry's question-by-ID map.
- Profile data quality and written-response extraction use registry-derived written IDs.
- Immediate/sustained pressure analysis resolves by evidence role.
- Long-form canonical analysis resolves source questions by evidence role.
- Deterministic rescoring derives its written-question scan from the same registry.

## Compatibility

Question text, IDs, types, option weights, ranking semantics, choose-two semantics, canonical field names, and downstream contracts did not change. The new `evidence_role` metadata is additive.

## Validation

The permanent registry test asserts 28 unique routes, ten written questions, unique evidence roles, Q17 immediate pressure, Q24 sustained pressure, and a complete sanitized 28-answer intake.
