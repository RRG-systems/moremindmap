/**
 * Adversarial + regression fixtures for
 * MMM8_REAL_ESTATE_DOCTRINE_GOAL_AND_FUTURES_ALIGNMENT
 *
 * Run: node lab_outputs/mmm8_real_estate_doctrine_goal_alignment/run_fixture_validation.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const bridgeOut = join(
  root,
  '../moremindmap-agent-bridge/lab_outputs/mmm8_real_estate_doctrine_goal_alignment'
);

const {
  buildBusinessEngineContract,
  validateBusinessEngineContract,
  projectBusinessEngineVisualV2,
  buildGoalIntelligence,
  buildRealEstateTargetModel,
  targetTrueRelationshipsFromIncome,
  extractAssessmentMetricSources,
  CONTRACT_VERSION,
} = await import(pathToFileURL(join(root, 'src/lib/businessEngine/index.js')).href);

const { normalizeBusinessVisualArtifactData } = await import(
  pathToFileURL(join(root, 'src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js')).href
);

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

function metricN(m) {
  if (Number.isFinite(m)) return m;
  if (m && typeof m === 'object') {
    if (Number.isFinite(m.value)) return m.value;
    if (m.range && Number.isFinite(m.low) && Number.isFinite(m.high)) return (m.low + m.high) / 2;
  }
  return null;
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

function baseFuturesAndMove(overrides = {}) {
  return {
    five_futures_v1: {
      version: 'five_futures_v1',
      confidence_snapshot: 'moderate',
      futures: [
        {
          key: 'current_future',
          title: 'Current Operating Pattern',
          probability: 28,
          summary: 'Current trajectory continues with relationship underuse.',
          risk_if_unchanged: 'Relationship decay and inconsistent production continue.',
          confidence: 'medium',
        },
        {
          key: 'most_likely_next_future',
          title: 'More Activity Same Structure',
          probability: 32,
          summary: 'More motion without structural change.',
          risk_if_unchanged: 'Effort rises without predictability.',
        },
        {
          key: 'constraint_future',
          title: 'Constraint Tightens',
          probability: 18,
          summary: 'Primary constraint dominates outcomes.',
        },
        {
          key: 'optimized_future',
          title: 'Systemized Relationship Engine',
          probability: 17,
          summary: 'CRM rhythm converts true relationships into pipeline.',
          required_shift: 'Install weekly relationship operating rhythm.',
        },
        {
          key: 'transformational_future',
          title: 'Leveraged Platform',
          probability: 5,
          summary: 'Selective leverage after systems mature.',
        },
      ],
    },
    one_move_v1: {
      title: 'Install a 90-Day Relationship Operating System',
      root_constraint: 'Systems constraint: true relationships are not operated with rhythm.',
      recommendation: 'For 90 days, run one CRM relationship operating system as the center of the business.',
      why_this_move: 'It changes the highest probability mass by converting existing relationship asset into pipeline.',
      why_now: 'Current lake is under-operated relative to the income goal.',
      behavior_fit: 'Matches relational strength with structure.',
      success_indicators: ['Weekly touches logged', 'True relationships segmented'],
      first_30_days: ['Consolidate contacts into one CRM'],
      expected_probability_shift: {
        explanation: 'Probability shifts toward optimized relationship engine future.',
      },
      confidence: 'medium',
      ...overrides.one_move,
    },
    business_intelligence_draft: {
      relationship_reality: {
        lake_health: 'mixed',
        relationship_asset_strength: 'moderate',
        evidence: {},
      },
      constraint_analysis: {
        primary_constraint: {
          label: 'Systems Constraint',
          constraint_key: 'systems',
          diagnostic_summary: 'Relationship skill without operating system.',
          likely_effect_if_unchanged: 'Inconsistent production continues.',
          confidence: 'medium',
        },
      },
      current_trajectory_signal: {
        diagnostic_summary: 'Current trajectory is relationship-led but system-light.',
        signal: 'stable_with_drag',
        confidence: 'medium',
      },
      ...overrides.draft,
    },
  };
}

function makeRecord({ answers, draftExtras = {}, assessmentType = 'real_estate_agent' }) {
  const outputBase = baseFuturesAndMove({ draft: draftExtras });
  return {
    assessment: {
      assessment_id: 'fixture-re-goal-1',
      owner_profile_id: 'fixture-profile',
      assessment_type: assessmentType,
      updated_at: '2026-07-13T00:00:00.000Z',
      inputs: { answers },
      output: {
        ...outputBase,
        business_intelligence_draft: {
          ...outputBase.business_intelligence_draft,
          ...draftExtras,
          relationship_reality: {
            ...outputBase.business_intelligence_draft.relationship_reality,
            ...(draftExtras.relationship_reality || {}),
          },
        },
      },
    },
    has_business_intelligence_draft: true,
    has_five_futures: true,
    has_one_move: true,
  };
}

const results = {
  mission_id: 'MMM8_REAL_ESTATE_DOCTRINE_GOAL_AND_FUTURES_ALIGNMENT',
  contract_version: CONTRACT_VERSION,
  cases: {},
  summary: {},
};

function runCase(id, fn) {
  const failures = [];
  try {
    fn(failures);
  } catch (err) {
    failures.push(`exception: ${err.message}`);
  }
  results.cases[id] = {
    pass: failures.length === 0,
    failures,
  };
}

// 1. Declared $250K → declared goal + ~500 TR
runCase('1_declared_250k_maps_to_approx_500_true_relationships', (failures) => {
  const goal = buildGoalIntelligence({ answers: { q2: 'I want to make $250K' } });
  assert(goal.goal_source === 'declared', `goal_source=${goal.goal_source}`, failures);
  assert(goal.goal_value === 250000, `goal_value=${goal.goal_value}`, failures);
  const mapped = targetTrueRelationshipsFromIncome(250000);
  assert(mapped.value === 500, `doctrine map=${mapped.value}`, failures);
  const record = makeRecord({
    answers: {
      q2: 'I want to make $250K',
      q3: 'I have about 50 true relationships and 1737 total contacts',
    },
    draftExtras: {
      relationship_reality: {
        database_size_mentions: ['1737', '50'],
        evidence: { q3: 'I have about 50 true relationships and 1737 total contacts' },
      },
    },
  });
  const contract = buildBusinessEngineContract(record);
  const targetN = metricN(contract.relationship_lake.target_true_relationships);
  assert(targetN === 500, `target TR=${targetN}`, failures);
  assert(contract.goal_intelligence.goal_source === 'declared', 'contract goal not declared', failures);
  const vm = projectBusinessEngineVisualV2(contract);
  assert(/~?500/.test(String(vm.relationship_lake.target_size)), `vm target=${vm.relationship_lake.target_size}`, failures);
  assert(contract.real_estate_target_model?.modeled_not_guaranteed === true, 'modeled flag missing', failures);
});

// 2. Explicit production goal — bounded, no false TR precision without income
runCase('2_production_goal_bounded', (failures) => {
  const goal = buildGoalIntelligence({
    answers: { q2: '12-month goal: roughly $12M in sales volume' },
  });
  assert(goal.goal_type === 'production', `type=${goal.goal_type}`, failures);
  assert(goal.goal_source === 'declared', `source=${goal.goal_source}`, failures);
  const model = buildRealEstateTargetModel({ goal, metrics: {}, answers: {} });
  assert(model.target_production?.value > 0, 'production target missing', failures);
  assert(
    model.target_true_relationships == null,
    'should not invent TR target from production alone',
    failures
  );
});

// 3. Units goal bounded
runCase('3_units_goal_bounded', (failures) => {
  const goal = buildGoalIntelligence({ answers: { q2: 'close 40 units this year' } });
  assert(goal.goal_type === 'units', `type=${goal.goal_type}`, failures);
  const model = buildRealEstateTargetModel({ goal, metrics: {}, answers: {} });
  assert(model.target_units?.value === 40, 'units missing', failures);
  assert(model.target_true_relationships == null, 'no false TR from units alone', failures);
});

// 4. Narrative goal recovered
runCase('4_narrative_goal_recovered', (failures) => {
  const goal = buildGoalIntelligence({
    answers: { q2: 'Over the next year I plan to earn $180k in GCI with better systems.' },
  });
  assert(goal.goal_source === 'declared' || goal.goal_source === 'inferred', `source=${goal.goal_source}`, failures);
  assert(Number.isFinite(goal.goal_value) && goal.goal_value >= 100000, `value=${goal.goal_value}`, failures);
  assert(goal.goal_source !== 'unavailable', 'must not be unavailable', failures);
});

// 5. Weak evidence does not produce false precision
runCase('5_weak_evidence_no_false_precision', (failures) => {
  const goal = buildGoalIntelligence({
    answers: {
      q2: 'I want to feel more confident and be a better communicator under pressure.',
      q1: 'I am driven and visionary.',
    },
  });
  assert(
    goal.goal_source === 'unavailable' || goal.goal_type === 'lifestyle',
    `weak goal leaked: ${JSON.stringify(goal)}`,
    failures
  );
  assert(goal.goal_value == null || goal.goal_source === 'unavailable', 'false precision value', failures);
});

// 6. Honest absence
runCase('6_honest_goal_absence', (failures) => {
  const goal = buildGoalIntelligence({ answers: { q2: '', q3: 'maybe 20 true relationships' } });
  assert(goal.goal_source === 'unavailable', `source=${goal.goal_source}`, failures);
  const model = buildRealEstateTargetModel({ goal, metrics: {}, answers: {} });
  assert(model.target_true_relationships == null, 'target invented without goal', failures);
  assert(model.fallback_used === true, 'fallback not marked', failures);
});

// 7–11. Lake distinctions + gap
runCase('7_11_lake_true_vs_total_target_gap', (failures) => {
  const metrics = extractAssessmentMetricSources({
    answers: {
      q3: 'I have maybe 1737 and true relationships are maybe 50',
      q2: 'I want to make $250,000',
    },
    draft: {
      relationship_reality: {
        database_size_mentions: ['1737', '50', '1737'],
        evidence: { q3: 'I have maybe 1737 and true relationships are maybe 50' },
      },
    },
  });
  assert(metricN(metrics.currentTrueRelationships) === 50, `TR=${metricN(metrics.currentTrueRelationships)}`, failures);
  assert(metricN(metrics.totalContacts) === 1737, `total=${metricN(metrics.totalContacts)}`, failures);
  assert(
    !(metrics.currentTrueRelationships?.range && metrics.currentTrueRelationships.high === 1737),
    'merged range TR–total still present',
    failures
  );

  const record = makeRecord({
    answers: {
      q2: 'I want to make $250,000',
      q3: 'I have maybe 1737 and true relationships are maybe 50',
    },
    draftExtras: {
      relationship_reality: {
        database_size_mentions: ['1737', '50', '1737'],
        evidence: { q3: 'I have maybe 1737 and true relationships are maybe 50' },
      },
    },
  });
  const contract = buildBusinessEngineContract(record);
  const lake = contract.relationship_lake;
  assert(metricN(lake.current_true_relationships) === 50, 'current lake not TR', failures);
  assert(metricN(lake.total_contacts) === 1737, 'total contacts not distinct', failures);
  assert(metricN(lake.target_true_relationships) === 500, 'target not goal-derived', failures);
  assert(metricN(lake.gap) === 450, `gap=${metricN(lake.gap)}`, failures);
  const vm = projectBusinessEngineVisualV2(contract);
  const center = String(vm.relationship_lake.current_size || '');
  assert(!/50\s*[–-]\s*1,?737/.test(center), `merged center display: ${center}`, failures);
  assert(!/50\s*[–-]\s*1,?737/.test(JSON.stringify(vm.relationship_lake)), 'merged lake range in vm', failures);
  assert(String(vm.relationship_lake.current_size).includes('50'), 'center missing 50', failures);
  assert(String(vm.relationship_lake.total_contacts).includes('1,737') || String(vm.relationship_lake.total_contacts).includes('1737'), 'total not projected', failures);
});

// 12–15. BA shares future + one move
runCase('12_15_ba_shares_futures_and_one_move', (failures) => {
  const record = makeRecord({
    answers: {
      q2: 'I want to make $250K',
      q3: 'about 50 are true relationships; total database roughly 900',
    },
  });
  const contract = buildBusinessEngineContract(record);
  const assessment = record.assessment;
  const ff = assessment.output.five_futures_v1;
  const om = assessment.output.one_move_v1;
  assert(contract.future_alignment?.active_future_key === 'current_future', 'active future mismatch', failures);
  assert(
    contract.future_alignment?.one_move?.title === om.title,
    'one move title diverges from stored',
    failures
  );
  assert(contract.one_move?.current?.title === om.title, 'contract one_move diverges', failures);
  assert(
    contract.no_change_consequence?.current ===
      ff.futures.find((f) => f.key === 'current_future').risk_if_unchanged ||
      String(contract.no_change_consequence?.current || '').includes('decay') ||
      String(contract.no_change_consequence?.current || '').includes('Inconsistent'),
    `no_change not aligned: ${contract.no_change_consequence?.current}`,
    failures
  );
  const required =
    contract.potential_business_future?.current?.required_structural_change ||
    contract.potential_trajectory?.current?.required_structural_change;
  assert(
    required === ff.futures.find((f) => f.key === 'optimized_future').required_shift ||
      required === om.recommendation ||
      /relationship operating|CRM|rhythm/i.test(String(required || '')),
    `required structural change diverges: ${required}`,
    failures
  );
  const vm = projectBusinessEngineVisualV2(contract);
  assert(vm.one_move.move_title === om.title, 'renderer one move diverges', failures);
  assert(vm.future_alignment?.one_move_title === om.title, 'alignment projection diverges', failures);
});

// 16. Renderer cannot substitute independent future/goal text
runCase('16_renderer_purity', (failures) => {
  const record = makeRecord({
    answers: { q2: 'I want to make $250K', q3: '50 true relationships' },
  });
  const contract = buildBusinessEngineContract(record);
  // Strip one move and futures from projection input by nulling contract nodes
  const stripped = JSON.parse(JSON.stringify(contract));
  stripped.one_move = {
    current: null,
    intelligence_status: 'absent',
    source_type: 'honest_absence',
    fallback_used: false,
    fallback_reason: null,
    evidence_sources: [],
  };
  stripped.future_alignment = { available: false, one_move: {} };
  const vm = projectBusinessEngineVisualV2(stripped);
  assert(!vm.one_move?.available, 'renderer invented one move availability', failures);
  assert(!vm.one_move?.move_title, `renderer invented one move title: ${vm.one_move?.move_title}`, failures);
});

// 17. Legacy Tammy compatibility
runCase('17_legacy_tammy_compatible', (failures) => {
  const fixture = loadJson('src/lab/fixtures/tammyBaRetrieveFull.json');
  const assessment = findAssessment(fixture);
  const record = {
    assessment,
    has_business_intelligence_draft: true,
    has_five_futures: true,
    has_one_move: true,
  };
  const normalized = normalizeBusinessVisualArtifactData(record);
  const contract = normalized.businessEngineContract;
  const validation = validateBusinessEngineContract(contract);
  assert(validation.valid, `validator: ${validation.errors.join('; ')}`, failures);
  assert(contract.relationship_lake, 'lake missing', failures);
  assert(contract.goal_intelligence, 'goal intelligence missing', failures);
  assert(contract.future_alignment, 'future alignment missing', failures);
  assert(contract.one_move?.current?.title, 'one move missing', failures);
  const vm = projectBusinessEngineVisualV2(contract);
  assert(vm.relationship_lake, 'vm lake missing', failures);
  assert(
    !/50\s*[–-]\s*1,?737/.test(JSON.stringify(vm.relationship_lake)),
    'tammy should not invent 50-1737',
    failures
  );
  // Distinct TR vs total
  const tr = metricN(contract.relationship_lake.current_true_relationships);
  const total = metricN(contract.relationship_lake.total_contacts);
  assert(Number.isFinite(tr), 'tammy TR missing', failures);
  assert(Number.isFinite(total), 'tammy total missing', failures);
  assert(tr !== total, 'tammy TR equals total (conflation)', failures);
});

// 18. No internal model names
runCase('18_no_internal_model_names', (failures) => {
  const record = makeRecord({
    answers: { q2: 'I want to make $250K', q3: '50 true relationships' },
  });
  const contract = buildBusinessEngineContract(record);
  const vm = projectBusinessEngineVisualV2(contract);
  const leaks = [...modelNameLeak(contract), ...modelNameLeak(vm)];
  assert(leaks.length === 0, `leaks: ${leaks.join('; ')}`, failures);
});

// 19. No invented financial values without evidence
runCase('19_no_invented_financial_values', (failures) => {
  const record = makeRecord({
    answers: { q3: 'maybe 40 true relationships', q2: 'I need better systems' },
  });
  const contract = buildBusinessEngineContract(record);
  assert(
    contract.goal_intelligence?.goal_source === 'unavailable' ||
      contract.goal_intelligence?.goal_type === 'lifestyle' ||
      contract.goal_intelligence?.goal_type === 'relationship_base' ||
      !Number.isFinite(contract.goal_intelligence?.goal_value),
    'invented goal value',
    failures
  );
  // Without income goal, do not invent $ numbers on lake goal_summary from personality
  if (contract.goal_intelligence?.goal_source === 'unavailable') {
    assert(!contract.relationship_lake.goal_summary, 'goal summary invented', failures);
  }
});

// 20. Unsupported precision avoided on doctrine target
runCase('20_unsupported_precision_avoided', (failures) => {
  const mapped = targetTrueRelationshipsFromIncome(250000);
  assert(mapped.value === 500, 'anchor precision', failures);
  const mapped2 = targetTrueRelationshipsFromIncome(187500);
  // 187500/500=375 → bound to nearest 25 = 375
  assert(Number.isInteger(mapped2.value), 'non-integer target', failures);
  assert(mapped2.value % 1 === 0, 'fractional target', failures);
});

// Extra: contract validation + goal source preserved
runCase('extra_goal_source_confidence_on_contract', (failures) => {
  const record = makeRecord({
    answers: {
      q2: 'I want to make $250K',
      q3: 'about 50 are true relationships',
    },
  });
  const contract = buildBusinessEngineContract(record);
  assert(contract.relationship_lake.goal_source === 'declared', 'lake goal_source', failures);
  assert(contract.relationship_lake.goal_confidence, 'lake goal_confidence', failures);
  assert(contract.relationship_lake.target_basis, 'target_basis missing', failures);
  assert(validateBusinessEngineContract(contract).valid, 'contract invalid', failures);
});

const caseIds = Object.keys(results.cases);
const passed = caseIds.filter((id) => results.cases[id].pass).length;
const failed = caseIds.length - passed;
results.summary = {
  total: caseIds.length,
  passed,
  failed,
  pass: failed === 0,
};

mkdirSync(bridgeOut, { recursive: true });
mkdirSync(__dirname, { recursive: true });
const outPath = join(bridgeOut, 'mmm8_adversarial_fixture_validation.json');
writeFileSync(outPath, JSON.stringify(results, null, 2));
writeFileSync(join(__dirname, 'mmm8_adversarial_fixture_validation.json'), JSON.stringify(results, null, 2));

console.log(JSON.stringify(results.summary, null, 2));
if (failed) {
  for (const id of caseIds) {
    if (!results.cases[id].pass) {
      console.log('FAIL', id, results.cases[id].failures);
    }
  }
  process.exitCode = 1;
} else {
  console.log('ALL ADVERSARIAL FIXTURES PASSED');
}
