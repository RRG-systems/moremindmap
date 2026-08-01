# Cache Invariant Report

## Finding

Narrative V3 cache reads previously accepted unversioned entries, did not enforce the stored TTL, and returned memory entries without validating them. A structurally valid legacy narrative could therefore bypass Layer 2.

## Hardening

- Active cache schema: `9`.
- Active truthfulness contract: `bos_truthfulness_v1`.
- Maximum cache TTL: 24 hours.
- Memory and browser storage now use the same wrapped entry and validation path.
- Cache reads require the active cache version, active truthfulness wrapper version, a valid non-future timestamp, an unexpired TTL, the deterministic Layer 2 authority contract, and all ten Narrative V3 sections.
- Cache writes refuse narratives without the active Layer 2 contract.
- Legacy, expired, malformed, incomplete, and wrong-version entries are discarded and regenerated through the current path.

## Contract impact

No canonical, BOS score, customer view-model, BOS to BA, Business Engine, Five Futures, or One Move contract changed. The cache remains a render-time optimization only.

## Evidence

`test/bosLayer2Hardening.test.js` proves raw legacy entries, expired entries, old schema versions, and non-Layer-2 writes fail closed while current entries remain reusable.
