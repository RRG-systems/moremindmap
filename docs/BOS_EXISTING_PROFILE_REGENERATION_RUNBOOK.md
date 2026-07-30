# BOS Existing-Profile Regeneration and Restore

## Purpose

These operator-only scripts rebuild one existing BOS canonical dossier from its
preserved top-level retained answers without changing the profile ID. They are
local CLIs under `scripts/`; no HTTP route or customer-accessible operation is
created.

## Safety model

- Dry-run is the default.
- Every operation requires the target profile ID twice.
- There is no wildcard, list, batch, scan, or mass mode.
- Production regeneration requires the literal confirmation
  `REGENERATE_EXISTING_BOS_PROFILE`.
- Production restore requires the literal confirmation
  `RESTORE_EXISTING_BOS_PROFILE`.
- Production regeneration requires expected values for Q6, Q12, Q13, and Q18.
- A verified full-record backup is required before any regeneration write.
- A failed post-write retrieval, answer, index, or renderer verification
  automatically restores the exact prior Vault bytes.
- Receipts contain counts, selections, hashed index identifiers, and status;
  they do not contain full written answers or credentials.

## Required environment

Run from a clean checkout of the deployed commit with the existing production
`REDIS_URL` loaded into the process environment. Do not print the environment
or place credentials in a receipt, command argument, backup, or tracked file.

## Durable backup and dry-run

Choose an absolute backup path outside the repository. The dry-run writes or
verifies the full backup and its three sidecars before producing a no-write
proposal:

```sh
node scripts/regenerateExistingBosProfile.js \
  --profile-id <profile-id> \
  --confirm-profile-id <profile-id> \
  --expected-retained-count 28 \
  --expected-q6 <ordered-choice> \
  --expected-q12 <ordered-choice> \
  --expected-q13 <ordered-choice> \
  --expected-q18 <ordered-choice> \
  --backup-output <absolute-backup-json-path> \
  --receipt-output <absolute-dry-run-receipt-path> \
  --dry-run
```

Generated backup artifacts:

- the full exact Vault JSON record;
- `<backup>.sha256`;
- `<backup>.metadata.json`;
- `<backup>.rollback-receipt-template.json`.

The dry-run must report the same profile ID, the expected retained-answer
count, exactly 28 unique canonical answers, verified target choices, successful
Narrative V3 and customer view model, eight tabs, five overview sections,
populated executive-summary and One Move content, and zero render-failure
messages.

## Production regeneration

Reuse the already verified backup path. The script refuses to overwrite it
unless the existing bytes and metadata match the current pre-write record.

```sh
node scripts/regenerateExistingBosProfile.js \
  --profile-id <profile-id> \
  --confirm-profile-id <profile-id> \
  --expected-retained-count 28 \
  --expected-q6 <ordered-choice> \
  --expected-q12 <ordered-choice> \
  --expected-q13 <ordered-choice> \
  --expected-q18 <ordered-choice> \
  --backup-output <absolute-backup-json-path> \
  --receipt-output <absolute-regeneration-receipt-path> \
  --production-write \
  --confirm-action REGENERATE_EXISTING_BOS_PROFILE
```

Successful completion requires exact-key write verification, same-ID
retrieval, 28 unique canonical answers, target-choice verification, date/email/
company index membership, and customer renderer verification.

## Restore dry-run

Read the SHA-256 from the trusted `.sha256` sidecar and verify the restore
proposal without writing:

```sh
node scripts/restoreExistingBosProfile.js \
  --profile-id <profile-id> \
  --confirm-profile-id <profile-id> \
  --backup <absolute-backup-json-path> \
  --expected-sha256 <sha256> \
  --receipt-output <absolute-restore-dry-run-receipt-path> \
  --dry-run
```

## Production restore

```sh
node scripts/restoreExistingBosProfile.js \
  --profile-id <profile-id> \
  --confirm-profile-id <profile-id> \
  --backup <absolute-backup-json-path> \
  --expected-sha256 <sha256> \
  --receipt-output <absolute-restore-receipt-path> \
  --production-write \
  --confirm-action RESTORE_EXISTING_BOS_PROFILE
```

The restore succeeds only when the backup hash, backup profile ID, target
profile ID, exact restored bytes, retrieval, and required index memberships all
verify.
