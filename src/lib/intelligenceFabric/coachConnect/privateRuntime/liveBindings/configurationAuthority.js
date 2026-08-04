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
import {
  LIVING_CONVERSATION_DERIVED_PROVIDER_REFERENCE,
  LIVING_CONVERSATION_PROVIDER_BINDING_VERSION,
  LIVING_CONVERSATION_PROVIDER_CREDENTIAL_REFERENCE,
  LIVING_CONVERSATION_PROVIDER_MODEL_VARIABLE,
  LIVING_CONVERSATION_PROVIDER_PRIVACY_VARIABLE,
  LIVING_CONVERSATION_PROVIDER_REFERENCE_VARIABLE,
  livingConversationProviderBindingDigest,
  validateLivingConversationProviderBindingV1,
} from '../livingConversation/providerBinding.js';

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
export const PRIVATE_RUNTIME_CONVERSATION_PROVIDER_CREDENTIAL_ALIAS =
  LIVING_CONVERSATION_PROVIDER_CREDENTIAL_REFERENCE;
const PRIVATE_RUNTIME_CONVERSATION_PROVIDER_CREDENTIAL_ALIAS_SOURCE =
  'OPENAI_API_KEY';

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

function earliestFutureTimestamp(nowMs, values) {
  const timestamps = values
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value) && value > nowMs);
  return timestamps.length === values.length
    ? new Date(Math.min(...timestamps)).toISOString()
    : null;
}

function deriveLivingConversationProviderBinding({
  env,
  authorityPacket,
  qualificationCertificate,
  liveEnvironmentAttestation,
  productBindingAttestation,
  approvedProfileCohort,
  immutableDeploymentIdentity,
  protectedEdgeConfiguration,
  liveAuthority,
  activationReceipt,
  rollbackReceipt,
  authorityState,
  nowMs,
}) {
  const referenceName = env[LIVING_CONVERSATION_PROVIDER_REFERENCE_VARIABLE];
  if (referenceName == null) {
    return frozen({
      ok: false,
      configured: false,
      code: 'LIVING_CONVERSATION_PROVIDER_UNCONFIGURED',
    });
  }
  if (referenceName !== LIVING_CONVERSATION_DERIVED_PROVIDER_REFERENCE) {
    return frozen({
      ok: false,
      configured: true,
      code: 'LIVING_CONVERSATION_PROVIDER_DERIVATION_REFERENCE_DENIED',
    });
  }
  const model = env[LIVING_CONVERSATION_PROVIDER_MODEL_VARIABLE];
  const retentionMode = env[LIVING_CONVERSATION_PROVIDER_PRIVACY_VARIABLE];
  const environmentId = authorityPacket.environment_id;
  const packetDigest = authorityPacket.packet_sha256;
  const productDigest = productBindingAttestation.binding_sha256;
  const cohortDigest = approvedProfileCohort?.cohort_sha256;
  const activationValid = activationReceipt?.approved === true
    && activationReceipt.controlled_internal_beta === true
    && activationReceipt.private_live_only === true
    && activationReceipt.public_access === false
    && activationReceipt.source_default_off === true
    && activationReceipt.production_customer_rollout === false
    && activationReceipt.environment_id === environmentId
    && activationReceipt.configuration_authority_packet_digest === packetDigest
    && activationReceipt.approved_profile_cohort_digest === cohortDigest
    && activationReceipt.product_binding_attestation_digest === productDigest
    && activationReceipt.rollback_receipt_digest === rollbackReceipt?.receipt_sha256
    && activationReceipt.deployment_commit_sha === env.VERCEL_GIT_COMMIT_SHA;
  const authorityValid = authorityState === 'READY_FOR_PRIVATE_TEST'
    && authorityPacket.live_enabled === true
    && authorityPacket.emergency_disabled === false
    && protectedEdgeConfiguration.enabled === true
    && protectedEdgeConfiguration.emergency_disabled === false
    && sha256(packetDigest)
    && sha256(productDigest)
    && sha256(cohortDigest)
    && sha256(immutableDeploymentIdentity)
    && immutableDeploymentIdentity === protectedEdgeConfiguration.deployment_id
    && productBindingAttestation.environment_id === environmentId
    && approvedProfileCohort?.environment_id === environmentId
    && approvedProfileCohort?.operating_mode === 'CONTROLLED_INTERNAL_BETA'
    && approvedProfileCohort?.source_default_off === true
    && approvedProfileCohort?.public_access === false
    && approvedProfileCohort?.revoked === false
    && liveAuthority?.environment_id === environmentId
    && liveAuthority?.product_binding_attestation_digest === productDigest
    && liveAuthority?.source_default_off === true
    && liveAuthority?.public_access === false
    && liveAuthority?.persistent_namespace === true
    && liveAuthority?.disposable_namespace === false
    && rollbackReceipt?.environment_id === environmentId
    && rollbackReceipt?.configuration_authority_packet_digest === packetDigest
    && rollbackReceipt?.approved_profile_cohort_digest === cohortDigest
    && rollbackReceipt?.public_access === false
    && activationValid;
  if (!authorityValid) {
    return frozen({
      ok: false,
      configured: true,
      code: 'LIVING_CONVERSATION_PROVIDER_UPSTREAM_AUTHORITY_DENIED',
    });
  }
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._-]{2,128}$/.test(model)) {
    return frozen({
      ok: false,
      configured: true,
      code: 'LIVING_CONVERSATION_PROVIDER_MODEL_DENIED',
    });
  }
  if (retentionMode !== 'STANDARD_ABUSE_MONITORING_STORE_FALSE') {
    return frozen({
      ok: false,
      configured: true,
      code: 'LIVING_CONVERSATION_PROVIDER_RETENTION_DENIED',
    });
  }
  const reviewDueAt = earliestFutureTimestamp(nowMs, [
    authorityPacket.review_due_at,
    qualificationCertificate.review_due_at,
    liveEnvironmentAttestation.review_due_at,
    productBindingAttestation.review_due_at,
    approvedProfileCohort.expires_at,
    activationReceipt.expires_at,
    rollbackReceipt.expires_at,
  ]);
  if (reviewDueAt == null) {
    return frozen({
      ok: false,
      configured: true,
      code: 'LIVING_CONVERSATION_PROVIDER_UPSTREAM_AUTHORITY_EXPIRED',
    });
  }
  const binding = {
    binding_version: LIVING_CONVERSATION_PROVIDER_BINDING_VERSION,
    environment_id: environmentId,
    configuration_authority_packet_sha256: packetDigest,
    product_binding_attestation_sha256: productDigest,
    enabled: true,
    source_default_off: true,
    private_beta_only: true,
    public_access: false,
    provider: 'OPENAI',
    credential_ref: LIVING_CONVERSATION_PROVIDER_CREDENTIAL_REFERENCE,
    model,
    scope_mode: 'APPROVED_PROFILE_COHORT',
    exact_scope_hash: null,
    approved_profile_cohort_sha256: cohortDigest,
    provider_data_retention_mode: retentionMode,
    allowed_purposes: ['CONVERSATION_PLAN_PROPOSAL'],
    timeout_ms: 15_000,
    max_output_tokens: 1_800,
    max_input_chars: 56_000,
    issued_at: new Date(nowMs).toISOString(),
    review_due_at: reviewDueAt,
  };
  binding.binding_sha256 = livingConversationProviderBindingDigest(binding);
  const validation = validateLivingConversationProviderBindingV1(binding, {
    environmentId,
    configurationAuthorityPacketSha256: packetDigest,
    productBindingAttestation,
    approvedProfileCohort,
    nowMs,
  });
  return validation.valid
    ? frozen({ ok: true, configured: true, derived: true, binding: validation.value })
    : frozen({
        ok: false,
        configured: true,
        code: validation.errors[0]?.code
          || 'LIVING_CONVERSATION_PROVIDER_BINDING_INVALID',
      });
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
    if (reference === PRIVATE_RUNTIME_CONVERSATION_PROVIDER_CREDENTIAL_ALIAS) {
      const aliasedValue =
        env[PRIVATE_RUNTIME_CONVERSATION_PROVIDER_CREDENTIAL_ALIAS_SOURCE];
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
          && env.VERCEL_GIT_COMMIT_SHA.length > 0
          ? env.VERCEL_GIT_COMMIT_SHA
          : null,
        immutableDeploymentIdentity,
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
    derive_living_conversation_provider_binding: () =>
      deriveLivingConversationProviderBinding({
        env,
        authorityPacket,
        qualificationCertificate,
        liveEnvironmentAttestation,
        productBindingAttestation,
        approvedProfileCohort,
        immutableDeploymentIdentity,
        protectedEdgeConfiguration,
        liveAuthority: liveAuthority.value,
        activationReceipt,
        rollbackReceipt,
        authorityState: resolvedAuthority.state,
        nowMs,
      }),
  });
}
