#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { validateProofRecord } from '../src/lib/intelligenceFabric/coachConnect/deploymentReadiness/proofHarness.js';

const root = path.resolve(process.argv[2] ?? 'lab_outputs/coach_connect_deployment_readiness_v1');
const failures = [];
const files = fs.existsSync(root)
  ? fs.readdirSync(root, { recursive: true })
    .filter((entry) => fs.statSync(path.join(root, entry)).isFile())
    .sort()
  : [];

for (const relative of files) {
  if (path.isAbsolute(relative) || relative.split(path.sep).includes('..')) failures.push(`unsafe:${relative}`);
  const absolute = path.join(root, relative);
  const bytes = fs.readFileSync(absolute);
  if (bytes.includes(Buffer.from('sensitive-canary'))) failures.push(`sensitive-canary:${relative}`);
  if (relative.endsWith('.json')) {
    try {
      const value = JSON.parse(bytes.toString('utf8'));
      const records = Array.isArray(value) ? value : value.proof_contract_version ? [value] : [];
      for (const record of records) {
        if (!validateProofRecord(record).valid) failures.push(`invalid-proof:${relative}`);
      }
    } catch {
      failures.push(`invalid-json:${relative}`);
    }
  }
}

const report = {
  verifier_version: 'coach-connect-deployment-readiness-evidence-verifier-v1',
  root,
  file_count: files.length,
  files: files.map((relative) => ({
    path: relative,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex'),
  })),
  failures,
  valid: files.length > 0 && failures.length === 0,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.valid ? 0 : 1;
