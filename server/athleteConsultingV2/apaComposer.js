import { assertCurrentApaConfirmedSource, publishCurrentApa } from './currentApa.js';
import { APA_DELTA_SCHEMA, APA_REFERENCE_CODEC_CONTRACT, apaDeltaBinding, reconstructApaDelta,
  apaReferenceCodecSchema, decodeApaReferenceCodec, apaReferenceCodecSchemaV2,
  decodeApaReferenceCodecV2 } from './apaDelta.js';
import { createApaComposerCore, makeApaCompositionInstructions, makeApaReferenceCodecInstructions,
  DEMO_APA_COMPOSITION_POLICY } from '../athleteApa/apaComposerCore.js';
import { athleteCurrentApprovalSnapshot } from './rsl.js';

export { APA_COMPOSITION_SCHEMA } from '../athleteApa/apaComposerCore.js';
export const APA_COMPOSITION_POLICY = DEMO_APA_COMPOSITION_POLICY;
export const APA_LEGACY_COMPOSITION_INSTRUCTIONS = makeApaCompositionInstructions({
  athleteAuthority: 'The athlete may be Nia or Sofia only, both synthetic.',
  deltaContract: 'athlete_current_apa_delta_v1',
});
export const APA_COMPOSITION_INSTRUCTIONS = makeApaReferenceCodecInstructions({
  athleteAuthority: 'The athlete may be Nia or Sofia only, both synthetic.',
  codecContract: APA_REFERENCE_CODEC_CONTRACT,
});
const composer = createApaComposerCore(Object.freeze({
  assertCurrentApaConfirmedSource, publishCurrentApa, apaDeltaBinding, reconstructApaDelta,
  apaReferenceCodecSchema, decodeApaReferenceCodec,
  previousCodecSchema: apaReferenceCodecSchemaV2,
  previousCodecDecoder: decodeApaReferenceCodecV2,
  previousCodecSchemaName: 'athlete_current_apa_reference_codec_v2',
  deltaSchema: APA_DELTA_SCHEMA, policy: APA_COMPOSITION_POLICY,
  instructions: APA_COMPOSITION_INSTRUCTIONS,
  legacyInstructions: APA_LEGACY_COMPOSITION_INSTRUCTIONS,
  legacySchemaName: 'athlete_current_apa_delta',
  packetContract: 'athlete_current_apa_composition_packet_v1',
  approvalPacketContract: 'athlete_current_apa_composition_packet_v2',
  currentApprovalSnapshot: athleteCurrentApprovalSnapshot,
  schemaName: 'athlete_current_apa_reference_codec_v3',
  selectedAthlete: bundle => ({ slug: bundle.person.slug, mm: bundle.person.mm,
    synthetic: true, bos_sha256: bundle.bos.artifact_sha256 }),
  evidenceIdentity: bundle => ({ athlete_slug: bundle.person.slug }),
  confirmationIdentity: () => ({}),
}));
export const { createApaComposer, validateApaPublicationDryRun } = composer;
