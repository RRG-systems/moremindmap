// Currency is derived from the saved owner-reviewed lineage, never from a note
// or a new model interpretation. Original assessment artifacts stay untouched.
export function pendingApaCurrency(bundle, state, artifact) {
  const published = new Set((artifact?.sources || []).map(source => source.id));
  const messages = new Map((state.messages || []).map(message => [message.id, message]));
  const pending = (state.apaConfirmedChanges || []).filter(change => {
    const message = messages.get(change.source_message_id);
    return change.actorId === bundle.binding.actorId && change.mm === bundle.person.mm
      && change.confirmed === true && change.confirmed_by === 'athlete'
      && message?.actorId === bundle.binding.actorId && message.role === 'user'
      && (!Object.hasOwn(message, 'mm') || message.mm === bundle.person.mm)
      && message.speaker === 'athlete' && !message.capture
      && typeof change.source_id === 'string' && !published.has(change.source_id);
  });
  return { needsReview: pending.length > 0 || (state.apaReviewRequirements || []).length > 0,
    pendingConfirmationIds: pending.map(change => change.id) };
}

export function applicableApaReviewRequirements(state, change) {
  const requirements = state.apaReviewRequirements || [];
  if (!requirements.length) return [];
  if (change.kind !== 'correction' || !change.supersedes?.length)
    throw new Error('CURRENT_APA_REVIEW_SOURCE_REQUIRED');
  const sourceIndex = state.messages.findIndex(message => message.id === change.source_message_id);
  const covered = requirements.filter(item => item.event_type === 'CORRECTION'
    ? item.source_message_id === change.source_message_id
    : item.event_type === 'RETRACTION' && sourceIndex > item.minimum_message_index);
  if (!covered.length) throw new Error('CURRENT_APA_REVIEW_SOURCE_REQUIRED');
  return covered.map(item => item.event_id);
}

// Called only after publication of an already validated source-bound proposal.
export function completeApaReviewRequirements(state, covered) {
  const ids = new Set(covered || []);
  state.apaReviewRequirements = (state.apaReviewRequirements || []).filter(item => !ids.has(item.event_id));
}
