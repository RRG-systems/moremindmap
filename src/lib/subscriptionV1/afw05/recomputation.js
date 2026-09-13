import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { sameScope } from '../contracts.js';
import { isAgreedIntervention } from '../lineage.js';
import { LIVING_TWIN_BOXES } from './constants.js';
import { validatePublicationHash } from './contracts.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

function completePlan(plan) {
  return Boolean(plan?.goal && Array.isArray(plan?.ways) && plan.ways.length === 3
    && plan.ways.every((way) => way?.title && Array.isArray(way.strategies) && way.strategies.length === 5
      && way.strategies.every((strategy) => typeof strategy === 'string' && strategy.trim())));
}

function normalizeInitialState(initialState = {}) {
  const plan = clone(initialState.plan_135 || { goal: null, ways: [] });
  while (plan.ways.length < 3) plan.ways.push({ title: null, strategies: [] });
  return {
    WHERE_YOU_ARE: clone(initialState.WHERE_YOU_ARE || { accepted_changes: {} }),
    FIVE_FUTURES: clone(initialState.FIVE_FUTURES || { customer_challenges: [] }),
    ONE_MOVE: clone(initialState.ONE_MOVE || { customer_challenges: [] }),
    PLAN_135: { ...plan, complete: completePlan(plan) },
    EVIDENCE: clone(initialState.EVIDENCE || { accepted_changes: {}, corrections: [] }),
    engagement: clone(initialState.engagement || { commitments: [], interventions: [], outcomes: [] }),
  };
}

function validateArtifactLineage(lineage) {
  const expected = new Set(['NEW_BOS', 'NEW_BA', 'BOS_BA_FUSION', 'WHOLE_BUSINESS_MODEL_V1', 'FIVE_FUTURES_V2', 'ONE_MOVE_V2', 'PLAN_135', 'EVIDENCE_LEDGER']);
  if (!Array.isArray(lineage) || lineage.length !== expected.size) return false;
  for (const item of lineage) {
    if (!expected.delete(item.artifact_type) || !/^[a-f0-9]{64}$/u.test(item.content_hash || '')) return false;
  }
  return expected.size === 0;
}

function publicationBody({ scope, publicationVersion, previousHash, artifactLineage, baselineState, state, replayHash, headHash, activeEventIds, changedObjects, publishedAt }) {
  const artifactSetHash = hashCanonicalJson(artifactLineage.map(({ artifact_type, content_hash }) => ({ artifact_type, content_hash })).sort((a, b) => a.artifact_type.localeCompare(b.artifact_type)));
  return {
    contract_id: 'living_business_twin_publication',
    schema_version: '1.0.0',
    publication_id: `living_twin_${hashCanonicalJson({ scope, publicationVersion, replayHash, artifactSetHash }).slice(0, 24)}`,
    publication_version: publicationVersion,
    previous_publication_hash: previousHash,
    scope: clone(scope),
    source_artifact_lineage: clone(artifactLineage),
    source_artifact_set_hash: artifactSetHash,
    personal_rsl_replay_hash: replayHash,
    personal_rsl_head_hash: headHash,
    active_personal_rsl_event_ids: [...activeEventIds],
    baseline_five_boxes: Object.fromEntries(LIVING_TWIN_BOXES.map((box) => [box, clone(baselineState[box])])),
    baseline_engagement: clone(baselineState.engagement),
    five_boxes: Object.fromEntries(LIVING_TWIN_BOXES.map((box) => [box, clone(state[box])])),
    engagement: clone(state.engagement),
    changed_governed_objects: [...new Set(changedObjects)].sort(),
    completeness: {
      box_count: LIVING_TWIN_BOXES.length,
      all_boxes_present: LIVING_TWIN_BOXES.every((box) => Boolean(state[box])),
      source_authority_count: artifactLineage.length,
      plan_135_complete: completePlan(state.PLAN_135),
      partial_publication: false,
    },
    compatibility_status: 'COMPATIBLE',
    validation_status: 'PASS',
    publication_state: 'CURRENT_COMPLETE',
    published_at: new Date(publishedAt).toISOString(),
  };
}

export function createInitialLivingBusinessTwinPublication({ scope, artifact_lineage, initial_state, published_at }) {
  if (!validateArtifactLineage(artifact_lineage)) return deepFreeze({ ok: false, code: 'AFW05_COMPLETE_SOURCE_AUTHORITY_REQUIRED' });
  const state = normalizeInitialState(initial_state);
  const emptyReplayHash = hashCanonicalJson({ scope, active_events: [], source_watermark: null });
  const body = publicationBody({
    scope,
    publicationVersion: 1,
    previousHash: null,
    artifactLineage: artifact_lineage,
    baselineState: state,
    state,
    replayHash: emptyReplayHash,
    headHash: null,
    activeEventIds: [],
    changedObjects: [],
    publishedAt: published_at,
  });
  const publication = deepFreeze({ ...body, publication_hash: hashCanonicalJson(body) });
  return deepFreeze({ ok: true, code: 'AFW05_INITIAL_LIVING_TWIN_CREATED', publication });
}

function parseWay(value) {
  let parsed;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!parsed || typeof parsed.title !== 'string' || !parsed.title.trim()
    || !Array.isArray(parsed.strategies) || parsed.strategies.length !== 5
    || parsed.strategies.some((item) => typeof item !== 'string' || !item.trim())) return null;
  return { title: parsed.title.trim(), strategies: parsed.strategies.map((item) => item.trim()) };
}

function applyItem(state, item) {
  const [root, field] = item.field.split('.', 2);
  if (!field) return { ok: false, code: 'AFW05_MUTATION_PATH_INVALID' };
  if (root === 'plan_135') {
    if (field === 'goal') state.PLAN_135.goal = item.value.trim();
    else if (/^way_[123]$/u.test(field)) {
      const way = parseWay(item.value);
      if (!way) return { ok: false, code: 'AFW05_PLAN_WAY_SHAPE_INVALID' };
      state.PLAN_135.ways[Number(field.at(-1)) - 1] = way;
    } else return { ok: false, code: 'AFW05_PLAN_FIELD_DENIED' };
    state.PLAN_135.complete = completePlan(state.PLAN_135);
    return { ok: true, changed: 'PLAN_135' };
  }
  if (root === 'where_you_are') {
    state.WHERE_YOU_ARE.accepted_changes[field] = item.value;
    return { ok: true, changed: 'WHERE_YOU_ARE' };
  }
  if (root === 'five_futures' && field === 'challenge') {
    if (!state.FIVE_FUTURES.customer_challenges.includes(item.value)) state.FIVE_FUTURES.customer_challenges.push(item.value);
    return { ok: true, changed: 'FIVE_FUTURES' };
  }
  if (root === 'one_move' && field === 'challenge') {
    if (!state.ONE_MOVE.customer_challenges.includes(item.value)) state.ONE_MOVE.customer_challenges.push(item.value);
    return { ok: true, changed: 'ONE_MOVE' };
  }
  if (root === 'evidence') {
    state.EVIDENCE.accepted_changes[field] = item.value;
    return { ok: true, changed: 'EVIDENCE' };
  }
  if (root === 'commitment') {
    state.engagement.commitments.push({ commitment: item.value, field });
    return { ok: true, changed: 'PLAN_135' };
  }
  return { ok: false, code: 'AFW05_MUTATION_PATH_INVALID' };
}

function applyActiveEvent(state, event) {
  const payload = event.semantic_payload || {};
  const changed = [];
  for (const item of payload.items || []) {
    const result = applyItem(state, item);
    if (!result.ok) return result;
    changed.push(result.changed);
  }
  if (event.event_type === 'COMMITMENT' && !(payload.items || []).some((item) => item.field.startsWith('commitment.'))) {
    state.engagement.commitments.push({ commitment: payload.summary, field: 'general' });
  }
  if (isAgreedIntervention(event)) state.engagement.interventions.push({ intervention: payload.summary, event_id: event.event_id });
  if (event.event_type === 'OUTCOME') state.engagement.outcomes.push({ outcome: payload.summary, event_id: event.event_id });
  if (event.event_type === 'CORRECTION') state.EVIDENCE.corrections.push({ event_id: event.event_id, summary: payload.summary });
  return { ok: true, changed };
}

export function recomputeLivingBusinessTwin({ prior_publication, personal_rsl_replay, published_at }) {
  if (!validatePublicationHash(prior_publication) || !personal_rsl_replay?.ok || !sameScope(prior_publication.scope, personal_rsl_replay.state?.scope)) {
    return deepFreeze({ ok: false, code: 'AFW05_RECOMPUTATION_INPUT_INVALID' });
  }
  const baseline = normalizeInitialState({
    ...clone(prior_publication.baseline_five_boxes || prior_publication.five_boxes),
    plan_135: clone((prior_publication.baseline_five_boxes || prior_publication.five_boxes).PLAN_135),
    engagement: clone(prior_publication.baseline_engagement || { commitments: [], interventions: [], outcomes: [] }),
  });
  const state = normalizeInitialState({ ...clone(baseline), plan_135: clone(baseline.PLAN_135), engagement: clone(baseline.engagement) });
  const priorEventIds = new Set(prior_publication.active_personal_rsl_event_ids);
  const newActiveEvents = personal_rsl_replay.state.active_events.filter((event) => !priorEventIds.has(event.event_id));
  const changed = [];
  for (const event of personal_rsl_replay.state.active_events) {
    const applied = applyActiveEvent(state, event);
    if (!applied.ok) return deepFreeze(applied);
    if (newActiveEvents.some((candidate) => candidate.event_id === event.event_id)) changed.push(...applied.changed);
  }
  for (const box of LIVING_TWIN_BOXES) {
    if (hashCanonicalJson(prior_publication.five_boxes[box]) !== hashCanonicalJson(state[box])) changed.push(box);
  }
  const body = publicationBody({
    scope: prior_publication.scope,
    publicationVersion: prior_publication.publication_version + 1,
    previousHash: prior_publication.publication_hash,
    artifactLineage: prior_publication.source_artifact_lineage,
    baselineState: baseline,
    state,
    replayHash: personal_rsl_replay.replay_hash,
    headHash: personal_rsl_replay.state.source_watermark,
    activeEventIds: personal_rsl_replay.state.active_events.map((event) => event.event_id),
    changedObjects: changed,
    publishedAt: published_at,
  });
  if (!body.completeness.all_boxes_present || body.completeness.source_authority_count !== 8) {
    return deepFreeze({ ok: false, code: 'AFW05_PARTIAL_PUBLICATION_DENIED' });
  }
  const publication = deepFreeze({ ...body, publication_hash: hashCanonicalJson(body) });
  return deepFreeze({
    ok: true,
    code: 'AFW05_LIVING_TWIN_RECOMPUTED',
    publication,
    deterministic_replay_hash: personal_rsl_replay.replay_hash,
    provider_calls: 0,
    frozen_authority_mutations: 0,
  });
}

export function compareLivingTwinReplay(left, right) {
  const equivalent = Boolean(validatePublicationHash(left) && validatePublicationHash(right)
    && left.personal_rsl_replay_hash === right.personal_rsl_replay_hash
    && hashCanonicalJson(left.five_boxes) === hashCanonicalJson(right.five_boxes));
  return deepFreeze({ equivalent, left_hash: left?.publication_hash || null, right_hash: right?.publication_hash || null });
}
