const EVENTS = new Set(['SESSION_OPENING', 'COACHING_MOMENT', 'SESSION_FINALIZATION']);

// The server has already authenticated and materialized these receipts. This
// UI projection still refuses a visual from another athlete, baseline, or
// session, and never converts a visual into an action or a current plan.
export function selectAthleteVisuals(bundle, state) {
  const person = bundle?.person;
  if (person?.synthetic !== true || !['nia', 'sofia'].includes(person.slug)
    || !person.mm || state?.mm !== person.mm || !state.sessionId
    || bundle.bos?.artifact_sha256 === undefined || bundle.apa?.artifact_sha256 === undefined) return [];
  const currentApaHash = state.currentApa?.artifact?.artifact_sha256 || bundle.apa.artifact_sha256;
  const assistantIds = new Set((state.messages || []).filter((message) => message.role === 'assistant')
    .map((message) => message.id));
  return (state.visuals || []).filter((visual) => {
    const plan = visual?.plan, binding = plan?.stateBinding;
    return EVENTS.has(visual.event) && visual.session_id === state.sessionId
      && (visual.event !== 'SESSION_FINALIZATION' || state.closing?.visual_id === visual.id)
      && visual.after_message_id && assistantIds.has(visual.after_message_id)
      && plan?.event === visual.event && plan?.renderDecision?.render === true
      && Array.isArray(plan.blocks) && plan.blocks.length > 0
      && Array.isArray(plan.interactions) && plan.interactions.length === 0
      && binding?.sessionId === visual.session_id && binding.mm === person.mm
      && binding.bosHash === bundle.bos.artifact_sha256
      && binding.baselineApaHash === bundle.apa.artifact_sha256
      && binding.currentApaHash === currentApaHash
      && !(state.apaNeedsReview === true && plan.blocks.some((block) =>
        (block.objects || []).some((item) => item.sourceIds?.includes('athlete-source-apa'))
        || (block.evidence || []).some((item) => item.id === 'athlete-source-apa')))
      && binding.triggerHash === visual.source_hash;
  });
}

export function selectClosingAthleteVisual(visuals, closing) {
  return closing?.visual_id
    ? visuals.find((visual) => visual.event === 'SESSION_FINALIZATION' && visual.id === closing.visual_id) || null
    : null;
}

// A required closing reveal must not be hidden by the ordinary chat-bottom
// scroll. Keep the owning review focused, and show the map-change heading
// directly even when a long recap appears before it.
export function presentClosingAthleteReview(review) {
  if (!review) return false;
  review.focus({ preventScroll: true });
  const reveal = review.querySelector('.athlete-visual-map-reveal') || review;
  reveal.scrollIntoView({ block: 'start', inline: 'nearest' });
  return true;
}
