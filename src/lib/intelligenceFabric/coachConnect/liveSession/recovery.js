import { deepFreeze } from '../../validation.js';
import { liveSessionSemanticHash } from './contracts.js';

export function recordLiveSessionFailure({ driver, session_id, failure_class, code, last_valid_sequence, unresolved_items = [], now }) {
  const failure = { failure_id: `failure_${liveSessionSemanticHash({ session_id, failure_class, code, last_valid_sequence }).slice(0, 24)}`, session_id, failure_class, code, last_valid_sequence, unresolved_items, occurred_at: now, sensitive_content: null, status: 'OPEN' };
  driver.save('failures', failure.failure_id, failure); return deepFreeze(failure);
}

export function recoverLiveSession({ driver, eventStore, session_id, reducer, initial_state, now }) {
  const previousCheckpoint = driver.get('checkpoints', session_id); let events = [], state = initial_state, lastValidSequence = 0;
  try {
    const read = eventStore.read({ session_id });
    if (!Array.isArray(read)) throw Object.assign(new Error('Replay read failed'), { code: read?.status || read?.code || 'REPLAY_READ_FAILED' });
    events = read;
    for (const event of events) { state = reducer(state, event); lastValidSequence = event.sequence_number; }
  } catch (error) {
    const failure = recordLiveSessionFailure({ driver, session_id, failure_class: 'RECOVERY_FAILURE', code: error?.code || 'REPLAY_FAILED', last_valid_sequence: lastValidSequence, unresolved_items: ['RECOVERY_REPLAY'], now });
    return deepFreeze({ ok: false, code: 'RECOVERY_REPLAY_FAILED', cause_code: error?.code || 'REPLAY_FAILED', failure, replayed_event_count: lastValidSequence, previous_checkpoint: previousCheckpoint });
  }
  const stateHash = liveSessionSemanticHash(state);
  try {
    const checkpointResult = eventStore.checkpoint({ session_id, sequence_number: lastValidSequence, state_hash: stateHash });
    if (checkpointResult?.ok !== true) {
      const cause = checkpointResult?.status || checkpointResult?.code || 'CHECKPOINT_FAILED';
      const failure = recordLiveSessionFailure({ driver, session_id, failure_class: 'RECOVERY_FAILURE', code: cause, last_valid_sequence: lastValidSequence, unresolved_items: ['RECOVERY_CHECKPOINT'], now });
      return deepFreeze({ ok: false, code: 'RECOVERY_CHECKPOINT_FAILED', cause_code: cause, failure, state, state_hash: stateHash, replayed_event_count: events.length, previous_checkpoint: previousCheckpoint });
    }
  } catch (error) {
    const failure = recordLiveSessionFailure({ driver, session_id, failure_class: 'RECOVERY_FAILURE', code: error?.code || 'CHECKPOINT_FAILED', last_valid_sequence: lastValidSequence, unresolved_items: ['RECOVERY_CHECKPOINT'], now });
    return deepFreeze({ ok: false, code: 'RECOVERY_CHECKPOINT_FAILED', cause_code: error?.code || 'CHECKPOINT_FAILED', failure, state, state_hash: stateHash, replayed_event_count: events.length, previous_checkpoint: previousCheckpoint });
  }
  return deepFreeze({ ok: true, state, state_hash: stateHash, replayed_event_count: events.length, previous_checkpoint: previousCheckpoint, duplicate_canonical_promotions: 0 });
}
