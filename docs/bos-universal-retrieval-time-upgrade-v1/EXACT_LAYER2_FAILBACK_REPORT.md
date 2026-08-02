# Exact Layer 2 Failback Report

Layer 3 no longer generates or displays a deterministic Layer 3 paraphrase while waiting or after failure.

`resolveLayer3CustomerViewModel()` applies an overlay only when:

1. a bundle exists;
2. the receipt source is `cache` or `gpt_translation`; and
3. the complete bundle validates against the current packet.

Otherwise it returns the original Layer 2 object by reference.

Automated proof covers feature-off, missing transport, timeout, rejected output, unavailable durable cache, concurrency saturation, and unapproved fallback sources. Each case proves both object identity and structural equality with the original Layer 2 view model.

Customer behavior:

```text
loading/failure/stale/invalid/off → exact Layer 2
validated cache/GPT success       → Layer 3 presentation overlay
```
