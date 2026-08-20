import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { LIBRARY_MANIFEST_SHA256 } from '../../../src/lib/newBosPersonalityDnaV1/libraryRegistry.js';
import {
  BUNDLED_BIBLE_FILES_BASE64,
  BUNDLED_BIBLE_MANIFEST_BASE64,
} from './bundledBibleAuthority.js';

const MANIFEST_PATH = 'docs/bos-intelligence-library-v1/BOS_INTELLIGENCE_LIBRARY_V1_MANIFEST.json';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function extractSection(text, headingPattern, maximumCharacters) {
  const match = text.match(headingPattern);
  if (!match) return '';
  const start = match.index;
  const after = text.slice(start + match[0].length);
  const next = after.search(/\n# (?!#)/);
  const section = next >= 0 ? text.slice(start, start + match[0].length + next) : text.slice(start);
  return section.slice(0, maximumCharacters);
}

export function boundedDoctrineBlock(text, bibleId) {
  const opening = text.slice(0, bibleId === 15 ? 12_000 : 4_500);
  const inference = extractSection(text, /# \d+\. Machine (?:Inference|Fit) (?:Contract|Output)[^\n]*/i, 8_000)
    || extractSection(text, /# \d+\. Synthesis Algorithm[^\n]*/i, 8_000);
  const evidenceBoundary = bibleId === 14
    ? `${extractSection(text, /# 4\. Confidence Semantics[^\n]*/i, 5_000)}\n${extractSection(text, /# 7\. Contradiction Protocol[^\n]*/i, 3_000)}`
    : '';
  return [opening, inference, evidenceBoundary].filter(Boolean).join('\n\n--- BOUNDED DOCTRINE BLOCK ---\n\n').slice(0, 16_000);
}

export function createHashBoundLibraryRetriever({ repositoryRoot = globalThis.process.cwd() } = {}) {
  const manifestAbsolute = path.join(repositoryRoot, MANIFEST_PATH);
  const manifestBuffer = Buffer.from(BUNDLED_BIBLE_MANIFEST_BASE64, 'base64');
  if (sha256(manifestBuffer) !== LIBRARY_MANIFEST_SHA256) throw new Error('new_bos_library_manifest_hash_mismatch');
  if (fs.existsSync(manifestAbsolute) && sha256(fs.readFileSync(manifestAbsolute)) !== sha256(manifestBuffer)) {
    throw new Error('new_bos_library_bundled_manifest_source_mismatch');
  }
  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  const byId = new Map(manifest.bibles.map((entry) => [entry.number, entry]));

  return Object.freeze({
    async retrieve(selection) {
      if (selection.manifest_sha256 !== LIBRARY_MANIFEST_SHA256) throw new Error('new_bos_library_selection_manifest_mismatch');
      const authorities = selection.authorities.map((expected) => {
        const entry = byId.get(expected.id);
        if (!entry || entry.sha256 !== expected.sha256) throw new Error(`new_bos_library_manifest_entry_mismatch:${expected.id}`);
        const encoded = BUNDLED_BIBLE_FILES_BASE64[entry.path];
        if (!encoded) throw new Error(`new_bos_library_bundled_file_missing:${expected.id}`);
        const buffer = Buffer.from(encoded, 'base64');
        if (sha256(buffer) !== expected.sha256) throw new Error(`new_bos_library_file_hash_mismatch:${expected.id}`);
        const absolute = path.join(repositoryRoot, 'docs/bos-intelligence-library-v1', entry.path);
        if (fs.existsSync(absolute) && sha256(fs.readFileSync(absolute)) !== sha256(buffer)) {
          throw new Error(`new_bos_library_bundled_source_mismatch:${expected.id}`);
        }
        const text = buffer.toString('utf8');
        return Object.freeze({
          id: expected.id,
          title: expected.title,
          sha256: expected.sha256,
          source_path: path.relative(repositoryRoot, absolute),
          bounded_block: boundedDoctrineBlock(text, expected.id),
        });
      });
      return Object.freeze({
        manifest_sha256: LIBRARY_MANIFEST_SHA256,
        stage_id: selection.stage_id,
        authorities: Object.freeze(authorities),
      });
    },
  });
}

export function compactGovernedContext(governedContexts) {
  const unique = new Map();
  governedContexts.forEach(({ retrieved }) => {
    retrieved.authorities.forEach((authority) => unique.set(authority.id, authority));
  });
  return Object.freeze([...unique.values()].sort((a, b) => a.id - b.id).map((authority) => Object.freeze({
    bible_id: authority.id,
    title: authority.title,
    sha256: authority.sha256,
    doctrine: authority.bounded_block,
  })));
}

export { MANIFEST_PATH };
