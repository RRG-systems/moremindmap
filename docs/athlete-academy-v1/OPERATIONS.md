# Activation and operations

## Before any promotion

Home Base owns integration. Re-resolve its current source and deployment; do not promote a stale specialist snapshot. Preserve the five DarrenDemo products and all existing aliases. Candidate base was14b9f217587e7dd22d14b349e49a83a8843962a4, not an assertion about the next live HEAD.

Build both the main application and the existing private Darren library using the repository build command. The new workspace pages are four separate Vite entrypoints. The existing library remains server-routed and protected. Static bundles contain no new participant reports. The main `/athlete` switch is build-time `VITE_ATHLETE_ACADEMY_V1_ENABLED=true`; without it the original public site remains.

## Server bindings

| Name | Purpose |
|---|---|
| ATHLETE_ACADEMY_ENABLED=1 | Activate private Academy API |
| ATHLETE_ACADEMY_ORIGIN | Exact HTTPS site origin; no path |
| ATHLETE_ACADEMY_REDIS_URL | Dedicated or explicitly approved Redis binding using TLS |
| ATHLETE_ACADEMY_NAMESPACE | Omit for canonical namespace; never use the local test namespace in real enrollment |
| ATHLETE_ACADEMY_BEYOND_TODAY_CODE_SHA256 | SHA256 of the Founder-approved institute enrollment code |
| ATHLETE_ACADEMY_PROVIDER_ENABLED=1 | Permit explicitly requested generation/coaching |
| OPENAI_API_KEY | Existing approved server-side BOS connection |
| ATHLETE_ACADEMY_MAIL_ENABLED=1 | Permit transactional verification/recovery/guardian delivery |
| RESEND_API_KEY | Approved transactional provider binding |
| ATHLETE_ACADEMY_MAIL_FROM | Verified institute/product sender |
| ATHLETE_ACADEMY_REVIEWED_POLICY_VERSION | Version of the participation material approved for this cohort |
| ATHLETE_ACADEMY_REAL_YOUTH_ENABLED=1 | Activate actual17-year-old participation after its setup is accepted |
| ATHLETE_ACADEMY_WORKER_ENABLED=1 | Permit the assessment continuation worker |
| ATHLETE_ACADEMY_WORKER_SECRET or CRON_SECRET | Server scheduler authentication, at least32 characters |

Never copy secrets into client variables, logs, screenshots, handoffs, source files or generated artifacts. No production value is supplied in this candidate. The local key broker is excluded from the hosted application and is only the previously approved test connection method.

A real deployment must leave `ATHLETE_ACADEMY_LOCAL_PREVIEW` and `ATHLETE_ACADEMY_SYNTHETIC_PREVIEW` unset. Local review deliberately rejects email addresses outside `@test.invalid` and captures mail privately instead of sending it.

## Background continuation

Arrange independent authenticated scheduler invocations of `/api/athlete/academy-worker` and `/api/athlete/academy-mail-worker` once per minute using the Bearer secret. These are hosting configuration steps; no production schedules have been installed. They must be separate invocations, never sequential work inside the same function.

The assessment function continues at most one ready stage. It has an800-second host budget around a720-second provider timeout. The mail function drains at most20 pending records with20-second delivery timeouts and its own480-second budget. Pausing mail or a slow recipient cannot consume assessment time. Overlapping invocations use the same durable claims; neither repeats an uncertain send/stage. A suspended participant is skipped with a durable reason, and an invalid completed-stage job is closed without starving other people. A saved terminal result may be reconciled; an ambiguous call is never repeated. Set monitoring for non-2xx worker results, prolonged unknown jobs, storage faults and failed mail.

Without a scheduler, the browser advances the same saved stages while its progress page is open and resumes on return. This fallback is not a claim that unattended hosted continuation has been verified.

## Mail and support

Verification lasts24h; password reset lasts1h; guardian invitation lasts24h. Public requests acknowledge durable enqueue without waiting for matching-address delivery. The API registers delivery with Vercel waitUntil; the worker continues still-pending outbox work after interruption. Unknown/rejected sends are never automatically repeated. Mail records retain delivery state and receipt; sent bearer tokens are cleared from outbox records. Lost verification and reset messages can be requested again by their recipient without exposing whether an account exists. A guardian invitation can be sent again from the participant account, within rate limits.

For an unknown provider or storage outcome, inspect that exact job/attempt and its immutable evidence before changing anything. The product provides saved-result recovery and explicit abandonment. Never repair by deleting the account, allocating another MM, rewriting the original report, clearing a pending claim, or replaying an uncertain provider call.

Production support procedures must use scoped operator access and must not print private payloads into shared logs. No public administrative impersonation route is included.

## Hosted acceptance after separate approval

1. Verify a clean signed candidate and current Home Base integration, aliases and rollback.
2. Confirm disabled flags expose no reports or enrollment before activation.
3. Configure approved TLS Redis persistence, backups and a restore drill. The local AOF crash test is not cloud durability proof.
4. Verify actual delivery of confirmation, recovery and guardian messages using approved test inboxes. Confirm sender and origin.
5. Run two separately identified synthetic accounts through the exact hosted system, one17 with separate guardian and one adult. Keep real participant data out of these tests.
6. Verify own-MM continuity through BOS, APA and coaching; sign-out/return; source isolation; full readers; plan approval and confirmed learning; mobile layout; scheduler completion with browser closed; and recovery without duplicate requests.
7. Test ordinary expired links, revoked sessions, wrong account/MM, missing youth permission, withdrawal, concurrent edits and an unacknowledged stage.
8. Preserve the first outputs and failures. Structural tests and editorial judgments are not psychometric validation or real youth comprehension evidence.
9. Obtain Founder acceptance before inviting Darren, Lisa, Bryant or their children to the activated pilot.

## Rollback

Disable API, worker and frontend activation (frontend needs rebuild), or restore the prior accepted deployment through Home Base. Stop scheduled dispatch before rollback. Keep the Redis namespace and immutable records intact. Never delete dossiers to roll back a UI. A versioned saved report stays tied to its original engine and question bank. Resume only after checking current consent, account, input and source pointers.

## Remaining operational decisions

Hosted bindings and scheduler are not installed; real transactional delivery has not been exercised. Participation material needs its accepted version before real youth activation. Institute staffing/roster/sharing and privacy export/deletion/support administration are outside this participant pilot and must not be represented as shipped features. Product records are currently retained without an automatic destructive retention job; choose the production retention/support process before admitting paying customers. Billing remains direct institute billing outside the product as the Founder requested.
