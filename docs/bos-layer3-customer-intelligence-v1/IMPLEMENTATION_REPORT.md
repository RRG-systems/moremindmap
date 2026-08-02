# BOS Layer 3 Customer Intelligence V1 — Implementation Report

## Status

This branch contains a review candidate. It is not enabled or deployed.

Layer 3 is a customer translation boundary only. The technical BOS, Layer 1
measurement, Layer 2 truthfulness contracts, canonical dossier, and downstream
product contracts remain the authority.

## Architecture

```text
Canonical BOS
  -> Narrative V3 Layer 2 truthfulness gate
  -> truthfulness-aware customer BOS view model
  -> immutable identity-free semantic packet
  -> optional GPT-5.6 Sol translation
  -> deterministic semantic validator
  -> customer-only premium surface adapter
  -> existing customer renderer
```

The model receives only projected Layer 2 claims, evidence/provenance
references, confidence contracts, abstentions, and protected display values.
It does not receive names, companies, profile IDs, retained answers, raw answer
text, canonical objects, or Advanced Source content.

## Implemented boundaries

- `bos_customer_intelligence_v1` immutable packet with deterministic semantic
  hash.
- Exact claim IDs, claim text, classification, confidence score/band/basis,
  `calibrated: false`, sufficiency, and abstention contracts.
- Deterministic rejection of semantic-contract drift, weakened abstention,
  unsupported certainty, unsupported timelines/quantities, new numbers, and
  fabricated quotations.
- GPT-5.6 Sol Responses API request with strict structured output.
- Twelve-second server timeout and deterministic fallback.
- Twenty-four-hour semantic-hash cache containing no identity or raw answers.
- Default-off server and client feature flags.
- Dedicated Visual DNA customer adapter that preserves measured score topology
  and replaces unsupported inherited defaults with `Insufficient Evidence`.
- Existing renderer contract retained: eight tabs and five Overview sections.

## Customer surface policy

| Surface | Layer 3 treatment |
| --- | --- |
| Overview cards | Translate sufficient Layer 2 claims only |
| Eight operating scores | Explain the bound measured claim; score/rank remain protected |
| Visual DNA | Dedicated adapter; measured score topology preserved; unsupported defaults abstain |
| Five Futures | Preserve Layer 2 abstention unless sufficient future evidence exists |
| One Move | Translate the existing hypothesis; do not create a new move |
| Team / Leadership Fit | Preserve Layer 2 abstention without external-observer evidence |
| How to Use This | Existing deterministic Layer 2 guidance; no GPT translation |
| Advanced Source | Untouched technical source; no GPT translation |

## Activation controls

Both flags must be explicitly enabled in a reviewed deployment:

- `VITE_BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED=true`
- `BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED=true`

With either flag absent, production behavior remains the existing validated
Layer 2 customer experience. No environment variable was changed in this
campaign.

## Protected downstream architecture

No Layer 3 module is imported by canonical generation, Business Assessment
fusion, Business Engine, Executive Diagnostic, Five Futures generation, or One
Move generation. Layer 3 changes customer display objects only after the
truthfulness-aware BOS customer view model exists.
