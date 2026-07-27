import { deepFreeze } from '../../validation.js';
import {
  PRIVATE_RUNTIME_COACH_CONNECT_CAPABILITIES,
  PRIVATE_RUNTIME_SUBSCRIPTION_INTERACTIONS,
} from './attachments.js';
import {
  PRIVATE_RUNTIME_CONTRACT_VERSIONS,
  exactPrivateRuntimeScope,
  hashPrivateRuntimeScope,
} from './contracts.js';

const frozen = (value) => deepFreeze(structuredClone(value));
const COMMANDS = new Set(['START_SESSION', 'SUBMIT_TURN', 'DECIDE_EXTRACTION']);

export function createPrivateRuntimeSubscriptionEnvelope({
  request,
  subscriptionReceipt,
  idempotencyKey = null,
}) {
  if (!exactPrivateRuntimeScope(request?.exact_scope)
    || subscriptionReceipt?.receipt_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.subscriptionAttachment
    || subscriptionReceipt.subscriber_subject_ref !== request.subscriber_subject_ref
    || subscriptionReceipt.authenticated_session_ref !== request.authenticated_session_ref
    || subscriptionReceipt.exact_scope_hash !== hashPrivateRuntimeScope(request.exact_scope)) {
    return frozen({ ok: false, code: 'SUBSCRIPTION_RUNTIME_ATTACHMENT_MISMATCH' });
  }
  return frozen({
    ok: true,
    envelope: {
      scope: request.exact_scope,
      actor: {
        actor_id: request.subscriber_subject_ref,
        role: 'SUBSCRIBER',
      },
      session: {
        session_id: request.authenticated_session_ref,
      },
      request_id: request.correlation_id,
      correlation_id: request.correlation_id,
      causation_id: null,
      idempotency_key: idempotencyKey,
    },
  });
}

export async function invokeExistingSubscriptionRuntime({
  attachment,
  request,
  action,
  payload = {},
  idempotencyKey = null,
}) {
  if (!attachment?.ok
    || attachment.receipt?.receipt_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.subscriptionAttachment
    || !PRIVATE_RUNTIME_SUBSCRIPTION_INTERACTIONS.includes(action)) {
    return frozen({ ok: false, code: 'ACTION_NOT_ALLOWLISTED' });
  }
  if (COMMANDS.has(action) && (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0)) {
    return frozen({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED' });
  }
  const built = createPrivateRuntimeSubscriptionEnvelope({
    request,
    subscriptionReceipt: attachment.receipt,
    idempotencyKey,
  });
  if (!built.ok) return built;
  const method = attachment.runtime_handle?.[action.toLowerCase()];
  if (typeof method !== 'function') return frozen({ ok: false, code: 'SUBSCRIPTION_RUNTIME_UNAVAILABLE' });
  const result = await method(built.envelope, payload);
  return result?.ok
    ? frozen({
      ok: true,
      result,
      interaction: {
        action,
        used_existing_runtime: true,
        exact_scope_hash: attachment.receipt.exact_scope_hash,
        canonical_mutation_performed: false,
        stripe_call_count: 0,
        production_persistence_call_count: 0,
        live_provider_call_count: 0,
      },
    })
    : frozen({ ok: false, code: result?.code || 'SUBSCRIPTION_RUNTIME_UNAVAILABLE', result });
}

export async function invokeExistingCoachConnect({
  attachment,
  action,
  idempotencyKey = null,
}) {
  if (!attachment?.ok
    || attachment.receipt?.receipt_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.coachConnectAttachment
    || !PRIVATE_RUNTIME_COACH_CONNECT_CAPABILITIES.includes(action)) {
    return frozen({ ok: false, code: 'ACTION_NOT_ALLOWLISTED' });
  }
  if (action === 'SUBSCRIBER_PROJECTION') {
    const projection = attachment.runtime_handle?.subscriberProjection?.(
      attachment.coach_state_handle?.projection_input || {},
    );
    if (!projection || projection.visible !== true) {
      return frozen({ ok: false, code: 'COACH_CONNECT_STATE_MISSING' });
    }
    return frozen({
      ok: true,
      projection,
      interaction: {
        action,
        used_existing_runtime: true,
        exact_scope_hash: attachment.receipt.exact_scope_hash,
        business_engine_attachment_ref: attachment.receipt.business_engine_attachment_ref,
        private_coach_content_exposed: false,
        canonical_mutation_performed: false,
        stripe_call_count: 0,
        live_provider_call_count: 0,
        transcript_persistence_call_count: 0,
      },
    });
  }
  const state = attachment.coach_state_handle;
  if (state.relationship_active !== true
    || state.consent_granted !== true
    || state.coach_authenticated !== true
    || state.coach_entitlement_active !== true
    || !state.structured_session_input
    || typeof idempotencyKey !== 'string'
    || idempotencyKey.length === 0) {
    return frozen({ ok: false, code: 'COACH_CONNECT_STATE_MISSING' });
  }
  const created = attachment.runtime_handle?.createSession?.({
    ...state.structured_session_input,
    idempotency_key: idempotencyKey,
  });
  if (!created?.ok || created.session?.session_mode !== 'STRUCTURED_NON_VOICE') {
    return frozen({ ok: false, code: created?.code || 'COACH_CONNECT_STATE_MISSING' });
  }
  return frozen({
    ok: true,
    result: {
      status: created.status,
      session_ref: created.session.session_id,
      session_mode: created.session.session_mode,
      canonical_mutation: false,
      raw_transcript: null,
    },
    interaction: {
      action,
      used_existing_runtime: true,
      exact_scope_hash: attachment.receipt.exact_scope_hash,
      private_coach_content_exposed: false,
      canonical_mutation_performed: false,
      stripe_call_count: 0,
      live_provider_call_count: 0,
      transcript_persistence_call_count: 0,
    },
  });
}
