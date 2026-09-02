import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { projectLivingPublicationToBusinessTwin } from './viewModelProjection.js';

export function createLivingConversationController({ runtime, store, scope, base_view_model, evidence_catalog = [] }) {
  if (!runtime || !store || !scope || !base_view_model) throw new TypeError('AFW06_CONTROLLER_DEPENDENCIES_REQUIRED');
  const normalizedLens = (value) => ({ WHERE: 'WHERE_YOU_ARE', FUTURES: 'FIVE_FUTURES', MOVE: 'ONE_MOVE' }[value] || value);
  return Object.freeze({
    inspect() {
      return deepFreeze({
        blank_natural_conversation: true,
        deterministic_conversation_tree: false,
        visible_framework_selector: false,
        direct_derived_truth_write: false,
        customer_confirmation_required: true,
        business_twin_remains_navigable: true,
        layer_3_present: false,
      });
    },
    async send({ message, active_lens = 'OVERVIEW', purpose = null, topics = [], visible_customer_context = null, on_coaching_ready = null }) {
      if (typeof message !== 'string' || !message.trim()) return deepFreeze({ ok: false, code: 'AFW06_CUSTOMER_MESSAGE_REQUIRED' });
      return runtime.coach({ customer_turn: message.trim(), active_lens: normalizedLens(active_lens), ...(purpose ? { purpose } : {}), topics, visible_customer_context, on_coaching_ready });
    },
    async decide({ proposal_id, decision, edited_items = [], note = null, idempotency_key }) {
      return runtime.decide({ proposal_id, decision, edited_items, note, evidence_catalog, idempotency_key });
    },
    async endSession({ active_lens = 'OVERVIEW', visible_customer_context = null, mode = 'REQUEST_ALIGNMENT', alignment_message = null, prior_session_learning = null } = {}) {
      return runtime.closeSession({ active_lens: normalizedLens(active_lens), visible_customer_context, mode, alignment_message, prior_session_learning });
    },
    current() {
      const current = store.readCurrent({ scope });
      if (!current.ok) return current;
      return deepFreeze({
        ok: true,
        publication: current.publication,
        view_model: projectLivingPublicationToBusinessTwin({
          base_view_model,
          publication: current.publication,
          personal_rsl_records: store.readPersonalRsl({ scope }).records,
        }),
        state_packet: runtime.currentStatePacket(),
      });
    },
    pendingProposal() { return runtime.pendingProposal?.() || null; },
    clearEphemeralConversation() { return runtime.clearEphemeralConversation(); },
    wholeUnderstandingPacket() { return runtime.wholeUnderstandingPacket?.() || null; },
    longitudinalScorecard(options) { return runtime.longitudinalScorecard?.(options) || null; },
    futureLearningCandidates(options) { return runtime.futureLearningCandidates?.(options) || null; },
  });
}
