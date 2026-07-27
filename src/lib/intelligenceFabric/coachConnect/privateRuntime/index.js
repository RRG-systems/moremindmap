import {
  attachCanonicalBusinessEngine,
  attachExistingCoachConnectRuntime,
  attachExistingSubscriptionRuntime,
} from './attachments.js';
import { validateCompleteAttachmentSet } from './evidence.js';

export * from './activation.js';
export * from './attachments.js';
export * from './authority.js';
export * from './composition.js';
export * from './contracts.js';
export * from './evidence.js';
export * from './failureCodes.js';
export * from './sessionResolver.js';
export * from './subjectRegistryPort.js';

const discard = (code) => Object.freeze({
  ok: false,
  code,
  partial_handles_discarded: true,
  runtime_ready: false,
  attachment_set: null,
});

export function createCoachConnectPrivateRuntimeBridge({
  businessEnginePort,
  subscriptionRuntime,
  subscriptionDescriptor,
  coachConnectRuntime,
  resolveEntitlement,
  resolveCoachState,
  clock = () => new Date().toISOString(),
} = {}) {
  const configured = typeof businessEnginePort?.lookupCanonicalBusinessEngine === 'function'
    && typeof subscriptionRuntime?.inspect_contract === 'function'
    && typeof coachConnectRuntime?.inspect === 'function'
    && typeof resolveEntitlement === 'function'
    && typeof resolveCoachState === 'function';

  async function attach({
    request,
    edgeAttestation,
    authority,
    subjectReceipt,
    sessionReceipt,
    capability,
  }) {
    if (!configured) return discard('PRIVATE_RUNTIME_DISABLED');
    if (edgeAttestation?.named_identity_verified !== true
      || edgeAttestation?.mfa_verified !== true
      || edgeAttestation?.public_access !== false) {
      return discard('SESSION_ELEVATION_REQUIRED');
    }
    if (authority?.allowed !== true
      || typeof authority.authority_fingerprint !== 'string'
      || authority.deployment_grade_security_state !== true
      || authority.no_local_fallback !== true
      || !['DEPLOYMENT_SHAPED_OFFLINE', 'FUTURE_PRIVATE_LIVE']
        .includes(authority.shared_state_evidence_class)) {
      return discard(authority?.code || 'SESSION_ELEVATION_REQUIRED');
    }
    const businessEngine = await attachCanonicalBusinessEngine({
      port: businessEnginePort,
      request,
      authority,
      subjectReceipt,
      attachedAt: clock(),
    });
    if (!businessEngine.ok) return discard(businessEngine.code);
    const entitlement = await resolveEntitlement({ request, authority, capability });
    if (!entitlement?.allowed) return discard(entitlement?.code || 'PRIVATE_ENTITLEMENT_REQUIRED');
    const subscription = attachExistingSubscriptionRuntime({
      request,
      authority,
      businessEngineReceipt: businessEngine.receipt,
      entitlement: entitlement.entitlement,
      runtime: subscriptionRuntime,
      subscription: subscriptionDescriptor,
      attachedAt: clock(),
    });
    if (!subscription.ok) return discard(subscription.code);
    const coachState = await resolveCoachState({
      request,
      authority,
      businessEngineReceipt: businessEngine.receipt,
      subscriptionReceipt: subscription.receipt,
    });
    const coachConnect = attachExistingCoachConnectRuntime({
      request,
      authority,
      businessEngineReceipt: businessEngine.receipt,
      subscriptionAttachment: subscription,
      runtime: coachConnectRuntime,
      coachState,
      attachedAt: clock(),
    });
    if (!coachConnect.ok) return discard(coachConnect.code);
    const attachmentSet = validateCompleteAttachmentSet({
      environmentId: request.environment_id,
      subjectReceipt,
      sessionReceipt,
      capability,
      businessEngineReceipt: businessEngine.receipt,
      subscriptionReceipt: subscription.receipt,
      coachConnectReceipt: coachConnect.receipt,
      createdAt: clock(),
      expiresAt: capability.expires_at,
    });
    if (!attachmentSet.ok) return discard(attachmentSet.code);
    return Object.freeze({
      ok: true,
      runtime_ready: true,
      attachment_set: attachmentSet.receipt,
      business_engine_attachment: businessEngine.receipt,
      subscription_runtime_attachment: subscription.receipt,
      coach_connect_attachment: coachConnect.receipt,
      runtime_handles: Object.freeze({
        subscription,
        coach_connect: coachConnect,
      }),
      duplicate_runtime_created: false,
      public_access: false,
    });
  }

  return Object.freeze({
    attach,
    inspect() {
      return Object.freeze({
        configured,
        default_enabled: false,
        public_routes: Object.freeze([]),
        one_business_engine: true,
        duplicate_runtime_created: false,
        provider_connection: false,
        production_persistence: false,
        stripe: false,
      });
    },
  });
}
