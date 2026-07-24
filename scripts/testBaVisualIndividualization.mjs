import assert from 'node:assert/strict';

import { buildBusinessIntelligenceDraft } from '../api/engine/businessAssessment/buildBusinessIntelligenceDraft.js';
import { REAL_ESTATE_BUSINESS_MODEL_V1 } from '../api/engine/businessAssessment/realEstateBusinessModelV1.js';
import { normalizeBusinessVisualArtifactData } from '../src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js';
import { inferEToPScores } from '../src/lib/businessAssessment/inferEToPScores.js';
import { projectBusinessEngineVisualV2 } from '../src/lib/businessEngine/projectBusinessEngineVisualV2.js';
import { deriveRelationshipStructureEvidence } from '../src/lib/businessEngine/relationshipEvidence.js';

const FUTURE_KEYS = [
  'current_future',
  'most_likely_next_future',
  'constraint_future',
  'optimized_future',
  'transformational_future',
];

function canonicalProfile(profileId, personName, dimensions) {
  return {
    person_name: personName,
    canonical_profile_json: {
      profile_id: profileId,
      rescoring_gpt: {
        ranked_dimensions: dimensions.map(([dimension, score], index) => ({
          dimension,
          display_score: score,
          confidence: Number((0.92 - index * 0.04).toFixed(2)),
          evidence_count: 8 - index,
        })),
      },
    },
  };
}

function futurePacket(config) {
  const probabilities = config.probabilities;
  return {
    version: 'five_futures_v1',
    assessment_id: config.assessmentId,
    owner_profile_id: config.profileId,
    futures: FUTURE_KEYS.map((key, index) => {
      const optimized = key === 'optimized_future';
      const constrained = key === 'constraint_future';
      return {
        key,
        title: `${config.futureStem} ${key.replace(/_/g, ' ')}`,
        probability: probabilities[index],
        summary: `${config.futureStem} ${key} summary grounded in ${config.businessEvidence}.`,
        trajectory_logic: `${config.futureStem} ${key} forms because ${config.constraintEvidence}.`,
        behavioral_drivers: optimized
          ? [config.behavioralAsset, config.optimizedBehavior]
          : constrained
            ? [config.behavioralRisk, config.constraintBehavior]
            : [`${config.futureStem} current behavior remains evidence-bound.`],
        business_drivers: optimized
          ? [config.businessMomentum]
          : constrained
            ? [config.businessDrag]
            : [config.businessEvidence],
        risk_if_unchanged: constrained
          ? `${config.futureStem} risks ${config.businessDrag}.`
          : null,
        upside: optimized
          ? `${config.futureStem} can produce ${config.productionEffect}.`
          : null,
        required_shift: optimized
          ? config.requiredShift
          : `${config.futureStem} requires evidence-led correction.`,
        confidence: 'moderate',
        input_sources_used: ['behavioral', 'financial', 'productivity', 'accountability'],
      };
    }),
  };
}

function oneMove(config) {
  return {
    version: 'one_move_v1',
    assessment_id: config.assessmentId,
    owner_profile_id: config.profileId,
    title: config.oneMoveTitle,
    root_constraint: config.constraintEvidence,
    recommendation: config.recommendation,
    why_this_move: `${config.oneMoveTitle} directly addresses ${config.constraintEvidence}.`,
    behavior_fit: config.behaviorFit,
    first_30_days: [
      config.firstStep,
      config.cadenceStep,
    ],
    success_indicators: config.successIndicators,
    expected_probability_shift: {
      explanation: `${config.oneMoveTitle} shifts probability toward ${config.futureStem}.`,
    },
    confidence: 'moderate',
  };
}

function briefing(config) {
  return {
    version: 'executive_diagnostic_briefing_v1',
    assessment_id: config.assessmentId,
    owner_profile_id: config.profileId,
    primary_constraint_snapshot: {
      constraint_key: config.constraintKey,
      label: config.constraintLabel,
      diagnostic_summary: config.constraintEvidence,
      likely_effect_if_unchanged: config.businessDrag,
      confidence: 'moderate',
    },
    current_trajectory_signal: {
      signal: config.trajectorySignal,
      diagnostic_summary: config.currentTrajectory,
      persistence_risk: config.persistenceRisk,
    },
    sections: [
      {
        key: 'strategic_interpretation',
        title: 'Strategic interpretation',
        body: config.strategicInterpretation,
      },
      {
        key: 'current_trajectory_signal',
        title: 'Current trajectory',
        body: config.currentTrajectory,
      },
      {
        key: 'primary_constraint',
        title: config.constraintLabel,
        body: config.constraintEvidence,
      },
      {
        key: 'lead_generation_reality',
        title: 'Lead generation reality',
        body: config.leadGenerationBriefing,
      },
    ],
  };
}

function buildFixture(config) {
  const assessment = {
    assessment_id: config.assessmentId,
    owner_profile_id: config.profileId,
    assessment_type: config.assessmentType,
    status: 'five_futures_and_one_move_ready',
    version: 'business_assessment_v1_intake',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T01:00:00.000Z',
    profile_context: {
      owner_profile_id: config.profileId,
      owner_profile_name: config.name,
      owner_profile_type: config.profileType,
    },
    inputs: {
      answers: config.answers,
      team_profile_ids: [],
      financial_text: config.answers.q9,
    },
    output: {},
  };

  const draft = buildBusinessIntelligenceDraft({
    assessmentRecord: assessment,
    canonicalProfile: config.canonical,
    realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1,
  });
  draft.business_reality = draft.business_reality || {};
  draft.business_reality.current_production_reality = {
    ...(draft.business_reality.current_production_reality || {}),
    summary: config.currentOutflowEvidence,
  };

  assessment.output = {
    business_intelligence_draft: draft,
    executive_diagnostic_briefing_v1: briefing(config),
    five_futures_v1: futurePacket(config),
    one_move_v1: oneMove(config),
  };

  const retrieve = {
    success: true,
    found: true,
    status: assessment.status,
    owner_profile_id: config.profileId,
    owner_profile_name: config.name,
    assessment_id: config.assessmentId,
    has_business_intelligence_draft: true,
    has_executive_diagnostic_briefing: true,
    has_five_futures: true,
    has_one_move: true,
    assessment,
  };
  const normalized = normalizeBusinessVisualArtifactData(retrieve);
  const projection = projectBusinessEngineVisualV2(normalized.businessEngineContract);
  return { config, assessment, draft, retrieve, normalized, projection };
}

const baseAnswers = {
  q1: '',
  q2: '',
  q3: '',
  q4: '',
  q5: '',
  q6: '',
  q7: '',
  q8: '',
  q9: '',
  q10: '',
  q11: '',
  q12: '',
};

const configs = [
  {
    profileId: 'mm-20260101-atlas001',
    assessmentId: 'ba-20260101-a11a5001',
    name: 'Atlas Example',
    profileType: 'Command / Tempo',
    assessmentType: 'real_estate_team',
    canonical: canonicalProfile('mm-20260101-atlas001', 'Atlas Example', [
      ['vector', 0.88],
      ['velocity', 0.76],
      ['fidelity', 0.62],
    ]),
    answers: {
      ...baseAnswers,
      q1: 'Referral demand is strong, but buyer conversion needs inspection.',
      q2: 'Close 60 units and grow listing share over 12 months.',
      q3: '1,200 contacts, 140 true relationships, segmented into A/B/C/D relationship tiers.',
      q4: 'Past clients, referrals, and open houses create most opportunities.',
      q5: 'Follow Up Boss is active and the database is segmented into A/B/C/D relationships.',
      q6: 'The team is willing to prospect through referrals and open houses.',
      q7: 'A weekly scorecard reviews appointments, listings, and follow-up.',
      q8: 'Listing and buyer checklists exist, but lead conversion still depends on the owner.',
      q9: 'Units closed: 48. $22,400,000 Sales Volume. GCI: $510,000. Expenses: $180,000.',
      q10: 'Conversion becomes unclear when the owner stops inspecting.',
      q11: 'A buyer agent and transaction coordinator are on the team.',
      q12: 'Triple volume would break buyer-agent accountability first.',
    },
    probabilities: [22, 28, 18, 24, 8],
    futureStem: 'Inspected team conversion',
    businessEvidence: 'referral demand and a 140-person true-relationship lake',
    constraintEvidence: 'owner-dependent buyer conversion is not consistently inspected',
    behavioralAsset: 'Command can enforce standards once the conversion scorecard is visible.',
    optimizedBehavior: 'Tempo supports fast correction when ownership is explicit.',
    behavioralRisk: 'Command can centralize decisions and keep the owner as the bottleneck.',
    constraintBehavior: 'Tempo can reward activity before conversion quality is inspected.',
    businessMomentum: 'Existing referral demand gives the team a real conversion base.',
    businessDrag: 'unassigned buyer follow-up and owner dependency',
    requiredShift: 'Install one owner-assigned weekly buyer-conversion scorecard.',
    productionEffect: 'more referral-to-appointment conversion without adding lead volume',
    constraintKey: 'lead_conversion_constraint',
    constraintLabel: 'Lead Conversion Constraint',
    trajectorySignal: 'conversion_leakage',
    currentTrajectory: 'Referral volume stays healthy while buyer follow-up leakage limits conversion.',
    persistenceRisk: 'The owner remains the control system and qualified referrals decay.',
    strategicInterpretation: 'Atlas has demand and team capacity, but unmanaged buyer conversion keeps authority concentrated in the owner.',
    leadGenerationBriefing: 'Past clients, referrals, and open houses are the active lead streams.',
    currentOutflowEvidence:
      'Current referrals produce buyer appointments and listings.',
    oneMoveTitle: 'Install the Buyer Conversion Scorecard',
    recommendation: 'Run one owner-assigned buyer conversion scorecard every Friday.',
    behaviorFit: 'This uses Atlas command strength while forcing decisions into a transferable weekly inspection.',
    firstStep: 'Assign every active buyer referral to one named owner.',
    cadenceStep: 'Review buyer stages every Friday in a 25-minute conversion inspection.',
    successIndicators: ['Appointments rise from referrals.', 'Buyer pipeline conversion is visible.', 'Listings and referrals are attributed.'],
  },
  {
    profileId: 'mm-20260102-beacon02',
    assessmentId: 'ba-20260102-beac0002',
    name: 'Beacon Example',
    profileType: 'Adaptability / Signal',
    assessmentType: 'real_estate_agent',
    canonical: canonicalProfile('mm-20260102-beacon02', 'Beacon Example', [
      ['flex', 0.84],
      ['signal', 0.78],
      ['framework', 0.41],
    ]),
    answers: {
      ...baseAnswers,
      q1: 'Past-client follow-up is inconsistent.',
      q2: 'Close two deals each month and build an assistant-supported business.',
      q3: '392 people are in the SOI and 50 are true relationships.',
      q4: 'Sphere conversations, mailers, and personal networking create opportunities.',
      q5: "I don't have an official CRM and don't have a segmentation set up.",
      q6: 'Relationship outreach fits better than cold prospecting.',
      q7: 'A coach provides encouragement, but no weekly CRM inspection exists.',
      q8: 'Client service is strong; follow-up is held in spreadsheets and memory.',
      q9: 'Units closed: 26. 2) $17,280,260 Sales Volume 3) Average price $750,000.',
      q10: 'The database is not inspectable.',
      q11: '',
      q12: 'Growth requires organization, delegation, and daily CRM use.',
    },
    probabilities: [28, 30, 17, 19, 6],
    futureStem: 'Disciplined sphere activation',
    businessEvidence: 'a 392-person SOI with 50 true relationships',
    constraintEvidence: 'the relationship asset is unsegmented and stored outside an active CRM',
    behavioralAsset: 'Adaptability helps personalize follow-up without making it mechanical.',
    optimizedBehavior: 'Signal supports high-trust sphere conversations.',
    behavioralRisk: 'Relational confidence may reduce urgency to systematize follow-up.',
    constraintBehavior: 'Low Structure can keep the spreadsheet from becoming a daily operating tool.',
    businessMomentum: 'A real sphere creates immediate reactivation potential.',
    businessDrag: 'unsegmented contacts and inconsistent next-touch dates',
    requiredShift: 'Move the SOI into one segmented daily-use CRM cadence.',
    productionEffect: 'more repeat and referral conversations from the existing SOI',
    constraintKey: 'database_constraint',
    constraintLabel: 'Database Constraint',
    trajectorySignal: 'relationship_asset_ceiling',
    currentTrajectory: 'Strong relationships create business, but the unsegmented spreadsheet prevents compounding.',
    persistenceRisk: 'Growth remains dependent on fresh effort and memory.',
    strategicInterpretation: 'Beacon has a meaningful relationship asset, but no active CRM or segmentation converts it into an inspectable engine.',
    leadGenerationBriefing: 'Sphere conversations, direct mail, and personal networking are the active streams.',
    currentOutflowEvidence:
      'Current referrals and repeat business produce GCI.',
    oneMoveTitle: 'Activate the Segmented SOI Cadence',
    recommendation: 'Move the 392-person SOI into one CRM and inspect completed relationship touches weekly.',
    behaviorFit: 'This preserves Beacon relational style while adding the minimum structure needed for consistent follow-up.',
    firstStep: 'Import the complete SOI into one CRM.',
    cadenceStep: 'Hold one weekly 20-minute relationship-touch inspection using CRM evidence.',
    successIndicators: ['Relationship touches are completed.', 'Repeat business is attributed.', 'Next-touch dates are current.'],
  },
  {
    profileId: 'mm-20260103-cedar003',
    assessmentId: 'ba-20260103-ceda0003',
    name: 'Cedar Example',
    profileType: 'Signal / Precision',
    assessmentType: 'real_estate_agent',
    canonical: canonicalProfile('mm-20260103-cedar003', 'Cedar Example', [
      ['signal', 0.86],
      ['fidelity', 0.72],
      ['horizon', 0.66],
    ]),
    answers: {
      ...baseAnswers,
      q1: 'More opportunity is needed, but paid leads are already available.',
      q2: 'Grow the relationship database toward 250 and net $125,000.',
      q3: 'Maybe 65 contacts and true relationships are maybe 15-20.',
      q4: 'Paid online leads, builder relationships, and community events create introductions.',
      q5: 'No consistent database, nurture, or follow-up system exists yet.',
      q6: 'Warm introductions and community activity fit better than scripts.',
      q7: 'Self-accountability is informal.',
      q8: 'Client conversations are thoughtful but no definitive process exists.',
      q9: 'Units closed 32; sales volume-9,757,625.00; average price $309,587.',
      q10: 'Follow-up depends on memory.',
      q11: '',
      q12: 'Too much pressure would disrupt calm and follow-through.',
    },
    probabilities: [25, 30, 22, 18, 5],
    futureStem: 'Calm relationship operating system',
    businessEvidence: '15-20 true relationships plus paid and builder introductions',
    constraintEvidence: 'relationship skill is not supported by a visible nurture and follow-up system',
    behavioralAsset: 'Signal supports accurate listening and trust-building in warm conversations.',
    optimizedBehavior: 'Precision helps define the next touch when the workflow stays simple.',
    behavioralRisk: 'Pressure can drain follow-through and make structure feel costly.',
    constraintBehavior: 'Relational customization can replace a repeatable next-action standard.',
    businessMomentum: 'Builder and community introductions create a credible relationship base.',
    businessDrag: 'memory-based nurturing and invisible paid-lead follow-up',
    requiredShift: 'Install a simple relationship nurture system with visible next actions.',
    productionEffect: 'steadier conversion without sacrificing relationship quality or calm',
    constraintKey: 'systems_constraint',
    constraintLabel: 'Systems Constraint',
    trajectorySignal: 'systems_drag',
    currentTrajectory: 'Warm opportunity appears, but memory-based follow-up creates an uneven pipeline.',
    persistenceRisk: 'Paid and relationship leads decay when pressure rises.',
    strategicInterpretation: 'Cedar has relational accuracy and real opportunity, but calm is protected by improvisation instead of a light operating system.',
    leadGenerationBriefing: 'Paid online leads, builder partners, and community events are the active streams.',
    currentOutflowEvidence:
      'Current buyer appointments and pipeline conversion produce GCI.',
    oneMoveTitle: 'Install the Calm Next-Action System',
    recommendation: 'Use one simple CRM to assign a next action to every paid, builder, and relationship lead.',
    behaviorFit: 'This protects Cedar calm and precision while externalizing follow-through before pressure rises.',
    firstStep: 'Place every active paid and builder lead into one visible pipeline.',
    cadenceStep: 'Inspect next actions every Monday in a calm 20-minute pipeline review.',
    successIndicators: ['Pipeline conversion is visible.', 'Buyer opportunities have next actions.', 'Time freedom improves as memory load falls.'],
  },
];

const fixtures = configs.map(buildFixture);

for (const fixture of fixtures) {
  const { config, draft, normalized, projection } = fixture;
  const contract = normalized.businessEngineContract;

  assert.equal(draft.owner_profile_id, config.profileId);
  assert.equal(contract.identity.profile_id, config.profileId);
  assert.equal(contract.contract_metadata.source_profile_id, config.profileId);
  assert.equal(contract.contract_metadata.source_assessment_id, config.assessmentId);
  assert.equal(contract.contract_metadata.compatibility_projection_version, 'ba-visual-individualized-v2');
  assert.equal(projection.identity.profile_id, config.profileId);
  assert.equal(projection.business_engine.pillars_fallback, false);
  assert.equal(projection.relationship_lake.streams_fallback, false);
  assert.equal(projection.relationship_lake.outflow_fallback, false);
  assert.equal(projection.potential_business_future.time_to_effect, null);
  assert.ok(projection.governing_business_pattern.summary.includes(config.businessEvidence));
  assert.equal(projection.behavioral_modifier.behavioral_asset, config.behavioralAsset);
  assert.equal(projection.behavioral_modifier.business_distortion_or_risk, config.behavioralRisk);
  assert.equal(projection.behavioral_modifier.implementation_implication, config.behaviorFit);
  assert.equal(projection.one_move.move_title, config.oneMoveTitle);
  assert.equal(normalized.fiveFutures.futures.length, 5);
  assert.equal(normalized.fiveFutures.futures[3].title, `${config.futureStem} optimized future`);
}

const [atlas, beacon, cedar] = fixtures;
const fieldSet = (selector) => new Set(fixtures.map(selector));

assert.equal(fieldSet((fixture) => fixture.projection.governing_business_pattern.summary).size, 3);
assert.equal(fieldSet((fixture) => fixture.projection.current_business_reality.summary).size, 3);
assert.equal(fieldSet((fixture) => fixture.projection.behavioral_modifier.behavioral_asset).size, 3);
assert.equal(fieldSet((fixture) => JSON.stringify(fixture.projection.business_engine.pillars)).size, 3);
assert.equal(fieldSet((fixture) => JSON.stringify(fixture.projection.relationship_lake.streams)).size, 3);
assert.equal(fieldSet((fixture) => JSON.stringify(fixture.projection.relationship_lake.outflow)).size, 3);
assert.equal(fieldSet((fixture) => fixture.projection.current_trajectory.summary).size, 3);
assert.equal(fieldSet((fixture) => fixture.projection.potential_trajectory.summary).size, 3);
assert.equal(fieldSet((fixture) => fixture.projection.one_move.move_title).size, 3);
assert.equal(fieldSet((fixture) => JSON.stringify(fixture.normalized.fiveFutures.futures)).size, 3);

assert.equal(atlas.projection.relationship_lake.current_true_relationships, '140');
assert.equal(beacon.projection.relationship_lake.current_true_relationships, '50');
assert.equal(cedar.projection.relationship_lake.current_true_relationships, '15–20');
assert.equal(beacon.projection.current_business_reality.metrics.find((row) => row.id === 'annual_production')?.display_value, '$17.3M');
assert.equal(beacon.projection.current_business_reality.metrics.find((row) => row.id === 'units_closed')?.display_value, '26');
assert.equal(beacon.projection.current_business_reality.metrics.find((row) => row.id === 'annual_production')?.fallback_used, false);
assert.match(
  beacon.projection.business_engine.pillars.find((pillar) => pillar.key === 'tools')?.label || '',
  /active CRM is not in use/i
);

assert.equal(atlas.normalized.businessEngineContract.relationship_lake.segmentation_status, 'present');
assert.equal(atlas.projection.relationship_lake.quality, 'organized_lake_signal');
assert.equal(beacon.normalized.businessEngineContract.relationship_lake.segmentation_status, 'absent');
assert.equal(beacon.projection.relationship_lake.quality, 'relationship_asset_present_unorganized');
assert.equal(cedar.normalized.businessEngineContract.relationship_lake.segmentation_status, 'unknown');
assert.equal(cedar.projection.relationship_lake.quality, 'relationship_asset_present');

assert.deepEqual(
  deriveRelationshipStructureEvidence({
    q3: '392 contacts and 50 true relationships',
    q5: "I don't have a segmentation set up",
  }).segmentation_status,
  'absent'
);
assert.equal(
  deriveRelationshipStructureEvidence({
    q5: "I don't have an official CRM program.",
  }).crm_status,
  'absent'
);

const beaconWithoutGeneratedRecommendations = structuredClone(beacon.retrieve);
beaconWithoutGeneratedRecommendations.assessment.output = {
  business_intelligence_draft: beacon.draft,
};
assert.deepEqual(
  inferEToPScores(beacon.retrieve),
  inferEToPScores(beaconWithoutGeneratedRecommendations)
);

const beaconWithoutQ4 = structuredClone(beacon.retrieve);
beaconWithoutQ4.assessment.inputs.answers.q4 = '';
const partialNormalized = normalizeBusinessVisualArtifactData(beaconWithoutQ4);
const partialProjection = projectBusinessEngineVisualV2(partialNormalized.businessEngineContract);
assert.ok(partialProjection.governing_business_pattern.summary.includes(configs[1].businessEvidence));
assert.equal(partialProjection.behavioral_modifier.behavioral_asset, configs[1].behavioralAsset);
assert.equal(partialProjection.relationship_lake.streams_fallback, false);

const firstAtlasProjection = projectBusinessEngineVisualV2(
  normalizeBusinessVisualArtifactData(atlas.retrieve).businessEngineContract
);
const interveningBeaconProjection = projectBusinessEngineVisualV2(
  normalizeBusinessVisualArtifactData(beacon.retrieve).businessEngineContract
);
const secondAtlasProjection = projectBusinessEngineVisualV2(
  normalizeBusinessVisualArtifactData(atlas.retrieve).businessEngineContract
);
assert.equal(interveningBeaconProjection.identity.profile_id, configs[1].profileId);
assert.deepEqual(firstAtlasProjection.governing_business_pattern, secondAtlasProjection.governing_business_pattern);
assert.deepEqual(firstAtlasProjection.behavioral_modifier, secondAtlasProjection.behavioral_modifier);
assert.notDeepEqual(firstAtlasProjection.governing_business_pattern, interveningBeaconProjection.governing_business_pattern);

const legacyRetrieve = structuredClone(cedar.retrieve);
legacyRetrieve.assessment.output = {
  business_intelligence_draft: cedar.draft,
};
legacyRetrieve.status = 'business_intelligence_draft_ready';
legacyRetrieve.has_executive_diagnostic_briefing = false;
legacyRetrieve.has_five_futures = false;
legacyRetrieve.has_one_move = false;
const legacyNormalized = normalizeBusinessVisualArtifactData(legacyRetrieve);
const legacyContract = legacyNormalized.businessEngineContract;
const legacyProjection = projectBusinessEngineVisualV2(legacyContract);
assert.equal(legacyContract.identity.profile_id, configs[2].profileId);
assert.equal(legacyContract.governing_business_pattern.fallback_used, true);
assert.equal(legacyContract.behavioral_modifier.fallback_used, true);
assert.equal(legacyProjection.potential_business_future.available, false);
assert.equal(legacyProjection.potential_business_future.time_to_effect, null);
assert.equal(legacyProjection.one_move.available, false);

for (const fixture of fixtures) {
  const serialized = JSON.stringify({
    governing: fixture.projection.governing_business_pattern,
    behavioral: fixture.projection.behavioral_modifier,
  });
  assert.ok(!serialized.includes('The operator may read people and context well but still fail to convert awareness into inspected behavior.'));
  assert.ok(!serialized.includes('Direction can create progress, but business becomes leader-dependent when judgment is not transferred.'));
}

console.log(JSON.stringify({
  passed: true,
  fixture_count: fixtures.length,
  assertions: [
    'canonical BOS plus BA inputs produce distinct drafts and BA Visual DNA projections',
    'governing pattern and behavioral modifier use persisted individualized fused intelligence',
    'streams and current outflow are individualized when current evidence exists',
    'true relationships and production remain evidence-bound',
    'pillar scores are deterministic individualized projection, not shared fallback',
    'segmentation negation overrides keyword presence',
    'missing one field does not collapse the projection',
    'projection state does not cross profile boundaries',
    'legacy records fail honestly when generated artifacts are absent',
    'Five Futures and One Move remain profile-scoped and distinct',
  ],
}, null, 2));
