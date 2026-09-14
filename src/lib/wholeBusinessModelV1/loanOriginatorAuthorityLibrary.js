import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import { sha256 } from './canonical.js';
import { integrity } from './errors.js';
import { parseBibleSections } from './authorityLibrary.js';
const DEFAULT_LO_AUTHORITY_ROOT = fileURLToPath(new URL('../../../docs/lo-cassette-2-final-canonical-authority-v1', import.meta.url));
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }

const LO_AUTHORITY_ROOT_SHA256 = '1d1b5b04705e453716bcd4fbc73ab080f1c4981570ec6df7026b4d0c4b09cc8d';
const LO_MODULE_SOURCE_PATHS = Object.freeze({
  'loan-originator-intelligence-module-business-machine-v1': Object.freeze([
    '02_CANONICAL_LO_PRODUCT_DOCTRINE_V1.md',
    '03_CANONICAL_LO_INTAKE_QUESTION_CONTRACT_V1.md',
    '06_CANONICAL_LO_TERMINOLOGY_REGISTRY_V1.md',
    '07_CANONICAL_LO_EVENT_OBSERVATION_WINDOW_REGISTRY_V1.md',
    '08_CANONICAL_LO_OSN_CRN_CONTRACT_V1.md',
    '10_CANONICAL_LO_GOAL_BACKSOLVE_ECONOMICS_CONTRACT_V1.md',
  ]),
  'loan-originator-intelligence-module-systems-capacity-constraints-v1': Object.freeze([
    '09_CANONICAL_LO_SYSTEMS_MEASUREMENT_CONTRACT_V1.md',
    '11_CANONICAL_LO_SUFFICIENCY_CONSTRAINT_CONTRACT_V1.md',
    '12_CANONICAL_LO_FOUNDER_ONE_MOVE_CONTRACT_V1.md',
    '15_CANONICAL_LO_DURABLE_AUTHORITY_MODULE_BINDINGS_V1.md',
  ]),
  'loan-originator-intelligence-module-context-boundaries-evidence-v1': Object.freeze([
    '13_CANONICAL_LO_EVIDENCE_TRUTH_CONTRACT_V1.md',
    '18_CANONICAL_LO_PRIVACY_COMPLIANCE_SCOPE_BOUNDARY_V1.md',
    '19_CANONICAL_LO_DOMAIN_EXPERT_UPDATE_ENVELOPE_V1.md',
  ]),
  'loan-originator-intelligence-module-translation-coaching-v1': Object.freeze([
    '14_CANONICAL_LO_BOX_1_PROJECTION_CONTRACT_V1.md',
    '16_CANONICAL_UNIVERSAL_COACHING_TO_LO_TRANSLATION_V1.md',
    '17_CANONICAL_LO_DOWNSTREAM_PROJECTION_CONTRACT_V1.md',
  ]),
});

// Bounded, source-addressable extraction from the frozen documents. Each entry is
// an existing canonical H2 section; no rewritten doctrine or merged course text.
const LO_SECTION_TITLES = Object.freeze({
  '02': ['Governing time doctrine'],
  '03': ['Shared semantics'],
  '06': ['Customer-facing terms', 'Purpose and funnel terms'],
  '07': ['Metric envelope', 'Cohort rules'],
  '08': ['Two distinct governed objects', 'Control and authority rules'],
  '10': ['Calculation doctrine', 'Canonical formulas', 'Feasibility gates'],
  '09': ['Minimum measured-system record', 'Truth and projection'],
  '11': ['Four communication states', 'Primary constraint decision', 'Causality discipline'],
  '12': ['Selection contract', 'State-specific behavior'],
  '15': ['Locked domains', 'Authority-layer order', 'Canonical content-unit contract'],
  '13': ['Field-level truth envelope', 'Evidence classes', 'Question/applicability states', 'Contradiction protocol', 'Missingness behavior', 'External/current evidence'],
  '18': ['Contact/use/servicing/recapture boundary', 'Business-funnel versus underwriting', 'External/current reality'],
  '19': ['Current authority state', 'Authority-update gate'],
  '14': ['Shared projection envelope'],
  '16': ['Universal coaching intelligence', 'Universal principles requiring LO translation', 'Portable optional heuristics', 'BOS/Fusion boundary', 'Free-the-GPT boundary'],
  '17': ['Canonical LO evidence packet', 'Consumer-by-consumer contract', 'Projection properties'],
});

function verifyLoanOriginatorAuthorityRoot(loAuthorityRoot) {
  const resolvedRoot = path.resolve(loAuthorityRoot);
  const root = readJson(path.join(resolvedRoot, '24_CANONICAL_AUTHORITY_ROOT_V1.json'));
  integrity(root.root_authority_sha256 === LO_AUTHORITY_ROOT_SHA256, 'BROKEN_AUTHORITY_HASH', 'Loan Originator authority root mismatch');
  const dependencyPath = path.join(resolvedRoot, root.root_basis_file);
  const dependencyBytes = fs.readFileSync(dependencyPath);
  integrity(sha256(dependencyBytes) === LO_AUTHORITY_ROOT_SHA256, 'BROKEN_AUTHORITY_HASH', 'Loan Originator dependency manifest hash mismatch');
  const manifest = JSON.parse(dependencyBytes.toString('utf8'));
  const records = new Map(manifest.artifacts.map((record) => [record.path, record]));
  for (const record of records.values()) {
    const artifactPath = path.resolve(resolvedRoot, record.path);
    integrity(artifactPath.startsWith(`${resolvedRoot}${path.sep}`), 'BROKEN_AUTHORITY_HASH', 'Loan Originator authority path escaped root');
    const bytes = fs.readFileSync(artifactPath);
    integrity(bytes.length === record.bytes && sha256(bytes) === record.sha256, 'BROKEN_AUTHORITY_HASH', `Loan Originator authority drifted: ${record.path}`);
  }
  return { resolvedRoot, root, manifest, records };
}

function loadLoanOriginatorAuthorityModules(loAuthorityRoot = DEFAULT_LO_AUTHORITY_ROOT) {
  const verified = verifyLoanOriginatorAuthorityRoot(loAuthorityRoot);
  const modules = Object.entries(LO_MODULE_SOURCE_PATHS).map(([authorityId, sourcePaths]) => {
    const sourceRecords = sourcePaths.map((sourcePath) => {
      const record = verified.records.get(sourcePath);
      integrity(record, 'BROKEN_AUTHORITY_HASH', `Loan Originator module source missing from manifest: ${sourcePath}`);
      const markdown = fs.readFileSync(path.join(verified.resolvedRoot, sourcePath), 'utf8');
      return { ...record, markdown };
    });
    const sections = sourceRecords.flatMap((record) => {
      const available = parseBibleSections(record.markdown);
      return LO_SECTION_TITLES[record.path.slice(0, 2)].map(title => {
        const section = available.find(item => item.title === title);
        integrity(section, 'BROKEN_AUTHORITY_HASH', `Missing canonical LO section: ${record.path}#${title}`);
        return Object.freeze({ ...section, source_path: record.path, source_sha256: record.sha256,
          section_sha256: sha256(Buffer.from(section.markdown)) });
      });
    });
    integrity(sections.length <= 11, 'MALFORMED_STATE', 'LO authority packet exceeds unchanged section budget');
    const selectionManifest = sections.map(section => ({ source_path: section.source_path,
      source_sha256: section.source_sha256, title: section.title, section_sha256: section.section_sha256 }));
    const moduleSha256 = sha256(Buffer.from(sourceRecords.map((record) => `${record.path}:${record.sha256}`).join('\n')));
    return Object.freeze({
      authority_id: authorityId,
      title: authorityId
        .replace('loan-originator-intelligence-module-', '')
        .replace('-v1', '')
        .split('-')
        .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
        .join(' '),
      version: '1.0.0',
      sha256: moduleSha256,
      bytes: sourceRecords.reduce((sum, item) => sum + item.bytes, 0),
      sections,
      section_selection_mode: 'BOUNDED_CANONICAL_SOURCE_SECTIONS_V1',
      section_selection_sha256: sha256(Buffer.from(JSON.stringify(selectionManifest))),
      section_selection_manifest: Object.freeze(selectionManifest),
      authority_root_sha256: verified.root.root_authority_sha256,
      source_artifacts: Object.freeze(sourceRecords.map(({ path: sourcePath, sha256: sourceSha256, bytes }) => Object.freeze({ path: sourcePath, sha256: sourceSha256, bytes }))),
    });
  });
  return Object.freeze({
    root: verified.root,
    modules: Object.freeze(modules),
    interactions: Object.freeze({
      registry_id: 'loan-originator-cross-authority-interactions-v1',
      interactions: Object.freeze([]),
    }),
  });
}

export function bindFrozenLoanOriginatorAuthorityLibrary(library, registration, {
  loAuthorityRoot = DEFAULT_LO_AUTHORITY_ROOT,
} = {}) {
  if (registration?.vertical_id !== 'loan_originator') return library;
  const loanOriginator = loadLoanOriginatorAuthorityModules(loAuthorityRoot);
  const allowed = new Set(registration.wbm_authority.route.allowed_authority_ids || []);
  integrity(loanOriginator.modules.length === allowed.size, 'INVALID_CASSETTE', 'Loan Originator authority module count mismatch');
  integrity(loanOriginator.modules.every((module) => allowed.has(module.authority_id)), 'INVALID_CASSETTE', 'Loan Originator authority registry mismatch');
  return Object.freeze({
    ...library,
    vertical_id: 'loan_originator',
    real_estate_registry: null, real_estate_bibles: Object.freeze([]),
    real_estate_interactions: Object.freeze({ interactions: Object.freeze([]) }),
    vertical_registry: Object.freeze({
      authority_class: 'LOAN_ORIGINATOR_VERTICAL',
      cassette_id: registration.cassette_id,
      expected_count: loanOriginator.modules.length,
      authority_root_sha256: loanOriginator.root.root_authority_sha256,
    }),
    vertical_bibles: loanOriginator.modules,
    vertical_interactions: loanOriginator.interactions,
    vertical_authority_root_sha256: loanOriginator.root.root_authority_sha256,
  });
}

