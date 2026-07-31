# BOS Truthfulness Layer V1 — Written Evidence Report

## Coverage

The extractor consumes the existing question metadata registry and routes all
ten written questions through their declared evidence roles:

1. life direction
2. setback response
3. immediate pressure
4. ambiguity response
5. leadership self-assessment
6. sustained pressure
7. misunderstanding response
8. business operating reality
9. growth tension
10. systems and accountability

## Extraction rules

- Question-specific signal dictionaries replace one global substring scan.
- Terms require non-alphanumeric boundaries, preventing partial-word matches.
- Top-level retained answers have explicit precedence; the nested canonical
  copy is a backward-compatible fallback.
- Source paths, counts, bounded excerpts, matched terms, and signal IDs are
  retained as evidence metadata.
- Full source text is used only during deterministic validation and is removed
  from the public written-evidence projection.

## Proven regression

The focused fixture proves all ten roles are reached. Boundary probes prove that
`pressure` does not match `sure` and `tasking` does not match `ask`.

## Boundary

This extractor does not change scoring, question wording, dimension routing, or
the canonical dossier. It supplies only Layer 2 evidence for bounded inference.
