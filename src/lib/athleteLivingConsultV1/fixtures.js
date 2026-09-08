// Exact, private-only reading projection derived from the sealed fictional Mara
// Athlete BOS artifact. This is not a second truth store: identity/source hashes
// bind it to the sealed build artifact, and the joint/share compilers never read
// or expose this object (including its existence, counts, IDs, or hashes).
export const SYNTHETIC_MARA_PRIVATE_BOS_READING = Object.freeze({
  contract: 'athlete-bos-private-reading-projection-v1',
  sealedSource: Object.freeze({
    artifactIdentity: 'cb0eed649d6e28f01a9b106e5ceaad7674dc9817c4aac3d934bf6d7d36600f6b',
    artifactSha256: '87b36514847eaa143402e394ce413ab36c062b8d46db9047e0c6974af5ca58a5',
    sourceStateHash: '74ae5952206c4a347c82801b5e48eb0d407cf747906861bbea52c83028c42275',
    path: 'docs/more-athlete-bos-v1-build/runtime-evidence/cb0eed649d6e28f01a9b106e5ceaad7674dc9817c4aac3d934bf6d7d36600f6b/artifact.json',
    writable: false,
  }),
  subject: Object.freeze({ id: 'synthetic-athlete-mara', name: 'Mara', ageBand: '14–17', sport: 'volleyball' }),
  audience: 'athlete',
  lifeHopes: Object.freeze({ status: 'NOT_ASKED', evidenceIds: Object.freeze([]), meaning: 'No direct life-hopes answer was collected. That is not evidence that Mara has no hopes beyond sport.' }),
  evidence: Object.freeze([
    Object.freeze({ id: 'E01', text: 'I asked which drill to do and was told to wait. Then I was called passive.', actor: 'athlete', kind: 'self_report', audience: 'private', permission: Object.freeze({ purpose: 'synthetic_athlete_bos', version: 'original-case-v1', expiresAt: null }) }),
    Object.freeze({ id: 'E02', text: 'Mara waited at the edge of the drill. Coach does not know why; labels it hesitation.', actor: 'coach', kind: 'observation_and_interpretation', audience: 'shared', permission: Object.freeze({ purpose: 'synthetic_athlete_bos', version: 'original-case-v1', expiresAt: null }) }),
    Object.freeze({ id: 'E03', text: "I don't feel able to question that in front of everyone.", actor: 'athlete', kind: 'self_report', audience: 'private', permission: Object.freeze({ purpose: 'synthetic_athlete_bos', version: 'original-case-v1', expiresAt: null }) }),
    Object.freeze({ id: 'E04', text: 'A home responsibility affects one weekday. No guardian/team grant exists for this detail.', actor: 'athlete', kind: 'self_report', audience: 'private', permission: Object.freeze({ purpose: 'synthetic_athlete_bos', version: 'original-case-v1', expiresAt: null }) }),
    Object.freeze({ id: 'E05', text: 'Please make the first drill and meeting place clear.', actor: 'athlete', kind: 'explicit_shared_request', audience: 'coach-grant', permission: Object.freeze({ purpose: 'synthetic_athlete_bos', version: 'original-case-v1', expiresAt: '2026-09-30T23:59:59-07:00' }) }),
  ]),
  chapters: Object.freeze([
    Object.freeze({
      id: 'CH01',
      title: 'A waiting episode, not a personality verdict',
      evidenceIds: Object.freeze(['E01', 'E02']),
      prose: 'Mara, what happened here supports a gap in instructions and interpretation, not a verdict about you. In your account, you asked which drill to do and were told to wait. The coach saw you waiting at the edge of the drill, did not know why, and interpreted the waiting as hesitation. It is still unclear whether the instruction to wait was active at that moment, whether both accounts refer to exactly the same moment, or whether other cues were missing. The waiting happened, but its meaning remains unresolved. This episode does not establish anything lasting about your character, ability, motivation or ambition.',
    }),
    Object.freeze({
      id: 'CH02',
      title: 'Questioning in front of the group feels unavailable',
      evidenceIds: Object.freeze(['E03']),
      prose: 'You have said that questioning this in front of everyone does not feel available to you right now. That boundary matters in this setting. It does not mean you are generally unable or unwilling to ask questions, and it says nothing fixed about your confidence. We do not yet know exactly what part of the situation feels difficult to question, or whether a private, written, supported or different route would suit you better. Any follow-up can use a format you choose; you do not need to challenge the interpretation publicly.',
    }),
    Object.freeze({
      id: 'CH03',
      title: 'Two distinct clarity requests',
      evidenceIds: Object.freeze(['E05']),
      prose: 'You made two clear and reasonable requests: make the first drill clear, and make the meeting place clear. They are separate needs and should stay separate. It is not yet known whether either request has been delivered or acted on, which communication route reliably reaches you, or whether timing, wording or later changes are the main issue. If you still want the requests shared and permission remains valid or is renewed, the coach could send the meeting place and the first drill as two separate items before a comparable session. Afterward, you could choose whether and how to say if each one was received and clear. This would be an optional communication check, not a public test or a judgment of you. Clear drill information might reduce uncertainty at the start, while a separately confirmed meeting place might reduce uncertainty about where to meet. Neither result is guaranteed. If the information is received clearly and uncertainty remains, the communication approach may need to change; that must not be turned back into a claim that you are passive. Meeting-place clarity also says nothing about transport, arrival or preparation. Your hopes beyond sport were not asked about here, so no conclusion can be drawn about them.',
    }),
  ]),
  mutationAuthority: 'NONE_READ_ONLY',
})

