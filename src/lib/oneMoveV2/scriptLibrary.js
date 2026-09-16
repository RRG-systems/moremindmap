import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { isSha256, sha256 } from '../wholeBusinessModelV1/canonical.js';
import { SCRIPT_ROUTE_BY_DOMAIN } from './constants.js';
import { integrity } from './errors.js';

const DEFAULT_LIBRARY_ROOT = path.resolve(process.cwd(), 'docs/ba-intelligence-authority-library-v1');
const REGISTRY_PATH = 'registries/REAL_ESTATE_SCRIPT_REGISTRY_V1.json';
const LIBRARY_PATH = 'script-conversation-library/REAL_ESTATE_SCRIPT_AND_CONVERSATION_LIBRARY_V1.md';

function parseScripts(markdown) {
  const matches = [...markdown.matchAll(/^##\s+(SC-\d{2})\s+—\s+(.+)$/gmu)];
  return matches.map((match, index) => ({
    script_id: match[1],
    title: match[2].trim(),
    content: markdown.slice(match.index + match[0].length, matches[index + 1]?.index ?? markdown.length).trim(),
  }));
}

export function loadFrozenScriptIntelligence({ libraryRoot = DEFAULT_LIBRARY_ROOT } = {}) {
  const root = path.resolve(libraryRoot);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'freeze/BA_INTELLIGENCE_AUTHORITY_LIBRARY_MANIFEST_V1.json'), 'utf8'));
  const registryRecord = manifest.artifacts_excluding_self.find((item) => item.path === REGISTRY_PATH);
  const libraryRecord = manifest.artifacts_excluding_self.find((item) => item.path === LIBRARY_PATH);
  integrity(registryRecord && libraryRecord, 'AUTHORITY_CORRUPTION', 'Frozen script manifest entries are missing');
  const registryBytes = fs.readFileSync(path.join(root, REGISTRY_PATH));
  const libraryBytes = fs.readFileSync(path.join(root, LIBRARY_PATH));
  integrity(sha256(registryBytes) === registryRecord.sha256 && registryBytes.length === registryRecord.bytes, 'AUTHORITY_CORRUPTION', 'Script registry drifted');
  integrity(sha256(libraryBytes) === libraryRecord.sha256 && libraryBytes.length === libraryRecord.bytes, 'AUTHORITY_CORRUPTION', 'Script library drifted');
  const registry = JSON.parse(registryBytes.toString('utf8'));
  const parsed = parseScripts(libraryBytes.toString('utf8'));
  integrity(registry.status === 'FROZEN_GOVERNED_RESOURCE_V1' && registry.count === 31, 'AUTHORITY_CORRUPTION', 'Script registry is not frozen or complete');
  integrity(parsed.length === registry.count, 'AUTHORITY_CORRUPTION', 'Script content count does not match registry');
  const metadata = new Map(registry.scripts.map((item) => [item.script_id, item]));
  return Object.freeze({
    registry_hash: registryRecord.sha256,
    library_hash: libraryRecord.sha256,
    scripts: Object.freeze(parsed.map((script) => Object.freeze({ ...metadata.get(script.script_id), ...script }))),
  });
}

// A missing vertical-owned catalog is an explicit source limitation. Its source
// root is real custody; null script hashes do not pretend a catalog was loaded.
export function bindScopedScriptAbsence(selection, library, vertical) {
  integrity(selection?.contract_id === 'one-move-cassette-script-selection-v1'
    && selection.mode === 'NO_APPROVED_SCRIPT_LIBRARY', 'AUTHORITY_CORRUPTION', 'Explicit scoped script absence is required');
  integrity(selection.vertical_id === vertical && library.vertical_id === vertical,
    'AUTHORITY_CORRUPTION', 'Script selection belongs to a different vertical');
  integrity(isSha256(selection.authority_root_hash)
    && selection.authority_root_hash === library.vertical_authority_root_sha256,
  'AUTHORITY_CORRUPTION', 'Script absence must bind the supplied vertical authority root');
  integrity(typeof selection.reason === 'string' && selection.reason.trim().length > 0,
    'AUTHORITY_CORRUPTION', 'Script absence requires an explicit reason');
  integrity(Object.keys(selection).sort().join('|') === [
    'authority_root_hash', 'contract_id', 'mode', 'reason', 'vertical_id',
  ].sort().join('|'), 'AUTHORITY_CORRUPTION', 'Script absence may not conceal catalog contents or routing');
  return Object.freeze({ registry_hash: null, library_hash: null, scripts: Object.freeze([]),
    selection: Object.freeze({ ...selection }) });
}

function routeIds(context) {
  const mechanism = context.wbm.causal_model.mechanisms[0];
  const route = mechanism.affected_domains.flatMap((domain) => SCRIPT_ROUTE_BY_DOMAIN[domain] || []);
  const text = `${mechanism.observed_symptom} ${mechanism.underlying_mechanism}`.toLowerCase();
  if (text.includes('open house')) route.unshift('SC-05', 'SC-07');
  if (text.includes('farm')) route.unshift('SC-08', 'SC-09', 'SC-10');
  if (text.includes('dead database') || text.includes('relationship continuity')) route.unshift('SC-02', 'SC-04');
  if (text.includes('paid') || text.includes('internet lead')) route.unshift('SC-26', 'SC-16', 'SC-27');
  if (text.includes('succession') || text.includes('book')) route.unshift('SC-30', 'SC-01');
  return [...new Set(route)];
}

export function selectRelevantScriptIntelligence(context, library, limit = 3) {
  const ids = routeIds(context).slice(0, limit);
  return ids.map((scriptId) => {
    const script = library.scripts.find((item) => item.script_id === scriptId);
    integrity(script, 'AUTHORITY_CORRUPTION', `Unknown governed script ${scriptId}`);
    return Object.freeze({ ...script, use: 'ADAPTABLE_RESOURCE_NOT_MANDATORY_WORDING' });
  });
}
