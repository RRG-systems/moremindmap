/**
 * End-to-end fixtures for
 * MMM8_BUSINESS_ENGINE_POTENTIAL_TRAJECTORY_DIRECTION_REPAIR.
 *
 * Run: node lab_outputs/mmm8_potential_trajectory_direction_repair/run_fixture_validation.mjs
 */

import { accessSync, constants, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const bridgeOut = join(
  root,
  '../moremindmap-agent-bridge/lab_outputs/mmm8_potential_trajectory_direction_repair'
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

const {
  buildBusinessEngineContract,
  validateBusinessEngineContract,
  projectBusinessEngineVisualV2,
  CONTRACT_VERSION,
  buildTrajectoryVisualization,
  normalizeVisualizationDirection,
  resolvePotentialTrajectoryDirection,
  isFutureCategoryDirectionLabel,
  TRAJECTORY_DIRECTIONS,
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

function pointsAscending(points) {
  if (!Array.isArray(points) || points.length < 2) return false;
  return points[0].y < points[points.length - 1].y;
}

function pointsDescending(points) {
  if (!Array.isArray(points) || points.length < 2) return false;
  return points[0].y > points[points.length - 1].y;
}

function pointsFlatish(points) {
  if (!Array.isArray(points) || points.length < 2) return false;
  const ys = points.map((p) => p.y);
  return Math.max(...ys) - Math.min(...ys) < 0.15;
}

/**
 * Build a contract from Tammy fixture with overrides applied to a named future.
 */
function buildWithFutureOverrides(futureKey, overrides = {}) {
  const fixture = loadJson('src/lab/fixtures/tammyBaRetrieveFull.json');
  const assessment = findAssessment(fixture);
  const clone = JSON.parse(JSON.stringify({ assessment }));
  const a = findAssessment(clone);
  const futures = a?.output?.five_futures_v1?.futures;
  if (Array.isArray(futures)) {
    const idx = futures.findIndex((f) => f?.key === futureKey);
    if (idx >= 0) {
      futures[idx] = { ...futures[idx], ...overrides };
    }
  }
  return buildBusinessEngineContract({
    assessment: a,
    has_business_intelligence_draft: true,
    has_five_futures: true,
    has_one_move: true,
  });
}

/**
 * Build with only a synthetic optimized future (category alone, no direction).
 */
function buildCategoryOnlyPotential(futureKey = 'optimized_future') {
  const fixture = loadJson('src/lab/fixtures/tammyBaRetrieveFull.json');
  const assessment = findAssessment(fixture);
  const clone = JSON.parse(JSON.stringify({ assessment }));
  const a = findAssessment(clone);
  if (a?.output?.five_futures_v1) {
    a.output.five_futures_v1.futures = [
      {
        key: futureKey,
        label: futureKey === 'transformational_future' ? 'Transformational Future' : 'Optimized Future',
        title: 'Category-only future',
        summary: 'A modeled future narrative with no direction fields present.',
        required_shift: 'Do the structural work.',
        confidence: 'medium',
      },
    ];
  }
  // Remove one_move so shift path cannot supply direction inventively.
  if (a?.output) delete a.output.one_move_v1;
  return buildBusinessEngineContract({
    assessment: a,
    has_business_intelligence_draft: true,
    has_five_futures: true,
    has_one_move: false,
  });
}

const results = {
  mission_id: 'MMM8_BUSINESS_ENGINE_POTENTIAL_TRAJECTORY_DIRECTION_REPAIR',
  contract_version: CONTRACT_VERSION,
  cases: {},
  summary: {},
  generated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// 1) Optimized future + explicit declining → declining (not rising)
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildWithFutureOverrides('optimized_future', {
    direction: 'declining',
    expected_direction: 'declining',
    summary:
      'Even the optimized path is modeled as declining under residual systems drag and incomplete adoption.',
  });
  const pot = contract.potential_trajectory;
  const viz = pot?.visualization || pot?.current?.visualization;
  assert(pot?.current?.future_category === 'optimized_future', 'future_category not preserved', failures);
  assert(pot?.current?.direction === 'declining', `raw direction=${pot?.current?.direction}`, failures);
  assert(viz?.direction === 'declining', `viz direction=${viz?.direction}`, failures);
  assert(viz?.direction !== 'rising', 'optimized declining coerced to rising', failures);
  assert(viz?.shape === 'descending', `shape=${viz?.shape}`, failures);
  assert(pointsDescending(viz?.points), 'points not descending for declining', failures);
  assert(!pointsAscending(viz?.points), 'points still ascending', failures);

  const vm = projectBusinessEngineVisualV2(contract);
  assert(
    vm.potential_trajectory.visualization?.direction === 'declining',
    'projection rewrote declining',
    failures
  );

  results.cases.optimized_declining_preserved = {
    passed: failures.length === 0,
    failures,
    direction: viz?.direction,
    shape: viz?.shape,
    future_category: pot?.current?.future_category,
  };
}

// ---------------------------------------------------------------------------
// 2) Transformational future + explicit stable → stable
// ---------------------------------------------------------------------------
{
  const failures = [];
  // Force transformational selection by removing optimized summary/shift content.
  const fixture = loadJson('src/lab/fixtures/tammyBaRetrieveFull.json');
  const assessment = findAssessment(fixture);
  const clone = JSON.parse(JSON.stringify({ assessment }));
  const a = findAssessment(clone);
  const futures = a?.output?.five_futures_v1?.futures || [];
  for (const f of futures) {
    if (f.key === 'optimized_future') {
      f.summary = null;
      f.required_shift = null;
      f.title = null;
    }
    if (f.key === 'transformational_future') {
      f.direction = 'stable';
      f.expected_direction = 'stable';
      f.summary = 'Transformational path holds steady after the first system plateau.';
    }
  }
  const contract = buildBusinessEngineContract({
    assessment: a,
    has_business_intelligence_draft: true,
    has_five_futures: true,
    has_one_move: true,
  });
  const pot = contract.potential_trajectory;
  const viz = pot?.visualization || pot?.current?.visualization;
  assert(
    pot?.current?.future_category === 'transformational_future' ||
      pot?.current?.direction === 'stable',
    `unexpected category/direction: cat=${pot?.current?.future_category} dir=${pot?.current?.direction}`,
    failures
  );
  assert(viz?.direction === 'stable', `viz direction=${viz?.direction}`, failures);
  assert(viz?.direction !== 'rising', 'transformational stable coerced to rising', failures);
  assert(viz?.shape === 'flat', `shape=${viz?.shape}`, failures);
  assert(pointsFlatish(viz?.points), 'stable points not flatish', failures);
  assert(!pointsAscending(viz?.points), 'stable points ascending', failures);

  results.cases.transformational_stable_preserved = {
    passed: failures.length === 0,
    failures,
    direction: viz?.direction,
    shape: viz?.shape,
    future_category: pot?.current?.future_category,
  };
}

// ---------------------------------------------------------------------------
// 3) Preferred future + explicit unknown → unknown
// ---------------------------------------------------------------------------
{
  const failures = [];
  const fixture = loadJson('src/lab/fixtures/tammyBaRetrieveFull.json');
  const assessment = findAssessment(fixture);
  const clone = JSON.parse(JSON.stringify({ assessment }));
  const a = findAssessment(clone);
  if (a?.output?.five_futures_v1) {
    a.output.five_futures_v1.futures = [
      {
        key: 'optimized_future',
        label: 'Preferred Future',
        title: 'Preferred path',
        summary: 'Preferred future without motion claim.',
        required_shift: 'Stay disciplined.',
        direction: 'unknown',
        expected_direction: 'unknown',
        // Category-like preferred label must not invent rising.
        future_role: 'preferred_future',
      },
    ];
  }
  if (a?.output) delete a.output.one_move_v1;
  const contract = buildBusinessEngineContract({
    assessment: a,
    has_business_intelligence_draft: true,
    has_five_futures: true,
    has_one_move: false,
  });
  const viz =
    contract.potential_trajectory?.visualization ||
    contract.potential_trajectory?.current?.visualization;
  assert(viz?.direction === 'unknown', `viz direction=${viz?.direction}`, failures);
  assert(viz?.direction !== 'rising', 'preferred unknown coerced to rising', failures);
  assert(
    viz?.availability === 'text_only' || viz?.shape === 'none' || !viz?.points,
    'unknown still charted as rising',
    failures
  );
  assert(viz?.shape === 'none' || !viz?.points, `shape=${viz?.shape}`, failures);

  results.cases.preferred_unknown_preserved = {
    passed: failures.length === 0,
    failures,
    direction: viz?.direction,
    availability: viz?.availability,
    shape: viz?.shape,
  };
}

// ---------------------------------------------------------------------------
// 4) Future category alone does not produce rising
// ---------------------------------------------------------------------------
{
  const failures = [];
  for (const key of ['optimized_future', 'transformational_future']) {
    const contract = buildCategoryOnlyPotential(key);
    const pot = contract.potential_trajectory;
    const viz = pot?.visualization || pot?.current?.visualization;
    assert(pot?.current?.future_category === key, `${key}: category missing`, failures);
    assert(pot?.current?.direction !== key, `${key}: category stored as direction`, failures);
    assert(viz?.direction !== 'rising', `${key}: category alone produced rising`, failures);
    assert(
      viz?.direction === 'unknown',
      `${key}: expected unknown got ${viz?.direction}`,
      failures
    );
  }

  results.cases.category_alone_not_rising = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// 5) Absent direction does not produce rising
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildCategoryOnlyPotential('optimized_future');
  const pot = contract.potential_trajectory;
  const viz = pot?.visualization || pot?.current?.visualization;
  assert(pot?.current?.direction === 'unknown', `raw=${pot?.current?.direction}`, failures);
  assert(viz?.direction === 'unknown', `viz=${viz?.direction}`, failures);
  assert(viz?.direction !== 'rising', 'absent direction became rising', failures);
  assert(
    pot?.current?.direction_basis === 'no_supported_direction' ||
      pot?.current?.direction_basis === 'honest_absence' ||
      pot?.current?.direction_basis === 'explicit_unknown',
    `basis=${pot?.current?.direction_basis}`,
    failures
  );

  results.cases.absent_direction_not_rising = {
    passed: failures.length === 0,
    failures,
    direction: viz?.direction,
    basis: pot?.current?.direction_basis,
  };
}

// ---------------------------------------------------------------------------
// 6) Explicit rising still renders rising
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildWithFutureOverrides('optimized_future', {
    direction: 'rising',
    expected_direction: 'rising',
  });
  const viz =
    contract.potential_trajectory?.visualization ||
    contract.potential_trajectory?.current?.visualization;
  assert(viz?.direction === 'rising', `direction=${viz?.direction}`, failures);
  assert(viz?.shape === 'ascending', `shape=${viz?.shape}`, failures);
  assert(pointsAscending(viz?.points), 'rising points not ascending', failures);

  results.cases.explicit_rising_preserved = {
    passed: failures.length === 0,
    failures,
    direction: viz?.direction,
    shape: viz?.shape,
  };
}

// ---------------------------------------------------------------------------
// 7) Explicit declining creates non-rising points
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildWithFutureOverrides('optimized_future', { direction: 'declining' });
  const viz =
    contract.potential_trajectory?.visualization ||
    contract.potential_trajectory?.current?.visualization;
  assert(viz?.direction === 'declining', `direction=${viz?.direction}`, failures);
  assert(pointsDescending(viz?.points), 'declining points not descending', failures);
  assert(!pointsAscending(viz?.points), 'declining points ascending', failures);

  results.cases.explicit_declining_non_rising_points = {
    passed: failures.length === 0,
    failures,
    points: viz?.points,
  };
}

// ---------------------------------------------------------------------------
// 8) Explicit stable creates non-rising points
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildWithFutureOverrides('optimized_future', { direction: 'stable' });
  const viz =
    contract.potential_trajectory?.visualization ||
    contract.potential_trajectory?.current?.visualization;
  assert(viz?.direction === 'stable', `direction=${viz?.direction}`, failures);
  assert(pointsFlatish(viz?.points), 'stable points not flat', failures);
  assert(!pointsAscending(viz?.points), 'stable points ascending', failures);

  results.cases.explicit_stable_non_rising_points = {
    passed: failures.length === 0,
    failures,
    points: viz?.points,
  };
}

// ---------------------------------------------------------------------------
// 9) Unknown creates no false rising shape
// ---------------------------------------------------------------------------
{
  const failures = [];
  const contract = buildWithFutureOverrides('optimized_future', { direction: 'unknown' });
  const viz =
    contract.potential_trajectory?.visualization ||
    contract.potential_trajectory?.current?.visualization;
  assert(viz?.direction === 'unknown', `direction=${viz?.direction}`, failures);
  assert(viz?.shape === 'none' || !viz?.points, `shape=${viz?.shape}`, failures);
  assert(viz?.direction !== 'rising', 'unknown became rising', failures);
  assert(
    viz?.availability === 'text_only' || viz?.availability === 'unavailable',
    `availability=${viz?.availability}`,
    failures
  );

  results.cases.unknown_no_false_rising_shape = {
    passed: failures.length === 0,
    failures,
    shape: viz?.shape,
    availability: viz?.availability,
  };
}

// ---------------------------------------------------------------------------
// 10) Direction source priority order
// ---------------------------------------------------------------------------
{
  const failures = [];
  // visualization.direction wins over direction / expected_direction / category
  const r1 = resolvePotentialTrajectoryDirection({
    visualization: { direction: 'declining' },
    direction: 'rising',
    expected_direction: 'stable',
    key: 'optimized_future',
  });
  assert(r1.direction === 'declining', `viz priority failed: ${r1.direction}`, failures);
  assert(r1.source_path === 'visualization.direction', `path=${r1.source_path}`, failures);

  // direction wins over expected_direction when viz absent
  const r2 = resolvePotentialTrajectoryDirection({
    direction: 'stable',
    expected_direction: 'rising',
  });
  assert(r2.direction === 'stable', `direction priority failed: ${r2.direction}`, failures);

  // expected_direction when direction absent
  const r3 = resolvePotentialTrajectoryDirection({
    expected_direction: 'declining',
  });
  assert(r3.direction === 'declining', `expected_direction failed: ${r3.direction}`, failures);

  // category alone → unknown
  const r4 = resolvePotentialTrajectoryDirection({
    direction: 'optimized_future',
    expected_direction: 'transformational_future',
  });
  assert(r4.direction === 'unknown', `category not unknown: ${r4.direction}`, failures);

  // signal supported evidence
  const r5 = resolvePotentialTrajectoryDirection({
    signal: 'systems_drag',
  });
  assert(r5.direction === 'declining', `signal not declining: ${r5.direction}`, failures);

  results.cases.direction_source_priority = {
    passed: failures.length === 0,
    failures,
    samples: { r1, r2, r3, r4, r5 },
  };
}

// ---------------------------------------------------------------------------
// 11) Category / direction separation helpers
// ---------------------------------------------------------------------------
{
  const failures = [];
  for (const label of [
    'optimized_future',
    'transformational_future',
    'preferred_future',
    'target_future',
    'Optimized Future',
    'modeled shift',
    'optimized/transformational',
  ]) {
    assert(isFutureCategoryDirectionLabel(label) === true, `not flagged: ${label}`, failures);
    assert(
      normalizeVisualizationDirection(label, { role: 'potential' }) === 'unknown',
      `normalized rising for ${label}`,
      failures
    );
  }
  for (const dir of TRAJECTORY_DIRECTIONS) {
    assert(isFutureCategoryDirectionLabel(dir) === false, `direction flagged as category: ${dir}`, failures);
  }

  results.cases.category_direction_separation = {
    passed: failures.length === 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// 12) Real Tammy fixture regression — category alone path is unknown, not rising
// ---------------------------------------------------------------------------
{
  const failures = [];
  const fixture = loadJson('src/lab/fixtures/tammyBaRetrieveFull.json');
  const assessment = findAssessment(fixture);
  const contract = buildBusinessEngineContract({
    assessment,
    has_business_intelligence_draft: true,
    has_five_futures: true,
    has_one_move: true,
  });
  const validation = validateBusinessEngineContract(contract);
  assert(validation.valid, `contract invalid: ${validation.errors?.join('; ')}`, failures);
  assert(contract.potential_trajectory?.current?.future_category === 'optimized_future', 'category', failures);
  const viz = contract.potential_trajectory?.visualization;
  // Tammy optimized future has no explicit direction → unknown (not invented rising).
  assert(viz?.direction === 'unknown', `tammy potential dir=${viz?.direction}`, failures);
  assert(viz?.direction !== 'rising', 'tammy still auto-rising', failures);
  assert(contract.current_trajectory?.visualization?.direction, 'current traj missing', failures);

  const vm = projectBusinessEngineVisualV2(contract);
  assert(
    vm.potential_trajectory.visualization?.direction === 'unknown',
    'projection invented rising for Tammy potential',
    failures
  );

  results.cases.tammy_fixture_no_invented_rising = {
    passed: failures.length === 0,
    failures,
    potential_direction: viz?.direction,
    current_direction: contract.current_trajectory?.visualization?.direction,
    future_category: contract.potential_trajectory?.current?.future_category,
  };
}

// ---------------------------------------------------------------------------
// 13) Shape/points follow final validated direction via buildTrajectoryVisualization
// ---------------------------------------------------------------------------
{
  const failures = [];
  for (const [dir, shapeCheck] of [
    ['rising', (v) => v.shape === 'ascending' && pointsAscending(v.points)],
    ['declining', (v) => v.shape === 'descending' && pointsDescending(v.points)],
    ['stable', (v) => v.shape === 'flat' && pointsFlatish(v.points)],
    ['unknown', (v) => v.shape === 'none' && !v.points],
  ]) {
    const v = buildTrajectoryVisualization({
      current: { label: dir, summary: dir, direction: dir },
      role: 'potential',
      nodeAvailable: true,
    });
    assert(v.direction === dir, `unit dir ${dir}`, failures);
    assert(shapeCheck(v), `unit shape/points for ${dir}: shape=${v.shape}`, failures);
  }

  results.cases.shape_points_follow_direction = {
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
const outName = 'mmm8_potential_trajectory_adversarial_fixtures.json';
writeValidationResults(outName, results);

console.log(JSON.stringify(results.summary, null, 2));
if (!results.summary.all_passed) {
  for (const [name, c] of Object.entries(results.cases)) {
    if (!c.passed) console.error('FAIL', name, c.failures);
  }
  process.exit(1);
}
