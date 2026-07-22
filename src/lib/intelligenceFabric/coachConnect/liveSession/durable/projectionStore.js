import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';

export async function rebuildDurableProjection({ adapter, scope, projection_id, events, reducer, initial_state }) {
  const value = events.reduce((state, envelope) => reducer(state, envelope.event || envelope), structuredClone(initial_state));
  const result = await adapter.write({ kind: 'projection', object_id: projection_id, scope, value, expected_version: 0, correlation_id: scope.session_id });
  return deepFreeze({ ok: result.ok, status: result.status, projection: value, projection_hash: hashCanonicalJson(value), write: result });
}
