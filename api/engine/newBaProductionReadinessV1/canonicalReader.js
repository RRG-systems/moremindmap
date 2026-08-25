import { normalizeAssessmentId, normalizeProfileId, sha256Stable, sha256Text } from './stable.js';
import {
  AMBER_FROZEN_BOS_AUTHORITY,
  PATRICIA_FROZEN_BOS_AUTHORITY,
  WALLY_FROZEN_BOS_AUTHORITY,
} from './frozenAuthority.js';
import amberBosFusionAuthority from './pinnedAuthority/AMBER_BOS_FUSION_AUTHORITY_V1.json' with { type: 'json' };
import patriciaBosFusionAuthority from './pinnedAuthority/PATRICIA_BOS_FUSION_AUTHORITY_V1.json' with { type: 'json' };
import wallyBosFusionAuthority from './pinnedAuthority/WALLY_BOS_FUSION_AUTHORITY_V1.json' with { type: 'json' };
import {
  buildSyntheticBosFusionAuthority,
  projectBosFusionAuthorityFromArtifact,
  validateBosFusionAuthority,
} from './fusionContract.js';
import { classifyBaEvidenceSufficiency } from './evidenceSufficiency.js';
import { resolveAssessmentVerticalBinding } from '../../business-assessment/verticalBinding.js';
import { PRODUCTION_BA_CASSETTE_REGISTRY } from '../../../src/lib/baVerticalCassettesV1/index.js';

export const PATRICIA_PROFILE_ID = 'MM-20260708-DSST020Z';
export const PATRICIA_ASSESSMENT_ID = 'ba-20260714-64ca0783';
export const AMBER_PROFILE_ID = 'MM-20260617-YBNWT0KS';
export const AMBER_ASSESSMENT_ID = 'ba-20260722-881ba54d';
export const WALLY_PROFILE_ID = 'MM-20260531-ASOVNJZ4';
export const WALLY_ASSESSMENT_ID = 'ba-20260605-d2aa1165';
export const TAMMY_PROFILE_ID = 'MM-20260610-QES82PI1';
export const TAMMY_ASSESSMENT_ID = 'ba-20260610-3a517fd8';
export const DANIEL_PROFILE_ID = 'MM-20260804-QCMR6KP4';
export const DANIEL_ASSESSMENT_ID = 'ba-20260805-3ba1fbf4';
export const SYNTHETIC_TOP_PROFILE_ID = 'MM-20260816-BAQATOP1';
export const SYNTHETIC_TOP_ASSESSMENT_ID = 'ba-20260816-ba0a7001';

export const PATRICIA_ANSWER_SHA256 = Object.freeze({
  q1: '7037547f2e7b5830fc114cb928b9b2922f951f004c6f1155f9045607be3bb583',
  q2: 'ebfadf453863c1c49dd5e747d6ac914308ec026023614a43d19cb904e600c93d',
  q3: 'fd27aded7aa32d02ab58215cb4594b77e1d99ffe126a15b06db82fbd66d3a524',
  q4: 'f40581d889f3a576212f406fe297c67c61dc6158a75f8cb53fcfe2ea8fbfc10d',
  q5: '20f51a5b70fbb85f58381de23393c530549637ddc032dbe8017a8a30c39c7bc2',
  q6: '80d507561782ddc2ab0af97b9ce1c1357d357b0a256c7496b15499df0fb4c3ed',
  q7: 'aca290b51b7466faf3cfb0f612791a1c23e818ba80f2a2d95f73c1e793cebddc',
  q8: '0a89cde3290edc3c156a9b8ff7049e9bb6a9856244ca7d86414ca4f8306934df',
  q9: 'e20439f30ebc8474be45e4602eb521bf6f31a714db06986e8eef6eeffbf8923f',
  q10: '8415147ea90b8a6f5ec6da5bfa9ef540adff72c0b723e2e35a259c0d2a2864d2',
  q11: 'fa208ad1ca34b321cc39a990d97e6f43404fdfe0b3a00f5048cae6a9990ebbfc',
  q12: 'eb063a44e1743a4c3912c31df2a27ded228cee65ea85e763f7063b7229fccca4',
});

export const AMBER_ANSWER_SHA256 = Object.freeze({
  q1: '0c85f8ee4a6b09bd26574244803a304a47c8585aac177deac495a5a608f8e606',
  q2: '950e4f02a0af67c0631932e5638f84d5bb795bf34b67db94bd0d92092bf0486c',
  q3: 'ed2a21c88cb8ac56e587e05e56f87bf9199a63ed932e8399ae6960b5e1f4c617',
  q4: 'c5b0bf43ba3f7e0d37e9b9e73487f35789ad70814f9a819b07d2117f0b44333e',
  q5: 'de61ad283e2725c4d1dce547fbbe28bed27bfbd7b27fc0842e379aa2ea00c129',
  q6: '235759cb8eeb2398fe8d0cbc7e62c0cf08b52fd4f6429a88129d10d824702f66',
  q7: '478ddfafdba08e2b592582b5b675f12b8f8efb08a94170bacf4212f4000addba',
  q8: 'bb56b20fc571788f72743d4208d06d25a02ef7800077675a4878b6531fc9ebc3',
  q9: '379919a6b73ba9aee81c2032af94a0fccf2198690db4b269a5664d65496327c3',
  q10: 'e84ea175eb1827038e3a692051b7083bac80f1405f9ffe0ce9cf12c78fb83d50',
  q11: 'bee05815de640226eff30ffa7f81e14f74898f041da3fe181a27a57addc26b81',
  q12: '649f609b14b1c70d04a2cab43e16995ddbe1ef786c8d4f01fa78f18a159e01ef',
});

export const WALLY_ANSWER_SHA256 = Object.freeze({
  q1: 'ed2f3b5028d9b3660a75d51d2eb636e6c52db810e1c9740f352be323f3f25198',
  q2: '1ad48ed3194b7218d183512597b8078170fe9d9d6b266c424095e0c78f99a3f2',
  q3: '3c4bc7b916c19570fc1131e6b04f36ace134f286263eedb54f1e69c9c6c90ceb',
  q4: 'a3bb11d7dd34d24e20ef9ef6106f6ea92945453ae142c7107e70af5dc94e4fb6',
  q5: '1da28d483956c701bab0f375db6654e7b2889e93e366345f8b12578471f5b88e',
  q6: '88dc60090b6e276c93da35622999c3fd589a9f10fe844250325b8ca550adcc01',
  q7: '708c3c89f8e8a667cb7485689c67875d49ff501f93c8a87540e02c5d623a2e39',
  q8: 'f6a3bffd087cbff8cf8286baa82e8ae66463cc7985491259512fdd6b4ebd2e47',
  q9: '63f64e38ac1cbd4306bae043839e8dc1e2e915cf2ee1bbbf9eae8d8ffaf7b0a0',
  q10: 'dafe1d86102e373545e93434d0b194f8b334d8e06f057f7f9a59014ab60cc292',
  q11: '6ea5928594dbb4a74446041a43d20117de483be4384912b3f863c1e81a11b499',
  q12: 'd55f12306a13754b8b676079df61ee967d2277747de8c291ab43639f7db57a61',
});

export const TAMMY_ANSWER_SHA256 = Object.freeze({
  q1: 'db05abfd7472ed8f748e80ee62abef19d8f29c986ae682b51431dbad8c6b0c2a', q2: '96a8a3c86ac66b8bce0eb25dc128ac0893509d7e0d40e92eb7c92d313430bccd', q3: 'd1cd23c89848bf7777cd9704353ca39089f3938375c9cb7319af2e55dbc1ad32', q4: 'fb2e00111d68e4a1f68fafdfc1d1f0938065f19fad8295bbbce9e837daf49633', q5: '82467ee056a10198d0f1df286df29ce7c0a028e631859333986f551c508c0528', q6: '0b9fb800cd08e66548940ae89d0a8f5f37ac772c85af719802e402a2031cd435', q7: '656ae724ff7fc333d957558bd9923a47461a2b82cedd70e9716138172c9f4c81', q8: '72f0430a3ebe1dc20d492491262c50ccf623e79fa1b2ea7374bc0d062e7ce293', q9: 'ac049ae2e03e525531c7f5e4e7d028b0333915b7034227b3a3f52dbb2dd69751', q10: 'c87754aebb814e16a4d7466669270bf099ba467d7da207347729231d22efa4a7', q12: '38b70c0af3fb9316248ad2ddca7da23d38470e10aa060e058202d854c38ef859',
});

export const DANIEL_ANSWER_SHA256 = Object.freeze({
  q1: '22f6fed0f0a629b5f092fa1de915bbafcd258c936a841673c0cf1b302bb4b036', q2: 'a75931641549a31dcd233c89105651975ee5b2c51398836ba378217329c632eb', q3: 'ef185cad0399e72eba1af4f14aafe1c3be05cfd4e5cb4f953fa4c2081e3a2be6', q4: '6f490f348e432ae09b47e82e425558d6547523cf57c3ea99bce291eb8903b892', q5: '6ac52b5fa07e85437c764ef94853950077f7d00e0e0e08705f5b2fe87083d89e', q6: '04a2e19a83277c111ae72bbccf1ba61d4fe092e6867b78d82d12f6719fdec593', q7: 'dabaa8ad8fc285ae48ead38e293d98c6ac192df2d4dd0f4afb3acd8f5a08864b', q8: '8532e37f5aa81d5750f104512161af91083fdcb937d1733c010cf9b85183a860', q9: '78e1835cbf4e4e77eba4f2ba93b676d1a17d00520cf2aabda563075c270cfd31', q10: 'ad0c60e11e5054ab3e4edd1bdd00c5152539ee1503d5afa89176ff6f3bda140e', q12: 'efb0aae7a2e4790e05697dce9d739332aa02dd1f10dd0e25d856bda6b8ef5617',
});

const BUNDLED_BOS_AUTHORITIES = Object.freeze({
  [PATRICIA_PROFILE_ID]: Object.freeze({ frozen: PATRICIA_FROZEN_BOS_AUTHORITY, fusion: patriciaBosFusionAuthority }),
  [AMBER_PROFILE_ID]: Object.freeze({ frozen: AMBER_FROZEN_BOS_AUTHORITY, fusion: amberBosFusionAuthority }),
  [WALLY_PROFILE_ID]: Object.freeze({ frozen: WALLY_FROZEN_BOS_AUTHORITY, fusion: wallyBosFusionAuthority }),
});

const PINNED_ASSESSMENT_AUTHORITIES = Object.freeze({
  [PATRICIA_PROFILE_ID]: Object.freeze({ assessmentId: PATRICIA_ASSESSMENT_ID, answerSha256: PATRICIA_ANSWER_SHA256 }),
  [AMBER_PROFILE_ID]: Object.freeze({ assessmentId: AMBER_ASSESSMENT_ID, answerSha256: AMBER_ANSWER_SHA256 }),
  [WALLY_PROFILE_ID]: Object.freeze({ assessmentId: WALLY_ASSESSMENT_ID, answerSha256: WALLY_ANSWER_SHA256 }),
  [TAMMY_PROFILE_ID]: Object.freeze({ assessmentId: TAMMY_ASSESSMENT_ID, answerSha256: TAMMY_ANSWER_SHA256 }),
  [DANIEL_PROFILE_ID]: Object.freeze({ assessmentId: DANIEL_ASSESSMENT_ID, answerSha256: DANIEL_ANSWER_SHA256 }),
});

export function resolveBundledBosAuthority(profileId) {
  const profile = normalizeProfileId(profileId);
  const bundled = BUNDLED_BOS_AUTHORITIES[profile];
  if (!bundled) return null;
  const fusionAuthority = validateBosFusionAuthority(bundled.fusion, { profileId: profile });
  if (fusionAuthority.source_artifact_sha256 !== bundled.frozen.sha256) throw new Error(`new_ba_bundled_bos_fusion_source_hash_drift:${profile}`);
  return Object.freeze({
    ...bundled.frozen,
    fusion_authority: fusionAuthority,
    fusion_contract_sha256: fusionAuthority.contract_sha256,
    evidence_boundary_sha256: fusionAuthority.evidence_boundary_sha256,
    identity_context: Object.freeze({
      display_name: profileId === PATRICIA_PROFILE_ID ? 'Patricia' : profileId === AMBER_PROFILE_ID ? 'Amber' : 'Wally',
    }),
  });
}

function businessAssessmentByProfileKey(profileId) {
  return `business_assessment_by_profile:${profileId.toLowerCase()}`;
}

function businessAssessmentKey(assessmentId) {
  return `business_assessment:${assessmentId}`;
}

export const NEW_BA_GOVERNED_ASSESSMENT_STATES = Object.freeze([
  'intake_saved',
  'business_intelligence_draft_ready',
  'executive_diagnostic_briefing_ready',
  'five_futures_and_one_move_ready',
  'ready',
  'complete',
  'completed',
]);

export function isGovernedNewBaAssessmentState(value) {
  return NEW_BA_GOVERNED_ASSESSMENT_STATES.includes(String(value || ''));
}

export function normalizeGovernedAssessmentRecord(record, expectedProfileId) {
  const profileId = normalizeProfileId(record?.owner_profile_id);
  if (profileId !== expectedProfileId) throw new Error('new_ba_canonical_reader_profile_mismatch');
  const assessmentId = normalizeAssessmentId(record?.assessment_id);
  if (!isGovernedNewBaAssessmentState(record?.status)) throw new Error('new_ba_canonical_reader_assessment_state_unsupported');
  if (record?.version !== 'business_assessment_v1_intake') throw new Error('new_ba_canonical_reader_assessment_version_unsupported');
  const verticalBinding = resolveAssessmentVerticalBinding(record);
  const cassette = PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical(verticalBinding.vertical_id);
  const cassetteQuestionKeys = cassette.intake_contract.questions.map((question) => question.key);
  const answers = {};
  const answerSha256 = {};
  for (const key of cassetteQuestionKeys) {
    const answer = typeof record?.inputs?.answers?.[key] === 'string' ? record.inputs.answers[key] : '';
    if (!answer.trim()) continue;
    answers[key] = answer;
    answerSha256[key] = sha256Text(answer);
  }
  const pinned = PINNED_ASSESSMENT_AUTHORITIES[profileId];
  if (pinned) {
    if (assessmentId !== pinned.assessmentId) throw new Error(`new_ba_pinned_assessment_id_drift:${profileId}`);
    for (const [key, hash] of Object.entries(pinned.answerSha256)) {
      if (answerSha256[key] !== hash) throw new Error(`new_ba_pinned_answer_hash_drift:${profileId}:${key}`);
    }
    const unexpectedPinnedAnswer = Object.keys(answerSha256).find((key) => !Object.hasOwn(pinned.answerSha256, key));
    if (unexpectedPinnedAnswer) throw new Error(`new_ba_pinned_answer_presence_drift:${profileId}:${unexpectedPinnedAnswer}`);
  }
  const explicitQuestionStates = record?.inputs?.question_states && typeof record.inputs.question_states === 'object'
    ? record.inputs.question_states
    : undefined;
  const evidenceSufficiency = classifyBaEvidenceSufficiency({
    answers,
    answerSha256,
    explicit_question_states: explicitQuestionStates,
    questionAuthority: cassette.evidence_contract.question_authority,
    questionKeys: cassetteQuestionKeys,
    requiredMissions: cassette.evidence_contract.sufficiency_missions,
  });
  if (evidenceSufficiency.status !== 'PASS') throw new Error(`new_ba_business_evidence_insufficient:${evidenceSufficiency.failed_missions.join(',') || evidenceSufficiency.reasons.join(',')}`);
  const accepted = Object.freeze({
    profile_id: profileId,
    assessment_id: assessmentId,
    status: record.status,
    version: record.version,
    assessment_type: record.assessment_type,
    created_at: record.created_at,
    updated_at: record.updated_at || null,
    submitted_at: record.submitted_at || null,
    completed_at: record.completed_at || null,
    answers: Object.freeze(answers),
    answer_sha256: Object.freeze(answerSha256),
    ...(explicitQuestionStates ? { question_states: Object.freeze(structuredClone(explicitQuestionStates)) } : {}),
    read_only: true,
    excluded_fields: Object.freeze(['output', 'business_intelligence_draft', 'briefing', 'five_futures_v1', 'one_move_v1', 'profile_context', 'presentation']),
  });
  return Object.freeze({
    ...accepted,
    vertical_binding: verticalBinding,
    evidence_sufficiency: evidenceSufficiency,
    evidence_sha256: sha256Stable(accepted),
  });
}

async function readBosAuthority(redis, bosNamespace, profileId) {
  const pointer = await redis.get(`${bosNamespace}:latest-compatible:${profileId}`);
  if (!pointer) {
    const bundled = resolveBundledBosAuthority(profileId);
    if (bundled) return bundled;
    throw new Error('new_ba_compatible_bos_authority_missing');
  }
  const raw = await redis.get(`${bosNamespace}:artifact:${profileId}:${pointer}`);
  if (!raw) throw new Error('new_ba_bos_authority_pointer_target_missing');
  const envelope = JSON.parse(raw);
  if (envelope.profile_id !== profileId || envelope.realization_id !== pointer) throw new Error('new_ba_bos_authority_profile_isolation_failure');
  if (envelope.complete_surface_count !== 15 || !/^[a-f0-9]{64}$/u.test(envelope.artifact_sha256 || '')) throw new Error('new_ba_bos_authority_incomplete');
  if (sha256Stable(envelope.artifact) !== envelope.artifact_sha256) throw new Error('new_ba_bos_authority_artifact_hash_mismatch');
  const fusionAuthority = projectBosFusionAuthorityFromArtifact({
    artifact: envelope.artifact,
    profileId,
    realizationId: pointer,
    artifactSha256: envelope.artifact_sha256,
    realizationVersion: envelope.realization_identity?.version,
  });
  return Object.freeze({
    compatible: true,
    realization_id: pointer,
    sha256: envelope.artifact_sha256,
    version: envelope.realization_identity?.version,
    profile_id: profileId,
    fusion_authority: fusionAuthority,
    fusion_contract_sha256: fusionAuthority.contract_sha256,
    evidence_boundary_sha256: fusionAuthority.evidence_boundary_sha256,
    identity_context: envelope.artifact?.identity_context || null,
  });
}

export function createReadOnlyBaAuthorityReader({ redis, bosNamespace, fixtureReader = null } = {}) {
  if (typeof redis?.get !== 'function') throw new Error('new_ba_canonical_reader_redis_required');
  return Object.freeze({
    async read(profileId) {
      const profile = normalizeProfileId(profileId);
      if (typeof fixtureReader === 'function') {
        const fixture = await fixtureReader(profile);
        if (fixture) return fixture;
      }
      const assessmentId = await redis.get(businessAssessmentByProfileKey(profile));
      if (!assessmentId) throw new Error('new_ba_business_assessment_not_found');
      const raw = await redis.get(businessAssessmentKey(normalizeAssessmentId(assessmentId)));
      if (!raw) throw new Error('new_ba_business_assessment_pointer_target_missing');
      const businessEvidence = normalizeGovernedAssessmentRecord(JSON.parse(raw), profile);
      const bosAuthority = await readBosAuthority(redis, bosNamespace, profile);
      return Object.freeze({
        profile_id: profile,
        assessment_id: businessEvidence.assessment_id,
        source_kind: 'SAVED_BUSINESS_ASSESSMENT',
        business_evidence: businessEvidence,
        bos_authority: bosAuthority,
        identity_context: bosAuthority.identity_context || null,
      });
    },
  });
}

export function createAuthorizedSyntheticTopSource() {
  const answers = Object.freeze(Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`q${index + 1}`, `Authorized synthetic top-stage Real Estate evidence ${index + 1}`])));
  const answerSha256 = Object.freeze(Object.fromEntries(Object.entries(answers).map(([key, answer]) => [key, sha256Text(answer)])));
  const evidence = Object.freeze({
    profile_id: SYNTHETIC_TOP_PROFILE_ID,
    assessment_id: SYNTHETIC_TOP_ASSESSMENT_ID,
    status: 'complete',
    version: 'business_assessment_v1_intake',
    assessment_type: 'real_estate_team',
    created_at: '2026-08-16T00:00:00.000Z',
    updated_at: null,
    submitted_at: '2026-08-16T00:00:00.000Z',
    completed_at: '2026-08-16T00:00:00.000Z',
    answers,
    answer_sha256: answerSha256,
    read_only: true,
    excluded_fields: Object.freeze([]),
  });
  const verticalBinding = resolveAssessmentVerticalBinding({
    version: evidence.version,
    assessment_type: evidence.assessment_type,
  });
  const bosArtifactSha256 = sha256Stable({ proof: 'synthetic-bos-top-v1', profile_id: SYNTHETIC_TOP_PROFILE_ID });
  const fusionAuthority = buildSyntheticBosFusionAuthority({ profileId: SYNTHETIC_TOP_PROFILE_ID, realizationId: 'synthetic-bos-top-v1', sourceArtifactSha256: bosArtifactSha256 });
  return Object.freeze({
    profile_id: SYNTHETIC_TOP_PROFILE_ID,
    assessment_id: SYNTHETIC_TOP_ASSESSMENT_ID,
    source_kind: 'AUTHORIZED_SYNTHETIC_GENERALIZATION_PROOF',
    business_evidence: Object.freeze({ ...evidence, vertical_binding: verticalBinding, evidence_sha256: sha256Stable(evidence) }),
    bos_authority: Object.freeze({
      compatible: true,
      realization_id: 'synthetic-bos-top-v1',
      sha256: bosArtifactSha256,
      version: 'synthetic-proof-v1',
      profile_id: SYNTHETIC_TOP_PROFILE_ID,
      fusion_authority: fusionAuthority,
      fusion_contract_sha256: fusionAuthority.contract_sha256,
      evidence_boundary_sha256: fusionAuthority.evidence_boundary_sha256,
    }),
  });
}
