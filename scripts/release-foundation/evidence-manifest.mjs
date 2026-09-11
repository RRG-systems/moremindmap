#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { atomicWriteJson, sha256 } from './contract.mjs';

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error('NONREGULAR_EVIDENCE_REFUSED');
  }
  return files;
}

const evidenceRoot = resolve(process.argv[2] || 'docs/runbooks/release-foundation/evidence');
const output = resolve(process.argv[3] || `${evidenceRoot}/MANIFEST.json`);
const files = (await walk(evidenceRoot)).filter((path) => path !== output).sort();
const entries = [];
for (const path of files) {
  const bytes = await readFile(path);
  entries.push({ path: relative(evidenceRoot, path), bytes: bytes.length, sha256: sha256(bytes) });
}
await atomicWriteJson(output, {
  schema: 'more.home-base.release-evidence-manifest/v1',
  algorithm: 'SHA-256',
  excludes_self: true,
  file_count: entries.length,
  files: entries,
});
console.log(JSON.stringify({ verdict: 'EVIDENCE_MANIFEST_GREEN', file_count: entries.length, output }));
