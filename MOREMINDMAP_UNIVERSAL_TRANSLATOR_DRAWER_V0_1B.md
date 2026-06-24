# MM-UX-1B — Universal Translator Drawer v0

## Verdict

MOREMINDMAP_UNIVERSAL_TRANSLATOR_DRAWER_V0_IMPLEMENTED_WITH_LIMITS

## Classification

BOS_AND_BA_MEANING_TRANSLATOR_NON_MUTATING_V0

## Summary

Universal Translator Drawer v0 adds a bounded English-only meaning translator for BOS/Profile output and Business Assessment output.

The translator converts MORE technical language into plain human English. It does not replace the original output, mutate records, store translations, regenerate profile or assessment intelligence, or add multilingual translation.

## Route Added

`POST /api/universal-translator`

Allowed `source_type` values:

- `bos_profile`
- `bos_section`
- `business_assessment`
- `five_futures`
- `one_move`
- `truth_boundary`
- `adaptive_draft`
- `general_moremindmap`

Allowed `translation_mode` values:

- `plain_english`
- `explain_like_busy`
- `coach_me_through_this`

The route rejects missing excerpts, invalid source types, invalid modes, oversized excerpts, and raw object payloads. It returns sanitized JSON only.

## Drawer Added

`src/components/universalTranslator/UniversalTranslatorDrawer.jsx`

The drawer shows:

- What it says
- What it means
- Why it matters
- What to do next
- How this shows up in real life, when present
- What not to overclaim, when present
- Truth boundary, when present

It includes the source-of-truth note:

`Original output remains the source of truth.`

## BOS Placement

The BOS/Profile report includes a top-level button:

`Explain This Profile`

It passes a bounded visible summary from the rendered profile report, not raw canonical dossier JSON.

## Business Assessment Placement

The Business Assessment Executive Diagnostic includes:

- top-level `Make this plain English`
- section-level `Explain simply`
- Five Futures `Explain these futures`
- One Move `Explain this move`
- truth-boundary `Why this matters`

All launchers pass bounded visible text or labels, not raw assessment answers or hidden JSON.

## English-Only Boundary

Universal Translator v0 is English-only.

It does not add:

- language selection
- locale handling
- Spanish, Portuguese, French, Arabic, or other language output
- translation language metadata

## Source Of Truth Policy

The original MORE MindMap output remains the source of truth. Translation is a comprehension layer only.

## Mutation Policy

No records are mutated.

The translator does not write:

- profile records
- assessment records
- strategy records
- ledger records
- payment records
- translated output records

## Limits

- No durable translation storage.
- No output replacement.
- No multilingual translation.
- No payment changes.
- No Darren dashboard changes.
- Valid model smoke can be skipped locally if model env is unavailable.
