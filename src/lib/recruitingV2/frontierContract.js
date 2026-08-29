import { EMPHASIS, INTERACTIVE_PRIMITIVES, RECRUITING_V2_PLAN_VERSION, VISUAL_PRIMITIVES } from './creationLanguage.js';

export const FRONTIER_RUNTIME_VERSION = 'recruiting-v2-frontier-runtime-003a-v1';
export const FRONTIER_MODEL_CONFIG = Object.freeze({
  gateway: 'OpenRouter',
  requestedProvider: 'OpenAI',
  model: 'openai/gpt-5.6-luna',
  reasoningEffort: 'low',
  maxOutputTokens: 4200,
  providerFallbacks: false,
  store: false,
  structuredOutput: 'strict-json-schema',
  timeoutMs: 75_000,
});

const text = (maxLength = 1200) => ({ type: 'string', minLength: 1, maxLength });
const ids = (maxItems = 20, minItems = 0) => ({ type: 'array', minItems, maxItems, items: { type: 'string', minLength: 1, maxLength: 140 } });

export const FRONTIER_SURFACE_PLAN_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['planVersion', 'stateBinding', 'purpose', 'guidance', 'hypotheses', 'blocks', 'interactions', 'completion'],
  properties: {
    planVersion: { type: 'string', const: RECRUITING_V2_PLAN_VERSION },
    stateBinding: {
      type: 'object', additionalProperties: false,
      required: ['worldId', 'worldVersion', 'worldHash', 'sessionId', 'sessionRevision', 'sessionContextHash'],
      properties: {
        worldId: { type: 'string' }, worldVersion: { type: 'string' }, worldHash: { type: 'string' },
        sessionId: { type: 'string' }, sessionRevision: { type: 'integer', minimum: 0 }, sessionContextHash: { type: 'string' },
      },
    },
    purpose: {
      type: 'object', additionalProperties: false,
      required: ['humanWords', 'interpretedPurpose', 'meetingNeed', 'materiallyChanged'],
      properties: {
        humanWords: text(4000), interpretedPurpose: text(500), meetingNeed: text(240), materiallyChanged: { type: 'boolean' },
      },
    },
    guidance: {
      type: 'object', additionalProperties: false,
      required: ['eyebrow', 'headline', 'summary', 'nextCue', 'whyThisEnvironment'],
      properties: { eyebrow: text(80), headline: text(320), summary: text(1000), nextCue: text(400), whyThisEnvironment: text(700) },
    },
    hypotheses: {
      type: 'array', maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['hypothesisId', 'statement', 'confidence', 'evidenceIds', 'counterEvidenceIds', 'missingEvidenceIds', 'supersedesHypothesisId', 'revisionReason'],
        properties: {
          hypothesisId: { type: 'string', pattern: '^hypothesis-[a-z0-9-]{3,80}$' }, statement: text(800),
          confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'UNRESOLVED'] },
          evidenceIds: ids(10, 1), counterEvidenceIds: ids(10), missingEvidenceIds: ids(10),
          supersedesHypothesisId: { type: ['string', 'null'] }, revisionReason: text(500),
        },
      },
    },
    blocks: {
      type: 'array', maxItems: 7,
      items: {
        type: 'object', additionalProperties: false,
        required: ['blockId', 'type', 'title', 'subtitle', 'objectIds', 'evidenceIds', 'emphasis', 'reason'],
        properties: {
          blockId: { type: 'string', pattern: '^block-[a-z0-9-]{3,80}$' }, type: { type: 'string', enum: VISUAL_PRIMITIVES },
          title: text(180), subtitle: text(420), objectIds: ids(8, 1), evidenceIds: ids(16),
          emphasis: { type: 'string', enum: EMPHASIS }, reason: text(500),
        },
      },
    },
    interactions: {
      type: 'array', minItems: 1, maxItems: 8,
      items: { type: 'string', enum: INTERACTIVE_PRIMITIVES.filter((item) => item !== 'RESET_SYNTHETIC_SESSION') },
    },
    completion: {
      type: 'object', additionalProperties: false,
      required: ['recommendation', 'ready', 'summary', 'nextStep'],
      properties: {
        recommendation: { type: 'string', enum: ['CONTINUE', 'CONDITIONAL_FIT', 'NEED_MORE_EVIDENCE', 'NOT_YET', 'NO_SUPPORTED_FIT', 'READY_TO_COMPLETE'] },
        ready: { type: 'boolean' }, summary: text(800), nextStep: text(600),
      },
    },
  },
});

const KIND_BY_BLOCK = Object.freeze({
  METRIC_STRIP: ['METRICS'], LINE_CHART: ['TIME_SERIES'], BAR_CHART: ['TIME_SERIES', 'COMPARISON', 'METRICS'],
  TIMELINE: ['TIMELINE'], FUNNEL: ['FUNNEL'], TRAJECTORY: ['FUTURES', 'TIME_SERIES'], FIVE_FUTURES: ['FUTURES'],
  PERSON: ['PERSON'], RELATIONSHIP: ['RELATIONSHIP', 'PERSON'], CONSTRAINT: ['BUSINESS_TWIN', 'EVIDENCE_GAP', 'INTERVENTION'],
  SCENARIO: ['SCENARIO'], EVIDENCE_GAP: ['EVIDENCE_GAP'], HYPOTHESIS: ['BUSINESS_TWIN', 'EVIDENCE_GAP', 'INTERVENTION', 'TIME_SERIES', 'COMPARISON'],
  COMMITMENTS: ['INTERVENTION', 'LOCAL_OPPORTUNITY'], DECISION: ['INTERVENTION', 'LOCAL_OPPORTUNITY', 'RELATIONSHIP'],
  COMPARISON: ['COMPARISON', 'METRICS', 'LOCAL_OPPORTUNITY', 'TIME_SERIES', 'PERSON'],
  PLAIN_LANGUAGE: ['BUSINESS_TWIN', 'RELATIONSHIP', 'INTERVENTION', 'LOCAL_OPPORTUNITY', 'EVIDENCE_GAP', 'PERSON'],
  QUESTION: ['BUSINESS_TWIN', 'RELATIONSHIP', 'INTERVENTION', 'LOCAL_OPPORTUNITY', 'EVIDENCE_GAP', 'PERSON', 'METRICS', 'TIME_SERIES'],
});

function normalizeNumberToken(token) {
  return token.replaceAll(',', '').replace(/^\$/, '').replace(/\.$/u, '');
}

function numericTokens(value) {
  return String(value || '').match(/\$?\d[\d,.]*(?:%|M|K)?/gu)?.map(normalizeNumberToken) || [];
}

function proseValues(plan) {
  return [
    plan?.purpose?.interpretedPurpose, plan?.purpose?.meetingNeed,
    ...Object.values(plan?.guidance || {}),
    ...(plan?.hypotheses || []).flatMap((item) => [item.statement, item.revisionReason]),
    ...(plan?.blocks || []).flatMap((item) => [item.title, item.subtitle, item.reason]),
    plan?.completion?.summary, plan?.completion?.nextStep,
  ];
}

export function exactStateBinding({ world, worldHash, sessionContext, sessionContextHash }) {
  return Object.freeze({
    worldId: world.worldId, worldVersion: world.version, worldHash,
    sessionId: sessionContext.sessionId, sessionRevision: sessionContext.revision, sessionContextHash,
  });
}

export function validateFrontierPlan({ candidate, world, stateBinding, priorHypotheses = [], sessionContext = null }) {
  const errors = [];
  if (!candidate || candidate.planVersion !== RECRUITING_V2_PLAN_VERSION) errors.push('PLAN_VERSION_INVALID');
  if (JSON.stringify(candidate?.stateBinding) !== JSON.stringify(stateBinding)) errors.push('STATE_BINDING_INVALID');
  const objectMap = new Map(world.objects.map((item) => [item.id, item]));
  const evidenceIds = new Set(world.evidence.map((item) => item.id));
  const blockIds = new Set();
  const blockCompositions = new Set();
  const selectedEvidence = new Set();
  for (const block of candidate?.blocks || []) {
    if (blockIds.has(block.blockId)) errors.push(`BLOCK_ID_DUPLICATE:${block.blockId}`);
    blockIds.add(block.blockId);
    const visualFamily = ['FIVE_FUTURES', 'TRAJECTORY'].includes(block.type) ? 'FUTURES_TRAJECTORY' : block.type;
    const compositionKey = `${visualFamily}:${[...(block.objectIds || [])].sort().join(',')}`;
    if (blockCompositions.has(compositionKey)) errors.push(`BLOCK_COMPOSITION_DUPLICATE:${block.blockId}`);
    blockCompositions.add(compositionKey);
    const objects = (block.objectIds || []).map((id) => objectMap.get(id));
    if (objects.some((item) => !item)) errors.push(`BLOCK_OBJECT_SCOPE_DENIED:${block.blockId}`);
    const allowedKinds = KIND_BY_BLOCK[block.type] || [];
    const semanticallyOpenBlock = ['QUESTION', 'PLAIN_LANGUAGE', 'HYPOTHESIS'].includes(block.type);
    if (!semanticallyOpenBlock && objects.filter(Boolean).length && !objects.filter(Boolean).some((item) => allowedKinds.includes(item.kind))) errors.push(`BLOCK_KIND_INCOMPATIBLE:${block.blockId}`);
    for (const id of block.evidenceIds || []) {
      if (!evidenceIds.has(id)) errors.push(`BLOCK_EVIDENCE_SCOPE_DENIED:${id}`);
      selectedEvidence.add(id);
    }
    for (const item of objects.filter(Boolean)) for (const id of item.sourceIds || []) selectedEvidence.add(id);
  }
  const priorIds = new Set(priorHypotheses.map((item) => item.hypothesisId));
  const hypothesisIds = new Set();
  for (const hypothesis of candidate?.hypotheses || []) {
    if (hypothesisIds.has(hypothesis.hypothesisId)) errors.push(`HYPOTHESIS_ID_DUPLICATE:${hypothesis.hypothesisId}`);
    hypothesisIds.add(hypothesis.hypothesisId);
    for (const id of [...(hypothesis.evidenceIds || []), ...(hypothesis.counterEvidenceIds || []), ...(hypothesis.missingEvidenceIds || [])]) {
      if (!evidenceIds.has(id)) errors.push(`HYPOTHESIS_EVIDENCE_SCOPE_DENIED:${id}`);
    }
    if (hypothesis.supersedesHypothesisId && !priorIds.has(hypothesis.supersedesHypothesisId)) errors.push(`HYPOTHESIS_LINEAGE_INVALID:${hypothesis.supersedesHypothesisId}`);
  }
  const permitted = new Set(INTERACTIVE_PRIMITIVES);
  for (const action of candidate?.interactions || []) if (!permitted.has(action)) errors.push(`ACTION_DENIED:${action}`);
  const allowedNumbers = new Set(numericTokens(JSON.stringify(world)));
  for (const token of numericTokens(JSON.stringify(sessionContext?.scenarioAssumptions || {}))) allowedNumbers.add(token);
  for (const value of proseValues(candidate)) {
    for (const token of numericTokens(value)) if (!allowedNumbers.has(token)) errors.push(`INVENTED_NUMERIC_CLAIM:${token}`);
  }
  const serialized = JSON.stringify(candidate || {});
  if (/compatibility score|fit percentage|guaranteed|close (?:him|her|them)|overcome objection|manipulat|persuad/iu.test(serialized)) errors.push('RECRUITING_PERSUASION_OR_SCORE_LANGUAGE_DENIED');
  if ((candidate?.completion?.recommendation === 'READY_TO_COMPLETE') !== Boolean(candidate?.completion?.ready)) errors.push('COMPLETION_READINESS_CONTRADICTION');
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), selectedEvidenceIds: Object.freeze([...selectedEvidence]) });
}

export function materializeFrontierPlan({ candidate, world, validation, providerReceipt }) {
  if (!validation?.ok) throw new Error('RECRUITING_V2_INVALID_PLAN_CANNOT_RENDER');
  const objectMap = new Map(world.objects.map((item) => [item.id, item]));
  const evidenceMap = new Map(world.evidence.map((item) => [item.id, item]));
  return Object.freeze({
    ...candidate,
    blocks: candidate.blocks.map((block) => Object.freeze({
      ...block,
      objects: Object.freeze(block.objectIds.map((id) => objectMap.get(id))),
      evidence: Object.freeze([...new Set([...block.evidenceIds, ...block.objectIds.flatMap((id) => objectMap.get(id)?.sourceIds || [])])].map((id) => evidenceMap.get(id)).filter(Boolean)),
    })),
    evidence: Object.freeze(validation.selectedEvidenceIds.map((id) => evidenceMap.get(id)).filter(Boolean)),
    providerReceipt: Object.freeze(providerReceipt),
  });
}
