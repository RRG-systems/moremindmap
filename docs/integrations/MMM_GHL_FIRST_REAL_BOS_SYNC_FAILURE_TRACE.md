# First Real BOS GoHighLevel Sync Failure Trace

Mission: `MMM_GHL_FIRST_REAL_BOS_SYNC_FAILURE_TRACE`

Final verdict: `MMM_GHL_FIRST_REAL_BOS_SYNC_FAILURE_ROOT_CAUSE_CONFIRMED`

## Root cause

The BOS hook ran and its Vercel background task called GoHighLevel, but tag resolution received HTTP 403 before the code could build or send `POST /contacts/upsert`. The root-cause class is **H — Tag resolution prevented upsert**. The production token/location combination lacked authorization for the first network operation, `GET /locations/:locationId/tags`, at the time of the event.

This was not a missing-hook, missing-`waitUntil`, missing-phone, static-field-format, upsert, or Vercel-termination failure. No contact upsert request was made, so GHL never evaluated the contact payload or the six configured custom-field references.

## Production event evidence

- Investigation window: `2026-07-16T19:40:00Z` through `2026-07-16T20:00:00Z`.
- At `2026-07-16T19:46:10.159Z`, production logs for `GET /api/moremindmap/status` show Redis connection and the canonical pipeline.
- The same request log shows a successful vault write, existence check, readback, byte-for-byte verification, and Redis disconnect for profile `mm-20260716-edrd7skn`.
- At `2026-07-16T19:46:17.485Z`, the same request logged `ghl_contact_sync` with event `bos_completed`, assessment `BOS`, `attempted: true`, `success: false`, reason `authorization_failed`, HTTP 403, and `retryable: false`.
- It then logged `ghl_contact_sync_side_effect_failed` with the same sanitized classification.
- The request itself returned HTTP 200. The background outcome was recorded about 7.3 seconds after the first request log, establishing that Vercel did not terminate the registered task before its result was logged.

No secret-bearing headers are included here. One unrelated existing production log statement emits a Redis connection URL; it was excluded from this report and should be handled as a separate security/observability issue.

## Exact completion path and ordering

The creating request was `GET /api/moremindmap/status`. That handler loads and locks the job and calls `executeNextStage`. For the `canonical_generation` stage, `api/engine/miniV2StagedExecutor.js` imports and calls `executeCanonicalGeneration`.

`api/engine/canonical/executeCanonicalGeneration.js` performs the relevant operations in this order:

1. Generate the profile ID and canonical dossier.
2. Persist the canonical dossier to the job with `updateJob`.
3. Save and verify the canonical dossier in the vault.
4. Only when `vault_result.success` is true, call `queueBosCompletedContactSync` once.
5. The hook registers exactly one promise with `@vercel/functions` `waitUntil`.

The production GHL result can only occur when registration succeeded: the hook deliberately does not call `syncContactToGoHighLevel` when `waitUntil` throws. Thus `wait_until_registered` is confirmed true for this request.

There is one active BOS hook call in the canonical implementation. Backup/fallback source files exist but are not imported by the staged executor. BA has a separate route and hook. No evidence shows a second active BOS completion path that bypassed GHL for this profile.

## Runtime configuration

The Vercel Production environment lists all nine GHL variable names, including `GHL_CONTACT_SYNC_ENABLED`, the private token, location ID, and all six static field references. Values were not printed.

Runtime behavior further proves that:

- the enable flag evaluated to `true`;
- the token and location ID were nonempty;
- all five required static references were nonempty.

Otherwise the client would have returned a pre-network skip rather than HTTP 403. The optional subscription-status field is also listed in Production. Therefore configuration presence is confirmed, while authorization capability is the failure.

## Request-stage trace

The client checks configuration, profile ID, and whether either a valid email or valid phone exists. Julia's valid email satisfied the identity requirement. Missing phone is normalized away and is not fatal.

After validation, the client calls `resolveTags` before constructing the upsert payload. `resolveTags` first issues:

- Method: `GET`
- Endpoint: `/locations/:locationId/tags`
- Observed status: `403`
- Sanitized category: `authorization_failed`
- Sanitized response body: unavailable; the client intentionally records only the status/classification and does not log the response body.

Because that call threw, execution entered the catch block before the `customFields` array and contact payload were constructed. Consequences:

- tag lookup failed before tag creation or contact upsert;
- tag creation was not reached;
- `POST /contacts/upsert` was not attempted and has no HTTP response;
- no actual payload contained first name, last name, email, phone, location ID, tags, or custom fields;
- the source builder would have supplied first name, last name, valid email, omitted empty phone, location ID, `MMM` and `BOS Completed` tags, and five BOS custom fields, but this payload was never constructed or transmitted;
- the subscription-status field would be absent because BOS did not supply a subscription status;
- the six static field keys were neither accepted nor rejected by GHL in this event;
- no field-mapping conclusion can be drawn from this event.

The deployed client performs no custom-field schema GET. Static references beginning with `contact.` are serialized as `{ key, field_value }`; other references are serialized as `{ id, field_value }`. Focused tests cover both shapes, but this production event did not reach upsert, so tests cannot establish GHL acceptance of the configured production keys.

## Deployment verification

The production alias `moremindmap.com` served deployment `dpl_KACLVDGcVy7cxWtZrV4bJExxtU5Z`, created at `2026-07-16T19:18:17.171Z`, status READY. Vercel metadata identifies commit `b4f54aad04631d5f25fdb6d86889095704b26033` (`fix use configured GHL custom field references`). Local `HEAD`, `origin/main`, and the deployment commit all match that SHA.

Vercel marks the CLI deployment `gitDirty: 1`, so the metadata alone cannot prove byte identity for every deployed file. However, the production outcome is consistent with the `b4f54aa` static-field implementation: it passed configuration validation and reached tag resolution. The alias was not serving the earlier schema-lookup implementation.

Focused test result: 20 passed, 0 failed for `test/gohighlevel-contact-sync.test.js`.

## Read-only contact check

A direct, non-writing contact search was attempted with the currently configured server-side production credential:

- Method: `GET`
- Endpoint: `/contacts/`
- Result: HTTP 401 (`read_request_failed`)
- Writes performed: none

This is separate from the event-time tag-read HTTP 403. Current readback cannot establish whether the contact exists, is duplicated, or is merely absent from the UI. Because the event never reached upsert, no contact was created by this request, but an independently existing record cannot be ruled out while read access fails.

## Smallest repair scope (not performed)

Restore authorization for the existing GHL Private Integration so the configured credential can read location tags (and create them only if missing), while retaining contact write permission. Given the current readback now returns 401, the likely smallest operational repair is to regenerate/rotate the existing Private Integration token after confirming the necessary tag and contact scopes, update only `GHL_PRIVATE_INTEGRATION_TOKEN` in Vercel Production, and redeploy so functions receive the new value.

No application-code change is established as necessary. If authorization cannot include tag read/create, the smallest code alternative would be confined to:

- `api/integrations/gohighlevel/contactSync.js`
- `test/gohighlevel-contact-sync.test.js`
- `docs/integrations/GOHIGHLEVEL_CONTACT_SYNC_V1.md`

That alternative would change tag handling so it cannot block upsert, but it is not justified until GHL permissions are resolved. A new deployment is necessary if the Vercel token value changes or code changes; a GHL-side permission activation that preserves a usable token may not require deployment.

## Observability limits

Production logging identifies the overall sync status but not the failing sub-operation. The conclusion that the 403 occurred during tag lookup is exact by control flow: tag lookup is the first and only possible GHL request before payload construction/upsert. Missing observability includes per-operation endpoint labels, sanitized GHL response bodies/error codes, explicit `waitUntil` registration success, and explicit upsert-start markers. No logging was added in this trace mission.

## Authorized repair continuation

Mission `MMM_GHL_TAG_LOOKUP_BYPASS_AND_REAL_BOS_REPAIR` changes only the GHL critical path. Location tag discovery and creation are removed. The client now performs contact upsert first, requires the returned contact ID, and then uses the additive contact-tag endpoint. Upsert and tag outcomes are reported independently, and tag failure produces successful partial completion rather than erasing a successful contact write.

The focused suite proves no `/locations/:locationId/tags` request occurs, upsert precedes tag application, exactly one upsert and one tag attempt occur on success, missing phone remains allowed with valid email, static fields remain present, and proprietary assessment intelligence remains excluded. Production deployment and the single authorized retry are recorded below once complete.
