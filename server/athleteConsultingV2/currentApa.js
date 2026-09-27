import { validateBundle } from './bundles.js';
import { createCurrentApaCore } from '../athleteApa/currentApaCore.js';

export { currentApaHash, MAX_CURRENT_APA_REVISIONS, inactiveCurrentApaSourceIds,
  assertActiveApaReferences } from '../athleteApa/currentApaCore.js';
export const CURRENT_APA_CONTRACT = 'athlete_current_apa_v1';

// Demo authority remains fixture-pinned. A main-account adapter must never
// manufacture a Nia/Sofia slug or turn a canonical person into synthetic data.
const demoCore = createCurrentApaCore(Object.freeze({
  contract: CURRENT_APA_CONTRACT,
  binding(bundle) {
    const slug = bundle?.person?.slug;
    if (!['nia', 'sofia'].includes(slug)) throw new Error('CURRENT_APA_SYNTHETIC_ONLY');
    validateBundle(slug, bundle);
    return { slug, mm: bundle.person.mm, bos_hash: bundle.bos.artifact_sha256,
      baseline_hash: bundle.apa.artifact_sha256 };
  },
  artifactIdentity: bundle => ({ synthetic: true, mm: bundle.person.mm }),
  verifyArtifactIdentity: artifact => artifact.synthetic === true,
  changeIdentity: (change, bundle) => change.athlete_slug === bundle.person.slug,
  messageIdentity: () => true,
  sourceId: change => `APA:CURRENT:${change.id}`,
  sourceIdentity: () => ({}), receiptIdentity: () => ({}),
  verifyReceiptIdentity: () => true,
}));

export const { currentApaView, assertCurrentApaConfirmedSource, publishCurrentApa } = demoCore;
