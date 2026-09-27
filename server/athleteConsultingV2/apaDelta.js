import { validateBundle } from './bundles.js';
import { MAX_CURRENT_APA_REVISIONS } from './currentApa.js';
import { object, string } from '../athleteAcademyV1/apa/schema.js';
import { createApaDeltaCore } from '../athleteApa/apaDeltaCore.js';

const BINDING_SCHEMA = object({
  synthetic: { type: 'boolean', enum: [true] },
  athlete_slug: { type: 'string', enum: ['nia', 'sofia'] },
  mm: string, bos_sha256: string, baseline_apa_sha256: string,
  current_apa_sha256: string,
  current_apa_version: { type: 'integer', minimum: 0, maximum: MAX_CURRENT_APA_REVISIONS },
  source_id: string, source_message_id: string,
});


const demoDelta = createApaDeltaCore(Object.freeze({
  contract: 'athlete_current_apa_delta_v1',
  receiptContract: 'athlete_current_apa_delta_reconstruction_v1',
  bindingSchema: BINDING_SCHEMA,
  validateBundle(bundle) {
    if (!['nia', 'sofia'].includes(bundle?.person?.slug)) {
      const error = new Error('APA_DELTA_SYNTHETIC_ONLY');
      error.validation_path = 'binding.athlete_slug';
      throw error;
    }
    validateBundle(bundle.person.slug, bundle);
  },
  verifyPriorIdentity: artifact => artifact.synthetic === true,
  changeIdentity: (change, bundle) => change.athlete_slug === bundle.person.slug,
  sourceId: change => `APA:CURRENT:${change.id}`,
  deltaIdentity: bundle => ({ synthetic: true, athlete_slug: bundle.person.slug }),
}));

export const { APA_DELTA_SCHEMA, apaDeltaBinding, reconstructApaDelta } = demoDelta;
