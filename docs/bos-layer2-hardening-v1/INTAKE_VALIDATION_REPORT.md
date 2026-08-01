# Intake Validation Report

## Finding

The start route only required a nonempty answer object. Downstream profile construction skipped missing or invalid answers, while canonical diagnostics always reported `quality_score: 100`.

## Hardening

`assessmentCompleteness.js` applies the existing 28-question metadata to every intake shape and deterministically records:

- complete, partial, or invalid status;
- expected, submitted, and valid answer counts;
- missing and invalid question IDs;
- unexpected answer keys; and
- a count-based diagnostic quality score.

The shared classifier is used at the start route, by `BuildProfileInput`, and by canonical diagnostics. Incomplete input retains the existing bounded partial-generation behavior but is explicitly classified, receives `data_quality: low`, and cannot report a diagnostic quality score of 100.

## Compatibility decision

Partial intake is classified rather than newly rejected. This preserves the existing intake response and canonical-generation architecture while preventing incomplete data from masquerading as complete. The canonical dossier schema remains unchanged.

## Evidence

Focused tests prove 28 valid answers report complete/100; 27 valid answers report partial/96; and an invalid choose-two answer is identified without changing normalization semantics.
