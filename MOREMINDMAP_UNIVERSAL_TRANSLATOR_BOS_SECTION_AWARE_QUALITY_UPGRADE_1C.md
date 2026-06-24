# MM-UX-1C — BOS Universal Translator Section-Aware Quality Upgrade

## Verdict

MOREMINDMAP_UNIVERSAL_TRANSLATOR_BOS_SECTION_AWARE_QUALITY_UPGRADE_COMPLETE_WITH_LIMITS

## Classification

BOS_TRANSLATOR_SECTION_AWARE_CONTEXT_SHAPING_REPAIRED_NO_SOURCE_REPLACEMENT

## Root Cause

The Business Assessment translator performed better because it already received section-specific inputs such as Executive Diagnostic, Five Futures, One Move, and Truth Boundaries.

The BOS translator lagged because the retrieved Profile ID path sent one broad flattened visible text excerpt from regenerated profile HTML. That made the model infer section boundaries instead of receiving clean behavioral structure.

## Repair Summary

- Replaced the retrieved BOS flattened excerpt with a section-aware excerpt builder in `src/Profile.jsx`.
- Improved the `WebProfileReport.jsx` BOS translator payload to use labeled behavioral sections.
- Added BOS-specific translation instructions in `api/universal-translator.js`.
- Added a small BOS-only drawer helper sentence.
- No section-level BOS buttons were added in this pass; the top-level `Explain This Profile` control remains the main entry point.

## Section-Aware Strategy

The retrieved BOS helper uses visible rendered profile text only and shapes it into sections:

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

If a section cannot be identified from visible text, it is omitted. If extraction is incomplete, the helper still includes a bounded visible fallback excerpt.

## BOS Excerpt Builder

`buildBosTranslatorExcerptFromRenderedProfile`:

- uses visible rendered profile text only
- never passes raw HTML
- never passes raw JSON
- never passes canonical profile JSON
- never passes raw scoring objects
- cleans repeated whitespace
- removes obvious layout boilerplate where practical
- preserves meaningful section labels
- bounds the final excerpt to 6,000 characters

## BOS Prompt Upgrade

For `bos_profile` and `bos_section`, the route now instructs the translator to:

- explain how the person operates
- explain where the pattern helps
- explain where the pattern can cost them
- explain pressure behavior when supported by source
- explain how others may experience the pattern when supported by source
- prefer `how_this_shows_up_in_real_life`
- include overclaim boundaries when relevant
- avoid generic personality-test language
- avoid diagnostic, clinical, fixed-personality, or certainty claims

## English-Only Policy

Universal Translator v0 remains English-only.

Allowed modes remain exactly:

- `plain_english`
- `explain_like_busy`
- `coach_me_through_this`

No language selector, locale handling, multilingual metadata, or non-English output was added.

## Source Of Truth Policy

Original BOS output remains the source of truth. Translation is a comprehension layer only and does not replace the source profile.

## Record Mutation Policy

No records are mutated. No translations are stored. No profiles are regenerated.

## Limits

- Section-level BOS buttons are deferred.
- Section extraction depends on visible rendered headings/text.
- The route still relies on a model for valid translation output.
- This sprint does not change Business Assessment placement, Stripe, Darren dashboard, or payment behavior.
