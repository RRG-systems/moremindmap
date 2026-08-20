import { deepFreeze } from '../../intelligenceFabric/validation.js';

const SECRET = /(?:sk-[A-Za-z0-9_-]{16,}|OPENAI_API_KEY|authorization\s*:\s*bearer|cookie\s*:)/iu;
const INTERNAL_REFERENCE = /\b(?:ME-[A-Z]?\d{2}|(?:UK|RE|PS)-\d{2}|(?:subject|membership|tenant|profile|business|artifact|evidence|rsl|proposal|decision|state_packet|living_twin)_[A-Za-z0-9_-]+|[a-f0-9]{64})\b/iu;
const PERSONALITY_CAUSE = /(?:because|caused by|due to|the reason is)\s+(?:of\s+)?(?:your\s+)?(?:personality|enneagram|disc|mbti|human design|personality dna)/iu;
const CLINICAL_OR_PROTECTED = /\b(?:diagnosed with|clinical diagnosis|diagnosis of (?:a )?(?:mental|psychiatric)|mental disorder|iq score|intelligence quotient|bipolar|autis(?:m|tic)|adhd|clinical depression|anxiety disorder)\b/iu;
const FALSE_MUTATION = /\b(?:i(?:'ve| have)?|we(?:'ve| have)?|more has)\s+(?:updated|saved|changed|published|recorded|added)\s+(?:your|the)\s+(?:map|business twin|plan|evidence|future|one move)\b/iu;

export function validateCatastrophicIntegrityV2({ message, mutation_performed = false, denied_customer_terms = [], contradicted_claims = [] }) {
  const failures = [];
  if (typeof message !== 'string' || !message.trim()) failures.push('MALFORMED_CUSTOMER_MESSAGE');
  if (SECRET.test(message || '')) failures.push('SECRET_OR_CREDENTIAL_LEAKAGE');
  if (INTERNAL_REFERENCE.test(message || '')) failures.push('INTERNAL_ID_SCHEMA_OR_HASH_LEAKAGE');
  if (PERSONALITY_CAUSE.test(message || '')) failures.push('PERSONALITY_AS_BUSINESS_CAUSE');
  if (CLINICAL_OR_PROTECTED.test(message || '')) failures.push('CLINICAL_PROTECTED_OR_IQ_CLAIM');
  if (!mutation_performed && FALSE_MUTATION.test(message || '')) failures.push('FALSE_DURABLE_MUTATION_CLAIM');
  for (const term of denied_customer_terms) {
    if (typeof term === 'string' && term.trim() && String(message || '').toLowerCase().includes(term.trim().toLowerCase())) {
      failures.push('CROSS_CUSTOMER_SCOPE_LEAKAGE');
      break;
    }
  }
  for (const claim of contradicted_claims) {
    if (typeof claim === 'string' && claim.trim() && String(message || '').toLowerCase().includes(claim.trim().toLowerCase())) {
      failures.push('CONTRADICTED_FACT_PRESENTED_AS_CANONICAL');
      break;
    }
  }
  return deepFreeze({ valid: failures.length === 0, failures, qualitative_style_policing: false });
}
