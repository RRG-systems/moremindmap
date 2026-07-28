import { deepFreeze } from '../../../validation.js';
import {
  samePrivateRuntimeScope,
} from '../contracts.js';
import {
  validatePrivateRuntimeProductBindingAttestationV1,
} from './contracts.js';

export const EXISTING_COACH_CONNECT_LIVE_ATTACHMENT_ADAPTER_VERSION =
  'existing-coach-connect-live-attachment-adapter-v1';

const frozen = (value) => deepFreeze(structuredClone(value));

function createExistingCoachConnectRuntimeReference(binding) {
  return Object.freeze({
    reference_only: true,
    owns_product_state: false,
    inspect() {
      return frozen({
        public_routes: [],
        one_business_engine: true,
        second_business_engine: false,
        live_billing: false,
        live_provider: false,
        text_only: true,
        transcript_persistence: false,
        canonical_write_entry: null,
        existing_runtime_ref: binding.runtime_ref,
      });
    },
  });
}

export function createExistingCoachConnectLiveAttachmentAdapterV1({
  productBindingAttestation,
  nowMs = Date.now(),
} = {}) {
  const checked = validatePrivateRuntimeProductBindingAttestationV1(
    productBindingAttestation,
    { nowMs },
  );
  const binding = checked.value?.coach_connect_runtime || null;
  const runtime = binding ? createExistingCoachConnectRuntimeReference(binding) : null;

  return Object.freeze({
    describeCapability() {
      return frozen({
        adapter_version: EXISTING_COACH_CONNECT_LIVE_ATTACHMENT_ADAPTER_VERSION,
        configured: checked.valid,
        existing_runtime_only: true,
        creates_runtime: false,
        owns_product_state: false,
        text_only: true,
        voice: false,
        media: false,
        transcript_persistence: false,
        canonical_mutation_authority: false,
      });
    },

    async resolveExistingCoachConnectRuntime({ exact_scope } = {}) {
      if (!checked.valid
        || !samePrivateRuntimeScope(exact_scope, productBindingAttestation.exact_scope)) {
        return frozen({ ok: false, code: 'COACH_CONNECT_STATE_MISSING' });
      }
      return Object.freeze({
        ok: true,
        runtime,
        state: frozen({
          ...binding,
          relationship_active: true,
          consent_granted: true,
          coach_authenticated: true,
          coach_entitlement_active: true,
          projection_input: {
            confirmation_requests: [],
            governed_updates: [],
          },
          structured_session_input: null,
        }),
        duplicate_runtime_created: false,
        transcript_persistence_activated: false,
        voice_media_call_required: false,
      });
    },
  });
}
