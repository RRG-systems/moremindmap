# MM-UX-1B.1 — Universal Translator BOS Placement Repair

## Verdict

MOREMINDMAP_UNIVERSAL_TRANSLATOR_BOS_PLACEMENT_REPAIR_COMPLETE_WITH_LIMITS

## Classification

BOS_RETRIEVAL_TRANSLATOR_PLACEMENT_REPAIRED_NO_SOURCE_REPLACEMENT

## Root Cause

Universal Translator v0 was added to `WebProfileReport.jsx`, but the retrieved BOS/Profile ID path for some saved profiles renders through the regenerated HTML branch in `src/Profile.jsx`:

`result.version === "retrieved" && result.html`

That path did not mount the Universal Translator drawer or show the `Explain This Profile` control.

## Actual BOS Renderer Repaired

`src/Profile.jsx`

The repaired path is the Profile ID retrieval renderer that displays regenerated profile HTML.

## Repair Summary

- Added `UniversalTranslatorDrawer` to `src/Profile.jsx`.
- Added a visible `Explain This Profile` button to the retrieved Profile ID report header.
- The source excerpt is built from visible rendered report HTML text only.
- The excerpt is bounded to 5,000 characters.
- The original BOS output remains visible and unchanged.

## Source Excerpt Policy

The repair does not pass raw canonical dossier JSON, raw scoring objects, hidden profile records, or full raw payloads.

It converts the already-rendered report HTML into visible text and sends only a bounded excerpt to the existing translator route.

## Boundaries

- No translator API route changes.
- No Business Assessment translator changes.
- No multilingual support.
- No record mutation.
- No profile output replacement.
- No Stripe or payment behavior changes.
- No Darren dashboard changes.
