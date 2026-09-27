import { sha256Text } from '../../lib/canonicalSha256.js';
import { continuityView } from './currentApaUi.js';
export { presentClosingAthleteReview } from '../../athleteConsultingV2/visualUi.js';
const EVENTS = new Set(['SESSION_OPENING', 'COACHING_MOMENT', 'SESSION_FINALIZATION']);

// Presentation remains account/MM/report/session bound. No synthetic slug or
// model-selected interaction confers read, approval or publication authority.
export function selectMainAthleteVisuals(bundle, state) {
  const c = continuityView(bundle,state), actorId = bundle?.binding?.actorId;
  if (state?.flagship_enabled !== true || !c.verified || c.stale || !actorId
    || state.mm !== bundle.person.mm || !state.sessionId) return [];
  const relationshipHash = sha256Text(JSON.stringify({ scopeId: 'athlete-academy-private', ...bundle.binding }));
  const ids = new Set(state.messages.filter(m => m.role === 'assistant').map(m => m.id));
  return (state.visuals || []).filter(v => {
    const p = v?.plan, b = p?.stateBinding;
    return EVENTS.has(v.event) && p?.planVersion === 'athlete-academy-visual-v1'
      && v.session_id === state.sessionId && p.event === v.event
      && (v.event !== 'SESSION_FINALIZATION' || state.closing?.visual_id === v.id && state.closing_reveal_ready === true)
      && ids.has(v.after_message_id) && p.renderDecision?.render === true
      && Array.isArray(p.blocks) && p.blocks.length > 0 && p.blocks.length <= 2
      && Array.isArray(p.interactions) && p.interactions.length === 0
      && b?.actorId === actorId && b.mm === bundle.person.mm && b.sessionId === state.sessionId
      && b.relationshipScopeHash === relationshipHash && b.bosHash === bundle.binding.bos
      && b.baselineApaHash === bundle.binding.apa && b.currentApaHash === c.current.artifact_sha256
      && b.currentApaVersion === String(c.currentVersion)
      && b.triggerRequestId === v.trigger_request_id && b.triggerHash === v.source_hash
      && !(c.needsReview && p.blocks.some(block =>
        block.objects?.some(o => o.sourceIds?.includes('athlete-source-apa'))
        || block.evidence?.some(e => e.id === 'athlete-source-apa')));
  });
}

export function selectMainClosingVisual(visuals, closing) {
  return visuals.find(v => v.event === 'SESSION_FINALIZATION' && v.id === closing?.visual_id) || null;
}
