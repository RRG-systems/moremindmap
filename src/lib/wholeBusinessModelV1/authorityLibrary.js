import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { DEFAULT_AUTHORITY_SECTIONS } from './constants.js';
import { integrity } from './errors.js';
import { sha256 } from './canonical.js';

const DEFAULT_LIBRARY_ROOT = path.resolve(
  process.cwd(),
  'docs/ba-intelligence-authority-library-v1',
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeSectionTitle(value) {
  return value
    .replace(/^\d+\.\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

export function parseBibleSections(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const sections = [];
  let current = null;
  for (const line of lines) {
    const match = /^##\s+(.+)$/u.exec(line);
    if (match) {
      if (current) sections.push(current);
      current = {
        title: match[1].trim(),
        normalized_title: normalizeSectionTitle(match[1]),
        markdown: '',
      };
      continue;
    }
    if (current) current.markdown += `${line}\n`;
  }
  if (current) sections.push(current);
  return sections.map((section) => ({
    ...section,
    markdown: section.markdown.trim(),
  }));
}

function assertFileHash(libraryRoot, record) {
  const filePath = path.resolve(libraryRoot, record.path);
  integrity(
    filePath.startsWith(`${path.resolve(libraryRoot)}${path.sep}`),
    'BROKEN_AUTHORITY_HASH',
    `Authority path escapes the frozen library: ${record.authority_id}`,
  );
  integrity(fs.existsSync(filePath), 'BROKEN_AUTHORITY_HASH', `Missing frozen authority ${record.authority_id}`);
  const bytes = fs.readFileSync(filePath);
  integrity(
    sha256(bytes) === record.sha256,
    'BROKEN_AUTHORITY_HASH',
    `Frozen authority hash mismatch for ${record.authority_id}`,
    { authority_id: record.authority_id },
  );
  integrity(
    bytes.length === record.bytes,
    'BROKEN_AUTHORITY_HASH',
    `Frozen authority byte count mismatch for ${record.authority_id}`,
    { authority_id: record.authority_id },
  );
  return { filePath, bytes };
}

function loadRegistry(libraryRoot, registryPath, expectedClass) {
  const registry = readJson(path.join(libraryRoot, registryPath));
  integrity(registry.authority_class === expectedClass, 'INVALID_CASSETTE', `Unexpected authority class ${registry.authority_class}`);
  integrity(registry.bibles.length === registry.expected_count, 'INVALID_CASSETTE', `Incomplete ${expectedClass} registry`);
  const bibles = registry.bibles.map((record) => {
    const { bytes } = assertFileHash(libraryRoot, record);
    const markdown = bytes.toString('utf8');
    return Object.freeze({
      ...record,
      markdown,
      sections: parseBibleSections(markdown),
    });
  });
  return { registry, bibles };
}

function verifyMainManifest(libraryRoot) {
  const manifestPath = path.join(libraryRoot, 'freeze/BA_INTELLIGENCE_AUTHORITY_LIBRARY_MANIFEST_V1.json');
  const manifest = readJson(manifestPath);
  integrity(
    manifest.verdict === 'BA_INTELLIGENCE_AUTHORITY_LIBRARY_V1_FROZEN_READY_FOR_RUNTIME_INTEGRATION',
    'BROKEN_AUTHORITY_HASH',
    'BA Intelligence Authority Library does not carry the frozen runtime-integration verdict',
  );
  for (const artifact of manifest.artifacts_excluding_self) {
    const artifactPath = path.join(libraryRoot, artifact.path);
    integrity(fs.existsSync(artifactPath), 'BROKEN_AUTHORITY_HASH', `Frozen manifest artifact missing: ${artifact.path}`);
    const bytes = fs.readFileSync(artifactPath);
    integrity(
      bytes.length === artifact.bytes && sha256(bytes) === artifact.sha256,
      'BROKEN_AUTHORITY_HASH',
      `Frozen manifest artifact drifted: ${artifact.path}`,
    );
  }
  return manifest;
}

export function loadFrozenAuthorityLibrary({ libraryRoot = DEFAULT_LIBRARY_ROOT } = {}) {
  const resolvedRoot = path.resolve(libraryRoot);
  const manifest = verifyMainManifest(resolvedRoot);
  const universal = loadRegistry(
    resolvedRoot,
    'registries/UNIVERSAL_BUSINESS_BIBLE_REGISTRY_V1.json',
    'UNIVERSAL_BUSINESS',
  );
  const realEstate = loadRegistry(
    resolvedRoot,
    'registries/REAL_ESTATE_CASSETTE_REGISTRY_V1.json',
    'REAL_ESTATE_VERTICAL',
  );
  const libraryRegistry = readJson(path.join(resolvedRoot, 'registries/BA_INTELLIGENCE_AUTHORITY_LIBRARY_REGISTRY_V1.json'));
  integrity(universal.bibles.length === 12, 'INVALID_CASSETTE', 'Universal registry must contain 12 frozen Bibles');
  integrity(realEstate.bibles.length === 16, 'INVALID_CASSETTE', 'Real Estate cassette must contain 16 frozen Bibles');
  integrity(libraryRegistry.total_bible_count === 28, 'INVALID_CASSETTE', 'Library registry must declare 28 Bibles');
  return Object.freeze({
    library_root: resolvedRoot,
    library_registry: libraryRegistry,
    freeze_manifest: manifest,
    universal_registry: universal.registry,
    real_estate_registry: realEstate.registry,
    universal_bibles: universal.bibles,
    real_estate_bibles: realEstate.bibles,
    universal_interactions: readJson(path.join(resolvedRoot, 'cross-authority-interactions/UNIVERSAL_CROSS_AUTHORITY_INTERACTION_REGISTRY_V1.json')),
    real_estate_interactions: readJson(path.join(resolvedRoot, 'cross-authority-interactions/REAL_ESTATE_CROSS_CASSETTE_INTERACTION_REGISTRY_V1.json')),
    router_metadata: readJson(path.join(resolvedRoot, 'routing-metadata/BA_AUTHORITY_ROUTER_METADATA_V1.json')),
    team_socket: readJson(path.join(resolvedRoot, 'team-socket/TEAM_MULTI_PERSON_SOCKET_CONTRACT_V1.json')),
    five_futures_metadata: readJson(path.join(resolvedRoot, 'five-futures-hooks/FIVE_FUTURES_STATE_CONTRIBUTION_CONTRACT_V1.json')),
    dynamic_research: readJson(path.join(resolvedRoot, 'dynamic-research-hooks/DYNAMIC_RESEARCH_HOOK_REGISTRY_V1.json')),
  });
}

export function getAuthority(library, authorityId) {
  const authority = [...library.universal_bibles, ...library.real_estate_bibles]
    .find((candidate) => candidate.authority_id === authorityId);
  integrity(authority, 'BROKEN_AUTHORITY_HASH', `Unknown frozen authority ${authorityId}`);
  return authority;
}

export function selectAuthoritySections(authority, requestedTitles = DEFAULT_AUTHORITY_SECTIONS) {
  const normalized = new Set(requestedTitles.map(normalizeSectionTitle));
  const selected = authority.sections.filter((section) => normalized.has(section.normalized_title));
  integrity(selected.length > 0, 'MALFORMED_STATE', `No governed sections selected for ${authority.authority_id}`);
  return selected.map((section) => ({
    section_id: `${authority.authority_id}:${section.normalized_title.replace(/[^a-z0-9]+/gu, '_')}`,
    title: section.title,
    content: section.markdown,
  }));
}
