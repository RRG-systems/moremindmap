import { deepFreeze } from '../../../validation.js';
import {
  attachCanonicalBusinessEngine,
  attachExistingCoachConnectRuntime,
  attachExistingSubscriptionRuntime,
} from '../attachments.js';
import { validateCompleteAttachmentSet } from '../evidence.js';

export const PRIVATE_RUNTIME_LIVE_ATTACHMENT_COORDINATOR_VERSION =
  'private-runtime-live-attachment-coordinator-v1';

const frozen = (value) => deepFreeze(structuredClone(value));
const discard = (code) => frozen({
  ok: false,
  allowed: false,
  code,
  status: 403,
  partial_handles_discarded: true,
  runtime_ready: false,
});

const bridgeDiscard = (code) => Object.freeze({
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
    if (!configured) return bridgeDiscard('PRIVATE_RUNTIME_DISABLED');
    if (edgeAttestation?.named_identity_verified !== true
      || edgeAttestation?.mfa_verified !== true
      || edgeAttestation?.public_access !== false) {
      return bridgeDiscard('SESSION_ELEVATION_REQUIRED');
    }
    if (authority?.allowed !== true
      || typeof authority.authority_fingerprint !== 'string'
      || authority.deployment_grade_security_state !== true
      || authority.no_local_fallback !== true
      || !['DEPLOYMENT_SHAPED_OFFLINE', 'FUTURE_PRIVATE_LIVE']
        .includes(authority.shared_state_evidence_class)) {
      return bridgeDiscard(authority?.code || 'SESSION_ELEVATION_REQUIRED');
    }
    const businessEngine = await attachCanonicalBusinessEngine({
      port: businessEnginePort,
      request,
      authority,
      subjectReceipt,
      attachedAt: clock(),
    });
    if (!businessEngine.ok) return bridgeDiscard(businessEngine.code);
    const entitlement = await resolveEntitlement({ request, authority, capability });
    if (!entitlement?.allowed) {
      return bridgeDiscard(entitlement?.code || 'PRIVATE_ENTITLEMENT_REQUIRED');
    }
    const subscription = attachExistingSubscriptionRuntime({
      request,
      authority,
      businessEngineReceipt: businessEngine.receipt,
      entitlement: entitlement.entitlement,
      runtime: subscriptionRuntime,
      subscription: subscriptionDescriptor,
      attachedAt: clock(),
    });
    if (!subscription.ok) return bridgeDiscard(subscription.code);
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
    if (!coachConnect.ok) return bridgeDiscard(coachConnect.code);
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
    if (!attachmentSet.ok) return bridgeDiscard(attachmentSet.code);
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

export function createPrivateRuntimeLiveAttachmentCoordinatorV1({
  businessEngineAdapter,
  subscriptionRuntimeAdapter,
  coachConnectAdapter,
  clock = () => new Date().toISOString(),
} = {}) {
  const configured =
    typeof businessEngineAdapter?.lookupCanonicalBusinessEngine === 'function'
    && typeof subscriptionRuntimeAdapter?.resolveExistingSubscriptionRuntime === 'function'
    && typeof coachConnectAdapter?.resolveExistingCoachConnectRuntime === 'function';

  return Object.freeze({
    async attach(input) {
      if (!configured
        || input?.authority?.allowed !== true
        || input?.edgeAttestation?.named_identity_verified !== true
        || input?.edgeAttestation?.mfa_verified !== true
        || input?.edgeAttestation?.public_access !== false) {
        return discard('SESSION_ELEVATION_REQUIRED');
      }
      const exactScope = input.request?.exact_scope;
      const [subscription, coach] = await Promise.all([
        subscriptionRuntimeAdapter.resolveExistingSubscriptionRuntime({
          exact_scope: exactScope,
          subject_ref: input.request?.subscriber_subject_ref,
        }),
        coachConnectAdapter.resolveExistingCoachConnectRuntime({
          exact_scope: exactScope,
          subject_ref: input.request?.subscriber_subject_ref,
        }),
      ]);
      if (!subscription?.ok) return discard(subscription?.code || 'SUBSCRIPTION_RUNTIME_UNAVAILABLE');
      if (!coach?.ok) return discard(coach?.code || 'COACH_CONNECT_STATE_MISSING');

      const bridge = createCoachConnectPrivateRuntimeBridge({
        businessEnginePort: businessEngineAdapter,
        subscriptionRuntime: subscription.runtime,
        subscriptionDescriptor: subscription.descriptor,
        coachConnectRuntime: coach.runtime,
        resolveEntitlement: async () => ({
          allowed: input.entitlement?.status === 'active'
            && input.entitlement?.temporary === true
            && input.entitlement?.paid_entitlement === false,
          entitlement: input.entitlement,
          code: 'PRIVATE_ENTITLEMENT_REQUIRED',
        }),
        resolveCoachState: async () => coach.state,
        clock,
      });
      const attached = await bridge.attach(input);
      if (!attached?.ok) return discard(attached?.code || 'ATTACHMENT_PARTIAL_FAILURE');
      return Object.freeze({
        ...attached,
        ok: true,
        allowed: true,
        coordinator_version: PRIVATE_RUNTIME_LIVE_ATTACHMENT_COORDINATOR_VERSION,
        product_state_owned: false,
        duplicate_runtime_created: false,
        partial_handles_discarded: false,
      });
    },

    inspect() {
      return frozen({
        coordinator_version: PRIVATE_RUNTIME_LIVE_ATTACHMENT_COORDINATOR_VERSION,
        configured,
        one_business_engine: true,
        one_subscription_runtime: true,
        one_coach_connect_runtime: true,
        creates_product_state: false,
        source_default_off: true,
      });
    },
  });
}
