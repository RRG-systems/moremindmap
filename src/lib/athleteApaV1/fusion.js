import { ATHLETE_BOS_APA_FUSION_CONTRACT, assert, assertSafeCustomerArtifact, portableStateHash, validateCurrentReality } from './contract.js'

export function fuseAthleteBosAndApa({ bosProjection, apa }) {
  validateCurrentReality(apa)
  assert(bosProjection?.contract === 'athlete-bos-shared-projection-v1', 'ATHLETE_BOS_PROJECTION_CONTRACT_INVALID')
  assert(bosProjection.apaSubjectId === apa.subject.id, 'ATHLETE_BOS_APA_SUBJECT_MISMATCH')
  assert(bosProjection.purpose === apa.scope.purpose, 'ATHLETE_BOS_APA_PURPOSE_MISMATCH')
  assert(bosProjection.authorization?.writable === false && apa.scope.writable === false, 'ATHLETE_BOS_APA_READ_ONLY_REQUIRED')
  assert(new Date(bosProjection.asOf) <= new Date(bosProjection.authorization.sourceGrantExpiry), 'ATHLETE_BOS_SHARED_GRANT_EXPIRED_AT_SNAPSHOT')

  const firstDrill = bosProjection.claims.find((claim) => claim.sourceClaimId === 'C05')
  const athleteGap = apa.claims.find((claim) => claim.topic === 'current_gap' && claim.actor === 'athlete')
  const instructorGap = apa.claims.find((claim) => claim.topic === 'current_gap' && claim.actor === 'instructor')
  const attempt = apa.claims.find((claim) => claim.topic === 'current_attempt')
  assert(firstDrill && athleteGap && instructorGap && attempt, 'ATHLETE_BOS_APA_FUSION_INPUT_INCOMPLETE')

  const fused = {
    contract: ATHLETE_BOS_APA_FUSION_CONTRACT,
    version: '1.0.0-synthetic',
    subject: structuredClone(apa.subject),
    relationship: structuredClone(apa.relationship),
    asOf: apa.asOf,
    sourceAuthorities: {
      bos: {
        contract: bosProjection.contract,
        artifactIdentity: bosProjection.sourceArtifactIdentity,
        stateHash: bosProjection.sourceStateHash,
        permittedClaimIds: bosProjection.claims.map((claim) => claim.id),
      },
      apa: {
        contract: apa.contract,
        stateHash: apa.stateHash,
        cassetteBinding: apa.cassetteBinding,
        claimIds: apa.claims.map((claim) => claim.id),
      },
    },
    currentReality: apa,
    bosContext: bosProjection.claims.map((claim) => ({ ...claim })),
    contextualHypotheses: [
      {
        id: 'FUSION-H01',
        statement: 'Clear first-rep information may be relevant to the early-practice pause, but the current evidence does not establish the cause.',
        status: 'CONTEXTUAL_HYPOTHESIS',
        bosClaimIds: [firstDrill.id],
        apaClaimIds: [athleteGap.id, instructorGap.id, attempt.id],
        alternatives: ['The drill changed late.', 'The pause reflected another unrecorded condition.', 'The two sources refer to different moments.'],
        falsifier: 'If the first assignment is clearly delivered and received across comparable practices and the same pause remains, the clarity hypothesis is weakened.',
        causeEstablished: false,
      },
    ],
    boundaries: {
      bosRemainsDistinct: true,
      apaRemainsDistinct: true,
      personalityCausedPerformance: false,
      agreementManufactured: false,
      customerTruthMutation: false,
      privateBosObjectsExposed: false,
    },
  }
  fused.stateHash = portableStateHash(fused)
  return assertSafeCustomerArtifact(fused)
}
