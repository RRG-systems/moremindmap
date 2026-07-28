import { deepFreeze } from '../../../validation.js';
import {
  liveSubscriberAssertionConfigurationDigest,
  validateLiveSubscriberAssertionConfigurationV1,
} from '../../productionSecurity/liveSubscriberAssertion/contracts.js';
import {
  validatePrivateRuntimeActivationReceiptV1,
  validatePrivateRuntimeConfigurationAuthorityV1,
  validatePrivateRuntimeProductBindingAttestationV1,
} from './contracts.js';
import {
  validatePrivateRuntimeLiveEnvironmentAuthorityV1,
} from './environmentAttestation.js';

export const PRIVATE_RUNTIME_LIVE_REFERENCE_VARIABLES = deepFreeze([
  'MORE_PRIVATE_RUNTIME_CONFIGURATION_AUTHORITY_PACKET_REF',
  'MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_CONFIG_REF',
  'MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_QUALIFICATION_CERTIFICATE_REF',
  'MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_ATTESTATION_REF',
  'MORE_PRIVATE_RUNTIME_PRODUCT_BINDING_ATTESTATION_REF',
  'MORE_PRIVATE_RUNTIME_ASSERTION_CONFIGURATION_REF',
]);

const frozen = (value) => deepFreeze(structuredClone(value));
const deny = (code, field = null) => frozen({
  ok: false,
  allowed: false,
  code,
  field,
  provider_call_required: false,
});

function parseDocument(serialized, field) {
  if (typeof serialized !== 'string' || serialized.length < 2 || serialized.length > 131072) {
    throw new TypeError(`${field} reference did not resolve to a bounded document`);
  }
  const parsed = JSON.parse(serialized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`${field} document is invalid`);
  }
  return parsed;
}

export function createPrivateRuntimeEnvironmentReferenceResolver(env = {}) {
  return async function resolvePrivateRuntimeEnvironmentReference(reference) {
    if (typeof reference !== 'string'
      || !/^[A-Z][A-Z0-9_]{2,127}$/.test(reference)
      || !reference.startsWith('MORE_PRIVATE_RUNTIME_')) {
      return null;
    }
    const value = env[reference];
    return typeof value === 'string' ? value : null;
  };
}

export async function readPrivateRuntimeLiveConfigurationAuthorityV1({
  env = globalThis.process?.env || {},
  resolveReference = createPrivateRuntimeEnvironmentReferenceResolver(env),
  adapterImplementationId,
  adapterSourceSha256,
  nowMs = Date.now(),
} = {}) {
  if (env.MORE_PRIVATE_RUNTIME_LIVE_ENABLED !== 'true'
    && env.MORE_PRIVATE_RUNTIME_LIVE_ENABLED !== 'false') {
    return deny('ASYNC_SECURITY_UNCONFIGURED', 'MORE_PRIVATE_RUNTIME_LIVE_ENABLED');
  }
  if (env.MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED !== 'true'
    && env.MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED !== 'false') {
    return deny('ASYNC_SECURITY_UNCONFIGURED', 'MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED');
  }
  if (typeof resolveReference !== 'function') {
    return deny('ASYNC_SECURITY_UNCONFIGURED', 'resolveReference');
  }

  const documents = {};
  try {
    for (const variable of PRIVATE_RUNTIME_LIVE_REFERENCE_VARIABLES) {
      const reference = env[variable];
      if (typeof reference !== 'string') return deny('ASYNC_SECURITY_UNCONFIGURED', variable);
      const serialized = await resolveReference(reference, {
        purpose: variable,
        secret: false,
      });
      documents[variable] = parseDocument(serialized, variable);
    }
  } catch {
    return deny('ASYNC_SECURITY_UNCONFIGURED', 'reference_resolution');
  }

  const authorityPacket =
    documents.MORE_PRIVATE_RUNTIME_CONFIGURATION_AUTHORITY_PACKET_REF;
  const remoteConfiguration =
    documents.MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_CONFIG_REF;
  const qualificationCertificate =
    documents.MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_QUALIFICATION_CERTIFICATE_REF;
  const liveEnvironmentAttestation =
    documents.MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_ATTESTATION_REF;
  const productBindingAttestation =
    documents.MORE_PRIVATE_RUNTIME_PRODUCT_BINDING_ATTESTATION_REF;
  const assertionConfiguration =
    documents.MORE_PRIVATE_RUNTIME_ASSERTION_CONFIGURATION_REF;

  const packet = validatePrivateRuntimeConfigurationAuthorityV1(authorityPacket, {
    environmentId: remoteConfiguration?.environment_id,
    nowMs,
  });
  const assertion = validateLiveSubscriberAssertionConfigurationV1(
    assertionConfiguration,
    {
      environmentId: remoteConfiguration?.environment_id,
      exactScopeHash: productBindingAttestation?.exact_scope_hash,
    },
  );
  const product = validatePrivateRuntimeProductBindingAttestationV1(
    productBindingAttestation,
    {
      environmentId: remoteConfiguration?.environment_id,
      nowMs,
    },
  );
  if (!packet.valid || !assertion.valid || !product.valid) {
    return deny(
      packet.errors[0]?.code
        || assertion.errors[0]?.code
        || product.errors[0]?.code
        || 'CONFIGURATION_AUTHORITY_INVALID',
      packet.errors[0]?.field
        || assertion.errors[0]?.field
        || product.errors[0]?.field
        || null,
    );
  }

  const liveAuthority = validatePrivateRuntimeLiveEnvironmentAuthorityV1({
    authorityPacket,
    remoteConfiguration,
    qualificationCertificate,
    liveEnvironmentAttestation,
    productBindingAttestation,
    assertionConfigurationDigest:
      liveSubscriberAssertionConfigurationDigest(assertionConfiguration),
    adapterImplementationId,
    adapterSourceSha256,
    nowMs,
  });
  if (!liveAuthority.valid) {
    return deny(
      liveAuthority.errors[0]?.code || 'LIVE_ENVIRONMENT_ATTESTATION_INVALID',
      liveAuthority.errors[0]?.field || null,
    );
  }

  let activationReceipt = null;
  if (authorityPacket.live_enabled === true) {
    try {
      const serialized = await resolveReference(authorityPacket.activation_receipt_ref, {
        purpose: 'MORE_PRIVATE_RUNTIME_ACTIVATION_RECEIPT',
        secret: false,
      });
      activationReceipt = parseDocument(serialized, 'activation_receipt');
    } catch {
      return deny('ACTIVATION_AUTHORITY_REQUIRED', 'activation_receipt_ref');
    }
    const activation = validatePrivateRuntimeActivationReceiptV1(activationReceipt, {
      environmentId: authorityPacket.environment_id,
      configurationAuthorityPacketDigest: authorityPacket.packet_sha256,
      exactScopeHash: productBindingAttestation.exact_scope_hash,
      activationOwnerRef: authorityPacket.activation_owner_ref,
      rollbackOwnerRef: authorityPacket.rollback_owner_ref,
      nowMs,
    });
    if (!activation.valid) {
      return deny(activation.errors[0]?.code || 'ACTIVATION_AUTHORITY_REQUIRED');
    }
  }

  if ((env.MORE_PRIVATE_RUNTIME_LIVE_ENABLED === 'true') !== authorityPacket.live_enabled
    || (env.MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED === 'true')
      !== authorityPacket.emergency_disabled) {
    return deny('CONFIGURATION_AUTHORITY_MISMATCH', 'activation_state');
  }

  const resolvedAuthority = frozen({
    ok: true,
    allowed: false,
    configured: true,
    state: authorityPacket.emergency_disabled
      ? 'EMERGENCY_DISABLED'
      : authorityPacket.live_enabled
        ? 'READY_FOR_PRIVATE_TEST'
        : 'CONFIGURED_DISABLED',
    authority_packet: authorityPacket,
    remote_configuration: remoteConfiguration,
    qualification_certificate: qualificationCertificate,
    live_environment_attestation: liveEnvironmentAttestation,
    product_binding_attestation: productBindingAttestation,
    assertion_configuration: assertionConfiguration,
    activation_receipt: activationReceipt,
    live_authority: liveAuthority.value,
    source_default_off: true,
    public_access: false,
    provider_call_required: false,
  });
  return Object.freeze({
    ...resolvedAuthority,
    resolve_secret_reference: resolveReference,
  });
}
