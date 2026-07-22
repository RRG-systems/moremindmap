/**
 * Adversarial + regression fixtures for
 * MMM8_BUSINESS_ENGINE_CONTRACT_VISUALIZATION_SEMANTICS.
 *
 * Run: node lab_outputs/mmm8_contract_visualization_semantics/run_fixture_validation.mjs
 */

import { accessSync, constants, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const bridgeOut = join(
  root,
  '../moremindmap-agent-bridge/lab_outputs/mmm8_contract_visualization_semantics'
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
  normalizeVisualizationDirection,
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

const fixture = loadJson('src/lab/fixtures/tammyBaRetrieveFull.json');
const assessment = findAssessment(fixture);
const record = {
  assessment,
  has_business_intelligence_draft: true,
  has_five_futures: true,
  has_one_move: true,
};

const results = {
  mission_id: 'MMM8_BUSINESS_ENGINE_CONTRACT_VISUALIZATION_SEMANTICS',
  contract_version: CONTRACT_VERSION,
  cases: {},
  summary: {},
  generated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// 1) Normalized-only current metrics cannot populate V2 when contract reality null
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
  assert(
    !vm.current_business_reality.metrics.some((m) => /Injected Current|999/.test(JSON.stringify(m))),
    'injected current metric leaked',
    failures
  );
  assert(vm.meta.semantic_sources.contract_only === true, 'semantic_sources.contract_only false', failures);
  assert(vm.meta.semantic_sources.normalized === false, 'normalized still semantic source', failures);

  results.cases.normalized_only_current_blocked = {
    passed: failures.length === 0,
    failures,
    available: vm.current_business_reality.available,
    metric_count: vm.current_business_reality.metrics.length,
  };
}

// ---------------------------------------------------------------------------
// 2) Normalized-only target metrics cannot populate future when contract future null
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

  assert(vm.potential_business_future.available === false, 'future available from normalized-only', failures);
  assert(vm.potential_business_future.honest_absence === true, 'honest_absence false', failures);
  assert(
    !vm.potential_business_future.metrics.some((m) => /Injected Target|Potential 999/.test(JSON.stringify(m))),
    'injected target metric leaked',
    failures
  );

  results.cases.normalized_only_future_blocked = {
    passed: failures.length === 0,
    failures,
    available: vm.potential_business_future.available,
    honest_absence: vm.potential_business_future.honest_absence,
  };
}

// ---------------------------------------------------------------------------
// 3) Contract-absent future renders honest absence
// ---------------------------------------------------------------------------
{
  const failures = [];
  const clone = JSON.parse(JSON.stringify(record));
  const a = findAssessment(clone);
  if (a?.output) {
    delete a.output.five_futures_v1;
  }
  // Strip goal language that could still produce rows without future intelligence.
  if (a?.inputs?.answers) {
    a.inputs.answers.q2 = '';
    a.inputs.answers.q12 = '';
  }
  const contract = buildBusinessEngineContract(clone);
  // Force null future domain regardless of residual goal extraction.
  contract.potential_business_future = emptyNode();
  const vm = projectBusinessEngineVisualV2(contract);

  assert(vm.potential_business_future.honest_absence === true, 'honest absence missing', failures);
  assert(vm.potential_business_future.available === false, 'future still available', failures);
  assert(vm.potential_business_future.metrics.length === 0, 'future metrics present on absence', failures);
  assert(/not available/i.test(vm.potential_business_future.absence_message || ''), 'absence message', failures);

  results.cases.absent_contract_future_honest = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// 4–7) Trajectory directions: declining / stable / unknown / potential not auto-upward
// ---------------------------------------------------------------------------
{
  const failures = [];

  function trajVm(direction, role = 'current') {
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
      explicitStageLabels: direction === 'stable' ? ['A', 'B', 'C', 'D'] : undefined,
      explicitPoints:
        direction === 'declining'
          ? [
              { x: 0.1, y: 0.9 },
              { x: 0.3, y: 0.7 },
              { x: 0.6, y: 0.4 },
              { x: 0.9, y: 0.1 },
            ]
          : undefined,
    });
    const node = {
      ...emptyNode({
        current,
        intelligence_status: 'available',
        source_type: 'domain_intelligence',
      }),
      visualization: viz,
    };
    const contract = buildBusinessEngineContract(record);
    if (role === 'current') contract.current_trajectory = node;
    else contract.potential_trajectory = node;
    return projectBusinessEngineVisualV2(contract);
  }

  const declining = trajVm('declining', 'current');
  assert(
    declining.current_trajectory.visualization.direction === 'declining',
    'declining not declining',
    failures
  );
  assert(
    declining.current_trajectory.visualization.direction !== 'rising',
    'declining rendered rising',
    failures
  );
  const dPoints = declining.current_trajectory.visualization.points;
  assert(Array.isArray(dPoints) && dPoints.length === 4, 'declining points missing', failures);
  assert(dPoints[0].y > dPoints[3].y, 'declining points not descending', failures);

  const stable = trajVm('stable', 'current');
  assert(stable.current_trajectory.visualization.direction === 'stable', 'stable not stable', failures);
  assert(stable.current_trajectory.visualization.direction !== 'rising', 'stable rendered rising', failures);
  const sPoints = stable.current_trajectory.visualization.points;
  const ySpread = Math.max(...sPoints.map((p) => p.y)) - Math.min(...sPoints.map((p) => p.y));
  assert(ySpread < 0.15, `stable y-spread too large: ${ySpread}`, failures);
  assert(
    JSON.stringify(stable.current_trajectory.visualization.stage_labels) === JSON.stringify(['A', 'B', 'C', 'D']),
    'stage labels not exact',
    failures
  );

  const unknown = trajVm('unknown', 'current');
  assert(unknown.current_trajectory.visualization.direction === 'unknown', 'unknown not unknown', failures);
  assert(
    unknown.current_trajectory.visualization.direction !== 'rising',
    'unknown rendered rising',
    failures
  );
  assert(
    unknown.current_trajectory.visualization.availability === 'text_only' ||
      unknown.current_trajectory.visualization.availability === 'unavailable' ||
      !unknown.current_trajectory.visualization.points,
    'unknown still has rising chart',
    failures
  );

  // Potential without visualization must not invent rising direction.
  const potBare = buildBusinessEngineContract(record);
  potBare.potential_trajectory = emptyNode({
    current: { label: 'Bare potential', summary: 'No direction field supplied' },
    intelligence_status: 'available',
    source_type: 'domain_intelligence',
    // deliberately omit visualization and direction
  });
  const potVm = projectBusinessEngineVisualV2(potBare);
  assert(potVm.potential_trajectory.available === true, 'bare potential unavailable', failures);
  // Without contract visualization, projection must not invent rising.
  assert(
    potVm.potential_trajectory.visualization?.direction !== 'rising' ||
      potVm.potential_trajectory.visualization?.availability === 'text_only',
    'potential automatically upward without contract viz',
    failures
  );
  // Explicit declining potential must stay declining.
  const potDeclining = trajVm('declining', 'potential');
  assert(
    potDeclining.potential_trajectory.visualization.direction === 'declining',
    'potential declining became rising',
    failures
  );

  results.cases.trajectory_direction_semantics = {
    passed: failures.length === 0,
    failures,
    declining: declining.current_trajectory.visualization.direction,
    stable: stable.current_trajectory.visualization.direction,
    unknown: unknown.current_trajectory.visualization.direction,
    potential_declining: potDeclining.potential_trajectory.visualization.direction,
  };
}

// ---------------------------------------------------------------------------
// 8–9) Contract stage labels and points projected without semantic rewrite
// ---------------------------------------------------------------------------
{
  const failures = [];
  const labels = ['Alpha', 'Beta', 'Gamma', 'Delta'];
  const points = [
    { x: 0.12, y: 0.55 },
    { x: 0.33, y: 0.44 },
    { x: 0.61, y: 0.33 },
    { x: 0.88, y: 0.22 },
  ];
  const current = {
    label: 'Custom shape',
    summary: 'Custom contract visualization',
    direction: 'declining',
  };
  const viz = buildTrajectoryVisualization({
    current,
    role: 'current',
    nodeAvailable: true,
    explicitDirection: 'declining',
    explicitStageLabels: labels,
    explicitPoints: points,
  });
  const contract = buildBusinessEngineContract(record);
  contract.current_trajectory = {
    ...emptyNode({
      current,
      intelligence_status: 'available',
      source_type: 'domain_intelligence',
    }),
    visualization: viz,
  };
  const vm = projectBusinessEngineVisualV2(contract);
  assert(
    JSON.stringify(vm.current_trajectory.visualization.stage_labels) === JSON.stringify(labels),
    'stage labels rewritten',
    failures
  );
  assert(
    JSON.stringify(vm.current_trajectory.visualization.points) === JSON.stringify(points),
    'points rewritten',
    failures
  );

  results.cases.stage_labels_and_points_fidelity = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// 10) Legacy assessment retrieval remains compatible
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

  results.cases.legacy_retrieval_compatible = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// 11) Full contract validation + display rows present on real fixture
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildBusinessEngineContract(record);
  const validation = validateBusinessEngineContract(contract);
  assert(validation.valid, `contract invalid: ${validation.errors?.join('; ')}`, failures);
  assert(Array.isArray(contract.current_business_reality?.current?.rows), 'current rows missing', failures);
  assert(contract.current_business_reality.current.rows.length > 0, 'current rows empty', failures);
  assert(
    contract.current_business_reality.current.rows.every(
      (row) => row.display_value && row.availability && row.provenance
    ),
    'current row metadata incomplete',
    failures
  );
  assert(hasViz(contract.current_trajectory), 'current trajectory viz missing', failures);
  assert(hasViz(contract.potential_trajectory), 'potential trajectory viz missing', failures);
  const vm = projectBusinessEngineVisualV2(contract);
  assert(vm.current_business_reality.metrics.length > 0, 'projected current metrics empty', failures);
  assert(vm.current_trajectory.visualization?.direction, 'projected viz direction missing', failures);

  const leaks = modelNameLeak(vm);
  assert(leaks.length === 0, `model name leak: ${leaks.join('; ')}`, failures);

  results.cases.contract_display_rows_and_validation = {
    passed: failures.length === 0,
    failures,
    current_row_count: contract.current_business_reality.current.rows.length,
    future_row_count: contract.potential_business_future?.current?.rows?.length || 0,
    current_direction: contract.current_trajectory?.visualization?.direction,
    potential_direction: contract.potential_trajectory?.visualization?.direction,
  };
}

function hasViz(node) {
  return Boolean(node?.visualization?.direction || node?.current?.visualization?.direction);
}

// ---------------------------------------------------------------------------
// 12) Source purity scan — no semantic side channels / hardcoded trajectory meaning
// ---------------------------------------------------------------------------
{
  const failures = [];
  const proj = readSource('src/lib/businessEngine/projectBusinessEngineVisualV2.js');
  const v2 = readSource('src/components/businessAssessment/BusinessEngineVisualV2.jsx');

  assert(!/options\.normalized\s*\|\|/.test(proj), 'projection still reads options.normalized', failures);
  assert(!/normalized\.businessMap/.test(proj), 'projection still reads normalized.businessMap', failures);
  assert(
    !/options\.currentMetrics|options\.targetMetrics/.test(proj) ||
      /void options\.currentMetrics/.test(proj),
    'projection still uses currentMetrics/targetMetrics semantically',
    failures
  );
  assert(!/metricRowsFromPanels\(options/.test(proj), 'metricRowsFromPanels(options still present', failures);
  assert(!/\bupward\b/.test(v2), 'upward prop still in renderer', failures);
  assert(
    !/const stageLabels = upward|Baseline', 'Momentum', 'Recent', 'Now'/.test(v2),
    'fixed stage labels remain',
    failures
  );
  assert(/view\?\.visualization|view\.visualization/.test(v2), 'renderer not consuming visualization', failures);
  assert(/formatContractDisplayRows/.test(proj), 'projection not using contract display rows', failures);

  const modelInUi = `${v2}\n${proj}`.match(/\b(GPT-5\.5|gpt-5\.5|GPT-4o|gpt-4o|Claude|Gemini)\b/g) || [];
  assert(modelInUi.length === 0, `model names in UI sources: ${modelInUi.join(',')}`, failures);

  results.cases.source_purity_scan = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// Direction normalizer unit checks
// ---------------------------------------------------------------------------
{
  const failures = [];
  assert(normalizeVisualizationDirection('systems_drag') === 'declining', 'systems_drag map', failures);
  assert(normalizeVisualizationDirection('stable') === 'stable', 'stable map', failures);
  assert(normalizeVisualizationDirection('unknown') === 'unknown', 'unknown map', failures);
  assert(normalizeVisualizationDirection('') === 'unknown', 'empty map', failures);
  // Future category is NOT a direction and must never coerce to rising.
  assert(
    normalizeVisualizationDirection('optimized_future', { role: 'potential' }) === 'unknown',
    'optimized category must not become rising',
    failures
  );
  assert(
    normalizeVisualizationDirection('transformational_future', { role: 'potential' }) === 'unknown',
    'transformational category must not become rising',
    failures
  );
  assert(
    normalizeVisualizationDirection('preferred_future', { role: 'potential' }) === 'unknown',
    'preferred category must not become rising',
    failures
  );
  results.cases.direction_normalizer = {
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
const outName = 'mmm8_adversarial_fixture_validation.json';
writeValidationResults(outName, results);

console.log(JSON.stringify(results.summary, null, 2));
if (!results.summary.all_passed) {
  for (const [name, c] of Object.entries(results.cases)) {
    if (!c.passed) console.error(name, c.failures);
  }
  process.exit(1);
}
