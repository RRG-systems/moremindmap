import { deepFreeze } from '../../../validation.js';
import {
  hashPrivateRuntimeScope,
  samePrivateRuntimeScope,
} from '../contracts.js';
import {
  validatePrivateRuntimeProductBindingAttestationV1,
} from './contracts.js';

export const CANONICAL_BUSINESS_ENGINE_LIVE_ATTACHMENT_ADAPTER_VERSION =
  'canonical-business-engine-live-attachment-adapter-v1';

const frozen = (value) => deepFreeze(structuredClone(value));

export function createCanonicalBusinessEngineLiveAttachmentAdapterV1({
  productBindingAttestation,
  nowMs = Date.now(),
} = {}) {
  const checked = validatePrivateRuntimeProductBindingAttestationV1(
    productBindingAttestation,
    { nowMs },
  );
  const engine = checked.value?.business_engine || null;

  return Object.freeze({
    describeCapability() {
      return frozen({
        adapter_version: CANONICAL_BUSINESS_ENGINE_LIVE_ATTACHMENT_ADAPTER_VERSION,
        configured: checked.valid,
        canonical_source_only: true,
        read_only: true,
        can_build_engine: false,
        can_persist_engine: false,
        production_connection: false,
        owns_product_state: false,
        profile_id_request_authority: false,
      });
    },

    async lookupCanonicalBusinessEngine(exactScope) {
      if (!checked.valid
        || !samePrivateRuntimeScope(exactScope, productBindingAttestation.exact_scope)
        || hashPrivateRuntimeScope(exactScope)
          !== productBindingAttestation.exact_scope_hash) {
        return frozen({
          ok: false,
          engines: [],
          code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND',
        });
      }
      return frozen({
        ok: true,
        engines: [{
          ...engine,
          write_authorized: false,
        }],
        count: 1,
        duplicate_engine_created: false,
        attestation_ref:
          `product_binding_${productBindingAttestation.binding_sha256.slice(0, 32)}`,
      });
    },
  });
}
