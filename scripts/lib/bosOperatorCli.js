import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';

import {
  RESTORE_CONFIRMATION,
  sha256,
  summarizeBosRecord,
} from './bosExistingProfileOperations.js';

export function parseOperatorArgs(argv, { valueOptions, booleanOptions }) {
  const values = {};
  const valueNames = new Set(valueOptions);
  const booleanNames = new Set(booleanOptions);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }

    const name = token.slice(2);
    if (booleanNames.has(name)) {
      values[name] = true;
      continue;
    }

    if (!valueNames.has(name)) {
      throw new Error(`Unknown option: --${name}`);
    }

    const value = argv[index + 1];
    if (value == null || value.startsWith('--')) {
      throw new Error(`Option --${name} requires a value`);
    }

    values[name] = value;
    index += 1;
  }

  return values;
}

async function writeOrVerifyPrivateFile(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await writeFile(filePath, contents, { flag: 'wx', mode: 0o600 });
    return 'created';
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = await readFile(filePath);
    const proposed = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
    if (!existing.equals(proposed)) {
      throw new Error(`Refusing to overwrite non-matching artifact: ${filePath}`);
    }
    return 'verified_existing';
  }
}

export function createFileBackupWriter(backupPath) {
  if (!backupPath) {
    throw new Error('--backup-output is required');
  }

  const absoluteBackupPath = path.resolve(backupPath);

  return async ({ profileId, raw, expectedSha256 }) => {
    const actualSha256 = sha256(raw);
    if (actualSha256 !== expectedSha256) {
      throw new Error('Backup writer received an unexpected SHA-256');
    }

    const backupStatus = await writeOrVerifyPrivateFile(absoluteBackupPath, raw);
    const shaPath = `${absoluteBackupPath}.sha256`;
    const metadataPath = `${absoluteBackupPath}.metadata.json`;
    const rollbackTemplatePath = `${absoluteBackupPath}.rollback-receipt-template.json`;
    const summary = summarizeBosRecord(JSON.parse(raw));
    let timestamp = new Date().toISOString();

    if (backupStatus === 'verified_existing') {
      const existingMetadata = JSON.parse(await readFile(metadataPath, 'utf8'));
      if (
        existingMetadata.profile_id !== profileId
        || existingMetadata.backup_sha256 !== actualSha256
        || existingMetadata.backup_bytes !== Buffer.byteLength(raw, 'utf8')
      ) {
        throw new Error('Existing backup metadata does not match verified backup bytes');
      }
      timestamp = existingMetadata.recorded_at;
    }

    await writeOrVerifyPrivateFile(
      shaPath,
      `${actualSha256}  ${path.basename(absoluteBackupPath)}\n`,
    );
    await writeOrVerifyPrivateFile(
      metadataPath,
      `${JSON.stringify({
        profile_id: profileId,
        backup_path: absoluteBackupPath,
        backup_sha256: actualSha256,
        backup_bytes: Buffer.byteLength(raw, 'utf8'),
        retained_answer_count: summary.retained_answer_count,
        canonical_answer_count: summary.canonical_answer_count,
        required_indexes: summary.required_indexes,
        recorded_at: timestamp,
      }, null, 2)}\n`,
    );
    await writeOrVerifyPrivateFile(
      rollbackTemplatePath,
      `${JSON.stringify({
        operation: 'restore_existing_bos_profile',
        profile_id: profileId,
        backup_path: absoluteBackupPath,
        expected_backup_sha256: actualSha256,
        required_confirmation: RESTORE_CONFIRMATION,
        status: 'not_executed',
        execution_receipt: null,
      }, null, 2)}\n`,
    );

    return {
      path: absoluteBackupPath,
      sha256: actualSha256,
      bytes: Buffer.byteLength(raw, 'utf8'),
      status: backupStatus,
      sha_path: shaPath,
      metadata_path: metadataPath,
      rollback_template_path: rollbackTemplatePath,
      recorded_at: timestamp,
    };
  };
}

export async function readVerifiedBackup(backupPath, expectedSha256) {
  const absolutePath = path.resolve(backupPath);
  const raw = await readFile(absolutePath, 'utf8');
  const actualSha256 = sha256(raw);
  if (actualSha256 !== expectedSha256) {
    throw new Error('Backup SHA-256 does not match --expected-sha256');
  }
  return {
    path: absolutePath,
    raw,
    sha256: actualSha256,
    bytes: Buffer.byteLength(raw, 'utf8'),
  };
}

export async function writeReceipt(receiptPath, receipt) {
  if (!receiptPath) return null;
  const absolutePath = path.resolve(receiptPath);
  const contents = `${JSON.stringify(receipt, null, 2)}\n`;
  const status = await writeOrVerifyPrivateFile(absolutePath, contents);
  return { path: absolutePath, status };
}
