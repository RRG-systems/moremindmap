# Architecture Decision: Repository Worktree Integration V1

Status: accepted
Date: 2026-07-21

## Decision

Use explicit file-level promotion from the nested linked worktree into canonical repository paths, followed by scoped validation and local commits. This was safer than merging or cherry-picking because the feature work was uncommitted, and safer than staging the nested directory because that would create an embedded-repository gitlink.

All candidates were classified before promotion. Unique implementation and artifacts were copied through allowlists; identical predecessor tests and validators were retained in place; the barrel export was semantically merged; timestamp-only generated evidence divergence retained the current canonical result. Nested Git metadata, secrets, environments, dependencies, build output, browser profiles, caches, and unrelated work were excluded.

The worktree could be force-removed only after a verified external archive, two local foundation commits, full validation, and a 45-file zero-mismatch comparison. The canonical repository and ordinary source tree are now the engineering source of truth.

## Rejected alternatives

- Add the nested directory: would create an unconfigured gitlink.
- Copy the entire worktree: would include `.git`, environments, build output, and unrelated tracked content.
- Merge the uncommitted branch: no separable commit existed.
- Delete before backup: unacceptable loss risk.
- Include unrelated canonical untracked work: violates campaign scope.
