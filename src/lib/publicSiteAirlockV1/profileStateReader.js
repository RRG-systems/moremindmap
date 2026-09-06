import { normalizeProfileId } from './contracts.js';

function parse(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function createProfileStateReader(store) {
  return async function readProfileState(value) {
    const profileId = normalizeProfileId(value);
    if (!profileId) return { bos: 'missing', ba: 'missing' };
    const [, date, suffix] = profileId.match(/^mm-(\d{8})-([a-z0-9]{8})$/u) || [];
    const lower = await store.get(`vault:profile:${profileId}`);
    const legacy = lower || await store.get(`vault:profile:MM-${date}-${suffix}`);
    if (!legacy) return { bos: 'missing', ba: 'missing' };
    const dossier = parse(legacy);
    const bos = dossier ? 'ready' : 'pending';
    const assessmentId = await store.get(`business_assessment_by_profile:${profileId}`);
    if (!assessmentId) return { bos, ba: 'missing' };
    const assessment = parse(await store.get(`business_assessment:${assessmentId}`));
    const output = assessment?.output || {};
    const ba = output.business_intelligence_draft
      && output.executive_diagnostic_briefing_v1
      && output.five_futures_v1
      && output.one_move_v1
      ? 'ready'
      : 'pending';
    return { bos, ba };
  };
}
