# Production Hardening Report

## One truth path

The repaired flow is:

1. normalize answers with the existing question metadata;
2. classify completeness without mutating answers;
3. preserve Layer 1 measurement and canonical generation;
4. construct deterministic Layer 2 truthfulness;
5. gate every Narrative V3 section;
6. cache only an active, complete Layer 2 rendering; and
7. project the existing customer view model.

Cache misses, current cache hits, legacy cache entries, local rendering, GPT rendering, section exceptions, malformed canonical input, and null canonical input now converge on the same Layer 2 truthfulness invariant.

## Preserved boundaries

- Layer 1 score production and measurement contracts are unchanged.
- Canonical dossier output is unchanged.
- Layer 2 remains render-time and deterministic.
- Layer 2 evidence is not added to GPT requests.
- BOS to BA fusion is unchanged.
- Business Engine, Executive Diagnostic, Five Futures, and One Move contracts are unchanged.
- Profile IDs and Redis/Vault schemas are unchanged.

## Operational behavior

Old browser cache entries are invalidated lazily on read. No migration, profile regeneration, or customer-data write is required.
