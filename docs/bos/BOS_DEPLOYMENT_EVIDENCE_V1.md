# BOS Measurement Foundation Deployment Evidence V1

## Status

Production deployment is complete and read-only smoke verification passed.

## Source and push

- Focused commit: `b6265144d2c6c8a23ff229b261b24a1a54219ea6`
- Commit subject: `fix(bos): unify measurement foundation`
- Focused branch: `bos-production-repair-v1`
- Production branch: `main`
- Remote: `origin`
- Push method: normal fast-forward pushes; no force push

The production deployment metadata identifies `main` and the exact focused commit above. The focused branch preview identifies the same commit. No dirty-worktree deployment was used.

## Deployment

- Project: `rrg-systems-projects/moremindmap`
- Deployment ID: `dpl_CaMxPfMPyy4U5mTzLHAXwcWaiJDU`
- Immutable deployment URL: `https://moremindmap-3b06prz5w-rrg-systems-projects.vercel.app`
- Production URL: `https://moremindmap.com`
- Target: `production`
- State: `READY`
- Source ref: `main`
- Source SHA: `b6265144d2c6c8a23ff229b261b24a1a54219ea6`
- Build command: `npm run build`
- Runtime: Node.js 24.x

## Read-only production verification

- Production root: HTTP 200 with a valid application root.
- Versioned client bundle: `/assets/index-CJshIwwa.js`, HTTP 200, 1,690,789 bytes.
- Retrieval-route smoke check: a synthetic, valid-shaped nonexistent profile ID returned the expected structured `Profile not found` response.
- Deployment inspection: Vercel reports the deployment `READY`, aliased to `moremindmap.com`, and sourced from the exact focused SHA.

No production profile, Redis record, Vault record, environment variable, deployment configuration, or customer data was written during verification.
