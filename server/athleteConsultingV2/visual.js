import { binding, bundles, digest, validateBundle } from './bundles.js';
import { buildLegacySessionMapChange, buildSessionMapChange } from './mapChange.js';
import { createAthleteVisualCore } from '../athleteApa/visualCore.js';
const core = createAthleteVisualCore(Object.freeze({
  planVersion: 'athlete-consulting-v2-visual-v1',
  schemaName: 'athlete_consulting_visual_v1',
  worldContract: 'ATHLETE_CONSULTING_V2_VISUAL_WORLD_V1',
  authorityDescription: 'one selected fictional Athlete Consulting relationship',
  assertWorldInput({ bundle, state }) {
    const slug = bundle?.person?.slug, pinned = bundles[slug];
    if (!['nia', 'sofia'].includes(slug) || !pinned || bundle.person.synthetic !== true
      || bundle.bos?.synthetic !== true || bundle.apa?.synthetic !== true
      || bundle.person.mm !== pinned.person.mm || state?.mm !== pinned.person.mm
      || bundle.bos.mm !== pinned.person.mm || bundle.apa.mm !== pinned.person.mm
      || bundle.bos.artifact_sha256 !== pinned.bos.artifact_sha256
      || bundle.apa.artifact_sha256 !== pinned.apa.artifact_sha256
      || JSON.stringify(bundle.person) !== JSON.stringify(pinned.person))
      throw new Error('ATHLETE_VISUAL_SOURCE_SCOPE_DENIED');
    validateBundle(slug, bundle);
  },
  visualBinding({ bundle, scopeId }) {
    const pinned = bundles[bundle.person.slug];
    return { relationshipScopeHash: digest({ scopeId, ...binding(bundle.person.slug) }),
      mm: pinned.person.mm, bosHash: pinned.bos.artifact_sha256,
      baselineApaHash: pinned.apa.artifact_sha256 };
  },
  classification: kind => `SYNTHETIC_${kind}`,
  validateAcceptedPlan(plan) {
    if (typeof plan.accepted_at !== 'string' || !plan.accepted_at.trim()
      || !Array.isArray(plan.approvals) || !plan.approvals.includes('athlete')
      || (plan.steps.some(step => step.owner === 'coach') && !plan.approvals.includes('coach')))
      throw new Error('ATHLETE_VISUAL_PLAN_AUTHORITY_INVALID');
  },
  mapChange: input => input.state.sessionStartMap == null
    ? buildLegacySessionMapChange(input) : buildSessionMapChange(input),
}));
export const { ATHLETE_VISUAL_PLAN_VERSION, ATHLETE_VISUAL_EVENTS, ATHLETE_VISUAL_OUTPUT_SCHEMA,
  buildAthleteVisualWorld, validateAthleteVisualPlan, materializeAthleteVisualPlan,
  buildAthleteVisualRequest, createAthleteVisualComposer, recoverAthleteVisualComposition } = core;
