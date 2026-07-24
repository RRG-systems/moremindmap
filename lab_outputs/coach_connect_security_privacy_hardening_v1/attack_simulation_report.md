# Attack Simulation Report

Evidence class: `SYNTHETIC`

All 20 named adversarial scenarios executed as deterministic local tests. Scenarios 1–17 and 20 reached their required synthetic denial or idempotent positive-control result. Scenario 18 proved binding-mismatch and cookie-ambiguity denial, but pre-auth subscriber-session rotation remains blocked by the unresolved subject-binding contract. Scenario 19 proved deletion-epoch enforcement and zero exposure of older records, but it remains blocked as a complete deletion scenario because backing-content deletion, backup re-deletion, and physical erasure of the append-only JSONL journal are not proven.

Central authorization tests cover valid same-scope positive controls and safe audit decisions. API tests separately prove safe capability, Origin, and CSRF audit events. Redaction and log-safety tests prove that the audit/client response surfaces contain no configured canary, raw capability, access code, cookie, direct subject/browser value, transcript content, or private payload.

No live traffic, production data, real credentials, Redis, provider/model/media call, Stripe operation, production migration, or external penetration target was used.

Terminal adversarial disposition: `PASS_WITH_SCENARIOS_18_AND_19_BLOCKED`.

Deployment, push, production activation, public access, Stripe activation,
production Redis, live providers/models/media, production migration, and
destructive production deletion are not authorized by this campaign result.
