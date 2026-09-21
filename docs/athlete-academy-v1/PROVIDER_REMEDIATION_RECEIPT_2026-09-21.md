# Academy provider remediation receipt — 2026-09-21

## Failed Vercel Marketplace resource

- resource ID: `store_wTN9Oa1ORSKEyzYI`
- resource name: `more-athlete-academy-v1`
- Redis subscription: `3424798`
- Redis database: `14639588`
- plan: Redis Cloud `250 MB`, `$8/month`
- project connections at the last verified inventory: none (`projects: []`)
- application credentials retrieved: none
- application bindings or writes: none
- provider capability finding: assigned cluster `6878` reported `supports_ssl=false`; the connection surface exposed only `redis://`, so the resource was rejected for the youth-data TLS boundary.

The resource-specific command `vercel integration-resource remove store_wTN9Oa1ORSKEyzYI --format=json --yes` returned exit code `1` without a usable diagnostic. A same-route diagnostic retry was rejected by the automated safety reviewer because the governing instruction required stopping after rejection. No alternate deletion route was attempted.

The last read-only Vercel inventory still showed this exact resource as `available` with `projects: []`. Recurring billing termination is therefore not verified, and any final or prorated amount remains unknown pending provider receipt.

## Preserved resources and Production

The cleanup attempt did not uninstall the Redis integration or change any other resource. The inventory separately preserved:

- `store_b1dKNXZGhyjtPnTS` / `redis-citrine-cave`, attached only to project `moremindmap`;
- `store_51zzoIpFKtMjNMDT` / `moremindmap-incident-repair-v1-free`, no project attached;
- `store_LunlHkN0sXbAXxWN` / `moremindmap-subscription-canary-v1`, no project attached.

At verification time, `moremindmap.com` resolved to READY Production deployment `dpl_5iQyom4URa49Z8aa9YFaFoT252zw`. No alias, deployment, Production environment, customer state, or shared Redis binding was changed.

## Direct replacement boundary

Founder approved a separate direct Redis Cloud Essentials subscription up to `$6/month`. The verified draft is `1 GB` total / `512 MB` usable Redis Flex with single-zone replication and automatic failover, AOF every second, daily and instant backups, and encryption at rest. TLS must be explicitly enabled on the created database before any application binding. No credential value may enter evidence or source.
