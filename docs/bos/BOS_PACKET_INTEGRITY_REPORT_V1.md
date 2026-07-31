# BOS Prompt Packet Integrity Report V1

## Decision

Raw whole-object string slicing was replaced with deterministic schema-aware compaction. No serialized object is truncated mid-field.

## Guarantees

- Output is always parseable JSON or construction fails closed.
- Object keys are sorted deterministically.
- Required top-level fields remain present.
- String and array compaction occurs at field boundaries.
- Compaction is reported in `_packet_integrity` with reason, path, and omitted amount.
- Canonical behavioral snapshots, BID behavioral reality, and BID behavior/business fusion evidence are protected from compaction.
- Prompt character ceilings remain unchanged: Executive 45,000; Five Futures combined 60,000; Five Futures only 52,000; One Move 42,000.
- JSON is compact-serialized to spend the established character budget on evidence instead of whitespace.
- If the smallest safe packet cannot fit, construction throws `prompt_packet_cannot_fit` instead of emitting malformed or silently sliced JSON.

## Compaction profiles

Profiles progressively reduce per-string characters and nonprotected array items. Object fields are not erased by a depth cutoff. Arrays needed by the Five Futures taxonomy retain at least five items.

## Validation

Tests prove deterministic repeatability, valid JSON, bounded output, required-field preservation, explicit omission diagnostics, and zero omissions within the protected behavioral paths used for fusion.
