# Integrated V2 browser proof — September 15, 2026

## What was actually exercised

Literal Codex in-app browser interaction with the compiled candidate on `http://127.0.0.1:5286`. The actual shared Leadership entry and launcher handlers, unchanged Secure/HttpOnly/SameSite cookies, new V2 handler, actor proofs, state store and transport ran together. No cookie weakening was needed. The server uses an in-memory Redis stand-in and replays six hash-recorded responses from the verified Founder lock. No new provider request was sent. This is integration/structure proof, not new coaching-quality, latency, deployed-provider or real Redis persistence proof.

The original Founder app on 5285 was not read, changed, reset or restarted by this recovery. Browser fixtures are fictional Nia and Sofia only. No live account or customer data is present. The secondary `localhost` cookie scope tested an independent shared-gate session without clearing the user's existing cookies.

## Responsive matrix

| Viewport | HOME | YOU / BOS | YOUR SPORT / APA | PLAN | Conversation |
| --- | --- | --- | --- | --- | --- |
| Desktop 1440 × 1000 | Pass | Pass | Pass | Pass | Persistent right rail |
| iPad landscape 1024 × 768 | Pass | Pass | Pass | Pass | Persistent right rail |
| iPad portrait 768 × 1024 | Pass | Pass | Pass | Pass | Existing open/close rail |
| Mobile 390 × 844 | Pass | Pass | Pass | Pass | Existing full-screen rail |

Sixteen final room/viewport screenshot pairs and DOM snapshots are in `screenshots/`. Additional screenshots preserve accepted plans, original report sources, responsive dialogs and denied boundaries. Workspace widths matched their viewports. The nested APA widths were 753/753 in portrait and 375/375 on mobile (client/scroll); its deliberate horizontally scrollable room-navigation strip is preserved. These are browser viewport proofs, not claims of physical iPad hardware testing. Final browser error/warning log: empty. Server-only favicon 404s are preserved as review-harness omissions, not Product failures.

## Interaction proof

- Actual `/leadership` → `/leadership-demo` → same `/athlete-consulting-tool/demo`; fourth choice names Nia and Sofia with V2 enabled.
- Nia and Sofia each show their own accepted BOS, all eight BOS chapters and the actual five-box APA. Nia's full portrait evidence, APA-to-BOS provenance drawer, all five future tabs, One Move, assessment plan and complete saved-source drawer were exercised. Sofia's five APA rooms and One Move evidence were exercised; exact renderer parity covers all unchanged remaining detail controls.
- One continuous conversation survives HOME/YOU/YOUR SPORT/PLAN navigation. Selected report identity and source bindings are also verified by focused tests.
- Nia's frozen conversation asks for a 15-minute maths proposal, revises it to a single 10-minute step without approval, then explicitly accepts it. Reload restores the selected athlete, plan and transcript.
- Close offers a truthful recap and an unchecked preference. Only checking the preference and finishing confirms it. A subsequent session retains the accepted plan, prior transcript and selected learning.
- A manually edited synthetic shared draft leaves the current personal plan intact. Athlete approval alone cannot accept it. Revising clears that approval. The exact revised version needs both synthetic role-bound confirmations. This is a same-browser demonstration of explicit decisions, not real two-person identity assurance.
- Not now discards only the new draft and preserves the accepted shared plan.
- Sofia starts empty and has a distinct opening. Mobile review of her APA suggestion creates a draft; explicit approval accepts it. Switching back restores Nia's separate plan. Nia-only Restart clears Nia's conversation/plan/learning while keeping her original reports and Sofia's accepted plan/session unchanged.
- Standalone APA, even in an authenticated cookie scope, displays only `Open this reading inside the consulting tool.` Unauthenticated second-scope registry/bundle/state calls return 401 and reveal no report. Entering the shared gate in that second scope produces an empty Sofia session, not the first scope's conversation or plan.

## Preserved failures and measurement limits

1. First screenshot write to the durable checkout was denied by the tool sandbox. Screenshots were staged in an allowed unique temporary directory, then copied unchanged into this evidence directory. No browser/security restriction was disabled.
2. A locator using rendered uppercase `ENTER PORTAL` did not match the second scope's DOM label `Enter Portal`. The current DOM was re-read and the actual label used; entry then passed.
3. An all-in-one responsive batch timed out while waiting for a below-fold APA button to become visible at portrait size. Ten completed screenshot pairs were preserved. The same tab was reattached; remaining six were completed in bounded calls. No app restart or state replay occurred.
4. Two provisional checks were not valid identity tests: a hidden responsive MM label was absent from a DOM snapshot, and one immediate athlete-switch snapshot captured the loading state. Later settled snapshots show the correct selected athlete and preserved plan. The loading snapshot is retained; identity is established by settled visible content plus exact bundle tests, not those provisional Boolean checks.
5. No crash/restart of a real Redis-backed server occurred. Reload and cold-handler tests are distinct from durable backend restart. Provider failures, ambiguous persistence, concurrent ownership loss and uncertain retry are deterministic regression tests, not browser-induced live failures.
6. Existing locked wording was not polished. For example, BOS chapter 6 retains the original `claim ids` label and the APA evidence footer retains its assessment-review wording. Those are inherited Founder-locked presentation observations, not new integration changes or authorization to redesign.

## Evidence provenance

`browser-evidence/2026-09-15T22-07-56-565Z/` retains monotonic sanitized server receipts. They include response-fixture and request-input hashes, HTTP statuses and scoped state summaries, but no cookies, CSRF values, actor capabilities, credentials or real participant data. Final receipts record six replay attempts, zero provider calls, zero real Redis connections and zero attempted outbound connections.

The full frozen provider evidence remains in the original Founder package. Responses were not improved, rerolled or described as freshly generated. Manual shared-plan edits occur after the replayed close/return sequence and do not pretend the old response anticipated those later edits.
