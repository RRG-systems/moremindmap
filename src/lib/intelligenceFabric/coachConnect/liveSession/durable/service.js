import { deepFreeze } from '../../../validation.js';
import { replayAndCheckpoint, recordTeardownFailure } from './checkpointReplay.js';
import { rebuildDurableProjection } from './projectionStore.js';
import { hashCanonicalJson } from '../../../hashing.js';

export async function runSyntheticMigrationDryRun({ adapter, scope, source_snapshot, migration_id = 'live_session_v1' }) {
  if (adapter.capability.synthetic_only !== true || adapter.capability.migration_enabled === true) return deepFreeze({ ok: false, code: 'SYNTHETIC_MIGRATION_REQUIRED' });
  const inventory = Object.fromEntries(Object.entries(source_snapshot).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0]));
  const converted = { schema_version: '1.0.0', source_hash: hashCanonicalJson(source_snapshot), inventory, production_data_read: false, production_data_written: false };
  const write = await adapter.write({ kind: 'migration', object_id: migration_id, scope, value: converted, expected_version: 0, correlation_id: scope.session_id });
  return deepFreeze({ ok: write.ok, deterministic_hash: hashCanonicalJson(converted), converted, write, rollback: { action: 'REMOVE_SYNTHETIC_MIGRATION_RECORD', production_effect: false } });
}

export function createDurableLiveSessionService(registry) {
  if (!registry?.adapter || !registry.liveSessionService) throw new TypeError('valid registry required');
  return deepFreeze({
    live: registry.liveSessionService,
    persistProposal: (scope, value) => registry.workflowStore.writeProposal(scope, value),
    persistConfirmation: (scope, value) => registry.workflowStore.writeConfirmation(scope, value),
    promote: (input) => registry.workflowStore.promote({ ...input, canonicalAppend: registry.canonicalAppend }),
    recover: (input) => replayAndCheckpoint({ adapter: registry.adapter, ...input }),
    teardownFailed: (input) => recordTeardownFailure({ adapter: registry.adapter, ...input }),
    rebuildProjection: (input) => rebuildDurableProjection({ adapter: registry.adapter, ...input }),
    migrateSynthetic: (input) => runSyntheticMigrationDryRun({ adapter: registry.adapter, ...input }),
    inspect: () => deepFreeze({
      default_off: !registry.adapter.active(),
      synthetic_only: registry.adapter.capability.synthetic_only === true,
      one_business_engine: true,
      coach_canonical_mutation_authority: false,
      production_traffic: false,
      deletion_epoch_enforced: typeof registry.adapter.currentDeletionEpoch === 'function',
      local_jsonl_physical_deletion_proven: false,
    }),
  });
}
