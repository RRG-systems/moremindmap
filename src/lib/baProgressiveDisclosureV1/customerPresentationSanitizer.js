const INTERNAL_REFERENCE_TOKEN_SOURCE = String.raw`\b[A-Z][A-Z0-9]{0,7}-[A-Z]{0,4}\d{1,4}\b`;
const INTERNAL_REFERENCE_SEQUENCE = new RegExp(
  `${INTERNAL_REFERENCE_TOKEN_SOURCE}(?:\\s*,\\s*(?:and|or)?\\s*${INTERNAL_REFERENCE_TOKEN_SOURCE}|\\s+(?:and|or|through|to)\\s+${INTERNAL_REFERENCE_TOKEN_SOURCE}|\\s*[–—-]\\s*${INTERNAL_REFERENCE_TOKEN_SOURCE})+`,
  'gu',
);
const INTERNAL_REFERENCE_TOKEN = new RegExp(INTERNAL_REFERENCE_TOKEN_SOURCE, 'gu');
const TECHNICAL_REFERENCE_LABEL = /\b(?:PB|WPC|BE|CM|M)\s+refs?\b/giu;
const FUTURE_ROLE_BY_ID = Object.freeze({
  'FFV2-01': 'the Current Course',
  'FFV2-02': 'the Emerging Future',
  'FFV2-03': 'the Better Future',
  'FFV2-04': 'the Bold Future',
  'FFV2-05': 'the Downside Future',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function referenceTokens(value) {
  return String(value).match(new RegExp(INTERNAL_REFERENCE_TOKEN_SOURCE, 'gu')) || [];
}

function referenceKind(tokens) {
  const prefixes = tokens.map((token) => token.split('-')[0]);
  if (prefixes.every((prefix) => ['M', 'CM'].includes(prefix))) return 'business_mechanism';
  if (prefixes.every((prefix) => ['BE', 'R', 'D', 'ACC', 'OPS', 'CON', 'G', 'CAP'].includes(prefix))) return 'business_evidence';
  if (prefixes.every((prefix) => ['PB', 'WPC'].includes(prefix))) return 'whole_person_evidence';
  if (prefixes.every((prefix) => prefix === 'ME')) return 'missing_evidence';
  return 'governed_evidence';
}

function referenceDescription(value) {
  const tokens = referenceTokens(value);
  if (tokens.length === 1 && FUTURE_ROLE_BY_ID[tokens[0]]) return FUTURE_ROLE_BY_ID[tokens[0]];
  const plural = tokens.length > 1 || /\b(?:through|to)\b/iu.test(value);
  switch (referenceKind(tokens)) {
    case 'business_mechanism': return plural ? 'the governed business mechanisms' : 'the governed business mechanism';
    case 'business_evidence': return 'the governed business evidence';
    case 'whole_person_evidence': return 'the governed Whole-Person evidence';
    case 'missing_evidence': return 'the required missing evidence';
    default: return 'the governed evidence';
  }
}

function isReferenceOnly(value) {
  const tokens = referenceTokens(value);
  if (!tokens.length) return false;
  const residue = String(value)
    .replace(new RegExp(INTERNAL_REFERENCE_TOKEN_SOURCE, 'gu'), '')
    .replace(/\b(?:and|or|through|to)\b/giu, '')
    .replace(/[\s,;:.()[\]{}–—-]/gu, '');
  return residue === '';
}

function referenceOnlyExplanation(value) {
  switch (referenceKind(referenceTokens(value))) {
    case 'business_mechanism': return 'This conclusion is supported by the governed business mechanism.';
    case 'business_evidence': return 'This conclusion is supported by governed business evidence.';
    case 'whole_person_evidence': return 'This execution consideration is supported by governed Whole-Person evidence.';
    case 'missing_evidence': return 'Required evidence is still missing for this conclusion.';
    default: return 'This conclusion is supported by governed evidence.';
  }
}

const CUSTOMER_ENUM_LABELS = Object.freeze({
  EVIDENCE_BOUND: 'Evidence-bound',
  STRONGLY_SUPPORTED: 'Strong support',
  SUPPORTED_HYPOTHESIS: 'Supported hypothesis',
  SUPPORTED_INTERVENTION_HYPOTHESIS: 'Supported intervention hypothesis',
  MODERATE_RELATIVE_SUPPORT: 'Moderate relative support',
  HIGH_RELATIVE_SUPPORT: 'High relative support',
  LOW_MODERATE: 'Low-to-moderate support',
  MODERATE_HIGH: 'Moderate-to-high support',
});

function humanizeLeadingCustomerEnum(value) {
  return value.replace(/^([A-Z]{2,}(?:_[A-Z]{2,})+)(?=\s*(?:\u00b7|$))/u, (match) => (
    CUSTOMER_ENUM_LABELS[match]
      || match.toLowerCase().replaceAll('_', ' ').replace(/^./u, (letter) => letter.toUpperCase())
  ));
}

function repairMissingClauseSubjects(value) {
  return value
    .replace(/\bif\s+(?:and|or)\s+/giu, 'if ')
    .replace(/;\s+(has|have|had)\b/gu, '; accepted evidence $1')
    .replace(/;\s+(may|might|could|would|can|should)\b/gu, '; the modeled change $1')
    .replace(/;\s+(?:remain|remains)\b/gu, '; material questions remain')
    .replace(/;\s+(lack|lacks)\b/gu, '; accepted evidence $1')
    .replace(/\bonly if establish\b/gu, 'only if accepted evidence establishes')
    .replace(/\buntil resolves\b/gu, 'until the governing business mechanism resolves')
    .replace(/\bthe required missing evidence resolve\b/giu, 'the required missing evidence resolves')
    .replace(/\bthe required missing evidence do not\b/giu, 'the required missing evidence does not')
    .replace(/\bthe required missing evidence are required\b/giu, 'the required missing evidence is required')
    .replace(/\bthe governed business evidence (?:provide|co-occur)\b/giu, (match) => match.replace(/provide$/iu, 'provides').replace(/co-occur$/iu, 'co-occurs'))
    .replace(/\bGoverned evidence show\b/gu, 'Governed evidence shows')
    .replace(/\bprevents from independently establishing\b/giu, 'prevents the current assessment from independently establishing')
    .replace(/\bchanges implied by\.\s*$/giu, 'the proposed changes.')
    .replace(/\bTeam synthesis requires both and the required missing evidence\.?/giu, 'Team synthesis requires additional governed team evidence.')
    .replace(/\bcould change and momentum\.?/giu, 'could change the current interpretation and momentum assessment.')
    .replace(/\bcould revise\.\s*$/giu, 'could revise the current interpretation.')
    .replace(/^have convergent operator evidence; still prevents bottleneck confirmation\.?$/iu, 'Governed business mechanisms have convergent operator evidence, but missing evidence still prevents bottleneck confirmation.');
}

function repairMissingSubject(value) {
  if (/^(?:the|accepted|governed|material|new)\b/u.test(value)) return `${value[0].toUpperCase()}${value.slice(1)}`;
  if (/^Requires\b/u.test(value)) return `This trajectory requires${value.slice('Requires'.length)}`;
  if (/^Conditional on (?:persisting|remaining|resolving|changing|improving|worsening)\b/u.test(value)) {
    return value.replace(/^Conditional on /u, 'Conditional on the governing business mechanism ');
  }
  if (/^persists\b/u.test(value)) return `The governing business mechanism ${value}`;
  if (/^(?:is|are|was|were)\b/u.test(value)) return `The governing business mechanism ${value}`;
  if (/^(?:lack|lacks)\b/u.test(value)) return `Accepted evidence ${value}`;
  if (/^recur\b/u.test(value)) return `The governed business mechanisms ${value}`;
  if (/^recurs\b/u.test(value)) return `The governed business mechanism ${value}`;
  if (/^(?:has|have|had) not\b/u.test(value)) return `Accepted evidence ${value}`;
  if (/^do not\b/u.test(value)) return `Governed evidence ${value.replace(/^do not\b/u, 'does not')}`;
  if (/^does not\b/u.test(value)) return `Governed evidence ${value}`;
  if (/^reports\b/u.test(value)) return `Governed evidence ${value}`;
  if (/^explains\b/u.test(value)) return `Governed evidence ${value}`;
  if (/^records\b/u.test(value)) return `Governed records ${value.slice('records'.length).trimStart()}`;
  if (/^is not\b/u.test(value)) return `The current interpretation ${value}`;
  if (/^(?:could|would|may|might|can|should)\b/u.test(value)) return `New governed evidence ${value}`;
  if (/^(?:show|shows|establish|establishes|indicate|indicates|demonstrate|demonstrates|confirm|confirms|disprove|disproves|resolve|resolves|support|supports|change|changes|reclassify|reclassifies|replace|replaces|authorize|authorizes|move|moves|reconcile|reconciles)\b/u.test(value)) {
    const [verb] = value.match(/^\S+/u);
    const singular = {
      show: 'shows',
      establish: 'establishes',
      indicate: 'indicates',
      demonstrate: 'demonstrates',
      confirm: 'confirms',
      disprove: 'disproves',
      resolve: 'resolves',
      support: 'supports',
      change: 'changes',
      reclassify: 'reclassifies',
      replace: 'replaces',
      authorize: 'authorizes',
      move: 'moves',
      reconcile: 'reconciles',
    }[verb] || verb;
    return `Governed evidence ${singular}${value.slice(verb.length)}`;
  }
  if (/^remain\b/u.test(value)) return `Material questions ${value}`;
  if (/^remains\b/u.test(value)) return `Material uncertainty ${value}`;
  if (/^have\b/u.test(value)) return `Governed business evidence ${value.replace(/^have\b/u, 'has')}`;
  if (/^has\b/u.test(value)) return `Governed business evidence ${value}`;
  if (/^still prevents\b/u.test(value)) return `Missing evidence ${value}`;
  if (/^prevents from\b/u.test(value)) return `Accepted counterevidence prevents the current signal from${value.slice('prevents from'.length)}`;
  return value;
}

export function sanitizeCustomerPresentationString(value) {
  const original = String(value || '').replace(/\s+/gu, ' ').trim();
  if (!original) return '';
  if (isReferenceOnly(original)) return referenceOnlyExplanation(original);

  const sanitized = humanizeLeadingCustomerEnum(original)
    .replace(/\bEVIDENCE_BOUND\b/gu, 'Evidence-bound')
    .replace(/\b(?:PB|WPC)\s+refs?\b/giu, 'governed Whole-Person evidence')
    .replace(/\bBE\s+refs?\b/giu, 'governed business evidence')
    .replace(/\b(?:M|CM)\s+refs?\b/giu, 'governed business mechanisms')
    .replace(/\b(governed (?:Whole-Person|business) evidence) do not\b/giu, '$1 does not')
    .replace(INTERNAL_REFERENCE_SEQUENCE, (match) => referenceDescription(match))
    .replace(INTERNAL_REFERENCE_TOKEN, (match) => referenceDescription(match))
    .replace(/\bConditional on remaining\b/giu, 'Conditional on the governing business mechanism remaining')
    .replace(/;\s+is not\b/giu, '; the current interpretation is not')
    .replace(/\bfalsify and identify\b/giu, 'falsify the current diagnosis and identify')
    .replace(/\bcould resolve and materially revise\s*\./giu, 'could resolve the uncertainty and materially revise the current view.')
    .replace(/\bmaterially revise\s*\./giu, 'materially revise the current view.')
    .replace(/\.\s+(changes?)\b/gu, ' $1')
    .replace(/\s+([,.;:!?])/gu, '$1')
    .replace(/\s{2,}/gu, ' ')
    .replace(/^\s*(?:,|;|:|and|or)\s*/iu, '')
    .trim();

  const repaired = repairMissingSubject(repairMissingClauseSubjects(sanitized));
  if (!repaired || new RegExp(INTERNAL_REFERENCE_TOKEN_SOURCE, 'u').test(repaired) || TECHNICAL_REFERENCE_LABEL.test(repaired)) {
    return 'No customer-safe explanation is available for this section.';
  }
  return repaired;
}

function repairPresentationCollisions(viewModel) {
  const realities = viewModel?.destinations?.where?.realities;
  if (!Array.isArray(realities)) return viewModel;

  const seen = new Set();
  realities.forEach((reality) => {
    const normalized = String(reality?.text || '').replace(/\s+/gu, ' ').trim().toLowerCase();
    if (!normalized || !seen.has(normalized)) {
      if (normalized) seen.add(normalized);
      return;
    }

    if (reality?.title !== 'Owner Dependence') return;
    const governedConstraint = String(viewModel?.destinations?.move?.logic?.[0]?.value || '').trim();
    const constraintKey = governedConstraint.replace(/\s+/gu, ' ').toLowerCase();
    if (!governedConstraint || constraintKey === normalized) return;

    reality.text = governedConstraint;
    const object = viewModel?.objects?.[reality.objectId];
    if (object?.display_payload) object.display_payload.value = governedConstraint;
    seen.add(constraintKey);
  });
  return viewModel;
}

const STRUCTURAL_FIELD = /^(?:id|objectId|object_id|inspectorId|inspector_id|role|status|tone|type|version|contract_id|epistemicClass|epistemic_class|sourceRef|source_ref|sourceAuthority|source_authority|return_state_id|statement_id|destination|surface|drawerType|drawer_type)$/u;
const STRUCTURAL_COLLECTION_FIELD = /(?:Id|_id|Ids|_ids|Refs|_refs)$/u;

function isStructuralField(key) {
  return STRUCTURAL_FIELD.test(String(key || '')) || STRUCTURAL_COLLECTION_FIELD.test(String(key || ''));
}

function sanitizeValue(value, key = '') {
  if (typeof value === 'string') return isStructuralField(key) ? value : sanitizeCustomerPresentationString(value);
  if (Array.isArray(value)) {
    const sanitizedItems = value.map((item) => sanitizeValue(item, key)).filter((item) => item !== '');
    return sanitizedItems.every((item) => typeof item !== 'object') ? [...new Set(sanitizedItems)] : sanitizedItems;
  }
  if (value && typeof value === 'object') {
    const sanitized = Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, sanitizeValue(child, childKey)]));
    if (Array.isArray(sanitized.items) && sanitized.items.length === 0) {
      sanitized.items = ['No customer-safe explanation is available for this section.'];
    }
    return sanitized;
  }
  return value;
}

export function buildCustomerSafePresentationViewModel(viewModel) {
  if (!viewModel || typeof viewModel !== 'object') throw new Error('new_ba_customer_presentation_view_model_required');
  return deepFreeze(repairPresentationCollisions(sanitizeValue(structuredClone(viewModel))));
}
