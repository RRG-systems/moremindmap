import { validateBundle } from './bundles.js';
import { currentApaHash, currentApaView } from './currentApa.js';
import { validatePlan } from './state.js';
import { createSessionMapCore } from '../athleteApa/sessionMapCore.js';

export const SESSION_MAP_START_CONTRACT = 'athlete_session_map_start_v1';
export const SESSION_MAP_CHANGE_CONTRACT = 'athlete_session_map_change_v1';
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const iso = value => typeof value === 'string' && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString() === value;
const core = createSessionMapCore(Object.freeze({
  startContract: SESSION_MAP_START_CONTRACT, changeContract: SESSION_MAP_CHANGE_CONTRACT,
  binding(bundle, state) {
    const slug = bundle?.person?.slug;
    ensure(['nia', 'sofia'].includes(slug), 'MAP_CHANGE_SYNTHETIC_ONLY');
    validateBundle(slug, bundle);
    ensure(state?.mm === bundle.person.mm, 'MAP_CHANGE_ATHLETE_MISMATCH');
    return { slug, mm: bundle.person.mm, bos_hash: bundle.bos.artifact_sha256,
      baseline_apa_hash: bundle.apa.artifact_sha256 };
  },
  currentApaView: (bundle, record) => currentApaView(bundle, record),
  acceptedPlan(plan) {
    if (plan == null) return null;
    validatePlan(plan);
    ensure(typeof plan.id === 'string' && plan.id.length <= 160 && iso(plan.accepted_at)
      && Array.isArray(plan.approvals) && plan.approvals.includes('athlete')
      && plan.steps.every(step => step.owner !== 'coach' || plan.approvals.includes('coach')),
    'MAP_CHANGE_PLAN_NOT_ACCEPTED');
    const copy = structuredClone(plan);
    return { id: copy.id, hash: currentApaHash(copy), accepted_at: copy.accepted_at,
      title: copy.title, why: copy.why, steps: copy.steps, review: copy.review };
  },
  classification: kind => `SYNTHETIC_${kind}`,
}));
export const { captureSessionStartMap, buildSessionMapChange,
  buildLegacySessionMapChange, compareSessionMapSummaries } = core;
