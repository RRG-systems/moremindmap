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

The resource-specific command `vercel integration-resource remove store_wTN9Oa1ORSKEyzYI --format=json --yes` initially returned exit code `1` without a usable diagnostic. A same-route diagnostic retry was rejected by the automated safety reviewer because the then-governing instruction required stopping after rejection.

After the Founder gave fresh, informed approval for exactly one additional resource-specific attempt, `vercel integration-resource remove store_wTN9Oa1ORSKEyzYI --format=json --yes --no-color` returned `No resource store_wTN9Oa1ORSKEyzYI found.` An immediate account-wide, read-only inventory nevertheless continued to show the same exact ID, name, product, `available` status, and `projects: []`. The authorized project-scoped removal path therefore cannot resolve an account-visible unbound resource. No alternate deletion route was attempted.

Recurring billing termination is not verified, and any final or prorated amount remains unknown pending a provider-side removal receipt. The unresolved control-plane contradiction requires Vercel/Redis Marketplace support or a Founder-performed account-console action; it must not be represented as deleted merely because the removal command could not resolve it.

## Preserved resources and Production

The cleanup attempt did not uninstall the Redis integration or change any other resource. The inventory separately preserved:

- `store_b1dKNXZGhyjtPnTS` / `redis-citrine-cave`, attached only to project `moremindmap`;
- `store_51zzoIpFKtMjNMDT` / `moremindmap-incident-repair-v1-free`, no project attached;
- `store_LunlHkN0sXbAXxWN` / `moremindmap-subscription-canary-v1`, no project attached.

At verification time, `moremindmap.com` resolved to READY Production deployment `dpl_5iQyom4URa49Z8aa9YFaFoT252zw`. No alias, deployment, Production environment, customer state, or shared Redis binding was changed.

## Direct replacement receipt

Founder approved and purchased a separate direct Redis Cloud Essentials Flex subscription at `$6/month` plus applicable tax. The exact replacement custody is:

- database name: `more-athlete-academy-v1-direct`;
- Redis subscription: `3424877`;
- Redis database: `14639749`;
- region: AWS `us-east-1`;
- Redis `8.6`, RESP3;
- `1 GB` total: `512 MB` dataset plus `512 MB` replica;
- `200 ops/sec`, `50 GB/month` network, and `1,024` connections;
- single-zone replication with automatic failover;
- append-only persistence every second;
- `no eviction` policy;
- transport-layer security explicitly enabled after creation;
- last sanitized console verification: zero application connections and zero application keys.

No connection endpoint, password, or other credential value entered evidence or source.

## Remote-backup capability versus configured state

The paid plan includes the **capability** for automatic backups every 24 hours and an on-demand `Backup now` action. That capability is not the same as a configured backup. At the read-only console check on `2026-09-21T23:47:33Z`, the database showed:

- `Remote backup: Off`;
- `This database has not been backed up`;
- interval, once enabled: every 24 hours;
- `Backup now`: disabled until remote backup is configured;
- required configuration: select a supported storage type and provide its backup-destination URI.

The available supported destination classes are AWS S3, Google Cloud Storage, Azure Blob Storage, and FTP/FTPS. The direct account does not offer a Redis-managed repository. A names-and-scopes-only project/provider check found no existing AWS S3, Google Cloud Storage, Azure Blob Storage, or FTP destination or approved secure binding. The only storage-related project variable was the existing Vercel Blob binding; Vercel Blob is not one of the supported Redis Cloud remote-backup destination types and must not be repurposed as if it were an S3 bucket.

### Small-pilot recommendation

Use a dedicated, private AWS S3 Standard bucket in `us-east-1`, reserved for this Redis Cloud account and database. Redis Cloud requires the bucket policy to grant its documented AWS principal `arn:aws:iam::168085023892:root` the three object-level actions `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on `arn:aws:s3:::<bucket-name>/*`. Enter only `s3://<bucket-name>` in the Redis Cloud `Backup destination` field. If customer-managed SSE-KMS is selected, the KMS key policy also needs the Redis-documented encrypt/decrypt/re-encrypt/data-key/describe permissions; ordinary S3-managed encryption avoids that additional key-policy step.

AWS S3 has no minimum storage charge. At the published `us-east-1` S3 Standard rate of about `$0.023/GB-month`, this pilot's storage portion should remain pennies per month; request and any transfer charges remain usage-based. The bucket-account creation/login, payment setup if a new AWS account is required, and permission-policy confirmation require the Founder's authenticated AWS console session. Bucket names and URIs are nonsecret metadata, but no access keys, credentials, or secret-bearing URIs may be sent through chat.

Application binding and hosted acceptance remain paused until a destination is selected, remote backup is enabled, an on-demand backup succeeds, and the resulting backup state is verified. This gate does not justify a larger Redis plan or admitting real participants.
