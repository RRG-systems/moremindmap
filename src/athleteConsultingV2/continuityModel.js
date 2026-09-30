const SOURCE_ROLES = new Set(['Athlete', 'Athlete confirmation', 'Athlete-confirmed coaching update']);
export const short = (value, max = 120) => String(value || '').trim().slice(0, max);

export function eligibleAthleteMessages(state) {
  return (state?.messages || []).filter((message) => message.role === 'user'
    && message.speaker === 'athlete' && !message.capture
    && typeof message.text === 'string' && message.text.trim()).reverse();
}

// These checks select UI feedback only. Authentication, source validation,
// composition and publication remain the server's responsibility.
const latestApaEvent = (state) => (Array.isArray(state?.events) ? state.events : [])
  .findLast((event) => event.type?.startsWith('current_apa_') || event.type?.startsWith('apa_update_'));
const resolved = (state) => Boolean(state && !state.lastError && !state.pending
  && !['working', 'unknown'].includes(state.status));

export function apaNoChangeEvent(bundle, state) {
  const event = latestApaEvent(state);
  if (!resolved(state) || state.mm !== bundle?.person?.mm || event?.type !== 'current_apa_no_change'
    || event.version !== (state.currentApa?.version || 0)
    || event.content_hash !== (state.currentApa?.artifact?.artifact_sha256 || bundle?.apa?.artifact_sha256)
    || !eligibleAthleteMessages(state).some((message) => message.id === event.source_message_id)) return null;
  return event;
}

export const APA_NO_CHANGE_TITLE = 'No new APA proposal was prepared.';
export const APA_NO_CHANGE_DETAIL = 'MORE returned no material change. Your requested change has not been published; your saved APA and agreed plan are unchanged. No explanation was returned with this result.';

export async function prepareApaReview({ state, sourceMessageId, reason, kind, supersedes = [],
  onAction, onPrepared }) {
  const expectedApaVersion = state?.currentApa?.version || 0;
  const command = { action: 'update_apa', sourceMessageId, reason: reason.trim(), kind,
    supersedes: [...supersedes], expectedApaVersion };
  const result = await onAction(command);
  const draft = result?.apaDraft, event = latestApaEvent(result);
  const priorRequestIds = new Set((state?.events || []).map((item) => item.request_id).filter(Boolean));
  if (resolved(result) && result.mm === state.mm
    && draft?.id && draft.id !== state.apaDraft?.id && draft.hash
    && draft.expectedVersion === expectedApaVersion
    && draft.confirmedChange?.source_message_id === sourceMessageId
    && draft.confirmedChange?.reason === command.reason
    && draft.previewRecord?.version === expectedApaVersion + 1
    && (result.currentApa?.version || 0) === expectedApaVersion
    && event?.type === 'current_apa_draft_prepared' && event.source_message_id === sourceMessageId
    && typeof event.request_id === 'string' && event.request_id && !priorRequestIds.has(event.request_id)
    && event.version === draft.previewRecord.version
    && event.content_hash === draft.previewRecord.artifact?.artifact_sha256) onPrepared();
  return result;
}

export function selectableApaSources(bundle, state) {
  const artifact = state?.currentApa?.artifact || bundle?.apa;
  const inactive = new Set((state?.currentApa?.receipts || []).flatMap((receipt) => receipt.supersedes || []));
  return (artifact?.sources || []).filter((source) => SOURCE_ROLES.has(source.source)
    && typeof source.id === 'string' && !inactive.has(source.id));
}

export function summarizeApaChanges(draft) {
  const paths = draft?.previewRecord?.receipts?.at(-1)?.material_paths || [];
  const sections = new Set();
  for (const path of paths) {
    if (path.startsWith('confirmation.')) sections.add('Your priorities');
    else if (path.startsWith('report.domains.')) sections.add('Your four areas');
    else if (path.startsWith('report.futures.')) sections.add('Five Futures');
    else if (path.startsWith('report.candidates.') || path === 'move.selection') sections.add('One Move options');
    else sections.add('Your overview');
  }
  return [...sections];
}
