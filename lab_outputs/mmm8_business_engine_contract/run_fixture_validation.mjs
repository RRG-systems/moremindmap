/**
 * Deterministic fixture validation for MMM8 Business Engine Contract + repair.
 * No new packages. Run: node lab_outputs/mmm8_business_engine_contract/run_fixture_validation.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

const { normalizeBusinessVisualArtifactData } = await import(
  pathToFileURL(join(root, 'src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js')).href
);
const {
  buildBusinessEngineContract,
  validateBusinessEngineContract,
  CONTRACT_VERSION,
  REQUIRED_TOP_LEVEL_DOMAINS,
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

function stripIntelligence(record) {
  const clone = JSON.parse(JSON.stringify(record));
  const assessment = findAssessment(clone) || clone.assessment || clone;
  if (assessment.output) {
    delete assessment.output.business_intelligence_draft;
    delete assessment.output.executive_diagnostic_briefing_v1;
    delete assessment.output.five_futures_v1;
    delete assessment.output.one_move_v1;
  }
  return { assessment };
}

function olderAssessmentCompat(record) {
  // Simulate older assessment: keep draft constraint only, drop futures/one move
  const clone = JSON.parse(JSON.stringify(record));
  const assessment = findAssessment(clone);
  if (assessment?.output) {
    delete assessment.output.five_futures_v1;
    delete assessment.output.one_move_v1;
    delete assessment.output.executive_diagnostic_briefing_v1;
  }
  return { assessment };
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function modelNameLeak(value, path = '', leaks = []) {
  if (value === null || value === undefined) return leaks;
  if (typeof value === 'string') {
    if (/\b(gpt-?4|gpt-?5|claude|o1|gemini|openai|anthropic)\b/i.test(value)) {
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
    if (['source_artifact', 'source_path', 'path', 'artifact'].includes(k)) continue;
    modelNameLeak(v, path ? `${path}.${k}` : k, leaks);
  }
  return leaks;
}

function readRendererSource() {
  return readFileSync(join(root, 'src/components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx'), 'utf8');
}

const fixture = loadJson('src/lab/fixtures/tammyBaRetrieveFull.json');
const assessment = findAssessment(fixture);
const record = { assessment, has_business_intelligence_draft: true, has_five_futures: true, has_one_move: true };

const results = {
  mission_id: 'MMM8_BUSINESS_ENGINE_CONTRACT_AND_INTELLIGENCE_ROUTING_REPAIR',
  contract_version: CONTRACT_VERSION,
  cases: {},
  summary: {},
};

// Case 1: strong intelligence available + repaired semantics
{
  const failures = [];
  const normalized = normalizeBusinessVisualArtifactData(record);
  const contract = normalized.businessEngineContract;
  const validation = validateBusinessEngineContract(contract);
  const currentFuture = (assessment.output?.five_futures_v1?.futures || []).find((f) => f?.key === 'current_future');
  const shiftExplanation = assessment.output?.one_move_v1?.expected_probability_shift?.explanation;

  assert(validation.valid, `validator failed: ${validation.errors.join('; ')}`, failures);
  for (const domain of REQUIRED_TOP_LEVEL_DOMAINS) {
    assert(domain in contract, `missing domain ${domain}`, failures);
  }
  assert(contract.contract_metadata.contract_version === CONTRACT_VERSION, 'version mismatch', failures);
  assert(contract.current_trajectory?.current, 'current trajectory missing', failures);
  assert(
    !/stable\. not scaling/i.test(JSON.stringify(normalized.businessMap?.currentTrajectory || {})),
    'weak trajectory caption still present',
    failures
  );
  assert(
    /tammy|systems|relationship|constraint|trajectory|drag|crm/i.test(
      String(normalized.businessMap?.currentTrajectory?.line || '') +
        String(normalized.businessMap?.currentTrajectory?.caption || '')
    ),
    'current trajectory not routed from intelligence',
    failures
  );
  assert(
    !/growing\. predictable\. scalable/i.test(
      JSON.stringify(normalized.businessMap?.potentialTrajectory || {})
    ),
    'static potential trajectory still present',
    failures
  );
  assert(
    /systemized|crm|relationship|optimized|shift|future/i.test(
      String(normalized.businessMap?.potentialTrajectory?.line || '') +
        String(normalized.businessMap?.potentialTrajectory?.caption || '')
    ),
    'potential trajectory not routed from futures/one move',
    failures
  );
  const opportunity = (normalized.businessMap?.chain || []).find((c) => c.title === 'Opportunity');
  assert(opportunity, 'opportunity chain missing', failures);
  assert(
    !/grow the lake toward/i.test(String(opportunity?.body || '')),
    'opportunity still uses lake-arithmetic override',
    failures
  );
  assert(
    /crm|relationship|system|why|constraint|move|document/i.test(String(opportunity?.body || '')),
    'opportunity not from One Move intelligence',
    failures
  );
  assert(contract.one_move?.current?.title, 'one move title missing', failures);
  assert(/90-Day CRM/i.test(contract.one_move.current.title), 'one move title mismatch', failures);
  assert(contract.confidence_reality?.current?.known?.length >= 1, 'confidence known missing', failures);
  assert(Array.isArray(contract.confidence_reality.current.missing), 'confidence missing list absent', failures);
  assert(contract.truth_boundaries?.current, 'truth boundaries missing', failures);
  assert(contract.behavioral_modifier?.current, 'behavioral modifier missing', failures);
  assert(contract.governing_business_pattern?.current, 'governing pattern missing', failures);
  assert(contract.relationship_lake?.streams?.current?.length > 0, 'streams empty', failures);
  assert(contract.relationship_lake?.outflow?.current?.length > 0, 'outflow empty', failures);
  assert(contract.footer_intelligence?.current?.personalized === true, 'footer not personalized', failures);
  assert(contract.current_trajectory?.previous === null, 'previous should be null on snapshot', failures);
  assert(contract.current_trajectory?.trend === 'baseline', 'trend baseline expected', failures);
  assert(
    /initial assessment snapshot/i.test(String(contract.current_trajectory?.reason_for_change || '')),
    'reason_for_change snapshot expected',
    failures
  );
  assert(Array.isArray(contract.current_trajectory?.evidence_sources), 'evidence_sources missing', failures);
  assert(contract.current_trajectory?.last_updated, 'last_updated missing', failures);
  assert(contract.current_trajectory?.provenance?.source_path, 'provenance missing', failures);
  const leaks = modelNameLeak(contract.one_move?.current)
    .concat(modelNameLeak(contract.footer_intelligence?.current))
    .concat(modelNameLeak(contract.identity));
  assert(leaks.length === 0, `model name leak: ${leaks.join('; ')}`, failures);

  // --- Repair assertions: Truth Rail upstream ---
  assert(Array.isArray(contract.truth_rail?.current) && contract.truth_rail.current.length >= 6, 'truth_rail entries missing', failures);
  assert(
    contract.truth_rail.current.every((e) => e && e.label && e.status && typeof e.note === 'string'),
    'truth_rail entries missing final label/status/note',
    failures
  );
  assert(Array.isArray(normalized.truthRail) && normalized.truthRail.length >= 6, 'normalized.truthRail missing', failures);

  // --- Repair assertions: streams/outflow provenance ---
  const streams = contract.relationship_lake.streams;
  const outflow = contract.relationship_lake.outflow;
  assert(
    streams.fallback_used === false,
    'profile-scoped deterministic streams must not masquerade as shared fallback',
    failures
  );
  assert(streams.fallback_reason === null, 'individualized streams must not carry a fallback reason', failures);
  assert(
    streams.source_type === 'deterministic_normalized',
    `individualized streams source_type must be deterministic_normalized, got ${streams.source_type}`,
    failures
  );
  assert(
    streams.intelligence_status === 'partial',
    `individualized deterministic streams must remain partial, got ${streams.intelligence_status}`,
    failures
  );
  assert(
    streams.evidence_sources?.length > 0,
    'individualized streams require profile-scoped evidence',
    failures
  );
  assert(
    outflow.fallback_used === false,
    'profile-scoped deterministic outflow must not masquerade as shared fallback',
    failures
  );
  assert(outflow.fallback_reason === null, 'individualized outflow must not carry a fallback reason', failures);
  assert(
    outflow.source_type === 'deterministic_normalized',
    `individualized outflow source_type must be deterministic_normalized, got ${outflow.source_type}`,
    failures
  );
  assert(
    outflow.intelligence_status === 'partial',
    `individualized deterministic outflow must remain partial, got ${outflow.intelligence_status}`,
    failures
  );
  assert(
    outflow.evidence_sources?.length > 0,
    'individualized outflow requires profile-scoped evidence',
    failures
  );
  const outflowNames = (outflow.current || []).map((item) => String(item?.name || item));
  assert(
    !outflowNames.some((name) => /lead shortage possible/i.test(name)),
    'invalid outflow label Lead Shortage Possible still present',
    failures
  );
  assert(
    !outflowNames.some((name) => /\.\.\./.test(name) || name.length > 42),
    'clipped/truncated outflow labels still present',
    failures
  );
  assert(
    !outflowNames.some((name) => /all known contacts|overdue follow-up|weekly inspection|can state how many/i.test(name)),
    'prose-fragment outflow labels still present',
    failures
  );

  // --- Repair assertions: no-change consequence priority ---
  assert(contract.no_change_consequence?.current, 'no_change_consequence missing', failures);
  assert(
    contract.no_change_consequence.current === currentFuture?.risk_if_unchanged,
    'no_change_consequence must prefer current future risk_if_unchanged',
    failures
  );
  assert(
    /futures\[current_future\]\.risk_if_unchanged/.test(
      String(contract.no_change_consequence.provenance?.source_path || '')
    ),
    'no_change_consequence provenance path incorrect',
    failures
  );
  assert(
    shiftExplanation && contract.no_change_consequence.current !== shiftExplanation,
    'One Move expected_probability_shift.explanation must not be primary no-change consequence',
    failures
  );
  assert(
    !/expected_probability_shift/.test(String(contract.no_change_consequence.provenance?.source_path || '')),
    'no_change_consequence provenance must not be expected_probability_shift',
    failures
  );

  results.cases.strong_intelligence_available = {
    pass: failures.length === 0,
    failures,
    samples: {
      current_trajectory_caption: normalized.businessMap?.currentTrajectory?.caption,
      current_trajectory_line: normalized.businessMap?.currentTrajectory?.line,
      potential_trajectory_caption: normalized.businessMap?.potentialTrajectory?.caption,
      opportunity: opportunity?.body,
      one_move_title: contract.one_move?.current?.title,
      streams: (contract.relationship_lake?.streams?.current || []).map((s) => s.name || s).slice(0, 8),
      streams_fallback: contract.relationship_lake?.streams?.fallback_used,
      streams_source_type: contract.relationship_lake?.streams?.source_type,
      outflow: outflowNames.slice(0, 8),
      outflow_fallback: contract.relationship_lake?.outflow?.fallback_used,
      outflow_source_type: contract.relationship_lake?.outflow?.source_type,
      no_change_consequence: String(contract.no_change_consequence?.current || '').slice(0, 160),
      no_change_source_path: contract.no_change_consequence?.provenance?.source_path,
      truth_rail_labels: (contract.truth_rail?.current || []).map((e) => `${e.label}:${e.status}`),
      confidence_band: contract.confidence_reality?.current?.confidence_band,
      footer: contract.footer_intelligence?.current,
      validation_errors: validation.errors,
      validation_warnings_count: validation.warnings.length,
    },
  };
}

// Case 2: absent intelligence
{
  const failures = [];
  const emptyRecord = stripIntelligence(record);
  const contract = buildBusinessEngineContract(emptyRecord);
  const validation = validateBusinessEngineContract(contract);
  assert(validation.valid, `empty validator failed: ${validation.errors.join('; ')}`, failures);
  assert(
    contract.one_move?.intelligence_status === 'absent' || contract.one_move?.current === null,
    'one move should be absent',
    failures
  );
  assert(
    contract.current_trajectory?.intelligence_status === 'absent' ||
      contract.current_trajectory?.current === null,
    'trajectory should be absent',
    failures
  );
  assert(
    contract.modeled_opportunity?.current === null ||
      contract.modeled_opportunity?.intelligence_status === 'absent',
    'modeled opportunity should not invent values',
    failures
  );
  // Modeled-not-guaranteed must be explicit (no unconditional bypass).
  assert(
    contract.modeled_opportunity?.extra?.modeled_not_guaranteed === true ||
      contract.modeled_opportunity?.modeled_not_guaranteed === true,
    'modeled_not_guaranteed flag must be true on modeled_opportunity node',
    failures
  );
  results.cases.absent_intelligence = {
    pass: failures.length === 0,
    failures,
    samples: {
      one_move_status: contract.one_move?.intelligence_status,
      trajectory_status: contract.current_trajectory?.intelligence_status,
      opportunity_status: contract.modeled_opportunity?.intelligence_status,
      modeled_not_guaranteed:
        contract.modeled_opportunity?.extra?.modeled_not_guaranteed ??
        contract.modeled_opportunity?.modeled_not_guaranteed ??
        null,
    },
  };
}

// Case 3: older assessment compatibility (draft only)
{
  const failures = [];
  const older = olderAssessmentCompat(record);
  const normalized = normalizeBusinessVisualArtifactData(older);
  const contract = normalized.businessEngineContract;
  assert(contract, 'contract missing on older assessment', failures);
  assert(validateBusinessEngineContract(contract).valid, 'older contract invalid', failures);
  assert(normalized.businessMap, 'businessMap missing', failures);
  assert(Array.isArray(normalized.businessMap.chain), 'chain missing', failures);
  assert(contract.primary_constraint?.current, 'constraint should still route from draft', failures);
  assert(
    contract.one_move?.intelligence_status === 'absent' || !contract.one_move?.current?.title,
    'one move should be absent without one_move_v1',
    failures
  );
  assert(Array.isArray(contract.truth_rail?.current), 'older assessment truth_rail missing', failures);
  results.cases.older_assessment_compatibility = {
    pass: failures.length === 0,
    failures,
    samples: {
      constraint: contract.primary_constraint?.current?.name,
      one_move_status: contract.one_move?.intelligence_status,
      has_map_chain: normalized.businessMap.chain.length,
      truth_rail_count: contract.truth_rail?.current?.length ?? 0,
    },
  };
}

// Case 4: fallback path metadata explicit
{
  const failures = [];
  const weak = stripIntelligence(record);
  // Keep only answers so RE legacy streams may engage
  const contract = buildBusinessEngineContract(weak);
  const streams = contract.relationship_lake?.streams;
  if (streams?.fallback_used) {
    assert(streams.fallback_reason, 'fallback_reason missing when fallback_used', failures);
    assert(
      streams.source_type === 'legacy_fallback' ||
        streams.source_type === 'deterministic_normalized' ||
        streams.fallback_used === true,
      'source_type',
      failures
    );
  } else {
    // absence is also valid
    assert(
      streams?.intelligence_status === 'absent' || Array.isArray(streams?.current),
      'streams node invalid',
      failures
    );
  }
  assert(Array.isArray(contract.contract_metadata.legacy_fallbacks_used), 'legacy_fallbacks_used missing', failures);
  results.cases.fallback_path = {
    pass: failures.length === 0,
    failures,
    samples: {
      streams_fallback_used: streams?.fallback_used,
      streams_fallback_reason: streams?.fallback_reason,
      streams_source_type: streams?.source_type,
      legacy_fallbacks_used: contract.contract_metadata.legacy_fallbacks_used,
    },
  };
}

// Case 5: provenance + temporal + no model names (aggregate)
{
  const failures = [];
  const normalized = normalizeBusinessVisualArtifactData(record);
  const c = normalized.businessEngineContract;
  const nodes = [
    c.current_trajectory,
    c.potential_trajectory,
    c.primary_constraint,
    c.one_move,
    c.confidence_reality,
    c.truth_rail,
  ];
  for (const node of nodes) {
    assert(node && 'previous' in node, 'previous field missing', failures);
    assert(node && 'trend' in node, 'trend field missing', failures);
    assert(node && 'reason_for_change' in node, 'reason_for_change missing', failures);
    assert(node && 'evidence_sources' in node, 'evidence_sources missing', failures);
    assert(node && 'last_updated' in node, 'last_updated missing', failures);
    assert(node && node.provenance, 'provenance missing', failures);
  }
  const leaks = modelNameLeak(c);
  assert(leaks.length === 0, `leaks: ${leaks.join('; ')}`, failures);
  results.cases.provenance_temporal_no_model_names = {
    pass: failures.length === 0,
    failures,
    leak_count: leaks.length,
  };
}

// Case 6: renderer Truth Rail purity (source scan)
{
  const failures = [];
  const source = readRendererSource();
  assert(!/function\s+buildTruthRailFromContract\b/.test(source), 'renderer still defines buildTruthRailFromContract', failures);
  assert(!/function\s+bandToStatus\b/.test(source), 'renderer still defines bandToStatus', failures);
  assert(!/function\s+statusFromConfidence\b/.test(source), 'renderer still defines statusFromConfidence', failures);
  assert(/function\s+selectTruthRailEntries\b/.test(source), 'renderer missing selectTruthRailEntries bind helper', failures);
  assert(
    !/hasFinancialMissing|hasRelationshipKnown|hasBehavioral/.test(source),
    'renderer still performs semantic truth-rail classification',
    failures
  );
  // Financial/relationship/behavioral regex classification must not remain in renderer truth-rail path.
  assert(
    !/financial\|gci\|profit\|expense\|p_and_l\|net/i.test(source),
    'renderer still contains financial status regex',
    failures
  );
  assert(
    !/relationship\|database\|contact\|q3/i.test(source),
    'renderer still contains relationship status regex',
    failures
  );
  assert(
    !/behavioral\|profile\|dimension/i.test(source),
    'renderer still contains behavioral status regex',
    failures
  );
  results.cases.renderer_truth_rail_purity = {
    pass: failures.length === 0,
    failures,
  };
}

const caseList = Object.values(results.cases);
results.summary = {
  total_cases: caseList.length,
  passed: caseList.filter((c) => c.pass).length,
  failed: caseList.filter((c) => !c.pass).length,
  all_passed: caseList.every((c) => c.pass),
};

const outPath = join(__dirname, 'mmm8_business_engine_fixture_validation.json');
mkdirSync(__dirname, { recursive: true });
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.summary, null, 2));
if (!results.summary.all_passed) {
  console.error(JSON.stringify(results.cases, null, 2));
  process.exit(1);
}
console.log('FIXTURE_VALIDATION_PASSED');
