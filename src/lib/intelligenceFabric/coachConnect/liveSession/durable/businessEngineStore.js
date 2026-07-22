import { deepFreeze } from '../../../validation.js';

export class DurableBusinessEngineWorkflowStore {
  constructor(adapter) { this.adapter = adapter; }
  writeProposal(scope, proposal) { return this.adapter.write({ kind: 'proposal', object_id: proposal.proposal_id, scope, value: proposal, correlation_id: scope.session_id }); }
  writeConfirmation(scope, confirmation) { return this.adapter.write({ kind: 'confirmation', object_id: confirmation.confirmation_id, scope, value: confirmation, correlation_id: scope.session_id, causation_id: confirmation.proposal_id }); }
  writePromotion(scope, promotion) { return this.adapter.write({ kind: 'promotion', object_id: promotion.promotion_record_id, scope, value: promotion, correlation_id: scope.session_id, causation_id: promotion.authority_basis }); }
  async promote({ scope, proposal, confirmation, business_engine, canonicalAppend, event }) {
    if (confirmation?.response_state !== 'ACCEPTED' || confirmation?.response_actor_id !== scope.subscriber_id || confirmation?.proposal_id !== proposal?.proposal_id) return deepFreeze({ ok: false, code: 'SUBSCRIBER_CONFIRMATION_REQUIRED', canonical_append_count: 0 });
    if (proposal.base_business_engine_version !== business_engine.version) return deepFreeze({ ok: false, code: 'STALE_PROPOSAL_REEVALUATION_REQUIRED', canonical_append_count: 0 });
    const object_id = `canonical:${proposal.proposal_id}`;
    const prior = await this.adapter.readObject({ kind: 'promotion', object_id, scope });
    if (prior.ok && prior.status === 'READ') return deepFreeze({ ok: true, status: 'IDEMPOTENT_REPLAY', canonical_append_count: 0, result: prior.record.value.canonical_result });
    const result = await canonicalAppend({ ...event, idempotency_key: event?.idempotency_key || object_id });
    if (!result?.ok) return deepFreeze({ ok: false, code: result?.code || 'CANONICAL_APPEND_FAILED', canonical_append_count: 0 });
    const receipt = await this.adapter.write({ kind: 'promotion', object_id, scope, value: { proposal_id: proposal.proposal_id, confirmation_id: confirmation.confirmation_id, canonical_result: result, canonical_append_idempotency_key: event?.idempotency_key || object_id }, expected_version: 0, correlation_id: scope.session_id });
    if (!receipt.ok) return deepFreeze({ ok: false, code: 'PROMOTION_RECEIPT_PERSISTENCE_FAILED', canonical_append_count: 1, result });
    return deepFreeze({ ok: true, status: 'PROMOTED', canonical_append_count: 1, result, receipt });
  }
}
