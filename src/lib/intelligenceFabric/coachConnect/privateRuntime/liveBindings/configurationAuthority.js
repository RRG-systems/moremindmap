import { deepFreeze } from '../../../validation.js';
import {
  liveSubscriberAssertionConfigurationDigest,
  validateLiveSubscriberAssertionConfigurationV1,
} from '../../productionSecurity/liveSubscriberAssertion/contracts.js';
import {
  validateProtectedEdgeIdentityConfigurationV1,
} from '../../productionSecurity/protectedEdgeIdentity/contracts.js';
import {
  PRIVATE_RUNTIME_COHORT_ACTIVATION_RECEIPT_VERSION,
  validatePrivateRuntimeCohortActivationReceiptV2,
  validatePrivateRuntimeActivationReceiptV1,
  validatePrivateRuntimeConfigurationAuthorityV1,
  validatePrivateRuntimeProductBindingAttestationV1,
  validatePrivateRuntimeRollbackReceiptV1,
} from './contracts.js';
import {
  validatePrivateRuntimeLiveEnvironmentAuthorityV1,
} from './environmentAttestation.js';
import {
  readPrivateRuntimeApprovedProfileCohortV1,
} from './profileCohort.js';

export const PRIVATE_RUNTIME_LIVE_REFERENCE_VARIABLES = deepFreeze([
  'MORE_PRIVATE_RUNTIME_CONFIGURATION_AUTHORITY_PACKET_REF',
  'MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_CONFIG_REF',
  'MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_QUALIFICATION_CERTIFICATE_REF',
  'MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_ATTESTATION_REF',
  'MORE_PRIVATE_RUNTIME_PRODUCT_BINDING_ATTESTATION_REF',
  'MORE_PRIVATE_RUNTIME_ASSERTION_CONFIGURATION_REF',
  'MORE_PRIVATE_RUNTIME_PROTECTED_EDGE_CONFIGURATION_REF',
]);
export const PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_IDENTITY_VARIABLE =
  'MORE_PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_SHA256';

const PRIVATE_RUNTIME_PRODUCT_STORE_AUTHORITY_ALIAS =
  'MORE_PRIVATE_RUNTIME_PRODUCT_STORE_REDIS_URL';
const PRIVATE_RUNTIME_PRODUCT_STORE_AUTHORITY_ALIAS_SOURCE = 'REDIS_URL';

const frozen = (value) => deepFreeze(structuredClone(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
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
    if (reference === PRIVATE_RUNTIME_PRODUCT_STORE_AUTHORITY_ALIAS) {
      const aliasedValue = env[PRIVATE_RUNTIME_PRODUCT_STORE_AUTHORITY_ALIAS_SOURCE];
      return typeof aliasedValue === 'string' ? aliasedValue : null;
    }
    const value = env[reference];
    return typeof value === 'string' ? value : null;
  };
}

export function privateRuntimeProductStoreConnectionAllowedV1({
  reference,
  value,
  env = {},
} = {}) {
  if (typeof value !== 'string') return false;
  if (value.startsWith('rediss://')) return true;
  return reference === PRIVATE_RUNTIME_PRODUCT_STORE_AUTHORITY_ALIAS
    && value.startsWith('redis://')
    && typeof env[PRIVATE_RUNTIME_PRODUCT_STORE_AUTHORITY_ALIAS_SOURCE] === 'string'
    && value === env[PRIVATE_RUNTIME_PRODUCT_STORE_AUTHORITY_ALIAS_SOURCE];
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
  const immutableDeploymentIdentity =
    env[PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_IDENTITY_VARIABLE];
  if (!sha256(immutableDeploymentIdentity)) {
    return deny(
      'PROTECTED_EDGE_IMMUTABLE_DEPLOYMENT_IDENTITY_REQUIRED',
      PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_IDENTITY_VARIABLE,
    );
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
  const protectedEdgeConfiguration =
    documents.MORE_PRIVATE_RUNTIME_PROTECTED_EDGE_CONFIGURATION_REF;

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
  const protectedEdge = validateProtectedEdgeIdentityConfigurationV1(
    protectedEdgeConfiguration,
    {
      environmentId: remoteConfiguration?.environment_id,
      deploymentId: immutableDeploymentIdentity,
      policyDigest: authorityPacket?.protected_edge_policy_digest,
      internalSigningKeyRef: authorityPacket?.edge_assertion_key_ref,
    },
  );
  if (!packet.valid || !assertion.valid || !product.valid || !protectedEdge.valid) {
    return deny(
      packet.errors[0]?.code
        || assertion.errors[0]?.code
        || product.errors[0]?.code
        || protectedEdge.errors[0]?.code
        || 'CONFIGURATION_AUTHORITY_INVALID',
      packet.errors[0]?.field
        || assertion.errors[0]?.field
        || product.errors[0]?.field
        || protectedEdge.errors[0]?.field
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

  const cohortConfigured =
    typeof env.MORE_PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_REF === 'string';
  let approvedProfileCohort = null;
  let approvedProfileCohortReference = null;
  if (cohortConfigured) {
    const cohortResult = await readPrivateRuntimeApprovedProfileCohortV1({
      env,
      resolveReference,
      environmentId: authorityPacket.environment_id,
      nowMs,
    });
    if (!cohortResult.ok) {
      return deny(cohortResult.code || 'APPROVED_PROFILE_COHORT_UNCONFIGURED');
    }
    approvedProfileCohort = cohortResult.cohort;
    approvedProfileCohortReference = cohortResult.reference;
    const rootMember = approvedProfileCohort.members.find((member) =>
      member.profile_id === productBindingAttestation.exact_scope.profile_id);
    if (rootMember == null
      || rootMember.subscriber_subject_ref
        !== productBindingAttestation.subscriber_subject_ref
      || rootMember.exact_scope_hash !== productBindingAttestation.exact_scope_hash
      || rootMember.business_engine_execution_contract_sha256
        !== productBindingAttestation.business_engine.business_engine_contract_hash) {
      return deny('APPROVED_PROFILE_COHORT_ROOT_BINDING_MISMATCH');
    }
  }

  let activationReceipt = null;
  let rollbackReceipt = null;
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
    let activation;
    if (approvedProfileCohort != null) {
      if (activationReceipt?.receipt_version
        !== PRIVATE_RUNTIME_COHORT_ACTIVATION_RECEIPT_VERSION) {
        return deny('COHORT_ACTIVATION_RECEIPT_REQUIRED');
      }
      try {
        const serialized = await resolveReference(activationReceipt.rollback_receipt_ref, {
          purpose: 'MORE_PRIVATE_RUNTIME_ROLLBACK_RECEIPT',
          secret: false,
        });
        rollbackReceipt = parseDocument(serialized, 'rollback_receipt');
      } catch {
        return deny('ROLLBACK_AUTHORITY_REQUIRED', 'rollback_receipt_ref');
      }
      const rollback = validatePrivateRuntimeRollbackReceiptV1(rollbackReceipt, {
        environmentId: authorityPacket.environment_id,
        configurationAuthorityPacketDigest: authorityPacket.packet_sha256,
        approvedProfileCohortDigest: approvedProfileCohort.cohort_sha256,
        rollbackOwnerRef: authorityPacket.rollback_owner_ref,
        nowMs,
      });
      if (!rollback.valid) {
        return deny(rollback.errors[0]?.code || 'ROLLBACK_AUTHORITY_REQUIRED');
      }
      activation = validatePrivateRuntimeCohortActivationReceiptV2(activationReceipt, {
        environmentId: authorityPacket.environment_id,
        configurationAuthorityPacketDigest: authorityPacket.packet_sha256,
        approvedProfileCohortDigest: approvedProfileCohort.cohort_sha256,
        cohortCount: approvedProfileCohort.member_count,
        deploymentCommitSha: typeof env.VERCEL_GIT_COMMIT_SHA === 'string'
          ? env.VERCEL_GIT_COMMIT_SHA
          : null,
        vercelProjectReference: liveEnvironmentAttestation.vercel_project_reference,
        productBindingAttestationDigest: productBindingAttestation.binding_sha256,
        activationOwnerRef: authorityPacket.activation_owner_ref,
        rollbackOwnerRef: authorityPacket.rollback_owner_ref,
        rollbackReceiptDigest: rollbackReceipt.receipt_sha256,
        nowMs,
      });
    } else {
      activation = validatePrivateRuntimeActivationReceiptV1(activationReceipt, {
        environmentId: authorityPacket.environment_id,
        configurationAuthorityPacketDigest: authorityPacket.packet_sha256,
        exactScopeHash: productBindingAttestation.exact_scope_hash,
        activationOwnerRef: authorityPacket.activation_owner_ref,
        rollbackOwnerRef: authorityPacket.rollback_owner_ref,
        nowMs,
      });
    }
    if (!activation.valid) {
      return deny(activation.errors[0]?.code || 'ACTIVATION_AUTHORITY_REQUIRED');
    }
  }

  if ((env.MORE_PRIVATE_RUNTIME_LIVE_ENABLED === 'true') !== authorityPacket.live_enabled
    || (env.MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED === 'true')
      !== authorityPacket.emergency_disabled
    || protectedEdgeConfiguration.enabled !== true
    || protectedEdgeConfiguration.emergency_disabled
      !== authorityPacket.emergency_disabled
    || (approvedProfileCohort != null
      && (env.MORE_SUBDEV1_OPERATOR_ENABLED === 'true')
        !== authorityPacket.live_enabled)) {
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
    immutable_deployment_identity: immutableDeploymentIdentity,
    project_reference: liveEnvironmentAttestation.vercel_project_reference,
    product_binding_attestation: productBindingAttestation,
    assertion_configuration: assertionConfiguration,
    protected_edge_configuration: protectedEdgeConfiguration,
    activation_receipt: activationReceipt,
    rollback_receipt: rollbackReceipt,
    approved_profile_cohort: approvedProfileCohort,
    approved_profile_cohort_reference: approvedProfileCohortReference,
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
