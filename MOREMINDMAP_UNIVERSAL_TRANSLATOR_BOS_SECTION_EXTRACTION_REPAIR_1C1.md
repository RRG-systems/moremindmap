# MM-UX-1C.1 — BOS Translator Section Extraction Reality Check + Repair

## Verdict

MOREMINDMAP_UNIVERSAL_TRANSLATOR_BOS_SECTION_EXTRACTION_REPAIR_COMPLETE_WITH_LIMITS

## Classification

BOS_TRANSLATOR_REAL_SECTION_EXTRACTION_REPAIRED_NO_SOURCE_REPLACEMENT

## Why 1C Did Not Visibly Improve Darren's BOS Translation

MM-UX-1C shaped BOS input with keyword windows over one flattened visible text string. That was better than sending a completely generic excerpt, but it still depended on guessed keywords matching Darren's actual rendered report headings.

If the real retrieved BOS HTML used different headings or class-based section titles, the helper could miss meaningful boundaries and still send a broad fallback excerpt. That explains why the output could appear unchanged even though the code deployed.

## Reality Check

The current same-origin production retrieve route for `mm-20260527-6zshuaao` returns canonical profile data rather than regenerated HTML, so no raw Darren HTML was printed or committed.

The actual user-visible issue remains in the regenerated HTML branch in `src/Profile.jsx`:

`result.version === "retrieved" && result.html`

That branch is now repaired by parsing heading-like HTML structure instead of relying only on flattened text keywords.

## Real Heading Strategy

The new helper inspects visible rendered HTML structure using `DOMParser` and extracts heading-like nodes:

- `h1`
- `h2`
- `h3`
- `h4`
- `strong`
- `b`
- class names containing `title`
- class names containing `heading`

It then walks visible text from one heading to the next and maps headings flexibly into BOS categories.

## BOS Category Mapping

The repaired helper maps real headings into:

- Profile context
- Behavior Operating System summary
- Core Operating Style
- Behavioral Advantages
- Behavioral Risks
- Pressure Pattern
- Communication Style
- Decision Style
- Execution Pattern
- Growth Edge
- Recommended Next Move
- Profile DNA / DNA Summary
- Visible source excerpt fallback

## Fallback Strategy

If the HTML parser finds fewer than three meaningful mapped sections, the helper falls back to sentence windows around flexible BOS category patterns.

The final excerpt always includes:

`BOS section-aware excerpt: true`

This appears only inside the source excerpt sent to the model. It is not visible UI.

When structured sections exist, the visible fallback excerpt is shortened so it does not dominate the model input.

## API Prompt Change

For BOS source types, the route now instructs:

`If the source excerpt is organized into BOS sections, translate section by section. Do not collapse the profile into a generic personality summary.`

The JSON contract is unchanged.

## Section Buttons

Section-level BOS buttons remain deferred. The repair focuses on the quality of the top-level `Explain This Profile` source excerpt.

## Source Of Truth Policy

Original BOS output remains the source of truth. Translation is a comprehension layer only.

## Private Data Policy

The translator launcher passes bounded visible rendered text only.

It does not pass:

- raw canonical dossier JSON
- raw profile JSON
- raw scoring objects
- hidden source data
- Redis keys
- env values
- prompts
- raw model output

## English-Only Policy

Universal Translator v0 remains English-only. No language selector, locale metadata, or multilingual output was added.
