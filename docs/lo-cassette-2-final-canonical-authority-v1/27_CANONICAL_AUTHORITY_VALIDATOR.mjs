import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const positional = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
const summaryOnly = process.argv.includes('--summary');
const root = path.resolve(positional[0] || process.cwd());
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const json = (name) => JSON.parse(read(name));
const sha = (name) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const checks = [];
const check = (name, ok, detail) => checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });

const exactSurfaces = [
  'Your Business Now',
  'Where Your Business Comes From',
  'Your Business Pipeline',
  'Your System & Capacity',
  'What’s Holding You Back'
];

const questions = read('03_CANONICAL_LO_INTAKE_QUESTION_CONTRACT_V1.md');
const fields = json('04_CANONICAL_LO_TYPED_ANSWER_EVIDENCE_REGISTRY_V1.json');
const branches = json('05_CANONICAL_LO_BRANCHING_APPLICABILITY_SKIP_CONTRACT_V1.json');
const events = read('07_CANONICAL_LO_EVENT_OBSERVATION_WINDOW_REGISTRY_V1.md');
const osnCrn = read('08_CANONICAL_LO_OSN_CRN_CONTRACT_V1.md');
const sufficiency = read('11_CANONICAL_LO_SUFFICIENCY_CONSTRAINT_CONTRACT_V1.md');
const oneMove = read('12_CANONICAL_LO_FOUNDER_ONE_MOVE_CONTRACT_V1.md');
const box1 = read('14_CANONICAL_LO_BOX_1_PROJECTION_CONTRACT_V1.md');
const modules = read('15_CANONICAL_LO_DURABLE_AUTHORITY_MODULE_BINDINGS_V1.md');
const downstream = read('17_CANONICAL_LO_DOWNSTREAM_PROJECTION_CONTRACT_V1.md');
const privacy = read('18_CANONICAL_LO_PRIVACY_COMPLIANCE_SCOPE_BOUNDARY_V1.md');
const darren = read('19_CANONICAL_LO_DOMAIN_EXPERT_UPDATE_ENVELOPE_V1.md');
const replay = json('20_CANONICAL_LO_SYNTHETIC_ACCEPTANCE_REGISTRY_V1.json');
const box1Proof = json('21_CANONICAL_LO_BOX_1_SYNTHETIC_PROJECTION_PROOF_V1.json');
const ids = json('22_CANONICAL_AUTHORITY_ID_REGISTRY_V1.json');

const mission = [...questions.matchAll(/\*\*Canonical mission ID:\*\*\s*`([^`]+)`/g)].map((m) => m[1]);
const wording = [...questions.matchAll(/\*\*Customer question:\*\*\s*\n\*\*([^\n]+)\*\*/g)].map((m) => m[1].trim());
const fieldRows = fields.screens.flatMap((screen) => screen.fields.map((field) => ({ screen: screen.id, ...field })));
const fieldIds = fieldRows.map((field) => field.id);
const architectureBytes = JSON.stringify({
  mission,
  words: wording,
  screens: fields.screens.map((screen) => ({ id: screen.id, kind: screen.kind, fields: screen.fields })),
  core_order: branches.fresh_producing_path.core_order,
  conditional_order: branches.fresh_producing_path.conditional_order,
  fresh_max: branches.fresh_producing_path.maximum_questions,
  hard: branches.hard_customer_facing_ceiling
});
const questionFingerprint = crypto.createHash('sha256').update(architectureBytes).digest('hex');
const expectedFingerprint = 'a01b65214f47b5bc999ea1312618ef53cec277b48deda34ce7bf5f3df69b8207';
const allIds = [
  ids.cassette_id,
  ids.authority_package_id,
  ids.dependency_manifest_id,
  ...Object.values(ids.contracts),
  ...Object.values(ids.durable_modules),
  ...ids.mission_ids.core,
  ...ids.mission_ids.conditional,
  ...ids.event_ids
];
const headings = [...box1.matchAll(/^## Surface \d+ — (.+)$/gm)].map((m) => m[1]);
const constraints = [
  'Opportunity Supply',
  'Relationship Activation',
  'Conversion',
  'Pull-Through / Fallout',
  'Execution / Systems',
  'Capacity / Leverage',
  'Platform / Capability',
  'Economics / Business Model'
];
const requiredMetadata = ['provenance', 'confidence', 'applicability', 'definition_id', 'period_or_not_temporal', 'subject_scope', 'captured_at', 'contradiction_links', 'missing_reason'];
const evidenceClasses = ['OBSERVED', 'DERIVED', 'MODELED_REQUIREMENT', 'BENCHMARK', 'SCENARIO', 'MISSING'];

check('canonical_id_registry', allIds.length === new Set(allIds).size && allIds.every((id) => !id.includes('-candidate')), { count: allIds.length, unique: new Set(allIds).size });
check('exact_question_architecture', mission.length === 15 && wording.length === 15 && questionFingerprint === expectedFingerprint, { missions: mission.length, questions: wording.length, sha256: questionFingerprint });
check('exact_core_conditional_order', JSON.stringify(mission.slice(0, 12)) === JSON.stringify(ids.mission_ids.core) && JSON.stringify(branches.fresh_producing_path.conditional_order) === JSON.stringify(ids.mission_ids.conditional), { core: ids.mission_ids.core.length, conditional: ids.mission_ids.conditional.length });
check('typed_field_registry', fields.status === 'CANONICAL_AUTHORITY_FROZEN' && fields.contract_id === ids.contracts.governed_evidence_schema && fields.screens.length === 15 && fieldRows.length === 145 && new Set(fieldIds).size === 145, { screens: fields.screens.length, fields: fieldRows.length });
check('truth_envelope', JSON.stringify(fields.field_contract.required_metadata) === JSON.stringify(requiredMetadata) && JSON.stringify(fields.field_contract.evidence_classes) === JSON.stringify(evidenceClasses) && JSON.stringify(fields.field_contract.question_states) === JSON.stringify(['ANSWERED','UNANSWERED','NOT_APPLICABLE']), fields.field_contract);
check('branching_contract', branches.status === 'CANONICAL_AUTHORITY_FROZEN' && branches.contract_id === ids.contracts.evidence_routing && branches.fresh_producing_path.maximum_questions === 15 && branches.hard_customer_facing_ceiling === 20 && branches.conditional_triggers.LO_COND_15_CONTRADICTION_CLARIFICATION.attempt_limit === 1, { fresh_max: branches.fresh_producing_path.maximum_questions, hard: branches.hard_customer_facing_ceiling });
check('period_and_event_rules', events.includes('TRAILING_12_MONTHS') && events.includes('TRAILING_90_DAYS') && ids.event_ids.every((id) => events.includes(id)), ids.event_ids);
check('osn_crn_separation', osnCrn.includes('Two distinct governed objects') && osnCrn.includes('When a past customer refers another person') && osnCrn.includes('the relationship provenance remains `CRN`'), true);
check('four_sufficiency_states', ['Opportunity Gap','Opportunity Sufficient / Other Constraint','On Track','Insufficient Evidence'].every((state) => sufficiency.includes(state)) && replay.all_four_sufficiency_states === true, true);
check('eight_constraint_families', constraints.every((family) => sufficiency.includes(family)) && replay.all_eight_constraint_families === true, constraints);
check('founder_one_move_exact', oneMove.includes('What can the person do **right now** that is most likely to create the greatest positive downstream effects taking them toward a better future?') && oneMove.includes('It is not inherently repair'), true);
check('exact_box1_surfaces', JSON.stringify(headings) === JSON.stringify(exactSurfaces) && JSON.stringify(box1Proof.locked_visible_surfaces) === JSON.stringify(exactSurfaces), headings);
check('synthetic_acceptance', replay.contract_id === ids.contracts.synthetic_acceptance && replay.source_suite_cases === 10 && replay.executed_paths === 11 && replay.paths.length === 11 && replay.result === 'PASS', { cases: replay.source_suite_cases, paths: replay.executed_paths });
check('box1_all_paths', box1Proof.path_surface_coverage.length === 11 && box1Proof.path_surface_coverage.every((entry) => JSON.stringify(Object.keys(entry.surfaces)) === JSON.stringify(exactSurfaces)) && box1Proof.result === 'PASS', { paths: box1Proof.path_surface_coverage.length });
check('durable_domains_and_modules', [...modules.matchAll(/^\d+\. \*\*/gm)].length === 16 && Object.values(ids.durable_modules).every((id) => modules.includes(id)), { domains: 16, modules: Object.values(ids.durable_modules) });
check('downstream_single_truth', downstream.includes('one Business Twin/WBM') && downstream.includes('No second LO WBM') && downstream.includes('No LO-specific session runtime') && downstream.includes(ids.contracts.whole_business_route) && downstream.includes(ids.contracts.subscription_context), true);
check('privacy_scope', privacy.includes('aggregate business') && privacy.includes('borrower/customer names') && privacy.includes('protected-class data/inference') && privacy.includes('individualized rate/product/loan recommendations'), true);
check('darren_update_seam', darren.includes(ids.contracts.domain_expert_update_envelope) && darren.includes('No claim silently overwrites frozen authority'), true);
check('protected_flags', replay.no_real_estate_leakage === true && replay.no_borrower_pii_underwriting_protected_class_requirement === true && replay.no_recruiting_contamination === true && replay.no_second_truth_store_or_coaching_engine === true, true);

if (fs.existsSync(path.join(root, '23_AUTHORITY_DEPENDENCY_MANIFEST_V1.json'))) {
  const deps = json('23_AUTHORITY_DEPENDENCY_MANIFEST_V1.json');
  const bad = deps.artifacts.filter((entry) => sha(entry.path) !== entry.sha256);
  check('dependency_manifest_replay', deps.manifest_id === ids.dependency_manifest_id && bad.length === 0, { entries: deps.artifacts.length, bad: bad.map((entry) => entry.path) });
}

if (fs.existsSync(path.join(root, '24_CANONICAL_AUTHORITY_ROOT_V1.json'))) {
  const authorityRoot = json('24_CANONICAL_AUTHORITY_ROOT_V1.json');
  check('root_authority_hash', authorityRoot.root_authority_sha256 === sha(authorityRoot.root_basis_file), authorityRoot);
}

if (fs.existsSync(path.join(root, 'EVIDENCE_MANIFEST.json'))) {
  const manifest = json('EVIDENCE_MANIFEST.json');
  const bad = manifest.artifacts.filter((entry) => sha(entry.path) !== entry.sha256 || fs.statSync(path.join(root, entry.path)).size !== entry.bytes);
  check('evidence_manifest_replay', bad.length === 0 && manifest.artifacts.length === manifest.substantive_artifact_count, { entries: manifest.artifacts.length, bad: bad.map((entry) => entry.path) });
}

const failures = checks.filter((entry) => entry.status === 'FAIL');
const result = {
  schema_version: '1.0.0',
  authority_package_id: ids.authority_package_id,
  result: failures.length === 0 ? 'PASS' : 'FAIL',
  check_count: checks.length,
  pass_count: checks.length - failures.length,
  fail_count: failures.length,
  question_architecture_fingerprint: questionFingerprint,
  structured_field_count: fieldRows.length,
  checks
};

console.log(JSON.stringify(summaryOnly ? {
  authority_package_id: result.authority_package_id,
  result: result.result,
  check_count: result.check_count,
  pass_count: result.pass_count,
  fail_count: result.fail_count,
  question_architecture_fingerprint: result.question_architecture_fingerprint,
  structured_field_count: result.structured_field_count,
  failures
} : result, null, 2));
process.exitCode = failures.length === 0 ? 0 : 1;
