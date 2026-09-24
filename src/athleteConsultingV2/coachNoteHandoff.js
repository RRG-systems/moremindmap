const SYNTHETIC_ATHLETES = new Set(['nia', 'sofia']);

// IDs come from the selected athlete's authenticated state projection. The
// original reviewed message is the only text source, not a copied projection.
export function selectCoachNoteHandoff(bundle, state) {
  const person = bundle?.person;
  if (person?.synthetic !== true || !SYNTHETIC_ATHLETES.has(person.slug)
    || state?.mm !== person.mm) return { pending: [], lastOpening: [] };
  const matching = (ids) => {
    const selected = new Set(Array.isArray(ids) ? ids : []);
    return (state.messages || []).filter((message) => selected.has(message.id)
      && message.capture?.contract === 'athlete_capture_demo_v1'
      && message.capture?.bridge === 'darren_demo_same_scope_v1'
      && message.capture?.channel === 'coach_connect_box04_v1'
      && message.capture?.reviewed === true
      && message.capture?.kind === 'text'
      && Array.isArray(message.capture?.attachments)
      && message.capture.attachments.length === 0
      && message.capture?.subject === person.slug
      && message.capture?.role === 'coach'
      && message.capture?.source === 'Coach Alex (synthetic)');
  };
  return {
    pending: matching(state.coachNoteHandoff?.pending_ids),
    lastOpening: matching(state.coachNoteHandoff?.last_opening?.note_ids),
    deliveredAt: state.coachNoteHandoff?.last_opening?.at || null,
  };
}
