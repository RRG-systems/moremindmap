# MM-UX-1C.2 Universal Translator Payload Trace: BA vs BOS

## Purpose

This sprint did not patch the translator blindly. It traced the difference between the Business Assessment translator payloads and the Behavior Operating System translator payloads so the next repair can target the real quality gap.

Production context:

- Production: https://moremindmap.com
- Current deployed commit before this diagnostic: `af11723 repair bos translator section extraction`
- Universal Translator remains English-only.
- Original BOS and Business Assessment outputs remain the source of truth.
- No records were mutated.
- No model output was stored.

## Files Added

- `scripts/trace-universal-translator-payloads.mjs`
- `runtime_traces/moremindmap_universal_translator_payload_trace_ba_vs_bos_1c2.json`

No production runtime UI or API code was changed.

## What Was Inspected

Targeted source inspection covered:

- `src/Profile.jsx`
- `src/components/reports/WebProfileReport.jsx`
- `src/components/businessAssessment/ExecutiveDiagnosticBriefing.jsx`
- `src/components/universalTranslator/UniversalTranslatorDrawer.jsx`
- `api/universal-translator.js`
- `src/data/moreMeaningDictionary.js`

The diagnostic script compares sanitized representative payloads based on the actual component construction patterns. It does not call OpenAI and does not fetch or store private profile records.

## Payload Findings

### Business Assessment Payload Pattern

Business Assessment sends clean, artifact-specific payloads:

- `business_assessment` with source title `Executive Diagnostic Briefing`
- `five_futures` with source title `Five Futures`
- `one_move` with source title `One Move`
- `truth_boundary` with source title `Truth Boundaries / What Not To Overclaim`

These payloads are not necessarily large. They are better because they are already scoped to the thing being explained.

BA payloads carry:

- explicit business context
- clear artifact names
- domain-specific source types
- concrete business consequence
- evidence labels or truth boundaries
- a natural next-action frame

### BOS Payload Pattern

Darren's retrieved BOS path in `src/Profile.jsx` sends one top-level payload:

- `source_type`: `bos_profile`
- `source_title`: `Behavior Operating System Profile`
- `source_excerpt`: generated from rendered HTML extraction

MM-UX-1C.1 added section extraction, and the drawer can now show a section-aware excerpt. However, the payload is still one broad profile-level request. The user-observed live excerpt includes only a few shallow labels such as:

- Profile context
- Behavior Operating System summary
- limiting pattern / Behavioral Risks

The trace confirms the likely issue: BOS now has section markers, but it does not yet send the same kind of clean, artifact-specific payloads that BA sends.

## Why BA Translator Is Better

BA is stronger because the UI gives the translator a smaller job:

1. Explain this diagnostic section.
2. Explain these futures.
3. Explain this move.
4. Explain this truth boundary.

Each request has a precise source type and a concise source excerpt with a built-in interpretation frame.

BOS is still asking:

1. Explain this whole profile.
2. Infer the important behavioral sections from visible HTML.
3. Decide which sections matter.
4. Translate them without the clean section-level source text that BA already has.

The API prompt is different for BOS and BA, but the trace indicates that prompt changes alone are not enough. BA quality is driven primarily by better payload shape.

## Does BOS Lack Source Material, Section Boundaries, Or Prompt Framing?

Trace-supported answer:

- BOS has some section boundaries after 1C.1.
- BOS still lacks enough clean, rich, section-specific source material.
- BOS still sends a broad `bos_profile` payload rather than targeted `bos_section` payloads.
- BOS prompt framing is directionally correct, but the input does not give it the same clean anchors BA receives.

The likely quality gap is source payload quality, not model capability.

## Exact Quality Gap

BA payloads are narrow and semantic:

- `one_move` means translate a single action.
- `five_futures` means translate possible trajectories.
- `truth_boundary` means preserve overclaim limits.

BOS payload is broad:

- `bos_profile` means translate a full behavior profile.
- The section extractor may find labels, but the extracted source still depends on whatever the rendered HTML exposes.
- If the rendered profile uses non-semantic or shallow headings, the translator receives a shallow section map.

## Recommended Next Sprint

Recommended next sprint:

**MM-UX-1C.3 — BOS Translator Section-Level Payloads**

Build BOS translator launches that mirror BA's successful structure:

- Add section-level BOS translator buttons where section boundaries are reliable.
- Use `source_type: bos_section`.
- Use the actual visible section heading as `source_title`.
- Pass one clean visible section body at a time.
- Keep the existing top-level `Explain This Profile` as a broad summary option.
- If retrieved HTML sections remain unreliable, route the retrieved profile through the safer structured summary pattern already used by `WebProfileReport.jsx`.

Do not solve this with another prompt-only change.

## Boundaries Preserved

- No multilingual support added.
- No language selector added.
- No locale metadata added.
- No records mutated.
- No translations stored.
- No source output replaced.
- No raw canonical dossier, raw profile JSON, raw scoring object, raw assessment answer, Redis key, env var, prompt, raw model output, or stack trace exposed.

## Verdict

`MOREMINDMAP_UNIVERSAL_TRANSLATOR_PAYLOAD_TRACE_COMPLETE_WITH_LIMITS`

The BOS translator is not failing because the drawer is missing or the route is broken. It is underperforming because its live payload is still too broad and shallow compared with Business Assessment's section-specific payloads. The next repair should create BOS section-level payloads or reuse a safer structured BOS summary source, not add more generic prompt pressure.
