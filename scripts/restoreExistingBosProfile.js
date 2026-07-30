#!/usr/bin/env node

import process from 'node:process';
import Redis from 'ioredis';

import {
  RESTORE_CONFIRMATION,
  createRedisBosProfileStorage,
  restoreExistingBosProfile,
} from './lib/bosExistingProfileOperations.js';
import {
  parseOperatorArgs,
  readVerifiedBackup,
  writeReceipt,
} from './lib/bosOperatorCli.js';

const VALUE_OPTIONS = [
  'profile-id',
  'confirm-profile-id',
  'backup',
  'expected-sha256',
  'receipt-output',
  'confirm-action',
];
const BOOLEAN_OPTIONS = ['dry-run', 'production-write'];

function requireValue(args, name) {
  const value = args[name];
  if (value == null || value === '') {
    throw new Error(`--${name} is required`);
  }
  return value;
}

async function main() {
  const args = parseOperatorArgs(process.argv.slice(2), {
    valueOptions: VALUE_OPTIONS,
    booleanOptions: BOOLEAN_OPTIONS,
  });
  const productionWrite = Boolean(args['production-write']);
  const dryRun = !productionWrite;

  if (args['dry-run'] && productionWrite) {
    throw new Error('--dry-run and --production-write cannot be combined');
  }

  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is required but was not found');
  }

  if (productionWrite && !args['receipt-output']) {
    throw new Error('--receipt-output is required for production restore');
  }

  const backup = await readVerifiedBackup(
    requireValue(args, 'backup'),
    requireValue(args, 'expected-sha256'),
  );
  const redis = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });

  try {
    await redis.connect();
    const receipt = await restoreExistingBosProfile({
      profileId: requireValue(args, 'profile-id'),
      confirmedProfileId: requireValue(args, 'confirm-profile-id'),
      backupRaw: backup.raw,
      expectedBackupSha256: backup.sha256,
      dryRun,
      productionWrite,
      confirmation: args['confirm-action'] || null,
      storage: createRedisBosProfileStorage(redis),
    });
    const receiptArtifact = await writeReceipt(args['receipt-output'], receipt);
    process.stdout.write(`${JSON.stringify({
      success: true,
      backup: {
        path: backup.path,
        sha256: backup.sha256,
        bytes: backup.bytes,
      },
      receipt,
      receipt_artifact: receiptArtifact,
      required_production_confirmation: RESTORE_CONFIRMATION,
    }, null, 2)}\n`);
  } finally {
    redis.disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    success: false,
    code: error.code || 'BOS_OPERATOR_ERROR',
    error: error.message,
  }, null, 2)}\n`);
  process.exitCode = 1;
});
