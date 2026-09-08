import { sha256Stable } from '../newBosProductionReadinessV1/realizationIdentity.js';
import { CATASTROPHIC_PROHIBITED_ASSERTION_PATTERNS, INTERNAL_CUSTOMER_LANGUAGE } from '../../../src/lib/newBosPersonalityDnaV1/truthValidator.js';
import { INTAKE_VERSION, QUESTIONS, MISSINGNESS, EVENT_QUESTION_IDS, wording, optionsFor } from '../../../src/lib/athleteBosV1/intake.js';
import {
  ATHLETE_BOS_MAP_VERSION,
  ATHLETE_BOS_OPERATING_DOMAINS,
  ATHLETE_BOS_PERSONALITY_DNA_ARCHITECTURE_VERSION,
  ATHLETE_BOS_SURFACES,
  ATHLETE_BOS_SURFACE_TRUTH_VERSION,
  ATHLETE_BOS_WHOLE_PERSON_VERSION,
  athleteBosStageById,
} from '../../../src/lib/athleteBosV1/personalityDnaArchitecture.js';

export const CONTRACT = 'athlete-bos-synthetic-v1-contract-new-bos-parity-v12';
export const LAYERS = ['relatively_durable_tendency', 'developing_tendency', 'skill', 'habit', 'current_state', 'environment', 'relationship', 'known_constraint', 'outcome'];
export const MODEL = 'gpt-5.6-sol';
export const assert = (test, code) => { if (!test) throw new Error(code); };
const str = { type: 'string' };
const arr = (items, maxItems = 30, minItems = 0) => ({ type: 'array', items, maxItems, minItems });
export const obj = properties => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const choice = values => ({ type: 'string', enum: values });
const refChoice = values => values.length ? choice(values) : str;
const refsFor = values => arr(refChoice(values));

function foundationParts(subject) {
  const ids = subject.evidence.map(e => e.id);
  const refs = refsFor(ids);
  const claim = obj({ id: str, statement: str, layer: choice(LAYERS), confidence: choice(['direct_account', 'bounded_inference', 'tentative']), support: arr(obj({ evidenceId: ids.length ? choice(ids) : str, exactSpan: str })), counterEvidenceIds: refs, alternatives: arr(str), whatWouldChangeIt: str });
  const confidence = choice(['direct_account', 'bounded_inference', 'tentative']);
  return {
    lifeHopes: obj({ status: choice(['not_asked', 'unknown', 'declined', 'sport_only', 'athlete_expressed', 'unavailable']), meaning: str, evidenceIds: refs }),
    goals: arr(obj({ id: str, meaning: str, authorship: choice(['athlete_chosen', 'athlete_undecided', 'other_person_expectation']), evidenceIds: refs }), 6),
    claims: arr(claim, 24),
    causal_dynamics: arr(obj({ id: str, triggerOrContext: str, meaningOrPrivateCalculation: str, responseOrAction: str, immediateUse: str, possibleDelayedCost: str, evidenceIds: refs, counterEvidenceIds: refs, confounders: arr(str), confidence, falsifier: str }), 16),
    sequences: arr(obj({ id: str, context: str, steps: arr(str, 8), consequence: str, evidenceIds: refs, counterEvidenceIds: refs, confounders: arr(str), confidence, falsifier: str }), 12),
    strengths_and_overuse: arr(obj({ id: str, strength: str, usefulWhen: str, lessUsefulWhen: str, mechanism: str, evidenceIds: refs, counterEvidenceIds: refs, confidence, falsifier: str }), 12),
    compensations: arr(obj({ id: str, pattern: str, whatItProtectsOrSolves: str, possibleCost: str, conditions: arr(str), evidenceIds: refs, counterEvidenceIds: refs, confounders: arr(str), confidence, falsifier: str }), 10),
    contradictions: arr(obj({ description: str, evidenceIds: refs, resolved: { type: 'boolean' } })),
    unknowns: arr(str),
  };
}

function futureSchema(evidenceIds, claimIds, goalIds) {
  const refs = refsFor(evidenceIds);
  return obj({
    title: str,
    athleteGoalId: refChoice(goalIds),
    baselineClaimIds: arr(refChoice(claimIds)),
    condition: str,
    controllableActions: arr(str),
    externalDependencies: arr(str),
    mechanismHypothesis: str,
    alternatives: arr(str),
    possibility: str,
    horizon: str,
    evidenceIds: refs,
    counterEvidenceIds: refs,
    uncertainty: str,
    indicators: arr(str),
    falsifier: str,
    reviewTrigger: str,
  });
}

function lifeDirectionDispositionSchema(evidenceIds) {
  return obj({
    status: choice(['used_in_future', 'held_open_insufficient_evidence', 'held_open_athlete_uncertain', 'no_future_generated', 'not_available']),
    explanation: str,
    evidenceIds: refsFor(evidenceIds),
  });
}

function moveSchema(evidenceIds) {
  return obj({
    kind: choice(['explore', 'maintain', 'pause', 'ask_qualified_person', 'abstain']),
    suggestion: str,
    purpose: str,
    evidenceIds: refsFor(evidenceIds),
    alternativesConsidered: arr(str),
    whyThis: str,
    proposedActor: str,
    willingness: choice(['not_established', 'preference_only']),
    prerequisites: arr(str),
    burden: str,
    risk: str,
    reversibility: str,
    observation: str,
    observationWindow: str,
    reviewEvent: str,
    falsifier: str,
    confounders: arr(str),
    inconclusiveIf: str,
    stopOrAdjust: str,
    uncertainty: str,
  });
}

const wholePersonSchema = (evidenceIds, causalIds = []) => obj({
  version: choice([ATHLETE_BOS_WHOLE_PERSON_VERSION]),
  core_explanation: str,
  central_tension: str,
  mechanisms: arr(str),
  causal_mechanisms: arr(obj({ id: str, meaning: str, causalIds: arr(refChoice(causalIds)), evidence_refs: refsFor(evidenceIds), uncertainty: str }), 12),
  identity_tensions: arr(str),
  goal_conflicts: arr(str),
  private_calculations: arr(str),
  pressure_and_recovery: str,
  work_and_relationships: str,
  identity_distillation: str,
  evidence_refs: refsFor(evidenceIds),
  uncertainty: arr(str),
});

const athleteMapSchema = evidenceIds => obj({
  version: choice([ATHLETE_BOS_MAP_VERSION]),
  recognition: str,
  preparation_and_action: str,
  people_and_communication: str,
  strengths_and_pressure: str,
  sport_school_and_responsibilities: str,
  growth_conditions: str,
  learning_and_problem_solving: str,
  energy_capacity_and_recovery: str,
  evidence_refs: refsFor(evidenceIds),
  unknowns: arr(str),
});

function causalIdsFromFoundation(foundation = {}) {
  return [
    ...(foundation.causal_dynamics || []),
    ...(foundation.sequences || []),
    ...(foundation.strengths_and_overuse || []),
    ...(foundation.compensations || []),
  ].map(({ id }) => id);
}

export function semanticStageSchema(stageId, subject, prior = {}) {
  const stage = athleteBosStageById(stageId);
  assert(stage, 'ATHLETE_SEMANTIC_STAGE_UNKNOWN');
  const evidenceIds = subject.evidence.map(e => e.id);
  const claimIds = (prior.causal_foundation?.claims || []).map(({ id }) => id);
  const causalIds = causalIdsFromFoundation(prior.causal_foundation);
  const goalIds = (prior.causal_foundation?.goals || []).map(({ id }) => id);
  const eventRootIds = [...new Set(subject.evidence.map(({ rootId, id }) => rootId || id))];
  if (stageId === 'causal_foundation') return obj(foundationParts(subject));
  if (stageId === 'operating_domains') return obj({
    domains: arr(obj({
      domainId: choice(ATHLETE_BOS_OPERATING_DOMAINS.map(({ id }) => id)),
      meaning: str,
      claimIds: arr(refChoice(claimIds)),
      causalIds: arr(refChoice(causalIds)),
      evidenceIds: refsFor(evidenceIds),
      counterEvidenceIds: refsFor(evidenceIds),
      unknowns: arr(str),
      abstention: str,
    }), ATHLETE_BOS_OPERATING_DOMAINS.length, ATHLETE_BOS_OPERATING_DOMAINS.length),
  });
  if (stageId === 'whole_person_decision_synthesis') return obj({
    title: str,
    recognition: str,
    whole_person_model: wholePersonSchema(evidenceIds, causalIds),
    athlete_map: athleteMapSchema(evidenceIds),
    life_direction_futures_disposition: lifeDirectionDispositionSchema(evidenceIds),
    futures: arr(futureSchema(evidenceIds, claimIds, goalIds), 5),
    move: moveSchema(evidenceIds),
    unknowns: arr(str),
  });
  return obj({
    surface_routes: arr(obj({
      surfaceId: choice(ATHLETE_BOS_SURFACES.map(({ id }) => id)),
      editorialHeadline: str,
      primaryRealization: str,
      primaryEventRootIds: arr(refChoice(eventRootIds), 3),
      visualIntent: str,
      reusePurpose: str,
      claimIds: arr(refChoice(claimIds), 5),
      causalIds: arr(refChoice(causalIds), 4),
      evidenceIds: arr(refChoice(evidenceIds), 8),
      abstention: str,
    }), ATHLETE_BOS_SURFACES.length, ATHLETE_BOS_SURFACES.length),
  });
}

export function interpretationSchema(subject) {
  const foundation = foundationParts(subject);
  const evidenceIds = subject.evidence.map(e => e.id);
  return obj({
    title: str,
    recognition: str,
    ...foundation,
    domains: arr(obj({ domainId: str, meaning: str, claimIds: arr(str), causalIds: arr(str), evidenceIds: refsFor(evidenceIds), counterEvidenceIds: refsFor(evidenceIds), unknowns: arr(str), abstention: str }), ATHLETE_BOS_OPERATING_DOMAINS.length),
    whole_person_model: wholePersonSchema(evidenceIds),
    athlete_map: athleteMapSchema(evidenceIds),
    life_direction_futures_disposition: lifeDirectionDispositionSchema(evidenceIds),
    chapters: arr(obj({ id: str, title: str, mission: str, claimIds: arr(str), causalIds: arr(str), evidenceIds: refsFor(evidenceIds), unknowns: arr(str) }), ATHLETE_BOS_SURFACES.length),
    futures: arr(futureSchema(evidenceIds, [], []), 5),
    move: moveSchema(evidenceIds),
    surface_routes: arr(obj({ surfaceId: str, editorialHeadline: str, primaryRealization: str, primaryEventRootIds: arr(str, 3), visualIntent: str, reusePurpose: str, claimIds: arr(str), causalIds: arr(str), evidenceIds: refsFor(evidenceIds), abstention: str }), ATHLETE_BOS_SURFACES.length),
  });
}
export function checkCustomerText(text) {
  assert(typeof text === 'string' && text.length > 0 && text.length < 60000, 'CUSTOMER_TEXT_INVALID');
  assert(![...CATASTROPHIC_PROHIBITED_ASSERTION_PATTERNS, ...INTERNAL_CUSTOMER_LANGUAGE,
    /\b(?:sk-[a-z0-9_-]{12,}|Bearer\s+[a-z0-9._-]{16,})\b/i,
    /\b(?:personality|ambition|resilience|coachability|potential|talent|mental toughness)\s+(?:score|rating|percentile)\b/i,
    /\byou (?:have|are|seem) (?:ADHD|autistic|bipolar|clinically depressed)\b/i,
    /\b\d+(?:\.\d+)?\s*%\s*(?:chance|probability|odds)\s+of\s+(?:a scholarship|going pro|selection|being selected)/i,
    /\byou (?:will|are destined to) (?:get a scholarship|go pro|be selected)\b/i,
    /\bevent roots?\b/i,
    /\bsame-root(?:\s+items?)?\b/i,
    /\bbounded baseline\b/i,
    /\badult (?:business|work|role|seat)(?:\s+(?:inference|judgment|language))?\b/i,
    /\bbusiness (?:role|seat)\b/i,
    /\brole and seat\b/i,
    /\brole\s*\/\s*seat\b/i,
    /\bcontext[- ]bound\b/i,
    /\bfully self[- ]sufficient\b/i,
    /\breminder[- ]dependent\b/i,
    /\binitiat(?:e|es|ed|ing) actions?\b/i,
    /\bcontext[- ]specific (?:behavior|pattern|response|tendency)\b/i,
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ].some(pattern => pattern.test(text)), 'PROHIBITED_CUSTOMER_ASSERTION');
}

const PAST_CAUSAL_ATTRIBUTION_GATES = Object.freeze([
  { output: /\bpreserv(?:ed|ing)\b(?=[^.]{0,60}\b(?:time|sleep|completion|outcome|result|items?|equipment|energy|access)\b)/iu, source: /\bpreserv(?:e|es|ed|ing)\b/iu },
  { output: /\bprotect(?:ed|ing)\b/iu, source: /\bprotect(?:s|ed|ing)?\b/iu },
  { output: /\bleft\s+time\s+for\b/iu, source: /\bleft\s+time\s+for\b/iu },
  { output: /\benabled\b/iu, source: /\benabl(?:e|es|ed|ing)\b/iu },
  { output: /\ballowed\b/iu, source: /\ballow(?:s|ed|ing)?\b/iu },
  { output: /\bcaused\b/iu, source: /\bcaus(?:e|es|ed|ing)\b/iu, negated: /\b(?:does not|do not|did not|cannot|can’t|could not|doesn’t|is not known to|is unclear whether|is unknown whether|not enough to say)\b[^.]{0,120}\bcaused\b/iu },
  { output: /\bmade\s+(?:it\s+)?possible\b/iu, source: /\bmade\s+(?:it\s+)?possible\b/iu },
  { output: /\bfelt\b[^.]{0,80}\bbecause\b/iu, source: /\bfelt\b[^.]{0,80}\bbecause\b/iu },
]);

function assertNoUnattributedPastCausalBenefit(item, evidence) {
  const output = [
    item.triggerOrContext,
    item.meaningOrPrivateCalculation,
    item.responseOrAction,
    item.immediateUse,
    item.possibleDelayedCost,
    item.context,
    ...(item.steps || []),
    item.consequence,
    item.strength,
    item.usefulWhen,
    item.lessUsefulWhen,
    item.mechanism,
    item.pattern,
    item.whatItProtectsOrSolves,
    item.possibleCost,
    ...(item.conditions || []),
  ].filter(Boolean).join(' ');
  const supplied = (item.evidenceIds || [])
    .map(id => evidence.get(id)?.text || '')
    .join(' ');
  for (const gate of PAST_CAUSAL_ATTRIBUTION_GATES) {
    if (gate.output.test(output) && !gate.negated?.test(output)) assert(gate.source.test(supplied), 'PAST_CAUSAL_BENEFIT_REQUIRES_EXPLICIT_SOURCE_ATTRIBUTION');
  }
}

export function normalizeAthleteSurfaceHeadline(headline) {
  return String(headline || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/['’]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function assertAthleteSurfaceEditorialHeadlines(surfaceRoutes = []) {
  assertExactRegistry(surfaceRoutes, ATHLETE_BOS_SURFACES, 'surfaceId', 'ATHLETE_SURFACE_ROUTING_COVERAGE');
  const normalized = [];
  for (const [index, route] of surfaceRoutes.entries()) {
    const headline = route.editorialHeadline;
    assert(typeof headline === 'string' && headline === headline.trim() && headline.length > 0 && headline.length <= 96, 'ATHLETE_SURFACE_HEADLINE_INVALID');
    assert(!/[\r\n#]/u.test(headline) && headline.split(/\s+/u).filter(Boolean).length <= 12, 'ATHLETE_SURFACE_HEADLINE_INVALID');
    checkCustomerText(headline);
    const key = normalizeAthleteSurfaceHeadline(headline);
    assert(key && key !== normalizeAthleteSurfaceHeadline(ATHLETE_BOS_SURFACES[index].label), 'ATHLETE_SURFACE_HEADLINE_MUST_BE_EDITORIAL');
    assert(!/^(?:you can\b|you are able to\b|some patterns?\b|several patterns?\b|(?:one|two|three|four|five) paths?\b|possible futures?\b|what we know\b)/iu.test(headline), 'ATHLETE_SURFACE_HEADLINE_TOO_GENERIC');
    normalized.push(key);
  }
  assert(new Set(normalized).size === ATHLETE_BOS_SURFACES.length, 'ATHLETE_SURFACE_HEADLINES_NOT_UNIQUE');
}

const DISTINCT_DOMAIN_SURFACE_IDS = Object.freeze(new Set([
  'how_you_operate',
  'how_people_experience_you',
  'communication_dna',
  'strengths_vulnerabilities',
  'pressure_conflict',
  'work_dna',
  'role_seat',
  'cognitive_operating_style',
  'personal_operating_energy',
]));

function routeEvidenceIds(route, claimsById, causalById) {
  return [...new Set([
    ...(route.evidenceIds || []),
    ...(route.claimIds || []).flatMap((id) => {
      const claim = claimsById.get(id);
      return claim ? [...(claim.support || []).map(({ evidenceId }) => evidenceId), ...(claim.counterEvidenceIds || [])] : [];
    }),
    ...(route.causalIds || []).flatMap((id) => {
      const item = causalById.get(id);
      return item ? [...(item.evidenceIds || []), ...(item.counterEvidenceIds || [])] : [];
    }),
  ])];
}

export function assertAthleteDomainRouteEventDiversity(surfaceRoutes = [], foundation = {}, subject = {}) {
  const evidenceById = new Map((subject.evidence || []).map((item) => [item.id, item]));
  const claimsById = new Map((foundation.claims || []).map((item) => [item.id, item]));
  const causalById = new Map([
    ...(foundation.causal_dynamics || []),
    ...(foundation.sequences || []),
    ...(foundation.strengths_and_overuse || []),
    ...(foundation.compensations || []),
  ].map((item) => [item.id, item]));
  const allRootIds = new Set((subject.evidence || []).map(({ rootId, id }) => rootId || id));
  const surfacesByRoot = new Map();
  const primaryRealizations = new Set();
  for (const route of surfaceRoutes) {
    const routedEvidenceIds = routeEvidenceIds(route, claimsById, causalById);
    const routedRoots = new Set(routedEvidenceIds
      .map((id) => evidenceById.get(id)?.rootId || id)
      .filter(Boolean));
    assert(typeof route.primaryRealization === 'string' && route.primaryRealization.trim(), 'ATHLETE_SURFACE_PRIMARY_REALIZATION_REQUIRED');
    assert(typeof route.visualIntent === 'string' && route.visualIntent.trim(), 'ATHLETE_SURFACE_VISUAL_INTENT_REQUIRED');
    checkCustomerText(route.primaryRealization);
    const normalizedRealization = normalizeAthleteSurfaceHeadline(route.primaryRealization);
    assert(normalizedRealization && !primaryRealizations.has(normalizedRealization), 'ATHLETE_SURFACE_PRIMARY_REALIZATIONS_NOT_UNIQUE');
    primaryRealizations.add(normalizedRealization);
    assert(Array.isArray(route.primaryEventRootIds) && route.primaryEventRootIds.every((id) => allRootIds.has(id)), 'ATHLETE_SURFACE_PRIMARY_EVENT_ROOT_INVALID');
    assert(route.primaryEventRootIds.every((id) => routedRoots.has(id)), 'ATHLETE_SURFACE_PRIMARY_EVENT_ROOT_MUST_BE_ROUTED');
    if (routedEvidenceIds.length) assert(route.primaryEventRootIds.length > 0, 'SUPPORTED_SURFACE_REQUIRES_PRIMARY_EVENT_ROOT');
    else assert(route.primaryEventRootIds.length === 0, 'EMPTY_SURFACE_CANNOT_HAVE_PRIMARY_EVENT_ROOT');
  }
  for (const route of surfaceRoutes.filter(({ surfaceId }) => DISTINCT_DOMAIN_SURFACE_IDS.has(surfaceId))) {
    for (const root of new Set(route.primaryEventRootIds)) {
      const surfaces = surfacesByRoot.get(root) || [];
      surfaces.push(route);
      surfacesByRoot.set(root, surfaces);
    }
  }
  for (const routes of surfacesByRoot.values()) {
    assert(new Set(routes.map(({ surfaceId }) => surfaceId)).size <= 3, 'ATHLETE_ONE_EVENT_CANNOT_DOMINATE_UNRELATED_DOMAIN_SURFACES');
    if (routes.length > 1) {
      const purposes = routes.map(({ reusePurpose }) => normalizeAthleteSurfaceHeadline(reusePurpose));
      assert(purposes.every(Boolean) && new Set(purposes).size === purposes.length, 'ATHLETE_REUSED_EVENT_REQUIRES_DISTINCT_PURPOSE');
    }
  }
}
function walkRefs(value, evidence) {
  if (Array.isArray(value)) return value.forEach(v => walkRefs(v, evidence));
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (['evidenceIds', 'counterEvidenceIds', 'evidence_refs'].includes(key)) assert(item.every(id => evidence.has(id)), 'INVENTED_EVIDENCE_REFERENCE');
    walkRefs(item, evidence);
  }
}

function assertExactRegistry(items, registry, itemKey, code) {
  assert(Array.isArray(items) && items.length === registry.length, code);
  assert(items.every((item, index) => item?.[itemKey] === registry[index].id), code);
  assert(new Set(items.map(item => item[itemKey])).size === registry.length, code);
}

export function hasAthletePublicationSupport(route = {}) {
  return ['claimIds', 'causalIds', 'evidenceIds', 'claim_refs', 'causal_refs', 'evidence_refs']
    .some(key => Array.isArray(route[key]) && route[key].length > 0);
}

export function assertSupportedAthleteDomainsAreRouted(domains = [], surfaceRoutes = []) {
  const domainById = new Map(domains.map(domain => [domain.domainId, domain]));
  const routeBySurfaceId = new Map(surfaceRoutes.map(route => [route.surfaceId, route]));
  for (const surface of ATHLETE_BOS_SURFACES) {
    if (!surface.domainId) continue;
    const domain = domainById.get(surface.domainId);
    if (domain?.meaning?.trim() && hasAthletePublicationSupport(domain)) {
      assert(hasAthletePublicationSupport(routeBySurfaceId.get(surface.id)), 'SUPPORTED_DOMAIN_CANNOT_HAVE_EMPTY_SURFACE_ROUTE');
    }
  }
}

export function athleteSurfacePacketHasPublicationSupport(packet) {
  return hasAthletePublicationSupport(packet?.writer_focus || {});
}

export function assertProspectiveFalsifier(value) {
  assert(value?.trim(), 'FALSIFIER_REQUIRED');
  const text = value.trim();
  assert(!/^(?:you|the athlete|[\p{L}][\p{L}'’-]+)\s+(?:clarif(?:y|ies|ied)|correct(?:s|ed)?|confirm(?:s|ed)?|report(?:s|ed)?|say(?:s|said)|tell(?:s)?|told)\b/iu.test(text), 'FALSIFIER_CANNOT_ASSERT_UNOBSERVED_CORRECTION');
  assert(/^(?:if|when|unless|a\s+(?:later|future)|future|further|repeated|several|revise\s+this\s+(?:if|when|unless))\b|^more(?:\s+[\p{L}'’-]+){0,3}\s+(?:situations?|moments?|events?|accounts?|examples?|observations?|attempts?|uses?|practices?|sessions?|cases?)\b|\b(?:would|could|should|might)\b/iu.test(text), 'FALSIFIER_MUST_BE_CONDITIONAL_TEST');
}

export function validateSemanticStage(stageId, fragment, subject, prior = {}) {
  const evidence = new Map(subject.evidence.map(e => [e.id, e]));
  assert(athleteBosStageById(stageId), 'ATHLETE_SEMANTIC_STAGE_UNKNOWN');
  walkRefs(fragment, evidence);
  if (stageId === 'causal_foundation') {
    validateInterpretation({
      title: '', recognition: '', ...fragment, domains: [], chapters: [], futures: [],
      move: emptyMove(), surface_routes: [],
    }, subject, { allowIncompleteArchitecture: true });
  } else if (stageId === 'operating_domains') {
    assertExactRegistry(fragment.domains, ATHLETE_BOS_OPERATING_DOMAINS, 'domainId', 'ATHLETE_DOMAIN_COVERAGE');
    const claimIds = new Set((prior.causal_foundation?.claims || []).map(({ id }) => id));
    const causalIds = new Set(causalIdsFromFoundation(prior.causal_foundation));
    for (const domain of fragment.domains) {
      assert(domain.claimIds.every(id => claimIds.has(id)), 'INVENTED_CLAIM_REFERENCE');
      assert(domain.causalIds.every(id => causalIds.has(id)), 'INVENTED_CAUSAL_REFERENCE');
      assert(domain.meaning?.trim() || domain.abstention?.trim(), 'ATHLETE_DOMAIN_REQUIRES_MEANING_OR_ABSTENTION');
      if (!domain.claimIds.length && !domain.causalIds.length && !domain.evidenceIds.length) assert(domain.abstention?.trim(), 'EMPTY_DOMAIN_REQUIRES_ABSTENTION');
    }
  } else if (stageId === 'whole_person_decision_synthesis') {
    const foundation = prior.causal_foundation;
    assert(foundation, 'ATHLETE_FOUNDATION_REQUIRED');
    const candidate = {
      title: fragment.title,
      recognition: fragment.recognition,
      ...foundation,
      domains: prior.operating_domains?.domains || [],
      whole_person_model: fragment.whole_person_model,
      athlete_map: fragment.athlete_map,
      life_direction_futures_disposition: fragment.life_direction_futures_disposition,
      chapters: [],
      futures: fragment.futures,
      move: fragment.move,
      surface_routes: [],
      unknowns: [...foundation.unknowns, ...fragment.unknowns],
    };
    assert(fragment.whole_person_model.evidence_refs.length > 0 || subject.evidence.length === 0, 'WHOLE_PERSON_REQUIRES_EVIDENCE');
    assert(fragment.athlete_map.evidence_refs.length > 0 || subject.evidence.length === 0, 'ATHLETE_MAP_REQUIRES_EVIDENCE');
    validateInterpretation(candidate, subject, { allowIncompleteArchitecture: true, allowUnreadyFutures: true });
  } else {
    assertExactRegistry(fragment.surface_routes, ATHLETE_BOS_SURFACES, 'surfaceId', 'ATHLETE_SURFACE_ROUTING_COVERAGE');
    assertAthleteSurfaceEditorialHeadlines(fragment.surface_routes);
    const claims = new Set((prior.causal_foundation?.claims || []).map(({ id }) => id));
    const causalIds = new Set(causalIdsFromFoundation(prior.causal_foundation));
    for (const route of fragment.surface_routes) {
      assert(route.claimIds.every(id => claims.has(id)), 'INVENTED_CLAIM_REFERENCE');
      assert(route.causalIds.every(id => causalIds.has(id)), 'INVENTED_CAUSAL_REFERENCE');
      if (!route.claimIds.length && !route.causalIds.length && !route.evidenceIds.length) assert(route.abstention?.trim(), 'EMPTY_SURFACE_REQUIRES_ABSTENTION');
    }
    assertSupportedAthleteDomainsAreRouted(prior.operating_domains?.domains, fragment.surface_routes);
    assertAthleteDomainRouteEventDiversity(fragment.surface_routes, prior.causal_foundation, subject);
    const personalityRoute = fragment.surface_routes.find(({ surfaceId }) => surfaceId === 'personality_dna');
    if (causalIds.size > 0) assert(personalityRoute?.causalIds.length > 0, 'ATHLETE_PERSONALITY_DNA_REQUIRES_CAUSAL_ARCHITECTURE');
    if ((prior.whole_person_decision_synthesis?.futures || []).length === 0) {
      const futureRoute = fragment.surface_routes.find(({ surfaceId }) => surfaceId === 'five_futures');
      assert(futureRoute?.abstention?.trim(), 'ZERO_FUTURES_REQUIRES_VISIBLE_ABSTENTION');
      assert(!futureRoute.claimIds.length && !futureRoute.causalIds.length && !futureRoute.evidenceIds.length, 'ZERO_FUTURES_ROUTE_MUST_BE_EMPTY');
    }
  }
  return fragment;
}

function emptyMove() {
  return {
    kind: 'abstain', suggestion: '', purpose: '', evidenceIds: [], alternativesConsidered: [], whyThis: '',
    proposedActor: 'athlete', willingness: 'not_established', prerequisites: [], burden: '', risk: '',
    reversibility: '', observation: '', observationWindow: '', reviewEvent: '', falsifier: '', confounders: [],
    inconclusiveIf: '', stopOrAdjust: 'Leave this open until the athlete chooses otherwise.', uncertainty: 'Not enough evidence yet.',
  };
}

const CORRECTION_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'but', 'by', 'for', 'from', 'had', 'has', 'have',
  'he', 'her', 'hers', 'him', 'his', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our',
  'she', 'so', 'that', 'the', 'their', 'them', 'they', 'this', 'to', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'who', 'with', 'you', 'your',
]);

function normalizedMeaningTokens(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .filter(token => token.length > 1 && !CORRECTION_STOP_WORDS.has(token))
    .map(token => token.length > 5 ? token.replace(/(?:ing|edly|edly|ed|ly|es|s)$/u, '') : token)
    .filter(Boolean);
}

function conflictsWithCorrectedMeaning(statement, displayedClaim) {
  const current = new Set(normalizedMeaningTokens(statement));
  const corrected = new Set(normalizedMeaningTokens(displayedClaim));
  if (!current.size || !corrected.size) return false;
  const overlap = [...current].filter(token => corrected.has(token)).length;
  const containment = overlap / Math.min(current.size, corrected.size);
  const union = new Set([...current, ...corrected]).size;
  return containment >= 0.72 || (overlap >= 4 && overlap / union >= 0.45);
}

function normalizedSemanticValue(value) {
  if (typeof value === 'string') return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
  if (Array.isArray(value)) return value.map(normalizedSemanticValue).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalizedSemanticValue(value[key])]));
}

export function assembleInterpretationFromStages(fragments, subject) {
  const foundation = fragments.causal_foundation;
  const domains = fragments.operating_domains;
  const synthesis = fragments.whole_person_decision_synthesis;
  const routing = fragments.surface_routing;
  assert(foundation && domains && synthesis && routing, 'ATHLETE_FOUR_STAGE_ASSEMBLY_INCOMPLETE');
  const chapters = ATHLETE_BOS_SURFACES.map((surface, index) => {
    const route = routing.surface_routes[index];
    return {
      id: surface.id,
      title: surface.label,
      mission: surface.mission,
      claimIds: route.claimIds,
      causalIds: route.causalIds,
      evidenceIds: route.evidenceIds,
      unknowns: route.abstention ? [route.abstention] : [],
    };
  });
  const plan = {
    title: synthesis.title,
    recognition: synthesis.recognition,
    lifeHopes: foundation.lifeHopes,
    goals: foundation.goals,
    claims: foundation.claims,
    causal_dynamics: foundation.causal_dynamics,
    sequences: foundation.sequences,
    strengths_and_overuse: foundation.strengths_and_overuse,
    compensations: foundation.compensations,
    contradictions: foundation.contradictions,
    domains: domains.domains,
    whole_person_model: synthesis.whole_person_model,
    athlete_map: synthesis.athlete_map,
    life_direction_futures_disposition: synthesis.life_direction_futures_disposition,
    chapters,
    futures: synthesis.futures,
    move: synthesis.move,
    unknowns: [...new Set([...foundation.unknowns, ...synthesis.unknowns])],
    surface_routes: routing.surface_routes,
  };
  validateInterpretation(plan, subject, { allowUnreadyFutures: true });
  return plan;
}

function evidenceForSurface(evidenceIds, subject) {
  const allowed = new Set(evidenceIds);
  return subject.evidence.filter(({ id }) => allowed.has(id)).map(item => ({
    evidence_id: item.id,
    source_root_id: item.rootId,
    epistemic_class: item.kind === 'self_report' ? 'self_report' : item.kind,
    exact_content: item.text,
    source_actor: item.actor,
    audience: item.audience,
    event_time: item.eventTime || null,
    question_context: item.question_context || subject.responses?.[item.id]?.wording || null,
  }));
}

function collectEvidenceIds(value, output = []) {
  if (Array.isArray(value)) return value.forEach(item => collectEvidenceIds(item, output));
  if (!value || typeof value !== 'object') return output;
  for (const [key, item] of Object.entries(value)) {
    if (['evidenceIds', 'counterEvidenceIds', 'evidence_refs', 'counterevidence_refs'].includes(key) && Array.isArray(item)) output.push(...item);
    else collectEvidenceIds(item, output);
  }
  return output;
}

function specialistTruth(surface, plan) {
  if (surface.id === 'five_futures') return { futures: plan.futures };
  if (surface.id === 'one_move') return { move: plan.move };
  if (surface.id === 'evidence_certainty') return { contradictions: plan.contradictions, unknowns: plan.unknowns };
  if (surface.id === 'this_is_you') return { recognition: plan.recognition };
  if (surface.id === 'operating_identity') return { recognition: plan.recognition, governing_identity: plan.whole_person_model.identity_distillation };
  return plan.domains.find(({ domainId }) => domainId === surface.domainId) || { abstention: 'There is not enough evidence to add a supported interpretation here yet.' };
}

export function buildAthleteSurfacePackets(plan, subject, identity, sourceHash = stateHash(subject)) {
  const claimLookup = new Map(plan.claims.map(claim => [claim.id, claim]));
  const causalLookup = new Map([
    ...plan.causal_dynamics,
    ...plan.sequences,
    ...plan.strengths_and_overuse,
    ...plan.compensations,
  ].map(item => [item.id, item]));
  return Object.freeze(ATHLETE_BOS_SURFACES.map((surface, index) => {
    const route = plan.surface_routes[index];
    const domainTruth = specialistTruth(surface, plan);
    const impliedClaimIds = surface.id === 'evidence_certainty'
      ? plan.claims.map(({ id }) => id)
      : [
        ...(domainTruth.claimIds || []),
        ...(surface.id === 'five_futures' ? plan.futures.flatMap(({ baselineClaimIds }) => baselineClaimIds) : []),
      ];
    const selectedClaimIds = [...new Set([...route.claimIds, ...impliedClaimIds])];
    const impliedCausalIds = [
      ...(domainTruth.causalIds || []),
      ...(['this_is_you', 'personality_dna', 'operating_identity'].includes(surface.id) ? plan.whole_person_model.causal_mechanisms.flatMap(({ causalIds }) => causalIds) : []),
      ...(surface.id === 'evidence_certainty' ? [...causalLookup.keys()] : []),
    ];
    const selectedCausalIds = [...new Set([...route.causalIds, ...impliedCausalIds])];
    const resolvedClaims = selectedClaimIds.map(id => claimLookup.get(id)).filter(Boolean).map(claim => ({
      id: claim.id,
      statement: claim.statement,
      confidence: claim.confidence,
      evidence_refs: claim.support.map(({ evidenceId }) => evidenceId),
      counterevidence_refs: claim.counterEvidenceIds,
      confounds: claim.alternatives,
      what_would_change_it: claim.whatWouldChangeIt,
    }));
    const resolvedCausalItems = selectedCausalIds.map(id => causalLookup.get(id)).filter(Boolean);
    const wholePersonRefs = ['this_is_you', 'personality_dna', 'operating_identity'].includes(surface.id) ? plan.whole_person_model.evidence_refs : [];
    const specialRefs = surface.id === 'evidence_certainty'
      ? subject.evidence.map(({ id }) => id)
      : collectEvidenceIds(domainTruth);
    const baseEvidenceIds = [...new Set([
      ...route.evidenceIds,
      ...resolvedClaims.flatMap(claim => [...claim.evidence_refs, ...claim.counterevidence_refs]),
      ...resolvedCausalItems.flatMap(item => [...item.evidenceIds, ...item.counterEvidenceIds]),
      ...wholePersonRefs,
      ...specialRefs,
    ])];
    const baseEvidenceSet = new Set(baseEvidenceIds);
    const relevantContradictions = plan.contradictions.filter(item => item.evidenceIds.some(id => baseEvidenceSet.has(id)));
    const evidenceIds = [...new Set([...baseEvidenceIds, ...relevantContradictions.flatMap(item => item.evidenceIds)])];
    const evidence = evidenceForSurface(evidenceIds, subject);
    const counterEvidenceIds = new Set([
      ...resolvedClaims.flatMap(claim => claim.counterevidence_refs),
      ...resolvedCausalItems.flatMap(item => item.counterEvidenceIds),
    ]);
    const contradictions = relevantContradictions
      .map(item => ({ statement: item.description, evidence_refs: item.evidenceIds, resolved: item.resolved }));
    const writerClaimIds = [...new Set(route.claimIds)];
    const writerCausalIds = [...new Set(route.causalIds)];
    const writerEvidenceIds = [...new Set([
      ...route.evidenceIds,
      ...writerClaimIds.flatMap((id) => {
        const claim = claimLookup.get(id);
        return claim ? [...claim.support.map(({ evidenceId }) => evidenceId), ...claim.counterEvidenceIds] : [];
      }),
      ...writerCausalIds.flatMap((id) => {
        const item = causalLookup.get(id);
        return item ? [...(item.evidenceIds || []), ...(item.counterEvidenceIds || [])] : [];
      }),
    ])].filter((id) => evidenceIds.includes(id));
    const packet = {
      surface_id: surface.id,
      surface_number: surface.number,
      label: surface.label,
      editorial_headline: route.editorialHeadline,
      primary_realization: route.primaryRealization,
      primary_event_root_ids: route.primaryEventRootIds,
      visual_intent: route.visualIntent,
      reuse_purpose: route.reusePurpose,
      destination: surface.destination,
      local_mission: surface.mission,
      whole_person_ref: `${ATHLETE_BOS_WHOLE_PERSON_VERSION}:${identity}`,
      whole_person_model: plan.whole_person_model,
      claim_refs: selectedClaimIds,
      causal_refs: selectedCausalIds,
      writer_focus: {
        primary_realization: route.primaryRealization,
        primary_event_root_ids: route.primaryEventRootIds,
        visual_intent: route.visualIntent,
        reuse_purpose: route.reusePurpose,
        claim_refs: writerClaimIds,
        causal_refs: writerCausalIds,
        evidence_refs: writerEvidenceIds,
      },
      resolved_local_truth: {
        version: ATHLETE_BOS_SURFACE_TRUTH_VERSION,
        surface_id: surface.id,
        editorial_headline: route.editorialHeadline,
        primary_realization: route.primaryRealization,
        primary_event_root_ids: route.primaryEventRootIds,
        visual_intent: route.visualIntent,
        subject_token: subject.id,
        whole_person_model: plan.whole_person_model,
        resolved_claims: resolvedClaims,
        causal_dynamics: resolvedCausalItems.filter(item => plan.causal_dynamics.some(({ id }) => id === item.id)),
        sequences: resolvedCausalItems.filter(item => plan.sequences.some(({ id }) => id === item.id)),
        strengths_and_overuse: resolvedCausalItems.filter(item => plan.strengths_and_overuse.some(({ id }) => id === item.id)),
        compensations: resolvedCausalItems.filter(item => plan.compensations.some(({ id }) => id === item.id)),
        evidence,
        confidence_states: [...new Set([...resolvedClaims.map(({ confidence }) => confidence), ...resolvedCausalItems.map(({ confidence }) => confidence)])],
        contradictions,
        counterevidence: evidence.filter(({ evidence_id }) => counterEvidenceIds.has(evidence_id)),
        confounds: [...new Set([...resolvedClaims.flatMap(({ confounds }) => confounds), ...resolvedCausalItems.flatMap(item => item.confounders || [])])],
        falsifiers: [
          ...resolvedClaims.map(({ id, statement, what_would_change_it }) => ({ source_id: id, meaning: statement, falsifier: what_would_change_it })),
          ...resolvedCausalItems.map(item => ({ source_id: item.id, meaning: item.triggerOrContext || item.context || item.strength || item.pattern, falsifier: item.falsifier })),
        ],
        abstentions: route.abstention ? [route.abstention] : [],
        specialist_truth: domainTruth,
        prior_coordinates: [],
        lineage: {
          architecture_version: ATHLETE_BOS_PERSONALITY_DNA_ARCHITECTURE_VERSION,
          source_hash: sourceHash,
          plan_hash: sha256Stable(plan),
        },
      },
      communication_contract: 'athlete_bos_surface_human_realization_v1',
      human_realization: null,
      rendering: null,
    };
    return Object.freeze(packet);
  }));
}
function validateCustomerFacingValues(value, parentKey = '') {
  const internalKeys = new Set([
    'id', 'claimIds', 'causalIds', 'evidenceId', 'evidenceIds', 'counterEvidenceIds', 'evidence_refs', 'counterevidence_refs',
    'athleteGoalId', 'baselineClaimIds', 'domainId', 'surfaceId', 'version', 'layer', 'confidence',
    'authorship', 'kind', 'willingness', 'status', 'sourceHash', 'plan_hash', 'exactSpan',
  ]);
  if (typeof value === 'string') {
    if (!internalKeys.has(parentKey) && value.trim()) checkCustomerText(value);
    return;
  }
  if (Array.isArray(value)) return value.forEach(item => validateCustomerFacingValues(item, parentKey));
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, item]) => validateCustomerFacingValues(item, key));
}

export function validateInterpretation(plan, subject, { allowIncompleteArchitecture = false, allowUnreadyFutures = false } = {}) {
  const evidence = new Map(subject.evidence.map(e => [e.id, e]));
  assert(Array.isArray(plan.claims) && Array.isArray(plan.chapters) && Array.isArray(plan.futures) && plan.futures.length <= 5, 'ATHLETE_PLAN_SHAPE');
  if (!allowIncompleteArchitecture) {
    assertExactRegistry(plan.chapters, ATHLETE_BOS_SURFACES, 'id', 'ATHLETE_CHAPTER_COVERAGE');
    assertExactRegistry(plan.surface_routes, ATHLETE_BOS_SURFACES, 'surfaceId', 'ATHLETE_SURFACE_ROUTING_COVERAGE');
    assertExactRegistry(plan.domains, ATHLETE_BOS_OPERATING_DOMAINS, 'domainId', 'ATHLETE_DOMAIN_COVERAGE');
    assertSupportedAthleteDomainsAreRouted(plan.domains, plan.surface_routes);
    assertAthleteSurfaceEditorialHeadlines(plan.surface_routes);
    assertAthleteDomainRouteEventDiversity(plan.surface_routes, plan, subject);
    assert(plan.whole_person_model?.version === ATHLETE_BOS_WHOLE_PERSON_VERSION, 'ATHLETE_WHOLE_PERSON_CONTRACT');
    assert(plan.athlete_map?.version === ATHLETE_BOS_MAP_VERSION, 'ATHLETE_MAP_CONTRACT');
  }
  const seen = new Set();
  for (const claim of plan.claims) {
    assert(!seen.has(claim.id) && claim.id, 'DUPLICATE_CLAIM'); seen.add(claim.id);
    assert(LAYERS.includes(claim.layer) && claim.support.length, 'CLAIM_REQUIRES_SUPPORT');
    for (const span of claim.support) assert(span.exactSpan?.trim() && evidence.get(span.evidenceId)?.text.includes(span.exactSpan), 'UNSUPPORTED_EXACT_SPAN');
    const roots = new Set(claim.support.map(s => evidence.get(s.evidenceId).rootId));
    if (claim.layer === 'relatively_durable_tendency') assert(roots.size >= 4, 'DURABLE_TENDENCY_REQUIRES_FOUR_SEPARATE_EVENTS');
    if (claim.layer === 'developing_tendency') assert(roots.size >= 3, 'DEVELOPING_TENDENCY_REQUIRES_THREE_SEPARATE_EVENTS');
    if (claim.layer === 'habit') assert(roots.size >= 3, 'HABIT_REQUIRES_THREE_SEPARATE_EVENTS');
    checkCustomerText(claim.statement);
    const normalizedStatement = claim.statement.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
    const repeatsCorrectedClaim = (subject.corrections || []).some((correction) => (
      correction.status !== 'retracted'
      && (
        correction.claimId === claim.id
        || String(correction.displayedClaim || '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US') === normalizedStatement
        || conflictsWithCorrectedMeaning(claim.statement, correction.displayedClaim)
        || (
          correction.claimEvidenceIds?.length > 0
          && correction.claimEvidenceIds.length === claim.support.length
          && correction.claimEvidenceIds.every(evidenceId => claim.support.some(({ evidenceId: currentId }) => currentId === evidenceId))
          && !claim.support.some(({ evidenceId }) => evidenceId === correction.id)
        )
      )
    ));
    assert(!repeatsCorrectedClaim, 'CORRECTED_CLAIM_CANNOT_REMAIN_CURRENT');
    assertProspectiveFalsifier(claim.whatWouldChangeIt);
  }
  const causalSeen = new Set();
  for (const dynamic of plan.causal_dynamics || []) {
    assert([dynamic.triggerOrContext, dynamic.meaningOrPrivateCalculation, dynamic.responseOrAction, dynamic.immediateUse, dynamic.possibleDelayedCost].every(value => value?.trim()), 'CAUSAL_DYNAMIC_SEMANTICS_REQUIRED');
  }
  for (const sequence of plan.sequences || []) {
    assert(sequence.context?.trim() && sequence.consequence?.trim() && sequence.steps?.length >= 2 && sequence.steps.every(step => step?.trim()), 'CAUSAL_SEQUENCE_SEMANTICS_REQUIRED');
  }
  for (const item of plan.strengths_and_overuse || []) {
    assert([item.strength, item.usefulWhen, item.lessUsefulWhen, item.mechanism].every(value => value?.trim()), 'STRENGTH_OVERUSE_SEMANTICS_REQUIRED');
  }
  for (const compensation of plan.compensations || []) {
    assert([compensation.pattern, compensation.whatItProtectsOrSolves, compensation.possibleCost].every(value => value?.trim()) && compensation.conditions?.length > 0 && compensation.conditions.every(value => value?.trim()), 'COMPENSATION_SEMANTICS_REQUIRED');
  }
  for (const item of [
    ...(plan.causal_dynamics || []),
    ...(plan.sequences || []),
    ...(plan.strengths_and_overuse || []),
    ...(plan.compensations || []),
  ]) {
    assert(item.id && !causalSeen.has(item.id), 'DUPLICATE_CAUSAL_ITEM');
    causalSeen.add(item.id);
    assert(item.evidenceIds?.length && item.falsifier?.trim() && ['direct_account', 'bounded_inference', 'tentative'].includes(item.confidence), 'CAUSAL_ITEM_REQUIRES_EVIDENCE_AND_BOUNDARY');
    assertNoUnattributedPastCausalBenefit(item, evidence);
    assertProspectiveFalsifier(item.falsifier);
  }
  for (const chapter of plan.chapters) {
    assert(chapter.claimIds.every(id => seen.has(id)), 'INVENTED_CLAIM_REFERENCE');
    assert((chapter.causalIds || []).every(id => causalSeen.has(id)), 'INVENTED_CAUSAL_REFERENCE');
  }
  assert(new Set(plan.chapters.map(c => c.id)).size === plan.chapters.length, 'DUPLICATE_CHAPTER');
  walkRefs(plan, evidence);
  if (['NOT_ASKED', 'UNAVAILABLE'].includes(subject.lifeHopes.status)) assert(['not_asked', 'unavailable'].includes(plan.lifeHopes.status) && !plan.lifeHopes.evidenceIds.length, 'INVENTED_LIFE_HOPES');
  if (plan.lifeHopes.status === 'athlete_expressed') assert(plan.lifeHopes.evidenceIds.length > 0 && plan.lifeHopes.evidenceIds.every(id => subject.lifeHopes.evidenceIds.includes(id)), 'LIFE_HOPES_REQUIRE_DIRECT_ANSWER');
  const goals = new Map(plan.goals.map(g => [g.id, g]));
  assert(goals.size === plan.goals.length, 'DUPLICATE_GOAL');
  const athleteLifeGoals = plan.lifeHopes.status === 'athlete_expressed'
    ? plan.goals.filter(goal => goal.authorship === 'athlete_chosen' && goal.evidenceIds.some(id => plan.lifeHopes.evidenceIds.includes(id)))
    : [];
  const lifeDisposition = plan.life_direction_futures_disposition;
  const incompleteBeforeLifeDisposition = allowIncompleteArchitecture && !lifeDisposition;
  if (!incompleteBeforeLifeDisposition) {
    assert(lifeDisposition && lifeDisposition.explanation?.trim(), 'ATHLETE_LIFE_DIRECTION_DISPOSITION_REQUIRED');
    if (plan.lifeHopes.status === 'athlete_expressed') {
      assert(lifeDisposition.status !== 'not_available' && lifeDisposition.evidenceIds.length > 0
        && lifeDisposition.evidenceIds.every(id => plan.lifeHopes.evidenceIds.includes(id)), 'ATHLETE_LIFE_DIRECTION_DISPOSITION_MUST_USE_DIRECT_ANSWER');
    } else {
      assert(lifeDisposition.status === 'not_available' && lifeDisposition.evidenceIds.length === 0, 'ATHLETE_LIFE_DIRECTION_NOT_AVAILABLE');
    }
  }
  const futureSignatures = new Set();
  for (const future of plan.futures) {
    assert(future.condition && future.falsifier && future.reviewTrigger && future.evidenceIds.length && future.mechanismHypothesis && future.horizon && future.uncertainty, 'UNBOUNDED_FUTURE');
    assertProspectiveFalsifier(future.falsifier);
    const futureGoal = goals.get(future.athleteGoalId);
    assert(futureGoal && futureGoal.evidenceIds.length, 'FUTURE_REQUIRES_ATHLETE_OWNED_GOAL');
    assert(futureGoal.authorship === 'athlete_chosen' || (allowUnreadyFutures && futureGoal.authorship === 'athlete_undecided'), 'FUTURE_REQUIRES_ATHLETE_OWNED_GOAL');
    assert(future.baselineClaimIds.length > 0 && future.baselineClaimIds.every(id => seen.has(id)), 'FUTURE_BASELINE_REQUIRED');
    const signature = sha256Stable(normalizedSemanticValue({
      condition: future.condition,
      controllableActions: future.controllableActions,
      externalDependencies: future.externalDependencies,
      mechanismHypothesis: future.mechanismHypothesis,
      alternatives: future.alternatives,
      possibility: future.possibility,
      horizon: future.horizon,
      indicators: future.indicators,
      falsifier: future.falsifier,
      reviewTrigger: future.reviewTrigger,
    }));
    assert(!futureSignatures.has(signature), 'DUPLICATE_FUTURE_PATH');
    futureSignatures.add(signature);
  }
  if (!incompleteBeforeLifeDisposition && lifeDisposition.status === 'used_in_future') {
      const lifeGoalIds = new Set(athleteLifeGoals.map(({ id }) => id));
      assert(lifeGoalIds.size > 0 && plan.futures.some(future => lifeGoalIds.has(future.athleteGoalId)
        && future.evidenceIds.some(id => plan.lifeHopes.evidenceIds.includes(id))), 'ATHLETE_FUTURES_MUST_INCLUDE_DIRECT_LIFE_DIRECTION');
  }
  if (!incompleteBeforeLifeDisposition && plan.futures.length === 0) assert(['no_future_generated', 'not_available'].includes(lifeDisposition.status), 'ZERO_FUTURES_LIFE_DIRECTION_DISPOSITION_INVALID');
  assert(['explore', 'maintain', 'pause', 'ask_qualified_person', 'abstain'].includes(plan.move.kind), 'MOVE_NOT_ALLOWED');
  const incompleteStagePlaceholder = allowIncompleteArchitecture && plan.move.kind === 'abstain' && !plan.move.suggestion && !plan.move.purpose;
  if (!incompleteStagePlaceholder) {
    assert([
      plan.move.suggestion, plan.move.purpose, plan.move.whyThis, plan.move.proposedActor, plan.move.burden,
      plan.move.risk, plan.move.reversibility, plan.move.observation, plan.move.observationWindow,
      plan.move.reviewEvent, plan.move.falsifier, plan.move.inconclusiveIf, plan.move.stopOrAdjust, plan.move.uncertainty,
    ].every(value => value?.trim()), 'MOVE_SEMANTICS_REQUIRED');
    assert(plan.move.evidenceIds.length > 0 || subject.evidence.length === 0, 'MOVE_REQUIRES_EVIDENCE');
    assertProspectiveFalsifier(plan.move.falsifier);
  }
  assert(plan.move.stopOrAdjust && plan.move.uncertainty, 'MOVE_BOUNDARY_MISSING');
  if (subject.evidence.some(e => e.kind === 'reported_restriction')) assert(['ask_qualified_person', 'pause', 'abstain'].includes(plan.move.kind), 'QUALIFIED_RESTRICTION_NOT_RESPECTED');
  const wholeMechanismIds = new Set();
  for (const mechanism of plan.whole_person_model?.causal_mechanisms || []) {
    assert(mechanism.id?.trim() && !wholeMechanismIds.has(mechanism.id), 'WHOLE_PERSON_CAUSAL_ID_REQUIRED');
    wholeMechanismIds.add(mechanism.id);
    assert(mechanism.meaning?.trim() && mechanism.uncertainty?.trim() && mechanism.causalIds.length > 0 && mechanism.evidence_refs.length > 0, 'WHOLE_PERSON_CAUSAL_MEANING_REQUIRED');
    assert(mechanism.causalIds.every(id => causalSeen.has(id)), 'INVENTED_CAUSAL_REFERENCE');
  }
  for (const domain of plan.domains || []) assert(domain.causalIds.every(id => causalSeen.has(id)), 'INVENTED_CAUSAL_REFERENCE');
  for (const route of plan.surface_routes || []) assert(route.causalIds.every(id => causalSeen.has(id)), 'INVENTED_CAUSAL_REFERENCE');
  if (!allowIncompleteArchitecture && plan.futures.length === 0) {
    const futureRoute = plan.surface_routes.find(({ surfaceId }) => surfaceId === 'five_futures');
    const futureChapter = plan.chapters.find(({ id }) => id === 'five_futures');
    assert(futureRoute?.abstention?.trim(), 'ZERO_FUTURES_REQUIRES_VISIBLE_ABSTENTION');
    assert(!futureRoute.claimIds.length && !futureRoute.causalIds.length && !futureRoute.evidenceIds.length, 'ZERO_FUTURES_ROUTE_MUST_BE_EMPTY');
    assert(futureChapter?.unknowns?.some(value => value.trim() === futureRoute.abstention.trim()), 'ZERO_FUTURES_CHAPTER_ABSTENTION_REQUIRED');
  }
  validateCustomerFacingValues(plan);
  return plan;
}
export function resolveFutureReadiness(plan, subject) {
  // Surface readiness, not a semantic rewrite. A still-undecided goal cannot
  // authorize a ready Future. Keep the original candidate in the receipt.
  walkRefs(plan, new Map(subject.evidence.map(e => [e.id, e])));
  const goals = new Map(plan.goals.map(g => [g.id, g]));
  const deferred = [];
  const ready = plan.futures.filter(future => {
    const goal = goals.get(future.athleteGoalId);
    assert(goal, 'FUTURE_GOAL_REFERENCE_MISSING');
    if (goal.authorship === 'athlete_undecided') { deferred.push({ future, reason: 'ATHLETE_GOAL_NOT_YET_CHOSEN', status: 'NOT_ENOUGH_EVIDENCE' }); return false; }
    return true;
  });
  const futureAbstention = 'A possible direction has not become your chosen goal. There is not enough to draw a useful path around it yet.';
  const resolved = deferred.length ? {
    ...plan,
    futures: ready,
    unknowns: [...plan.unknowns, futureAbstention],
    chapters: plan.chapters.map((chapter) => chapter.id === 'five_futures'
      ? { ...chapter, claimIds: [], causalIds: [], evidenceIds: [], unknowns: [...new Set([...(chapter.unknowns || []), futureAbstention])] }
      : chapter),
    surface_routes: plan.surface_routes.map((route) => route.surfaceId === 'five_futures' && ready.length === 0
      ? { ...route, primaryRealization: futureAbstention, primaryEventRootIds: [], reusePurpose: '', claimIds: [], causalIds: [], evidenceIds: [], abstention: futureAbstention }
      : route),
  } : plan;
  validateInterpretation(resolved, subject);
  return { plan: resolved, receipt: { status: deferred.length ? 'PARTIAL_PROJECTION_WITH_EXPLICIT_ABSTENTION' : 'READY', deferred } };
}
export function normalizeIntake(snapshot, previous, now = new Date().toISOString()) {
  assert(snapshot?.metadata?.fictional === true, 'FICTIONAL_ONLY');
  assert(snapshot.metadata.ageBand === '14–17' || snapshot.metadata.ageBand === '18–20', 'AGE_BAND_REQUIRED');
  assert(snapshot.metadata.assent === true, 'SYNTHETIC_ASSENT_REQUIRED');
  assert(snapshot.responses && typeof snapshot.responses === 'object' && !Array.isArray(snapshot.responses), 'RESPONSES_OBJECT_REQUIRED');
  const questionIds = new Set(QUESTIONS.map(({ id }) => id));
  assert(Object.keys(snapshot.responses).every(id => questionIds.has(id)), 'UNKNOWN_RESPONSE_ID');
  const responses = {};
  const evidence = [];
  for (const q of QUESTIONS) {
    const input = snapshot.responses?.[q.id];
    if (!input) continue;
    assert(input && typeof input === 'object' && !Array.isArray(input), 'RESPONSE_OBJECT_REQUIRED');
    const knownInputKeys = new Set(['status', 'text', 'selected', 'eventRelation', 'eventTime', 'binding', 'conditions']);
    assert(Object.keys(input).every(key => knownInputKeys.has(key)), 'RESPONSE_FIELD_NOT_ALLOWED');
    const status = input.status || 'ANSWERED';
    assert(status === 'ANSWERED' || Object.hasOwn(MISSINGNESS, status), 'MISSINGNESS_INVALID');
    if (status === 'ANSWERED') {
      assert(EVENT_QUESTION_IDS.includes(q.id) || (!input.eventRelation && !input.eventTime), 'EVENT_FIELD_NOT_ALLOWED');
      assert(q.id === 'C15' || q.id === 'C16' || !input.binding, 'BINDING_FIELD_NOT_ALLOWED');
      assert(q.id === 'C15' || !input.conditions?.length, 'CONDITION_FIELD_NOT_ALLOWED');
    }
    const submittedText = String(input.text || '').trim();
    assert(submittedText.length <= 12000, 'ANSWER_TOO_LARGE');
    const text = status === 'ANSWERED' ? submittedText : '';
    const selected = status === 'ANSWERED' ? (input.selected || []) : [];
    const binding = status === 'ANSWERED' ? (input.binding || null) : null;
    const conditions = status === 'ANSWERED' ? (input.conditions || []) : [];
    assert(Array.isArray(selected) && Array.isArray(conditions), 'RESPONSE_LIST_INVALID');
    assert(q.kind === 'structured' || selected.length === 0, 'NARRATIVE_OPTION_NOT_ALLOWED');
    const options = optionsFor(q, snapshot.responses);
    if (status === 'ANSWERED' && q.kind === 'structured') {
      assert(Array.isArray(selected) && selected.length > 0 && selected.every(v => options.includes(v)), 'STRUCTURED_OPTION_INVALID');
      assert(q.multiple || selected.length === 1, 'ONE_OPTION_REQUIRED');
      if (q.multiple && selected.some(v => ['nothing I know of', 'unsure', 'prefer not to say'].includes(v))) assert(selected.length === 1, 'EXCLUSIVE_SUPPORT_OPTION');
    }
    if (status === 'ANSWERED' && q.kind === 'narrative') assert(text, 'ANSWER_OR_MISSINGNESS_REQUIRED');
    let rootId = q.id;
    let eventRelation = null;
    if (status === 'ANSWERED' && EVENT_QUESTION_IDS.includes(q.id)) {
      const rawRelation = status === 'ANSWERED' ? (input.eventRelation || null) : null;
      const kind = rawRelation?.kind || 'new';
      assert(kind === 'new' || kind === 'same', 'EVENT_RELATION_INVALID');
      if (kind === 'same') {
        const sourceId = String(rawRelation?.sourceId || '');
        const sourceIndex = EVENT_QUESTION_IDS.indexOf(sourceId);
        const currentIndex = EVENT_QUESTION_IDS.indexOf(q.id);
        assert(sourceIndex >= 0 && sourceIndex < currentIndex && (snapshot.responses[sourceId]?.status || 'ANSWERED') === 'ANSWERED' && String(snapshot.responses[sourceId]?.text || '').trim(), 'EVENT_RELATION_SOURCE_INVALID');
        const sourceEvidence = evidence.find(item => item.id === sourceId);
        assert(sourceEvidence?.rootId, 'EVENT_RELATION_SOURCE_INVALID');
        rootId = sourceEvidence.rootId;
        eventRelation = { kind, sourceId };
      } else eventRelation = { kind: 'new', sourceId: null };
    }
    if (status === 'ANSWERED' && ['C15', 'C16'].includes(q.id)) assert(String(binding?.label || '').trim(), 'EVENT_OR_TASK_BINDING_REQUIRED');
    if (status === 'ANSWERED' && q.id === 'C15') {
      const sourceId = String(binding?.sourceId || binding?.id || '');
      assert(EVENT_QUESTION_IDS.includes(sourceId) && String(snapshot.responses[sourceId]?.text || '').trim() === binding.label, 'EXACT_EVENT_BINDING_REQUIRED');
      const sourceEvidence = evidence.find(item => item.id === sourceId);
      assert(sourceEvidence?.rootId, 'EXACT_EVENT_BINDING_REQUIRED');
      rootId = sourceEvidence.rootId;
    }
    if (status === 'ANSWERED' && q.id === 'C16') {
      const sourceId = String(binding?.sourceId || binding?.id || '');
      const answeredSource = sourceId !== q.id && QUESTIONS.some(({ id }) => id === sourceId) && (snapshot.responses[sourceId]?.status || 'ANSWERED') === 'ANSWERED'
        && (String(snapshot.responses[sourceId]?.text || '').trim() || (snapshot.responses[sourceId]?.selected || []).length);
      assert(sourceId === 'new-task' || answeredSource, 'EXACT_TASK_BINDING_REQUIRED');
      if (sourceId !== 'new-task') {
        const sourceEvidence = evidence.find(item => item.id === sourceId);
        assert(sourceEvidence?.rootId, 'EXACT_TASK_BINDING_REQUIRED');
        rootId = sourceEvidence.rootId;
      }
    }
    const content = [text, ...selected].filter(Boolean).join(' | ');
    const sourceKind = status !== 'ANSWERED'
      ? 'missingness'
      : q.id === 'C18'
        ? (selected.includes('instructions from a qualified professional') ? 'reported_restriction' : 'support_limit_report')
        : 'self_report';
    const saved = { questionId: q.id, questionVersion: INTAKE_VERSION, wording: wording(q, snapshot.metadata.ageBand, snapshot.responses), text, selected, status, binding, eventRelation, conditions, eventTime: status === 'ANSWERED' ? (input.eventTime || null) : null, capturedAt: now, sourceActor: 'fictional_athlete', sourceKind, assistance: snapshot.metadata.assistance || 'none', coPresence: snapshot.metadata.coPresence || 'none', permission: { audience: 'private', purpose: 'synthetic_athlete_bos', version: 'P0-demo-v1', expiresAt: null } };
    responses[q.id] = saved;
    if (status === 'ANSWERED') evidence.push({ id: q.id, rootId, text: content, actor: 'athlete', kind: saved.sourceKind, audience: 'private', eventTime: saved.eventTime, binding: saved.binding, eventRelation: saved.eventRelation, conditions: saved.conditions });
  }
  const c01 = responses.C01;
  return { ...previous, revision: (previous?.revision || 0) + 1, synthetic: true, id: 'synthetic-athlete-intake', relationshipId: 'synthetic-athlete-relationship-intake', name: 'Lio', ageBand: snapshot.metadata.ageBand, sport: 'fictional multisport athlete', capturedAt: now, intakeVersion: INTAKE_VERSION, responses, evidence, corrections: previous?.corrections || [], lifeHopes: { status: c01?.status || 'NOT_ASKED', evidenceIds: c01?.status === 'ANSWERED' ? ['C01'] : [] } };
}
export const stateHash = subject => sha256Stable(subject);

export function deriveProjectionContracts(plan, subject, audience, identity) {
  const scope = { subjectId: subject.id, relationshipId: subject.relationshipId, audience, purpose: 'synthetic_athlete_bos', sourceHash: stateHash(subject), asOf: subject.corrections?.at(-1)?.capturedAt || subject.capturedAt, permissionVersion: audience === 'coach' ? 'M1' : 'P0-demo-v1' };
  return {
    ...scope, version: CONTRACT, allowedActions: audience === 'athlete' ? ['inspect_authorized_evidence', 'correct_exact_claim'] : ['inspect_authorized_evidence'],
    futurePaths: plan.futures.map((f, index) => ({ ...f, id: `${identity}:future:${index + 1}`, version: 1, ...scope, baselineAsOf: subject.capturedAt, status: 'CONDITIONAL_NOT_PREDICTIVE' })),
    moveSuggestion: { ...plan.move, id: `${identity}:move:1`, version: 1, ...scope, acceptanceState: 'NOT_ACCEPTED', exactSuggestionHash: sha256Stable(plan.move), executionState: 'NOT_RECORDED', outcomeState: 'NOT_RECORDED', dataScope: 'private fictional relationship only' },
  };
}
