# MM-UX-1A — Universal Translator Doctrine + MORE Meaning Dictionary

## Verdict

MOREMINDMAP_UNIVERSAL_TRANSLATOR_DOCTRINE_AND_DICTIONARY_DEFINED_WITH_LIMITS

## Classification

MEANING_TRANSLATOR_FOUNDATION_READY_FOR_BOS_AND_BA_UI

## Purpose

The Universal Translator is a meaning translator. It is not a language translator first.

It translates MORE MindMap intelligence into human understanding using:

- the MORE ontology
- the Behavior Operating System dictionary
- the user's profile and business context
- truth-boundary rules
- coaching translation rules

The dashboard can stay intelligent. The translator makes it conversational.

## Locked Method

Technical profile or assessment output -> human behavior underneath -> real-world consequence -> plain-language explanation -> coaching sentence or next action.

The translation method is:

1. Extract the technical claim.
2. Identify the human behavior underneath it.
3. Translate the consequence.
4. Say it like a person.
5. Add the coaching sentence.

## Source Of Truth Policy

The original output remains the source of truth.

The translator does not replace:

- BOS profile output
- Business Assessment output
- Five Futures
- One Move
- Outcome Ledger entries
- Since Last Snapshot summaries
- Future Movement Gate bands
- Adaptive Strategy Drafts

Translation is a comprehension layer only.

## Record Mutation Policy

Universal Translator v0 must not mutate records.

It must not:

- alter profile records
- alter assessment records
- create strategy records
- create ledger events
- create payment records
- rewrite generated output
- store source content as a new truth layer

## Placement Doctrine

Universal Translator v0 will eventually appear in two output families.

### BOS / Behavior Operating System

Recommended placements:

- Top profile-level control: "Explain This Profile"
- Section-level control: "Explain simply"
- Plain-language summary panel: "Your Profile In Plain English"

### BA / Business Assessment

Recommended placements:

- Top result-level control: "Make this plain English"
- Five Futures: "Explain these futures"
- One Move: "Explain this move"
- Truth Boundaries / What Not To Overclaim: "Why this matters"
- Adaptive Draft: "Explain this draft"

## UX Doctrine

- Use one translator drawer, not popups everywhere.
- Section-level buttons should appear only where output is dense.
- Buttons are optional comprehension helpers, not required navigation.
- Original output remains visible.
- Translation does not replace source text.
- The drawer should include:
  - What it says
  - What it means
  - Why it matters
  - What to do next
- For BOS, it may also include:
  - How this shows up in real life
- For BA, it may also include:
  - What not to overclaim

## Translator Output Shape

Recommended v0 output:

- `what_it_says`
- `what_it_means`
- `why_it_matters`
- `what_to_do_next`
- `how_this_shows_up_in_real_life` for BOS contexts when useful
- `what_not_to_overclaim` for BA contexts when useful
- `truth_boundary` when the source output contains evidence limits or not-live boundaries

## Translation Rules

The Universal Translator must:

- preserve accuracy
- preserve evidence limits
- preserve warnings
- preserve not-live boundaries
- avoid hype
- avoid invented proof
- keep nuance
- keep overclaim warnings clear
- avoid technical jargon unless immediately explained
- translate into practical meaning
- add one coaching sentence or next action where appropriate

## MORE Meaning Dictionary

The static dictionary source is:

`src/data/moreMeaningDictionary.js`

It exports:

- `universalTranslatorDoctrine`
- `moreMeaningDictionary`
- `moreMeaningDictionaryCategories`

The dictionary is static. It does not call a model, write records, read private storage, or change runtime behavior.

## Dictionary Categories

- MORE system terms
- BOS behavior terms
- Business and real estate terms

## Implementation Limits

This sprint does not implement:

- translator UI
- translator API route
- model calls
- language-specific translation
- record mutation
- output replacement
- profile or assessment regeneration

## Next Sprint Recommendation

Build Universal Translator v0 as a non-mutating drawer that can receive a bounded source excerpt and source type, then return a structured explanation using the dictionary and truth-boundary rules.
