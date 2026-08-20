import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';

const forbiddenKeys = new Set(['subject_id', 'membership_id', 'tenant_id', 'profile_id', 'business_id', 'provider_subject', 'email', 'phone', 'stripe_customer_id', 'stripe_subscription_id', 'raw_transcript']);
const secretPattern = /(?:sk-[A-Za-z0-9_-]{16,}|OPENAI_API_KEY|authorization\s*:\s*bearer|cookie\s*:)/iu;
const personalityCausePattern = /(?:because|caused by|due to)\s+(?:your\s+)?(?:personality|enneagram|disc|mbti|human design)/iu;

function scan(value, path, failures) {
  if (typeof value === 'string') {
    if (secretPattern.test(value)) failures.push({ code: 'SECRET_OR_CREDENTIAL_DENIED', path });
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) failures.push({ code: 'RAW_IDENTITY_OR_PRIVATE_FIELD_DENIED', path: `${path}.${key}` });
    scan(child, `${path}.${key}`, failures);
  }
}

export function createMinimizedCoachingPacket({ state_packet, doctrine_retrieval, customer_turn, vertical_context = null, external_evidence = [], history = [] }) {
  const failures = [];
  if (!state_packet?.packet_hash) failures.push({ code: 'VALIDATED_STATE_PACKET_REQUIRED', path: '$.state_packet' });
  if (!doctrine_retrieval?.retrieval_hash) failures.push({ code: 'DOCTRINE_RETRIEVAL_REQUIRED', path: '$.doctrine_retrieval' });
  const packet = {
    state_packet_hash: state_packet?.packet_hash,
    purpose: state_packet?.purpose,
    active_lens: state_packet?.active_lens,
    artifact_lineage: (state_packet?.artifact_lineage || []).map((item) => ({ artifact_type: item.artifact_type, content_hash: item.content_hash })),
    business_truth: state_packet?.business_truth || [],
    whole_person_execution_context: state_packet?.whole_person_execution_context || [],
    uncertainty: state_packet?.uncertainty || [],
    current_state: state_packet?.current_state || {},
    relevant_history: history.slice(-20).map(({ role, content }) => ({ role, content })),
    intelligence_layers: {
      universal_kernel: doctrine_retrieval?.layers?.universal_kernel || [],
      vertical_cassette: doctrine_retrieval?.layers?.vertical_cassette || [],
      customer_governed_reality: { business_evidence_refs: (state_packet?.business_truth || []).map((item) => item.evidence_id), whole_person_execution_refs: (state_packet?.whole_person_execution_context || []).map((item) => item.evidence_id) },
      personal_rsl: { retrieval_hash: state_packet?.personal_rsl_retrieval_hash, selected_history_count: history.length },
      vertical_context,
    },
    external_evidence: external_evidence.map((item) => ({ external_evidence_id: item.external_evidence_id, purpose: item.purpose, source_title: item.source_title, source_url: item.source_url, citation: item.citation, retrieved_at: item.retrieved_at, content_hash: item.content_hash })),
    customer_turn,
  };
  scan(packet, '$', failures);
  return failures.length ? deepFreeze({ ok: false, code: 'PRIVACY_MEMBRANE_REJECTED', failures }) : deepFreeze({ ok: true, code: 'MINIMIZED_COACHING_PACKET_CREATED', packet, packet_hash: hashCanonicalJson(packet) });
}

export function validateCustomerLanguage(message) {
  const failures = [];
  if (typeof message !== 'string' || !message.trim()) failures.push('CUSTOMER_MESSAGE_EMPTY');
  if (/\b(?:UK|RE|PS)-\d{2}\b|(?:universal_kernel|vertical_cassette|canonical_artifact|personal_rsl|external_evidence):/u.test(message || '')) failures.push('INTERNAL_REFERENCE_LEAKAGE');
  if (/\b(?:KNOWN|INFERRED|MODELED|CONTRADICTED|UNCERTAIN|MISSING)\b/u.test(message || '')) failures.push('ENUM_STYLE_LABEL_LEAKAGE');
  if (personalityCausePattern.test(message || '')) failures.push('PERSONALITY_AS_BUSINESS_CAUSE');
  if (secretPattern.test(message || '')) failures.push('SECRET_OR_CREDENTIAL_DENIED');
  return deepFreeze({ valid: failures.length === 0, failures });
}
