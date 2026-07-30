#!/usr/bin/env node

import process from 'node:process';
import Redis from 'ioredis';

import {
  REGENERATION_CONFIRMATION,
  createRedisBosProfileStorage,
  regenerateExistingBosProfile,
} from './lib/bosExistingProfileOperations.js';
import {
  createFileBackupWriter,
  parseOperatorArgs,
  writeReceipt,
} from './lib/bosOperatorCli.js';

const VALUE_OPTIONS = [
  'profile-id',
  'confirm-profile-id',
  'expected-retained-count',
  'backup-output',
  'receipt-output',
  'confirm-action',
  'expected-q6',
  'expected-q12',
  'expected-q13',
  'expected-q18',
];
const BOOLEAN_OPTIONS = ['dry-run', 'production-write'];

function requireValue(args, name) {
  const value = args[name];
  if (value == null || value === '') {
    throw new Error(`--${name} is required`);
  }
  return value;
}

function expectedChoices(args, productionWrite) {
  const choices = Object.fromEntries(
    [6, 12, 13, 18]
      .filter((id) => args[`expected-q${id}`] != null)
      .map((id) => [`q${id}`, args[`expected-q${id}`]]),
  );

  if (productionWrite && Object.keys(choices).length !== 4) {
    throw new Error(
      'Production regeneration requires --expected-q6, --expected-q12, --expected-q13, and --expected-q18',
    );
  }
  return choices;
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

  const profileId = requireValue(args, 'profile-id');
  const confirmedProfileId = requireValue(args, 'confirm-profile-id');
  const backupOutput = requireValue(args, 'backup-output');
  const expectedRetainedCount = Number(requireValue(args, 'expected-retained-count'));
  if (!Number.isInteger(expectedRetainedCount) || expectedRetainedCount <= 0) {
    throw new Error('--expected-retained-count must be a positive integer');
  }

  if (productionWrite && !args['receipt-output']) {
    throw new Error('--receipt-output is required for production regeneration');
  }

  const redis = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });

  try {
    await redis.connect();
    const receipt = await regenerateExistingBosProfile({
      profileId,
      confirmedProfileId,
      expectedRetainedCount,
      expectedCanonicalCount: expectedRetainedCount,
      expectedAnswerChoices: expectedChoices(args, productionWrite),
      dryRun,
      productionWrite,
      confirmation: args['confirm-action'] || null,
      storage: createRedisBosProfileStorage(redis),
      backupWriter: createFileBackupWriter(backupOutput),
    });
    const receiptArtifact = await writeReceipt(args['receipt-output'], receipt);
    process.stdout.write(`${JSON.stringify({
      success: true,
      receipt,
      receipt_artifact: receiptArtifact,
      required_production_confirmation: REGENERATION_CONFIRMATION,
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
    restored: error.code === 'REGENERATION_FAILED_PROFILE_RESTORED',
    restore_receipt: error.restore_receipt || null,
  }, null, 2)}\n`);
  process.exitCode = 1;
});
