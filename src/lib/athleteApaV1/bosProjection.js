// This is a narrow, synthetic, purpose-bound projection from the sealed Mara
// Athlete BOS fixture. It intentionally excludes every private-only BOS object.
// scripts/athleteApaVerify.mjs proves the statements and IDs against the sealed
// source artifact before evidence is accepted.
export const SYNTHETIC_MARA_SHARED_BOS_PROJECTION = Object.freeze({
  contract: 'athlete-bos-shared-projection-v1',
  subjectId: 'synthetic-athlete-mara',
  apaSubjectId: 'synthetic-athlete-mara-apa-v1',
  sourceArtifactIdentity: 'cb0eed649d6e28f01a9b106e5ceaad7674dc9817c4aac3d934bf6d7d36600f6b',
  sourceArtifactSha256: '87b36514847eaa143402e394ce413ab36c062b8d46db9047e0c6974af5ca58a5',
  sourceStateHash: '74ae5952206c4a347c82801b5e48eb0d407cf747906861bbea52c83028c42275',
  audience: ['athlete', 'instructor'],
  purpose: 'synthetic_joint_current_reality',
  asOf: '2026-09-04T12:00:00-07:00',
  authorization: {
    mode: 'SYNTHETIC_SNAPSHOT_PROJECTION_ONLY',
    sourceGrantEvidenceId: 'E05',
    sourceGrantExpiry: '2026-09-30T23:59:59-07:00',
    writable: false,
  },
  claims: [
    {
      id: 'BOS-C05',
      sourceClaimId: 'C05',
      statement: 'Mara directly requested clear identification of the first drill.',
      authority: 'ATHLETE_BOS_SHARED_REQUEST',
      evidenceIds: ['E05'],
    },
    {
      id: 'BOS-C06',
      sourceClaimId: 'C06',
      statement: 'Mara directly requested a clear meeting place.',
      authority: 'ATHLETE_BOS_SHARED_REQUEST',
      evidenceIds: ['E05'],
    },
  ],
  excludedPrivateObjectCount: 4,
  rawEvidenceIncluded: false,
})
