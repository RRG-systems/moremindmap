# Layer 3 Universal Upgrade Runbook

## Pre-deployment

1. Confirm clean campaign worktree and expected commit.
2. Run focused tests, full repository tests, focused lint, build, and `git diff --check`.
3. Confirm `retrieve-profile.js` is unchanged.
4. Confirm no `vault:profile:*` translation writes exist.
5. Confirm both Layer 3 flags are default-off.

## Controlled preview

1. Deploy the clean committed branch to a non-production Vercel preview.
2. Enable `VITE_BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED=true` at preview build time and `BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED=true` only for that preview runtime.
3. Verify Layer 2 appears before translation.
4. Review user, Darren, Wally, and approved active-coaching profiles independently.
5. Record all ratings in `HUMAN_REVIEW_PACKET.md`.

## Production gate

Deploy only after explicit human approval. Reconcile active production source again immediately before deployment. Stop on semantic drift, unbounded cost/access, historical failure, unrelated source advancement, or any protected-contract change.

## Rollback

Disable either Layer 3 flag. The premium report immediately returns to exact Layer 2; canonical/customer records require no rollback because Layer 3 never writes them. Translation cache entries may expire naturally and do not affect Layer 2 authority.
