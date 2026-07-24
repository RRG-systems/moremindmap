import assert from 'node:assert/strict';
import { buildBusinessEngineContract } from '../src/lib/businessEngine/buildBusinessEngineContract.js';
import { projectBusinessEngineVisualV2 } from '../src/lib/businessEngine/projectBusinessEngineVisualV2.js';
import {
  parseCurrentTrueRelationshipAnswer,
  TRUE_RELATIONSHIP_PROVENANCE,
  TRUE_RELATIONSHIP_SOURCE_CLASSES,
} from '../src/lib/businessEngine/relationshipEvidence.js';

function syntheticRecord(q3, overrides = {}) {
  return {
    assessment: {
      owner_profile_id: overrides.profileId || 'mm-synthetic-alpha',
      assessment_id: overrides.assessmentId || 'ba-synthetic-alpha',
      assessment_type: 'business_assessment',
      inputs: {
        answers: {
          q2: overrides.q2 || '',
          q3,
          q5: overrides.q5 || '',
        },
      },
      output: {
        business_intelligence_draft: {
          owner_profile_id: overrides.profileId || 'mm-synthetic-alpha',
          relationship_reality: {
            evidence: { q3, q5: overrides.q5 || '' },
            database_size_mentions: overrides.mentions || [],
          },
        },
        one_move_v1: overrides.oneMove || {},
        five_futures_v1: overrides.fiveFutures || {},
      },
    },
  };
}

function project(q3, overrides = {}, options = {}) {
  const contract = buildBusinessEngineContract(
    syntheticRecord(q3, overrides),
    options
  );
  return {
    contract,
    projection: projectBusinessEngineVisualV2(contract),
  };
}

const supported = [
  ['1,200 contacts, 140 true relationships', '140', 'EXPLICIT_NUMERIC'],
  ['140 true relationships out of 1,200 contacts', '140', 'EXPLICIT_NUMERIC'],
  ['I have 140 true relationships', '140', 'EXPLICIT_NUMERIC'],
  ['about 140 true relationships', '~140', 'EXPLICIT_APPROXIMATE'],
  ['approximately 140 real relationships', '~140', 'EXPLICIT_APPROXIMATE'],
  ['roughly 140 people who would refer me', '~140', 'EXPLICIT_APPROXIMATE'],
  ['15-20 true relationships', '15–20', 'EXPLICIT_RANGE'],
  ['15–20 true relationships', '15–20', 'EXPLICIT_RANGE'],
  ['between 15 and 20 true relationships', '15–20', 'EXPLICIT_RANGE'],
  ['0 true relationships', '0', 'EXPLICIT_NUMERIC'],
  ['zero true relationships', '0', 'EXPLICIT_NUMERIC'],
  ['none yet', '0', 'EXPLICIT_NUMERIC'],
];

for (const [input, display, sourceClass] of supported) {
  const parsed = parseCurrentTrueRelationshipAnswer(input);
  assert.equal(parsed.provenance, TRUE_RELATIONSHIP_PROVENANCE.EXPLICIT, input);
  assert.equal(parsed.display_value, display, input);
  assert.equal(parsed.source_class, sourceClass, input);
}

for (const input of ["I don't know", 'not sure', '']) {
  const parsed = parseCurrentTrueRelationshipAnswer(input);
  assert.equal(parsed.provenance, TRUE_RELATIONSHIP_PROVENANCE.UNKNOWN, input);
  assert.equal(parsed.value, null, input);
}

const rejected = [
  ['1,200 contacts', TRUE_RELATIONSHIP_SOURCE_CLASSES.TOTAL_CONTACTS_ONLY],
  ['I want 300 true relationships', TRUE_RELATIONSHIP_SOURCE_CLASSES.FUTURE_TARGET],
  ['My target is 300 true relationships', TRUE_RELATIONSHIP_SOURCE_CLASSES.FUTURE_TARGET],
  ['I need 300 true relationships', TRUE_RELATIONSHIP_SOURCE_CLASSES.FUTURE_TARGET],
  ['Goal: 300 true relationships', TRUE_RELATIONSHIP_SOURCE_CLASSES.FUTURE_TARGET],
  ['Build to 300 true relationships', TRUE_RELATIONSHIP_SOURCE_CLASSES.FUTURE_TARGET],
  ['Within 12 months, 300 true relationships', TRUE_RELATIONSHIP_SOURCE_CLASSES.FUTURE_TARGET],
  ['My goal is 300', TRUE_RELATIONSHIP_SOURCE_CLASSES.FUTURE_TARGET],
  ['$140,000 annual production and 22 units closed', TRUE_RELATIONSHIP_SOURCE_CLASSES.AMBIGUOUS],
  ['140.5 true relationships', TRUE_RELATIONSHIP_SOURCE_CLASSES.INVALID],
  ['40% true relationships', TRUE_RELATIONSHIP_SOURCE_CLASSES.INVALID],
  ['1,2,00 true relationships', TRUE_RELATIONSHIP_SOURCE_CLASSES.INVALID],
  ['22 units, $1,400,000 volume, relationship count unknown', TRUE_RELATIONSHIP_SOURCE_CLASSES.UNKNOWN],
];

for (const [input, sourceClass] of rejected) {
  const parsed = parseCurrentTrueRelationshipAnswer(input);
  assert.equal(parsed.provenance, TRUE_RELATIONSHIP_PROVENANCE.UNKNOWN, input);
  assert.equal(parsed.source_class, sourceClass, input);
  assert.equal(parsed.value, null, input);
}

const multiNumber = project(
  '$1,400,000 annual production, 22 units, 1,200 contacts, 140 true relationships'
);
assert.equal(
  multiNumber.projection.relationship_lake.current_true_relationships,
  '140'
);
assert.equal(multiNumber.projection.relationship_lake.total_contacts, '1,200');

const explicitA = project('1,200 contacts, 140 true relationships');
const explicitB = project('8,500 contacts, 140 true relationships');
assert.equal(
  explicitA.projection.relationship_lake.current_true_relationships,
  explicitB.projection.relationship_lake.current_true_relationships
);
assert.notEqual(
  explicitA.projection.relationship_lake.total_contacts,
  explicitB.projection.relationship_lake.total_contacts
);

const targetA = project('I have 140 true relationships', {
  q2: 'Goal: 300 true relationships',
});
const targetB = project('I have 140 true relationships', {
  q2: 'Goal: 900 true relationships',
});
assert.equal(
  targetA.projection.relationship_lake.current_true_relationships,
  targetB.projection.relationship_lake.current_true_relationships
);

const futureA = project('I have 140 true relationships', {
  oneMove: {
    success_indicators: ['Reach 300 true relationships'],
    expected_probability_shift: { explanation: 'Grow to 300.' },
  },
  fiveFutures: {
    futures: [{ key: 'future_a', title: 'Reach 500 relationships' }],
  },
});
const futureB = project('I have 140 true relationships', {
  oneMove: {
    success_indicators: ['Reach 900 true relationships'],
    expected_probability_shift: { explanation: 'Grow to 900.' },
  },
  fiveFutures: {
    futures: [{ key: 'future_b', title: 'Reach 1,200 relationships' }],
  },
});
assert.equal(
  futureA.projection.relationship_lake.current_true_relationships,
  futureB.projection.relationship_lake.current_true_relationships
);

const unknownWithFuture = project('1,200 contacts only', {
  q2: 'Goal: 300 true relationships',
  oneMove: { success_indicators: ['Reach 300 true relationships'] },
  fiveFutures: { futures: [{ title: 'Build to 500 true relationships' }] },
});
assert.equal(
  unknownWithFuture.projection.relationship_lake.current_true_relationships,
  '—'
);
assert.equal(
  unknownWithFuture.projection.relationship_lake.current_true_relationships_note,
  'Not yet measured'
);

const estimate = project(
  '',
  {},
  {
    metrics: {
      currentTrueRelationships: {
        value: 275,
        provenance: 'ESTIMATED',
        source_class: 'ESTIMATED_INDIVIDUALIZED',
        estimate_method: 'synthetic approved relationship-evidence model',
        temporal_state: 'CURRENT',
      },
    },
  }
);
assert.equal(estimate.contract.relationship_lake.true_relationships.provenance, 'ESTIMATED');
assert.equal(estimate.projection.relationship_lake.current_true_relationships, '~275');
assert.equal(
  estimate.projection.relationship_lake.current_true_relationships_note,
  'Estimated'
);

const isolationA = project('40 true relationships', {
  profileId: 'mm-synthetic-a',
  assessmentId: 'ba-synthetic-a',
});
project('700 true relationships', {
  profileId: 'mm-synthetic-b',
  assessmentId: 'ba-synthetic-b',
});
const isolationARepeat = project('40 true relationships', {
  profileId: 'mm-synthetic-a',
  assessmentId: 'ba-synthetic-a',
});
assert.equal(
  isolationA.projection.relationship_lake.current_true_relationships,
  isolationARepeat.projection.relationship_lake.current_true_relationships
);
assert.equal(isolationARepeat.projection.relationship_lake.current_true_relationships, '40');
assert.ok(isolationARepeat.projection.relationship_lake.streams);
assert.ok(isolationARepeat.projection.relationship_lake.outflow);

console.log(
  JSON.stringify(
    {
      passed: true,
      supported_phrase_count: supported.length,
      rejected_or_unknown_count: rejected.length + 3,
      parser_failures: 0,
      differential_assertions: [
        'total contacts do not populate or alter current true relationships',
        'target, One Move, and Five Futures do not alter current true relationships',
        'explicit, approximate, range, zero, estimated, and unknown states remain distinct',
        'profile A-B-A projection isolation holds',
        'missing true relationships do not collapse the Relationship Lake',
      ],
    },
    null,
    2
  )
);
