import { buildSyntheticAthleteApa } from '../athleteApaV1/build.js'
import { SYNTHETIC_MARA_SHARED_BOS_PROJECTION } from '../athleteApaV1/bosProjection.js'
import { hashCanonicalJson } from '../intelligenceFabric/hashing.js'
import { assertLivingConsult, clone, stableId } from './contracts.js'

const ALLOWED_EVIDENCE_CLASSES = new Set([
  'ATHLETE_REPORT',
  'INSTRUCTOR_REPORT',
  'INSTRUCTOR_OBSERVATION',
  'SHARED_AGREEMENT',
  'OBJECTIVE_RECORD',
])

export function sourceBindingsForLivingConsult(apaArtifact) {
  return {
    contract: 'athlete-living-consult-source-bindings-v1',
    syntheticOnly: true,
    writable: false,
    bos: {
      contract: SYNTHETIC_MARA_SHARED_BOS_PROJECTION.contract,
      sealedArtifactIdentity: SYNTHETIC_MARA_SHARED_BOS_PROJECTION.sourceArtifactIdentity,
      sealedArtifactSha256: SYNTHETIC_MARA_SHARED_BOS_PROJECTION.sourceArtifactSha256,
      sourceStateHash: SYNTHETIC_MARA_SHARED_BOS_PROJECTION.sourceStateHash,
      permittedJointClaimIds: SYNTHETIC_MARA_SHARED_BOS_PROJECTION.claims.map((claim) => claim.id),
      mutationAuthority: 'NONE_READ_ONLY',
    },
    apa: {
      contract: apaArtifact.contract,
      artifactHash: apaArtifact.artifactHash,
      currentRealityHash: apaArtifact.source.currentRealityHash,
      cassetteId: apaArtifact.cassette.id,
      cassetteVersion: apaArtifact.cassette.version,
      sourceSnapshotWritable: false,
      livingProjectionAuthority: 'GOVERNED_DERIVATIVE_ONLY',
    },
  }
}

export function safeJointBosClaims() {
  return SYNTHETIC_MARA_SHARED_BOS_PROJECTION.claims.map(({ id, sourceClaimId, statement, authority }) => ({
    id,
    sourceClaimId,
    statement,
    authority,
  }))
}

export function createLivingConsultBaselineMap(cassetteId = 'more-athlete-default-v1') {
  const apaArtifact = buildSyntheticAthleteApa(cassetteId)
  const body = {
    contract: 'athlete-living-performance-map-v1',
    version: 1,
    versionId: 'athlete-map-v1-baseline',
    syntheticOnly: true,
    cassette: {
      id: apaArtifact.cassette.id,
      version: apaArtifact.cassette.version,
      label: apaArtifact.cassette.label,
      vocabulary: clone(apaArtifact.cassette.box1Vocabulary),
    },
    subject: {
      id: 'synthetic-athlete-mara-lcv1',
      displayName: apaArtifact.subject.displayName,
      ageBand: apaArtifact.subject.ageBand,
      sport: apaArtifact.subject.sport,
    },
    asOf: apaArtifact.asOf,
    boxes: clone(apaArtifact.boxes),
    sharedBosContext: safeJointBosClaims(),
    authorizedLivingEvidence: [],
    authorizedChanges: [],
    guarantees: {
      bosReadOnly: true,
      sourceApaReadOnly: true,
      livingMapIsDerived: true,
      noPersonalityPerformanceCausation: true,
      noOutcomePrediction: true,
      noSelectionMeaning: true,
      uncertaintyPreserved: true,
    },
  }
  body.mapIdentity = hashCanonicalJson(body)
  return { map: body, apaArtifact, sourceBindings: sourceBindingsForLivingConsult(apaArtifact) }
}

function normalizeLivingEvidence(item) {
  assertLivingConsult(item?.id && item.statement, 'ATHLETE_LIVING_CONSULT_EVIDENCE_INVALID')
  assertLivingConsult(ALLOWED_EVIDENCE_CLASSES.has(item.sourceClass), 'ATHLETE_LIVING_CONSULT_EVIDENCE_CLASS_INVALID')
  return {
    id: item.id,
    statement: item.statement,
    sourceClass: item.sourceClass,
    sourceActor: item.sourceActor,
    audience: item.audience,
    observedAt: item.observedAt || null,
    provenance: clone(item.provenance || {}),
    epistemicStatus: item.epistemicStatus || 'REPORTED',
    causalClaim: false,
  }
}

function applyDelta(target, delta = {}) {
  if (Array.isArray(delta.currentRealityAdditions)) {
    target.boxes.currentReality.livingClaims = [
      ...(target.boxes.currentReality.livingClaims || []),
      ...clone(delta.currentRealityAdditions),
    ]
  }
  if (Array.isArray(delta.evidenceAdditions)) {
    target.boxes.evidence.livingLedger = [
      ...(target.boxes.evidence.livingLedger || []),
      ...clone(delta.evidenceAdditions),
    ]
  }
  if (delta.oneMove && typeof delta.oneMove === 'object') {
    target.boxes.oneMove = {
      ...target.boxes.oneMove,
      ...clone(delta.oneMove),
      acceptanceState: delta.oneMove.acceptanceState || 'NOT_ACCEPTED',
      causalConfidence: delta.oneMove.causalConfidence || 'NOT_ASSESSED',
    }
  }
  if (Array.isArray(delta.futureUpdates)) {
    const updates = new Map(delta.futureUpdates.map((future) => [future.id, future]))
    target.boxes.futures = target.boxes.futures.map((future) => updates.has(future.id)
      ? { ...future, ...clone(updates.get(future.id)), outcomePrediction: false, selectionMeaning: false }
      : future)
  }
  if (delta.planContext && typeof delta.planContext === 'object') {
    target.boxes.plan = { ...target.boxes.plan, ...clone(delta.planContext), status: 'PROPOSED_NOT_ACCEPTED' }
  }
}

export function validateMapDelta(delta = {}) {
  const allowed = new Set(['currentRealityAdditions', 'evidenceAdditions', 'oneMove', 'futureUpdates', 'planContext'])
  assertLivingConsult(delta && typeof delta === 'object' && !Array.isArray(delta), 'ATHLETE_LIVING_CONSULT_MAP_DELTA_INVALID')
  assertLivingConsult(Object.keys(delta).every((key) => allowed.has(key)), 'ATHLETE_LIVING_CONSULT_MAP_DELTA_PATH_FORBIDDEN')
  const serialized = JSON.stringify(delta)
  assertLivingConsult(!/(talent score|coachability score|selection rank|scholarship probability|professional probability|diagnos|medical clearance)/iu.test(serialized), 'ATHLETE_LIVING_CONSULT_MAP_DELTA_UNSAFE')
  return delta
}

export function regenerateLivingConsultMap({ baselineMap, authorizedEvidence = [], committedChanges = [], asOf = null }) {
  assertLivingConsult(baselineMap?.contract === 'athlete-living-performance-map-v1', 'ATHLETE_LIVING_CONSULT_BASELINE_MAP_INVALID')
  const next = clone(baselineMap)
  delete next.mapIdentity
  next.version = committedChanges.length + 1
  next.versionId = `athlete-map-v${next.version}-${stableId('change', committedChanges.map((entry) => entry.proposalId || entry.id), 12).replace('change_', '')}`
  next.asOf = asOf || committedChanges.at(-1)?.committedAt || baselineMap.asOf
  next.authorizedLivingEvidence = authorizedEvidence.map(normalizeLivingEvidence)
  next.authorizedChanges = committedChanges.map((entry) => ({
    proposalId: entry.proposalId,
    title: entry.title,
    summary: entry.summary,
    reason: entry.reason,
    evidenceRefs: clone(entry.evidenceRefs || []),
    uncertainty: entry.uncertainty || 'Uncertainty remains where the available evidence does not settle the explanation.',
    falsifier: entry.falsifier || null,
    committedAt: entry.committedAt,
    confirmedBy: clone(entry.confirmedBy),
    causalClaimEstablished: false,
  }))
  next.boxes = clone(baselineMap.boxes)
  for (const entry of committedChanges) {
    validateMapDelta(entry.delta || {})
    applyDelta(next, entry.delta)
  }
  next.mapIdentity = hashCanonicalJson(next)
  return next
}

export function createClarityMapChangeCandidate(evidenceId) {
  return {
    title: 'What changed after another clear-cue practice',
    summary: 'Add the new joint observation while keeping the cause unresolved.',
    reason: 'A new comparable observation belongs in the living map once both people confirm it.',
    evidenceRefs: [evidenceId],
    uncertainty: 'The additional observation does not prove that clearer instructions caused the difference.',
    falsifier: 'If repeated practices with a clearly received cue do not show the same pattern, the clarity hypothesis is weakened.',
    delta: {
      currentRealityAdditions: [{
        id: `living-claim-${evidenceId}`,
        statement: 'A later comparable practice was reported jointly as easier to enter after the first assignment was clear.',
        sourceClass: 'SHARED_AGREEMENT',
        epistemicStatus: 'AGREED_OBSERVATION',
        evidenceRefs: [evidenceId],
        causeEstablished: false,
      }],
      evidenceAdditions: [{
        id: evidenceId,
        meaning: 'One more comparable observation is available; it is not causal proof.',
        causalConfidence: 'NOT_ASSESSED',
      }],
      futureUpdates: [{
        id: 'future-emerging',
        support: 'Emerging · another confirmed observation',
        meaning: 'Clear first-rep information may make the opening of comparable practices easier to enter.',
        uncertainty: 'The additional observation strengthens the reason to keep learning; it still does not establish a stable change or its cause.',
      }],
      oneMove: {
        title: 'Continue the three-practice clarity check with separate observations.',
        why: 'The new observation makes another comparable check useful, while the mixed earlier record and possible confounders still argue against a causal conclusion.',
        acceptanceState: 'NOT_ACCEPTED',
        executionState: 'NOT_RECORDED',
        causalConfidence: 'NOT_ASSESSED',
      },
      planContext: {
        title: 'A refreshed proposal to learn from comparable practices.',
        status: 'PROPOSED_NOT_ACCEPTED',
        mapChangeMeaning: 'The map changed; no Athlete Development Agreement was accepted automatically.',
      },
    },
  }
}
