import { createHash } from 'node:crypto';
import nia from './fixtures/nia.json' with { type: 'json' };
import sofia from './fixtures/sofia.json' with { type: 'json' };
import registry from './fixtures/registry.json' with { type: 'json' };

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pinned = { nia: 'MM-20260913-D702ACBF', sofia: 'MM-20260913-6184D6D9' };
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export function validateBundle(slug, bundle) {
  if (!pinned[slug] || bundle.person.slug !== slug || bundle.person.mm !== pinned[slug]
    || !bundle.person.synthetic || !bundle.bos.synthetic || !bundle.apa.synthetic) throw Error('REPORT_IDENTITY_MISMATCH');
  for (const artifact of [bundle.bos, bundle.apa]) {
    const { artifact_sha256, ...body } = artifact;
    if (body.mm !== pinned[slug] || digest(body) !== artifact_sha256) throw Error('REPORT_INTEGRITY_FAILURE');
  }
  return true;
}
export const bundles = freeze({ nia, sofia });
for (const [slug, bundle] of Object.entries(bundles)) validateBundle(slug, bundle);
export const athletes = freeze(registry);
export function binding(slug) {
  const b = bundles[slug];
  if (!b) throw Error('UNKNOWN_ATHLETE');
  return { slug, mm: b.person.mm, bos: b.bos.artifact_sha256, apa: b.apa.artifact_sha256 };
}
