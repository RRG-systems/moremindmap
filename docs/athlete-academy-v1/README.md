# MORE Athlete academy foundation — candidate

This is the Founder-approved California institute pilot implementation. Its current default release is 18-and-up. The preserved age-17-and-up guardian design activates only when `ATHLETE_ACADEMY_REAL_YOUTH_ENABLED=1` after its separate acceptance. Stripe and automated billing are excluded. Founder browser review and a separate Home Base release approval are required before promotion.

The accepted baseline is the Plan MORE ATHLETE architecture prototype, the locked Youth BOS V2.1 twenty-question bank, the complete Youth BOS V2 reading, the five-box Youth APA, and Athlete Consulting Tool V2. Existing Leadership / DarrenDemo Box04 and Box05 remain separate and unchanged.

## Participant journey

Current pilot: MORE Athlete → find Beyond Today Sports Institute → institution code → individual verified 18+ account → participation → BOS → APA → personal Athlete Consulting Tool → Start my first session. The preserved flag-on youth journey adds separate guardian approval at17 before BOS.

Horizon Sports Institute is a separate fictional directory example. It has no active enrollment. The institution code grants service access only; it never identifies a person or grants access to a report. Every participant receives their own permanent MM, including adult partner testers who use their real age.

The public candidate uses verified email and password with password recovery. The architecture prototype's simulated passkey screen was not presented as working authentication. Passkeys, institution staff dashboards, roster administration, coach invitations into shared private sessions, and billing are not implemented by this participant pilot. The real continuing coach is the authenticated participant's private workspace. It can help them plan conversations with a human coach, but a typed coach introduction cannot grant a second person's authority.

## Source and persistence

- `server/athleteAcademyV1/auth.js`: scrypt passwords, single-use hashed tokens, verified email, hashed sessions, session revocation, reset security epoch, stable MM allocation.
- `repository.js`: same-slot multi-key Redis compare-and-swap. A write with an uncertain acknowledgment is never automatically replayed. Reconnecting the Redis connection does not replay unfulfilled commands.
- `service.js`: account ownership, current athlete/guardian participation, own answers, revisions, exact report versions, immutable report publication, source checks, independent feedback.
- `assessment.js`, `bos/`, `apa/`: packaged locked intelligence and validators. No references to temporary worktrees or local report files.
- `coaching/`: approved Model2 coaching mission adapted to the whole athlete; real own BOS+APA, private continuing conversation, explicit plan and learning approval.
- `delivery.js`: durable transactional outbox and existing Resend transport interface. Unknown delivery is retained, not blindly resent.
- `worker.js`: resume only already-requested assessment stages. No browser must remain open when a hosted scheduler is enabled. Leases prevent duplicate stage dispatch. Unknown results can be recovered from saved terminal evidence; they are not reissued.
- `api/athlete/academy.js`: same-origin, CSRF-protected private API. `api/athlete/academy-worker.js` and `academy-mail-worker.js`: separately authenticated, default-off workers with independent time budgets.

Dossiers live under `more:athlete-academy:{v1}` in the configured Redis service. Local proof uses a separate `{test-founder-review-v1}` namespace on an isolated loopback Redis instance. Nothing writes to adult dossiers or live demo state.

Accounts, email identity lookup, dossiers, operations, generation jobs and evidence, immutable report versions, mail, feedback, guardian indexes and coach states are separate keyed records. A canonical dossier points to the current BOS and APA versions. APA publication checks the exact BOS it consumed. A replaced BOS marks the prior APA stale. Coaching checks both current hashes before dispatch and before committing a response; a new valid pair requires an explicit source transition while preserving history and the accepted plan.

## Recovery behavior

1. Refreshing or reopening an intake resumes saved answers.
2. Every generation stage is durably claimed before dispatch; request bytes, streamed events, terminal response and validated output are preserved privately.
3. A completed response that was interrupted before publication is recovered from those exact bytes without another AI call.
4. A known failed or ambiguous attempt can be explicitly set aside. The original attempt remains in the ledger, and a late response cannot publish after abandonment. A new request is always separate; no silent quality reroll.
5. Coach recovery follows the same rule. The participant can check a saved reply or continue without the unfinished reply; neither button resends it automatically.
6. A successful password reset invalidates every previously issued reset token and all old sessions. A new login rotates the anonymous session.
7. Guardian withdrawal stops new processing. Athlete assent alone cannot restore guardian permission. Original reports remain readable by their authenticated owner.
8. Changed policy versions require renewed participant and, where required, separate guardian acceptance.

The synthetic test harness contains a single, separately recorded repair path for each first failed assessment: a diagnosed BOS synthesis contract failure, APA headline contract failure, or explicitly requested source-audit correction. The original failed job and all its records stay intact; a source-audit repair supplies the exact final findings and corrected report to one new correction plus a fresh independent audit. The audit receives the actual deterministic candidate selection, clearly marked proposed and not athlete-agreed. It requires the unchanged synthetic input/BOS pair and cannot be used on real participant jobs. That is a development diagnostic, not an end-user automatic regeneration loop.

## Publication boundary

Code completion and local synthetic proof are not hosted delivery or real participant proof. Home Base must bind the deployment configuration, verify hosted mail/storage/scheduler behavior, and run the authorized synthetic acceptance on the exact deployment after Founder approval. See OPERATIONS.md. The Founder requested an in-app candidate review first.
