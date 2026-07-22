import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';

export async function replayAndCheckpoint({ adapter, scope, events, reducer, initial_state, checkpoint_id = scope.session_id }) {
  let state = structuredClone(initial_state), lastSequence = 0, lastHash = null;
  try {
    for (const envelope of events) {
      const sequence = envelope.aggregate_sequence ?? envelope.event?.sequence_number;
      if (sequence !== lastSequence + 1) throw new Error('SEQUENCE_GAP');
      state = reducer(state, envelope.event || envelope); lastSequence = sequence;
      lastHash = envelope.envelope_hash || hashCanonicalJson(envelope);
    }
  } catch (error) {
    const failure = await preserveRecoveryFailure({ adapter, scope, code: error.message || 'REPLAY_FAILED', lastSequence, checkpoint_id });
    return deepFreeze({ ok: false, code: 'RECOVERY_FAILED', cause_code: error.message || 'REPLAY_FAILED', state: 'RECOVERY_FAILED', unresolved: true, failure });
  }
  const checkpoint = { last_sequence: lastSequence, last_event_hash: lastHash, state, state_hash: hashCanonicalJson(state) };
  const written = await adapter.write({ kind: 'checkpoint', object_id: checkpoint_id, scope, value: checkpoint, expected_version: 0, correlation_id: scope.session_id });
  if (!written.ok) {
    const failure = await preserveRecoveryFailure({ adapter, scope, code: 'CHECKPOINT_FAILURE', lastSequence, checkpoint_id });
    return deepFreeze({ ok: false, code: 'RECOVERY_FAILED', cause_code: 'CHECKPOINT_FAILURE', state: 'RECOVERY_FAILED', unresolved: true, failure });
  }
  return deepFreeze({ ok: true, state: 'ACTIVE', checkpoint, checkpoint_write: written, replayed_event_count: lastSequence });
}

export async function preserveRecoveryFailure({ adapter, scope, code, lastSequence, checkpoint_id }) {
  const value = { failure_class: 'RECOVERY_FAILURE', code, last_valid_sequence: lastSequence, unresolved_items: ['RECOVERY_REQUIRED'], operator_action: 'RETRY_REPLAY_AND_CHECKPOINT' };
  const failure = await adapter.write({ kind: 'failure', object_id: `${checkpoint_id}:${code}`, scope, value, expected_version: 0, correlation_id: scope.session_id });
  const unresolved = await adapter.write({ kind: 'unresolved', object_id: checkpoint_id, scope, value: value.unresolved_items, expected_version: 0, correlation_id: scope.session_id });
  return deepFreeze({ failure, unresolved, value });
}

export async function recordTeardownFailure({ adapter, scope, code = 'PROVIDER_TEARDOWN_FAILED' }) {
  const value = { failure_class: 'PROVIDER_FAILURE', code, unresolved_items: ['PROVIDER_TEARDOWN'], operator_action: 'RETRY_PROVIDER_TEARDOWN', closure_verdict: 'INCOMPLETE' };
  const failure = await adapter.write({ kind: 'failure', object_id: `${scope.session_id}:teardown`, scope, value, expected_version: 0, correlation_id: scope.session_id });
  const unresolved = await adapter.write({ kind: 'unresolved', object_id: `${scope.session_id}:teardown`, scope, value: value.unresolved_items, expected_version: 0, correlation_id: scope.session_id });
  return deepFreeze({ ok: false, code, state: 'FAILED', closure_verdict: 'INCOMPLETE', failure, unresolved });
}
