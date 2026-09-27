import { randomUUID } from 'node:crypto';
import { validatePlan } from '../athleteConsultingV2/state.js';
import { hashCanonicalJson } from '../../src/lib/intelligenceFabric/hashing.js';

export function createAthleteVisualCore(policy) {
  if (!policy || !Object.isFrozen(policy) || !['assertWorldInput', 'visualBinding', 'classification', 'validateAcceptedPlan', 'mapChange'].every(key => typeof policy[key] === 'function')) throw new TypeError('ATHLETE_VISUAL_POLICY_REQUIRED');
  const ATHLETE_VISUAL_PLAN_VERSION = policy.planVersion;
const ATHLETE_VISUAL_EVENTS = Object.freeze(['SESSION_OPENING', 'COACHING_MOMENT', 'SESSION_FINALIZATION']);
const BLOCK_TYPES = Object.freeze(['PLAIN_LANGUAGE', 'COMPARISON', 'TIMELINE', 'FIVE_FUTURES', 'DECISION', 'COMMITMENTS', 'EVIDENCE_GAP']);
const EMPHASIS = Object.freeze(['quiet', 'normal', 'strong']);
// Every free-text field that can reach the visual UI is fixed by the server.
// The model still chooses eligible objects and layout, but cannot add a new
// claim, coach commitment, or outcome in a heading or explanatory sentence.
const PRESENTATION_COPY = Object.freeze({
  SESSION_OPENING: Object.freeze({ eyebrow: 'YOUR STARTING POINT', headline: 'A clearer view',
    summary: 'These saved perspectives are here to discuss, not a new agreement.',
    nextCue: 'What fits from your point of view?' }),
  COACHING_MOMENT: Object.freeze({ eyebrow: 'IN THIS MOMENT', headline: 'A clearer view',
    summary: 'These saved perspectives may help compare what is possible.',
    nextCue: 'What fits from your point of view?' }),
  SESSION_FINALIZATION: Object.freeze({ eyebrow: 'BEFORE YOU GO', headline: 'A moment to review',
    summary: 'This is a review of the conversation, not approval of a plan or assessment change.',
    nextCue: 'You can review any proposal before choosing what to keep.' }),
});
const BLOCK_COPY = Object.freeze({
  PLAIN_LANGUAGE: Object.freeze({ title: 'A saved perspective', subtitle: 'Read the source-backed details below.' }),
  COMPARISON: Object.freeze({ title: 'Side by side', subtitle: 'These are possibilities to compare, not decisions already made.' }),
  TIMELINE: Object.freeze({ title: 'Across your conversations', subtitle: 'Dated discussion is not proof that an action happened.' }),
  FIVE_FUTURES: Object.freeze({ title: 'Possible paths', subtitle: 'These are conditional possibilities, not predictions.' }),
  DECISION: Object.freeze({ title: 'A choice to consider', subtitle: 'A suggestion is not an agreed plan.' }),
  COMMITMENTS: Object.freeze({ title: 'Plan and proposal status', subtitle: 'Read the saved status of each item below.' }),
  EVIDENCE_GAP: Object.freeze({ title: 'What remains open', subtitle: 'These details are for discussion, not certainty.' }),
});
const RENDER_REASON = 'The selected saved objects can help this moment.';
const NO_RENDER_REASON = 'Conversation is enough without a visual.';
const BLOCK_REASON = 'This view uses only the selected saved objects.';
const text = (maxLength) => ({ type: 'string', minLength: 1, maxLength });
const ids = (maxItems, minItems = 0) => ({ type: 'array', minItems, maxItems, items: text(140) });

// Only the server chooses the event, owns the objects, and binds a result to an
// exact synthetic athlete, baseline reports, current APA, session, and request.
// The model may compose a visual, but it cannot create an interaction or fact.
const ATHLETE_VISUAL_OUTPUT_SCHEMA = Object.freeze({
  type: 'json_schema', name: policy.schemaName, strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['planVersion', 'event', 'stateBinding', 'renderDecision', 'guidance', 'blocks', 'interactions'],
    properties: {
      planVersion: { type: 'string', const: ATHLETE_VISUAL_PLAN_VERSION },
      event: { type: 'string', enum: ATHLETE_VISUAL_EVENTS },
      stateBinding: {
        type: 'object', additionalProperties: false,
        required: ['sessionId', 'relationshipScopeHash', 'mm', 'bosHash', 'baselineApaHash', 'currentApaHash', 'currentApaVersion', 'stateRevision', 'triggerRequestId', 'triggerHash', ...Object.keys(policy.bindingProperties || {})],
        properties: {
          sessionId: text(160), relationshipScopeHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          mm: text(100), bosHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          baselineApaHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          currentApaHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          currentApaVersion: text(100), stateRevision: { type: 'integer', minimum: 0 },
          triggerRequestId: text(160), triggerHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          ...(policy.bindingProperties || {}),
        },
      },
      renderDecision: { type: 'object', additionalProperties: false, required: ['render', 'reason'],
        properties: { render: { type: 'boolean' }, reason: text(280) } },
      guidance: { type: 'object', additionalProperties: false,
        required: ['eyebrow', 'headline', 'summary', 'nextCue'],
        properties: { eyebrow: text(90), headline: text(220), summary: text(900), nextCue: text(520) } },
      blocks: { type: 'array', minItems: 0, maxItems: 2, items: {
        type: 'object', additionalProperties: false,
        required: ['blockId', 'type', 'title', 'subtitle', 'objectIds', 'evidenceIds', 'emphasis', 'reason'],
        properties: {
          blockId: { type: 'string', pattern: '^athlete-block-[a-z0-9-]{3,80}$' },
          type: { type: 'string', enum: BLOCK_TYPES }, title: text(180), subtitle: text(420),
          objectIds: ids(4, 1), evidenceIds: ids(10), emphasis: { type: 'string', enum: EMPHASIS }, reason: text(420),
        },
      } },
      interactions: { type: 'array', maxItems: 0, items: { type: 'string' } },
    },
  },
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const exactCopy = (actual, expected) => object(actual) && object(expected)
  && Object.keys(actual).length === Object.keys(expected).length
  && Object.entries(expected).every(([key, value]) => actual[key] === value);
const exactCanonical = (actual, expected) => {
  try { return hashCanonicalJson(actual) === hashCanonicalJson(expected); }
  catch { return false; }
};
const string = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const bounded = (value, limit) => string(value).slice(0, limit);

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    if (!Object.isFrozen(value)) Object.freeze(value);
  }
  return value;
}

function visualObject(id, kind, title, statement, sourceIds, extra = {}) {
  return { id, kind, title, statement: bounded(statement, 1300), sourceIds, ...extra };
}

function normalizeCurrentApa(currentApa, bundle) {
  if (!currentApa) return { apa: bundle.apa, version: 'baseline' };
  const apa = currentApa.artifact || currentApa.apa || currentApa;
  if (!object(apa) || !object(apa.report) || !object(apa.move)) throw new Error('ATHLETE_VISUAL_CURRENT_APA_INVALID');
  for (const mm of [apa.mm, apa.identity?.mm, currentApa.mm]) {
    if (mm && mm !== bundle.person.mm) throw new Error('ATHLETE_VISUAL_SOURCE_SCOPE_DENIED');
  }
  for (const baselineHash of [currentApa.baselineApaHash, currentApa.baseline_apa_hash, currentApa.baseline_hash]) {
    if (baselineHash && baselineHash !== bundle.apa.artifact_sha256) throw new Error('ATHLETE_VISUAL_SOURCE_SCOPE_DENIED');
  }
  if (apa.artifact_sha256 === bundle.apa.artifact_sha256 && JSON.stringify(apa) !== JSON.stringify(bundle.apa))
    throw new Error('ATHLETE_VISUAL_CURRENT_APA_INVALID');
  if (apa.artifact_sha256 && apa.artifact_sha256 !== bundle.apa.artifact_sha256) {
    const { artifact_sha256: claimed, ...body } = apa;
    if (!/^[a-f0-9]{64}$/u.test(claimed) || hashCanonicalJson(body) !== claimed)
      throw new Error('ATHLETE_VISUAL_CURRENT_APA_INVALID');
  }
  return { apa, version: String(currentApa.publicationVersion ?? currentApa.version ?? 'current') };
}

function sourcesAndObjects({ bundle, state, apa, apaHash, event, input }) {
  const learning = policy.approvedLearning ? policy.approvedLearning(state, bundle) : state.learning;
  const sources = [
    { id: 'athlete-source-bos', label: 'Saved Youth BOS', classification: policy.classification('BASELINE', bundle), hash: bundle.bos.artifact_sha256 },
  ];
  const objects = [
    visualObject('athlete-bos', 'BOS_ORIENTATION', 'Understanding you', bundle.bos.reading?.portrait?.headline || bundle.bos.reading?.map_intro, ['athlete-source-bos']),
  ];
  // A confirmed correction or retraction invalidates the prior APA as a
  // current coaching source. Keep its hash in the binding for custody, but do
  // not offer any APA-derived object to the composer until publication clears
  // the review flag for this exact athlete.
  if (state.apaNeedsReview !== true) {
    sources.push({ id: 'athlete-source-apa', label: 'Current Youth APA', classification: policy.classification('GOVERNED', bundle), hash: apaHash });
    objects.push(visualObject('athlete-apa', 'APA_PERSPECTIVE', 'Your sport and life now', apa.report?.opening || apa.report?.headline, ['athlete-source-apa'],
      { qualifier: bounded(apa.confirmation?.priority, 420) }));
  if (apa.move?.action) objects.push(visualObject('athlete-one-move', 'RECOMMENDATION', 'A possible next move', apa.move.action,
    ['athlete-source-apa'], { qualifier: 'An assessment suggestion, not an agreed plan.', items: [
      { label: 'Why it may fit', value: bounded(apa.move.why, 400) },
      { label: 'When', value: bounded(apa.move.when, 180) },
    ] }));
  // The saved APA includes evaluated alternatives. Only candidates that passed
  // every recorded fit gate may be compared; rejected arms are not suggestions.
  // A later current APA version supplies its own current candidate set here.
  for (const option of list(apa.report?.candidates)
    .filter((item) => /^[A-Za-z0-9_-]{1,24}$/u.test(item?.candidate_id || '')
      && string(item.action) && list(item.gates).length > 0
      && item.gates.every((gate) => gate.pass === true)).slice(0, 3)) {
    objects.push(visualObject(`athlete-option-${option.candidate_id.toLowerCase()}`, 'APA_OPTION',
      option.candidate_id === apa.move?.candidate_id ? 'Current assessment suggestion' : 'Another assessed option',
      option.action, ['athlete-source-apa'], {
        qualifier: 'An assessed possibility, not an agreed plan or a new coach commitment.',
        items: [
          { label: 'Why it may fit', value: bounded(option.why, 360), note: '' },
          { label: 'When', value: bounded(option.when, 240), note: '' },
          { label: 'What to notice', value: bounded(option.progress_signal, 280), note: '' },
        ],
        sourceRefs: list(option.refs).slice(0, 12),
      }));
  }
  if (Array.isArray(apa.report?.futures) && apa.report.futures.length) {
    objects.push(visualObject('athlete-futures', 'FUTURES', 'Five possible paths',
      'Conditional possibilities, not predictions or a score of the athlete.', ['athlete-source-apa'],
      { items: apa.report.futures.slice(0, 5).map((future) => ({ label: bounded(future.headline, 150),
        value: bounded(future.conditions, 250), note: bounded(future.first_sign, 250) })) }));
  }
  }
  if (state.plan) {
    validatePlan(state.plan);
    policy.validateAcceptedPlan(state.plan, bundle, state);
    sources.push({ id: 'athlete-source-plan', label: 'Exact approved plan', classification: policy.classification('APPROVED', bundle), hash: hashCanonicalJson(state.plan) });
    objects.push(visualObject('athlete-plan', 'ACCEPTED_PLAN', 'Your agreed plan', state.plan.title,
      ['athlete-source-plan'], { qualifier: bounded(state.plan.why, 400), items: list(state.plan.steps).slice(0, 8)
        .map((step) => ({ label: bounded(step.action, 250), value: bounded(step.when, 120),
          note: `${step.owner === 'coach' ? 'Coach' : 'Athlete'} · ${bounded(step.notice, 160)}` })) }));
  }
  if (state.draft) {
    validatePlan(state.draft);
    sources.push({ id: 'athlete-source-draft', label: 'Unapproved plan proposal', classification: policy.classification('PROPOSED_ONLY', bundle), hash: state.draft.hash || hashCanonicalJson(state.draft) });
    objects.push(visualObject('athlete-draft', 'PROPOSED_PLAN', 'For your review', state.draft.title,
      ['athlete-source-draft'], { qualifier: 'This proposal has not changed the agreed plan.', items: list(state.draft.steps).slice(0, 8)
        .map((step) => ({ label: bounded(step.action, 250), value: bounded(step.when, 120),
          note: `${step.owner === 'coach' ? 'Coach' : 'Athlete'} · ${bounded(step.notice, 160)}` })) }));
  }
  if (learning?.length) {
    sources.push({ id: 'athlete-source-learning', label: 'Athlete-approved coaching preferences', classification: policy.classification('APPROVED', bundle), hash: hashCanonicalJson(learning) });
    objects.push(visualObject('athlete-learning', 'APPROVED_LEARNING', 'What you asked MORE to remember',
      'Only these preferences or corrections were approved for future coaching.', ['athlete-source-learning'],
      { items: learning.slice(-4).map((item) => ({ label: bounded(item.text, 300), value: '', note: '' })) }));
  }
  const prior = state.sessions?.at(-1);
  if (prior) {
    sources.push({ id: 'athlete-source-prior-session', label: 'Dated prior session recap', classification: policy.classification('SESSION_RECAP', bundle), hash: hashCanonicalJson(prior) });
    objects.push(visualObject('athlete-prior-session', 'PRIOR_SESSION', 'Earlier conversation', prior.summary,
      ['athlete-source-prior-session'], { qualifier: 'A dated discussion recap, not proof that an open action happened.', at: prior.at }));
  }
  let mapChange = null;
  if (event === 'SESSION_FINALIZATION') {
    if (!string(state.closing?.summary)) throw new Error('ATHLETE_VISUAL_FINALIZATION_NOT_ELIGIBLE');
    mapChange = policy.mapChange({ ...input, bundle, state, startMap: state.sessionStartMap });
    sources.push(...mapChange.sources);
    objects.push(mapChange.object);
    sources.push({ id: 'athlete-source-session-recap', label: 'Current unconfirmed closing review', classification: policy.classification('SESSION_REVIEW_ONLY', bundle), hash: hashCanonicalJson(state.closing) });
    objects.push(visualObject('athlete-session-recap', 'SESSION_RECAP', 'Before you go', state.closing.summary,
      ['athlete-source-session-recap'], { qualifier: bounded(state.closing.continuity, 420) }));
  }
  return { sources, objects, mapChange };
}

function buildAthleteVisualWorld(input = {}) {
  const { event, bundle, state, scopeId, sessionId, triggerRequestId, currentApa = null, currentExchange = null } = input;
  if (!ATHLETE_VISUAL_EVENTS.includes(event)) throw new Error('ATHLETE_VISUAL_EVENT_INVALID');
  policy.assertWorldInput(input);
  const sourceBinding = policy.visualBinding(input);
  if (!string(scopeId) || !string(sessionId) || !string(triggerRequestId)
    || !Number.isSafeInteger(state.revision) || state.revision < 0) throw new Error('ATHLETE_VISUAL_BINDING_INVALID');
  if (currentExchange && event !== 'COACHING_MOMENT') throw new Error('ATHLETE_VISUAL_EXCHANGE_EVENT_DENIED');
  const { apa, version } = policy.readCurrentApa ? policy.readCurrentApa(input) : normalizeCurrentApa(currentApa, bundle);
  const currentApaHash = apa === bundle.apa ? bundle.apa.artifact_sha256 : apa.artifact_sha256 || hashCanonicalJson(apa);
  const { sources, objects, mapChange } = sourcesAndObjects({ bundle, state, apa, apaHash: currentApaHash, event, input });
  const exchange = currentExchange && typeof currentExchange === 'object'
    && string(currentExchange.athleteMessage) && string(currentExchange.coachMessage)
    ? { athleteMessage: bounded(currentExchange.athleteMessage, 5000), coachMessage: bounded(currentExchange.coachMessage, 12000),
      classification: 'CURRENT_SESSION_EPHEMERAL_NONCANONICAL' } : null;
  if (currentExchange && !exchange) throw new Error('ATHLETE_VISUAL_EXCHANGE_INVALID');
  const triggerHash = hashCanonicalJson({ event, sessionId, triggerRequestId, revision: state.revision,
    currentApaHash, apaNeedsReview: state.apaNeedsReview === true,
    planHash: state.plan ? hashCanonicalJson(state.plan) : null,
    draftHash: state.draft ? hashCanonicalJson(state.draft) : null,
    closingHash: state.closing ? hashCanonicalJson(state.closing) : null,
    mapChangeHash: mapChange ? hashCanonicalJson(mapChange) : null,
    exchangeHash: exchange ? hashCanonicalJson(exchange) : null });
  return deepFreeze({ contract: policy.worldContract, event,
    stateBinding: { sessionId, ...sourceBinding, currentApaHash, currentApaVersion: version,
      stateRevision: state.revision, triggerRequestId, triggerHash },
    objects, evidence: sources,
    presentationCopy: { guidance: PRESENTATION_COPY[event], renderReason: RENDER_REASON,
      noRenderReason: NO_RENDER_REASON, blockReason: BLOCK_REASON, blocksByType: BLOCK_COPY },
    eligibleObjectIdsByBlockType: Object.fromEntries(BLOCK_TYPES.map(type => [type,
      objects.filter(item => KIND_BY_BLOCK[type].includes(item.kind)).map(item => item.id)])),
    ...(exchange ? { currentExchange: { ...exchange,
      use: 'Use only to decide whether a visual helps now; it grants no fact, evidence, commitment or mutation authority.' } } : {}),
    truthBoundaries: {
      values: 'Use only supplied object and evidence IDs. Never invent facts, numbers, commitments, outcomes or causes.',
      plan: 'A recommendation and unapproved draft are not an agreed plan. A visual never approves or changes a plan.',
      coach: 'A Coach Alex observation is attributed and unverified until appropriately confirmed; never promote it to athlete fact.',
      map: mapChange?.comparison === 'UNAVAILABLE_START_SNAPSHOT'
        ? 'This earlier session has no saved start map. Show only the current saved state and explicitly say before-and-after comparison is unavailable.'
        : state.apaNeedsReview === true
        ? 'The earlier APA awaits athlete review after a confirmed correction or retraction. Do not present its claims as current. Only a separate validated current APA publication can clear this.'
        : 'This visual cannot revise the BOS or APA; only a separate validated current APA publication can do that.',
      authority: 'No interaction, customer mutation, message, billing, or external-action authority.',
    } });
}

function matches(value, schema) {
  if (schema.type === 'object') return object(value)
    && schema.required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => Object.hasOwn(schema.properties, key))
    && Object.entries(schema.properties).every(([key, child]) => matches(value[key], child));
  if (schema.type === 'array') return Array.isArray(value)
    && (schema.minItems === undefined || value.length >= schema.minItems)
    && (schema.maxItems === undefined || value.length <= schema.maxItems)
    && value.every((item) => matches(item, schema.items));
  if (schema.type === 'integer') return Number.isInteger(value) && value >= (schema.minimum || 0);
  if (typeof value !== schema.type) return false;
  if (schema.const !== undefined && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.minLength !== undefined && value.length < schema.minLength) return false;
  if (schema.maxLength !== undefined && value.length > schema.maxLength) return false;
  if (schema.pattern && !(new RegExp(schema.pattern, 'u')).test(value)) return false;
  return true;
}

const KIND_BY_BLOCK = Object.freeze({
  PLAIN_LANGUAGE: ['BOS_ORIENTATION', 'APA_PERSPECTIVE', 'RECOMMENDATION', 'APA_OPTION', 'FUTURES', 'ACCEPTED_PLAN', 'PROPOSED_PLAN', 'APPROVED_LEARNING', 'PRIOR_SESSION', 'SESSION_RECAP', 'MAP_CHANGE_REVEAL'],
  COMPARISON: ['APA_PERSPECTIVE', 'RECOMMENDATION', 'APA_OPTION', 'ACCEPTED_PLAN', 'PROPOSED_PLAN'],
  TIMELINE: ['PRIOR_SESSION', 'SESSION_RECAP', 'APPROVED_LEARNING'],
  FIVE_FUTURES: ['FUTURES'],
  DECISION: ['RECOMMENDATION', 'APA_OPTION', 'PROPOSED_PLAN', 'ACCEPTED_PLAN'],
  COMMITMENTS: ['ACCEPTED_PLAN', 'PROPOSED_PLAN', 'SESSION_RECAP', 'MAP_CHANGE_REVEAL'],
  EVIDENCE_GAP: ['APA_PERSPECTIVE', 'FUTURES'],
});

function numberTokens(value) {
  return String(value || '').match(/\$?\d[\d,.]*(?:%|M|K)?/gu)?.map((token) => token.replaceAll(',', '').replace(/^\$/u, '').replace(/\.$/u, '')) || [];
}

function validateAthleteVisualPlan({ candidate, world }) {
  const errors = [];
  if (world?.contract !== policy.worldContract || !ATHLETE_VISUAL_EVENTS.includes(world.event))
    return { ok: false, errors: ['ATHLETE_VISUAL_WORLD_INVALID'] };
  if (!matches(candidate, ATHLETE_VISUAL_OUTPUT_SCHEMA.schema)) errors.push('ATHLETE_VISUAL_SCHEMA_INVALID');
  if (candidate?.planVersion !== ATHLETE_VISUAL_PLAN_VERSION) errors.push('ATHLETE_VISUAL_VERSION_INVALID');
  if (candidate?.event !== world.event) errors.push('ATHLETE_VISUAL_EVENT_BINDING_INVALID');
  if (!exactCanonical(candidate?.stateBinding, world.stateBinding)) errors.push('ATHLETE_VISUAL_STATE_BINDING_INVALID');
  if (!Array.isArray(candidate?.interactions) || candidate.interactions.length) errors.push('ATHLETE_VISUAL_ACTION_DENIED');
  const objectMap = new Map(world.objects.map((item) => [item.id, item]));
  const evidenceMap = new Map(world.evidence.map((item) => [item.id, item]));
  const selected = new Set(), blockIds = new Set();
  for (const block of list(candidate?.blocks)) {
    if (!object(block)) { errors.push('ATHLETE_VISUAL_BLOCK_INVALID'); continue; }
    if (blockIds.has(block.blockId)) errors.push('ATHLETE_VISUAL_BLOCK_DUPLICATE');
    blockIds.add(block.blockId);
    if (!BLOCK_TYPES.includes(block.type)) errors.push('ATHLETE_VISUAL_BLOCK_TYPE_DENIED');
    const chosen = list(block.objectIds).map((id) => objectMap.get(id));
    if (chosen.some((item) => !item)) errors.push('ATHLETE_VISUAL_OBJECT_SCOPE_DENIED');
    if (chosen.length && !chosen.every((item) => KIND_BY_BLOCK[block.type]?.includes(item?.kind))) errors.push('ATHLETE_VISUAL_BLOCK_KIND_DENIED');
    for (const id of list(block.objectIds)) selected.add(id);
    const allowedEvidence = new Set(chosen.filter(Boolean).flatMap((item) => item.sourceIds));
    if (list(block.evidenceIds).some((id) => !evidenceMap.has(id) || !allowedEvidence.has(id))) errors.push('ATHLETE_VISUAL_EVIDENCE_SCOPE_DENIED');
  }
  const mandatory = world.event !== 'COACHING_MOMENT';
  if (mandatory && (candidate?.renderDecision?.render !== true || list(candidate?.blocks).length < 1)) errors.push('ATHLETE_VISUAL_MANDATORY_RENDER_REQUIRED');
  if (world.event === 'SESSION_OPENING' && list(candidate?.blocks).length !== 1) errors.push('ATHLETE_VISUAL_OPENING_ONE_BLOCK_REQUIRED');
  if (world.event === 'SESSION_OPENING' && !['athlete-bos', 'athlete-apa', 'athlete-plan', 'athlete-prior-session', 'athlete-learning'].some((id) => selected.has(id))) errors.push('ATHLETE_VISUAL_OPENING_ORIENTATION_MISSING');
  if (world.event === 'SESSION_FINALIZATION' && !selected.has('athlete-session-recap')) errors.push('ATHLETE_VISUAL_FINAL_RECAP_REQUIRED');
  if (world.event === 'SESSION_FINALIZATION' && !selected.has('athlete-map-change')) errors.push('ATHLETE_VISUAL_FINAL_MAP_CHANGE_REQUIRED');
  if (world.event === 'SESSION_FINALIZATION'
    && (objectMap.has('athlete-plan') && !selected.has('athlete-plan')
      || objectMap.has('athlete-draft') && !selected.has('athlete-draft')))
    errors.push('ATHLETE_VISUAL_FINAL_PLAN_STATUS_REQUIRED');
  if (!mandatory && candidate?.renderDecision?.render === false && list(candidate?.blocks).length) errors.push('ATHLETE_VISUAL_NO_RENDER_BLOCK_DENIED');
  if (!mandatory && candidate?.renderDecision?.render === true && !list(candidate?.blocks).length) errors.push('ATHLETE_VISUAL_MID_BLOCK_REQUIRED');
  const copy = world.presentationCopy;
  if (!copy || JSON.stringify(copy.guidance) !== JSON.stringify(PRESENTATION_COPY[world.event])
    || copy.renderReason !== RENDER_REASON || copy.noRenderReason !== NO_RENDER_REASON
    || copy.blockReason !== BLOCK_REASON || JSON.stringify(copy.blocksByType) !== JSON.stringify(BLOCK_COPY)) {
    errors.push('ATHLETE_VISUAL_PRESENTATION_CONTRACT_INVALID');
  } else {
    const reason = candidate?.renderDecision?.render ? copy.renderReason : copy.noRenderReason;
    if (candidate?.renderDecision?.reason !== reason
      || !exactCopy(candidate?.guidance, copy.guidance))
      errors.push('ATHLETE_VISUAL_FREE_TEXT_DENIED');
    for (const block of list(candidate?.blocks)) {
      if (!object(block) || !BLOCK_COPY[block.type]
        || block.title !== BLOCK_COPY[block.type].title
        || block.subtitle !== BLOCK_COPY[block.type].subtitle
        || block.reason !== BLOCK_REASON) errors.push('ATHLETE_VISUAL_FREE_TEXT_DENIED');
    }
  }
  const prose = [...Object.values(candidate?.guidance || {}), ...list(candidate?.blocks).flatMap((block) => object(block)
    ? [block.title, block.subtitle, block.reason] : [])].join(' ');
  const allowedNumbers = new Set(numberTokens(JSON.stringify(world)));
  for (const token of numberTokens(prose)) if (!allowedNumbers.has(token)) errors.push('ATHLETE_VISUAL_INVENTED_NUMBER');
  if (/\b(?:RSL|AFW(?:-05)?|governed objects?|state binding|provenance|canonical|publication hash|provider mechanics?|deployment)\b/iu.test(prose)) errors.push('ATHLETE_VISUAL_INTERNAL_LANGUAGE');
  if (/\b(?:the )?(?:BOS|APA|map) (?:has |was )?(?:changed|updated|rewritten)\b/iu.test(prose)) errors.push('ATHLETE_VISUAL_FALSE_MAP_CHANGE');
  if (!objectMap.has('athlete-plan') && /\b(?:your|the) (?:agreed|accepted|saved|current) plan\b/iu.test(prose)) errors.push('ATHLETE_VISUAL_FALSE_PLAN_CLAIM');
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze([...new Set(errors)]) });
}

function materializeAthleteVisualPlan({ candidate, world, receipt = null }) {
  const validation = validateAthleteVisualPlan({ candidate, world });
  if (!validation.ok) throw new Error('ATHLETE_VISUAL_PLAN_FAILED_CLOSED');
  const objectMap = new Map(world.objects.map((item) => [item.id, item]));
  const evidenceMap = new Map(world.evidence.map((item) => [item.id, item]));
  return deepFreeze({ ...clone(candidate), blocks: candidate.blocks.map((block) => ({ ...clone(block),
    objects: block.objectIds.map((id) => clone(objectMap.get(id))),
    evidence: [...new Set([...block.evidenceIds, ...block.objectIds.flatMap((id) => objectMap.get(id).sourceIds)])]
      .map((id) => clone(evidenceMap.get(id))),
  })), providerReceipt: receipt ? clone(receipt) : null });
}

const SYSTEM = `You are MORE's governed visual composer for ${policy.authorityDescription}. The server chose the event and supplied exact eligible objects. The coach owns the conversation; you choose only the smallest useful visual composition. Return the strict JSON schema. OPENING: one orientation block. COACHING_MOMENT: usually no visual; render only if it materially improves this exact exchange. FINALIZATION: one or two blocks including athlete-map-change and the current unconfirmed recap AND each present athlete-plan (accepted) or athlete-draft (proposed) object, with their distinct saved statuses. Put athlete-map-change first so the exact server-derived before/now reveal is prominent. It may truthfully report no saved map change. Every block's objectIds must come from eligibleObjectIdsByBlockType for that exact block type; for example the map-change object is not eligible for TIMELINE. Use only supplied object and evidence IDs. Do not invent a fact, number, result, cause, commitment, source, map update, or plan approval. An APA recommendation and a plan draft are not agreements. A coach observation is not athlete fact. Preserve uncertainty. No interactions or mutation authority. Every rendered free-text field must copy the exact server-approved strings from presentationCopy: guidance is presentationCopy.guidance; renderDecision.reason is renderReason or noRenderReason; each block title/subtitle comes from blocksByType for its type and each block reason is blockReason. Do not paraphrase or add text in these fields. The selected saved objects supply the personalized facts.`;

function createAthleteVisualComposer({ env = globalThis.process?.env || {}, transport = null, evidenceSink } = {}) {
  if (typeof evidenceSink !== 'function') throw new TypeError('ATHLETE_VISUAL_PRIVATE_EVIDENCE_SINK_REQUIRED');
  if (transport !== null && typeof transport !== 'function') throw new TypeError('ATHLETE_VISUAL_TRANSPORT_INVALID');
  let client;
  const callProvider = transport || (async (request, options) => {
    if (!env.OPENAI_API_KEY) throw new Error('ATHLETE_VISUAL_CONNECTION_UNAVAILABLE');
    if (!client) {
      const { default: OpenAI } = await import('openai');
      client = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 180000 });
    }
    return client.responses.create(request, { signal: options.signal, maxRetries: 0, timeout: 180000 });
  });
  const save = async (event) => {
    try { await evidenceSink(deepFreeze(clone(event))); }
    catch { throw new Error('ATHLETE_VISUAL_EVIDENCE_UNAVAILABLE'); }
  };
  return async function compose(world) {
    if (world?.contract !== policy.worldContract) throw new Error('ATHLETE_VISUAL_WORLD_INVALID');
    const id = randomUUID();
    const request = buildAthleteVisualRequest(world);
    const record = { id, event: world.event, mm: world.stateBinding.mm, started: new Date().toISOString(),
      source_bos: world.stateBinding.bosHash, source_apa: world.stateBinding.currentApaHash,
      request_sha256: hashCanonicalJson(request), world_sha256: hashCanonicalJson(world) };
    let validationErrors = [];
    try {
      await save({ kind: 'request', id, record, request });
      const response = await callProvider(request, { signal: AbortSignal.timeout(180000), maxRetries: 0, timeout: 180000 });
      await save({ kind: 'response', id, response, response_sha256: hashCanonicalJson(response) });
      if (response?.status !== 'completed' || !response.output_text) throw new Error('ATHLETE_VISUAL_RESPONSE_INCOMPLETE');
      if (response.model !== 'gpt-5.6-sol') throw new Error('ATHLETE_VISUAL_MODEL_MISMATCH');
      let candidate;
      try { candidate = JSON.parse(response.output_text); } catch { throw new Error('ATHLETE_VISUAL_RESPONSE_INVALID'); }
      const validation = validateAthleteVisualPlan({ candidate, world });
      validationErrors = validation.errors;
      if (!validation.ok) throw new Error('ATHLETE_VISUAL_PLAN_FAILED_CLOSED');
      const receipt = { ...record, status: 'completed', model: response.model,
        usage: response.usage || null, completed: new Date().toISOString(),
        response_sha256: hashCanonicalJson(response) };
      await save({ kind: 'receipt', id, ...receipt });
      return { plan: materializeAthleteVisualPlan({ candidate, world, receipt }), receipt };
    } catch (error) {
      const code = /^ATHLETE_VISUAL_[A-Z_]+$/u.test(error?.message || '') ? error.message : 'ATHLETE_VISUAL_REQUEST_FAILED';
      await save({ kind: 'failure', id, ...record, status: 'failed', code,
        validation_errors: validationErrors,
        http_status: Number.isInteger(error?.status) ? error.status : null });
      throw new Error(code);
    }
  };
}

function buildAthleteVisualRequest(world) {
  if (world?.contract !== policy.worldContract || !ATHLETE_VISUAL_EVENTS.includes(world.event)) throw new Error('ATHLETE_VISUAL_WORLD_INVALID');
  return deepFreeze({ model: 'gpt-5.6-sol', store: false, background: false, tools: [],
      reasoning: { effort: 'xhigh' }, max_output_tokens: 6000,
      input: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(world) }],
      text: { format: ATHLETE_VISUAL_OUTPUT_SCHEMA } });
}
function recoverAthleteVisualComposition({ world, savedRequest, savedResponse, savedReceipt = null } = {}) {
  const request = buildAthleteVisualRequest(world), record = savedRequest?.record;
  const deny = () => { throw new Error('ATHLETE_VISUAL_RECOVERY_EVIDENCE_INVALID'); };
  if (savedRequest?.kind !== 'request' || savedResponse?.kind !== 'response' || !record
    || !record.id || savedRequest.id !== record.id || savedResponse.id !== record.id
    || record.event !== world.event || record.mm !== world.stateBinding.mm
    || record.source_bos !== world.stateBinding.bosHash || record.source_apa !== world.stateBinding.currentApaHash
    || record.request_sha256 !== hashCanonicalJson(request) || hashCanonicalJson(savedRequest.request) !== hashCanonicalJson(request)
    || record.world_sha256 !== hashCanonicalJson(world) || !Number.isFinite(Date.parse(record.started))) deny();
  const response = savedResponse.response;
  if (response?.status !== 'completed' || response.model !== 'gpt-5.6-sol' || typeof response.output_text !== 'string'
    || savedResponse.response_sha256 !== hashCanonicalJson(response)) deny();
  let candidate;
  try { candidate = JSON.parse(response.output_text); } catch { deny(); }
  if (!validateAthleteVisualPlan({ candidate, world }).ok) deny();
  const responseHash = hashCanonicalJson(response);
  let receipt;
  if (savedReceipt) {
    if (savedReceipt.kind !== 'receipt' || savedReceipt.id !== record.id
      || Object.keys(record).some(key => savedReceipt[key] !== record[key])
      || savedReceipt.status !== 'completed' || savedReceipt.model !== response.model
      || hashCanonicalJson(savedReceipt.usage) !== hashCanonicalJson(response.usage || null)
      || savedReceipt.response_sha256 !== responseHash || !Number.isFinite(Date.parse(savedReceipt.completed))) deny();
    const { kind: _kind, ...body } = savedReceipt;
    const expected = { ...record, status: 'completed', model: response.model, usage: response.usage || null,
      completed: savedReceipt.completed, response_sha256: responseHash };
    if (hashCanonicalJson(body) !== hashCanonicalJson(expected)) deny();
    receipt = body;
  } else receipt = { ...record, status: 'completed', model: response.model, usage: response.usage || null,
    completed: null, response_sha256: responseHash, recovered_from_saved_response: true };
  return deepFreeze({ plan: materializeAthleteVisualPlan({ candidate, world, receipt }), receipt,
    recovered: true, no_provider_call: true, world_sha256: hashCanonicalJson(world),
    request_sha256: hashCanonicalJson(request), response_sha256: responseHash });
}
  return Object.freeze({ ATHLETE_VISUAL_PLAN_VERSION, ATHLETE_VISUAL_EVENTS, ATHLETE_VISUAL_OUTPUT_SCHEMA,
    buildAthleteVisualWorld, validateAthleteVisualPlan, materializeAthleteVisualPlan,
    buildAthleteVisualRequest, createAthleteVisualComposer, recoverAthleteVisualComposition });
}
