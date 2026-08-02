# Regression Evidence

## Current results

- focused universal/Layer 2/Layer 3/BOS-to-BA set: 39/39 pass
- full repository suite: 779/779 pass
- focused ESLint across changed implementation and tests: pass
- production build: pass
- historical public-route compatibility: 50/50 pass
- diff check: pass

The first full-suite run found two BOS-to-BA failures caused by the mechanical lineage conflict omitting existing `q1`/`q6` locals. The bounded reconciliation restored those declarations. The affected focused tests then passed 10/10, and the final full-suite rerun passed 779/779.

## Proven families

- canonical, Layer 1, and Layer 2 semantics unchanged by translation
- exact Layer 2 on every failure state
- claim IDs and semantic contracts cannot drift
- unsupported claims retain `Insufficient Evidence`
- identity and raw answers absent from packets
- version-complete cache invalidation
- durable isolated cache and single-flight
- access/rate/concurrency/output/timeout bounds
- semantic Narrative V3 cache invalidation
- historical retrieval without regeneration or mutation
- Visual DNA topology and abstentions preserved
- BOS-to-BA shared canonical semantics preserved
