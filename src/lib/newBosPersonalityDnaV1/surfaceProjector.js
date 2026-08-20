import {
  NEW_BOS_SURFACE_TRUTH_VERSION,
  SURFACE_HUMAN_MISSIONS,
  SURFACES,
  communicationDoctrineForSurface,
} from './constants.js';
import { selectSpecialistTruth } from './domainContracts.js';
import { selectLibraryForSurface } from './libraryRegistry.js';

const LOCAL_MISSIONS = SURFACE_HUMAN_MISSIONS;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectEvidenceRefs(value, output = []) {
  if (Array.isArray(value)) value.forEach((item) => collectEvidenceRefs(item, output));
  else if (value && typeof value === 'object') {
    if (Array.isArray(value.evidence_refs)) output.push(...value.evidence_refs);
    if (Array.isArray(value.counterevidence_refs)) output.push(...value.counterevidence_refs);
    Object.values(value).forEach((item) => collectEvidenceRefs(item, output));
  }
  return output;
}

function relevantClaimIds(draft, surfaceId) {
  const explicit = draft.surface_claims?.[surfaceId];
  if (Array.isArray(explicit)) return unique(explicit);
  return unique([
    ...(draft.dynamics || []).map(({ id }) => id),
    ...(draft.attributes || []).map(({ id }) => id),
    ...(draft.topology || []).map(({ id }) => id),
  ]);
}

function buildResolvedLocalTruth({ rawEvidence, personalityDna, wholePersonModel, draft, surface }) {
  const claimLookup = new Map([
    ...personalityDna.topology,
    ...personalityDna.attributes,
    ...personalityDna.causal_dynamics,
  ].map((claim) => [claim.id, claim]));
  const claimRefs = relevantClaimIds(draft, surface.id);
  const resolvedClaims = claimRefs.map((ref) => claimLookup.get(ref)).filter(Boolean);
  const specialistTruth = selectSpecialistTruth(personalityDna.specialized_intelligence, surface.id);
  const specialistEvidenceRefs = collectEvidenceRefs(specialistTruth);
  const wholePersonRefs = ['this_is_you', 'operating_identity'].includes(surface.id)
    ? wholePersonModel.evidence_refs || []
    : [];
  const allEvidenceRefs = surface.id === 'evidence_certainty'
    ? rawEvidence.evidence.map(({ evidence_id: id }) => id)
    : unique([
      ...(draft.surface_evidence_refs?.[surface.id] || []),
      ...wholePersonRefs,
      ...specialistEvidenceRefs,
      ...resolvedClaims.flatMap((claim) => [...claim.evidence_refs, ...(claim.counterevidence_refs || [])]),
    ]);
  const evidence = allEvidenceRefs
    .map((ref) => rawEvidence.evidence.find(({ evidence_id: id }) => id === ref))
    .filter(Boolean);
  const localEvidenceIds = new Set(evidence.map(({ evidence_id: id }) => id));
  const contradictions = surface.id === 'evidence_certainty'
    ? rawEvidence.contradictions
    : rawEvidence.contradictions.filter((item) => (item.evidence_refs || []).some((ref) => localEvidenceIds.has(ref)));

  return Object.freeze({
    version: NEW_BOS_SURFACE_TRUTH_VERSION,
    surface_id: surface.id,
    subject_token: rawEvidence.subject_token,
    whole_person_model: wholePersonModel,
    resolved_claims: Object.freeze(resolvedClaims),
    evidence: Object.freeze(evidence),
    confidence_states: Object.freeze(unique(resolvedClaims.map(({ confidence }) => confidence))),
    contradictions: Object.freeze(contradictions),
    counterevidence: Object.freeze(evidence.filter(({ epistemic_class: kind }) => kind === 'counterevidence')),
    confounds: Object.freeze(unique(resolvedClaims.flatMap(({ confounds = [] }) => confounds))),
    falsifiers: Object.freeze(resolvedClaims.map(({ id, statement, what_would_change_it: falsifier }) => ({ claim_id: id, claim: statement, falsifier }))),
    abstentions: personalityDna.abstentions,
    specialist_truth: specialistTruth,
    prior_coordinates: surface.id === 'personality_dna' ? personalityDna.priors : Object.freeze([]),
    lineage: Object.freeze({
      personality_dna_version: personalityDna.version,
      raw_evidence_ref: personalityDna.raw_evidence_ref,
      library_manifest_sha256: selectLibraryForSurface(surface.id).manifest_sha256,
    }),
  });
}

export function buildCustomerSurfacePackets({ rawEvidence, personalityDna, wholePersonModel, draft }) {
  return SURFACES.map((surface) => {
    const resolvedLocalTruth = buildResolvedLocalTruth({ rawEvidence, personalityDna, wholePersonModel, draft, surface });
    return Object.freeze({
      surface_id: surface.id,
      surface_number: surface.number,
      label: surface.label,
      destination: surface.destination,
      local_mission: LOCAL_MISSIONS[surface.id],
      whole_person_ref: `${wholePersonModel.version}:${rawEvidence.subject_token}`,
      whole_person_model: wholePersonModel,
      claim_refs: Object.freeze(resolvedLocalTruth.resolved_claims.map(({ id }) => id)),
      resolved_local_truth: resolvedLocalTruth,
      library_selection: selectLibraryForSurface(surface.id),
      communication_contract: communicationDoctrineForSurface(surface.id),
      rendering: draft.surface_renderings?.[surface.id]
        ? Object.freeze(draft.surface_renderings[surface.id])
        : null,
    });
  });
}

export { LOCAL_MISSIONS };
