# Architecture Report

Evidence class: observed plus inference.

The implementation adds one dormant durable composition layer over the existing Live Session service. Authoritative events stay append-only through the production event adapter. Checkpoints, projections, workflow records, failures, and migration receipts are derived scoped objects. Internal restart durability uses an append-only, fsynced JSONL snapshot journal under ignored `.runtime-data/`; production Redis is untouched. The only canonical Business Engine call remains injected, subscriber-confirmation gated, and protected by a persisted promotion receipt.
