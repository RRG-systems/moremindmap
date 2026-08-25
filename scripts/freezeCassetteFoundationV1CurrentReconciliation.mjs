import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildCustomerConfirmedVerticalBinding,
} from '../api/business-assessment/verticalBinding.js';
import {
  buildNewBaRealizationIdentity,
  buildNewBaRealizationIdentityV3,
} from '../api/engine/newBaProductionReadinessV1/realizationIdentity.js';
import {
  PRODUCTION_BA_CASSETTE_REGISTRY,
  REAL_ESTATE_BOX_1_PROJECTION_CONTRACT,
  REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_SHA256,
  REAL_ESTATE_CASSETTE_REGISTRATION,
  REAL_ESTATE_EVIDENCE_CONTRACT_ID,
  REAL_ESTATE_EVIDENCE_CONTRACT_SHA256,
  REAL_ESTATE_EVIDENCE_CONTRACT_VERSION,
  REAL_ESTATE_EVIDENCE_SUFFICIENCY_MISSIONS,
  REAL_ESTATE_INTAKE_CONTRACT_ID,
  REAL_ESTATE_INTAKE_CONTRACT_SHA256,
  REAL_ESTATE_INTAKE_CONTRACT_VERSION,
  REAL_ESTATE_INTAKE_QUESTIONS,
  REAL_ESTATE_QUESTION_AUTHORITY,
  buildCustomerConfirmedSelection,
  stableCanonicalize,
} from '../src/lib/baVerticalCassettesV1/index.js';

const REQUIRED_BASELINE = 'ce34ffd7ffb591f78938fd7a1ca6883f8152cff2';
const REQUIRED_BRANCH = 'codex/lo-cassette-v1';
const FROZEN_AT = '2026-08-24T18:38:06.000Z';
const ROOT = fileURLToPath(new URL('../', import.meta.url));

const CASSETTE_MANIFEST_PATH =
  'docs/ba-intelligence-authority-library-v1/freeze/REAL_ESTATE_CASSETTE_MANIFEST_V1.json';
const CASSETTE_REGISTRY_PATH =
  'docs/ba-intelligence-authority-library-v1/registries/REAL_ESTATE_CASSETTE_REGISTRY_V1.json';

const RECONCILED_SOURCE_FILES = Object.freeze([
  'api/business-assessment/start.js',
  'api/business-assessment/verticalBinding.js',
  'api/engine/newBaProductionReadinessV1/canonicalReader.js',
  'api/engine/newBaProductionReadinessV1/compatibilitySelection.js',
  'api/engine/newBaProductionReadinessV1/evidenceSufficiency.js',
  'api/engine/newBaProductionReadinessV1/launchSafeRealizationStore.js',
  'api/engine/newBaProductionReadinessV1/modernizationService.js',
  'api/engine/newBaProductionReadinessV1/projectionDispatch.js',
  'api/engine/newBaProductionReadinessV1/realProfileGeneration.js',
  'api/engine/newBaProductionReadinessV1/realProfileGenerationCampaign.js',
  'api/engine/newBaProductionReadinessV1/realProfileRealizationFactory.js',
  'api/engine/newBaProductionReadinessV1/realizationIdentity.js',
  'scripts/cassetteFoundationV1SyntheticQaServer.mjs',
  'scripts/freezeCassetteFoundationV1CurrentReconciliation.mjs',
  'src/BusinessAssessment.jsx',
  'src/lib/baVerticalCassettesV1/contracts.js',
  'src/lib/baVerticalCassettesV1/index.js',
  'src/lib/baVerticalCassettesV1/realEstateCassette.js',
  'src/lib/baVerticalCassettesV1/registry.js',
  'src/lib/baVerticalCassettesV1/subscriptionAdapter.js',
  'src/lib/wholeBusinessModelV1/authorityLibrary.js',
  'src/lib/wholeBusinessModelV1/constants.js',
  'src/lib/wholeBusinessModelV1/contextAssembler.js',
  'src/lib/wholeBusinessModelV1/inputContracts.js',
  'src/lib/wholeBusinessModelV1/orchestrator.js',
  'test/cassetteFoundationV1.test.js',
  'test/fixtures/wholeBusinessModelV1SyntheticFixtures.js',
  'test/newBaPatriciaRetrievalRepair.test.js',
]);

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256Stable(value) {
  return sha256Bytes(stableCanonicalize(value));
}

function hashFile(relativePath) {
  return sha256Bytes(fs.readFileSync(new URL(`../${relativePath}`, import.meta.url)));
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}_mismatch:${actual}:${expected}`);
  }
}

const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
assertEqual(branch, REQUIRED_BRANCH, 'branch');
assertEqual(baseline, REQUIRED_BASELINE, 'baseline');

const intakePayload = {
  contract_id: REAL_ESTATE_INTAKE_CONTRACT_ID,
  version: REAL_ESTATE_INTAKE_CONTRACT_VERSION,
  questions: REAL_ESTATE_INTAKE_QUESTIONS,
  assessment_type_strategy: 'real-estate-team-q11-v1',
  team_profile_question_key: 'q11',
  financial_text_question_key: 'q9',
};
const evidencePayload = {
  contract_id: REAL_ESTATE_EVIDENCE_CONTRACT_ID,
  version: REAL_ESTATE_EVIDENCE_CONTRACT_VERSION,
  question_authority: REAL_ESTATE_QUESTION_AUTHORITY,
  sufficiency_missions: REAL_ESTATE_EVIDENCE_SUFFICIENCY_MISSIONS,
};

const authorityHashes = Object.freeze({
  cassette_manifest_file_sha256: hashFile(CASSETTE_MANIFEST_PATH),
  cassette_registry_file_sha256: hashFile(CASSETTE_REGISTRY_PATH),
  intake_contract_sha256: sha256Stable(intakePayload),
  evidence_contract_sha256: sha256Stable(evidencePayload),
  box_1_projection_contract_sha256: sha256Stable(REAL_ESTATE_BOX_1_PROJECTION_CONTRACT),
  reconciled_cassette_registration_sha256: sha256Stable(REAL_ESTATE_CASSETTE_REGISTRATION),
  reconciled_production_registry_sha256: sha256Stable(PRODUCTION_BA_CASSETTE_REGISTRY.listSupported()),
});

assertEqual(
  authorityHashes.cassette_manifest_file_sha256,
  REAL_ESTATE_CASSETTE_REGISTRATION.cassette_manifest_sha256,
  'cassette_manifest_file_sha256',
);
assertEqual(
  authorityHashes.cassette_registry_file_sha256,
  REAL_ESTATE_CASSETTE_REGISTRATION.cassette_registry_sha256,
  'cassette_registry_file_sha256',
);
assertEqual(authorityHashes.intake_contract_sha256, REAL_ESTATE_INTAKE_CONTRACT_SHA256, 'intake_contract_sha256');
assertEqual(authorityHashes.evidence_contract_sha256, REAL_ESTATE_EVIDENCE_CONTRACT_SHA256, 'evidence_contract_sha256');
assertEqual(
  authorityHashes.box_1_projection_contract_sha256,
  REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_SHA256,
  'box_1_projection_contract_sha256',
);

const confirmedSelection = buildCustomerConfirmedSelection(REAL_ESTATE_CASSETTE_REGISTRATION);
const verticalBinding = buildCustomerConfirmedVerticalBinding({
  selection: confirmedSelection,
  selectedAt: FROZEN_AT,
});
const identityInput = {
  profileId: 'MM-20260824-CASS0001',
  assessmentId: 'ba-20260824-ca55e771',
  evidenceSha256: '1'.repeat(64),
  bosAuthoritySha256: '2'.repeat(64),
  bosFusionContractSha256: '3'.repeat(64),
  bosEvidenceBoundarySha256: '4'.repeat(64),
  compatibilityClass: 'A',
};
const legacyV2Identity = buildNewBaRealizationIdentity(identityInput);
const reconciledV3Identity = buildNewBaRealizationIdentityV3({
  ...identityInput,
  verticalBinding,
});

const sourceFiles = Object.fromEntries(
  RECONCILED_SOURCE_FILES.map((relativePath) => [relativePath, hashFile(relativePath)]),
);

const freezePayload = {
  freeze_contract: 'cassette-foundation-v1-current-production-reconciliation-freeze-v1',
  frozen_at: FROZEN_AT,
  worktree: ROOT.replace(/\/$/u, ''),
  branch,
  required_baseline: baseline,
  production_deployment_checkpoint: 'dpl_7wTwFmVKymwKWawRckf9rToZCToz',
  customer_contract_ids: {
    intake: REAL_ESTATE_INTAKE_CONTRACT_ID,
    evidence: REAL_ESTATE_EVIDENCE_CONTRACT_ID,
    box_1_projection: REAL_ESTATE_BOX_1_PROJECTION_CONTRACT.contract_id,
  },
  authority_hashes: authorityHashes,
  deterministic_binding: {
    selected_at: FROZEN_AT,
    selection_sha256: sha256Stable(confirmedSelection),
    binding_sha256: verticalBinding.binding_sha256,
  },
  deterministic_realization: {
    identity_input: identityInput,
    accepted_legacy_v2_version: legacyV2Identity.version,
    accepted_legacy_v2_sha256: legacyV2Identity.sha256,
    current_v3_version: reconciledV3Identity.version,
    current_v3_sha256: reconciledV3Identity.sha256,
    current_v3_realization_id: reconciledV3Identity.realization_id,
  },
  reconciled_source_files_sha256: sourceFiles,
  reconciled_source_tree_sha256: sha256Stable(sourceFiles),
};

const receipt = {
  ...freezePayload,
  freeze_payload_sha256: sha256Stable(freezePayload),
};

process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
