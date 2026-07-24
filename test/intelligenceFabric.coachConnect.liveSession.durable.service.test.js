import test from 'node:test';
import assert from 'node:assert/strict';
import { DurableLiveSessionAdapter } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/adapter.js';
import { createDurableLiveSessionRegistry } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/serviceRegistry.js';
import { createDurableLiveSessionService } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/service.js';
import { InMemoryDurableLiveSessionDriver } from '../src/lib/intelligenceFabric/testing/inMemoryDurableLiveSessionDriver.js';

const scope = { tenant_id: 'tenant_synthetic', profile_id: 'profile_synthetic', business_id: 'business_synthetic', subscriber_id: 'subscriber_synthetic', session_id: 'session_synthetic' };
const active = { foundation_enabled: true, synthetic_only: true, writes_enabled: true, emergency_disabled: false };

test('registry is injected, non-global, one-engine, and rejection produces zero canonical mutation', async () => {
  let appends = 0;
  const adapter = new DurableLiveSessionAdapter({ driver: new InMemoryDurableLiveSessionDriver(), capability: active, clock: () => '2026-07-22T00:00:00.000Z' });
  const registry = createDurableLiveSessionRegistry({ adapter, liveSessionService: { inspect: () => ({}) }, canonicalAppend: () => { appends += 1; return { ok: true, event_id: 'canonical', new_version: 2 }; } });
  const service = createDurableLiveSessionService(registry);
  const result = await service.promote({ scope, proposal: { proposal_id: 'p', base_business_engine_version: 1 }, confirmation: { proposal_id: 'p', response_state: 'REJECTED', response_actor_id: scope.subscriber_id }, business_engine: { version: 1 }, event: {} });
  assert.equal(result.canonical_append_count, 0); assert.equal(appends, 0);
  assert.deepEqual(service.inspect(), { default_off: false, synthetic_only: true, one_business_engine: true, coach_canonical_mutation_authority: false, production_traffic: false, deletion_epoch_enforced: true, local_jsonl_physical_deletion_proven: false });
});
