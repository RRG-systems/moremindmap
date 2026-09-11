# Actual private cycle operator contract

`private-cycle.mjs` is the only maintained adapter for a real
`subscription-canary` deployment rehearsal. It performs no Product operation,
provider operation, email, payment, state write or customer request. Product
quality evidence is reused from its sealed plan; the cycle proves the external
release mechanism itself.

## Required inputs

- an exact candidate worktree, branch, commit and tree;
- an exact rollback worktree, branch, commit and tree matching the currently
  selected private deployment;
- exact canonical Production deployment and source;
- the tracked private-environment definition and binding-metadata fingerprint;
- unique state and receipt paths outside the repository.

Both worktrees must be clean and linked to the same Vercel project. The tool
re-resolves all four public aliases, the stable private alias, the Production
deployment, the Custom Environment record and decrypt-disabled binding metadata
before continuing.

## Failing-gate proof

Run once with `--intentional-failure`. The tool writes a sanitized blocked
receipt, verifies that no deployment command or alias mutation occurred and
exits nonzero. Use new state and receipt paths for the corrected cycle.

## Actual cycle

Run without `--resume`. Vercel Custom Environments do not support
`--skip-domain` through the maintained CLI. A custom-target deploy can either
advance the private system alias automatically or remain unaliased. After the
deployment is READY, exact and SSO-protected, the tool selects it only through
the one allowlisted private stable alias when Vercel has not already done so.
The pre-deployment gate therefore blocks both actions. The tool verifies exact
deployment metadata, the stable alias, every public alias and six status-only,
read-only runtime checks.
It then restores only the pre-captured stable private alias to its READY prior
deployment and repeats the runtime and custody checks.

Use `--stop-after private-target-selected` to prove interruption recovery. A
fresh invocation with the same arguments and `--resume` loads the atomic state,
ignores the already-satisfied stop marker, re-resolves the deployment, aliases,
environment metadata and worktrees, then finishes verification and rollback.
Any digest or custody drift is refused. A failed-and-restored run cannot be
resumed into activation; start a new cycle with new state and receipt paths.

## Hard refusals

- no `vercel promote` for a Custom Environment candidate;
- no project-wide `vercel rollback`;
- no `--prod`, Production target or public alias write;
- no generic alias target; only the exact tracked private stable host may be
  restored to the exact pre-captured deployment;
- no decrypted environment read, secret/provider-name output or stored value;
- no stateful endpoint, Product advance, customer identity, email or charge;
- no claim that an actual drain occurred unless a separate authorized procedure
  really waits and proves it.
- no retry or alternate publication route for the previously rejected temporary
  Release 5 controller push; that rejection remains binding and preserved.

If private rollback protocols are incompatible or stateful work occurred, this
adapter is not sufficient. Stop and use the release-specific quarantine and
drain plan.
