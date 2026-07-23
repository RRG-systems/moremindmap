import assert from 'node:assert/strict';
import { buildBusinessEngineContract } from '../src/lib/businessEngine/buildBusinessEngineContract.js';

function record(q3, mentions = [900, 50]) {
  return { assessment: { assessment_type: 'business_assessment', completed_at: '2026-07-23T00:00:00Z', inputs: { answers: { q3 } },
    output: { business_intelligence_draft: { relationship_reality: { evidence: { q3 }, database_size_mentions: mentions } } } } };
}

const explicit = buildBusinessEngineContract(record('I have about 900 contacts and true relationships are 15–20')).relationship_lake;
assert.equal(explicit.current_true_relationships?.low, 15);
assert.equal(explicit.current_true_relationships?.high, 20);

const unknown = buildBusinessEngineContract(record('I have 900 contacts; no reliable true relationship count')).relationship_lake;
assert.equal(unknown.current_true_relationships, null);
assert.equal(unknown.total_contacts?.value, 900);
assert.notEqual(unknown.current_true_relationships, 50);

const explicit50 = buildBusinessEngineContract(record('I have 900 contacts and true relationships are 50')).relationship_lake;
assert.equal(explicit50.current_true_relationships?.value, 50);

console.log('TRUE_RELATIONSHIP_PROVENANCE_REGRESSION_OK');
