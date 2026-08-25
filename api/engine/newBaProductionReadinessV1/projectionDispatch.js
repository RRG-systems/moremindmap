import { PRODUCTION_BA_CASSETTE_REGISTRY } from '../../../src/lib/baVerticalCassettesV1/index.js';
import { validatePersistedVerticalBinding } from '../../business-assessment/verticalBinding.js';
import { createRealProfileProjectionV2 } from './realProfileProjectionAdapter.js';

const PROJECTION_ADAPTERS = Object.freeze({
  'real-profile-governed-metric-evidence-projection-v6': createRealProfileProjectionV2,
});

export function projectNewBaBox1ThroughCassette({
  verticalBinding,
  sourceViewModel,
  bindings,
  registry = PRODUCTION_BA_CASSETTE_REGISTRY,
  adapters = PROJECTION_ADAPTERS,
} = {}) {
  const binding = validatePersistedVerticalBinding(verticalBinding, { registry });
  const registration = registry.resolveVertical(binding.vertical_id);
  const adapterId = registration.box_1_projection.adapter_id;
  const adapter = adapters[adapterId];
  if (typeof adapter !== 'function') throw new Error('new_ba_projection_cassette_adapter_missing');
  const projected = adapter({ sourceViewModel, bindings });
  return Object.freeze({
    ...projected,
    cassette_projection: Object.freeze({
      vertical_id: registration.vertical_id,
      cassette_id: registration.cassette_id,
      cassette_version: registration.cassette_version,
      projection_contract_id: registration.box_1_projection.contract_id,
      projection_contract_version: registration.box_1_projection.version,
      projection_contract_sha256: registration.box_1_projection.sha256,
      adapter_id: adapterId,
      binding_sha256: binding.binding_sha256,
    }),
    customerViewModel: Object.freeze({
      ...projected.customerViewModel,
      vertical: Object.freeze({
        state: 'CUSTOMER_CONFIRMED_OR_EXPLICIT_LEGACY_COMPATIBILITY',
        vertical_id: registration.vertical_id,
        label: registration.vertical_label,
      }),
    }),
  });
}

export const NEW_BA_PRODUCTION_PROJECTION_ADAPTER_IDS = Object.freeze(Object.keys(PROJECTION_ADAPTERS));
