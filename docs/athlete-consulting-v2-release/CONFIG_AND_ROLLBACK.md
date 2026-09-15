# V2 private release prerequisites and rollback

This is metadata-only preparation. No existing secret was read, copied, changed or created; no deployment or shared configuration was changed.

## Existing binding names and required behavior

| Name | Requirement |
| --- | --- |
| `RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED` | Existing composite shared-gate flag; must be true for the Athlete demo. |
| `SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED` | Existing composite shared-gate flag; must be true. |
| `ATHLETE_CONSULTING_DARREN_DEMO_ENABLED` | Existing Athlete route flag; must be true. |
| `ATHLETE_CONSULTING_V2_ENABLED` | New additive flag. Absent/false retains V1. Only exact true selects V2. Set only in an independently authorized release environment. |
| `LEADERSHIP_DEMO_ACCESS_CODE` | Existing exact shared Leadership gate binding. No new Athlete access code. |
| `REDIS_URL` | Existing server-side durable-store binding, scoped by V2 application keys. No alternate live store fallback. |
| `OPENAI_API_KEY` | Existing server-only approved provider binding. The locked request is unchanged; no client key, local keychain, credential download or new credential. |

Do not print values or model/provider assignments in the Notion/public handoff. The exact locked policy is private candidate source and frozen proof. The existing endpoint's configured duration is 800 seconds; the frozen individual request has its original stricter timeout and no automatic retry. Web research is absent.

## Deployment integration map

- Same gate and launcher endpoints; no new public login or DarrenDemo.
- Existing Athlete API delegates to V2 only behind the composite flag. V1 remains intact when off. Version probe returns only 1 or 2, never reports or state.
- `/athlete-consulting-tool/demo` retains the existing middleware route family. The V2 outer route isolates approved CSS in `/athlete-consulting-tool/demo/workspace.html`; its APA uses `/athlete-consulting-tool/demo/apa-reading.html`. Both are explicit Vite build inputs. No fixture report is embedded in public client assets.
- Server bundle JSON is statically imported from `server/athleteConsultingV2/fixtures`. Original BOS/APA embedded hashes are checked before use. No filesystem report read or local URL in the deployable runtime.
- Build output proves the two nested HTML entry points exist. Actual hosting rewrite precedence, middleware and serverless fixture tracing are NOT established by the loopback harness. Home Base must verify those exact paths at the private deployment, including denial when flags are off, correct asset MIME, no standalone report bypass, and JSON inclusion. No Vercel CLI tracing package was installed or deployment attempted here.
- The shared auth module changes only V2's exact allowed subjects plus derived synthetic actor capabilities. The launcher adds version metadata/copy only for Athlete V2. Main route alias and Vite entry list are the other shared source seams. No adult BOS/BA, Recruiting behavior, paid Subscription, Stripe, entitlement or customer storage path was changed.

## Durable-state contract

Keys start with `more:athlete-consulting-demo:v2:` and bind exact launcher session, selected athlete, MM identity and BOS/APA hashes. V1 and V2 namespaces are not migrated or overwritten. State changes use a renewable owner-fenced lease and compare-and-set envelope. An operation's stable request ID and semantic hash persist beyond visible transcript trimming and reset. Ambiguous pending writes and lost acknowledgements fail closed; they do not authorize a second provider call.

Reset atomically archives only the selected V2 envelope, retains the replay ledger and never modifies fixture reports or the other athlete/session. Private request/raw-response/receipt events are immutable and separately named, retained for 30 days with a two-megabyte event ceiling. Failed evidence writes prevent result delivery. These guarantees are locally tested with the stand-in; actual Redis semantics and multi-process durability remain private-release proof gates.

## Smallest ordered Home Base runway

1. Re-resolve current canonical Production after Home Base's ongoing release. Compare the sealed candidate against that exact commit/tree/deployment, file by file. Do not replay this September 13 base over newer repairs.
2. Review the six shared file changes and additive V2 modules. Preserve the Founder lock and exact reports. Confirm the isolated keys and privacy/retention policy. Scope remains synthetic demo replacement only.
3. Prepare the existing private release environment, without exposing secret values. Verify the composite flags, existing secret-name bindings, private Origin and rollback metadata. No public alias or real customer access.
4. Verify deployable artifact tracing and the exact three HTML paths, private gate/cookies, expired capability, old V1/new V2 capability invalidation, no-store responses and server-only fixtures. Exercise the same route, not a parallel test login.
5. Prove the actual existing provider binding with a bounded synthetic first response, request/raw-response/failure custody, unchanged request hash inputs and no retry. Reuse frozen quality proof; do not start a new tuning campaign.
6. Prove real isolated durable save/reopen across separate server processes, same-operation retry, concurrent-worker fencing, provider failure, unknown-result recovery, selected reset and cross-session separation. Never test against real customer keys.
7. Run the affected protected matrix plus the literal responsive browser route again on the exact private artifact. Record any remaining gate as non-green.
8. Only after Home Base/Founder promotion authority: canary, exact rollback rehearsal, deployment, alias promotion and live verification. None is performed by this package.

## Compatibility-aware rollback

1. Home Base captures the exact pre-promotion deployment/configuration fingerprint; do not assume the historical preparation deployment is tomorrow's rollback target.
2. Stop new V2 operations and drain active operations using the authorized private/release mechanism. If ownership or in-flight status is uncertain, quarantine; do not rerun provider calls or delete state to make the gate green.
3. Restore the captured deployment/flag state through Home Base's verified release controller. With V2 false, the unchanged V1 route/copy/pair is selected.
4. V2 browser capabilities are intentionally invalid for V1's subject set. Require shared-gate re-entry; never reinterpret a Nia/Sofia cookie as Mika/Avery authority.
5. Keep V2 state, operation ledger, reset archives and evidence untouched for investigation/re-entry. V1 must not deserialize V2 envelopes. No deletion, customer migration, Redis cleanup, secret rotation or unrelated flag change.
6. Verify the original three launcher products, preserved V1 route, paid Subscription and unchanged customer boundaries. Record exact restored custody and stop if a third owner has taken the release alias.

Local emergency containment needs no Product changes: stop only the isolated review PID after verifying its command and port, if requested. It contains no real store or provider connection. Never stop the Founder-owned 5285 app.
