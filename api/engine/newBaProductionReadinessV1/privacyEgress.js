import { inspectLoanOriginatorPrivacyBoundary } from '../../../src/lib/baVerticalCassettesV1/loanOriginatorEvidence.js';

const PROHIBITED_IDENTITY_KEYS = /^(?:full_name|first_name|last_name|person_name|preferred_name|given_name|middle_name|family_name|legal_name|maiden_name|nickname|email|phone|address|owner_profile_name)$/iu;
const PROHIBITED_TEXT = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?<!\w)(?:\+?1[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}(?!\w))/iu;
const PROHIBITED_SSN = /(?:\b\d{3}-\d{2}-\d{4}\b|\b(?:ssn|social[ -]security(?:[ -]number)?)\s*(?:is\s*)?[:#= -]?\s*\d{9}\b)/iu;
const PROHIBITED_LOAN_ID = /\b(?:loan|mortgage|account|application|borrower|applicant|customer)\s*(?:number|no\.?|#|id)\s*[:#= -]?\s*[A-Z0-9][A-Z0-9-]{3,}\b/iu;
const PROHIBITED_EXACT_ADDRESS = /\b\d{1,6}\s+[\p{L}\p{N}][\p{L}\p{N}.'’-]*(?:\s+[\p{L}\p{N}][\p{L}\p{N}.'’-]*){0,5}\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|circle|cir\.?|parkway|pkwy\.?|highway|hwy\.?|place|pl\.?|terrace|ter\.?)\b/iu;
const LOAN_ORIGINATOR_SCOPE = /loan(?:[_-]?originator)/iu;
const LOAN_ORIGINATOR_EVIDENCE_KEYS = new Set([
  'answers',
  'business_evidence',
  'governed_business_evidence',
  'typed_evidence',
]);
const FROZEN_MISSION_MARKER = '\nFROZEN MISSION:\n';
const FROZEN_MISSION_BINDINGS = Object.freeze({
  whole_business_model_v1: Object.freeze({
    schema_name: 'real_profile_whole_business_model_v1',
    mission_id: 'whole_business_model_construction_v1',
  }),
  five_futures_v2: Object.freeze({
    schema_name: 'real_profile_five_futures_v2',
    mission_id: 'five-futures-v2-trajectory-generation',
    context_contract: 'five-futures-v2-wbm-context-v1',
  }),
  one_move_v2: Object.freeze({
    schema_name: 'real_profile_one_move_v2_candidates',
    mission_id: 'one-move-v2-candidate-generation-v1',
    context_contract: 'one-move-v2-governed-context-v1',
  }),
});
const FROZEN_MISSION_INSTRUCTIONS = Object.freeze([
  'Execute the supplied frozen mission exactly. Return structured internal meaning only.',
  'Preserve missing evidence, counterevidence, confounds, falsifiers, conditionality, and epistemic boundaries.',
  'Use only supplied evidence, authority, mechanisms, and identity. Do not invent facts or other people.',
  'For reference fields, copy the exact governed ID from the supplied registry or response-local registry; never substitute its title, meaning, or prose description.',
  'Return compact JSON without indentation or repeated whitespace. State each semantic fact once, then use governed IDs for every later reference instead of restating the meaning.',
  'Use arrays selectively up to their schema bounds. Preserve every material mechanism, counterexample, confound, falsifier, uncertainty, and missing-evidence boundary without duplicating it across fields.',
  'Do not create customer prose, calibrated probabilities, model-authored weights, model-authored scores, rankings, or a winner.',
  'Return only the strict response-schema JSON.',
]);
const DERIVED_CONTEXT_CONTRACT_BY_MISSION = Object.freeze({
  'five-futures-v2-trajectory-generation': 'five-futures-v2-wbm-context-v1',
  'one-move-v2-candidate-generation-v1': 'one-move-v2-governed-context-v1',
});
function parseFrozenProviderMissionText(value, payload) {
  try {
    return JSON.parse(value);
  } catch {
    const markerIndex = value.indexOf(FROZEN_MISSION_MARKER);
    if (markerIndex < 0 || markerIndex !== value.lastIndexOf(FROZEN_MISSION_MARKER)) return null;
    const wrapperLines = value.slice(0, markerIndex).split('\n');
    const stageMatch = /^MORE MindMap ([a-z0-9_]+) — frozen structured-intelligence runtime\.$/u.exec(wrapperLines[0] || '');
    const binding = stageMatch ? FROZEN_MISSION_BINDINGS[stageMatch[1]] : null;
    if (!binding || payload?.text?.format?.name !== binding.schema_name) return null;
    if (wrapperLines.length !== FROZEN_MISSION_INSTRUCTIONS.length + 2 || wrapperLines.at(-1) !== '') return null;
    if (!FROZEN_MISSION_INSTRUCTIONS.every((line, index) => wrapperLines[index + 1] === line)) return null;
    try {
      const missionText = value.slice(markerIndex + FROZEN_MISSION_MARKER.length);
      const mission = JSON.parse(missionText);
      if (JSON.stringify(mission) !== missionText || mission?.mission_id !== binding.mission_id) return null;
      if (binding.context_contract
        && mission?.context?.context_contract !== binding.context_contract) return null;
      return mission;
    } catch {
      return null;
    }
  }
}

function inspectFrozenProviderMissionEnvelopes(value, payload, path, findings) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => inspectFrozenProviderMissionEnvelopes(child, payload, [...path, index], findings));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    const childPath = [...path, key];
    if (key === 'text' && typeof child === 'string'
      && /^MORE MindMap [a-z0-9_]+ — frozen structured-intelligence runtime\./u.test(child)
      && !parseFrozenProviderMissionText(child, payload)) {
      findings.push({ path: childPath.join('.'), code: 'INVALID_FROZEN_MISSION_ENVELOPE' });
    }
    inspectFrozenProviderMissionEnvelopes(child, payload, childPath, findings);
  });
}

function inspectRequiredFactoryEnvelope(payload, findings) {
  if (!Object.hasOwn(payload || {}, 'safety_identifier')) return;
  const texts = (payload?.input || []).flatMap((item) => item?.content || [])
    .filter((item) => item?.type === 'input_text')
    .map((item) => item?.text)
    .filter((text) => typeof text === 'string');
  const exactEnvelope = texts.length === 1
    && /^MORE MindMap [a-z0-9_]+ — frozen structured-intelligence runtime\./u.test(texts[0])
    && texts[0].includes(FROZEN_MISSION_MARKER)
    && parseFrozenProviderMissionText(texts[0], payload);
  if (!exactEnvelope) {
    findings.push({ path: 'input', code: 'REQUIRED_FROZEN_MISSION_ENVELOPE_INVALID' });
  }
}

function inspect(value, path, findings) {
  if (Array.isArray(value)) return value.forEach((child, index) => inspect(child, [...path, index], findings));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && PROHIBITED_TEXT.test(value)) findings.push({ path: path.join('.'), code: 'DIRECT_CONTACT_IDENTITY' });
    if (typeof value === 'string' && PROHIBITED_SSN.test(value)) findings.push({ path: path.join('.'), code: 'SOCIAL_SECURITY_NUMBER' });
    if (typeof value === 'string' && PROHIBITED_LOAN_ID.test(value)) findings.push({ path: path.join('.'), code: 'LOAN_OR_ACCOUNT_IDENTIFIER' });
    if (typeof value === 'string' && PROHIBITED_EXACT_ADDRESS.test(value)) findings.push({ path: path.join('.'), code: 'EXACT_STREET_ADDRESS' });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (PROHIBITED_IDENTITY_KEYS.test(key) && String(child || '').trim()) findings.push({ path: [...path, key].join('.'), code: 'PROHIBITED_IDENTITY_FIELD' });
    inspect(child, [...path, key], findings);
  }
}

function loanOriginatorCustomerEvidence(payload) {
  const strictEvidence = [];
  const derivedContexts = [];
  const seen = new WeakSet();
  function collect(value, key = '') {
    if (LOAN_ORIGINATOR_EVIDENCE_KEYS.has(key)) {
      strictEvidence.push(value);
      return;
    }
    if (typeof value === 'string' && key === 'text') {
      const parsed = parseFrozenProviderMissionText(value, payload);
      if (parsed) collect(parsed);
      return;
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    const expectedContextContract = DERIVED_CONTEXT_CONTRACT_BY_MISSION[value.mission_id];
    if (expectedContextContract) {
      if (value.context?.context_contract === expectedContextContract) {
        derivedContexts.push(value.context);
      }
      seen.add(value);
      Object.entries(value)
        .filter(([childKey]) => childKey !== 'context')
        .forEach(([childKey, child]) => collect(child, childKey));
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) value.forEach((child) => collect(child));
    else Object.entries(value).forEach(([childKey, child]) => collect(child, childKey));
  }
  collect(payload);
  return { strictEvidence, derivedContexts };
}

function mergeLoanOriginatorPrivacyReceipts(receipts) {
  if (!receipts.length) return null;
  const findings = Object.freeze(receipts.flatMap((receipt) => receipt.findings));
  return Object.freeze({
    ...receipts[0],
    status: findings.length ? 'REJECTED' : 'PASS',
    borrower_pii_used: findings.length ? null : false,
    regulated_loan_level_identity_used: findings.length ? null : false,
    rejected_before_use: findings.length > 0,
    inspected_scalar_count: receipts.reduce((total, receipt) => total + receipt.inspected_scalar_count, 0),
    finding_count: findings.length,
    findings,
  });
}

export function validateBaProviderEgressPayload(payload) {
  const findings = [];
  inspect(payload, [], findings);
  inspectFrozenProviderMissionEnvelopes(payload, payload, [], findings);
  inspectRequiredFactoryEnvelope(payload, findings);
  const serialized = JSON.stringify(payload);
  const loanOriginatorScoped = LOAN_ORIGINATOR_SCOPE.test(serialized);
  const scopedEvidence = loanOriginatorScoped
    ? loanOriginatorCustomerEvidence(payload)
    : { strictEvidence: [], derivedContexts: [] };
  const scopedReceipts = [];
  if (loanOriginatorScoped && scopedEvidence.strictEvidence.length) {
    scopedReceipts.push(inspectLoanOriginatorPrivacyBoundary(scopedEvidence.strictEvidence, {
      path: 'provider_payload.customer_evidence',
    }));
  }
  if (loanOriginatorScoped && scopedEvidence.derivedContexts.length) {
    scopedReceipts.push(inspectLoanOriginatorPrivacyBoundary(scopedEvidence.derivedContexts, {
      path: 'provider_payload.derived_context',
      // Governed authority prose is not raw customer evidence. Explicit names,
      // strongly person-shaped subject labels, PII, protected traits and raw
      // communications remain prohibited throughout the complete context.
      detectUnlabeledNames: false,
      detectBareLabeledNames: false,
    }));
  }
  if (loanOriginatorScoped && !scopedReceipts.length) {
    scopedReceipts.push(inspectLoanOriginatorPrivacyBoundary(payload, {
      path: 'provider_payload',
    }));
  }
  const loanOriginatorReceipt = mergeLoanOriginatorPrivacyReceipts(scopedReceipts);
  if (loanOriginatorReceipt?.status === 'REJECTED') {
    loanOriginatorReceipt.findings.forEach((finding) => {
      if (!findings.some((existing) => existing.path === finding.path && existing.code === finding.code)) {
        findings.push({ path: finding.path, code: finding.code });
      }
    });
  }
  if (findings.length) {
    const error = new Error('new_ba_privacy_egress_rejected');
    error.findings = findings;
    if (loanOriginatorReceipt) error.loan_originator_privacy_receipt = loanOriginatorReceipt;
    throw error;
  }
  if (payload?.store !== false) throw new Error('new_ba_provider_store_false_required');
  return Object.freeze({
    status: 'PASS',
    store: false,
    prohibited_identity_findings: 0,
    ...(loanOriginatorReceipt ? { loan_originator_privacy_receipt: loanOriginatorReceipt } : {}),
  });
}
