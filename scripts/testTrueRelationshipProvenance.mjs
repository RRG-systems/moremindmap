import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildBusinessEngineContract } from '../src/lib/businessEngine/buildBusinessEngineContract.js';
import { projectBusinessEngineVisualV2 } from '../src/lib/businessEngine/projectBusinessEngineVisualV2.js';
import { validateBusinessEngineContract } from '../src/lib/businessEngine/validateBusinessEngineContract.js';

function record(q3, mentions = [900, 50], extra = {}) {
  return {
    assessment: {
      assessment_type: 'business_assessment',
      completed_at: '2026-07-23T00:00:00Z',
      inputs: { answers: { q3, ...(extra.answers || {}) } },
      output: {
        business_intelligence_draft: {
          relationship_reality: {
            evidence: { q3 },
            database_size_mentions: mentions,
          },
        },
        five_futures_v1: extra.fiveFutures || {},
        one_move_v1: extra.oneMove || {},
      },
    },
  };
}

function build(q3, options = {}, extra = {}) {
  const contract = buildBusinessEngineContract(record(q3, extra.mentions, extra), options);
  const projection = projectBusinessEngineVisualV2(contract);
  const validation = validateBusinessEngineContract(contract);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  return { contract, projection };
}

const explicit = build(
  'I have about 900 contacts and true relationships are 15–20'
);
assert.equal(explicit.contract.relationship_lake.current_true_relationships?.low, 15);
assert.equal(explicit.contract.relationship_lake.current_true_relationships?.high, 20);
assert.equal(explicit.contract.relationship_lake.true_relationships.provenance, 'EXPLICIT');
assert.equal(explicit.projection.relationship_lake.current_true_relationships, '15–20');

const unknown = build('I have 900 contacts; no reliable true relationship count');
assert.equal(unknown.contract.relationship_lake.current_true_relationships, null);
assert.equal(unknown.contract.relationship_lake.total_contacts?.value, 900);
assert.notEqual(unknown.contract.relationship_lake.current_true_relationships, 50);
assert.equal(unknown.contract.relationship_lake.true_relationships.provenance, 'UNKNOWN');
assert.equal(unknown.projection.relationship_lake.current_true_relationships, '—');
assert.equal(
  unknown.projection.relationship_lake.current_true_relationships_note,
  'Not yet measured'
);

const explicit50 = build('I have 900 contacts and true relationships are 50');
assert.equal(explicit50.contract.relationship_lake.current_true_relationships?.value, 50);
assert.equal(
  explicit50.contract.relationship_lake.true_relationships.provenance,
  'EXPLICIT'
);

const explicitZero = build('0 true relationships');
assert.equal(explicitZero.contract.relationship_lake.current_true_relationships?.value, 0);
assert.equal(explicitZero.projection.relationship_lake.current_true_relationships, '0');
assert.equal(
  explicitZero.contract.relationship_lake.true_relationships.provenance,
  'EXPLICIT'
);

const optionZero = build('', {
  metrics: {
    currentTrueRelationships: 0,
    relationshipTarget: { value: 100, estimated: true },
    relationshipGap: { value: 0, estimated: false },
  },
});
assert.equal(optionZero.contract.relationship_lake.current_true_relationships?.value, 0);
assert.equal(optionZero.contract.relationship_lake.gap?.value, 0);

const totalOnly = build('1,200 contacts', {}, { mentions: [1200, 50] });
assert.equal(totalOnly.contract.relationship_lake.total_contacts?.value, 1200);
assert.equal(totalOnly.contract.relationship_lake.current_true_relationships, null);
assert.equal(
  totalOnly.contract.relationship_lake.true_relationships.source_class,
  'TOTAL_CONTACTS_ONLY'
);

const targetOnly = build('I want 300 true relationships');
assert.equal(targetOnly.contract.relationship_lake.current_true_relationships, null);
assert.equal(
  targetOnly.contract.relationship_lake.true_relationships.source_class,
  'FUTURE_TARGET'
);

const legacyPositional = build('', {
  metrics: {
    currentTrueRelationships: {
      value: 50,
      source: 'Extracted',
    },
  },
});
assert.equal(legacyPositional.contract.relationship_lake.current_true_relationships, null);
assert.equal(
  legacyPositional.contract.relationship_lake.true_relationships.source_class,
  'LEGACY_POSITIONAL_INFERENCE'
);
assert.equal(
  legacyPositional.projection.relationship_lake.current_true_relationships_note,
  'Not yet measured'
);

const estimated = build('', {
  metrics: {
    currentTrueRelationships: {
      value: 140,
      provenance: 'ESTIMATED',
      source_class: 'ESTIMATED_INDIVIDUALIZED',
      estimate_method: 'synthetic documented individualized estimate',
      temporal_state: 'CURRENT',
    },
  },
});
assert.equal(estimated.contract.relationship_lake.true_relationships.provenance, 'ESTIMATED');
assert.equal(estimated.projection.relationship_lake.current_true_relationships, '~140');
assert.equal(
  estimated.projection.relationship_lake.current_true_relationships_note,
  'Estimated'
);

const approximate = build('about 140 true relationships');
assert.equal(approximate.contract.relationship_lake.true_relationships.provenance, 'EXPLICIT');
assert.equal(
  approximate.contract.relationship_lake.true_relationships.source_class,
  'EXPLICIT_APPROXIMATE'
);
assert.equal(approximate.projection.relationship_lake.current_true_relationships, '~140');
assert.equal(
  approximate.projection.relationship_lake.current_true_relationships_note,
  'Customer reported'
);

const rendererSource = await readFile(
  new URL(
    '../src/components/businessAssessment/BusinessEngineVisualV2.jsx',
    import.meta.url
  ),
  'utf8'
);
assert.match(rendererSource, /current_true_relationships_note/);
assert.match(rendererSource, /data-provenance-state/);
assert.match(rendererSource, /bev2-lake-provenance/);

console.log('TRUE_RELATIONSHIP_PROVENANCE_REGRESSION_OK');
