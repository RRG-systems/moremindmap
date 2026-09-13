import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { EMPHASIS, VISUAL_PRIMITIVES } from '../recruitingV2/creationLanguage.js';

export const SUBSCRIPTION_S2_GU_PLAN_VERSION = 'more-subscription-s2-gu-plan-v1';
export const SUBSCRIPTION_S2_GU_EVENTS = Object.freeze([
  'FIRST_SESSION_WELCOME',
  'SESSION_OPENING',
  'COACHING_MOMENT',
  'MAP_CHANGE',
  'SESSION_CLOSING',
]);

export const SUBSCRIPTION_S2_GU_BLOCK_TYPES = Object.freeze(VISUAL_PRIMITIVES.filter((type) => [
  'METRIC_STRIP',
  'BAR_CHART',
  'COMPARISON',
  'TIMELINE',
  'TRAJECTORY',
  'FIVE_FUTURES',
  'RELATIONSHIP',
  'CONSTRAINT',
  'EVIDENCE_GAP',
  'COMMITMENTS',
  'DECISION',
  'PLAIN_LANGUAGE',
  'QUESTION',
].includes(type)));

const text = (maxLength) => ({ type: 'string', minLength: 1, maxLength });
const ids = (maxItems, minItems = 0) => ({ type: 'array', minItems, maxItems, items: { type: 'string', minLength: 1, maxLength: 140 } });

export const SUBSCRIPTION_S2_GU_OUTPUT_SCHEMA = Object.freeze({
  type: 'json_schema',
  name: 'subscription_flagship_s2_gu_plan_v1',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['planVersion', 'event', 'stateBinding', 'renderDecision', 'guidance', 'blocks', 'interactions'],
    properties: {
      planVersion: { type: 'string', const: SUBSCRIPTION_S2_GU_PLAN_VERSION },
      event: { type: 'string', enum: SUBSCRIPTION_S2_GU_EVENTS },
      stateBinding: {
        type: 'object',
        additionalProperties: false,
        required: ['sessionId', 'relationshipScopeHash', 'publicationVersion', 'publicationHash', 'understandingHash', 'triggerHash'],
        properties: {
          sessionId: { type: 'string', minLength: 8, maxLength: 160 },
          relationshipScopeHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          publicationVersion: { type: 'integer', minimum: 1 },
          publicationHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          understandingHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          triggerHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        },
      },
      renderDecision: {
        type: 'object',
        additionalProperties: false,
        required: ['render', 'reason'],
        properties: {
          render: { type: 'boolean' },
          reason: text(280),
        },
      },
      guidance: {
        type: 'object',
        additionalProperties: false,
        required: ['eyebrow', 'headline', 'summary', 'nextCue'],
        properties: {
          eyebrow: text(90),
          headline: text(220),
          summary: text(900),
          nextCue: text(520),
        },
      },
      blocks: {
        type: 'array',
        minItems: 0,
        maxItems: 2,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['blockId', 'type', 'title', 'subtitle', 'objectIds', 'evidenceIds', 'emphasis', 'reason'],
          properties: {
            blockId: { type: 'string', pattern: '^s2-block-[a-z0-9-]{3,80}$' },
            type: { type: 'string', enum: SUBSCRIPTION_S2_GU_BLOCK_TYPES },
            title: text(180),
            subtitle: text(420),
            objectIds: ids(6, 1),
            evidenceIds: ids(12),
            emphasis: { type: 'string', enum: EMPHASIS },
            reason: text(420),
          },
        },
      },
      interactions: {
        type: 'array',
        maxItems: 0,
        items: { type: 'string' },
      },
    },
  },
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const firstText = (...values) => values.find((value) => typeof value === 'string' && value.trim())?.trim() || null;

// Customer and coach prose carries negation, uncertainty, quotations, and
// authority. Display formatting must not rewrite those words or punctuation.
export function subscriptionS2CustomerText(value) {
  return String(value ?? '').trim();
}

// Friendly copy is limited to whole, recognized values in structured UI fields.
// A matching phrase inside a sentence is still prose and must remain intact.
const CUSTOMER_UI_LABELS = new Map([
  ['customer-reported snapshot', 'What you told MORE'],
  ['opportunity engine', 'Lead generation'],
  ['relationship-led', 'Mostly relationships'],
  ['operating ownership', 'Who owns the work'],
  ['leader-centered', 'Mostly you'],
  ['supported hypothesis', 'Best current guess'],
  ['financial bridge', 'Money picture'],
  ['unreconciled', 'Not checked yet'],
  ['material open evidence', 'Important facts still missing'],
  ['current market context', 'Market information'],
  ['research when purpose requires it', 'Check the market when it would help'],
  ['customer-confirmed', 'You confirmed'],
  ['reported estimate', 'Your estimate'],
  ['open evidence gap', 'Still need to learn'],
  ['open loops', 'Unfinished items'],
]);

export function subscriptionS2CustomerLabel(value) {
  const text = subscriptionS2CustomerText(value);
  return CUSTOMER_UI_LABELS.get(text.toLowerCase()) ?? text;
}

function conciseCustomerText(value, { maxSentences = 3, maxWords = 72 } = {}) {
  const plain = subscriptionS2CustomerText(value);
  const sentences = plain.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) || [plain];
  const selected = [];
  let words = 0;
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/u).filter(Boolean);
    const count = sentenceWords.length;
    if (!selected.length && count > maxWords) return sentenceWords.slice(0, maxWords).join(' ');
    if (selected.length && (selected.length >= maxSentences || words + count > maxWords)) break;
    selected.push(sentence.trim());
    words += count;
  }
  return selected.join(' ').trim();
}

function source(id, label, classification) {
  return Object.freeze({ id, label, classification });
}

function viewModelObjects(viewModel) {
  const layer0 = object(viewModel?.layer0);
  const destinations = object(viewModel?.destinations);
  const where = object(destinations.where);
  const futures = object(destinations.futures);
  const move = object(destinations.move);
  const plan = object(destinations.plan);
  const evidence = object(destinations.evidence);
  const cards = list(layer0.cards);
  const goal = firstText(where?.pathway?.goal?.[0]?.qualifier, plan?.goal?.title, layer0.bigPicture);
  const currentMetrics = list(where.metrics).slice(0, 4).map((item) => ({
    label: subscriptionS2CustomerLabel(firstText(item.title, 'Current measure')),
    value: subscriptionS2CustomerLabel(firstText(item.value, 'Unknown')),
    note: subscriptionS2CustomerLabel(firstText(item.qualifier, 'What MORE knows now')),
  }));
  const futureItems = list(futures.items).slice(0, 5).map((item) => ({
    label: subscriptionS2CustomerText(firstText(item.label, item.title, 'Possible future')),
    support: Number.isFinite(Number(item.probability)) ? Number(item.probability) : 0,
    meaning: subscriptionS2CustomerText(firstText(item.meaning, item.summary, item.condition, 'Possible path')),
  }));
  const planStrategies = list(plan.strategies).slice(0, 5).map((item) => firstText(item.title, item.headline, item.description)).filter(Boolean);
  const moveStatement = subscriptionS2CustomerText(firstText(move.intervention, cards.find((item) => item.id === 'move')?.qualifier, layer0.nextStep));
  const moveQualifier = subscriptionS2CustomerText(firstText(move.proofBoundary, layer0.nextStepQualifier, 'We will learn from what actually happens.'));
  const known = list(evidence.ledger).filter((item) => item.status === 'REPORTED').slice(0, 6).map((item) => item.reality);
  const missing = list(evidence.highestValueMissing).slice(0, 6);
  return [
    {
      id: 's2-vision', kind: 'VISION', title: 'Where you are going', statement: subscriptionS2CustomerText(goal || 'Your goal is still open.'),
      items: [], sourceIds: ['s2-source-business-twin'],
    },
    {
      id: 's2-perspective', kind: 'PERSPECTIVE', title: 'Where the business is now',
      statement: conciseCustomerText(firstText(layer0.bigPicture, where.subhead, 'Your Business Twin today')),
      qualifier: subscriptionS2CustomerText(firstText(layer0.bigPictureQualifier, where.gap, 'We are still learning what is holding the business back.')),
      items: currentMetrics, sourceIds: ['s2-source-business-twin', 's2-source-evidence'],
    },
    {
      id: 's2-one-move', kind: 'ONE_MOVE', title: firstText(move.title, cards.find((item) => item.id === 'move')?.value, 'Current One Move'),
      statement: moveStatement,
      qualifier: moveQualifier === moveStatement ? '' : moveQualifier,
      items: planStrategies.map((value) => ({ label: subscriptionS2CustomerText(value), value: '', note: '' })), sourceIds: ['s2-source-business-twin'],
    },
    {
      id: 's2-futures', kind: 'FUTURES', title: firstText(futures.headline, 'Five Possible Futures'),
      statement: subscriptionS2CustomerText(firstText(futures.probabilitySemantics, futures.subhead, 'These are possible paths, not promises.')),
      items: futureItems, sourceIds: ['s2-source-business-twin', 's2-source-evidence'],
    },
    {
      id: 's2-evidence-gap', kind: 'EVIDENCE_GAP', title: 'What remains open', statement: 'These unknowns can change the current view.',
      missing: missing.map(subscriptionS2CustomerText), known: known.map(subscriptionS2CustomerText), sourceIds: ['s2-source-evidence'],
    },
  ];
}

function continuityObjects(providerUnderstanding) {
  const history = list(providerUnderstanding?.relevant_coaching_history);
  const temporal = object(providerUnderstanding?.temporal_state);
  const continuity = object(providerUnderstanding?.relationship_continuity);
  const kind = (item) => String(item.Kind || item.kind || '').replaceAll('_', ' ').toUpperCase();
  // This history is already scoped, authorized and replayed. Proposed actions
  // live outside it; an approved intervention is an actual prior agreement.
  const commitments = history.filter((item) => ['COMMITMENT', 'INTERVENTION', 'DECISION'].includes(kind(item))).slice(0, 4);
  const outcomes = history.filter((item) => ['OUTCOME', 'STATE CHANGE', 'LEARNING', 'PLAN CHANGE'].includes(kind(item))).slice(0, 4);
  const corrections = history.filter((item) => kind(item) === 'CORRECTION');
  const openLoops = list(continuity['Open loops'] || continuity.open_loops).slice(0, 4);
  const cadence = object(temporal['Coaching cadence'] || temporal.coaching_cadence);
  const communicationPreference = history.flatMap((item) => list(item?.Meaning?.Items || item?.meaning?.items))
    .find((item) => String(item?.Field || item?.field || '') === 'evidence.communication_preference');
  const priorLearning = object(continuity['Prior session learning'] || continuity.prior_session_learning);
  const priorNotes = list(priorLearning.Notes || priorLearning.notes);
  return [
    priorNotes.length ? {
      id: 's2-prior-session-learning', kind: 'PRIOR_SESSION_LEARNING', title: 'Our earlier conversation',
      statement: 'These are notes from an earlier conversation, including what was left open.',
      qualifier: 'Discussion alone does not create an agreement or change your plan.',
      items: [],
      // The upstream continuity projection has already checked exact scope,
      // immutable custody, time eligibility, and the complete-field budget.
      // Keep that full meaning for the compiler; do not truncate a negation or
      // silently turn a closing note into a commitment in the rendered card.
      priorSessionLearning: clone(priorLearning),
      currentCorrectionContext: {
        activeGovernedCorrections: clone(corrections),
        use: 'Current customer corrections and active governed meaning take precedence over these dated discussion notes. The supplied correction context is relevant retrieved history, not a claim that no other correction exists.',
      },
      canonicalCustomerTruth: false,
      personalRslEvent: false,
      sourceIds: ['s2-source-prior-session-learning', 's2-source-personal-rsl'],
    } : null,
    commitments.length ? {
      id: 's2-prior-agreements', kind: 'COMMITMENTS', title: 'What we agreed to', statement: commitments.length ? 'These earlier agreements may matter today.' : 'There is no earlier agreement to bring into this session.',
      items: commitments.map((item) => ({ label: subscriptionS2CustomerText(firstText(item?.Meaning?.Summary, item?.meaning?.summary, item?.Summary, item?.summary, item.Kind, item.kind)), value: '', note: subscriptionS2CustomerText(firstText(item['Happened at'], item.happened_at, '')) })),
      governedRecords: clone(commitments),
      sourceIds: ['s2-source-personal-rsl'],
    } : null,
    outcomes.length ? {
      id: 's2-progress', kind: 'PROGRESS', title: 'What happened since', statement: 'These are reported results and changes. Their causes may still be uncertain.',
      items: outcomes.map((item) => ({ label: subscriptionS2CustomerText(firstText(item?.Meaning?.Summary, item?.meaning?.summary, item?.Summary, item?.summary, item.Kind, item.kind)), value: '', note: subscriptionS2CustomerText(firstText(item['Happened at'], item.happened_at, '')) })),
      governedRecords: clone(outcomes),
      sourceIds: ['s2-source-personal-rsl'],
    } : null,
    corrections.length ? {
      id: 's2-current-corrections', kind: 'CORRECTION', title: 'What you corrected',
      statement: 'These corrections update the earlier understanding.',
      items: [], governedRecords: clone(corrections),
      sourceIds: ['s2-source-personal-rsl'],
    } : null,
    openLoops.length ? {
      id: 's2-open-loops', kind: 'OPEN_LOOPS', title: 'Still open', statement: 'These items still need an answer or a next step.',
      items: openLoops.map((item) => ({ label: subscriptionS2CustomerText(firstText(item.Summary, item.summary, item.Kind, item.kind, 'Open item')), value: '', note: subscriptionS2CustomerLabel(firstText(item.Status, item.status, '')) })),
      governedRecords: clone(openLoops),
      sourceIds: ['s2-source-personal-rsl', 's2-source-evidence'],
    } : null,
    {
      id: 's2-relationship-preferences', kind: 'RELATIONSHIP', title: 'How this relationship can work for you',
      statement: 'You can shape the rhythm, directness, challenge, and simplicity of these conversations.',
      items: [
        { label: 'Current rhythm', value: firstText(cadence['Customer preference'], cadence.customer_preference, cadence['Sessions per month'] ? `About ${cadence['Sessions per month']} sessions a month` : null, 'About four sessions a month is the starting point'), note: cadence['Customer confirmed'] || cadence.customer_confirmed ? 'Customer-confirmed' : 'Adjustable starting point' },
        { label: 'Communication', value: firstText(communicationPreference?.Value, communicationPreference?.value, 'Tell MORE when you want simpler, more direct, or more challenging coaching'), note: 'MORE keeps a lasting preference only after you approve it' },
      ],
      sourceIds: ['s2-source-personal-rsl'],
    },
  ].filter(Boolean);
}

function firstSessionWelcomeObject(providerUnderstanding) {
  const preferredName = firstText(providerUnderstanding?.coaching_session?.preferred_conversational_name);
  return {
    id: 's2-first-session-welcome',
    kind: 'WELCOME',
    title: 'Welcome to MORE',
    statement: preferredName
      ? `Welcome, ${preferredName}. We can turn what matters to you into useful action.`
      : 'Welcome. We can turn what matters to you into useful action.',
    recognitionContext: {
      wholePerson: clone(object(providerUnderstanding?.whole_person)),
      wholeBusiness: clone(object(providerUnderstanding?.whole_business)),
      chosenDirection: clone(object(providerUnderstanding?.plan)),
      currentBusinessState: clone(object(providerUnderstanding?.living_business_twin)),
      evidence: clone(object(providerUnderstanding?.evidence)),
      currentConversation: clone(list(providerUnderstanding?.current_conversation)),
      activeCorrections: clone(list(providerUnderstanding?.relevant_coaching_history).filter((item) => String(item.Kind || item.kind || '').toUpperCase() === 'CORRECTION')),
      use: 'Recognize only a relevant supported understanding, welcome correction and begin useful work. Person patterns are revisable context, not business causes or limits on ambition. Missing information stays missing; the customer chooses the destination.',
    },
    items: [],
    sourceIds: ['s2-source-coaching-session', 's2-source-whole-person', 's2-source-business-twin', 's2-source-evidence', 's2-source-personal-rsl'],
  };
}

function sessionLearningObject(sessionLearning) {
  if (!sessionLearning) return null;
  const labels = [
    ['What mattered', 'what_mattered'],
    ['What changed', 'what_changed'],
    ['What we learned', 'what_was_learned'],
    ['What was decided', 'what_was_decided'],
    ['What remains open', 'what_remains_open'],
    ['What we will pick up next time', 'pick_up_next_time'],
  ];
  return {
    id: 's2-session-learning', kind: 'SESSION_LEARNING', title: 'What we are carrying forward',
    statement: 'A short recap to carry into your next session.',
    items: labels.map(([label, key]) => ({ label, value: subscriptionS2CustomerText(firstText(sessionLearning[key], 'Nothing new was established.')), note: '' })),
    sourceIds: ['s2-source-session-learning'],
  };
}

function mapDeltaObject(mapDelta) {
  if (!mapDelta?.material) return null;
  return {
    id: 's2-map-delta', kind: 'MAP_DELTA', title: 'Your Business Twin changed',
    statement: 'The exact change you approved is now part of your Business Twin.',
    items: list(mapDelta.changedObjects).map((label) => ({ label: String(label).replaceAll('_', ' ').toLowerCase(), value: 'Updated', note: 'You approved this change' })),
    sourceIds: ['s2-source-map-delta'],
  };
}

function coachingMomentExchange(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const customerMessage = firstText(value.customer_message)?.slice(0, 5000);
  const coachMessage = firstText(value.coach_message)?.slice(0, 12_000);
  if (!customerMessage || !coachMessage) return null;
  return Object.freeze({
    customerMessage,
    coachMessage,
    classification: 'CURRENT_SESSION_EPHEMERAL_NONCANONICAL',
    use: 'Use this exact fresh exchange only to decide whether a visual materially improves what the human and coach are doing now. It supplies no new governed object, fact, agreement, commitment, evidence, or mutation authority. Respect an explicit request to stay in conversation or avoid a plan. Plain conversation may be sufficient.',
  });
}

export function buildSubscriptionS2GuWorld({ event, packet, publication, viewModel, sessionLearning = null, mapDelta = null, currentExchange = null, relationshipScopeHash }) {
  if (!SUBSCRIPTION_S2_GU_EVENTS.includes(event)) throw new TypeError('SUBSCRIPTION_S2_GU_EVENT_INVALID');
  if (!packet?.packet_hash || !packet?.provider_understanding) throw new TypeError('SUBSCRIPTION_S2_GU_UNDERSTANDING_REQUIRED');
  if (!publication?.publication_hash || !Number.isInteger(publication?.publication_version)) throw new TypeError('SUBSCRIPTION_S2_GU_PUBLICATION_REQUIRED');
  if (!/^[a-f0-9]{64}$/u.test(relationshipScopeHash || '')) throw new TypeError('SUBSCRIPTION_S2_GU_SCOPE_HASH_REQUIRED');
  const freshExchange = coachingMomentExchange(currentExchange);
  if (currentExchange && event !== 'COACHING_MOMENT') throw new TypeError('SUBSCRIPTION_S2_GU_CURRENT_EXCHANGE_EVENT_DENIED');
  if (event === 'COACHING_MOMENT' && currentExchange && !freshExchange) throw new TypeError('SUBSCRIPTION_S2_GU_CURRENT_EXCHANGE_INVALID');
  const sources = [
    source('s2-source-business-twin', 'Current governed Business Twin', 'GOVERNED_SYNTHETIC'),
    source('s2-source-evidence', 'Current governed Evidence state', 'GOVERNED_SYNTHETIC'),
    source('s2-source-personal-rsl', 'Exact-scope governed relationship memory', 'PRIVATE_GOVERNED_SYNTHETIC'),
    source('s2-source-whole-person', 'Available governed person understanding', 'PRIVATE_GOVERNED_SYNTHETIC'),
    source('s2-source-coaching-session', 'Current governed coaching-session orientation', 'SESSION_ONLY_NONCANONICAL'),
    source('s2-source-session-learning', 'Session closing notes; recap confirmation is separate', 'SESSION_ONLY_NONCANONICAL'),
    source('s2-source-prior-session-learning', 'Dated prior session discussion, not an authorized agreement', 'PRIVATE_SESSION_NOTES_NONCANONICAL'),
    source('s2-source-map-delta', 'Real AFW-05 publication delta', 'GOVERNED_SYNTHETIC'),
  ];
  const availableObjects = [...viewModelObjects(viewModel), ...continuityObjects(packet.provider_understanding)];
  const objects = event === 'FIRST_SESSION_WELCOME'
    ? [firstSessionWelcomeObject(packet.provider_understanding)]
    : event === 'COACHING_MOMENT'
      ? availableObjects.filter((item) => item.id !== 's2-relationship-preferences')
      : availableObjects;
  const learning = sessionLearningObject(sessionLearning);
  const delta = mapDeltaObject(mapDelta);
  if (learning) objects.push(learning);
  if (delta) objects.push(delta);
  const trigger = {
    event,
    session_id: packet.session_id,
    publication_version: publication.publication_version,
    publication_hash: publication.publication_hash,
    understanding_hash: packet.packet_hash,
    session_learning: sessionLearning ? hashCanonicalJson(sessionLearning) : null,
    map_delta: mapDelta ? hashCanonicalJson(mapDelta) : null,
    ...(event === 'COACHING_MOMENT' ? { current_exchange: freshExchange ? hashCanonicalJson(freshExchange) : null } : {}),
  };
  return Object.freeze({
    contract: 'SUBSCRIPTION_FLAGSHIP_S2_GU_WORLD_V1',
    event,
    ...(event === 'SESSION_OPENING' ? { openingContext: Object.freeze({
      temporalState: clone(object(packet.provider_understanding.temporal_state)),
      currentConversation: clone(list(packet.provider_understanding.current_conversation)),
      use: 'Use the dated context to continue real work. Absence or missing outcome reports establish neither completion nor failure; ask what happened and what matters now. Retrieved history is selective and may need correction.',
    }) } : {}),
    ...(event === 'COACHING_MOMENT' && freshExchange ? { coachingMomentContext: freshExchange } : {}),
    stateBinding: Object.freeze({
      sessionId: packet.session_id,
      relationshipScopeHash,
      publicationVersion: publication.publication_version,
      publicationHash: publication.publication_hash,
      understandingHash: packet.packet_hash,
      triggerHash: hashCanonicalJson(trigger),
    }),
    objects: Object.freeze(objects.map((item) => Object.freeze(clone(item)))),
    evidence: Object.freeze(sources),
    truthBoundaries: Object.freeze({
      values: 'Use only governed objects supplied here. Never generate facts or numbers.',
      mapChange: 'Only MAP_CHANGE with the supplied real delta may say the map changed.',
      sessionLearning: 'Session closing notes do not establish recap confirmation, agreement, canonical truth, or Personal RSL authority on their own.',
      ...(event === 'COACHING_MOMENT' ? { currentExchange: 'The current exchange is ephemeral session context for composition choice only. It cannot create or alter facts, evidence, agreements, commitments, objects, or authority.' } : {}),
      authority: 'GU has no mutation, billing, communication, deployment, or external-action authority.',
    }),
  });
}

const KIND_BY_BLOCK = Object.freeze({
  METRIC_STRIP: ['PERSPECTIVE', 'PROGRESS'],
  BAR_CHART: ['PERSPECTIVE', 'PROGRESS'],
  COMPARISON: ['VISION', 'PERSPECTIVE', 'PROGRESS', 'MAP_DELTA'],
  TIMELINE: ['COMMITMENTS', 'PROGRESS', 'CORRECTION', 'OPEN_LOOPS', 'SESSION_LEARNING', 'PRIOR_SESSION_LEARNING', 'MAP_DELTA'],
  TRAJECTORY: ['FUTURES', 'VISION', 'PROGRESS'],
  FIVE_FUTURES: ['FUTURES'],
  RELATIONSHIP: ['RELATIONSHIP'],
  CONSTRAINT: ['PERSPECTIVE', 'EVIDENCE_GAP'],
  EVIDENCE_GAP: ['EVIDENCE_GAP', 'OPEN_LOOPS'],
  COMMITMENTS: ['COMMITMENTS', 'ONE_MOVE', 'SESSION_LEARNING'],
  DECISION: ['ONE_MOVE', 'SESSION_LEARNING', 'MAP_DELTA'],
  PLAIN_LANGUAGE: ['WELCOME', 'VISION', 'PERSPECTIVE', 'ONE_MOVE', 'RELATIONSHIP', 'COMMITMENTS', 'PROGRESS', 'CORRECTION', 'OPEN_LOOPS', 'SESSION_LEARNING', 'PRIOR_SESSION_LEARNING', 'MAP_DELTA'],
  QUESTION: ['VISION', 'PERSPECTIVE', 'ONE_MOVE', 'RELATIONSHIP', 'COMMITMENTS', 'PROGRESS', 'CORRECTION', 'OPEN_LOOPS', 'EVIDENCE_GAP', 'SESSION_LEARNING', 'PRIOR_SESSION_LEARNING'],
});

function numberTokens(value) {
  return String(value || '').match(/\$?\d[\d,.]*(?:%|M|K)?/gu)?.map((token) => token.replaceAll(',', '').replace(/^\$/u, '').replace(/\.$/u, '')) || [];
}

function planProse(plan) {
  return [
    ...Object.values(plan?.guidance || {}),
    ...list(plan?.blocks).flatMap((block) => [block.title, block.subtitle, block.reason]),
  ];
}

export function validateSubscriptionS2GuPlan({ candidate, world }) {
  const errors = [];
  if (!candidate || candidate.planVersion !== SUBSCRIPTION_S2_GU_PLAN_VERSION) errors.push('S2_GU_PLAN_VERSION_INVALID');
  if (candidate?.event !== world.event) errors.push('S2_GU_EVENT_BINDING_INVALID');
  if (JSON.stringify(candidate?.stateBinding) !== JSON.stringify(world.stateBinding)) errors.push('S2_GU_STATE_BINDING_INVALID');
  if (!Array.isArray(candidate?.interactions) || candidate.interactions.length) errors.push('S2_GU_ACTION_DENIED');
  const objectMap = new Map(world.objects.map((item) => [item.id, item]));
  const evidenceIds = new Set(world.evidence.map((item) => item.id));
  const selectedObjectIds = new Set();
  const blockIds = new Set();
  for (const block of list(candidate?.blocks)) {
    if (blockIds.has(block.blockId)) errors.push(`S2_GU_BLOCK_DUPLICATE:${block.blockId}`);
    blockIds.add(block.blockId);
    if (!SUBSCRIPTION_S2_GU_BLOCK_TYPES.includes(block.type)) errors.push(`S2_GU_BLOCK_TYPE_DENIED:${block.type}`);
    const objects = list(block.objectIds).map((id) => objectMap.get(id));
    if (objects.some((item) => !item)) errors.push(`S2_GU_OBJECT_SCOPE_DENIED:${block.blockId}`);
    if (objects.some((item) => item?.kind === 'PRIOR_SESSION_LEARNING') && !['PLAIN_LANGUAGE', 'QUESTION', 'TIMELINE'].includes(block.type)) errors.push(`S2_GU_PRIOR_DISCUSSION_BLOCK_DENIED:${block.blockId}`);
    if (objects.filter(Boolean).length && !objects.filter(Boolean).some((item) => list(KIND_BY_BLOCK[block.type]).includes(item.kind))) errors.push(`S2_GU_BLOCK_KIND_INCOMPATIBLE:${block.blockId}`);
    for (const id of block.objectIds || []) selectedObjectIds.add(id);
    for (const id of block.evidenceIds || []) if (!evidenceIds.has(id)) errors.push(`S2_GU_EVIDENCE_SCOPE_DENIED:${id}`);
  }
  const firstSessionWelcomeObjectId = world.domain === 'ATHLETE'
    ? 's2-relationship-preferences'
    : 's2-first-session-welcome';
  const requiredObjectByEvent = {
    FIRST_SESSION_WELCOME: firstSessionWelcomeObjectId,
    SESSION_OPENING: null,
    MAP_CHANGE: 's2-map-delta',
    SESSION_CLOSING: 's2-session-learning',
  };
  const mandatory = world.event !== 'COACHING_MOMENT';
  if (mandatory && candidate?.renderDecision?.render !== true) errors.push('S2_GU_MANDATORY_RENDER_REQUIRED');
  if (mandatory && list(candidate?.blocks).length < 1) errors.push('S2_GU_MANDATORY_BLOCK_REQUIRED');
  if (world.event === 'FIRST_SESSION_WELCOME' && list(candidate?.blocks).length !== 1) errors.push('S2_GU_FIRST_WELCOME_ONE_BLOCK_REQUIRED');
  if (world.event === 'FIRST_SESSION_WELCOME' && (selectedObjectIds.size !== 1 || !selectedObjectIds.has(firstSessionWelcomeObjectId))) errors.push('S2_GU_FIRST_WELCOME_ONLY_REQUIRED');
  if (world.event === 'SESSION_OPENING' && list(candidate?.blocks).length !== 1) errors.push('S2_1_GU_OPENING_ONE_BLOCK_REQUIRED');
  if (!mandatory && candidate?.renderDecision?.render === false && list(candidate?.blocks).length) errors.push('S2_GU_RESTRAINED_NO_RENDER_BLOCK_DENIED');
  if (!mandatory && candidate?.renderDecision?.render === true && (list(candidate?.blocks).length < 1 || list(candidate?.blocks).length > 2)) errors.push('S2_GU_RESTRAINED_BLOCK_COUNT_INVALID');
  const requiredObject = requiredObjectByEvent[world.event];
  if (requiredObject && !selectedObjectIds.has(requiredObject)) errors.push(`S2_GU_REQUIRED_OBJECT_MISSING:${requiredObject}`);
  if (world.event === 'SESSION_OPENING' && !['s2-vision', 's2-perspective', 's2-prior-agreements', 's2-progress', 's2-current-corrections', 's2-open-loops', 's2-one-move', 's2-prior-session-learning'].some((id) => selectedObjectIds.has(id))) errors.push('S2_GU_OPENING_ORIENTATION_MISSING');
  if (world.event === 'SESSION_OPENING' && selectedObjectIds.size > 2) errors.push('S2_1_GU_OPENING_OBJECT_LIMIT');
  const allowedNumbers = new Set(numberTokens(JSON.stringify(world)));
  for (const value of planProse(candidate)) for (const token of numberTokens(value)) if (!allowedNumbers.has(token)) errors.push(`S2_GU_INVENTED_NUMERIC_CLAIM:${token}`);
  const serialized = JSON.stringify(candidate || {});
  if (/canonical mutation completed|personal rsl (?:saved|updated)|billing|stripe|email sent|guaranteed|deploy/iu.test(serialized)) errors.push('S2_GU_PROHIBITED_CLAIM');
  if (/\b(?:RSL|AFW(?:-05)?|governed objects?|state binding|epistemic|provenance|canonical|publication hash|provider mechanics?|bounded|reconciliation|reconciled|evidence gap|source-to-close|qualified relationship|open loops?|client-value|intervention|decision rights|quality boundaries|exception rules|inspected completion|operator-identified|system-governed|financial bridge|supported hypothesis)\b/iu.test(planProse(candidate).join(' '))) errors.push('S2_GU_CUSTOMER_LANGUAGE_INTERNAL_JARGON');
  if (world.event !== 'MAP_CHANGE' && /(?:map|business twin) (?:has )?changed/iu.test(serialized)) errors.push('S2_GU_FALSE_MAP_CHANGE_CLAIM');
  if (world.event === 'MAP_CHANGE' && !world.objects.some((item) => item.id === 's2-map-delta')) errors.push('S2_GU_REAL_MAP_DELTA_REQUIRED');
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function materializeSubscriptionS2GuPlan({ candidate, world, receipt }) {
  const objectMap = new Map(world.objects.map((item) => [item.id, item]));
  const evidenceMap = new Map(world.evidence.map((item) => [item.id, item]));
  const firstSessionWelcome = world.event === 'FIRST_SESSION_WELCOME';
  return Object.freeze({
    ...clone(candidate),
    // The existing schema bounds these fields. Preserve the full recognition
    // and invitation: a fixed word prefix can discard the correction or caveat.
    guidance: Object.freeze(clone(candidate.guidance)),
    blocks: Object.freeze(candidate.blocks.map((block) => Object.freeze({
      ...clone(block),
      ...(firstSessionWelcome ? {
        title: conciseCustomerText(block.title, { maxSentences: 1, maxWords: 8 }),
        subtitle: '',
      } : {}),
      objects: Object.freeze(block.objectIds.map((id) => objectMap.get(id)).map((item) => firstSessionWelcome
        ? {
            ...item,
            statement: item.statement,
            qualifier: '',
            items: [],
          }
        : world.event === 'SESSION_OPENING'
        ? {
            ...item,
            statement: conciseCustomerText(item.statement, { maxSentences: 2, maxWords: 42 }),
            qualifier: conciseCustomerText(item.qualifier, { maxSentences: 1, maxWords: 24 }),
            items: list(item.items).slice(0, 1).map(clone),
          }
        : item)),
      evidence: Object.freeze([...new Set([...block.evidenceIds, ...block.objectIds.flatMap((id) => objectMap.get(id)?.sourceIds || [])])].map((id) => evidenceMap.get(id)).filter(Boolean)),
    }))),
    providerReceipt: Object.freeze(clone(receipt)),
  });
}
