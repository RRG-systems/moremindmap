import { deepFreeze } from '../../../validation.js';
import {
  samePrivateRuntimeScope,
} from '../contracts.js';
import {
  PRIVATE_RUNTIME_SUBSCRIPTION_INTERACTIONS,
} from '../attachments.js';
import {
  validatePrivateRuntimeProductBindingAttestationV1,
} from './contracts.js';

export const EXISTING_SUBSCRIPTION_RUNTIME_LIVE_ATTACHMENT_ADAPTER_VERSION =
  'existing-subscription-runtime-live-attachment-adapter-v1';

const frozen = (value) => deepFreeze(structuredClone(value));

function createExistingSubscriptionRuntimeReference(binding) {
  return Object.freeze({
    reference_only: true,
    owns_product_state: false,
    inspect_contract() {
      return frozen({
        commands: PRIVATE_RUNTIME_SUBSCRIPTION_INTERACTIONS
          .filter((entry) => ['START_SESSION', 'SUBMIT_TURN', 'DECIDE_EXTRACTION']
            .includes(entry)),
        queries: PRIVATE_RUNTIME_SUBSCRIPTION_INTERACTIONS
          .filter((entry) => !['START_SESSION', 'SUBMIT_TURN', 'DECIDE_EXTRACTION']
            .includes(entry)),
        public_routes: [],
        feature_flags_default_off: true,
        existing_runtime: true,
        runtime_contract_version: binding.runtime_contract_version,
      });
    },
  });
}

export function createExistingSubscriptionRuntimeLiveAttachmentAdapterV1({
  productBindingAttestation,
  resolveProductBindingAttestation = null,
  nowMs = Date.now(),
} = {}) {
  const checked = validatePrivateRuntimeProductBindingAttestationV1(
    productBindingAttestation,
    { nowMs },
  );

  return Object.freeze({
    describeCapability() {
      return frozen({
        adapter_version:
          EXISTING_SUBSCRIPTION_RUNTIME_LIVE_ATTACHMENT_ADAPTER_VERSION,
        configured: checked.valid,
        existing_runtime_only: true,
        creates_runtime: false,
        owns_product_state: false,
        paid_entitlement: false,
        stripe: false,
        model_routing_changed: false,
      });
    },

    async resolveExistingSubscriptionRuntime({ exact_scope } = {}) {
      let selectedBinding = productBindingAttestation;
      let selectedValidation = checked;
      if (typeof resolveProductBindingAttestation === 'function') {
        selectedBinding = await resolveProductBindingAttestation(exact_scope);
        selectedValidation = validatePrivateRuntimeProductBindingAttestationV1(
          selectedBinding,
          { nowMs },
        );
      }
      const selectedDescriptor = selectedValidation.value?.subscription_runtime || null;
      const selectedRuntime = selectedDescriptor
        ? createExistingSubscriptionRuntimeReference(selectedDescriptor)
        : null;
      if (!selectedValidation.valid
        || !samePrivateRuntimeScope(exact_scope, selectedBinding.exact_scope)) {
        return frozen({
          ok: false,
          code: 'SUBSCRIPTION_RUNTIME_UNAVAILABLE',
        });
      }
      return Object.freeze({
        ok: true,
        runtime: selectedRuntime,
        descriptor: frozen(selectedDescriptor),
        duplicate_runtime_created: false,
        production_persistence_activated: false,
        stripe_call_required: false,
      });
    },
  });
}
