# MM-UX-1C.3 BOS Translator Section-Level Payloads

## Purpose

Business Assessment translation is stronger because it sends the Universal Translator clean, artifact-specific payloads such as `one_move`, `five_futures`, and `truth_boundary`. BOS translation lagged because the retrieved BOS/Profile path still sent one broad `bos_profile` payload, even after section-aware shaping.

This sprint adds BOS section-level translator launchers so BOS can behave more like BA: one clear section, one source title, one bounded visible excerpt.

## What Changed

### Retrieved BOS/Profile ID Path

File: `src/Profile.jsx`

The retrieved profile branch:

`result.version === "retrieved" && result.html`

now derives reliable visible BOS sections from the rendered HTML and shows a compact section launcher area only when at least two reliable sections are found.

The top-level button remains:

- `Explain This Profile`

New optional section area:

- `Explain specific parts`

Possible section buttons, capped at six:

- Explain operating style
- Explain advantages
- Explain risks
- Explain pressure pattern
- Explain communication style
- Explain growth edge
- Explain profile DNA

Each section button sends:

- `source_type: bos_section`
- `source_title`: actual visible heading when available
- `source_excerpt`: one bounded visible section body
- `profile_context`: bounded retrieved profile ID context only

If fewer than two reliable sections are found, no section buttons are shown.

### WebProfileReport Path

File: `src/components/reports/WebProfileReport.jsx`

The structured web profile renderer now gets the same pattern from safe narrative fields:

- Core Operating Style
- Pressure Pattern
- Communication Style
- Growth Edge
- Recommended Next Move
- Behavior Operating System summary

The top-level `Explain This Profile` remains intact.

### API Instruction

File: `api/universal-translator.js`

`bos_section` was already allowlisted. A small instruction was added:

`For bos_section, translate only the submitted BOS section. Do not infer the entire profile.`

The JSON response contract did not change.

### Drawer Copy

File: `src/components/universalTranslator/UniversalTranslatorDrawer.jsx`

When the source is `bos_section`, the drawer helper text now says:

`Translate this behavior section into plain English.`

Business Assessment drawer behavior was not changed.

## Why BA Was Better

BA gave the model clean translation jobs:

- Explain this move.
- Explain these futures.
- Explain this truth boundary.

BOS was asking the model to explain a broad profile and infer the relevant sections from a large excerpt. This repair changes BOS toward the BA pattern by creating section-specific `bos_section` payloads.

## Source Excerpt Policy

Section excerpts are built from visible rendered output only.

The section payloads do not pass:

- raw HTML
- raw JSON
- canonical profile JSON
- hidden canonical profile text
- raw scoring objects
- full profile objects
- Redis keys
- env values
- prompts
- raw model output

Each section body is cleaned and bounded.

## Button Limits

No more than six section-level BOS buttons can appear.

Buttons are shown only if the retrieved profile helper finds at least two reliable sections. This avoids turning the BOS profile into a cluttered control surface.

## Original Output Boundary

The original BOS output remains visible and remains the source of truth. The Universal Translator is still only a comprehension layer.

## English-Only Boundary

No multilingual behavior was added.

Allowed modes remain:

- `plain_english`
- `explain_like_busy`
- `coach_me_through_this`

No language selector, locale metadata, Spanish, Portuguese, French, or Arabic output was added.

## Verdict

`MOREMINDMAP_UNIVERSAL_TRANSLATOR_BOS_SECTION_LEVEL_PAYLOADS_IMPLEMENTED_WITH_LIMITS`

BOS now has section-level translation payloads where reliable section boundaries exist. This directly addresses the payload-quality gap found in MM-UX-1C.2 without replacing source output, storing translations, mutating records, or changing Business Assessment behavior.
