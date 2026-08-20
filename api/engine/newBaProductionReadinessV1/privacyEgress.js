const PROHIBITED_IDENTITY_KEYS = /^(?:full_name|first_name|last_name|person_name|preferred_name|given_name|middle_name|family_name|legal_name|maiden_name|nickname|email|phone|address|owner_profile_name)$/iu;
const PROHIBITED_TEXT = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?<!\w)(?:\+?1[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}(?!\w))/iu;

function inspect(value, path, findings) {
  if (Array.isArray(value)) return value.forEach((child, index) => inspect(child, [...path, index], findings));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && PROHIBITED_TEXT.test(value)) findings.push({ path: path.join('.'), code: 'DIRECT_CONTACT_IDENTITY' });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (PROHIBITED_IDENTITY_KEYS.test(key) && String(child || '').trim()) findings.push({ path: [...path, key].join('.'), code: 'PROHIBITED_IDENTITY_FIELD' });
    inspect(child, [...path, key], findings);
  }
}

export function validateBaProviderEgressPayload(payload) {
  const findings = [];
  inspect(payload, [], findings);
  if (findings.length) {
    const error = new Error('new_ba_privacy_egress_rejected');
    error.findings = findings;
    throw error;
  }
  if (payload?.store !== false) throw new Error('new_ba_provider_store_false_required');
  return Object.freeze({ status: 'PASS', store: false, prohibited_identity_findings: 0 });
}
