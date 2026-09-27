import { assertOwner, hash, requireThat, validateCanonicalCoachBundle } from './bundle.js';
import { SOURCE_PLAN_RULES } from './state.js';
import { currentApaHash } from '../../athleteApa/currentApaCore.js';
import { createSessionMapCore } from '../../athleteApa/sessionMapCore.js';

export const MAIN_SESSION_MAP_START_CONTRACT = 'athlete_academy_session_map_start_v1';
export const MAIN_SESSION_MAP_CHANGE_CONTRACT = 'athlete_academy_session_map_change_v1';
const iso = value => typeof value === 'string' && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString() === value;
const planBody = plan => ({ title: plan.title, why: plan.why, steps: plan.steps, review: plan.review });

// Account authority is supplied by the owning service, not by a demo slug or
// by a synthetic marker. Structural synthetic replay stays explicitly labelled.
export function assertMainMapSource(bundle, state) {
  validateCanonicalCoachBundle(bundle);
  requireThat(!Object.hasOwn(bundle.person, 'slug')
    && hash(Object.keys(bundle.binding).sort()) === hash(['actorId', 'apa', 'bos', 'mm'])
    && state?.mm === bundle.person.mm && hash(state.sourceBinding) === hash(bundle.binding),
  'MAIN_MAP_CANONICAL_SOURCE_REQUIRED');
  return { actorId: bundle.binding.actorId, mm: bundle.person.mm,
    bos_hash: bundle.bos.artifact_sha256, baseline_apa_hash: bundle.apa.artifact_sha256 };
}

export function mainMapClassification(kind, bundle) {
  const synthetic = bundle.person.synthetic === true || bundle.bos.synthetic === true || bundle.apa.synthetic === true;
  return `${synthetic ? 'AUTHENTICATED_SYNTHETIC' : 'PRIVATE_AUTHENTICATED'}_${kind}`;
}

export function mainAcceptedPlan(plan, bundle) {
  if (plan == null) return null;
  SOURCE_PLAN_RULES.validatePlan(plan);
  const actorId = bundle.binding.actorId;
  requireThat(typeof plan.id === 'string' && plan.id.trim() && plan.id.length <= 160
    && iso(plan.accepted_at) && plan.hash === hash(planBody(plan))
    && (plan.visibility === undefined || plan.visibility === 'private')
    && (plan.proposedBy === undefined || plan.proposedBy === actorId)
    && !plan.steps.some(step => step.owner === 'coach')
    && Array.isArray(plan.approvals) && plan.approvals.length === 1
    && plan.approvals.every(entry => entry && entry.actorId === actorId
      && entry.hash === plan.hash && iso(entry.at)
      && Date.parse(entry.at) <= Date.parse(plan.accepted_at)), 'MAP_CHANGE_PLAN_NOT_ACCEPTED');
  const copy = structuredClone(plan);
  return { id: copy.id, hash: currentApaHash(copy), accepted_at: copy.accepted_at,
    title: copy.title, why: copy.why, steps: copy.steps, review: copy.review };
}

export function createMainMapChangeAdapter({ assertFencedAuthority, currentApaAdapter } = {}) {
  requireThat(typeof assertFencedAuthority === 'function'
    && typeof currentApaAdapter?.currentApaView === 'function', 'MAIN_MAP_FENCE_REQUIRED');
  const core = createSessionMapCore(Object.freeze({
    startContract: MAIN_SESSION_MAP_START_CONTRACT, changeContract: MAIN_SESSION_MAP_CHANGE_CONTRACT,
    binding: assertMainMapSource, acceptedPlan: mainAcceptedPlan,
    classification: mainMapClassification,
    currentApaView: (bundle, record, input) => currentApaAdapter.currentApaView({
      bundle, record, principal: input.principal }),
  }));
  function fenced(input, operation) {
    assertMainMapSource(input?.bundle, input?.state);
    assertOwner(input.bundle, input.principal);
    requireThat(input.principal.grants?.reportsRead === true, 'COACH_REPORT_ACCESS_DENIED');
    requireThat(input.authority && typeof input.authority === 'object'
      && !Array.isArray(input.authority) && assertFencedAuthority({ ...input, operation }) === true,
    'MAIN_MAP_FENCE_REQUIRED');
  }
  const wrap = (name, operation) => input => { fenced(input, operation); return core[name](input); };
  return Object.freeze({
    captureSessionStartMap: wrap('captureSessionStartMap', 'map_start'),
    buildSessionMapChange: wrap('buildSessionMapChange', 'map_change'),
    buildLegacySessionMapChange: wrap('buildLegacySessionMapChange', 'map_legacy'),
    compareSessionMapSummaries: core.compareSessionMapSummaries,
  });
}
