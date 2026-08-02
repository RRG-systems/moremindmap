# Narrative Cache Semantic-Binding Report

Narrative cache schema advances from version 9 to version 10.

A cache hit now requires all of:

- matching Profile ID key;
- matching canonical semantic hash;
- active `bos_truthfulness_v1` contract;
- narrative cache schema version 10;
- valid required section shapes; and
- unexpired TTL no greater than 24 hours.

The canonical hash covers the canonical profile JSON and retained answer semantics. A score, ranking, answer, rescoring layer, or other canonical semantic change invalidates the entry. Legacy entries without the hash fail closed and are removed. Production callers now supply the canonical record to both cache read and write operations.

Regression proof shows same-ID changed semantics miss the cache, old schema misses, expired content misses, malformed storage misses, and valid equivalent content hits.
