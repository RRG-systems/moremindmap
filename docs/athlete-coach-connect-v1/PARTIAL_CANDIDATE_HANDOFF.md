# ATHLETE Coach Connect V1 — partial candidate, release held

This is an isolated synthetic DarrenDemo candidate, **not** a Production release. Its base is Home Base V2 `da9889e79a4b37adc6f0904b189309098d6a2202` / tree `3b6922e9e8c2e5c0c0d43768737e00a9a3021d2d`. The latest local annotated Production checkpoint names deployment `dpl_7AqXDnxrZutXViW5FDf1sHhXrQ5s` and rollback `dpl_CZGEgNqaUWcug5jUTqyQMj5jGAjK`; these are local records, not fresh live provider proof.

## Implemented, offline-tested scope

- Box 04 keeps Athlete Consulting Tool V2 and adds a separate ATHLETE Coach Connect choice. Both use the existing Leadership capability, Nia/Sofia synthetic allowlist, same launcher scope, and existing V2 route/store. V2-off hides and denies Coach Connect. No new login, customer reader, store, or real-coach authority was created.
- The Coach Connect entry opens the existing capture screen in a coach-first mode. A selected-athlete dropdown is disabled while a note is unsaved or a voice operation runs, preventing accidental wrong-athlete delivery. The legacy Consulting capture screen and historical attachments remain unchanged.
- Coach Connect V1 has typed notes and voice-to-editable-text only. It has no photo control. A note requires an explicit coach review checkbox before normal attributed, unverified `capture_demo` save. No BOS, APA, learning or plan is approved by capture.
- Voice transcription is **default-off** behind `ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED=true`. The new same-origin, exact synthetic Leadership + instructor-actor + state-bound CSRF endpoint validates audio magic/size, allows at most four new clips per 15 minutes in one demo scope, makes one provider attempt with no automatic retry, and returns editable text. Audio is not saved in the Consulting record. A same-audio transcript draft is cached for at most one hour to prevent duplicate paid calls.
- The UI accepts short M4A/MP4, MP3, WebM or WAV; recordings stop at 30 seconds. Uploaded clips with uncheckable or over-30-second duration and files over 250 KB fail visibly. The final supported-format/limit proof still requires actual rendered-browser tests.

Local validation on this exact candidate: affected Athlete V1/V2, Leadership, Recruiting and Darren Library protected tests **153/153 pass**; scoped ESLint, `git diff --check`, and the deployable build pass. Two offline fictional M4A fixtures pass format/size validation (95,256 and 87,981 bytes; `ffprobe` durations about 11.47 and 10.50 seconds). These are source/offline results, not hosted browser, provider or Production proof.

## Required gate not implemented

The existing Consulting model can see recent captured text in its general conversation history, but this candidate does **not** guarantee new coach notes are pinned to the athlete's next successful `Start My Session` opening, shown alongside the accepted plan, or marked delivered once. The source-review system rejected that proposed model/UI/receipt bridge three times as a sensitive cross-scope data flow, including a revision that checked synthetic identity and returned metadata only. No alternate write path was used. Do not promote or describe Box 04 as complete until the exact same-scope handoff is approved, implemented and tested.

The existing plan boundary remains intact: discussing a coach observation cannot silently create a current plan; the athlete must choose `Use this plan`, and coach-owned steps also require coach agreement. There is no separately persisted V2 homework field; only an accepted plan, draft and prior sessions.

## Provider and release gates

No paid transcription call, secret read, environment change, deployment, alias move, customer mutation or Production write has occurred. The project already names a server-only `OPENAI_API_KEY` for coaching; the Preview/Production binding and account access for transcription have not been checked. The [official file-transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text) supports this approach. [Official estimated pricing](https://developers.openai.com/api/docs/pricing) is $0.0045/minute for `gpt-transcribe`, or about $0.00225 per 30-second clip; actual billed usage remains unverified. A bounded synthetic provider test must run only after the handoff gate is resolved and the existing credential binding is verified without exposing its value. No new paid service or subscription is proposed.

Before any release, re-resolve current live Production source/tree/deployment and rollback; reconcile later Home Base advancement; run the affected protected matrix, exact Preview gate/route/browser QA, voice M4A and browser-recorded formats, next-opening delivery and no cross-athlete bleed, closing/plan consent, and rollback readiness. Promote only if all gates are green. If any fail, keep current Production and its rollback untouched.
