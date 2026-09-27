import { assertOwner, requireThat, validateCanonicalCoachBundle } from './bundle.js';
import { object, string } from '../apa/schema.js';
import { createCurrentApaCore, currentApaHash, MAX_CURRENT_APA_REVISIONS } from '../../athleteApa/currentApaCore.js';
import { createApaDeltaCore } from '../../athleteApa/apaDeltaCore.js';
import { createApaComposerCore, makeApaCompositionInstructions, makeApaReferenceCodecInstructions,
  DEMO_APA_COMPOSITION_POLICY } from '../../athleteApa/apaComposerCore.js';
import { createMainAthleteRslAdapter } from './rsl.js';

export const MAIN_CURRENT_APA_CONTRACT = 'athlete_academy_current_apa_v1';
export const MAIN_APA_DELTA_CONTRACT = 'athlete_academy_current_apa_delta_v1';
export const MAIN_APA_REFERENCE_CODEC_CONTRACT = 'athlete_academy_current_apa_reference_codec_v2';
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const same = (before, after) => before === undefined || after === undefined
  ? before === after : currentApaHash(before) === currentApaHash(after);

function canonicalBundle(bundle) {
  validateCanonicalCoachBundle(bundle);
  requireThat(same(Object.keys(bundle.binding).sort(), ['actorId', 'apa', 'bos', 'mm'])
    && !own(bundle.person, 'slug'), 'MAIN_CURRENT_APA_CANONICAL_AUTHORITY_REQUIRED');
  core.assertOriginalApaSurface(bundle);
  return bundle;
}

const sourceId = (change, bundle) => `APA:ACADEMY:${bundle.binding.actorId}:${change.id}`;
const ownerIdentity = bundle => ({ actorId: bundle.binding.actorId, mm: bundle.person.mm });
const accountIdentity = (value, bundle) => value?.actorId === bundle.binding.actorId
  && value.mm === bundle.person.mm;
const artifactIdentity = bundle => ({ actorId: bundle.binding.actorId, mm: bundle.person.mm,
  ...(own(bundle.person, 'synthetic') ? { synthetic: bundle.person.synthetic } : {}) });
const artifactMatches = (artifact, bundle) => accountIdentity(artifact, bundle)
  && artifact.current_apa_contract === MAIN_CURRENT_APA_CONTRACT
  && own(artifact, 'synthetic') === own(bundle.person, 'synthetic')
  && artifact.synthetic === bundle.person.synthetic;

const core = createCurrentApaCore(Object.freeze({
  contract: MAIN_CURRENT_APA_CONTRACT,
  binding: bundle => structuredClone(canonicalBundle(bundle).binding),
  artifactIdentity, verifyArtifactIdentity: artifactMatches,
  changeIdentity: (change, bundle) => accountIdentity(change, bundle) && !own(change, 'athlete_slug'),
  messageIdentity: (state, message, bundle) => same(state.sourceBinding, bundle.binding)
    && message.actorId === bundle.binding.actorId && (!own(message, 'mm') || message.mm === bundle.person.mm),
  sourceId, sourceIdentity: ownerIdentity, receiptIdentity: ownerIdentity,
  verifyReceiptIdentity: (receipt, source, bundle) => accountIdentity(receipt, bundle)
    && accountIdentity(source, bundle),
}));

const delta = createApaDeltaCore(Object.freeze({
  contract: MAIN_APA_DELTA_CONTRACT,
  codecContract: MAIN_APA_REFERENCE_CODEC_CONTRACT,
  receiptContract: 'athlete_academy_current_apa_delta_reconstruction_v1',
  bindingSchema: object({
    actorId: string, mm: string, bos_sha256: string, baseline_apa_sha256: string,
    current_apa_sha256: string,
    current_apa_version: { type: 'integer', minimum: 0, maximum: MAX_CURRENT_APA_REVISIONS },
    source_id: string, source_message_id: string,
  }),
  validateBundle: canonicalBundle, verifyPriorIdentity: artifactMatches,
  changeIdentity: (change, bundle) => accountIdentity(change, bundle) && !own(change, 'athlete_slug'),
  sourceId, deltaIdentity: bundle => ({ actorId: bundle.binding.actorId }),
}));

export const MAIN_APA_DELTA_SCHEMA = delta.APA_DELTA_SCHEMA;
const compositionPolicy = Object.fromEntries(Object.entries(DEMO_APA_COMPOSITION_POLICY)
  .filter(([key]) => key !== 'synthetic_only'));
export const MAIN_APA_COMPOSITION_POLICY = Object.freeze({ ...compositionPolicy, canonical_owner_only: true });
const athleteAuthority = 'The athlete is the authenticated canonical account identified by selected_athlete.actorId and MM. This is not a Nia/Sofia fixture or demo identity. Keep the supplied synthetic metadata unchanged; never manufacture it or use a slug as authority.';
export const MAIN_APA_LEGACY_COMPOSITION_INSTRUCTIONS = makeApaCompositionInstructions({
  athleteAuthority,
  deltaContract: MAIN_APA_DELTA_CONTRACT,
});
export const MAIN_APA_COMPOSITION_INSTRUCTIONS = makeApaReferenceCodecInstructions({
  athleteAuthority, codecContract: MAIN_APA_REFERENCE_CODEC_CONTRACT,
});

// Only the owning service can construct this adapter, with a synchronous check
// over its atomic account/dossier/coaching snapshots and a private capability.
// No default writable adapter, request boolean, unverified grant or fixture
// substitution is accepted. These pure methods never persist anything themselves.
export function createMainCurrentApaAdapter({ assertFencedAuthority } = {}) {
  requireThat(typeof assertFencedAuthority === 'function', 'MAIN_CURRENT_APA_FENCE_REQUIRED');
  const approvalReader = createMainAthleteRslAdapter({ assertFencedAuthority: () => false });
  function owner(input) {
    canonicalBundle(input?.bundle);
    assertOwner(input.bundle, input.principal);
    requireThat(input.principal.grants?.reportsRead === true, 'COACH_REPORT_ACCESS_DENIED');
  }
  function fenced(input, operation) {
    owner(input);
    requireThat(input.authority && typeof input.authority === 'object'
      && !Array.isArray(input.authority), 'MAIN_CURRENT_APA_FENCE_REQUIRED');
    const result = assertFencedAuthority({ bundle: input.bundle, principal: input.principal,
      state: input.state, authority: input.authority, operation });
    requireThat(result === true, 'MAIN_CURRENT_APA_FENCE_REQUIRED');
  }
  function read(input) {
    owner(input);
    return core.currentApaView(input.bundle, input.record ?? null);
  }
  function source(input, operation = 'source_preflight') {
    fenced(input, operation);
    return core.assertCurrentApaConfirmedSource(input);
  }
  function deltaInput(input, operation) {
    const verified = source(input, operation);
    if (input.prior !== undefined) requireThat(same(input.prior, verified.prior), 'APA_DELTA_PRIOR_INVALID');
    if (input.confirmedSource !== undefined) requireThat(same(input.confirmedSource, verified.source),
      'CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED');
    return { ...input, prior: verified.prior, confirmedSource: verified.source };
  }
  const apaDeltaBinding = input => delta.apaDeltaBinding(deltaInput(input, 'delta_binding'));
  const reconstructApaDelta = input => delta.reconstructApaDelta(deltaInput(input, 'reconstruction'));
  const apaReferenceCodecSchema = input => delta.apaReferenceCodecSchema(deltaInput(input, 'reconstruction'));
  const decodeApaReferenceCodec = input => delta.decodeApaReferenceCodec(deltaInput(input, 'reconstruction'));
  const apaReferenceCodecSchemaV2 = input => delta.apaReferenceCodecSchemaV2(deltaInput(input, 'reconstruction'));
  const decodeApaReferenceCodecV2 = input => delta.decodeApaReferenceCodecV2(deltaInput(input, 'reconstruction'));
  function publish(input, operation = 'publication') {
    fenced(input, operation);
    return core.publishCurrentApa(input);
  }
  const configuration = Object.freeze({
    deltaSchema: MAIN_APA_DELTA_SCHEMA, policy: MAIN_APA_COMPOSITION_POLICY,
    instructions: MAIN_APA_COMPOSITION_INSTRUCTIONS,
    legacyInstructions: MAIN_APA_LEGACY_COMPOSITION_INSTRUCTIONS,
    legacySchemaName: 'athlete_academy_current_apa_delta',
    packetContract: 'athlete_academy_current_apa_composition_packet_v1',
    approvalPacketContract: 'athlete_academy_current_apa_composition_packet_v2',
    schemaName: 'athlete_academy_current_apa_reference_codec_v3',
    previousCodecSchemaName: 'athlete_academy_current_apa_reference_codec_v2',
    selectedAthlete: bundle => ({ actorId: bundle.binding.actorId, mm: bundle.person.mm,
      ...(own(bundle.person, 'synthetic') ? { synthetic: bundle.person.synthetic } : {}),
      bos_sha256: bundle.bos.artifact_sha256 }),
    evidenceIdentity: bundle => ({ actorId: bundle.binding.actorId }),
    confirmationIdentity: ownerIdentity,
  });
  const composer = createApaComposerCore(Object.freeze({ ...configuration,
    currentApprovalSnapshot: input => {
      fenced(input, 'composition');
      return approvalReader.currentApprovalSnapshot(input);
    },
    assertCurrentApaConfirmedSource: input => source(input, 'composition'),
    publishCurrentApa: input => publish(input, 'publication_dry_run'),
    apaDeltaBinding, reconstructApaDelta, apaReferenceCodecSchema, decodeApaReferenceCodec,
    previousCodecSchema: apaReferenceCodecSchemaV2,
    previousCodecDecoder: decodeApaReferenceCodecV2,
  }));
  // Statically separate recovery authority: nested validation cannot switch
  // itself into a live operation or accept a request-selected bypass flag.
  const recovery = createApaComposerCore(Object.freeze({ ...configuration,
    currentApprovalSnapshot: input => {
      fenced(input, 'recovery');
      return approvalReader.currentApprovalSnapshot(input);
    },
    assertCurrentApaConfirmedSource: input => source(input, 'recovery'),
    publishCurrentApa: input => publish(input, 'recovery'),
    apaDeltaBinding: input => delta.apaDeltaBinding(deltaInput(input, 'recovery')),
    reconstructApaDelta: input => delta.reconstructApaDelta(deltaInput(input, 'recovery')),
    apaReferenceCodecSchema: input => delta.apaReferenceCodecSchema(deltaInput(input, 'recovery')),
    decodeApaReferenceCodec: input => delta.decodeApaReferenceCodec(deltaInput(input, 'recovery')),
    previousCodecSchema: input => delta.apaReferenceCodecSchemaV2(deltaInput(input, 'recovery')),
    previousCodecDecoder: input => delta.decodeApaReferenceCodecV2(deltaInput(input, 'recovery')),
  }));
  return Object.freeze({ currentApaView: read,
    assertCurrentApaConfirmedSource: input => source(input), publishCurrentApa: input => publish(input),
    apaDeltaBinding, reconstructApaDelta, apaReferenceCodecSchema, decodeApaReferenceCodec,
    apaReferenceCodecSchemaV2,
    createApaComposer: composer.createApaComposer,
    validateApaPublicationDryRun: composer.validateApaPublicationDryRun,
    recoverApaComposition(input) {
      fenced(input, 'recovery');
      return recovery.recoverApaComposition(input);
    } });
}
