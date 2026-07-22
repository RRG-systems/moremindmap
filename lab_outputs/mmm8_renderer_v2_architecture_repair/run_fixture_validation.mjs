/**
 * Adversarial + architecture fixtures for
 * MMM8_BA_VISUAL_RENDERER_V2_ARCHITECTURE_REPAIR.
 *
 * Proves the Business Engine Contract is the sole semantic source for V2.
 *
 * Run: node lab_outputs/mmm8_renderer_v2_architecture_repair/run_fixture_validation.mjs
 */

import { accessSync, constants, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const bridgeOut = join(
  root,
  '../moremindmap-agent-bridge/lab_outputs/mmm8_renderer_v2_architecture_repair'
);

function writeValidationResults(outName, validationResults) {
  const localPath = join(__dirname, outName);
  const bridgePath = join(bridgeOut, outName);
  let bridgeCopy = {
    status: 'skipped',
    reason: 'destination_missing',
  };

  if (existsSync(bridgeOut)) {
    try {
      accessSync(bridgeOut, constants.W_OK);
      bridgeCopy = { status: 'ready' };
    } catch {
      bridgeCopy = {
        status: 'skipped',
        reason: 'destination_not_writable',
      };
    }
  }

  validationResults.secondary_bridge_copy = bridgeCopy;
  writeFileSync(localPath, JSON.stringify(validationResults, null, 2));

  if (bridgeCopy.status === 'ready') {
    try {
      validationResults.secondary_bridge_copy = { status: 'copied' };
      writeFileSync(bridgePath, JSON.stringify(validationResults, null, 2));
    } catch (error) {
      validationResults.secondary_bridge_copy = {
        status: 'skipped',
        reason: 'copy_failed',
        error_code: error?.code || 'unknown',
      };
    }
    writeFileSync(localPath, JSON.stringify(validationResults, null, 2));
  }

  if (validationResults.secondary_bridge_copy.status === 'skipped') {
    console.warn(
      `Optional Bridge copy skipped: ${validationResults.secondary_bridge_copy.reason}`
    );
  }
}

const { normalizeBusinessVisualArtifactData } = await import(
  pathToFileURL(join(root, 'src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js')).href
);
const {
  buildBusinessEngineContract,
  validateBusinessEngineContract,
  projectBusinessEngineVisualV2,
  CONTRACT_VERSION,
  buildTrajectoryVisualization,
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

function emptyNode(overrides = {}) {
  return {
    current: null,
    previous: null,
    trend: null,
    reason_for_change: null,
    evidence_sources: [],
    last_updated: null,
    confidence: null,
    provenance: null,
    source_type: 'honest_absence',
    fallback_used: false,
    fallback_reason: null,
    intelligence_status: 'absent',
    ...overrides,
  };
}

function injectTrajectory(contract, role, direction, { labels, points } = {}) {
  const current = {
    label: `Test ${direction}`,
    summary: `Trajectory is ${direction}`,
    direction,
  };
  const viz = buildTrajectoryVisualization({
    current,
    role,
    nodeAvailable: true,
    explicitDirection: direction,
    explicitStageLabels: labels,
    explicitPoints: points,
  });
  const node = {
    ...emptyNode({
      current,
      intelligence_status: 'available',
      source_type: 'domain_intelligence',
    }),
    visualization: viz,
  };
  if (role === 'current') contract.current_trajectory = node;
  else contract.potential_trajectory = node;
  return projectBusinessEngineVisualV2(contract);
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
  mission_id: 'MMM8_BA_VISUAL_RENDERER_V2_ARCHITECTURE_REPAIR',
  mission_slug: 'mmm8_ba_visual_renderer_v2_architecture_repair',
  contract_version: CONTRACT_VERSION,
  cases: {},
  summary: {},
  generated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// 1) normalized-only current metrics cannot populate Current Reality
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const stripped = JSON.parse(JSON.stringify(contract));
  stripped.current_business_reality = emptyNode();

  const vm = projectBusinessEngineVisualV2(stripped, {
    normalized: {
      businessMap: {
        currentMetrics: [{ label: 'Injected Current', value: '999' }],
        targetMetrics: [{ label: 'Injected Target', value: '888' }],
      },
    },
    currentMetrics: [{ label: 'Injected Current', value: '999' }],
    targetMetrics: [{ label: 'Injected Target', value: '888' }],
  });

  assert(vm.current_business_reality.available === false, 'current available from normalized-only', failures);
  assert(vm.current_business_reality.metrics.length === 0, 'current metrics non-empty from side channel', failures);
  assert(
    !JSON.stringify(vm.current_business_reality).includes('Injected Current'),
    'injected current metric leaked',
    failures
  );
  assert(vm.meta.semantic_sources.contract_only === true, 'semantic_sources.contract_only false', failures);
  assert(vm.meta.semantic_sources.normalized === false, 'normalized still semantic source', failures);
  assert(vm.meta.semantic_sources.currentMetrics === false, 'currentMetrics still semantic source', failures);

  results.cases['01_normalized_only_current_blocked'] = {
    passed: failures.length === 0,
    failures,
    available: vm.current_business_reality.available,
    metric_count: vm.current_business_reality.metrics.length,
  };
}

// ---------------------------------------------------------------------------
// 2) targetMetrics-only data cannot populate Potential Future
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const stripped = JSON.parse(JSON.stringify(contract));
  stripped.potential_business_future = emptyNode();

  const vm = projectBusinessEngineVisualV2(stripped, {
    normalized: {
      businessMap: {
        targetMetrics: [{ label: 'Injected Target', value: 'Potential 999' }],
      },
    },
    targetMetrics: [{ label: 'Injected Target', value: 'Potential 999' }],
  });

  assert(vm.potential_business_future.available === false, 'future available from targetMetrics-only', failures);
  assert(vm.potential_business_future.honest_absence === true, 'honest_absence false', failures);
  assert(vm.potential_business_future.metrics.length === 0, 'future metrics from side channel', failures);
  assert(
    !JSON.stringify(vm.potential_business_future).includes('Injected Target'),
    'injected target metric leaked',
    failures
  );
  assert(vm.meta.semantic_sources.targetMetrics === false, 'targetMetrics still semantic source', failures);

  results.cases['02_target_metrics_only_future_blocked'] = {
    passed: failures.length === 0,
    failures,
    available: vm.potential_business_future.available,
    honest_absence: vm.potential_business_future.honest_absence,
  };
}

// ---------------------------------------------------------------------------
// 3) absent contract future remains absent
// ---------------------------------------------------------------------------
{
  const failures = [];
  const clone = JSON.parse(JSON.stringify(record));
  const a = findAssessment(clone);
  if (a?.output) delete a.output.five_futures_v1;
  if (a?.inputs?.answers) {
    a.inputs.answers.q2 = '';
    a.inputs.answers.q12 = '';
  }
  const contract = buildBusinessEngineContract(clone);
  contract.potential_business_future = emptyNode();
  const vm = projectBusinessEngineVisualV2(contract);

  assert(vm.potential_business_future.honest_absence === true, 'honest absence missing', failures);
  assert(vm.potential_business_future.available === false, 'future still available', failures);
  assert(vm.potential_business_future.metrics.length === 0, 'future metrics present on absence', failures);
  assert(/not available/i.test(vm.potential_business_future.absence_message || ''), 'absence message', failures);

  results.cases['03_absent_contract_future_remains_absent'] = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// 4) declining trajectory renders descending
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const points = [
    { x: 0.1, y: 0.9 },
    { x: 0.3, y: 0.7 },
    { x: 0.6, y: 0.4 },
    { x: 0.9, y: 0.1 },
  ];
  const vm = injectTrajectory(contract, 'current', 'declining', { points });
  const viz = vm.current_trajectory.visualization;

  assert(viz.direction === 'declining', 'declining not declining', failures);
  assert(viz.direction !== 'rising', 'declining rendered rising', failures);
  assert(viz.shape === 'descending' || viz.points?.[0]?.y > viz.points?.[3]?.y, 'not descending shape', failures);
  assert(Array.isArray(viz.points) && viz.points[0].y > viz.points[3].y, 'points not descending', failures);

  results.cases['04_declining_renders_descending'] = {
    passed: failures.length === 0,
    failures,
    direction: viz.direction,
    shape: viz.shape,
  };
}

// ---------------------------------------------------------------------------
// 5) stable trajectory does not render rising
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const labels = ['A', 'B', 'C', 'D'];
  const vm = injectTrajectory(contract, 'current', 'stable', { labels });
  const viz = vm.current_trajectory.visualization;

  assert(viz.direction === 'stable', 'stable not stable', failures);
  assert(viz.direction !== 'rising', 'stable rendered rising', failures);
  assert(viz.shape === 'flat' || viz.shape === 'none' || viz.shape !== 'ascending', 'stable ascending shape', failures);
  if (Array.isArray(viz.points) && viz.points.length) {
    const ySpread = Math.max(...viz.points.map((p) => p.y)) - Math.min(...viz.points.map((p) => p.y));
    assert(ySpread < 0.15, `stable y-spread too large: ${ySpread}`, failures);
  }

  results.cases['05_stable_does_not_render_rising'] = {
    passed: failures.length === 0,
    failures,
    direction: viz.direction,
    shape: viz.shape,
  };
}

// ---------------------------------------------------------------------------
// 6) unknown trajectory renders no false chart direction
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const vm = injectTrajectory(contract, 'current', 'unknown');
  const viz = vm.current_trajectory.visualization;

  assert(viz.direction === 'unknown', 'unknown not unknown', failures);
  assert(viz.direction !== 'rising', 'unknown rendered rising', failures);
  assert(
    viz.availability === 'text_only' ||
      viz.availability === 'unavailable' ||
      !viz.points ||
      viz.shape === 'none',
    'unknown still has directional chart',
    failures
  );

  results.cases['06_unknown_no_false_chart_direction'] = {
    passed: failures.length === 0,
    failures,
    direction: viz.direction,
    availability: viz.availability,
    shape: viz.shape,
  };
}

// ---------------------------------------------------------------------------
// 7) potential trajectory does not automatically rise
// ---------------------------------------------------------------------------
{
  const failures = [];
  const potBare = buildBusinessEngineContract(record);
  potBare.potential_trajectory = emptyNode({
    current: { label: 'Bare potential', summary: 'No direction field supplied' },
    intelligence_status: 'available',
    source_type: 'domain_intelligence',
  });
  const potVm = projectBusinessEngineVisualV2(potBare);
  assert(potVm.potential_trajectory.available === true, 'bare potential unavailable', failures);
  assert(
    potVm.potential_trajectory.visualization?.direction !== 'rising' ||
      potVm.potential_trajectory.visualization?.availability === 'text_only',
    'potential automatically upward without contract viz',
    failures
  );

  const potDeclining = injectTrajectory(buildBusinessEngineContract(record), 'potential', 'declining', {
    points: [
      { x: 0.1, y: 0.85 },
      { x: 0.35, y: 0.6 },
      { x: 0.65, y: 0.35 },
      { x: 0.9, y: 0.12 },
    ],
  });
  assert(
    potDeclining.potential_trajectory.visualization.direction === 'declining',
    'potential declining became rising',
    failures
  );
  assert(
    potDeclining.potential_trajectory.visualization.direction !== 'rising',
    'potential declining direction is rising',
    failures
  );

  results.cases['07_potential_trajectory_not_auto_rise'] = {
    passed: failures.length === 0,
    failures,
    bare_direction: potVm.potential_trajectory.visualization?.direction,
    declining_direction: potDeclining.potential_trajectory.visualization.direction,
  };
}

// ---------------------------------------------------------------------------
// 8) contract stage labels render exactly
// ---------------------------------------------------------------------------
{
  const failures = [];
  const labels = ['Alpha', 'Beta', 'Gamma', 'Delta'];
  const contract = buildBusinessEngineContract(record);
  const vm = injectTrajectory(contract, 'current', 'declining', {
    labels,
    points: [
      { x: 0.12, y: 0.55 },
      { x: 0.33, y: 0.44 },
      { x: 0.61, y: 0.33 },
      { x: 0.88, y: 0.22 },
    ],
  });
  assert(
    JSON.stringify(vm.current_trajectory.visualization.stage_labels) === JSON.stringify(labels),
    'stage labels rewritten',
    failures
  );

  results.cases['08_contract_stage_labels_exact'] = {
    passed: failures.length === 0,
    failures,
    stage_labels: vm.current_trajectory.visualization.stage_labels,
  };
}

// ---------------------------------------------------------------------------
// 9) contract points render without semantic rewriting
// ---------------------------------------------------------------------------
{
  const failures = [];
  const points = [
    { x: 0.12, y: 0.55 },
    { x: 0.33, y: 0.44 },
    { x: 0.61, y: 0.33 },
    { x: 0.88, y: 0.22 },
  ];
  const contract = buildBusinessEngineContract(record);
  const vm = injectTrajectory(contract, 'current', 'declining', { points });
  assert(
    JSON.stringify(vm.current_trajectory.visualization.points) === JSON.stringify(points),
    'points rewritten',
    failures
  );

  results.cases['09_contract_points_no_rewrite'] = {
    passed: failures.length === 0,
    failures,
    points: vm.current_trajectory.visualization.points,
  };
}

// ---------------------------------------------------------------------------
// 10) renderer contains no semantic regex or threshold inference
// ---------------------------------------------------------------------------
{
  const failures = [];
  const v2 = readSource('src/components/businessAssessment/BusinessEngineVisualV2.jsx');
  const proj = readSource('src/lib/businessEngine/projectBusinessEngineVisualV2.js');
  const combined = `${v2}\n${proj}`;

  assert(!/bandToStatus/.test(combined), 'bandToStatus present', failures);
  assert(!/function\s+infer\w*Constraint/i.test(combined), 'constraint inference helper', failures);
  assert(!/function\s+parse\w*Trajectory|parseTrajectory/i.test(combined), 'parse trajectory', failures);
  assert(!/function\s+derive\w*OneMove|deriveOneMove/i.test(combined), 'derive one move', failures);
  assert(!/\bupward\b/.test(v2), 'upward prop in renderer', failures);
  assert(
    !/const stageLabels = upward|Baseline',\s*'Momentum'|Growing\.\s*Predictable\.\s*Scalable/.test(v2),
    'fixed semantic stage/hardcoded direction',
    failures
  );
  assert(!/options\.normalized\s*\|\|/.test(proj), 'projection reads options.normalized', failures);
  assert(!/normalized\.businessMap/.test(proj), 'projection reads normalized.businessMap', failures);
  assert(!/metricRowsFromPanels\(options/.test(proj), 'metricRowsFromPanels(options present', failures);
  assert(
    !/(?<!\/\/.*)options\.(currentMetrics|targetMetrics)\b/.test(proj) ||
      /void options\.(currentMetrics|targetMetrics)/.test(proj),
    'projection still uses metric side channels',
    failures
  );
  assert(/view\?\.visualization|view\.visualization/.test(v2), 'renderer not consuming visualization', failures);
  assert(/formatContractDisplayRows/.test(proj), 'projection not using contract display rows', failures);
  // No hard threshold inference over currency/production metrics in renderer path.
  assert(!/GCI\s*[><=]|if\s*\(.*production.*[><]/.test(combined), 'threshold inference in renderer path', failures);

  results.cases['10_renderer_no_semantic_inference'] = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// 11) One Move remains contract-driven
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const vm = projectBusinessEngineVisualV2(contract);
  assert(vm.one_move.available === true, 'one move unavailable on full fixture', failures);
  assert(vm.one_move.move_title || vm.one_move.recommendation, 'one move empty', failures);

  const stripped = JSON.parse(JSON.stringify(contract));
  stripped.one_move = emptyNode();
  const vm2 = projectBusinessEngineVisualV2(stripped);
  assert(vm2.one_move.available === false, 'one move available after strip', failures);
  assert(/not available/i.test(vm2.one_move.absence_message || ''), 'one move absence message', failures);

  results.cases['11_one_move_contract_driven'] = {
    passed: failures.length === 0,
    failures,
    available: vm.one_move.available,
    stripped_available: vm2.one_move.available,
  };
}

// ---------------------------------------------------------------------------
// 12) Confidence Reality remains contract-driven
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const vm = projectBusinessEngineVisualV2(contract);
  assert(typeof vm.confidence_reality.available === 'boolean', 'confidence available flag missing', failures);

  const stripped = JSON.parse(JSON.stringify(contract));
  stripped.confidence_reality = emptyNode();
  const vm2 = projectBusinessEngineVisualV2(stripped);
  assert(vm2.confidence_reality.available === false, 'confidence available after strip', failures);
  assert(/not available/i.test(vm2.confidence_reality.absence_message || ''), 'confidence absence message', failures);
  assert(
    !vm2.confidence_reality.known?.length &&
      !vm2.confidence_reality.observed?.length &&
      !vm2.confidence_reality.inferred?.length,
    'confidence buckets invented after strip',
    failures
  );

  results.cases['12_confidence_contract_driven'] = {
    passed: failures.length === 0,
    failures,
    available: vm.confidence_reality.available,
    stripped_available: vm2.confidence_reality.available,
  };
}

// ---------------------------------------------------------------------------
// 13) personalized footer remains contract-driven
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const vm = projectBusinessEngineVisualV2(contract);
  assert(vm.footer.available === true || vm.footer.headline, 'footer missing on full fixture', failures);
  assert(vm.footer.personalized === true || vm.footer.headline, 'footer not personalized', failures);

  const stripped = JSON.parse(JSON.stringify(contract));
  stripped.footer_intelligence = emptyNode();
  const vm2 = projectBusinessEngineVisualV2(stripped);
  assert(vm2.footer.available === false, 'footer available after strip', failures);
  assert(/personalized|not available|governing pattern|one move/i.test(vm2.footer.absence_message || ''), 'footer absence message', failures);

  results.cases['13_footer_contract_driven'] = {
    passed: failures.length === 0,
    failures,
    personalized: vm.footer.personalized,
    stripped_available: vm2.footer.available,
  };
}

// ---------------------------------------------------------------------------
// 14) legacy assessment retrieval remains compatible
// ---------------------------------------------------------------------------
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
  assert(
    normalized.businessEngineContract?.contract_metadata?.contract_version === CONTRACT_VERSION,
    'version changed incompatibly',
    failures
  );
  const validation = validateBusinessEngineContract(normalized.businessEngineContract);
  assert(validation.valid, `legacy contract invalid: ${validation.errors?.join('; ')}`, failures);

  results.cases['14_legacy_retrieval_compatible'] = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// 15) no internal model names appear
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const vm = projectBusinessEngineVisualV2(contract);
  const leaks = modelNameLeak(vm);
  assert(leaks.length === 0, `model name leak in vm: ${leaks.join('; ')}`, failures);

  const v2 = readSource('src/components/businessAssessment/BusinessEngineVisualV2.jsx');
  const proj = readSource('src/lib/businessEngine/projectBusinessEngineVisualV2.js');
  const modelInUi = `${v2}\n${proj}`.match(/\b(GPT-5\.5|gpt-5\.5|GPT-4o|gpt-4o|Claude|Gemini)\b/g) || [];
  assert(modelInUi.length === 0, `model names in UI sources: ${modelInUi.join(',')}`, failures);

  results.cases['15_no_internal_model_names'] = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// 16) no evidence or financial values are invented
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const stripped = JSON.parse(JSON.stringify(contract));
  stripped.modeled_opportunity = emptyNode();
  stripped.primary_constraint = emptyNode({
    current: null,
    intelligence_status: 'absent',
  });
  const vm = projectBusinessEngineVisualV2(stripped);

  assert(vm.modeled_opportunity.available === false, 'opportunity invented available', failures);
  assert(!vm.modeled_opportunity.value_or_range, 'invented opportunity value', failures);
  assert(vm.modeled_opportunity.archived === true, 'opportunity should stay archived', failures);
  assert(vm.modeled_opportunity.render === false, 'opportunity should not render', failures);
  assert(
    !vm.primary_constraint.supporting_evidence?.length,
    'invented constraint evidence after strip',
    failures
  );

  // Full fixture: if opportunity present, must retain modeled_not_guaranteed boundary.
  const full = projectBusinessEngineVisualV2(contract);
  assert(full.modeled_opportunity.archived === true, 'full opportunity not archived', failures);
  if (full.modeled_opportunity.available && full.modeled_opportunity.value_or_range) {
    assert(full.modeled_opportunity.modeled_not_guaranteed, 'modeled_not_guaranteed missing', failures);
  }

  // Contract row display_value must not be invented by projection when rows absent.
  const noRows = JSON.parse(JSON.stringify(contract));
  if (noRows.current_business_reality?.current) {
    noRows.current_business_reality.current.rows = [];
    noRows.current_business_reality.current.summary = null;
  }
  noRows.current_business_reality = emptyNode();
  const vmNoRows = projectBusinessEngineVisualV2(noRows, {
    currentMetrics: [{ label: 'Fake GCI', value: '$1,000,000' }],
  });
  assert(vmNoRows.current_business_reality.metrics.length === 0, 'invented financial metrics', failures);
  assert(
    !JSON.stringify(vmNoRows.current_business_reality).includes('1,000,000'),
    'side-channel money leaked',
    failures
  );

  results.cases['16_no_invented_evidence_or_financials'] = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// Hierarchy + subscription compatibility flags (current-state only)
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const vm = projectBusinessEngineVisualV2(contract);

  assert(vm.governing_business_pattern.available, 'GBP missing', failures);
  assert(vm.behavioral_modifier.available, 'behavioral missing', failures);
  assert(vm.primary_constraint.available, 'constraint missing', failures);
  assert(Array.isArray(vm.causal_chain) && vm.causal_chain.length === 3, 'causal chain unique intelligence only', failures);
  assert(vm.identity.snapshot_mode === true, 'snapshot mode', failures);
  assert(vm.temporal.assessment_snapshot === true, 'assessment snapshot', failures);
  assert(vm.identity.last_updated || vm.temporal.last_updated, 'last updated', failures);
  // Subscription-compatible fields exist; runtime not built.
  assert('previous' in vm.temporal, 'temporal.previous missing', failures);
  assert('trend' in vm.temporal, 'temporal.trend missing', failures);
  assert('reason_for_change' in vm.temporal, 'temporal.reason_for_change missing', failures);

  const v2 = readSource('src/components/businessAssessment/BusinessEngineVisualV2.jsx');
  assert(/data-region="governing-business-pattern"/.test(v2), 'GBP region', failures);
  assert(/data-region="behavioral-modifier"/.test(v2), 'behavioral region', failures);
  assert(/data-region="one-move"/.test(v2), 'one move region', failures);
  assert(/data-region="confidence-reality"/.test(v2), 'confidence region', failures);
  assert(/data-region="relationship-lake"/.test(v2), 'lake region', failures);
  assert(/data-renderer="business-engine-visual-v2"/.test(v2), 'renderer marker', failures);

  // Contract rows projected when present
  if (Array.isArray(contract.current_business_reality?.current?.rows) && contract.current_business_reality.current.rows.length) {
    assert(vm.current_business_reality.metrics.length > 0, 'contract rows not projected', failures);
    const row = vm.current_business_reality.metrics[0];
    assert(row.label && row.value, 'projected row missing label/value', failures);
    assert('availability' in row, 'projected row missing availability', failures);
    assert('basis' in row, 'projected row missing basis', failures);
    assert('fallback_used' in row, 'projected row missing fallback_used', failures);
    assert('confidence' in row, 'projected row missing confidence', failures);
    assert('provenance' in row, 'projected row missing provenance', failures);
  }

  results.cases['17_hierarchy_and_subscription_compatibility'] = {
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
const outName = 'mmm8_renderer_v2_adversarial_fixture_validation.json';
writeValidationResults(outName, results);

console.log(JSON.stringify(results.summary, null, 2));
if (!results.summary.all_passed) {
  for (const [name, c] of Object.entries(results.cases)) {
    if (!c.passed) console.error(name, c.failures);
  }
  process.exit(1);
}
