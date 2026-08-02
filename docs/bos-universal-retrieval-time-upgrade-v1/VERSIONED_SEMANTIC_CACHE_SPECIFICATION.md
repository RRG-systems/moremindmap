# Versioned Semantic Cache Specification

## Namespace

Durable translations use `bos:l3:*`. No translation key or value is stored under `vault:profile:*`.

## Identity

Every key binds:

- cache version: `bos_l3_translation_cache_v2`
- Layer 2 version: `bos_truthfulness_v1`
- semantic hash
- surface-manifest hash
- model version: `gpt-5.6-sol`
- prompt version: `prompt-v1`
- validator version: `validator-v1`
- output variant: `premium-web-v1`
- Layer 3 translation version: `bos_customer_intelligence_v1`
- translation variant: `standard`

The identity contains no name, email, company, Profile ID, or raw answer. TTL is 24 hours. Every read revalidates identity, age, source hash, and the full translation bundle. Invalid entries are rejected and removed. Cache read/write failures fail back to Layer 2 and do not mutate Vault.

Browser cache uses the same identity. Any change to Layer 2, semantics, surfaces, model, prompt, validator, output variant, or translation version produces a different key.
