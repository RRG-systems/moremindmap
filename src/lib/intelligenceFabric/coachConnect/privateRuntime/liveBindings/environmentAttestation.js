import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  privateLiveEnvironmentAttestationDigest,
  remoteSecurityQualificationCertificateDigest,
  validatePrivateLiveEnvironmentAttestation,
  validateRemoteSecurityQualificationCertificate,
} from '../../productionSecurity/remoteSharedSecurity/attestations.js';
import {
  remoteSharedSecurityConfigurationDigest,
} from '../../productionSecurity/remoteSharedSecurity/configuration.js';
import {
  validatePrivateRuntimeConfigurationAuthorityV1,
  validatePrivateRuntimeProductBindingAttestationV1,
} from './contracts.js';

export const PRIVATE_RUNTIME_LIVE_ENVIRONMENT_AUTHORITY_VERSION =
  'private-runtime-live-environment-authority-v1';

export const ATOMIC_AUDIT_QUALIFICATION_REVIEW_SHA256 =
  '28b42df527bea92dce9a0ccfab9b72a933f8975529e3f02a64853b289f0c47ac';
export const LIVE_ATTESTATION_REPAIR_REVIEW_SHA256 =
  '4545be94544cdaf29940a45968ef2ac52b6865ed901aac87b84c265bf69f1b45';

const frozen = (value) => deepFreeze(structuredClone(value));

export function validatePrivateRuntimeLiveEnvironmentAuthorityV1({
  authorityPacket,
  remoteConfiguration,
  qualificationCertificate,
  liveEnvironmentAttestation,
  productBindingAttestation,
  assertionConfigurationDigest,
  adapterImplementationId,
  adapterSourceSha256,
  nowMs = Date.now(),
} = {}) {
  const packet = validatePrivateRuntimeConfigurationAuthorityV1(authorityPacket, {
    environmentId: remoteConfiguration?.environment_id,
    nowMs,
  });
  const errors = [...packet.errors];
  let configurationDigest = null;
  try {
    configurationDigest = remoteSharedSecurityConfigurationDigest(remoteConfiguration);
  } catch {
    errors.push({ code: 'REMOTE_SECURITY_CONFIGURATION_INVALID', field: 'remote_configuration' });
  }

  const certificate = validateRemoteSecurityQualificationCertificate(
    qualificationCertificate,
    {
      expected_adapter_implementation_id: adapterImplementationId,
      expected_adapter_source_sha256: adapterSourceSha256,
      expected_provider_class: remoteConfiguration?.provider,
      expected_qualification_review_package_sha256:
        ATOMIC_AUDIT_QUALIFICATION_REVIEW_SHA256,
      expected_attestation_repair_review_package_sha256:
        LIVE_ATTESTATION_REPAIR_REVIEW_SHA256,
      expected_script_manifest_sha256:
        remoteConfiguration?.script_manifest_digest,
      now_ms: nowMs,
    },
  );
  errors.push(...certificate.errors);

  const live = validatePrivateLiveEnvironmentAttestation(
    liveEnvironmentAttestation,
    {
      configuration: remoteConfiguration,
      configuration_digest: configurationDigest,
      qualification_certificate: certificate.value,
      expected_adapter_implementation_id: adapterImplementationId,
      expected_adapter_source_sha256: adapterSourceSha256,
      now_ms: nowMs,
    },
  );
  errors.push(...live.errors);

  const product = validatePrivateRuntimeProductBindingAttestationV1(
    productBindingAttestation,
    {
      environmentId: remoteConfiguration?.environment_id,
      nowMs,
    },
  );
  errors.push(...product.errors);

  if (packet.valid) {
    const expected = {
      remote_security_configuration_digest: configurationDigest,
      qualification_certificate_digest:
        qualificationCertificate
          ? remoteSecurityQualificationCertificateDigest(qualificationCertificate)
          : null,
      live_environment_attestation_digest:
        liveEnvironmentAttestation
          ? privateLiveEnvironmentAttestationDigest(liveEnvironmentAttestation)
          : null,
      product_binding_attestation_digest: productBindingAttestation?.binding_sha256,
      assertion_configuration_digest: assertionConfigurationDigest,
      qualified_adapter_source_sha256: adapterSourceSha256,
    };
    for (const [field, value] of Object.entries(expected)) {
      if (authorityPacket[field] !== value) {
        errors.push({ code: 'CONFIGURATION_AUTHORITY_MISMATCH', field });
      }
    }
    if (authorityPacket.activation_owner_ref
      !== liveEnvironmentAttestation?.activation_owner_ref
      || authorityPacket.rollback_owner_ref
        !== liveEnvironmentAttestation?.rollback_owner_ref) {
      errors.push({ code: 'CONFIGURATION_AUTHORITY_MISMATCH', field: 'owners' });
    }
  }

  const valid = errors.length === 0
    && liveEnvironmentAttestation?.operating_mode === 'PRIVATE_LIVE'
    && liveEnvironmentAttestation?.persistent_namespace === true
    && liveEnvironmentAttestation?.disposable_namespace === false
    && liveEnvironmentAttestation?.private_live_only === true
    && liveEnvironmentAttestation?.public_access === false
    && liveEnvironmentAttestation?.runtime_default_state === 'OFF'
    && liveEnvironmentAttestation?.emergency_disable_supported === true
    && liveEnvironmentAttestation?.emergency_disable_state === 'READY';

  return frozen({
    valid,
    errors,
    value: valid
      ? {
        authority_version: PRIVATE_RUNTIME_LIVE_ENVIRONMENT_AUTHORITY_VERSION,
        environment_id: remoteConfiguration.environment_id,
        configuration_digest: configurationDigest,
        qualification_certificate_digest:
          remoteSecurityQualificationCertificateDigest(qualificationCertificate),
        live_environment_attestation_digest:
          privateLiveEnvironmentAttestationDigest(liveEnvironmentAttestation),
        product_binding_attestation_digest: productBindingAttestation.binding_sha256,
        authority_fingerprint: hashCanonicalJson({
          packet: authorityPacket.packet_sha256,
          configuration: configurationDigest,
          certificate: qualificationCertificate.certificate_sha256,
          environment: liveEnvironmentAttestation.attestation_sha256,
          product: productBindingAttestation.binding_sha256,
        }),
        source_default_off: true,
        public_access: false,
        persistent_namespace: true,
        disposable_namespace: false,
      }
      : null,
  });
}
