# Activation and operations

## Before any promotion

Home Base owns integration. Re-resolve its current source and deployment; do not promote a stale specialist snapshot. Preserve the five DarrenDemo products and all existing aliases. Candidate base was14b9f217587e7dd22d14b349e49a83a8843962a4, not an assertion about the next live HEAD.

Build both the main application and the existing private Darren library using the repository build command. The new workspace pages are four separate Vite entrypoints. The existing library remains server-routed and protected. Static bundles contain no new participant reports. The main `/athlete` switch is build-time `VITE_ATHLETE_ACADEMY_V1_ENABLED=true`; without it the original public site remains.

## Server bindings

| Name | Purpose |
|---|---|
| ATHLETE_ACADEMY_ENABLED=1 | Activate private Academy API |
| ATHLETE_ACADEMY_ORIGIN | Exact HTTPS site origin; no path |
| ATHLETE_ACADEMY_ALLOWED_ORIGINS | Optional comma-separated exact HTTPS aliases; never use wildcards |
| ATHLETE_ACADEMY_REDIS_URL | Dedicated or explicitly approved Redis binding using TLS |
| ATHLETE_ACADEMY_REDIS_CA_PEM | Redis Cloud public CA bundle used to authenticate the TLS server; required with `rediss://` |
| ATHLETE_ACADEMY_NAMESPACE | Omit for canonical namespace; never use the local test namespace in real enrollment |
| ATHLETE_ACADEMY_BEYOND_TODAY_CODE_SHA256 | SHA256 of the Founder-approved institute enrollment code |
| ATHLETE_ACADEMY_PROVIDER_ENABLED=1 | Permit explicitly requested generation/coaching |
| OPENAI_API_KEY | Existing approved server-side BOS connection |
| ATHLETE_ACADEMY_MAIL_ENABLED=1 | Permit transactional verification/recovery/guardian delivery |
| RESEND_API_KEY | Approved transactional provider binding; the existing server-only profile-ownership binding is accepted without copying its value |
| ATHLETE_ACADEMY_MAIL_FROM | Verified institute/product sender; the existing profile-ownership sender binding is accepted when this variable is absent |
| ATHLETE_ACADEMY_REVIEWED_POLICY_VERSION | Version of the participation material approved for this cohort |
| ATHLETE_ACADEMY_REAL_YOUTH_ENABLED=1 | Activate the preserved 17+ guardian design only after the separate youth setup is accepted; leave unset for the 18+ pilot |
| ATHLETE_ACADEMY_WORKER_ENABLED=1 | Permit the assessment continuation worker |
| CRON_SECRET | Native Vercel scheduler authentication, at least 32 characters; required for deployment readiness |
| ATHLETE_ACADEMY_WORKER_SECRET | Optional non-Vercel fallback only when `CRON_SECRET` is absent; it does not satisfy native Vercel readiness |

Never copy secrets into client variables, logs, screenshots, handoffs, source files or generated artifacts. No production value is supplied in this candidate. The local key broker is excluded from the hosted application and is only the previously approved test connection method.

A real deployment must leave `ATHLETE_ACADEMY_LOCAL_PREVIEW` and `ATHLETE_ACADEMY_SYNTHETIC_PREVIEW` unset. Local review deliberately rejects email addresses outside `@test.invalid` and captures mail privately instead of sending it.

With `ATHLETE_ACADEMY_REAL_YOUTH_ENABLED` unset, the server and rendered enrollment surface require age18 or older, including synthetic accounts. An existing under-18 owner may still sign in and read their dossier and completed BOS/APA, and an existing owner or guardian may pause participation. Explicit abandonment remains available for an already-uncertain job so the account is not trapped. The adult-only lock refuses new youth enrollment or assent, guardian invite/preview/accept, intake changes, assessment dispatch/continuation/reconciliation/repair/feedback, and coaching. It never deletes or rewrites an existing youth record. Setting the flag to `1` restores the existing age17 guardian flow; it is not a migration or permission to activate it without its own acceptance.

## Background continuation

`vercel.json` declares independent native scheduler invocations of `/api/athlete/academy-worker` and `/api/athlete/academy-mail-worker`, each once per minute. Vercel sends `Authorization: Bearer <CRON_SECRET>` to each path. Bind `CRON_SECRET` to a value of at least 32 characters and set `ATHLETE_ACADEMY_WORKER_ENABLED=1`; the declaration alone does not prove that a production schedule is installed or running. The two paths remain separate invocations, never sequential work inside the same function.

When `CRON_SECRET` is present, it is authoritative and `ATHLETE_ACADEMY_WORKER_SECRET` is ignored. The fallback exists only for a private non-Vercel scheduler with no `CRON_SECRET` binding, and readiness intentionally remains false in that configuration.

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
4. Verify actual delivery of confirmation and recovery messages using approved test inboxes. Confirm sender and origin. Guardian delivery remains a later youth-release gate while the adult-only lock is active.
5. Run separately identified 18+ synthetic accounts through the exact hosted adult system. Keep real participant data out of these tests. Before a later youth activation, separately run one17-year-old account with a separate guardian through the flag-on design.
6. Verify own-MM continuity through BOS, APA and coaching; sign-out/return; source isolation; full readers; plan approval and confirmed learning; mobile layout; scheduler completion with browser closed; and recovery without duplicate requests.
7. Test ordinary expired links, revoked sessions, wrong account/MM, the adult-only youth lock, preserved youth reads and pause controls, withdrawal, concurrent edits and an unacknowledged stage. Test missing youth permission and guardian flow again before the later youth activation.
8. Preserve the first outputs and failures. Structural tests and editorial judgments are not psychometric validation or real youth comprehension evidence.
9. Obtain Founder acceptance before inviting Darren, Lisa, Bryant or their children to the activated pilot.

## Rollback

Disable API, worker and frontend activation (frontend needs rebuild), or restore the prior accepted deployment through Home Base. Stop scheduled dispatch before rollback. Keep the Redis namespace and immutable records intact. Never delete dossiers to roll back a UI. A versioned saved report stays tied to its original engine and question bank. Resume only after checking current consent, account, input and source pointers.

## Remaining operational decisions

Hosted bindings and scheduler are not installed; real transactional delivery has not been exercised. Participation material needs its accepted version before real youth activation. Institute staffing/roster/sharing and privacy export/deletion/support administration are outside this participant pilot and must not be represented as shipped features. Product records are currently retained without an automatic destructive retention job; choose the production retention/support process before admitting paying customers. Billing remains direct institute billing outside the product as the Founder requested.
