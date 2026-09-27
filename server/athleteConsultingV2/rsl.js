import { hashCanonicalJson } from '../../src/lib/intelligenceFabric/hashing.js';
import { deepFreeze, isCanonicalTimestamp } from '../../src/lib/intelligenceFabric/validation.js';

import { createAthleteRslCore } from '../athleteApa/rslCore.js';

// Exact legacy synthetic policy; shared extraction does not widen demo authority.
const SCOPE_CONTRACT = 'athlete_consulting_v2_rsl_scope_v1';
const MAX_EVENTS = 512, MAX_TEXT = 1200;
const HASH = /^[a-f0-9]{64}$/u;
const TYPES = { APPROVED_LEARNING: { authority: 'ATHLETE_LEARNING_CONFIRMATION' }, ACCEPTED_PLAN: { authority: 'PROTECTED_PLAN_APPROVAL' } };
function requireThat(condition, code) {
  if (!condition) throw new Error(code);
}

function string(value, max = MAX_TEXT) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}


function validScope(scope) {
  return scope?.contract === SCOPE_CONTRACT && ['nia', 'sofia'].includes(scope.slug)
    && string(scope.mm, 120) && HASH.test(scope.scope_hash || '')
    && HASH.test(scope.bos_hash || '') && HASH.test(scope.apa_hash || '')
    && Object.keys(scope).sort().join('|') === 'apa_hash|bos_hash|contract|mm|scope_hash|slug';
}

function planSnapshot(plan) {
  requireThat(plan && string(plan.id, 160) && HASH.test(plan.hash || '')
    && isCanonicalTimestamp(plan.accepted_at) && string(plan.title)
    && string(plan.why) && string(plan.review)
    && Array.isArray(plan.steps) && plan.steps.length > 0 && plan.steps.length <= 8
    && plan.steps.every((step) => string(step.action) && string(step.when)
      && string(step.notice) && ['athlete', 'coach'].includes(step.owner))
    && Array.isArray(plan.approvals) && plan.approvals.length <= 2
    && plan.approvals.every((actor) => ['athlete', 'coach'].includes(actor))
    && plan.approvals.includes('athlete')
    && (!plan.steps.some((step) => step.owner === 'coach') || plan.approvals.includes('coach')),
  'ATHLETE_RSL_PLAN_NOT_ACCEPTED');
  return { id: plan.id, hash: plan.hash, accepted_at: plan.accepted_at,
    approvals: [...new Set(plan.approvals)].sort(),
    title: plan.title, why: plan.why, review: plan.review,
    steps: plan.steps.map(({ action, when, notice, owner }) => ({ action, when, notice, owner })) };
}

export function createAthleteRslScope({ scopeId, bundle }) {
  const person = bundle?.person;
  requireThat(string(scopeId, 4096) && person?.synthetic === true
    && ['nia', 'sofia'].includes(person.slug) && string(person.mm, 120)
    && bundle.bos?.synthetic === true && bundle.apa?.synthetic === true
    && bundle.bos.mm === person.mm && bundle.apa.mm === person.mm
    && HASH.test(bundle.bos.artifact_sha256 || '') && HASH.test(bundle.apa.artifact_sha256 || ''),
  'ATHLETE_RSL_SCOPE_DENIED');
  const identity = { slug: person.slug, mm: person.mm,
    bos_hash: bundle.bos.artifact_sha256, apa_hash: bundle.apa.artifact_sha256 };
  return deepFreeze({ contract: SCOPE_CONTRACT, ...identity,
    scope_hash: hashCanonicalJson({ scopeId, ...identity }) });
}

const core = createAthleteRslCore(Object.freeze({
  contracts: Object.freeze({ scope: SCOPE_CONTRACT, event: 'athlete_consulting_v2_rsl_event_v1',
    replay: 'athlete_consulting_v2_rsl_replay_v1', context: 'athlete_consulting_v2_rsl_context_v1', targets: 'athlete_consulting_v2_rsl_correction_targets_v1' }),
  validScope, planSnapshot,
  eventIdentity: scope => ({ athlete_slug: scope.slug, athlete_mm: scope.mm }),
  eventMatches: (event,scope) => event.athlete_slug === scope.slug && event.athlete_mm === scope.mm,
  sourceMatches: () => true, sourceIdentity: () => ({}), restoreSourceIdentity: () => ({}),
}));
export const createAthleteRslEvent = core.createRslEvent;
export const replayAthleteRsl = core.replayRsl;
export const validateAthleteRslSourceMessages = core.validateRslSources;
export const athleteRslRetrievalContext = core.retrieveRslContext;
export const athleteRslActiveCorrectionTargets = core.retrieveRslCorrectionTargets;

export function deriveAthleteRslEvents({ scope, bundle, state }) {
  requireThat(validScope(scope) && bundle?.person?.synthetic === true
    && bundle.person.slug === scope.slug && bundle.person.mm === scope.mm
    && bundle.bos?.artifact_sha256 === scope.bos_hash
    && bundle.apa?.artifact_sha256 === scope.apa_hash
    && bundle.bos?.synthetic === true && bundle.apa?.synthetic === true
    && state?.mm === scope.mm && Array.isArray(state.learning),
  'ATHLETE_RSL_SCOPE_DENIED');
  const events = [];
  for (const item of state.learning) {
    if (item?.speaker !== 'athlete' || !string(item.id, 160)
      || !string(item.text) || !isCanonicalTimestamp(item.approved_at)) continue;
    events.push(createAthleteRslEvent({ scope, type: 'APPROVED_LEARNING',
      sourceId: item.id, recordedAt: item.approved_at, text: item.text,
      authority: TYPES.APPROVED_LEARNING.authority }));
  }
  if (state.plan !== null && state.plan !== undefined) {
    const plan = planSnapshot(state.plan);
    events.push(createAthleteRslEvent({ scope, type: 'ACCEPTED_PLAN',
      sourceId: plan.id, recordedAt: plan.accepted_at, plan,
      authority: TYPES.ACCEPTED_PLAN.authority }));
  }
  requireThat(events.length <= MAX_EVENTS, 'ATHLETE_RSL_TOO_MANY_EVENTS');
  return deepFreeze(events.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)
    || a.event_id.localeCompare(b.event_id)));
}
