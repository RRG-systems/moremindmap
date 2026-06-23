# MM-ADMIN-4E.1 - Since Last Snapshot Repair

## Verdict

MOREMINDMAP_DARREN_SINCE_LAST_SNAPSHOT_REPAIR_COMPLETE_WITH_LIMITS

## Scope

This repair is limited to Since Last Snapshot evidence semantics and one visible dashboard label.

## Evidence Semantics Repair

- `outcome_event_added` remains true when a ledger event exists.
- `evidence_added` is now false when the latest evidence weight is `none`.
- `evidence_added` is true only for `weak`, `early`, `moderate`, `strong`, `validated`, or `invalidated`.
- `strong_evidence_added` remains true only for `strong` or `validated`.
- `validated_evidence_added` remains true only for `validated`.
- Future movement remains unsupported when the latest evidence weight is `none`.

## UI Label Repair

The Since Last Snapshot panel now renders the exact label:

`Next best prompt/action`

The API field remains `next_best_prompt`.

## Limits

- No chat was added.
- No automatic learning was added.
- No future scoring was added.
- No Redis write behavior was changed.
- No generated strategy or ledger records were mutated by this patch.
- Deployment is required before the repair is live in production.
