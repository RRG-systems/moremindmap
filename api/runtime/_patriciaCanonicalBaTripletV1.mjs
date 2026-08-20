import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import OpenAI from 'openai';

import {
  FIVE_FUTURES_V2_ROLES,
  LATER_RUNTIME_BOUNDARIES,
  WBM_CONTRACT_ID,
  WBM_CONTRACT_VERSION,
  WBM_DOMAINS,
  WBM_SCHEMA_VERSION,
  canonicalHash,
  loadFrozenAuthorityLibrary,
} from '../../src/lib/wholeBusinessModelV1/index.js';
import {
  CERTAINTY_SUPPORT_CLASSES as FUTURE_CERTAINTY_CLASSES,
  FUTURE_ROLES,
  SUPPORT_COMPONENTS,
} from '../../src/lib/fiveFuturesV2/index.js';
import {
  CERTAINTY_SUPPORT_CLASSES as MOVE_CERTAINTY_CLASSES,
  DEPENDENCY_BURDENS,
  REVERSIBILITY_CLASSES,
  SELECTION_DIMENSIONS,
} from '../../src/lib/oneMoveV2/index.js';

export const CAMPAIGN_ID = 'patricia-canonical-ba-triplet-v1';
export const PROFILE_ID = 'mm-20260708-dsst020z';
export const ASSESSMENT_ID = 'ba-20260714-64ca0783';
export const BUSINESS_ID = `business-${ASSESSMENT_ID}`;
export const MODEL = 'gpt-5.6-sol';
export const EXPECTED_BOS_SHA256 = '54e3c525a63f34864a2b88eb7ce42bd7df9053e79f03e73b4aaa4aba472d61c2';
export const ASSESSMENT_URL = `https://moremindmap.com/api/business-assessment/retrieve?id=${PROFILE_ID}`;
export const SUCCESS_VERDICT = 'PATRICIA_CANONICAL_BA_TRIPLET_V1_FROZEN_READY_FOR_CUSTOMER_REALIZATION_LAB';
export const TRIPLET_ROOT = 'docs/patricia-canonical-ba-triplet-v1';
export const ZIP_NAME = 'MORE_MINDMAP_PATRICIA_CANONICAL_BA_TRIPLET_V1.zip';

export const EXPECTED_ANSWER_HASHES = Object.freeze({
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

const QUESTION_AUTHORITY = Object.freeze({
  q1: Object.freeze({ purpose: 'Business Awareness Reality', primary_domain: 'demand', secondary_domains: ['pipeline', 'goals'] }),
  q2: Object.freeze({ purpose: 'Desired Future', primary_domain: 'goals', secondary_domains: ['stage', 'capacity'] }),
  q3: Object.freeze({ purpose: 'Relationship Asset Reality', primary_domain: 'relationship', secondary_domains: ['demand'] }),
  q4: Object.freeze({ purpose: 'Business Generation Behavior', primary_domain: 'demand', secondary_domains: ['relationship', 'conversion'] }),
  q5: Object.freeze({ purpose: 'Database Intelligence', primary_domain: 'relationship', secondary_domains: ['pipeline', 'conversion', 'operations'] }),
  q6: Object.freeze({ purpose: 'Lead Generation Reality', primary_domain: 'demand', secondary_domains: ['capacity', 'operations'] }),
  q7: Object.freeze({ purpose: 'Accountability Reality', primary_domain: 'accountability', secondary_domains: ['operations', 'team'] }),
  q8: Object.freeze({ purpose: 'Systems Reality', primary_domain: 'operations', secondary_domains: ['listing', 'buyer', 'conversion', 'transaction'] }),
  q9: Object.freeze({ purpose: 'Financial Reality', primary_domain: 'financial', secondary_domains: ['stage', 'capacity'] }),
  q10: Object.freeze({ purpose: 'Constraint Reality', primary_domain: 'constraints', secondary_domains: ['capacity', 'operations'] }),
  q11: Object.freeze({ purpose: 'Team Reality', primary_domain: 'team', secondary_domains: ['capacity', 'accountability'] }),
  q12: Object.freeze({ purpose: 'Scaling Reality', primary_domain: 'capacity', secondary_domains: ['stage', 'team', 'operations'] }),
});

const COMPLETED_STATES = new Set(['complete', 'completed', 'ready', 'five_futures_and_one_move_ready']);
const EPISTEMIC = Object.freeze(['KNOWN', 'STRONGLY_SUPPORTED', 'SUPPORTED_HYPOTHESIS', 'TENTATIVE', 'CONFLICTED', 'INSUFFICIENT_EVIDENCE', 'ABSTAINED']);
const CONSTRAINTS = Object.freeze(['person', 'system', 'capacity', 'demand', 'conversion', 'economics', 'role', 'team', 'market', 'mixed', 'insufficient_evidence']);
const RELATIONSHIPS = Object.freeze(['AMPLIFIES', 'COMPENSATES', 'FRICTION', 'FEASIBILITY_MODIFIER', 'NO_MATERIAL_LINK', 'ABSTAINED']);
const PROJECTION = Object.freeze(['ELIGIBLE', 'ELIGIBLE_WITH_DISCLOSURE', 'BLOCKED_MISSING_EVIDENCE', 'BLOCKED_CONTRADICTION', 'BLOCKED_AUTHORITY_GAP', 'BLOCKED_INTEGRITY']);

export function invariant(condition, code, details = undefined) {
  if (condition) return;
  const error = new Error(code);
  error.code = code;
  if (details !== undefined) error.details = details;
  throw error;
}

export function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function stableHash(value) {
  return sha256Bytes(JSON.stringify(stable(value)));
}

export function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase();
}

function getAssessment(payload) {
  return payload?.assessment && typeof payload.assessment === 'object' ? payload.assessment : payload;
}

export function normalizeAssessmentPayload(payload, {
  profileId = PROFILE_ID,
  assessmentId = ASSESSMENT_ID,
  expectedAnswerHashes = EXPECTED_ANSWER_HASHES,
  requirePinnedHashes = true,
} = {}) {
  invariant(payload && typeof payload === 'object', 'PATRICIA_BA_PAYLOAD_MALFORMED');
  const assessment = getAssessment(payload);
  invariant(assessment && typeof assessment === 'object', 'PATRICIA_BA_ASSESSMENT_MISSING');
  const observedProfileId = assessment.owner_profile_id || payload.owner_profile_id;
  invariant(normalizeIdentity(observedProfileId) === normalizeIdentity(profileId), 'PATRICIA_PROFILE_ID_MISMATCH');
  invariant(assessment.assessment_id === assessmentId, 'PATRICIA_ASSESSMENT_ID_DRIFT');
  invariant(COMPLETED_STATES.has(String(assessment.status || '').toLowerCase()), 'PATRICIA_ASSESSMENT_NOT_COMPLETE');
  invariant(assessment.version === 'business_assessment_v1_intake', 'PATRICIA_ASSESSMENT_VERSION_DRIFT');
  invariant(String(assessment.assessment_type || '').startsWith('real_estate'), 'PATRICIA_ASSESSMENT_VERTICAL_DRIFT');
  invariant(Number.isFinite(Date.parse(assessment.created_at)), 'PATRICIA_ASSESSED_AT_INVALID');
  const answers = assessment.inputs?.answers;
  invariant(answers && typeof answers === 'object', 'PATRICIA_GOVERNED_ANSWERS_MISSING');
  const normalizedAnswers = {};
  const answerReceipts = {};
  for (let index = 1; index <= 12; index += 1) {
    const key = `q${index}`;
    const storedAnswer = typeof answers[key] === 'string' ? answers[key] : '';
    invariant(storedAnswer.trim().length > 0, `PATRICIA_${key.toUpperCase()}_MISSING`);
    const answerHash = sha256Bytes(storedAnswer);
    if (requirePinnedHashes) invariant(answerHash === expectedAnswerHashes[key], `PATRICIA_${key.toUpperCase()}_HASH_DRIFT`);
    normalizedAnswers[key] = storedAnswer;
    answerReceipts[key] = Object.freeze({
      sha256: answerHash,
      characters: storedAnswer.length,
      purpose: QUESTION_AUTHORITY[key].purpose,
      primary_domain: QUESTION_AUTHORITY[key].primary_domain,
      secondary_domains: QUESTION_AUTHORITY[key].secondary_domains,
    });
  }
  return Object.freeze({
    assessment_identity: Object.freeze({
      business_id: `business-${assessment.assessment_id}`,
      assessment_id: assessment.assessment_id,
      assessment_version: assessment.version,
      owner_profile_id: normalizeIdentity(observedProfileId),
      vertical: 'real_estate',
      business_model_identity: assessment.assessment_type,
      completion_state: 'COMPLETE',
      assessed_at: assessment.created_at,
    }),
    answers: Object.freeze(normalizedAnswers),
    evidence_receipt: Object.freeze({
      source: `moremindmap-readonly-business-assessment:${assessment.assessment_id}:inputs.answers`,
      profile_id: normalizeIdentity(observedProfileId),
      assessment_id: assessment.assessment_id,
      assessment_status: assessment.status,
      assessment_version: assessment.version,
      assessment_type: assessment.assessment_type,
      assessed_at: assessment.created_at,
      source_payload_sha256: stableHash(payload),
      answer_receipts: Object.freeze(answerReceipts),
      accepted_input_paths: Object.freeze(['assessment.identity', 'assessment.inputs.answers.q1..q12']),
      rejected_input_paths: Object.freeze([
        'assessment.business_intelligence_draft',
        'assessment.briefing',
        'assessment.output',
        'assessment.output.five_futures',
        'assessment.output.one_move',
        'assessment.profile_context',
        'root.profile_context',
        'assessment.presentation',
        'assessment.presentation_fields',
        'assessment.metadata.generated content',
      ]),
      legacy_generated_output_present_but_excluded: Boolean(assessment.output),
      generated_profile_context_present_but_excluded: Boolean(assessment.profile_context || payload.profile_context),
      excluded_generated_fields_present: Object.freeze({
        business_intelligence_draft: Boolean(assessment.business_intelligence_draft || assessment.output?.business_intelligence_draft),
        briefing: Boolean(assessment.briefing || assessment.output?.briefing),
        legacy_five_futures: Boolean(assessment.output?.five_futures || assessment.five_futures),
        legacy_one_move: Boolean(assessment.output?.one_move || assessment.one_move),
        generated_profile_context: Boolean(assessment.profile_context || payload.profile_context),
        presentation_fields: Boolean(assessment.presentation || assessment.presentation_fields || assessment.output?.presentation),
      }),
    }),
  });
}

function selectConfidence(value, fallback = 'SUPPORTED_HYPOTHESIS') {
  return EPISTEMIC.includes(value) ? value : fallback;
}

function textList(values) {
  return values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim());
}

export function projectWholePersonAuthority(candidate, {
  profileId = PROFILE_ID,
  bosHash = EXPECTED_BOS_SHA256,
} = {}) {
  invariant(candidate && typeof candidate === 'object', 'PATRICIA_FROZEN_BOS_MALFORMED');
  invariant(normalizeIdentity(candidate.profile_id) === normalizeIdentity(profileId), 'PATRICIA_FROZEN_BOS_WRONG_SUBJECT');
  const wpm = candidate.whole_person_model;
  const specialized = candidate.personality_dna?.specialized_intelligence;
  invariant(wpm && specialized, 'PATRICIA_WHOLE_PERSON_AUTHORITY_MISSING');
  const role = specialized.role_seat || {};
  const cognition = specialized.cognition || {};
  const energy = specialized.energy || {};
  const claims = [
    {
      claim_id: 'patricia-wpm-operating-core-v1',
      meaning: wpm.core_explanation,
      relevant_domains: ['operations', 'capacity', 'goals', 'stage'],
      epistemic_class: selectConfidence(wpm.confidence),
      evidence_refs: wpm.evidence_refs || [],
    },
    {
      claim_id: 'patricia-wpm-work-relationships-v1',
      meaning: wpm.work_and_relationships,
      relevant_domains: ['relationship', 'team', 'operations', 'capacity'],
      epistemic_class: selectConfidence(wpm.confidence),
      evidence_refs: wpm.evidence_refs || [],
    },
    {
      claim_id: 'patricia-wpm-pressure-recovery-v1',
      meaning: wpm.pressure_and_recovery,
      relevant_domains: ['accountability', 'operations', 'capacity', 'team'],
      epistemic_class: selectConfidence(specialized.pressure_conflict?.transformations?.[0]?.confidence),
      evidence_refs: specialized.pressure_conflict?.transformations?.[0]?.evidence_refs || [],
    },
    {
      claim_id: 'patricia-wpm-role-seat-v1',
      meaning: textList([
        role.selected_configuration,
        role.plural_success_note,
        role.fit_states?.[0]?.reasoning,
      ]).join(' '),
      relevant_domains: ['team', 'capacity', 'operations', 'stage'],
      epistemic_class: selectConfidence(role.fit_states?.[0]?.confidence),
      evidence_refs: role.fit_states?.[0]?.evidence_refs || [],
    },
    {
      claim_id: 'patricia-wpm-cognitive-process-v1',
      meaning: (cognition.indicators || []).map((item) => item.indicator).filter(Boolean).join(' '),
      relevant_domains: ['operations', 'accountability', 'capacity', 'constraints'],
      epistemic_class: selectConfidence(cognition.indicators?.[0]?.confidence),
      evidence_refs: [...new Set((cognition.indicators || []).flatMap((item) => item.evidence_refs || []))],
    },
    {
      claim_id: 'patricia-wpm-energy-context-v1',
      meaning: textList([energy.context?.summary, energy.trajectory?.summary]).join(' '),
      relevant_domains: ['capacity', 'team', 'operations', 'goals'],
      epistemic_class: selectConfidence(energy.context?.status),
      evidence_refs: energy.context?.evidence_refs || [],
    },
  ];
  claims.forEach((claim) => invariant(typeof claim.meaning === 'string' && claim.meaning.trim(), `PATRICIA_WPM_CLAIM_EMPTY:${claim.claim_id}`));
  return Object.freeze({
    profile_id: normalizeIdentity(profileId),
    source_profile_id: candidate.profile_id,
    bos_version: `${candidate.version}:${wpm.version}`,
    bos_hash: bosHash,
    claims: Object.freeze(claims.map(Object.freeze)),
  });
}

export function buildGovernedWholeBusinessInput({ assessment, wholePerson, requestedAt }) {
  invariant(assessment?.answers && wholePerson?.claims, 'PATRICIA_GOVERNED_INPUT_SOURCES_REQUIRED');
  invariant(normalizeIdentity(assessment.assessment_identity.owner_profile_id) === normalizeIdentity(wholePerson.profile_id), 'PATRICIA_IDENTITY_CONTINUITY_FAILED');
  const governedBusinessEvidence = Object.entries(assessment.answers).map(([key, value]) => Object.freeze({
    evidence_id: `${ASSESSMENT_ID}-${key}`,
    business_id: assessment.assessment_identity.business_id,
    profile_id: normalizeIdentity(assessment.assessment_identity.owner_profile_id),
    domain: QUESTION_AUTHORITY[key].primary_domain,
    evidence_class: 'OPERATOR_REPORTED',
    source_ref: `stored_business_assessment:${ASSESSMENT_ID}:inputs.answers.${key}`,
    observed_at: assessment.assessment_identity.assessed_at,
    value,
    units: null,
    period: 'assessment-time-self-report',
  }));
  const materialDomains = [...new Set(Object.values(QUESTION_AUTHORITY).flatMap((item) => [item.primary_domain, ...item.secondary_domains]))];
  const missingEvidence = Object.freeze([
    Object.freeze({ missing_id: 'patricia-missing-direct-operating-corroboration-v1', domain: 'operations', question: 'Which current direct operating records corroborate the customer-reported systems and execution state?', decision_impact: 'Could strengthen, weaken, or replace cross-domain operating mechanisms.' }),
    Object.freeze({ missing_id: 'patricia-missing-current-market-context-v1', domain: 'market', question: 'Which time-bound current market facts materially alter the internal business explanation?', decision_impact: 'Could identify or rule out an external constraint or confound.' }),
    Object.freeze({ missing_id: 'patricia-missing-longitudinal-state-v1', domain: 'stage', question: 'Which comparable observations across time establish current direction of travel?', decision_impact: 'Could change momentum, emerging-change support, and trajectory interpretation.' }),
    Object.freeze({ missing_id: 'patricia-missing-authorized-team-authority-v1', domain: 'team', question: 'Which active team identities carry explicit WBM_CONTEXT authority and frozen BOS hashes?', decision_impact: 'Until proven, team structure remains operator-reported business evidence and no person-level team synthesis is authorized.' }),
    Object.freeze({ missing_id: 'patricia-missing-financial-source-documents-v1', domain: 'financial', question: 'Which governed financial records corroborate the operator-reported financial state and time window?', decision_impact: 'Could strengthen or revise economic and capacity conclusions.' }),
  ]);
  return Object.freeze({
    requested_at: requestedAt,
    assessment_identity: assessment.assessment_identity,
    frozen_whole_person_authority: Object.freeze({
      profile_id: normalizeIdentity(wholePerson.profile_id),
      bos_version: wholePerson.bos_version,
      bos_hash: wholePerson.bos_hash,
      claims: wholePerson.claims,
    }),
    governed_business_evidence: Object.freeze(governedBusinessEvidence),
    contradictions: Object.freeze([]),
    missing_evidence: missingEvidence,
    dynamic_intelligence: Object.freeze([]),
    team_authority: null,
    authorization: Object.freeze({ permitted_profile_ids: Object.freeze([normalizeIdentity(wholePerson.profile_id)]) }),
    context_hints: Object.freeze({ material_domains: Object.freeze(materialDomains.filter((domain) => WBM_DOMAINS.includes(domain))) }),
  });
}

function filesRecursively(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? filesRecursively(absolute) : [absolute];
  });
}

function verifyManifestArtifacts(repositoryRoot, relativeRoot, manifestFile, recordsKey) {
  const manifestPath = path.join(repositoryRoot, relativeRoot, manifestFile);
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  const records = manifest[recordsKey];
  invariant(Array.isArray(records), `FROZEN_MANIFEST_RECORDS_MISSING:${manifestFile}`);
  const failures = [];
  for (const record of records) {
    const target = path.join(repositoryRoot, relativeRoot, record.path);
    if (!fs.existsSync(target)) {
      failures.push(`missing:${record.path}`);
      continue;
    }
    const bytes = fs.readFileSync(target);
    if (bytes.length !== record.bytes || sha256Bytes(bytes) !== record.sha256) failures.push(`drift:${record.path}`);
  }
  invariant(failures.length === 0, `FROZEN_MANIFEST_INTEGRITY_FAILED:${manifestFile}`, failures);
  return Object.freeze({
    manifest_id: manifest.manifest_id,
    version: manifest.version,
    verdict: manifest.verdict,
    manifest_path: path.posix.join(relativeRoot, manifestFile),
    manifest_sha256: sha256Bytes(manifestBytes),
    verified_artifact_count: records.length,
  });
}

function verifyMirror(repositoryRoot, sourceRoot, frozenRoot) {
  const sourceFiles = filesRecursively(path.join(repositoryRoot, sourceRoot)).filter((file) => /\.(?:js|mjs)$/u.test(file));
  const failures = [];
  for (const source of sourceFiles) {
    const relative = path.relative(path.join(repositoryRoot, sourceRoot), source);
    const mirror = path.join(repositoryRoot, frozenRoot, relative);
    if (!fs.existsSync(mirror)) {
      failures.push(relative);
      continue;
    }
    const frozenBytes = fs.readFileSync(mirror);
    let decodedFrozenBytes = frozenBytes;
    try {
      const serialized = JSON.parse(frozenBytes);
      if (serialized?.type === 'Buffer' && Array.isArray(serialized.data)) decodedFrozenBytes = Buffer.from(serialized.data);
    } catch {
      // A directly copied implementation file is already the byte payload to compare.
    }
    if (sha256Bytes(fs.readFileSync(source)) !== sha256Bytes(decodedFrozenBytes)) failures.push(relative);
  }
  invariant(failures.length === 0, `FROZEN_RUNTIME_MIRROR_DRIFT:${sourceRoot}`, failures);
  return Object.freeze({ source_root: sourceRoot, frozen_root: frozenRoot, byte_identical_files: sourceFiles.length });
}

export function verifyFrozenAuthorities(repositoryRoot) {
  const candidatePath = path.join(repositoryRoot, 'docs/new-bos-personality-dna-v1/top-projection-repair-v1/private-candidates/PATRICIA_TOP_PROJECTION_REPAIRED_CANDIDATE_V1.json');
  const candidateBytes = fs.readFileSync(candidatePath);
  invariant(sha256Bytes(candidateBytes) === EXPECTED_BOS_SHA256, 'PATRICIA_FINAL_BOS_HASH_DRIFT');
  const finalFreezePath = path.join(repositoryRoot, 'docs/new-bos-personality-dna-v1/final-new-bos-freeze-v1/FINAL_NEW_BOS_FREEZE_MANIFEST_V1.json');
  const finalFreezeBytes = fs.readFileSync(finalFreezePath);
  const finalFreeze = JSON.parse(finalFreezeBytes);
  const patriciaRecord = finalFreeze.profiles?.find((profile) => String(profile.profile).toLowerCase() === 'patricia');
  invariant(patriciaRecord?.sha256 === EXPECTED_BOS_SHA256, 'PATRICIA_NOT_BOUND_BY_FINAL_NEW_BOS_FREEZE');
  invariant(normalizeIdentity(patriciaRecord.profile_id) === PROFILE_ID, 'PATRICIA_FINAL_NEW_BOS_ID_DRIFT');
  const library = loadFrozenAuthorityLibrary({ libraryRoot: path.join(repositoryRoot, 'docs/ba-intelligence-authority-library-v1') });
  const wbm = verifyManifestArtifacts(repositoryRoot, 'docs/whole-business-model-v1', 'freeze/WHOLE_BUSINESS_MODEL_V1_MANIFEST.json', 'artifacts_excluding_self_and_validation_receipt');
  const futures = verifyManifestArtifacts(repositoryRoot, 'docs/five-futures-v2', 'freeze/FIVE_FUTURES_V2_MANIFEST.json', 'artifacts_excluding_self_and_validation_receipt');
  const oneMove = verifyManifestArtifacts(repositoryRoot, 'docs/one-move-v2', 'freeze/ONE_MOVE_V2_MANIFEST.json', 'artifacts_excluding_self_ledger_and_validation_receipt');
  const mirrors = [
    verifyMirror(repositoryRoot, 'src/lib/wholeBusinessModelV1', 'docs/whole-business-model-v1/implementation/src/lib/wholeBusinessModelV1'),
    verifyMirror(repositoryRoot, 'src/lib/fiveFuturesV2', 'docs/five-futures-v2/implementation/src/lib/fiveFuturesV2'),
    verifyMirror(repositoryRoot, 'src/lib/oneMoveV2', 'docs/one-move-v2/implementation/src/lib/oneMoveV2'),
  ];
  return Object.freeze({
    status: 'PASS',
    new_bos: Object.freeze({
      final_freeze_verdict: finalFreeze.verdict,
      final_freeze_manifest_sha256: sha256Bytes(finalFreezeBytes),
      patricia_candidate_path: path.relative(repositoryRoot, candidatePath),
      patricia_profile_id: normalizeIdentity(patriciaRecord.profile_id),
      patricia_candidate_sha256: EXPECTED_BOS_SHA256,
      whole_person_model_sha256: stableHash(JSON.parse(candidateBytes).whole_person_model),
    }),
    bible_library: Object.freeze({
      verdict: library.freeze_manifest.verdict,
      manifest_id: library.freeze_manifest.manifest_id,
      universal_verified: library.universal_bibles.length,
      real_estate_verified: library.real_estate_bibles.length,
      total_verified: library.universal_bibles.length + library.real_estate_bibles.length,
      authority_hashes: Object.freeze(Object.fromEntries([...library.universal_bibles, ...library.real_estate_bibles].map((item) => [item.authority_id, item.sha256]))),
    }),
    runtimes: Object.freeze({ wbm, five_futures: futures, one_move: oneMove, mirrors }),
    candidate: JSON.parse(candidateBytes),
    library,
  });
}

export function worktreeStatus(repositoryRoot) {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  invariant(result.status === 0, 'WORKTREE_STATUS_FAILED');
  const campaignPrefix = `${TRIPLET_ROOT}/`;
  const lines = result.stdout.split('\n').filter(Boolean).filter((line) => {
    const file = line.slice(3).replace(/^"|"$/gu, '');
    return !file.startsWith(campaignPrefix);
  });
  return Object.freeze({ entries: Object.freeze(lines), entry_count: lines.length, sha256: sha256Bytes(`${lines.join('\n')}\n`) });
}

export function protectedAuthoritySnapshot(repositoryRoot) {
  const roots = [
    'src/lib/wholeBusinessModelV1', 'src/lib/fiveFuturesV2', 'src/lib/oneMoveV2',
    'docs/ba-intelligence-authority-library-v1', 'docs/whole-business-model-v1',
    'docs/five-futures-v2', 'docs/one-move-v2',
    'docs/new-bos-personality-dna-v1/final-new-bos-freeze-v1',
    'docs/new-bos-personality-dna-v1/top-projection-repair-v1/private-candidates/PATRICIA_TOP_PROJECTION_REPAIRED_CANDIDATE_V1.json',
  ];
  const files = roots.flatMap((relative) => {
    const absolute = path.join(repositoryRoot, relative);
    return fs.statSync(absolute).isDirectory() ? filesRecursively(absolute) : [absolute];
  }).sort();
  const records = files.map((file) => Object.freeze({ path: path.relative(repositoryRoot, file), sha256: sha256Bytes(fs.readFileSync(file)), bytes: fs.statSync(file).size }));
  return Object.freeze({ file_count: records.length, canonical_set_sha256: stableHash(records), records: Object.freeze(records) });
}

const stringArray = Object.freeze({ type: 'array', maxItems: 6, items: { type: 'string' } });
const nullableString = Object.freeze({ type: ['string', 'null'] });

function closedObject(properties, required = Object.keys(properties)) {
  return { type: 'object', additionalProperties: false, required, properties };
}

function enumValue(values) {
  return { type: 'string', enum: [...values] };
}

function governedAuthorityReferenceArray(authorityIds) {
  invariant(Array.isArray(authorityIds) && authorityIds.length > 0, 'PATRICIA_WBM_AUTHORITY_CONTRACT_MISSING');
  const uniqueIds = [...new Set(authorityIds)];
  invariant(
    uniqueIds.length === authorityIds.length && uniqueIds.every((authorityId) => typeof authorityId === 'string' && authorityId.length > 0),
    'PATRICIA_WBM_AUTHORITY_CONTRACT_INVALID',
  );
  return { type: 'array', maxItems: Math.min(12, uniqueIds.length), items: enumValue(uniqueIds) };
}

function governedReferenceArray(values, missingCode, invalidCode) {
  invariant(Array.isArray(values) && values.length > 0, missingCode);
  const uniqueValues = [...new Set(values)];
  invariant(
    uniqueValues.length === values.length && uniqueValues.every((value) => typeof value === 'string' && value.length > 0),
    invalidCode,
  );
  return { type: 'array', maxItems: Math.min(12, uniqueValues.length), items: enumValue(uniqueValues) };
}

function optionalGovernedReferenceArray(values, missingCode, invalidCode) {
  if (values === undefined) return stringArray;
  invariant(Array.isArray(values), missingCode);
  if (values.length === 0) return { type: 'array', maxItems: 0, items: { type: 'string' } };
  return governedReferenceArray(values, missingCode, invalidCode);
}

function claimSchema(evidenceReferenceArray) {
  return closedObject({
    claim_id: { type: 'string' }, meaning: { type: 'string' }, epistemic_class: enumValue(EPISTEMIC),
    evidence_refs: evidenceReferenceArray, counterevidence_refs: evidenceReferenceArray, confounds: stringArray, falsifier: { type: 'string' },
  });
}

function conciseSemanticStringContract(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map((child) => conciseSemanticStringContract(child));
  const contracted = Object.fromEntries(Object.entries(schema).map(([key, child]) => [key, conciseSemanticStringContract(child)]));
  if (contracted.type === 'string' && !contracted.enum && contracted.const === undefined) {
    contracted.description = [contracted.description, 'Use one compact semantic statement; do not restate governed evidence, authority, or mechanism text available by ID.'].filter(Boolean).join(' ');
  }
  return contracted;
}

export function buildWbmSemanticSchema({ authorityIds, evidenceIds, missingEvidenceIds, wholePersonClaimIds, wholePersonEvidenceIds, domainIds = WBM_DOMAINS } = {}) {
  const authorityReferenceArray = governedAuthorityReferenceArray(authorityIds);
  const evidenceReferenceArray = governedReferenceArray(evidenceIds, 'PATRICIA_WBM_EVIDENCE_CONTRACT_MISSING', 'PATRICIA_WBM_EVIDENCE_CONTRACT_INVALID');
  const missingEvidenceId = governedReferenceArray(missingEvidenceIds, 'PATRICIA_WBM_MISSING_EVIDENCE_CONTRACT_MISSING', 'PATRICIA_WBM_MISSING_EVIDENCE_CONTRACT_INVALID').items;
  const wholePersonClaimRef = governedReferenceArray(wholePersonClaimIds, 'PATRICIA_WBM_WHOLE_PERSON_CLAIM_CONTRACT_MISSING', 'PATRICIA_WBM_WHOLE_PERSON_CLAIM_CONTRACT_INVALID').items;
  const wholePersonEvidenceReferenceArray = governedReferenceArray(wholePersonEvidenceIds, 'PATRICIA_WBM_WHOLE_PERSON_EVIDENCE_CONTRACT_MISSING', 'PATRICIA_WBM_WHOLE_PERSON_EVIDENCE_CONTRACT_INVALID');
  const domainId = governedReferenceArray(domainIds, 'PATRICIA_WBM_DOMAIN_CONTRACT_MISSING', 'PATRICIA_WBM_DOMAIN_CONTRACT_INVALID').items;
  const missingSchema = closedObject({ missing_id: missingEvidenceId, domain: domainId, question: { type: 'string' }, decision_impact: { type: 'string' } });
  const indicator = closedObject({ indicator: { type: 'string' }, evidence_refs: evidenceReferenceArray });
  return conciseSemanticStringContract(closedObject({
    current_business_reality: { type: 'array', minItems: 1, maxItems: domainIds.length, items: closedObject({ domain_id: domainId, state: { type: 'string' }, evidence_refs: evidenceReferenceArray }) },
    business_model: closedObject({ value_creation: { type: 'string' }, demand_entry: { type: 'string' }, conversion: { type: 'string' }, delivery: { type: 'string' }, value_capture: { type: 'string' }, leverage: { type: 'string' }, concentration: { type: 'string' }, evidence_refs: evidenceReferenceArray }),
    domain_states: { type: 'array', minItems: 1, maxItems: domainIds.length, items: closedObject({
      domain_id: domainId, authority_refs: authorityReferenceArray, epistemic_class: enumValue(EPISTEMIC), claims: { type: 'array', maxItems: 3, items: claimSchema(evidenceReferenceArray) },
      mechanisms: { type: 'array', maxItems: 4, items: { type: 'string', description: 'Reference the exact mechanism_id from causal_model.mechanisms; deterministic assembly verifies or derives this relation from affected_domains.' } }, strengths: { ...stringArray, maxItems: 4 }, failure_modes: { ...stringArray, maxItems: 4 }, interactions: { ...stringArray, maxItems: 4 },
      missing_evidence: { type: 'array', maxItems: missingEvidenceIds.length, items: missingSchema }, abstentions: stringArray,
    }) },
    person_business_synthesis: { type: 'array', maxItems: 6, items: closedObject({
      relationship_id: { type: 'string' }, business_mechanism_ref: { type: 'string', description: 'Copy an exact mechanism_id from causal_model.mechanisms.' }, whole_person_claim_ref: wholePersonClaimRef,
      relationship_type: enumValue(RELATIONSHIPS), business_evidence_refs: evidenceReferenceArray, whole_person_evidence_refs: wholePersonEvidenceReferenceArray,
      alternative_explanations: stringArray, epistemic_class: enumValue(EPISTEMIC), falsifier: { type: 'string' },
      intervention_implications: stringArray, business_cause_established_by_personality: { type: 'boolean', const: false },
    }) },
    team_organizational_synthesis: { type: 'array', maxItems: 0, items: closedObject({}) },
    causal_model: closedObject({
      mechanisms: { type: 'array', minItems: 1, maxItems: 6, items: closedObject({
        mechanism_id: { type: 'string' }, observed_symptom: { type: 'string' }, underlying_mechanism: { type: 'string' }, causal_chain: { type: 'array', minItems: 2, maxItems: 8, items: { type: 'string' } },
        evidence_refs: evidenceReferenceArray, counterevidence_refs: evidenceReferenceArray, confounds: stringArray, delayed_effects: stringArray, feedback_loops: stringArray,
        falsifier: { type: 'string' }, epistemic_class: enumValue(EPISTEMIC), affected_domains: { type: 'array', maxItems: WBM_DOMAINS.length, items: enumValue(WBM_DOMAINS) },
      }) },
      reinforcing_loops: stringArray, balancing_loops: stringArray, compensating_strengths: stringArray, confounds: stringArray,
    }),
    governing_constraint: closedObject({
      constraint_id: { type: 'string' }, constraint_type: enumValue(CONSTRAINTS), candidate: { type: 'string' }, evidence_refs: evidenceReferenceArray,
      alternatives: { type: 'array', maxItems: 3, items: closedObject({ constraint_type: enumValue(CONSTRAINTS), explanation: { type: 'string' }, relative_support: { type: 'string' } }) },
      why_current_candidate_stronger: { type: 'string' }, epistemic_class: enumValue(EPISTEMIC), falsifier: { type: 'string' },
    }),
    assets: { type: 'array', maxItems: 5, items: claimSchema(evidenceReferenceArray) }, vulnerabilities: { type: 'array', maxItems: 5, items: claimSchema(evidenceReferenceArray) },
    momentum: closedObject({
      direction: enumValue(['IMPROVING', 'DETERIORATING', 'STABLE', 'MIXED', 'UNCERTAIN']), emerging_changes: stringArray,
      leading_indicators: { type: 'array', maxItems: 6, items: indicator }, lagging_indicators: { type: 'array', maxItems: 6, items: indicator }, evidence_refs: evidenceReferenceArray,
      epistemic_class: enumValue(EPISTEMIC),
    }),
    epistemic_state: closedObject({
      claim_support: { type: 'array', maxItems: 18, items: closedObject({ claim_id: { type: 'string' }, epistemic_class: enumValue(EPISTEMIC) }) },
      contradictions: { type: 'array', maxItems: 5, items: closedObject({ contradiction_id: { type: 'string' }, evidence_refs: evidenceReferenceArray, status: { type: 'string' }, meaning: { type: 'string' } }) },
      counterevidence: stringArray, missing_evidence: { type: 'array', maxItems: missingEvidenceIds.length, items: missingSchema }, mind_change_conditions: stringArray,
    }),
    open_questions: { type: 'array', maxItems: 5, items: closedObject({ question_id: { type: 'string' }, question: { type: 'string' }, expected_decision_impact: { type: 'string' } }) },
    dynamic_research: { type: 'array', maxItems: 3, items: closedObject({ dynamic_research_warranted: { type: 'boolean', const: true }, research_question: { type: 'string' }, authority: { type: 'string' }, expected_decision_impact: { type: 'string' } }) },
    projection_eligibility: closedObject({
      five_futures_v2: closedObject({ status: enumValue(PROJECTION), reasons: stringArray }),
      one_move_v2: closedObject({ status: enumValue(PROJECTION), reasons: stringArray }),
    }),
    evidence_horizon: { type: 'string' },
  }));
}

function supportSignalsSchema() {
  return closedObject(Object.fromEntries(SUPPORT_COMPONENTS.map((component) => [component.component_id, enumValue(Object.keys(component.levels))])));
}

export function buildFiveFuturesSemanticSchema({ mechanismIds, evidenceIds } = {}) {
  const mechanismReferenceArray = optionalGovernedReferenceArray(mechanismIds, 'PATRICIA_FUTURES_MECHANISM_CONTRACT_MISSING', 'PATRICIA_FUTURES_MECHANISM_CONTRACT_INVALID');
  const evidenceReferenceArray = optionalGovernedReferenceArray(evidenceIds, 'PATRICIA_FUTURES_EVIDENCE_CONTRACT_MISSING', 'PATRICIA_FUTURES_EVIDENCE_CONTRACT_INVALID');
  const futureProperties = (futureRole) => ({
    future_role: { type: 'string', const: futureRole }, future_id: { type: 'string' }, title: { type: 'string' }, state_summary: { type: 'string' }, business_state_if_realized: { type: 'string' },
    governing_mechanisms: { ...mechanismReferenceArray, minItems: 1 }, supporting_evidence_refs: { ...evidenceReferenceArray, minItems: 1 }, counterevidence_refs: evidenceReferenceArray, assumptions: { ...stringArray, minItems: 1 },
    required_changes: stringArray, leading_indicators: { ...stringArray, minItems: 1 }, risks: stringArray, falsifiers: { ...stringArray, minItems: 1 },
    operator_business_interactions: stringArray, team_dependencies: stringArray, dynamic_context_dependencies: stringArray,
    certainty_support_classification: enumValue(FUTURE_CERTAINTY_CLASSES), conditionality: { type: 'string' },
    emergence_evidence: futureRole === 'emerging_future' ? { type: 'boolean', const: true } : { type: 'boolean' }, support_signals: supportSignalsSchema(),
  });
  return closedObject({ futures: { type: 'array', minItems: 5, maxItems: 5, items: { anyOf: FUTURE_ROLES.map((futureRole) => closedObject(futureProperties(futureRole))) } } });
}

function trajectoryIntentSchema(futureRole) {
  return closedObject({ future_role: { type: 'string', const: futureRole }, intent: { type: 'string' }, mechanism_rationale: { type: 'string' } });
}

function selectionSignalsSchema() {
  return closedObject(Object.fromEntries(SELECTION_DIMENSIONS.map((dimension) => [dimension.dimension_id, enumValue(Object.keys(dimension.levels))])));
}

export function buildOneMoveCandidateSchema({ mechanismIds, evidenceIds, personRelationshipIds, scriptIds } = {}) {
  const mechanismReferenceArray = optionalGovernedReferenceArray(mechanismIds, 'PATRICIA_ONE_MOVE_MECHANISM_CONTRACT_MISSING', 'PATRICIA_ONE_MOVE_MECHANISM_CONTRACT_INVALID');
  const evidenceReferenceArray = optionalGovernedReferenceArray(evidenceIds, 'PATRICIA_ONE_MOVE_EVIDENCE_CONTRACT_MISSING', 'PATRICIA_ONE_MOVE_EVIDENCE_CONTRACT_INVALID');
  const scriptReferenceArray = optionalGovernedReferenceArray(scriptIds, 'PATRICIA_ONE_MOVE_SCRIPT_CONTRACT_MISSING', 'PATRICIA_ONE_MOVE_SCRIPT_CONTRACT_INVALID');
  const boundedStatements = (minimum, maximum, mission) => ({
    type: 'array', minItems: minimum, maxItems: maximum,
    items: { type: 'string', description: `One distinct ${mission} statement. Do not restate content owned by another field.` },
  });
  const personConsideration = personRelationshipIds === undefined
    ? closedObject({ relationship_ref: { type: 'string' }, execution_adjustment: { type: 'string' }, business_truth_changed: { type: 'boolean', const: false } })
    : personRelationshipIds.length === 0
      ? closedObject({ relationship_ref: { type: 'string' }, execution_adjustment: { type: 'string' }, business_truth_changed: { type: 'boolean', const: false } })
      : closedObject({ relationship_ref: enumValue(personRelationshipIds), execution_adjustment: { type: 'string' }, business_truth_changed: { type: 'boolean', const: false } });
  const candidate = closedObject({
    candidate_id: { type: 'string' }, title: { type: 'string' }, intervention: { type: 'string' }, why_now: { type: 'string' },
    mechanism_attacked_ids: { ...mechanismReferenceArray, minItems: 1, maxItems: Math.min(2, mechanismReferenceArray.maxItems) }, constraint_relationship: { type: 'string' }, symptom_distinction: { type: 'string' }, causal_chain: boundedStatements(2, 5, 'causal link'),
    supporting_evidence_refs: { ...evidenceReferenceArray, minItems: 1, maxItems: Math.min(4, evidenceReferenceArray.maxItems) }, counterevidence_refs: { ...evidenceReferenceArray, maxItems: Math.min(2, evidenceReferenceArray.maxItems) }, assumptions: boundedStatements(1, 3, 'material assumption'), prerequisites: boundedStatements(1, 3, 'execution prerequisite'),
    execution_burden: { type: 'string' }, execution_definition: { type: 'string' }, bounded_execution_steps: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } },
    owner_role: { type: 'string' }, team_roles: { type: 'array', maxItems: 0, items: { type: 'string' } },
    whole_person_execution_considerations: { type: 'array', maxItems: personRelationshipIds === undefined ? 3 : Math.min(3, personRelationshipIds.length), items: personConsideration },
    leading_indicators: boundedStatements(1, 3, 'leading indicator'), success_evidence: boundedStatements(1, 3, 'success condition'), failure_evidence: boundedStatements(1, 3, 'failure condition'), falsifiers: boundedStatements(1, 2, 'falsifier'), stop_or_reconsider_conditions: boundedStatements(1, 3, 'stop or reconsider condition'),
    observation_horizon: { type: 'string' }, reversibility_class: enumValue(REVERSIBILITY_CLASSES), dependency_burden: enumValue(DEPENDENCY_BURDENS),
    trajectory_effect_intent: { type: 'array', minItems: 5, maxItems: 5, items: { anyOf: FUTURE_ROLES.map((futureRole) => trajectoryIntentSchema(futureRole)) } },
    certainty_support_classification: enumValue(MOVE_CERTAINTY_CLASSES), script_intelligence_refs: { ...scriptReferenceArray, maxItems: Math.min(2, scriptReferenceArray.maxItems) },
    dynamic_research_warrant: { anyOf: [{ type: 'null' }, closedObject({ research_question: { type: 'string' }, authority: { type: 'string' }, expected_decision_impact: { type: 'string' }, dynamic_research_warranted: { type: 'boolean' } })] },
    selection_signals: selectionSignalsSchema(),
  });
  return conciseSemanticStringContract(closedObject({ candidates: {
    type: 'array', minItems: 3, maxItems: 3, items: candidate,
    description: 'Return exactly three serious, non-duplicative intervention candidates. Each candidate must remain semantically complete under the frozen contract.',
  } }));
}

export function normalizeOneMoveCandidateContract(candidates) {
  invariant(Array.isArray(candidates), 'PATRICIA_ONE_MOVE_CANDIDATE_SET_MISSING');
  return Object.freeze(candidates.map((candidate, index) => {
    invariant(Array.isArray(candidate?.trajectory_effect_intent), `PATRICIA_ONE_MOVE_TRAJECTORY_INTENT_MISSING:${index}`);
    const byRole = new Map();
    for (const intent of candidate.trajectory_effect_intent) {
      invariant(FUTURE_ROLES.includes(intent?.future_role), `PATRICIA_ONE_MOVE_UNKNOWN_FUTURE_ROLE:${intent?.future_role}`);
      invariant(!byRole.has(intent.future_role), `PATRICIA_ONE_MOVE_DUPLICATE_FUTURE_ROLE:${intent.future_role}`);
      byRole.set(intent.future_role, intent);
    }
    invariant(byRole.size === FUTURE_ROLES.length, `PATRICIA_ONE_MOVE_INCOMPLETE_FUTURE_ROLE_SET:${index}`);
    return Object.freeze({ ...candidate, trajectory_effect_intent: Object.freeze(FUTURE_ROLES.map((futureRole) => Object.freeze(byRole.get(futureRole)))) });
  }));
}

export function applyOneMoveFieldMissionOwnership(mission) {
  invariant(mission?.mission_id === 'one-move-v2-candidate-generation-v1', 'PATRICIA_ONE_MOVE_FIELD_MISSION_INPUT_INVALID');
  return Object.freeze({
    ...mission,
    doctrine: Object.freeze([
      ...mission.doctrine,
      'Understand the entire governed WBM and all five conditional trajectories before generating any candidate.',
      'Return exactly three materially distinct, serious candidate interventions. Distinctness must come from the intervention or attacked mechanism, never extra prose.',
      'Each candidate field owns one semantic mission. State a fact once and use governed IDs for later references.',
      'Compression removes duplication and misplaced intelligence only; it may not remove causal depth, counterevidence, falsifiers, uncertainty, Whole-Person feasibility, team boundaries, or provenance.',
    ]),
    candidate_count: Object.freeze({ minimum: 3, maximum: 3 }),
    field_missions: Object.freeze({
      intervention_identity: Object.freeze({ owns: ['title', 'intervention', 'why_now'], excludes: ['causal-chain restatement', 'execution-step restatement'] }),
      causal_grounding: Object.freeze({ owns: ['mechanism_attacked_ids', 'constraint_relationship', 'symptom_distinction', 'causal_chain'], excludes: ['evidence prose', 'trajectory summaries'] }),
      epistemic_grounding: Object.freeze({ owns: ['supporting_evidence_refs', 'counterevidence_refs', 'assumptions', 'certainty_support_classification'], excludes: ['copied evidence meaning'] }),
      execution_design: Object.freeze({ owns: ['prerequisites', 'execution_burden', 'execution_definition', 'bounded_execution_steps', 'owner_role', 'team_roles', 'whole_person_execution_considerations'], excludes: ['business-truth override', 'duplicate intervention rationale'] }),
      observation_contract: Object.freeze({ owns: ['leading_indicators', 'success_evidence', 'failure_evidence', 'falsifiers', 'stop_or_reconsider_conditions', 'observation_horizon'], excludes: ['trajectory narration'] }),
      trajectory_relationships: Object.freeze({ owns: ['one distinct directional intent and mechanism rationale for each frozen future role'], excludes: ['probability claims', 'full future restatement'] }),
      authority_and_selection: Object.freeze({ owns: ['script_intelligence_refs', 'dynamic_research_warrant', 'categorical selection_signals'], excludes: ['invented authority IDs', 'numerical scores', 'rank', 'winner'] }),
    }),
  });
}

export function applyWbmFieldMissionOwnership(mission) {
  invariant(mission?.mission_id === 'whole_business_model_construction_v1', 'PATRICIA_WBM_FIELD_MISSION_INPUT_INVALID');
  return Object.freeze({
    ...mission,
    doctrine: Object.freeze([
      ...mission.doctrine,
      'Understand the entire governed business state globally before writing any field.',
      'Each local field owns one distinct semantic mission. Do not repeat the whole-business diagnosis across domains or fields.',
      'Compression removes duplication and misplaced intelligence only; it may not remove causal depth, counterevidence, confounds, falsifiers, uncertainty, missing evidence, authority, or provenance.',
      'Constraint and Causal Dynamics may synthesize across domains. Individual domain states may reference those mechanisms by exact ID but may not reproduce their causal chains.',
    ]),
    field_missions: Object.freeze({
      current_business_reality: Object.freeze({ mission: 'State the minimum current condition for each governed evidence-bearing domain.', belongs: ['domain-specific state', 'business evidence IDs'], elsewhere: ['causal explanations -> causal_model', 'uncertainty -> epistemic_state'], legitimate_cross_references: ['business evidence IDs'], maximum_cardinality: 'one entry per governed evidence-bearing domain' }),
      business_model: Object.freeze({ mission: 'Map value creation, demand entry, conversion, delivery, capture, leverage, and concentration once.', belongs: ['value-flow structure'], elsewhere: ['domain diagnosis -> domain_states', 'cross-domain cause -> causal_model'], legitimate_cross_references: ['business evidence IDs'], maximum_cardinality: 'one object' }),
      domain_states: Object.freeze({ mission: 'Own only domain-local claims, strengths, failures, abstentions, and exact mechanism IDs.', belongs: ['local state claims', 'local missing evidence'], elsewhere: ['causal chains and loops -> causal_model', 'whole-business constraint -> governing_constraint'], legitimate_cross_references: ['authority IDs', 'business evidence IDs', 'causal mechanism IDs'], maximum_cardinality: 'one entry per governed evidence-bearing domain; up to three claims each' }),
      person_business_synthesis: Object.freeze({ mission: 'Represent supported Whole-Person feasibility or interaction effects without creating business facts.', belongs: ['person-business relationship', 'execution implications'], elsewhere: ['business cause -> causal_model'], legitimate_cross_references: ['selected Whole-Person claim IDs', 'Whole-Person evidence IDs', 'business evidence IDs', 'causal mechanism IDs'], maximum_cardinality: 'up to six selected relationships' }),
      causal_model: Object.freeze({ mission: 'Own cross-domain mechanisms, causal chains, feedback loops, delayed effects, confounds, counterevidence, and falsifiers.', belongs: ['cross-domain causal synthesis'], elsewhere: ['local domain state -> domain_states', 'constraint choice -> governing_constraint'], legitimate_cross_references: ['business evidence IDs', 'domain IDs'], maximum_cardinality: 'up to six distinct mechanisms' }),
      governing_constraint: Object.freeze({ mission: 'Name and compare the best-supported governing-constraint candidate without repeating the full causal model.', belongs: ['candidate', 'alternatives', 'relative support', 'falsifier'], elsewhere: ['causal detail -> causal_model'], legitimate_cross_references: ['business evidence IDs'], maximum_cardinality: 'one candidate and up to three alternatives' }),
      assets_and_vulnerabilities: Object.freeze({ mission: 'Capture reusable capacities and material exposures once.', belongs: ['bounded supported claims'], elsewhere: ['domain state -> domain_states', 'causal dynamics -> causal_model'], legitimate_cross_references: ['business evidence IDs'], maximum_cardinality: 'up to five assets and five vulnerabilities' }),
      momentum: Object.freeze({ mission: 'Represent evidenced direction of travel, changes, and indicators without generating trajectories.', belongs: ['direction', 'leading and lagging indicators'], elsewhere: ['trajectory reasoning -> Five Futures V2'], legitimate_cross_references: ['business evidence IDs'], maximum_cardinality: 'up to six leading and six lagging indicators' }),
      epistemic_state: Object.freeze({ mission: 'Own support classes, contradictions, counterevidence, missing evidence, and mind-change conditions.', belongs: ['uncertainty and evidence gaps'], elsewhere: ['domain meaning -> domain_states'], legitimate_cross_references: ['claim IDs', 'business evidence IDs', 'missing-evidence IDs'], maximum_cardinality: 'bounded to distinct decision-relevant items' }),
      projection_eligibility: Object.freeze({ mission: 'Assess whether downstream conditional reasoning is truthfully possible, not whether evidence is perfect.', belongs: ['eligibility status', 'specific disclosure or blocking reasons'], elsewhere: ['actual futures -> Five Futures V2', 'actual intervention selection -> One Move V2'], legitimate_cross_references: ['governing constraint', 'causal mechanisms', 'epistemic state'], doctrine: ['Five Futures V2 may be ELIGIBLE_WITH_DISCLOSURE under thin or missing evidence because its roles remain conditional trajectories.', 'One Move V2 is BLOCKED only when no sufficiently supported mechanism or constraint can responsibly ground candidate generation and deterministic selection.', 'Missing market, team, financial, or longitudinal corroboration must remain disclosed but does not automatically block conditional downstream reasoning.'], maximum_cardinality: 'one status and bounded reasons per downstream purpose' }),
    }),
  });
}

function outputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  return (response?.output || []).flatMap((item) => item?.content || []).filter((item) => item?.type === 'output_text').map((item) => item.text).join('');
}

function modelMatches(requested, returned) {
  return !returned || returned === requested || String(returned).startsWith(`${requested}-`);
}

function usageReceipt(response) {
  return Object.freeze({
    input_tokens: Number(response?.usage?.input_tokens) || 0,
    cached_input_tokens: Number(response?.usage?.input_tokens_details?.cached_tokens) || 0,
    output_tokens: Number(response?.usage?.output_tokens) || 0,
    reasoning_tokens: Number(response?.usage?.output_tokens_details?.reasoning_tokens) || 0,
    total_tokens: Number(response?.usage?.total_tokens) || 0,
  });
}

export function createBoundedOpenAITripletProvider({ apiKey, transport, model = MODEL, maxRetriesPerStage = 0, startingStage = 'whole_business_model_v1' } = {}) {
  invariant(model === MODEL, 'PATRICIA_PROVIDER_MODEL_POLICY_DRIFT');
  invariant(Number.isInteger(maxRetriesPerStage) && maxRetriesPerStage >= 0 && maxRetriesPerStage <= 1, 'PATRICIA_PROVIDER_RETRY_POLICY_DRIFT');
  if (!transport) {
    invariant(apiKey, 'PATRICIA_OPENAI_API_KEY_BINDING_MISSING');
    const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 1_800_000 });
    transport = (request) => client.responses.create(request);
  }
  let submissionCount = 0;
  let acceptedCallCount = 0;
  const expectedStages = ['whole_business_model_v1', 'five_futures_v2', 'one_move_v2'];
  const stageOffset = expectedStages.indexOf(startingStage);
  invariant(stageOffset >= 0, 'PATRICIA_PROVIDER_STARTING_STAGE_INVALID');
  const receipts = [];
  const attemptReceipts = [];
  const stageAttempts = new Map();
  async function call({ stage, mission, schema, schemaName, maxOutputTokens }) {
    invariant(acceptedCallCount < expectedStages.length - stageOffset, 'PATRICIA_PROVIDER_CALL_LIMIT_EXCEEDED');
    invariant(stage === expectedStages[stageOffset + acceptedCallCount], `PATRICIA_PROVIDER_STAGE_ORDER_INVALID:${stage}`);
    const stageAttempt = (stageAttempts.get(stage) || 0) + 1;
    invariant(stageAttempt <= 1 + maxRetriesPerStage, `PATRICIA_PROVIDER_STAGE_RETRY_LIMIT_EXCEEDED:${stage}`);
    stageAttempts.set(stage, stageAttempt);
    const request = Object.freeze({
      model,
      store: false,
      reasoning: Object.freeze({ effort: 'xhigh' }),
      max_output_tokens: maxOutputTokens,
      safety_identifier: sha256Bytes(`${CAMPAIGN_ID}:${PROFILE_ID}:${ASSESSMENT_ID}:${stage}`).slice(0, 32),
      input: Object.freeze([Object.freeze({
        role: 'user',
        content: Object.freeze([Object.freeze({
          type: 'input_text',
          text: [
            `MORE MindMap ${stage} — frozen structured-intelligence runtime.`,
            'Execute the supplied frozen mission exactly. Return structured internal meaning only.',
            'Preserve missing evidence, counterevidence, confounds, falsifiers, conditionality, and epistemic boundaries.',
            'Use only supplied evidence, authority, mechanisms, and identity. Do not invent facts or other people.',
            'For reference fields, copy the exact governed ID from the supplied registry or response-local registry; never substitute its title, meaning, or prose description.',
            'Return compact JSON without indentation or repeated whitespace. State each semantic fact once, then use governed IDs for every later reference instead of restating the meaning.',
            'Use arrays selectively up to their schema bounds. Preserve every material mechanism, counterexample, confound, falsifier, uncertainty, and missing-evidence boundary without duplicating it across fields.',
            'Do not create customer prose, calibrated probabilities, model-authored weights, model-authored scores, rankings, or a winner.',
            'Return only the strict response-schema JSON.',
            '',
            'FROZEN MISSION:',
            JSON.stringify(mission),
          ].join('\n'),
        })]),
      })]),
      text: Object.freeze({
        verbosity: 'low',
        format: Object.freeze({ type: 'json_schema', name: schemaName, strict: true, schema }),
      }),
    });
    submissionCount += 1;
    const startedAt = Date.now();
    try {
      const response = await transport(request);
      const text = outputText(response);
      if (response?.status !== undefined && response.status !== 'completed') {
        const error = Object.assign(new Error(`PATRICIA_PROVIDER_${String(response.status).toUpperCase()}:${stage}`), {
          code: `PATRICIA_PROVIDER_${String(response.status).toUpperCase()}`,
          provider_terminal: Object.freeze({
            status: response.status,
            incomplete_details_reason: response?.incomplete_details?.reason || null,
            usage: usageReceipt(response),
            max_output_tokens: maxOutputTokens,
            response_output_sha256: text ? sha256Bytes(text) : null,
            response_id_hash: response?.id ? sha256Bytes(response.id) : null,
          }),
        });
        throw error;
      }
      invariant(modelMatches(model, response?.model), `PATRICIA_PROVIDER_MODEL_SUBSTITUTION:${stage}`);
      invariant(text, `PATRICIA_PROVIDER_EMPTY_OUTPUT:${stage}`);
      let parsed;
      try { parsed = JSON.parse(text); } catch { throw Object.assign(new Error(`PATRICIA_PROVIDER_INVALID_JSON:${stage}`), { code: 'PATRICIA_PROVIDER_INVALID_JSON' }); }
      const receipt = Object.freeze({
        stage,
        call_number: acceptedCallCount + 1,
        submission_number: submissionCount,
        stage_attempt: stageAttempt,
        requested_model: model,
        returned_model: response?.model || null,
        store: false,
        reasoning_effort: 'xhigh',
        sdk_retries: 0,
        campaign_retries: stageAttempt - 1,
        request_sha256: stableHash(request),
        response_output_sha256: sha256Bytes(text),
        provider_request_id_hash: response?._request_id ? sha256Bytes(response._request_id) : null,
        provider_response_id_hash: response?.id ? sha256Bytes(response.id) : null,
        latency_ms: Date.now() - startedAt,
        usage: usageReceipt(response),
        raw_request_persisted: false,
        raw_response_persisted: false,
      });
      acceptedCallCount += 1;
      receipts.push(receipt);
      attemptReceipts.push(Object.freeze({ ...receipt, status: 'ACCEPTED_PROVIDER_RESPONSE' }));
      return Object.freeze({ parsed, receipt, request });
    } catch (error) {
      attemptReceipts.push(Object.freeze({
        stage,
        submission_number: submissionCount,
        stage_attempt: stageAttempt,
        status: 'FAILED_BEFORE_PROVIDER_RESPONSE_ACCEPTANCE',
        request_sha256: stableHash(request),
        request_id_hash: error?.transport_trace?.request_id_hash || (error?.request_id ? sha256Bytes(error.request_id) : null),
        response_id_hash: error?.transport_trace?.response_id_hash || null,
        error_code: error?.code || error?.name || 'PROVIDER_FAILURE',
        terminal_status: error?.provider_terminal?.status || null,
        incomplete_details_reason: error?.provider_terminal?.incomplete_details_reason || null,
        usage: error?.provider_terminal?.usage || null,
        max_output_tokens: error?.provider_terminal?.max_output_tokens || maxOutputTokens,
        response_output_sha256: error?.provider_terminal?.response_output_sha256 || null,
        provider_response_id_hash: error?.provider_terminal?.response_id_hash || null,
        latency_ms: Date.now() - startedAt,
        raw_request_persisted: false,
        raw_response_persisted: false,
      }));
      throw error;
    }
  }
  return Object.freeze({
    call,
    callCount: () => submissionCount,
    acceptedCallCount: () => acceptedCallCount,
    receipts: () => Object.freeze([...receipts]),
    attemptReceipts: () => Object.freeze([...attemptReceipts]),
  });
}

export function createStreamingOpenAITransport({ apiKey, client } = {}) {
  if (!client) {
    invariant(apiKey, 'PATRICIA_OPENAI_API_KEY_BINDING_MISSING');
    client = new OpenAI({ apiKey, maxRetries: 0, timeout: 1_800_000 });
  }
  const traces = [];
  async function transport(request) {
    const trace = {
      submission_initiated: true,
      request_id_hash: null,
      response_id_hash: null,
      response_created_observed: false,
      terminal_event: null,
      terminal_status: null,
      incomplete_details_reason: null,
      usage: null,
      stream: true,
      store: request.store,
    };
    traces.push(trace);
    try {
      const { data: stream, request_id: requestId } = await client.responses.create({ ...request, stream: true }).withResponse();
      if (requestId) trace.request_id_hash = sha256Bytes(requestId);
      let terminalResponse = null;
      for await (const event of stream) {
        if (event?.type === 'response.created') {
          trace.response_created_observed = true;
          if (event.response?.id) trace.response_id_hash = sha256Bytes(event.response.id);
        }
        if (['response.completed', 'response.failed', 'response.incomplete'].includes(event?.type)) {
          trace.terminal_event = event.type;
          trace.terminal_status = event.response?.status || null;
          trace.incomplete_details_reason = event.response?.incomplete_details?.reason || null;
          trace.usage = usageReceipt(event.response);
          if (event.response?.id) trace.response_id_hash = sha256Bytes(event.response.id);
          terminalResponse = event.response;
        }
      }
      invariant(terminalResponse, 'PATRICIA_PROVIDER_STREAM_MISSING_TERMINAL_RESPONSE');
      Object.defineProperty(terminalResponse, '_request_id', { value: requestId || null, enumerable: false });
      return terminalResponse;
    } catch (error) {
      error.transport_trace = Object.freeze({ ...trace });
      throw error;
    }
  }
  return Object.freeze({
    transport,
    traces: () => Object.freeze(traces.map((trace) => Object.freeze({ ...trace }))),
  });
}

function refsSubset(values, allowed, code) {
  for (const value of values || []) invariant(allowed.has(value), `${code}:${value}`);
}

function mechanismSemanticKey(value) {
  return String(value || '').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function mechanismReferenceResolver(mechanisms) {
  const mechanismsById = new Map();
  const semanticKeys = new Map();
  for (const mechanism of mechanisms) {
    invariant(typeof mechanism?.mechanism_id === 'string' && mechanism.mechanism_id.length > 0, 'PATRICIA_WBM_MECHANISM_ID_MISSING');
    invariant(!mechanismsById.has(mechanism.mechanism_id), `PATRICIA_WBM_DUPLICATE_MECHANISM_ID:${mechanism.mechanism_id}`);
    mechanismsById.set(mechanism.mechanism_id, mechanism);
    const values = [mechanism.mechanism_id, mechanism.observed_symptom, mechanism.underlying_mechanism, ...(mechanism.causal_chain || [])];
    for (const value of values) {
      const key = mechanismSemanticKey(value);
      if (!key) continue;
      if (!semanticKeys.has(key)) semanticKeys.set(key, new Set());
      semanticKeys.get(key).add(mechanism.mechanism_id);
    }
  }
  function resolve(value) {
    if (mechanismsById.has(value)) return value;
    const matches = [...(semanticKeys.get(mechanismSemanticKey(value)) || [])];
    return matches.length === 1 ? matches[0] : null;
  }
  return Object.freeze({ mechanismsById, resolve });
}

export function assembleWbmCandidate(semantic, context) {
  const evidenceIds = new Set(context.business_evidence.map((item) => item.evidence_id));
  const authorityIds = new Set(context.selection_receipt.selected_authority_ids);
  const wholePersonIds = new Set(context.frozen_whole_person_authority.selected_claims.map((item) => item.claim_id));
  invariant(Array.isArray(semantic.current_business_reality), 'PATRICIA_WBM_SEMANTIC_REALITY_MISSING');
  const mechanisms = semantic.causal_model?.mechanisms || [];
  const mechanismResolver = mechanismReferenceResolver(mechanisms);
  const mechanismIds = new Set(mechanismResolver.mechanismsById.keys());
  const domainStates = (semantic.domain_states || []).map((state) => {
    refsSubset(state.authority_refs, authorityIds, 'PATRICIA_WBM_UNKNOWN_AUTHORITY_REF');
    for (const claim of state.claims || []) {
      refsSubset(claim.evidence_refs, evidenceIds, 'PATRICIA_WBM_UNKNOWN_EVIDENCE_REF');
      refsSubset(claim.counterevidence_refs, evidenceIds, 'PATRICIA_WBM_UNKNOWN_COUNTEREVIDENCE_REF');
    }
    const explicitlyResolved = (state.mechanisms || []).map((value) => mechanismResolver.resolve(value));
    const derivedFromAffectedDomains = mechanisms.filter((mechanism) => (mechanism.affected_domains || []).includes(state.domain_id)).map((mechanism) => mechanism.mechanism_id);
    const normalizedMechanisms = explicitlyResolved.every(Boolean)
      ? explicitlyResolved
      : [...explicitlyResolved.filter(Boolean), ...derivedFromAffectedDomains];
    invariant(normalizedMechanisms.every((value) => mechanismIds.has(value)), `PATRICIA_WBM_UNKNOWN_MECHANISM_REF:${state.domain_id}`);
    return Object.freeze({ ...state, mechanisms: Object.freeze([...new Set(normalizedMechanisms)]) });
  });
  const personBusinessSynthesis = (semantic.person_business_synthesis || []).map((link) => {
    invariant(wholePersonIds.has(link.whole_person_claim_ref), `PATRICIA_WBM_UNKNOWN_WHOLE_PERSON_REF:${link.whole_person_claim_ref}`);
    const businessMechanismRef = mechanismResolver.resolve(link.business_mechanism_ref);
    invariant(businessMechanismRef, `PATRICIA_WBM_UNKNOWN_PERSON_MECHANISM:${link.business_mechanism_ref}`);
    return Object.freeze({ ...link, business_mechanism_ref: businessMechanismRef });
  });
  invariant((semantic.team_organizational_synthesis || []).length === 0, 'PATRICIA_UNAUTHORIZED_TEAM_SYNTHESIS');
  const currentBusinessReality = Object.fromEntries(semantic.current_business_reality.map((item) => [item.domain_id, { state: item.state, evidence_refs: item.evidence_refs }]));
  return Object.freeze({
    contract_id: WBM_CONTRACT_ID,
    contract_version: WBM_CONTRACT_VERSION,
    schema_version: WBM_SCHEMA_VERSION,
    assessment_identity: Object.freeze({
      business_id: context.assessment_identity.business_id,
      assessment_id: context.assessment_identity.assessment_id,
      owner_profile_id: context.assessment_identity.owner_profile_id,
      vertical: context.assessment_identity.vertical,
    }),
    frozen_whole_person_authority: Object.freeze({
      profile_id: context.frozen_whole_person_authority.profile_id,
      bos_version: context.frozen_whole_person_authority.bos_version,
      bos_hash: context.frozen_whole_person_authority.bos_hash,
      selected_claim_refs: context.frozen_whole_person_authority.selected_claims.map((item) => item.claim_id),
    }),
    source_integrity: Object.freeze({
      context_hash: context.context_hash,
      authority_hashes: context.selection_receipt.authority_hashes,
      evidence_refs: context.business_evidence.map((item) => item.evidence_id),
      dynamic_refs: context.dynamic_intelligence.map((item) => item.dynamic_id),
    }),
    authority_receipts: Object.freeze([context.selection_receipt]),
    governed_business_evidence: Object.freeze(context.business_evidence.map((item) => Object.freeze({ evidence_ref: item.evidence_id }))),
    current_business_reality: Object.freeze(currentBusinessReality),
    business_model: semantic.business_model,
    domain_states: Object.freeze(domainStates),
    person_business_synthesis: Object.freeze(personBusinessSynthesis),
    team_organizational_synthesis: Object.freeze([]),
    causal_model: semantic.causal_model,
    governing_constraint: semantic.governing_constraint,
    assets: semantic.assets,
    vulnerabilities: semantic.vulnerabilities,
    momentum: semantic.momentum,
    epistemic_state: semantic.epistemic_state,
    open_questions: semantic.open_questions,
    dynamic_research: semantic.dynamic_research,
    projection_eligibility: semantic.projection_eligibility,
    state_lineage: Object.freeze({ state_version: 1, prior_state: null, created_at: context.selection_receipt.created_at, evidence_horizon: semantic.evidence_horizon, input_hash: context.input_receipt.input_hash }),
    downstream_contributions: Object.freeze({
      five_futures_v2: Object.freeze({ roles: FIVE_FUTURES_V2_ROLES, state_fields: Object.freeze(['momentum', 'emerging_changes', 'constraints', 'assets', 'vulnerabilities', 'causal_mechanisms', 'evidence', 'counterevidence', 'missing_evidence', 'operator_business_interactions', 'team_context', 'dynamic_context']), trajectories_generated: false, weights_computed: false }),
      one_move_v2: Object.freeze({ state_fields: Object.freeze(['governing_constraint', 'causal_mechanisms', 'falsifiers', 'operator_business_interactions', 'leading_indicators']), candidates_ranked: false, move_selected: false }),
    }),
    runtime_boundaries: LATER_RUNTIME_BOUNDARIES,
  });
}

export function assertProjectionEligible(model) {
  for (const purpose of ['five_futures_v2', 'one_move_v2']) {
    invariant(['ELIGIBLE', 'ELIGIBLE_WITH_DISCLOSURE'].includes(model.projection_eligibility?.[purpose]?.status), `PATRICIA_WBM_${purpose.toUpperCase()}_BLOCKED`);
  }
}

export function assertNoCrossProfileContamination(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  const prohibited = ['mm-20260617-ybnwt0ks', 'mm-20260531-asovnjz4', 'amber d corrow-scott', '"wally"', '"amber"'];
  const found = prohibited.filter((token) => serialized.includes(token));
  invariant(found.length === 0, 'PATRICIA_CROSS_PROFILE_CONTAMINATION', found);
  return Object.freeze({ status: 'PASS', prohibited_token_count: prohibited.length, findings: Object.freeze([]) });
}

export function sanitizeError(error, stage, callCount) {
  return Object.freeze({
    schema: 'more.patricia.canonical_triplet.failure.v1',
    verdict: 'PATRICIA_CANONICAL_BA_TRIPLET_V1_STOPPED_FAIL_CLOSED',
    failed_at: new Date().toISOString(),
    failed_stage: stage,
    provider_calls_made: callCount,
    error_code: error?.code || String(error?.message || 'UNKNOWN_FAILURE').split(':')[0],
    error_message: String(error?.message || 'UNKNOWN_FAILURE').replace(/sk-[A-Za-z0-9_-]+/gu, '[REDACTED]'),
    automatic_retry_authorized: false,
    customer_mutation: false,
    production_mutation: false,
  });
}

export function scanSecretPatterns(files) {
  const patterns = [
    /\bsk-[A-Za-z0-9_-]{20,}\b/gu,
    /OPENAI_API_KEY\s*=\s*[^\s]+/gu,
    /\b(?:redis|rediss):\/\/[^\s"']+/giu,
    /\b(?:whsec|rk_live|sk_live)_[A-Za-z0-9_-]+\b/gu,
  ];
  const findings = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    patterns.forEach((pattern, index) => {
      pattern.lastIndex = 0;
      if (pattern.test(text)) findings.push({ file, pattern: index + 1 });
    });
  }
  return Object.freeze(findings);
}

export function validateStrictSchemaShape(schema, trail = '$') {
  if (!schema || typeof schema !== 'object') return true;
  if (schema.type === 'object') {
    invariant(schema.additionalProperties === false, `PATRICIA_SCHEMA_OPEN_OBJECT:${trail}`);
    const keys = Object.keys(schema.properties || {});
    invariant(keys.every((key) => schema.required.includes(key)), `PATRICIA_SCHEMA_OPTIONAL_PROPERTY:${trail}`);
  }
  for (const [key, child] of Object.entries(schema)) {
    if (child && typeof child === 'object') validateStrictSchemaShape(child, `${trail}.${key}`);
  }
  return true;
}

export function canonicalArtifactRecord(repositoryRoot, filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(repositoryRoot, filePath);
  const bytes = fs.readFileSync(absolute);
  return Object.freeze({ path: path.relative(path.join(repositoryRoot, TRIPLET_ROOT), absolute), bytes: bytes.length, sha256: sha256Bytes(bytes) });
}

export function writePrivateJson(filePath, value, { exclusive = true } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: exclusive ? 'wx' : 'w' });
  fs.chmodSync(filePath, 0o600);
}

export function writePrivateText(filePath, value, { exclusive = true } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, value, { mode: 0o600, flag: exclusive ? 'wx' : 'w' });
  fs.chmodSync(filePath, 0o600);
}

export function zipEntries(zipPath) {
  const result = spawnSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  invariant(result.status === 0, 'PATRICIA_ZIP_INTEGRITY_FAILED');
  return result.stdout.split('\n').filter(Boolean);
}

export function verifyZip(zipPath, expectedRecords) {
  const test = spawnSync('unzip', ['-tqq', zipPath], { encoding: 'utf8' });
  invariant(test.status === 0, 'PATRICIA_ZIP_TEST_FAILED');
  const entries = zipEntries(zipPath);
  invariant(new Set(entries).size === entries.length, 'PATRICIA_ZIP_DUPLICATE_ENTRIES');
  const expectedByPath = new Map(expectedRecords.map((record) => [`MORE_MINDMAP_PATRICIA_CANONICAL_BA_TRIPLET_V1/${record.path}`, record]));
  invariant(entries.length === expectedByPath.size, 'PATRICIA_ZIP_ENTRY_COUNT_DRIFT');
  for (const entry of entries) {
    const record = expectedByPath.get(entry);
    invariant(record, `PATRICIA_ZIP_UNEXPECTED_ENTRY:${entry}`);
    const extracted = spawnSync('unzip', ['-p', zipPath, entry], { encoding: null, maxBuffer: 64 * 1024 * 1024 });
    invariant(extracted.status === 0, `PATRICIA_ZIP_ENTRY_READ_FAILED:${entry}`);
    invariant(extracted.stdout.length === record.bytes && sha256Bytes(extracted.stdout) === record.sha256, `PATRICIA_ZIP_ENTRY_HASH_DRIFT:${entry}`);
  }
  return Object.freeze({ status: 'PASS', entry_count: entries.length, duplicate_entries: 0, zip_sha256: sha256Bytes(fs.readFileSync(zipPath)) });
}

export function nullableStringSchema() {
  return nullableString;
}

export { QUESTION_AUTHORITY };
