# GoHighLevel Contact Sync V1

## Architecture and data flow

MORE MindMap remains authoritative. After a canonical write succeeds, a server-only, fail-open side effect is registered with Vercel `waitUntil`, resolves GHL contact fields and tags, and calls `POST /contacts/upsert` at `https://services.leadconnectorhq.com`. The browser never receives the private integration token. A bounded five-second default timeout covers the entire GHL operation.

```text
BOS/BA canonical persistence -> queued contact metadata sync -> GHL upsert
                            \-> unchanged customer success response
```

The reusable client is `api/integrations/gohighlevel/contactSync.js`. Its structured result reports attempted/success/skipped/reason/contact ID/assessment type/tags/retryability/HTTP status. The server-only completion wrapper imports `waitUntil` from `@vercel/functions`, registers exactly one sanitized promise per completion, and catches unexpected failures so GHL cannot fail assessment completion. Registration is synchronous; GHL network completion is not awaited by BOS or BA.

## Exact data contract

The upsert body can contain only `locationId`, `firstName`, `lastName`, `email`, `phone`, `tags`, and `customFields`. Custom-field values are limited to Profile ID, assessment type, completion status, completion timestamp, subscription status, and an already-available source/campaign. Empty values are omitted; values are never invented. Profile ID plus a valid email or phone is required.

Forbidden data includes BOS scores, dimensions, narratives, BA answers, raw responses, financial data, Five Futures, One Move, confidence, evidence, behavioral data, and all proprietary intelligence.

## Configuration and scopes

These server-side production environment variables are recorded as configured in Vercel as of the mission addendum. Their values were not retrieved or inspected:

- `GHL_CONTACT_SYNC_ENABLED=true` (the integration remains opt-in everywhere)
- `GHL_PRIVATE_INTEGRATION_TOKEN` (required; never use a browser-prefixed variable)
- `GHL_LOCATION_ID` (required sub-account/location)

Missing configuration in production, preview, or local environments still disables or skips synchronization safely. All environment reads remain in the server-only `api/integrations/gohighlevel/contactSync.js` module.

The Private Integration needs contact write/upsert scope plus location custom-field read/write and location tag read/write scopes. In GHL scope naming, enable the scopes corresponding to Contacts Write, Locations Custom Fields Read/Write, and Locations Tags Read/Write for the target location. Confirm exact labels in the current GHL Private Integration UI before production activation.

## Custom fields

The resolver fetches `GET /locations/:locationId/customFields`, compares normalized field names case-insensitively, and creates only missing contact fields with `POST /locations/:locationId/customFields`. Resolutions are cached per location in the warm serverless invocation. Fields are:

- MORE Profile ID (mandatory)
- MORE Assessment Type
- MORE Assessment Status
- MORE Assessment Completed At
- MORE Subscription Status
- MORE Source

All are TEXT fields for predictable API representation. Existing stable IDs are used in `customFields: [{ id, field_value }]`. If the Profile ID field cannot be resolved, upsert is skipped; other unavailable optional metadata degrades gracefully.

## Tags and duplicate behavior

Tags are centralized in the exported `GHL_TAG_CONFIG` object in the server integration module, so tag names can change without modifying sync logic. They are fetched with `GET /locations/:locationId/tags`, normalized for whitespace/case, created only when absent through `POST /locations/:locationId/tags`, and cached per location. Every event has `MMM`; BOS adds `BOS Completed`, BA adds `BA Completed`, and the future subscription event adds `Subscription Active`. Existing GHL tags are not removed or replaced.

`POST /contacts/upsert` delegates matching to the sub-account duplicate-contact configuration. Email/phone collision behavior therefore depends on that setting. Review it before launch; the integration does not intentionally create duplicates and retries remain idempotent through upsert.

## Hooks

- BOS: `api/engine/canonical/executeCanonicalGeneration.js`, inside `if (vault_result?.success)`, immediately after verified vault persistence.
- BA: `api/business-assessment/start.js`, after the assessment, owner-profile index, job, and date/type indexes have been persisted.
- Future subscription: call `buildSubscriptionActiveContactEvent()` and queue the reusable sync only after `saveAccessGrant()` / active subscription persistence in `api/stripe/webhook.js`. This mission intentionally does not alter Stripe runtime.

## Failure and observability policy

Missing/disabled configuration skips. Invalid contact data skips. HTTP 401/403 is non-retryable configuration failure; 429 and 5xx are retryable; network and timeout failures are retryable. There is no retry loop. Assessment responses remain successful. Structured logs contain event type, Profile ID, assessment type, attempted/success state, reason, HTTP status, and retryability—never authorization headers, the token, raw assessment payloads, or proprietary intelligence.

Vercel `waitUntil` extends the request lifetime for the registered bounded promise without delaying the response. If background registration is unavailable, the helper logs only sanitized event metadata, skips dispatch, and leaves assessment completion successful. No durable queue or retry service is used.

## Local test and production checklist

Run `node --test test/gohighlevel-contact-sync.test.js`, `npm run build`, and `git diff --check`. Tests use mocked transport and never contact GHL.

Before production deployment: review the implementation and package diff, confirm Private Integration scopes and duplicate-contact settings, then deploy and run one operator-approved named test contact. Verify sanitized logs, fields, and tags, then monitor 401/403/429/5xx outcomes. Production environment configuration is already complete.

To roll back, set `GHL_CONTACT_SYNC_ENABLED=false` (or remove it) and redeploy. Code removal is unnecessary for an emergency disable. No GHL data is read back into MORE MindMap.
