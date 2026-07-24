# Trust Boundary Map

Evidence class: `STATIC`

1. Browser to internal endpoint: untrusted request metadata and submitted access code cross exact Origin and one-time CSRF checks.
2. Endpoint to identity binding: authority requires an injected authenticated subscriber subject and exact scope. The default resolver is intentionally unresolved and denies.
3. Endpoint to security state: only keyed token hashes, keyed dimensions, CSRF hashes, replay fingerprints, deletion epochs, and content-free audit records are stored.
4. Security policy to Coach Connect service: actor, session, resource, relationship, entitlement, use-time consent, request integrity, expected version, and deletion epoch are checked before the secured facade invokes a domain method.
5. Durable replay to current state: records older than the current scope deletion epoch are denied before exposure.
6. Coach Connect to Business Engine: subscriber-confirmed promotion remains the only canonical path; coach and developer capabilities have no canonical authority.
7. Local JSONL boundary: file mode is narrowed, but prior append-only bytes remain; only logical denial is claimed.
8. Deployment boundary: production Redis, live providers, production traffic, Stripe activation, public access, migration, and deployment remain outside this implementation.
