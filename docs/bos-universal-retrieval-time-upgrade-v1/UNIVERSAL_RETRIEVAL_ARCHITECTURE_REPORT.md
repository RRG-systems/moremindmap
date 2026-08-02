# Universal Retrieval Architecture Report

## Production truth path

```text
premium Profile ID
→ canonical-only retrieve-profile API
→ deterministic current Narrative V3 + Layer 2 truthfulness
→ customer BOS view model
→ identity-free Layer 3 semantic packet
→ exact Layer 2 render immediately
→ server verifies packet against the same existing canonical profile
→ durable validated cache or one bounded GPT-5.6 call
→ validator-approved presentation overlay
```

The canonical retrieval API remains unchanged and never invokes GPT. Translation begins only after the premium customer view model exists.

## Boundaries

- Canonical BOS, retained answers, Profile IDs, scores, rankings, confidence, evidence, provenance, and abstention are not modified.
- The model receives the Layer 2 semantic packet only. Identity and raw answers are absent.
- Translation cannot enter Business Assessment, Business Intelligence Draft, Business Engine, Executive Diagnostic, Five Futures generation, or One Move generation.
- Mini, legacy HTML, stacked fallback, and non-premium paths remain outside Layer 3.
- Feature-off, cache failure, network failure, timeout, validation rejection, and concurrency saturation all preserve profile availability through exact Layer 2.

## Access boundary

The application’s current premium access token is possession of a valid Profile ID. The translation route tightens that existing boundary by retrieving that exact profile server-side, rebuilding its authoritative packet, and requiring structural equality with the submitted packet. It therefore cannot operate as a public free-text translator.
