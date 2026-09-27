import { assertCurrentApaConfirmedSource, publishCurrentApa } from './currentApa.js';
import { APA_DELTA_SCHEMA, apaDeltaBinding, reconstructApaDelta } from './apaDelta.js';
import { createApaComposerCore, makeApaCompositionInstructions,
  DEMO_APA_COMPOSITION_POLICY } from '../athleteApa/apaComposerCore.js';

export { APA_COMPOSITION_SCHEMA } from '../athleteApa/apaComposerCore.js';
export const APA_COMPOSITION_POLICY = DEMO_APA_COMPOSITION_POLICY;
export const APA_COMPOSITION_INSTRUCTIONS = makeApaCompositionInstructions({
  athleteAuthority: 'The athlete may be Nia or Sofia only, both synthetic.',
  deltaContract: 'athlete_current_apa_delta_v1',
});
const composer = createApaComposerCore(Object.freeze({
  assertCurrentApaConfirmedSource, publishCurrentApa, apaDeltaBinding, reconstructApaDelta,
  deltaSchema: APA_DELTA_SCHEMA, policy: APA_COMPOSITION_POLICY,
  instructions: APA_COMPOSITION_INSTRUCTIONS,
  packetContract: 'athlete_current_apa_composition_packet_v1',
  schemaName: 'athlete_current_apa_delta',
  selectedAthlete: bundle => ({ slug: bundle.person.slug, mm: bundle.person.mm,
    synthetic: true, bos_sha256: bundle.bos.artifact_sha256 }),
  evidenceIdentity: bundle => ({ athlete_slug: bundle.person.slug }),
  confirmationIdentity: () => ({}),
}));
export const { createApaComposer, validateApaPublicationDryRun } = composer;
