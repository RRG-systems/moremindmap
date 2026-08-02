# Access, Cost, Concurrency, and Latency Report

## Controls

| Control | Bound |
| --- | --- |
| packet size | 180,000 characters |
| model output | 240,000 characters |
| model timeout | 60 seconds |
| model retries | zero |
| per-instance model concurrency | four |
| per profile/client rate | 30 requests per 60 seconds |
| distributed lock | 70 seconds |
| duplicate waiter | 2 seconds, then Layer 2 |

The Redis lock uses the complete semantic cache identity. Simultaneous identical retrievals generate at most one model call; followers consume the durable result or remain on Layer 2.

The timeout and lock bounds were calibrated after the entitled `gpt-5.6-sol` provider completed a full 17-surface structured response in 38.1 seconds. The customer continues to see exact Layer 2 while the asynchronous translation is pending.

Rate-limit keys contain only a bounded SHA-256 subject hash. The server verifies the supplied packet by rebuilding it from the requested existing profile. Malformed packets, unknown profiles, mismatched packets, arbitrary free text, and over-limit callers fail closed.

Receipts record source, semantic hash, model, latency, input/output/total token usage when supplied by the provider, and cache identity. Dollar cost is explicitly `null` with `cost_basis: not_configured`; the implementation does not invent a price estimate.
