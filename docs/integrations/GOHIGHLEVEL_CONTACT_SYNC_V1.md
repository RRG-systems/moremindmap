# GoHighLevel Contact Sync V1

## Architecture and data flow

MORE MindMap remains authoritative. After a canonical write succeeds, a server-only, fail-open side effect is registered with Vercel `waitUntil`, reads configured GHL custom-field references, resolves tags, and calls `POST /contacts/upsert` at `https://services.leadconnectorhq.com`. The browser never receives the private integration token or field references. A bounded five-second default timeout covers the entire GHL operation.

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
- `GHL_FIELD_MORE_PROFILE_ID` (required field ID or stable key)
- `GHL_FIELD_MORE_ASSESSMENT_TYPE` (required field ID or stable key)
- `GHL_FIELD_MORE_ASSESSMENT_STATUS` (required field ID or stable key)
- `GHL_FIELD_MORE_ASSESSMENT_COMPLETED_AT` (required field ID or stable key)
- `GHL_FIELD_MORE_SUBSCRIPTION_STATUS` (optional until subscription activation is wired)
- `GHL_FIELD_MORE_SOURCE` (required field ID or stable key)

Missing configuration in production, preview, or local environments still disables or skips synchronization safely. All environment reads remain in the server-only `api/integrations/gohighlevel/contactSync.js` module.

The runtime Private Integration needs contact write/upsert scope plus location tag read/write scopes. Normal sync no longer reads or creates custom-field schemas. Custom fields must be created and mapped manually before enabling full metadata sync.

## Custom fields

Normal contact sync never calls `GET` or `POST /locations/:locationId/customFields`. It maps the six server-only configured field IDs directly into `customFields` using exactly `{ id, fieldValue }`. Stable `contact.*` keys are not sent in the upsert payload. Fields are:

- MORE Profile ID (mandatory)
- MORE Assessment Type
- MORE Assessment Status
- MORE Assessment Completed At
- MORE Subscription Status
- MORE Source

The Profile ID, assessment type, assessment status, completion timestamp, and source references are required. If any required reference is missing, sync returns a structured `configuration_missing` skipped result without making a GHL request or affecting BOS/BA completion. Subscription status is optional until its runtime hook exists and is omitted when unconfigured.

## Manual Custom Field Configuration

In the target HighLevel sub-account, open **Settings → Custom Fields**, select the **Contact** object, and create these fields exactly:

1. **MORE Profile ID** — Type: **Single Line Text**
2. **MORE Assessment Type** — Type: **Single Line Text**
3. **MORE Assessment Status** — Type: **Single Line Text**
4. **MORE Assessment Completed At** — Type: **Date/Time** if HighLevel supports ISO-8601 UTC cleanly for the field; otherwise **Single Line Text** storing ISO-8601 UTC
5. **MORE Subscription Status** — Type: **Single Line Text**
6. **MORE Source** — Type: **Single Line Text**

For each field, open its HighLevel field details and copy either the immutable field ID or the displayed stable Contact field key. A stable key normally uses HighLevel's Contact-key form (for example, a value beginning with `contact.`); copy the actual value displayed by HighLevel. Do not derive, guess, rename, or paste example values. If the UI does not expose a value, use HighLevel's authenticated API tooling or support guidance to obtain the field ID for that sub-account.

Add the copied values to the existing Vercel project as server-side **Production** environment variables with this exact mapping:

| HighLevel contact field | Vercel production variable | Required |
|---|---|---|
| MORE Profile ID | `GHL_FIELD_MORE_PROFILE_ID` | Yes |
| MORE Assessment Type | `GHL_FIELD_MORE_ASSESSMENT_TYPE` | Yes |
| MORE Assessment Status | `GHL_FIELD_MORE_ASSESSMENT_STATUS` | Yes |
| MORE Assessment Completed At | `GHL_FIELD_MORE_ASSESSMENT_COMPLETED_AT` | Yes |
| MORE Subscription Status | `GHL_FIELD_MORE_SUBSCRIPTION_STATUS` | No, until subscription activation is wired |
| MORE Source | `GHL_FIELD_MORE_SOURCE` | Yes |

Set values only in Vercel server-side environment configuration; never prefix them with `VITE_` or expose them to browser code. After all five required references are saved, redeploy Production so serverless functions receive them. Keep `GHL_CONTACT_SYNC_ENABLED=false` until configuration is complete if an immediate fail-closed rollout is preferred.

## Tags and duplicate behavior

Tags are centralized in the exported `GHL_TAG_CONFIG` object in the server integration module, so tag names can change without modifying sync logic. The critical path does not read, discover, or create location tag definitions. It first calls `POST /contacts/upsert`, extracts the returned contact ID, and then makes one additive `POST /contacts/:contactId/tags` call. Every event adds `MMM`; BOS adds `BOS Completed`, BA adds `BA Completed`, and the future subscription event adds `Subscription Active`. The additive contact-tag endpoint does not remove or replace existing GHL tags.

`POST /contacts/upsert` delegates matching to the sub-account duplicate-contact configuration. Email/phone collision behavior therefore depends on that setting. Review it before launch; the integration does not intentionally create duplicates and retries remain idempotent through upsert.

## Hooks

- BOS: `api/engine/canonical/executeCanonicalGeneration.js`, inside `if (vault_result?.success)`, immediately after verified vault persistence.
- BA: `api/business-assessment/start.js`, after the assessment, owner-profile index, job, and date/type indexes have been persisted.
- Future subscription: call `buildSubscriptionActiveContactEvent()` and queue the reusable sync only after `saveAccessGrant()` / active subscription persistence in `api/stripe/webhook.js`. This mission intentionally does not alter Stripe runtime.

## Failure and observability policy

Missing/disabled configuration skips. Invalid contact data skips. HTTP 401/403 is non-retryable configuration failure; 429 and 5xx are retryable; network and timeout failures are retryable. There is no retry loop. Upsert failure prevents tag application. A successful upsert followed by tag failure returns `success: true`, `partialSuccess: true`, `contactUpsert: contact_upsert_success`, and `tagApplication: tag_application_failure`; it never invalidates assessment completion or the successful contact write. Structured logs distinguish both operations and contain only event type, Profile ID, assessment type, state, sanitized reason/category, HTTP status, and retryability—never authorization headers, the token, raw assessment payloads, or proprietary intelligence.

Vercel `waitUntil` extends the request lifetime for the registered bounded promise without delaying the response. If background registration is unavailable, the helper logs only sanitized event metadata, skips dispatch, and leaves assessment completion successful. No durable queue or retry service is used.

## Local test and production checklist

Run `node --test test/gohighlevel-contact-sync.test.js`, `npm run build`, and `git diff --check`. Tests use mocked transport and never contact GHL.

Before production deployment: review the implementation and package diff, confirm Private Integration scopes and duplicate-contact settings, then deploy and run one operator-approved named test contact. Verify sanitized logs, fields, and tags, then monitor 401/403/429/5xx outcomes. The base token/location configuration is complete; the static field-reference variables remain pending after the fallback deployment.

To roll back, set `GHL_CONTACT_SYNC_ENABLED=false` (or remove it) and redeploy. Code removal is unnecessary for an emergency disable. No GHL data is read back into MORE MindMap.

## Production deployment evidence (2026-07-16)

Commit `939d17a` (`feat add GoHighLevel contact sync`) was pushed to `main` and deployed successfully to the existing `moremindmap` Vercel production project. Deployment `dpl_4S9AVLt5RXwWb5mmwJqM5f13bmmS` reached `READY` and was aliased to `https://moremindmap.com`. Production smoke checks returned HTTP 200 for the application shell and current hashed JavaScript asset; the serverless status route returned its expected HTTP 400 validation response when called without a job ID.

Exactly one controlled synthetic BOS job was submitted through the production application. Job `026e4d30-2f69-4ce9-ad41-571f8affba71` completed successfully and produced Profile ID `mm-20260716-iipuev93`. Its contact source was `Production Integration Test`. No second submission or direct upsert was made.

Contact readback was attempted inside the Vercel production environment so neither the GHL token nor location ID would be retrieved or exposed. GHL returned HTTP 403 for contact readback. The temporary authenticated verification route and its one-time environment key were removed immediately afterward. Because readback permission was unavailable, this run cannot independently assert contact count, field values, tags, or absence of duplicates. The code-level allowlist and passing tests establish that the integration payload can contain only contact identity, approved MORE metadata fields, and tags; no proprietary assessment intelligence is included, but the production contact itself could not be inspected.

Required follow-up: grant `contacts.readonly` to the existing Private Integration (without changing the token value), redeploy if GHL requires it, and perform readback for the existing test email/Profile ID. Do not submit or upsert another test contact.

### Permission-save readback retry

After the operator explicitly saved the existing `contacts.readonly` and `contacts.write` permissions, a second narrowly scoped production readback was attempted against the same controlled contact. No create or upsert request was made. GHL again returned HTTP 403, this time on the location custom-field read request before contact search occurred. The temporary verifier and its one-time environment key were removed without making another GHL request.

The current Private Integration token likely needs to be regenerated after the saved permission update. Regenerate or rotate the token in GHL, update only the existing server-side Vercel token value, and then repeat readback against Profile ID `mm-20260716-iipuev93`. Do not create or upsert another contact.

### V3 schema result and static-field fallback

The final schema-only retry used the official `Version: v3` header for `GET /locations/:locationId/customFields` and still returned HTTP 403. No contact lookup or write followed that failure. The production sync was therefore changed to the static server-side field-reference strategy documented above. End-to-end metadata delivery remains unproven until the required Vercel field variables are configured; do not create another controlled contact for this setup step.
