# Cache Invalidation Report

Layer 3 cache identity already includes semantic hash, surface identity, model, prompt version, validator version, translation version, and output variant. Bumping the prompt, validator, translation, and output-variant versions changes the cache key, so Version 1 wording cannot satisfy a Version 2 lookup.

Focused tests prove old and new identities diverge, successful Version 2 translations replay from the durable `bos:l3:` cache, and the canonical profile is not mutated. Controlled preview replay returned `cache` for all three review profiles with the expected Version 2 semantic hashes.
