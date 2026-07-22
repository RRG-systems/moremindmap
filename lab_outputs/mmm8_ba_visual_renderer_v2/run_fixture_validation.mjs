/**
 * Focused fixture validation for MMM8 BA Visual Renderer V2.
 * Run: node lab_outputs/mmm8_ba_visual_renderer_v2/run_fixture_validation.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const bridgeOut = join(
  root,
  '../moremindmap-agent-bridge/lab_outputs/mmm8_ba_visual_renderer_v2'
);

const { normalizeBusinessVisualArtifactData } = await import(
  pathToFileURL(join(root, 'src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js')).href
);
const {
  validateBusinessEngineContract,
  projectBusinessEngineVisualV2,
  CONTRACT_VERSION,
} = await import(pathToFileURL(join(root, 'src/lib/businessEngine/index.js')).href);

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

function findAssessment(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.output && (obj.output.business_intelligence_draft || obj.output.five_futures_v1)) return obj;
  if (obj.assessment) {
    const inner = findAssessment(obj.assessment);
    if (inner) return inner;
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = findAssessment(value);
      if (found) return found;
    }
  }
  return null;
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function modelNameLeak(value, path = '', leaks = []) {
  if (value === null || value === undefined) return leaks;
  if (typeof value === 'string') {
    if (/\b(gpt-?4|gpt-?5|claude|o1|gemini|openai|anthropic|grok)\b/i.test(value)) {
      leaks.push(`${path}: ${value.slice(0, 80)}`);
    }
    return leaks;
  }
  if (typeof value !== 'object') return leaks;
  if (Array.isArray(value)) {
    value.forEach((item, i) => modelNameLeak(item, `${path}[${i}]`, leaks));
    return leaks;
  }
  for (const [k, v] of Object.entries(value)) {
    if (['source_artifact', 'source_path', 'path', 'artifact', 'provenance'].includes(k)) continue;
    modelNameLeak(v, path ? `${path}.${k}` : k, leaks);
  }
  return leaks;
}

function readSource(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const fixture = loadJson('src/lab/fixtures/tammyBaRetrieveFull.json');
const assessment = findAssessment(fixture);
const record = {
  assessment,
  has_business_intelligence_draft: true,
  has_five_futures: true,
  has_one_move: true,
};

const results = {
  mission_id: 'MMM8_BA_VISUAL_RENDERER_V2',
  contract_version: CONTRACT_VERSION,
  cases: {},
  summary: {},
  generated_at: new Date().toISOString(),
};

// Case 1: full intelligence → V2 view model regions
{
  const failures = [];
  const normalized = normalizeBusinessVisualArtifactData(record);
  const contract = normalized.businessEngineContract;
  const validation = validateBusinessEngineContract(contract);
  // Contract is the sole semantic source for V2 (MMM8 1C).
  const vm = projectBusinessEngineVisualV2(contract, {
    identity: {
      owner_name: normalized.ownerName || null,
      owner_profile_type: normalized.ownerProfileType || null,
      profile_id: normalized.profileId || null,
      assessment_type: normalized.assessmentType || null,
    },
  });

  assert(validation.valid, `contract invalid: ${validation.errors?.join('; ')}`, failures);
  assert(contract?.contract_metadata?.contract_version === CONTRACT_VERSION, 'contract version mismatch', failures);
  assert(vm.meta.contract_version === CONTRACT_VERSION, 'vm contract version mismatch', failures);

  assert(vm.governing_business_pattern.available, 'governing pattern not available', failures);
  assert(vm.governing_business_pattern.pattern_title || vm.governing_business_pattern.summary, 'governing pattern empty', failures);
  assert(vm.behavioral_modifier.available, 'behavioral modifier not available', failures);
  assert(vm.current_trajectory.available, 'current trajectory not available', failures);
  assert(
    !/stable\. not scaling/i.test(JSON.stringify(vm.current_trajectory)),
    'weak static current trajectory still present',
    failures
  );
  assert(
    !/growing\. predictable\. scalable/i.test(JSON.stringify(vm.potential_trajectory)),
    'static potential trajectory hardcoded',
    failures
  );
  assert(vm.relationship_lake.streams?.length >= 0, 'streams node missing', failures);
  assert(typeof vm.relationship_lake.streams_fallback === 'boolean', 'streams fallback flag missing', failures);
  assert(typeof vm.relationship_lake.outflow_fallback === 'boolean', 'outflow fallback flag missing', failures);
  if (vm.relationship_lake.streams_fallback) {
    assert(vm.relationship_lake.streams_note, 'streams fallback note missing', failures);
  }
  if (vm.relationship_lake.outflow_fallback) {
    assert(vm.relationship_lake.outflow_note, 'outflow fallback note missing', failures);
  }
  assert(vm.primary_constraint.available, 'primary constraint not available', failures);
  // Unique intelligence only — Primary Constraint + One Move have dedicated surfaces.
  assert(Array.isArray(vm.causal_chain) && vm.causal_chain.length === 3, 'causal chain must be 3 panels', failures);
  assert(vm.causal_chain[0].title === 'WHY THIS IS HAPPENING', 'chain[0] title', failures);
  assert(vm.causal_chain[1].title === 'WHAT HAPPENS IF NOTHING CHANGES', 'chain[1] title', failures);
  assert(vm.causal_chain[2].title === 'WHAT CHANGES THE FUTURE', 'chain[2] title', failures);
  assert(vm.causal_chain.every((c) => c.from_contract === true), 'chain must be from_contract', failures);
  assert(vm.primary_constraint.title === 'PRIMARY CONSTRAINT' || vm.primary_constraint.name, 'primary constraint surface', failures);
  assert(vm.one_move.title === 'THE ONE MOVE' || vm.one_move.move_title, 'one move surface', failures);
  assert(vm.subscription_placeholder?.next_action === 'Next Action for Subscription', 'subscription placeholder', failures);
  assert(vm.one_move.available, 'one move not available', failures);
  assert(vm.one_move.move_title || vm.one_move.recommendation, 'one move empty', failures);
  assert(vm.footer.available, 'footer not available', failures);
  assert(vm.footer.personalized === true || vm.footer.headline, 'footer not personalized', failures);
  assert(vm.identity.last_updated || vm.temporal.last_updated, 'last updated missing', failures);
  assert(vm.identity.snapshot_mode === true, 'assessment snapshot missing', failures);
  assert(vm.temporal.assessment_snapshot === true, 'temporal snapshot missing', failures);

  // Modeled opportunity archived from executive surface; must not invent currency.
  assert(vm.modeled_opportunity.archived === true, 'modeled opportunity should be archived', failures);
  assert(vm.modeled_opportunity.render === false, 'modeled opportunity should not render', failures);
  if (!vm.modeled_opportunity.available) {
    assert(!vm.modeled_opportunity.value_or_range, 'invented opportunity value', failures);
  } else if (vm.modeled_opportunity.value_or_range) {
    assert(vm.modeled_opportunity.modeled_not_guaranteed, 'modeled_not_guaranteed missing', failures);
  }

  // Executive projection: no accidental "..." truncation on primary surfaces
  const primaryProse = [
    vm.one_move?.recommendation,
    vm.one_move?.why_selected,
    vm.one_move?.implementation,
    vm.causal_chain?.[0]?.body,
    vm.causal_chain?.[1]?.body,
    vm.causal_chain?.[2]?.body,
    vm.primary_constraint?.explanation,
    vm.governing_business_pattern?.summary,
  ].filter(Boolean);
  for (const prose of primaryProse) {
    assert(!/\.\.\.\s*$/.test(String(prose)), `executive prose ends with ellipsis: ${String(prose).slice(-48)}`, failures);
  }

  // Progressive disclosure architecture present (payloads may be null when short)
  assert(
    Object.prototype.hasOwnProperty.call(vm.one_move, 'recommendation_expansion'),
    'one move missing expansion slot',
    failures
  );
  assert(
    Object.prototype.hasOwnProperty.call(vm.confidence_reality, 'subscription_ready'),
    'confidence subscription_ready missing',
    failures
  );

  const leaks = modelNameLeak(vm);
  assert(leaks.length === 0, `model name leak in vm: ${leaks.join('; ')}`, failures);

  results.cases.full_intelligence_v2_regions = {
    passed: failures.length === 0,
    failures,
    region_flags: {
      governing_business_pattern: vm.governing_business_pattern.available,
      behavioral_modifier: vm.behavioral_modifier.available,
      current_trajectory: vm.current_trajectory.available,
      potential_trajectory: vm.potential_trajectory.available,
      primary_constraint: vm.primary_constraint.available,
      causal_chain_len: vm.causal_chain.length,
      one_move: vm.one_move.available,
      modeled_opportunity: vm.modeled_opportunity.available,
      confidence_reality: vm.confidence_reality.available,
      footer: vm.footer.available,
      streams_fallback: vm.relationship_lake.streams_fallback,
      outflow_fallback: vm.relationship_lake.outflow_fallback,
    },
  };
}

// Case 2: honest absence when futures/one move stripped
{
  const failures = [];
  const clone = JSON.parse(JSON.stringify(record));
  const a = findAssessment(clone);
  if (a?.output) {
    delete a.output.five_futures_v1;
    delete a.output.one_move_v1;
  }
  const normalized = normalizeBusinessVisualArtifactData(clone);
  const contract = normalized.businessEngineContract;
  const vm = projectBusinessEngineVisualV2(contract);

  assert(
    !/growing\. predictable\. scalable/i.test(JSON.stringify(vm.potential_trajectory || {})),
    'static potential trajectory when futures absent',
    failures
  );
  if (!vm.potential_trajectory.available) {
    assert(/unavailable/i.test(vm.potential_trajectory.caption || ''), 'honest potential trajectory caption', failures);
  }
  if (!vm.one_move.available) {
    assert(!vm.one_move.move_title || /unavailable/i.test(vm.one_move.absence_message || ''), 'one move honest absence', failures);
  }
  if (!vm.modeled_opportunity.available) {
    assert(!vm.modeled_opportunity.value_or_range, 'invented opportunity after strip', failures);
  }

  results.cases.honest_absence_without_futures = {
    passed: failures.length === 0,
    failures,
    potential_trajectory_available: vm.potential_trajectory.available,
    one_move_available: vm.one_move.available,
    modeled_opportunity_available: vm.modeled_opportunity.available,
  };
}

// Case 3: renderer purity — no semantic inference helpers in V2 sources
{
  const failures = [];
  const v2 = readSource('src/components/businessAssessment/BusinessEngineVisualV2.jsx');
  const proj = readSource('src/lib/businessEngine/projectBusinessEngineVisualV2.js');
  const map = readSource('src/BusinessAssessmentVisualMap.jsx');
  const combined = `${v2}\n${proj}\n${map}`;

  assert(!/bandToStatus/.test(combined), 'bandToStatus present in V2 path', failures);
  assert(!/\binfer[A-Z_].*constraint|function\s+infer\w*Constraint/i.test(combined), 'constraint inference helper present', failures);
  assert(!/function\s+parse\w*Trajectory|parseTrajectory/i.test(combined), 'parse trajectory present', failures);
  assert(!/function\s+derive\w*OneMove|deriveOneMove/i.test(combined), 'derive one move present', failures);
  assert(!/expected_probability_shift/.test(v2), 'renderer consumes expected_probability_shift directly', failures);
  assert(/projectBusinessEngineVisualV2/.test(v2) || /projectBusinessEngineVisualV2/.test(map), 'projection import missing', failures);
  assert(/BusinessEngineVisualV2/.test(map), 'VisualMap not wired to V2', failures);
  assert(/data-renderer="business-engine-visual-v2"/.test(v2), 'renderer marker missing', failures);
  assert(/data-region="governing-business-pattern"/.test(v2), 'GBP region missing', failures);
  assert(/data-region="behavioral-modifier"/.test(v2), 'behavioral region missing', failures);
  assert(/data-region="one-move"/.test(v2), 'one move region missing', failures);
  assert(/data-region="confidence-reality"/.test(v2), 'confidence region missing', failures);
  assert(
    /Assessment Snapshot/.test(v2) || /Assessment Snapshot/.test(proj) || /snapshot_label:\s*'Assessment Snapshot'/.test(proj),
    'Assessment Snapshot structural label missing',
    failures
  );
  assert(/Last Updated/.test(v2) || /Last Updated/.test(proj) || /last_updated_label/.test(proj), 'Last Updated missing', failures);

  const modelInUi = combined.match(/\b(GPT-5\.5|gpt-5\.5|GPT-4o|gpt-4o|Claude|Gemini)\b/g) || [];
  assert(modelInUi.length === 0, `model names in UI sources: ${modelInUi.join(',')}`, failures);

  results.cases.renderer_purity_scan = {
    passed: failures.length === 0,
    failures,
  };
}

// Case 4: legacy map projection still compatible
{
  const failures = [];
  const normalized = normalizeBusinessVisualArtifactData(record);
  assert(normalized.businessMap, 'businessMap missing', failures);
  assert(normalized.businessMap.currentTrajectory, 'legacy currentTrajectory missing', failures);
  assert(normalized.businessMap.chain?.length === 5, 'legacy chain length', failures);
  assert(normalized.businessEngineContract, 'contract on normalized missing', failures);
  assert(
    !/growing\. predictable\. scalable/i.test(JSON.stringify(normalized.businessMap.potentialTrajectory || {})),
    'legacy potential still static',
    failures
  );

  results.cases.legacy_retrieval_compatible = {
    passed: failures.length === 0,
    failures,
  };
}

const caseList = Object.values(results.cases);
results.summary = {
  total: caseList.length,
  passed: caseList.filter((c) => c.passed).length,
  failed: caseList.filter((c) => !c.passed).length,
  all_passed: caseList.every((c) => c.passed),
};

mkdirSync(__dirname, { recursive: true });
mkdirSync(bridgeOut, { recursive: true });
const outName = 'mmm8_ba_visual_renderer_v2_fixture_validation.json';
writeFileSync(join(__dirname, outName), JSON.stringify(results, null, 2));
writeFileSync(join(bridgeOut, outName), JSON.stringify(results, null, 2));

console.log(JSON.stringify(results.summary, null, 2));
if (!results.summary.all_passed) {
  for (const [name, c] of Object.entries(results.cases)) {
    if (!c.passed) console.error(name, c.failures);
  }
  process.exit(1);
}
