import {
  LOAN_ORIGINATOR_CASSETTE_MANIFEST_SHA256,
  LOAN_ORIGINATOR_EVIDENCE_CONTRACT_ID,
  LOAN_ORIGINATOR_EVIDENCE_CONTRACT_SHA256,
  LOAN_ORIGINATOR_TYPED_EVIDENCE_REGISTRY,
  LOAN_ORIGINATOR_TYPED_FIELD_COUNT,
} from './loanOriginatorCassette.js';
import { deepFreeze } from './contracts.js';

export const LOAN_ORIGINATOR_EVIDENCE_CLASSES = Object.freeze([
  'OBSERVED',
  'DERIVED',
  'MODELED_REQUIREMENT',
  'BENCHMARK',
  'SCENARIO',
  'MISSING',
]);

export const LOAN_ORIGINATOR_QUESTION_STATES = Object.freeze([
  'ANSWERED',
  'UNANSWERED',
  'NOT_APPLICABLE',
]);

const FORBIDDEN_KEYS = Object.freeze([
  'full_name', 'first_name', 'last_name', 'person_name', 'preferred_name', 'given_name',
  'middle_name', 'family_name', 'legal_name', 'maiden_name', 'nickname',
  'email', 'email_address', 'phone', 'phone_number', 'telephone', 'mobile_phone',
  'address', 'mailing_address', 'home_address', 'residential_address',
  'borrower_name', 'borrower_email', 'borrower_phone', 'borrower_ssn', 'borrower_address',
  'co_borrower_name', 'co_borrower_email', 'co_borrower_phone', 'co_borrower_ssn', 'co_borrower_address',
  'applicant_name', 'applicant_email', 'applicant_phone', 'applicant_ssn', 'applicant_address',
  'customer_name', 'client_name', 'customer_email', 'client_email', 'customer_phone', 'client_phone',
  'customer_ssn', 'client_ssn', 'customer_address', 'client_address',
  'ssn', 'social_security', 'social_security_number', 'dob', 'date_of_birth', 'birth_date', 'birthdate',
  'taxpayer_id', 'tax_id', 'taxpayer_identification_number', 'tin', 'ein', 'employer_identification_number',
  'driver_license', 'drivers_license', 'driver_s_license', 'license_number', 'passport', 'passport_number',
  'state_id', 'government_id', 'government_id_number', 'id_number',
  'borrower_id', 'applicant_id', 'customer_id', 'client_id',
  'loan_number', 'loan_id', 'account_number', 'application_id', 'property_address',
  'routing_number', 'aba_number', 'bank_routing_number', 'bank_account_number',
  'loan_file', 'underwriting_file', 'servicing_file', 'raw_borrower_communication',
  'raw_applicant_communication', 'raw_customer_communication', 'raw_client_communication',
  'credit_score', 'fico_score', 'borrower_income', 'borrower_assets', 'borrower_debts',
  'borrower_dti', 'borrower_ltv', 'protected_class', 'race', 'ethnicity', 'national_origin',
  'religion', 'sex', 'gender', 'sexual_orientation', 'age', 'marital_status', 'family_status', 'familial_status',
  'color', 'veteran_status', 'citizenship_status', 'public_assistance_status',
  'pregnancy', 'pregnancy_status', 'medical_information', 'medical_condition', 'health_information', 'disability',
  'adverse_action_reason', 'eligibility_decision',
  'qualification_decision', 'individual_rate', 'recommended_product', 'crm_contact_list',
]);

const SUBJECT_CONTEXT_KEYS = Object.freeze([
  'borrower', 'applicant', 'client', 'customer', 'prospect', 'mortgagor', 'consumer', 'lead',
  'homebuyer', 'buyer', 'cosigner', 'signer', 'guarantor', 'contact', 'person', 'individual',
  'party', 'participant', 'entity', 'actor',
]);
const SUBJECT_CONTEXT_PREFIX_TOKENS = Object.freeze(['co', 'home', 'loan', 'primary', 'secondary']);
const CONTEXT_CONTAINER_SUFFIX_TOKENS = Object.freeze([
  'detail', 'details', 'record', 'data', 'file', 'form', 'info', 'information', 'profile',
]);
const SUBJECT_CONTEXT_SENSITIVE_KEYS = Object.freeze([
  'name', 'first', 'last', 'first_name', 'last_name', 'full_name', 'person_name', 'email', 'phone', 'address',
  'ssn', 'social_security_number', 'dob', 'date_of_birth', 'birth_date', 'birthdate',
  'id', 'identifier', 'tax_id', 'taxpayer_id', 'tin', 'ein', 'license', 'driver_license',
  'passport', 'income', 'asset', 'debt', 'liability', 'credit_score', 'fico_score', 'dti', 'ltv',
  'account_number', 'routing_number', 'loan_number', 'application_id', 'rate', 'interest_rate',
  'product', 'recommended_product', 'eligibility', 'qualification', 'approval',
]);
const SUBJECT_ROLE_KEYS = Object.freeze([
  'role', 'type', 'subject', 'person', 'party', 'participant', 'entity', 'actor', 'individual',
]);
const DIRECT_PERSON_IDENTITY_LEAF_KEYS = Object.freeze(['name', 'first', 'last', 'surname']);
const IDENTIFIER_CONTEXT_KEYS = Object.freeze([
  'loan', 'mortgage', 'application', 'account', 'bank', 'government', 'birth',
]);
const IDENTIFIER_CONTEXT_SENSITIVE_KEYS = Object.freeze([
  'id', 'identifier', 'key', 'ref', 'reference', 'num', 'number', 'no', 'acct', 'account',
  'routing', 'aba', 'date',
]);
const SUBJECT_TEXT_LABEL_PATTERN = '(?:borrowers?|co[ -]?(?:borrower|applicant|signer)s?|loan[ -]?applicants?|applicants?|customers?|clients?|prospects?|mortgagors?|consumers?|leads?|home[ -]?buyers?|buyers?|cosigners?|guarantors?|contacts?|persons?|individuals?|parties|participants?|entities|actors?)';
const BARE_NAME_SUBJECT_TEXT_LABEL_PATTERN = '(?:borrowers?|co[ -]?(?:borrower|applicant)s?|loan[ -]?applicants?|applicants?|customers?|clients?)';
const PROTECTED_TRAIT_TEXT_PATTERN = '(?:african[ -]american|black|white|asian|hispanic|latino|latina|native[ -]american|american[ -]indian|alaska[ -]native|pacific[ -]islander|mexican|muslim|christian|jewish|hindu|buddhist|male|female|man|woman|nonbinary|transgender|gay|lesbian|bisexual|disabled|pregnant|married|single|widowed|divorced|separated|veteran|citizen|noncitizen)';

const LOAN_ORIGINATOR_PRIVACY_AUTHORITY_ID = 'loan-originator-privacy-compliance-scope-v1';
const LOAN_ORIGINATOR_PRIVACY_RECEIPT_ID = 'loan-originator-aggregate-evidence-privacy-receipt-v1';

const PRIVACY_VALUE_PATTERNS = Object.freeze([
  Object.freeze({
    code: 'DIRECT_EMAIL_IDENTITY',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  }),
  Object.freeze({
    code: 'DIRECT_PHONE_IDENTITY',
    pattern: /(?<!\w)(?:\+?1[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}(?!\w)/u,
  }),
  Object.freeze({
    code: 'SOCIAL_SECURITY_NUMBER',
    pattern: /(?:\b\d{3}[- ]\d{2}[- ]\d{4}\b|\b(?:ssn|social[ -]security(?:[ -]number)?)\s*(?:is\s*)?[:#= -]?\s*(?:\d{9}|\d{3}[- ]\d{2}[- ]\d{4})\b)/iu,
  }),
  Object.freeze({
    code: 'DATE_OF_BIRTH',
    pattern: /\b(?:dob|date[ -]of[ -]birth|birth[ -]?date|birthdate|born(?:[ -]on)?)\s*[:#= -]?\s*(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/iu,
  }),
  Object.freeze({
    code: 'TAXPAYER_IDENTIFIER',
    pattern: /\b(?:taxpayer(?:[ -]identification)?|tax[ -]id|tin|ein|employer[ -]identification)\s*(?:number|no\.?|#|id)?\s*[:#= -]?\s*\d{2}-?\d{7}\b/iu,
  }),
  Object.freeze({
    code: 'GOVERNMENT_OR_LICENSE_IDENTIFIER',
    pattern: /\b(?:driver'?s?[ -]licen[cs]e|passport|state[ -]id|government[ -]id)\b(?:[ \t]*(?:number|no\.?|#|id))?[ \t]*[:#= -][ \t]*[A-Z0-9][A-Z0-9-]{5,}\b/iu,
  }),
  Object.freeze({
    code: 'BANK_OR_ROUTING_IDENTIFIER',
    pattern: /\b(?:bank[ -]account|checking[ -]account|savings[ -]account|routing|aba)\s*(?:number|no\.?|#|id)?\s*[:#= -]?\s*(?:\d{4,17}|\d{3}-\d{3}-\d{3})\b/iu,
  }),
  Object.freeze({
    code: 'EXACT_STREET_ADDRESS',
    pattern: /\b\d{1,6}\s+[\p{L}\p{N}][\p{L}\p{N}.'’-]*(?:\s+[\p{L}\p{N}][\p{L}\p{N}.'’-]*){0,5}\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|circle|cir\.?|parkway|pkwy\.?|highway|hwy\.?|place|pl\.?|terrace|ter\.?)\b/iu,
  }),
  Object.freeze({
    code: 'LOAN_OR_ACCOUNT_IDENTIFIER',
    pattern: /\b(?:loan|mortgage|account|application|borrower|applicant|customer)\s*(?:number|no\.?|#|id)\s*[:#= -]?\s*[A-Z0-9][A-Z0-9-]{3,}\b/iu,
  }),
  Object.freeze({
    code: 'BORROWER_CREDIT_OR_RATIO',
    pattern: /\b(?:fico|credit[ -]score|dti|debt[ -]to[ -]income|ltv|loan[ -]to[ -]value)\s*(?:is|of)?\s*[:= -]?\s*\d{2,3}(?:\.\d+)?%?\b/iu,
  }),
  Object.freeze({
    code: 'BORROWER_FINANCIAL_DETAIL',
    pattern: /\b(?:borrower|co[ -]?borrower|applicant|customer|client)(?:'s)?\s+(?:annual\s+|monthly\s+)?(?:income|assets?|debts?|credit|dti|ltv)\b/iu,
  }),
  Object.freeze({
    code: 'PROTECTED_CLASS_DETAIL',
    pattern: /\b(?:race|ethnicity|religion|sex|gender|age|disability|citizenship|veteran[ -]status|famil(?:y|ial)[ -]status|marital[ -]status)\s*(?:is|was|:)\s*[\p{L}\p{N}]/iu,
  }),
  Object.freeze({
    code: 'PROTECTED_CLASS_DETAIL',
    pattern: /\b(?:borrower|co[ -]?borrower|applicant|customer|client)(?:\s+(?:is|was|identifies[ -]as))?\s+(?:african[ -]american|black|white|asian|hispanic|latino|latina|native[ -]american|american[ -]indian|alaska[ -]native|pacific[ -]islander|mexican|muslim|christian|jewish|hindu|buddhist|male|female|nonbinary|transgender|gay|lesbian|bisexual|disabled|pregnant|married|single|widowed|divorced|separated)\b/iu,
  }),
  Object.freeze({
    code: 'PROTECTED_CLASS_DETAIL',
    pattern: /\b(?:african[ -]american|black|white|asian|hispanic|latino|latina|native[ -]american|american[ -]indian|alaska[ -]native|pacific[ -]islander|mexican|muslim|christian|jewish|hindu|buddhist|male|female|nonbinary|transgender|gay|lesbian|bisexual|disabled|pregnant|married|single|widowed|divorced|separated)\s+(?:borrower|co[ -]?borrower|applicant|customer|client)\b(?:\s+(?:has|with)\s+(?:a\s+)?disabilit(?:y|ies))?/iu,
  }),
  Object.freeze({
    code: 'PROTECTED_CLASS_DETAIL',
    pattern: /\b(?:borrower|co[ -]?borrower|applicant|customer|client)\s+(?:is\s+)?\d{1,3}\s+(?:years?[ -]old|yo)\b/iu,
  }),
  Object.freeze({
    code: 'PROTECTED_CLASS_DETAIL',
    pattern: /\b\d{1,3}[ -]?(?:years?|yrs?)[ -]?old\s+(?:borrower|co[ -]?borrower|applicant|customer|client)\b/iu,
  }),
  Object.freeze({
    code: 'PROTECTED_CLASS_DETAIL',
    pattern: /\b(?:borrower|co[ -]?borrower|applicant|customer|client)\s+(?:has|had|reports?|reported|with)\s+(?:a\s+)?(?:disabilit(?:y|ies)|medical[ -]condition|pregnan(?:t|cy))\b/iu,
  }),
  Object.freeze({
    code: 'PROTECTED_CLASS_DETAIL',
    pattern: new RegExp(String.raw`\b${PROTECTED_TRAIT_TEXT_PATTERN}\s+${SUBJECT_TEXT_LABEL_PATTERN}\b`, 'iu'),
  }),
  Object.freeze({
    code: 'PROTECTED_CLASS_DETAIL',
    pattern: new RegExp(String.raw`\b${SUBJECT_TEXT_LABEL_PATTERN}\s+(?:is|was)\s+(?:not\s+)?(?:a\s+)?(?:citizen|noncitizen|veteran)\b`, 'iu'),
  }),
  Object.freeze({
    code: 'RAW_BORROWER_COMMUNICATION',
    pattern: /\b(?:borrower|co[ -]?borrower|applicant|customer|client)\s+(?:said|wrote|emailed|texted|told\s+me|asked)\b/iu,
  }),
  Object.freeze({
    code: 'INDIVIDUAL_LOAN_DECISION_OR_RECOMMENDATION',
    pattern: /\b(?:borrower|co[ -]?borrower|applicant|customer|client)(?:\s+(?:was|is|has[ -]been|should[ -]be))?\s+(?:approved|denied|eligible|ineligible|qualified|recommended|quoted)\b/iu,
  }),
  Object.freeze({
    code: 'INDIVIDUAL_LOAN_DECISION_OR_RECOMMENDATION',
    pattern: /\b(?:quoted|offered|recommended|steered)\s+(?:to\s+)?(?:the\s+)?(?:borrower|co[ -]?borrower|applicant|customer|client)\b[^\n]{0,80}?\b(?:rate|product|loan|mortgage|approval|qualification)\b/iu,
  }),
]);

const EXPLICIT_PERSON_NAME_PATTERN = new RegExp(String.raw`\b${SUBJECT_TEXT_LABEL_PATTERN}(?:(?:['’]s[ \t]+name(?:[ \t]+is)?)|(?:[ \t]+(?:name(?:[ \t]+is)?|named|is))|(?:[ \t]*[:=][ \t]*)|(?:[ \t]+-[ \t]+))[ \t]*([\p{L}][\p{L}'’-]+(?:[ \t]+[\p{L}][\p{L}'’-]+){0,3})\b`, 'giu');
const BARE_LABELED_PERSON_NAME_PATTERN = new RegExp(String.raw`\b${BARE_NAME_SUBJECT_TEXT_LABEL_PATTERN}[ \t]+([\p{L}][\p{L}'’-]+(?:[ \t]+[\p{L}][\p{L}'’-]+){0,3})\b`, 'giu');
const BARE_NAME_SUBJECT_LABEL_PATTERN = new RegExp(String.raw`\b${BARE_NAME_SUBJECT_TEXT_LABEL_PATTERN}\b`, 'giu');
const STRONG_BARE_PERSON_NAME_SUFFIX_PATTERN = /^[ \t]+([\p{Lu}][\p{L}'’-]+(?:[ \t]+[\p{Lu}][\p{L}'’-]+){1,3})\b/u;
const NAMED_INDIVIDUAL_LOAN_DETAIL_PATTERN = /\b([\p{L}][\p{L}'’-]+(?:\s+[\p{L}][\p{L}'’-]+){0,3})\s+(?:asked|requested|wants?|was[ -](?:quoted|offered|approved|denied|recommended))\b[^\n]{0,80}?\b(?:rate|product|loan|mortgage|approval|qualification)\b/giu;
const POSSIBLE_PERSON_NAME_PATTERN = /\b[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,3}\b/gu;
const SAFE_AGGREGATE_NAME_COMPONENTS = new Set([
  'application', 'approval', 'business', 'communications', 'company', 'counts', 'customer', 'data', 'described', 'direct',
  'evidence', 'explanation', 'from', 'funded', 'ids', 'individual', 'loan', 'loans', 'more', 'mortgage', 'network',
  'none', 'not', 'opportunity', 'originator', 'partner', 'partners', 'past', 'processing', 'profile',
  'professional', 'purchase', 'referral', 'refinance', 'relationship', 'report', 'reported', 'retail',
  'service', 'september', 'shared', 'source', 'stated', 'statement', 'supplied', 'underwriting', 'unknown', 'updates',
  'weekly', 'workload',
]);

function fieldDefinitions() {
  return LOAN_ORIGINATOR_TYPED_EVIDENCE_REGISTRY.screens.flatMap((screen) =>
    screen.fields.map((field) => ({ ...field, mission_id: screen.id, mission_kind: screen.kind })));
}

export const LOAN_ORIGINATOR_FIELD_DEFINITIONS = deepFreeze(fieldDefinitions());
export const LOAN_ORIGINATOR_FIELD_IDS = Object.freeze(LOAN_ORIGINATOR_FIELD_DEFINITIONS.map((field) => field.id));

if (LOAN_ORIGINATOR_FIELD_IDS.length !== LOAN_ORIGINATOR_TYPED_FIELD_COUNT
  || new Set(LOAN_ORIGINATOR_FIELD_IDS).size !== LOAN_ORIGINATOR_TYPED_FIELD_COUNT) {
  throw new Error('loan_originator_typed_evidence_registry_integrity_failure');
}

function hasValue(value) {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u;
const APPLICABILITY_STATES = Object.freeze([
  'APPLICABLE',
  'NOT_APPLICABLE',
  'UNKNOWN',
]);
const EXPLICIT_ROW_SET_STATES = Object.freeze([
  'NONE',
  'NONE_KNOWN',
  'UNKNOWN',
]);

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonBlankString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isReference(value) {
  return isNonBlankString(value) && REFERENCE_PATTERN.test(value);
}

function isCanonicalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isUniqueArray(value, itemValidator) {
  if (!Array.isArray(value) || value.length === 0 || !value.every(itemValidator)) return false;
  return new Set(value.map((item) => JSON.stringify(item))).size === value.length;
}

function isSafeStructuredValue(value, seen = new Set(), depth = 0) {
  if (value === null || typeof value === 'boolean' || isFiniteNumber(value)) return true;
  if (isNonBlankString(value)) return true;
  if (depth >= 12 || !value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  let valid = false;
  if (Array.isArray(value)) {
    valid = value.length > 0
      && Object.keys(value).length === value.length
      && value.every((item) => isSafeStructuredValue(item, seen, depth + 1));
  } else if (isPlainRecord(value)) {
    const entries = Object.entries(value);
    valid = entries.length > 0 && entries.every(([key, nested]) =>
      isNonBlankString(key)
      && !['__proto__', 'prototype', 'constructor'].includes(key)
      && isSafeStructuredValue(nested, seen, depth + 1));
  }
  seen.delete(value);
  return valid;
}

function isStructuredRecord(value) {
  return isPlainRecord(value) && isSafeStructuredValue(value);
}

function hasSemanticKey(value, pattern, validator = () => true) {
  return isPlainRecord(value) && Object.entries(value).some(([key, nested]) => pattern.test(key) && validator(nested));
}

function rangeBounds(value) {
  if (Array.isArray(value) && value.length === 2) return value;
  if (!isPlainRecord(value)) return null;
  for (const [lower, upper] of [
    ['min', 'max'],
    ['minimum', 'maximum'],
    ['low', 'high'],
    ['lower', 'upper'],
    ['from', 'to'],
  ]) {
    if (Object.hasOwn(value, lower) && Object.hasOwn(value, upper)) return [value[lower], value[upper]];
  }
  return null;
}

function isNumericRange(value, { integer = false, nonnegative = false } = {}) {
  const bounds = rangeBounds(value);
  if (!bounds || !isSafeStructuredValue(value)) return false;
  const [lower, upper] = bounds;
  return isFiniteNumber(lower)
    && isFiniteNumber(upper)
    && (!integer || (Number.isInteger(lower) && Number.isInteger(upper)))
    && (!nonnegative || (lower >= 0 && upper >= 0))
    && lower <= upper;
}

function isMetricDefinition(value) {
  return isStructuredRecord(value)
    && hasSemanticKey(value, /^(value|count|amount|metric_value)$/u, isFiniteNumber)
    && hasSemanticKey(value, /^(definition|definition_id|unit)$/u, isNonBlankString);
}

function isMetricWithWindow(value) {
  return isStructuredRecord(value)
    && hasSemanticKey(value, /^(value|count|amount|metric_value)$/u, isFiniteNumber)
    && hasSemanticKey(value, /^(window|window_id|period|period_start|period_end|as_of)$/u,
      (nested) => isNonBlankString(nested) || isStructuredRecord(nested));
}

function isFrequency(value) {
  return isNonBlankString(value) || (isStructuredRecord(value)
    && hasSemanticKey(value, /^(cadence|frequency|interval|period|every|count)$/u,
      (nested) => isNonBlankString(nested) || (isFiniteNumber(nested) && nested >= 0)));
}

function isRatio(value) {
  if (isFiniteNumber(value)) return value >= 0 && value <= 1;
  if (!isStructuredRecord(value)) return false;
  if (hasSemanticKey(value, /^(ratio|rate|value)$/u,
    (nested) => isFiniteNumber(nested) && nested >= 0 && nested <= 1)) return true;
  return isFiniteNumber(value.numerator)
    && isFiniteNumber(value.denominator)
    && value.numerator >= 0
    && value.denominator > 0
    && value.numerator <= value.denominator;
}

function isMetricMap(value) {
  return isStructuredRecord(value) && Object.values(value).every((metric) =>
    isFiniteNumber(metric) || isMetricDefinition(metric) || isMetricWithWindow(metric));
}

function isRowSet(value) {
  return isUniqueArray(value, (row) => isNonBlankString(row) || isStructuredRecord(row));
}

function isCurrencyMetric(value) {
  return isStructuredRecord(value)
    && hasSemanticKey(value, /^(value|amount|metric_value)$/u,
      (nested) => isFiniteNumber(nested) && nested >= 0)
    && hasSemanticKey(value, /^(currency|unit)$/u, isNonBlankString);
}

function isSourceDate(value) {
  if (isCanonicalDate(value)) return true;
  return isStructuredRecord(value)
    && hasSemanticKey(value, /^(date|as_of|captured_at|source_date)$/u, isCanonicalDate)
    && hasSemanticKey(value, /^(source|source_id|provenance)$/u, isNonBlankString);
}

function isValueValidForType(value, valueType) {
  if (valueType.startsWith('enum:')) {
    return isNonBlankString(value) && valueType.slice('enum:'.length).split('|').includes(value);
  }
  if (valueType.startsWith('enum_set:')) {
    const allowed = valueType.slice('enum_set:'.length).split('|');
    return isUniqueArray(value, (item) => typeof item === 'string' && allowed.includes(item));
  }
  switch (valueType) {
    case 'string':
    case 'string_or_role':
    case 'string_or_enum':
      return isNonBlankString(value);
    case 'string_set':
      return isUniqueArray(value, isNonBlankString);
    case 'number':
      return isFiniteNumber(value);
    case 'integer_nonnegative':
      return Number.isInteger(value) && value >= 0;
    case 'currency_nonnegative':
      return isFiniteNumber(value) && value >= 0;
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      return isCanonicalDate(value);
    case 'source_date':
      return isSourceDate(value);
    case 'definition_ref':
    case 'id_ref':
    case 'provenance_ref':
    case 'evidence_ref':
      return isReference(value);
    case 'id_ref_set':
    case 'evidence_ref_set':
      return isUniqueArray(value, isReference);
    case 'evidence_ref_set_or_string':
      return isReference(value) || isUniqueArray(value, isReference);
    case 'number_or_string':
      return isFiniteNumber(value) || isNonBlankString(value);
    case 'integer_nonnegative_or_range':
      return (Number.isInteger(value) && value >= 0)
        || isNumericRange(value, { integer: true, nonnegative: true });
    case 'numeric_range':
      return isNumericRange(value);
    case 'ratio':
      return isRatio(value);
    case 'ratio_or_count':
      return isRatio(value) || (Number.isInteger(value) && value >= 0)
        || (isStructuredRecord(value) && hasSemanticKey(value, /^count$/u,
          (nested) => Number.isInteger(nested) && nested >= 0));
    case 'metric_map':
      return isMetricMap(value);
    case 'metric_definition':
      return isMetricDefinition(value);
    case 'metric_with_window':
      return isMetricWithWindow(value);
    case 'currency_metric':
      return isCurrencyMetric(value);
    case 'frequency':
      return isFrequency(value);
    case 'metric_or_frequency':
      return isMetricDefinition(value) || isFrequency(value);
    case 'metric_or_structured_observation':
      return isMetricDefinition(value) || (isStructuredRecord(value)
        && hasSemanticKey(value, /^(observation|effect|description|result|value)$/u));
    case 'string_enum_map':
      return isStructuredRecord(value) && Object.values(value).every((state) => APPLICABILITY_STATES.includes(state));
    case 'definition_state_map':
      return isStructuredRecord(value) && Object.values(value).every((state) =>
        APPLICABILITY_STATES.includes(state)
        || (isStructuredRecord(state)
          && APPLICABILITY_STATES.includes(state.state)
          && (!Object.hasOwn(state, 'definition_id') || isReference(state.definition_id))));
    case 'row_set':
      return isRowSet(value);
    case 'row_set_or_explicit_none_unknown':
      return EXPLICIT_ROW_SET_STATES.includes(value) || isRowSet(value);
    case 'structured_activity':
      return isStructuredRecord(value)
        && hasSemanticKey(value, /^(activity|action|cadence|frequency|window|period)$/u);
    case 'structured_owner_handoff':
      return isStructuredRecord(value)
        && hasSemanticKey(value, /^(owner|owner_id|owner_role)$/u, isNonBlankString)
        && hasSemanticKey(value, /^(handoff|handoff_to|handoff_from|next_owner|role)$/u,
          (nested) => isNonBlankString(nested) || isStructuredRecord(nested));
    case 'structured_observation':
      return isStructuredRecord(value)
        && hasSemanticKey(value, /^(observation|effect|description|result|value)$/u);
    case 'structured_scope':
      return isStructuredRecord(value)
        && hasSemanticKey(value, /^(scope|subject|subject_scope|purpose|purpose_scope|stage|goal|network)$/u);
    case 'structured_outcome':
      return isStructuredRecord(value)
        && hasSemanticKey(value, /^(outcome|result|description|value)$/u);
    case 'structured_stage_scope':
      return isStructuredRecord(value)
        && hasSemanticKey(value, /^(purpose|purpose_scope|stage|stage_from|stage_to|from|to)$/u);
    case 'structured_economic_terms':
      return isStructuredRecord(value)
        && hasSemanticKey(value, /^(salary|draw|branch|term|basis|amount|value)$/u);
    case 'structured_claim':
      return isStructuredRecord(value)
        && hasSemanticKey(value, /^(claim|statement|value|corrected_value)$/u);
    default:
      return false;
  }
}

function normalizeFieldInput(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)
    && ['value', 'applicability', 'evidence_class', 'provenance', 'confidence', 'definition_id', 'period_or_not_temporal', 'subject_scope', 'contradiction_links']
      .some((key) => Object.hasOwn(raw, key))) return raw;
  return { value: raw };
}

function privacyPath(parent, key) {
  return typeof key === 'number' ? `${parent}[${key}]` : `${parent}.${key}`;
}

function isSensitiveNameCandidate(candidate) {
  return candidate.split(/\s+/u)
    .every((component) => !SAFE_AGGREGATE_NAME_COMPONENTS.has(component.toLowerCase()));
}

function containsUnlabeledPersonName(value) {
  const candidates = value.match(POSSIBLE_PERSON_NAME_PATTERN) || [];
  return candidates.some(isSensitiveNameCandidate);
}

function containsStrongBareLabeledPersonName(value) {
  return [...value.matchAll(BARE_NAME_SUBJECT_LABEL_PATTERN)].some((match) => {
    const suffix = value.slice(match.index + match[0].length);
    const name = STRONG_BARE_PERSON_NAME_SUFFIX_PATTERN.exec(suffix)?.[1];
    return Boolean(name && isSensitiveNameCandidate(name));
  });
}

function containsLabeledPersonName(value, detectBareLabeledNames) {
  if ([...value.matchAll(EXPLICIT_PERSON_NAME_PATTERN)]
    .some((match) => isSensitiveNameCandidate(match[1]))) return true;
  if (containsStrongBareLabeledPersonName(value)) return true;
  return detectBareLabeledNames
    && [...value.matchAll(BARE_LABELED_PERSON_NAME_PATTERN)]
      .some((match) => isSensitiveNameCandidate(match[1]));
}

function containsNamedIndividualLoanDetail(value) {
  return [...value.matchAll(NAMED_INDIVIDUAL_LOAN_DETAIL_PATTERN)]
    .some((match) => isSensitiveNameCandidate(match[1]));
}

function privacyValueFinding(value, detectUnlabeledNames, detectBareLabeledNames) {
  const patternFinding = PRIVACY_VALUE_PATTERNS.find(({ pattern }) => pattern.test(value))?.code;
  if (patternFinding) return patternFinding;
  if (containsNamedIndividualLoanDetail(value)) return 'NAMED_INDIVIDUAL_LOAN_DETAIL';
  if (containsLabeledPersonName(value, detectBareLabeledNames)) return 'BORROWER_OR_CUSTOMER_NAME';
  return detectUnlabeledNames && containsUnlabeledPersonName(value) ? 'POSSIBLE_PERSON_NAME' : null;
}

function normalizePrivacyKey(key) {
  return String(key).replace(/([a-z0-9])([A-Z])/gu, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/gu, '_');
}

function privacyKeyMatchesSemantic(normalized, semantic) {
  return normalized === semantic
    || normalized === `${semantic}s`
    || normalized.startsWith(`${semantic}_`)
    || normalized.endsWith(`_${semantic}`)
    || normalized.includes(`_${semantic}_`);
}

function privacyKeyMatchesAny(normalized, semantics) {
  return semantics.some((semantic) => privacyKeyMatchesSemantic(normalized, semantic));
}

function isSubjectToken(token) {
  return SUBJECT_CONTEXT_KEYS.some((subject) => token === subject || token === `${subject}s`);
}

function isSubjectContextContainerKey(normalized) {
  const tokens = normalized.split('_').filter(Boolean);
  const subjectIndex = tokens.findIndex(isSubjectToken);
  if (subjectIndex < 0) return false;
  return tokens.slice(0, subjectIndex).every((token) => SUBJECT_CONTEXT_PREFIX_TOKENS.includes(token))
    && tokens.slice(subjectIndex + 1).every((token) => CONTEXT_CONTAINER_SUFFIX_TOKENS.includes(token));
}

function isSubjectRoleKey(normalized) {
  return SUBJECT_ROLE_KEYS.includes(normalized)
    || normalized.endsWith('_role')
    || normalized.endsWith('_type');
}

function isForbiddenPrivacyKey(key) {
  return privacyKeyMatchesAny(normalizePrivacyKey(key), FORBIDDEN_KEYS);
}

function identifierContextsForKey(normalizedKey) {
  const tokens = normalizedKey.split('_').filter(Boolean);
  const contexts = [...new Set(tokens.flatMap((token) => IDENTIFIER_CONTEXT_KEYS
    .filter((context) => token === context || token === `${context}s`)))];
  if (!contexts.length) return [];
  const allowed = tokens.every((token) => contexts.includes(token)
    || contexts.some((context) => token === `${context}s`)
    || SUBJECT_CONTEXT_PREFIX_TOKENS.includes(token)
    || isSubjectToken(token)
    || ['active', 'current'].includes(token)
    || CONTEXT_CONTAINER_SUFFIX_TOKENS.includes(token));
  return allowed ? contexts : [];
}

function isSensitiveIdentifierContextKey(normalizedKey, identifierContexts) {
  return identifierContexts.length > 0
    && privacyKeyMatchesAny(normalizedKey, IDENTIFIER_CONTEXT_SENSITIVE_KEYS);
}

function objectHasSubjectRole(entries) {
  return entries.some(([key, child]) => isSubjectRoleKey(normalizePrivacyKey(key))
    && typeof child === 'string'
    && isSubjectContextContainerKey(normalizePrivacyKey(child)));
}

export function inspectLoanOriginatorPrivacyBoundary(value, {
  path = 'loan_originator_evidence',
  detectUnlabeledNames = true,
  detectBareLabeledNames = true,
} = {}) {
  const findings = [];
  const seen = new WeakSet();
  let inspectedScalarCount = 0;

  function inspect(nested, nestedPath, {
    subjectContext = false,
    identifierContexts = [],
  } = {}) {
    if (typeof nested === 'string') {
      inspectedScalarCount += 1;
      const code = privacyValueFinding(nested, detectUnlabeledNames, detectBareLabeledNames);
      if (code) findings.push(Object.freeze({ path: nestedPath, code, source: 'VALUE' }));
      return;
    }
    if (!nested || typeof nested !== 'object') {
      inspectedScalarCount += 1;
      return;
    }
    if (seen.has(nested)) return;
    seen.add(nested);
    const entries = Object.entries(nested);
    const hasSubjectRole = !Array.isArray(nested) && objectHasSubjectRole(entries);
    entries.forEach(([key, child]) => {
      const childPath = privacyPath(nestedPath, Array.isArray(nested) ? Number(key) : key);
      const normalizedKey = normalizePrivacyKey(key);
      if (!Array.isArray(nested)) {
        if (DIRECT_PERSON_IDENTITY_LEAF_KEYS.includes(normalizedKey)) {
          findings.push(Object.freeze({ path: childPath, code: 'PROHIBITED_PERSON_IDENTITY_LEAF', source: 'KEY' }));
        }
        if (isForbiddenPrivacyKey(key)) {
          findings.push(Object.freeze({ path: childPath, code: 'PROHIBITED_BORROWER_FIELD', source: 'KEY' }));
        }
        if ((subjectContext || hasSubjectRole)
          && privacyKeyMatchesAny(normalizedKey, SUBJECT_CONTEXT_SENSITIVE_KEYS)) {
          findings.push(Object.freeze({ path: childPath, code: 'PROHIBITED_SUBJECT_CONTEXT_FIELD', source: 'KEY_CONTEXT' }));
        }
        if (isSensitiveIdentifierContextKey(normalizedKey, identifierContexts)) {
          findings.push(Object.freeze({ path: childPath, code: 'PROHIBITED_IDENTIFIER_CONTEXT_FIELD', source: 'KEY_CONTEXT' }));
        }
      }
      inspect(child, childPath, {
        subjectContext: subjectContext || (!Array.isArray(nested)
          && isSubjectContextContainerKey(normalizedKey)),
        identifierContexts: Array.isArray(nested)
          ? identifierContexts
          : [...new Set([...identifierContexts, ...identifierContextsForKey(normalizedKey)])],
      });
    });
  }

  inspect(value, path);
  const frozenFindings = Object.freeze(findings);
  return deepFreeze({
    contract_id: LOAN_ORIGINATOR_PRIVACY_RECEIPT_ID,
    authority_id: LOAN_ORIGINATOR_PRIVACY_AUTHORITY_ID,
    classification: 'AGGREGATE_BUSINESS_EVIDENCE_ONLY',
    status: frozenFindings.length ? 'REJECTED' : 'PASS',
    borrower_pii_used: frozenFindings.length ? null : false,
    regulated_loan_level_identity_used: frozenFindings.length ? null : false,
    rejected_before_use: frozenFindings.length > 0,
    inspected_scalar_count: inspectedScalarCount,
    finding_count: frozenFindings.length,
    findings: frozenFindings,
  });
}

export function assertLoanOriginatorPrivacyBoundary(value, options = {}) {
  const receipt = inspectLoanOriginatorPrivacyBoundary(value, options);
  if (receipt.status === 'PASS') return receipt;
  const error = new Error(`loan_originator_privacy_boundary_violation:${receipt.findings[0].path}`);
  error.code = 'loan_originator_privacy_boundary_violation';
  error.findings = receipt.findings;
  error.privacy_receipt = receipt;
  throw error;
}

export function normalizeLoanOriginatorTypedEvidence({
  typedEvidence = {},
  requestedQuestionStates = {},
  assessmentId,
  capturedAt = new Date().toISOString(),
} = {}) {
  if (!String(assessmentId || '').trim()) throw new Error('loan_originator_assessment_id_required');
  if (!Number.isFinite(Date.parse(capturedAt))) throw new Error('loan_originator_captured_at_invalid');
  if (!typedEvidence || typeof typedEvidence !== 'object' || Array.isArray(typedEvidence)) {
    throw new Error('loan_originator_typed_evidence_invalid');
  }
  const unknown = Object.keys(typedEvidence).filter((key) => !LOAN_ORIGINATOR_FIELD_IDS.includes(key));
  if (unknown.length) throw new Error(`loan_originator_typed_evidence_unknown_field:${unknown[0]}`);

  const fields = {};
  const questionStates = {};
  for (const screen of LOAN_ORIGINATOR_TYPED_EVIDENCE_REGISTRY.screens) {
    let answered = false;
    const screenNotApplicable = requestedQuestionStates?.[screen.id]?.state === 'NOT_APPLICABLE'
      || requestedQuestionStates?.[screen.id] === 'NOT_APPLICABLE';
    let explicitNotApplicable = screenNotApplicable;
    for (const definition of screen.fields) {
      const input = normalizeFieldInput(typedEvidence[definition.id]);
      const valuePresent = hasValue(input.value);
      const fieldNotApplicable = input.applicability === 'NOT_APPLICABLE' || screenNotApplicable;
      if (fieldNotApplicable && valuePresent) {
        throw new Error(`loan_originator_not_applicable_has_value:${definition.id}`);
      }
      if (valuePresent && !isValueValidForType(input.value, definition.type)) {
        throw new Error(`loan_originator_typed_evidence_value_invalid:${definition.id}`);
      }
      explicitNotApplicable ||= fieldNotApplicable;
      answered ||= valuePresent;
      const evidenceClass = valuePresent
        ? (LOAN_ORIGINATOR_EVIDENCE_CLASSES.includes(input.evidence_class) ? input.evidence_class : 'OBSERVED')
        : 'MISSING';
      fields[definition.id] = deepFreeze({
        field_id: definition.id,
        mission_id: screen.id,
        value: valuePresent ? structuredClone(input.value) : null,
        value_type: definition.type,
        question_state: valuePresent ? 'ANSWERED' : fieldNotApplicable ? 'NOT_APPLICABLE' : 'UNANSWERED',
        evidence_class: evidenceClass,
        provenance: valuePresent ? (input.provenance || 'CUSTOMER_STATED') : 'CUSTOMER_INTAKE_MISSINGNESS',
        confidence: valuePresent ? (input.confidence || 'CUSTOMER_REPORTED') : 'NOT_ESTABLISHED',
        applicability: fieldNotApplicable ? 'NOT_APPLICABLE' : (input.applicability || definition.applicability),
        definition_id: input.definition_id || definition.id,
        period_or_not_temporal: input.period_or_not_temporal || definition.period_rule,
        subject_scope: input.subject_scope || 'CUSTOMER_CONFIRMED_BUSINESS_SCOPE',
        captured_at: capturedAt,
        contradiction_links: Object.freeze(Array.isArray(input.contradiction_links) ? [...input.contradiction_links] : []),
        missing_reason: valuePresent ? null : fieldNotApplicable
          ? 'Customer explicitly marked this evidence as not applicable.'
          : 'Customer did not provide this business evidence.',
      });
    }
    questionStates[screen.id] = deepFreeze({
      state: answered ? 'ANSWERED' : explicitNotApplicable ? 'NOT_APPLICABLE' : 'UNANSWERED',
      reason: answered ? null : explicitNotApplicable
        ? 'Customer explicitly marked this assessment mission as not applicable.'
        : 'Customer did not provide evidence for this assessment mission.',
      evidence_refs: answered
        ? Object.freeze(screen.fields.filter((field) => hasValue(typedEvidence[field.id]?.value ?? typedEvidence[field.id])).map((field) => `business_assessment:${assessmentId}:inputs.typed_evidence.fields.${field.id}`))
        : explicitNotApplicable
          ? Object.freeze([`business_assessment:${assessmentId}:inputs.typed_evidence.question_states.${screen.id}`])
          : Object.freeze([]),
    });
  }

  assertLoanOriginatorPrivacyBoundary(typedEvidence, { path: 'typed_evidence' });
  return deepFreeze({
    contract_id: LOAN_ORIGINATOR_EVIDENCE_CONTRACT_ID,
    contract_version: '1.0.0',
    contract_sha256: LOAN_ORIGINATOR_EVIDENCE_CONTRACT_SHA256,
    cassette_manifest_sha256: LOAN_ORIGINATOR_CASSETTE_MANIFEST_SHA256,
    field_count: LOAN_ORIGINATOR_TYPED_FIELD_COUNT,
    fields,
    question_states: questionStates,
  });
}

export function validateLoanOriginatorTypedEvidence(governedEvidence) {
  if (governedEvidence?.contract_id !== LOAN_ORIGINATOR_EVIDENCE_CONTRACT_ID
    || governedEvidence?.contract_version !== '1.0.0'
    || governedEvidence?.contract_sha256 !== LOAN_ORIGINATOR_EVIDENCE_CONTRACT_SHA256
    || governedEvidence?.cassette_manifest_sha256 !== LOAN_ORIGINATOR_CASSETTE_MANIFEST_SHA256
    || governedEvidence?.field_count !== LOAN_ORIGINATOR_TYPED_FIELD_COUNT) {
    throw new Error('loan_originator_governed_evidence_contract_mismatch');
  }
  assertLoanOriginatorPrivacyBoundary(governedEvidence.fields, { path: 'typed_evidence.fields' });
  const fieldKeys = Object.keys(governedEvidence.fields || {});
  if (fieldKeys.length !== LOAN_ORIGINATOR_TYPED_FIELD_COUNT
    || !LOAN_ORIGINATOR_FIELD_IDS.every((fieldId) => Object.hasOwn(governedEvidence.fields, fieldId))) {
    throw new Error('loan_originator_governed_evidence_field_set_mismatch');
  }
  const missionIds = LOAN_ORIGINATOR_TYPED_EVIDENCE_REGISTRY.screens.map((screen) => screen.id);
  const questionStateKeys = Object.keys(governedEvidence.question_states || {});
  if (questionStateKeys.length !== missionIds.length
    || !missionIds.every((missionId) => Object.hasOwn(governedEvidence.question_states, missionId))) {
    throw new Error('loan_originator_governed_evidence_question_state_set_mismatch');
  }
  for (const definition of LOAN_ORIGINATOR_FIELD_DEFINITIONS) {
    const field = governedEvidence.fields[definition.id];
    if (field?.field_id !== definition.id
      || field.mission_id !== definition.mission_id
      || field.value_type !== definition.type
      || field.definition_id !== definition.id
      || !LOAN_ORIGINATOR_QUESTION_STATES.includes(field.question_state)
      || !LOAN_ORIGINATOR_EVIDENCE_CLASSES.includes(field.evidence_class)
      || !Number.isFinite(Date.parse(field.captured_at))) {
      throw new Error(`loan_originator_governed_evidence_field_invalid:${definition.id}`);
    }
    if (field.question_state === 'ANSWERED') {
      if (!hasValue(field.value)
        || field.evidence_class === 'MISSING'
        || !isValueValidForType(field.value, definition.type)) {
        throw new Error(`loan_originator_governed_evidence_answered_field_invalid:${definition.id}`);
      }
    } else if (field.value !== null || field.evidence_class !== 'MISSING') {
      throw new Error(`loan_originator_governed_evidence_missing_field_invalid:${definition.id}`);
    }
    if (field.question_state === 'NOT_APPLICABLE' && field.applicability !== 'NOT_APPLICABLE') {
      throw new Error(`loan_originator_governed_evidence_applicability_invalid:${definition.id}`);
    }
    if (!Array.isArray(field.contradiction_links)) {
      throw new Error(`loan_originator_governed_evidence_contradiction_links_invalid:${definition.id}`);
    }
  }
  for (const screen of LOAN_ORIGINATOR_TYPED_EVIDENCE_REGISTRY.screens) {
    const fields = screen.fields.map((definition) => governedEvidence.fields[definition.id]);
    const expectedState = fields.some((field) => field.question_state === 'ANSWERED')
      ? 'ANSWERED'
      : fields.some((field) => field.question_state === 'NOT_APPLICABLE')
        ? 'NOT_APPLICABLE'
        : 'UNANSWERED';
    if (governedEvidence.question_states[screen.id]?.state !== expectedState) {
      throw new Error(`loan_originator_governed_evidence_question_state_invalid:${screen.id}`);
    }
  }
  return governedEvidence;
}

export function projectLoanOriginatorEvidenceForWbm(governedEvidence) {
  validateLoanOriginatorTypedEvidence(governedEvidence);
  const missionDomains = {
    LO_CORE_01_BUSINESS_SCOPE: 'stage', LO_CORE_02_PRIMARY_GOAL: 'goals', LO_CORE_03_PRODUCTION_WINDOWS: 'financial',
    LO_CORE_04_PURPOSE_APPLICABILITY: 'market', LO_CORE_05_OPPORTUNITY_SOURCE_NETWORK: 'demand', LO_CORE_06_CUSTOMER_RELATIONSHIP_NETWORK: 'relationship',
    LO_CORE_07_OPPORTUNITY_FUNNEL: 'pipeline', LO_CORE_08_RELATIONSHIP_SYSTEMS: 'operations', LO_CORE_09_TEAM_CAPACITY: 'capacity',
    LO_CORE_10_PLATFORM_CAPABILITY: 'operations', LO_CORE_11_OPERATOR_DIAGNOSIS: 'constraints', LO_CORE_12_ACCOUNTABILITY_EXECUTION: 'accountability',
    LO_COND_13_CONVERSION_FALLOUT_CYCLE: 'conversion', LO_COND_14_ECONOMICS: 'financial', LO_COND_15_CONTRADICTION_CLARIFICATION: 'dynamic_context',
  };
  const evidence = [];
  for (const field of Object.values(governedEvidence.fields || {})) {
    if (field.question_state === 'ANSWERED') {
      evidence.push(deepFreeze({
        evidence_id: `lo:${field.mission_id}:${field.field_id}`,
        // Intake values remain customer statements at the WBM boundary. Their
        // richer LO evidence class is retained as provenance; a model or
        // benchmark supplied by the customer must never masquerade as a
        // MORE-authored deterministic calculation.
        evidence_class: 'OPERATOR_REPORTED',
        source_evidence_class: field.evidence_class,
        domain: missionDomains[field.mission_id],
        value: structuredClone(field.value),
        source_ref: `business_assessment.inputs.typed_evidence.fields.${field.field_id}`,
        confidence: field.confidence,
      }));
    }
  }
  return Object.freeze(evidence);
}
