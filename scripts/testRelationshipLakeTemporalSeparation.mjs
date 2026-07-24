import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildBusinessEngineContract,
} from '../src/lib/businessEngine/buildBusinessEngineContract.js';
import {
  OUTFLOW_TEMPORAL_CLASSES,
} from '../src/lib/businessEngine/realEstateVerticalAdapter.js';
import {
  projectBusinessEngineVisualV2,
} from '../src/lib/businessEngine/projectBusinessEngineVisualV2.js';
import {
  validateBusinessEngineContract,
} from '../src/lib/businessEngine/validateBusinessEngineContract.js';

const CURRENT_CLASSES = new Set([
  OUTFLOW_TEMPORAL_CLASSES.CURRENT_OBSERVED,
  OUTFLOW_TEMPORAL_CLASSES.CURRENT_INFERRED,
]);

function makeRecord({
  profileId = 'mm-20990101-outflow01',
  assessmentId = 'ba-20990101-outflow01',
  productionSummary = 'Current referrals create appointments and repeat business that produces GCI.',
  briefingBody = 'Current referral conversion produces appointments and repeat business.',
  conversionDiscipline = 'inconsistent',
  followUpStrength = 'partial',
  successIndicators = [
    'Appointments become consistent.',
    'Repeat business is visible.',
  ],
  expectedShift = 'Pipeline conversion and referral production improve after implementation.',
  futureRecommendation = 'A future CRM rhythm creates predictable referrals.',
  includeOneMove = true,
  includeBriefing = true,
  includeProduction = true,
} = {}) {
  const output = {
    business_intelligence_draft: {
      business_reality: includeProduction
        ? {
            current_production_reality: {
              summary: productionSummary,
            },
          }
        : {},
      lead_conversion_reality: {
        conversion_discipline: conversionDiscipline,
        follow_up_system_strength: followUpStrength,
      },
      relationship_reality: {
        diagnostic_summary: 'The current relationship database is only partially organized.',
      },
      systems_reality: {
        diagnostic_summary: 'Follow-up is inconsistent.',
      },
      behavioral_reality: {
        profile_summary: 'The synthetic operator responds best to visible weekly proof.',
      },
      behavior_business_fusion: {
        fusion_summary: 'Execution improves when the current follow-up rhythm is externally visible.',
      },
      constraint_analysis: {
        primary_constraint: {
          constraint_key: 'follow_up_consistency',
          label: 'Follow-up consistency',
          diagnostic_summary: 'Current relationship follow-up is not consistently inspected.',
        },
      },
    },
    five_futures_v1: {
      futures: [
        {
          key: 'current_future',
          title: 'Synthetic Current Future',
          summary: 'The current follow-up rhythm persists.',
          risk_if_unchanged: 'Current conversion remains inconsistent.',
          probability: 40,
        },
        {
          key: 'optimized_future',
          title: 'Synthetic Optimized Future',
          summary: futureRecommendation,
          required_shift: futureRecommendation,
          probability: 35,
        },
      ],
    },
  };

  if (includeBriefing) {
    output.executive_diagnostic_briefing_v1 = {
      sections: [
        {
          key: 'lead_conversion_follow_up_reality',
          body: briefingBody,
        },
      ],
    };
  }

  if (includeOneMove) {
    output.one_move_v1 = {
      title: 'Install a weekly relationship follow-up rhythm',
      recommendation: 'Inspect relationship follow-up every week.',
      root_constraint: 'Follow-up consistency',
      success_indicators: successIndicators,
      expected_probability_shift: {
        explanation: expectedShift,
      },
      first_30_days: ['Run four weekly inspections.'],
    };
  }

  return {
    assessment: {
      assessment_id: assessmentId,
      owner_profile_id: profileId,
      assessment_type: 'business_assessment_v1_intake',
      completed_at: '2099-01-01T00:00:00.000Z',
      profile_context: {
        owner_profile_name: 'Synthetic Operator',
      },
      inputs: {
        answers: {
          q1: 'I operate a real estate business.',
          q3: '600 total contacts and 120 true relationships.',
          q4: 'Past clients and referrals are the current sources.',
          q5: 'The database is partially organized.',
        },
      },
      output,
    },
  };
}

function build(record) {
  const contract = buildBusinessEngineContract(record);
  const projection = projectBusinessEngineVisualV2(contract);
  return { contract, projection };
}

function contractOutflow(result) {
  return result.contract.relationship_lake.outflow.current;
}

function projectionLabels(result) {
  return result.projection.relationship_lake.outflow.map((item) => item.label);
}

const baselineRecord = makeRecord();
const rawFuturesBefore = JSON.stringify(
  baselineRecord.assessment.output.five_futures_v1
);
const rawOneMoveBefore = JSON.stringify(
  baselineRecord.assessment.output.one_move_v1
);
const baseline = build(baselineRecord);

assert.equal(validateBusinessEngineContract(baseline.contract).valid, true);
assert.ok(contractOutflow(baseline).length > 0);
assert.ok(
  contractOutflow(baseline).every((item) =>
    CURRENT_CLASSES.has(item.temporal_class)
  )
);
assert.ok(
  contractOutflow(baseline).every(
    (item) =>
      item.role === 'current_production_outcome_alias' ||
      item.role === 'current_briefing_outcome_alias' ||
      item.role === 'conversion_system_signal'
  )
);
assert.ok(
  contractOutflow(baseline).every(
    (item) =>
      !String(item.evidence?.[0]?.path || '').startsWith('one_move_v1')
  )
);
assert.ok(
  baseline.projection.relationship_lake.outflow.every(
    (item) => CURRENT_CLASSES.has(item.temporal_class) && item.source_path
  )
);

const withoutOneMove = build(makeRecord({ includeOneMove: false }));
assert.deepEqual(
  baseline.projection.relationship_lake.outflow,
  withoutOneMove.projection.relationship_lake.outflow,
  'removing One Move must not alter current Outflow'
);

const changedSuccess = build(
  makeRecord({
    successIndicators: [
      'Target referrals double.',
      'Listings become predictable.',
      'GCI rises after implementation.',
    ],
  })
);
assert.deepEqual(
  baseline.projection.relationship_lake.outflow,
  changedSuccess.projection.relationship_lake.outflow,
  'changing One Move success indicators must not alter current Outflow'
);

const changedShift = build(
  makeRecord({
    expectedShift:
      'Future listings, buyers, GCI, and time freedom improve after implementation.',
  })
);
assert.deepEqual(
  baseline.projection.relationship_lake.outflow,
  changedShift.projection.relationship_lake.outflow,
  'changing One Move expected shift must not alter current Outflow'
);

const changedFuture = build(
  makeRecord({
    futureRecommendation:
      'Future paid leads and leverage create a different operating model.',
  })
);
assert.deepEqual(
  baseline.projection.relationship_lake.outflow,
  changedFuture.projection.relationship_lake.outflow,
  'changing Five Futures recommendations must not alter current Outflow'
);

const changedCurrent = build(
  makeRecord({
    productionSummary: 'Current buyer appointments produce listings.',
    briefingBody: 'Current buyers create listings.',
    conversionDiscipline: '',
    followUpStrength: '',
  })
);
assert.notDeepEqual(
  projectionLabels(baseline),
  projectionLabels(changedCurrent),
  'changing current evidence must alter current Outflow'
);
assert.ok(projectionLabels(changedCurrent).includes('Buyers'));
assert.ok(projectionLabels(changedCurrent).includes('Listings'));

const missingTemporalContract = structuredClone(baseline.contract);
missingTemporalContract.relationship_lake.outflow.current.push({
  name: 'Time Freedom',
  role: 'unclassified_test_item',
  evidence: [{ path: 'unknown' }],
});
missingTemporalContract.relationship_lake.outflow.current.push('GCI');
const missingTemporalProjection =
  projectBusinessEngineVisualV2(missingTemporalContract);
assert.equal(
  missingTemporalProjection.relationship_lake.outflow.some(
    (item) => item.label === 'Time Freedom'
  ),
  false,
  'missing temporal provenance must fail closed'
);
assert.equal(
  missingTemporalProjection.relationship_lake.outflow.some(
    (item) => typeof item !== 'object'
  ),
  false,
  'legacy strings must fail closed at the current Outflow projection'
);

const futureClassContract = structuredClone(baseline.contract);
futureClassContract.relationship_lake.outflow.current.push({
  name: 'Listings',
  role: 'future_test_item',
  temporal_class: OUTFLOW_TEMPORAL_CLASSES.FUTURE_MODELED,
  evidence: [{ path: 'five_futures_v1.futures[optimized_future]' }],
});
assert.equal(
  projectBusinessEngineVisualV2(
    futureClassContract
  ).relationship_lake.outflow.some(
    (item) =>
      item.temporal_class === OUTFLOW_TEMPORAL_CLASSES.FUTURE_MODELED
  ),
  false,
  'future-modeled items must fail closed'
);

const partial = build(
  makeRecord({
    includeProduction: false,
    briefingBody: 'Current referral conversion produces appointments.',
  })
);
assert.equal(validateBusinessEngineContract(partial.contract).valid, true);
assert.ok(partial.projection.relationship_lake.available);
assert.ok(partial.projection.relationship_lake.streams.length > 0);
assert.ok(partial.projection.relationship_lake.outflow.length > 0);

const futureOnly = build(
  makeRecord({
    includeProduction: false,
    includeBriefing: false,
    conversionDiscipline: '',
    followUpStrength: '',
  })
);
assert.equal(validateBusinessEngineContract(futureOnly.contract).valid, true);
assert.deepEqual(futureOnly.contract.relationship_lake.outflow.current, []);
assert.equal(
  futureOnly.contract.relationship_lake.outflow.source_type,
  'honest_absence'
);
assert.equal(
  futureOnly.contract.relationship_lake.outflow.intelligence_status,
  'absent'
);
assert.deepEqual(futureOnly.projection.relationship_lake.outflow, []);
assert.equal(futureOnly.projection.one_move.available, true);
assert.deepEqual(
  futureOnly.projection.one_move.proof_target,
  futureOnly.contract.one_move.current.proof_target
);

assert.equal(
  baseline.contract.one_move.current.proof_target_temporal_class,
  OUTFLOW_TEMPORAL_CLASSES.ONE_MOVE_SUCCESS_INDICATOR
);
assert.equal(
  baseline.contract.one_move.current
    .expected_downstream_effects_temporal_class,
  OUTFLOW_TEMPORAL_CLASSES.ONE_MOVE_EXPECTED_SHIFT
);
assert.equal(
  baseline.projection.one_move.proof_target_temporal_class,
  OUTFLOW_TEMPORAL_CLASSES.ONE_MOVE_SUCCESS_INDICATOR
);
assert.equal(
  baseline.projection.one_move
    .expected_downstream_effects_temporal_class,
  OUTFLOW_TEMPORAL_CLASSES.ONE_MOVE_EXPECTED_SHIFT
);

const secondProfile = build(
  makeRecord({
    profileId: 'mm-20990101-outflow02',
    assessmentId: 'ba-20990101-outflow02',
    productionSummary: 'Current buyer appointments produce listings.',
    briefingBody: 'Current buyer conversion produces listings.',
    conversionDiscipline: '',
    followUpStrength: '',
  })
);
assert.notDeepEqual(projectionLabels(baseline), projectionLabels(secondProfile));
assert.notEqual(
  baseline.contract.relationship_lake.outflow.current,
  secondProfile.contract.relationship_lake.outflow.current
);
assert.notEqual(
  baseline.projection.relationship_lake.outflow,
  secondProfile.projection.relationship_lake.outflow
);

const firstProfileAgain = build(makeRecord());
assert.deepEqual(
  baseline.projection.relationship_lake.outflow,
  firstProfileAgain.projection.relationship_lake.outflow
);

const degradedRecord = makeRecord({
  includeOneMove: false,
  includeBriefing: false,
  includeProduction: false,
  conversionDiscipline: '',
  followUpStrength: '',
});
delete degradedRecord.assessment.output.five_futures_v1;
const degraded = build(degradedRecord);
assert.equal(validateBusinessEngineContract(degraded.contract).valid, true);
assert.deepEqual(degraded.projection.relationship_lake.outflow, []);
assert.equal(degraded.projection.relationship_lake.available, true);

assert.equal(
  JSON.stringify(baselineRecord.assessment.output.five_futures_v1),
  rawFuturesBefore
);
assert.equal(
  JSON.stringify(baselineRecord.assessment.output.one_move_v1),
  rawOneMoveBefore
);

const rendererSource = readFileSync(
  new URL(
    '../src/components/businessAssessment/BusinessEngineVisualV2.jsx',
    import.meta.url
  ),
  'utf8'
);
assert.match(rendererSource, /What the lake currently produces/);
assert.match(rendererSource, /data-temporal-class=\{item\.temporal_class\}/);
assert.match(rendererSource, /No current outflow evidence available/);
assert.match(rendererSource, /oneMove\.proof_target_temporal_class/);
assert.match(
  rendererSource,
  /oneMove\.expected_downstream_effects_temporal_class/
);

console.log(
  JSON.stringify(
    {
      passed: true,
      synthetic_profile_builds: 11,
      baseline_current_outflow:
        baseline.projection.relationship_lake.outflow,
      changed_current_outflow:
        changedCurrent.projection.relationship_lake.outflow,
      future_only_current_outflow:
        futureOnly.projection.relationship_lake.outflow,
      assertions: [
        'One Move removal does not alter current Outflow',
        'One Move success indicators do not alter current Outflow',
        'One Move expected shifts do not alter current Outflow',
        'Five Futures recommendations do not alter current Outflow',
        'current evidence changes current Outflow',
        'current and future outcomes remain structurally separated',
        'missing or future temporal provenance fails closed',
        'partial missing data does not collapse Relationship Lake',
        'profiles do not share Outflow object state',
        'different current evidence produces individualized Outflow',
        'degraded historical records remain valid and honest',
        'future outcomes remain in the labeled One Move panel',
      ],
    },
    null,
    2
  )
);
