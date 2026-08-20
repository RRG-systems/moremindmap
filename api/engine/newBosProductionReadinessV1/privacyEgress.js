const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PROFILE_PATTERN = /\bMM-[A-Z0-9-]+\b/giu;
const PHONE_PATTERN = /(?<!\w)(?:\+?1[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}(?!\w)/gu;
const IDENTITY_FIELD_PATTERN = /(?:^|_)(?:display_name|first_name|last_name|full_name|person_name|preferred_name|given_name|middle_name|family_name|legal_name|maiden_name|nickname|email|profile_id|customer_id|external_id|subject_token|alias|aliases|identity_label|customer_label|profile_label|username|handle)(?:$|_)/iu;
const COMMON_WORD_NAME_COMPONENTS = new Set([
  'amber', 'april', 'august', 'autumn', 'faith', 'grace', 'hope', 'hunter', 'joy',
  'june', 'mason', 'may', 'parker', 'rose', 'summer', 'will',
]);

export const PROVIDER_SAFE_REASONING_SUBJECT = 'the person';
export const PROVIDER_SAFE_SURFACE_SUBJECT = 'the customer';

function escaped(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function identityToken(value, kind, match = 'phrase_ci') {
  const normalized = String(value || '').trim();
  if (normalized.length < 2) return null;
  return Object.freeze({ value: normalized, kind, match });
}

function normalizeToken(token) {
  if (typeof token === 'string') return identityToken(token, 'legacy_identity');
  if (!token || typeof token !== 'object') return null;
  return identityToken(token.value, token.kind || 'identity', token.match || 'phrase_ci');
}

function normalizedTokens(tokens = []) {
  const seen = new Set();
  return tokens.map(normalizeToken).filter(Boolean).filter((token) => {
    const key = `${token.match}:${token.value.toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => right.value.length - left.value.length);
}

function tokenPattern(token) {
  const body = escaped(token.value);
  const wordBounded = token.match === 'word_ci' || token.match === 'word_cs';
  return new RegExp(wordBounded ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body, token.match.endsWith('_cs') ? 'gu' : 'giu');
}

function tokenPresent(text, token) {
  return tokenPattern(token).test(text);
}

function replacementFor(token) {
  if (token.kind === 'organization') return 'the organization';
  if (token.kind === 'email' || token.kind === 'email_local') return 'a private contact detail';
  if (token.kind.includes('identifier') || token.kind === 'subject_token') return 'the internal profile';
  return PROVIDER_SAFE_REASONING_SUBJECT;
}

function identityValues(value, output = [], key = '') {
  if (Array.isArray(value)) {
    value.forEach((item) => identityValues(item, output, key));
    return output;
  }
  if (!value || typeof value !== 'object') {
    if (IDENTITY_FIELD_PATTERN.test(key) && typeof value === 'string') output.push({ key, value });
    return output;
  }
  Object.entries(value).forEach(([childKey, child]) => identityValues(child, output, childKey));
  return output;
}

function nameComponents(value) {
  return String(value || '').split(/[^\p{L}\p{N}'-]+/u).filter((part) => part.length >= 2);
}

function tokenKindForField(key) {
  if (/email/iu.test(key)) return 'email';
  if (/profile_id|customer_id|external_id/iu.test(key)) return 'identifier';
  if (/subject_token/iu.test(key)) return 'subject_token';
  if (/alias/iu.test(key)) return 'name_alias';
  return 'name';
}

export function deriveProviderIdentityTokens(rawEvidence) {
  const identity = rawEvidence?.identity_context || {};
  const tokens = [
    identityToken(rawEvidence?.profile_id, 'identifier'),
    identityToken(rawEvidence?.customer_id, 'identifier'),
    identityToken(rawEvidence?.external_id, 'identifier'),
    identityToken(rawEvidence?.subject_token, 'subject_token'),
    identityToken(identity.organization_context, 'organization'),
  ];
  const values = identityValues({
    profile_id: rawEvidence?.profile_id,
    customer_id: rawEvidence?.customer_id,
    external_id: rawEvidence?.external_id,
    subject_token: rawEvidence?.subject_token,
    identity_context: identity,
  });
  values.forEach(({ key, value }) => {
    const kind = tokenKindForField(key);
    const components = (kind === 'name' || kind === 'name_alias') ? nameComponents(value) : [];
    const singleCommonWordName = components.length === 1
      && COMMON_WORD_NAME_COMPONENTS.has(components[0].toLocaleLowerCase());
    tokens.push(identityToken(value, kind, singleCommonWordName ? 'word_cs' : 'phrase_ci'));
    if (kind === 'email' && value.includes('@')) tokens.push(identityToken(value.split('@')[0], 'email_local'));
    if (kind === 'name' || kind === 'name_alias') {
      components.forEach((component) => tokens.push(identityToken(
        component,
        'name_component',
        COMMON_WORD_NAME_COMPONENTS.has(component.toLocaleLowerCase()) ? 'word_cs' : 'word_ci',
      )));
    }
  });
  return Object.freeze(normalizedTokens(tokens));
}

export function redactProviderText(value, prohibitedTokens = []) {
  let result = String(value ?? '')
    .replace(EMAIL_PATTERN, '[EMAIL_REDACTED]')
    .replace(PROFILE_PATTERN, '[PROFILE_ID_REDACTED]')
    .replace(PHONE_PATTERN, '[PHONE_REDACTED]');
  normalizedTokens(prohibitedTokens).forEach((token) => {
    result = result.replace(tokenPattern(token), '[IDENTITY_REDACTED]');
  });
  return result;
}

export function sanitizeProviderBoundText(value, prohibitedTokens = []) {
  let result = String(value ?? '')
    .replace(EMAIL_PATTERN, 'a private contact detail')
    .replace(PROFILE_PATTERN, 'the internal profile')
    .replace(PHONE_PATTERN, 'a private phone detail');
  normalizedTokens(prohibitedTokens).forEach((token) => {
    result = result.replace(tokenPattern(token), replacementFor(token));
  });
  return result;
}

export function sanitizeProviderBoundValue(value, prohibitedTokens = []) {
  if (typeof value === 'string') return sanitizeProviderBoundText(value, prohibitedTokens);
  if (Array.isArray(value)) return Object.freeze(value.map((item) => sanitizeProviderBoundValue(item, prohibitedTokens)));
  if (!value || typeof value !== 'object') return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    sanitizeProviderBoundValue(item, prohibitedTokens),
  ])));
}

export function buildProviderSafeSurfaceInput(input, prohibitedTokens = []) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('new_bos_surface_provider_input_invalid');
  }
  const sanitized = sanitizeProviderBoundValue(input, prohibitedTokens);
  return Object.freeze({
    ...sanitized,
    person: Object.freeze({
      subject: PROVIDER_SAFE_SURFACE_SUBJECT,
      relevant_context: sanitized.person?.relevant_context || null,
    }),
  });
}

export function buildPseudonymousReasoningPacket(rawEvidence, prohibitedTokens = deriveProviderIdentityTokens(rawEvidence)) {
  const identity = rawEvidence.identity_context || {};
  const packet = {
    subject: PROVIDER_SAFE_REASONING_SUBJECT,
    evidence_scope: 'governed_assessment_self_report_and_canonical_score_priors',
    identity_context: {
      role: identity.role || null,
      organization_context: identity.organization_context ? 'the organization' : null,
    },
    scores: rawEvidence.scores,
    questions: rawEvidence.questions.map((item, index) => ({
      evidence_id: `q${String(index + 1).padStart(2, '0')}`,
      question: item.question_text,
      exact_answer: item.exact_answer == null ? '' : item.exact_answer,
      response_type: item.response_type,
    })),
    evidence: rawEvidence.evidence.map((item) => ({
      evidence_id: item.evidence_id,
      epistemic_class: item.epistemic_class,
      statement: item.statement,
      question: item.question || null,
    })),
    uncertainties: rawEvidence.uncertainties,
    abstentions: rawEvidence.abstentions,
    contradictions: rawEvidence.contradictions || [],
    counterevidence: rawEvidence.counterevidence || [],
    confounds: rawEvidence.confounds || [],
    falsifiers: rawEvidence.falsifiers || [],
  };
  return sanitizeProviderBoundValue(packet, prohibitedTokens);
}

export function inspectProviderPrivacy(value, prohibitedTokens = []) {
  const serialized = JSON.stringify(value);
  const failures = [];
  if (EMAIL_PATTERN.test(serialized)) failures.push('email_present');
  EMAIL_PATTERN.lastIndex = 0;
  if (PROFILE_PATTERN.test(serialized)) failures.push('profile_id_present');
  PROFILE_PATTERN.lastIndex = 0;
  if (PHONE_PATTERN.test(serialized)) failures.push('phone_present');
  PHONE_PATTERN.lastIndex = 0;
  normalizedTokens(prohibitedTokens).forEach((token) => {
    if (tokenPresent(serialized, token)) failures.push(`prohibited_identity_present:${token.kind}`);
  });
  return Object.freeze({ valid: failures.length === 0, failures: Object.freeze(failures) });
}

export { EMAIL_PATTERN, PHONE_PATTERN, PROFILE_PATTERN };
