const SOURCE_ROLES = new Set(['Athlete', 'Athlete confirmation', 'Athlete-confirmed coaching update']);
export const short = (value, max = 120) => String(value || '').trim().slice(0, max);

export function eligibleAthleteMessages(state) {
  return (state?.messages || []).filter((message) => message.role === 'user'
    && message.speaker === 'athlete' && !message.capture
    && typeof message.text === 'string' && message.text.trim()).reverse();
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
