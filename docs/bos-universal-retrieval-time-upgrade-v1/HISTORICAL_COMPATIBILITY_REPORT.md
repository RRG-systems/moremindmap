# Historical Compatibility Report

## Governing denominator

The prior read-only architecture trace established 64 Vault records, 60 retrievable canonical-compatible premium profiles, and four non-enumerated ancient/test exclusions.

## Current implementation rerun

The production diagnostic inventory endpoint intentionally returns only the newest 50 records. The campaign verifier retrieved and rebuilt all 50 without writes or identity output:

- production inventory total: 64
- currently enumerable: 50
- rebuilt successfully: 50/50
- current Layer 2: 50/50
- valid Layer 3 packet and complete cache identity: 50/50
- exact Layer 2 failback: 50/50
- 8 tabs: 50/50
- 5 Overview sections: 50/50
- canonical JSON unchanged: 50/50
- excluded among scanned profiles: 0

The other ten eligible profiles are covered by the prior 60-profile trace, but could not be re-enumerated because `list-all-profiles` has a fixed 50-record cap and production `REDIS_URL` is intentionally not downloadable through the operator environment pull. This is an evidence-access limit, not a compatibility failure.

No customer comparison or similarity scoring was performed.
