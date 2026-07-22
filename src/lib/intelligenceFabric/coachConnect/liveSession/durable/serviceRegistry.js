import { deepFreeze } from '../../../validation.js';
import { DurableBusinessEngineWorkflowStore } from './businessEngineStore.js';

export function createDurableLiveSessionRegistry({ adapter, liveSessionService, canonicalAppend = null, provider = null, telemetry = null }) {
  if (!adapter || !liveSessionService) throw new TypeError('adapter and liveSessionService are required');
  return deepFreeze({ adapter, liveSessionService, workflowStore: new DurableBusinessEngineWorkflowStore(adapter), canonicalAppend, provider, telemetry, one_business_engine: true, global_singleton: false, production_traffic: false });
}
