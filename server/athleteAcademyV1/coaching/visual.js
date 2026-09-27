import { hash, requireThat, assertOwner } from './bundle.js';
import { createAthleteVisualCore } from '../../athleteApa/visualCore.js';
import { assertMainMapSource, mainMapClassification, mainAcceptedPlan,
  createMainMapChangeAdapter } from './mapChange.js';

export const MAIN_VISUAL_PLAN_VERSION = 'athlete-academy-visual-v1';
export const MAIN_VISUAL_WORLD_CONTRACT = 'ATHLETE_ACADEMY_VISUAL_WORLD_V1';

export function createMainVisualAdapter({ assertFencedAuthority, currentApaAdapter, mapChangeAdapter } = {}) {
  requireThat(typeof assertFencedAuthority === 'function'
    && typeof currentApaAdapter?.currentApaView === 'function', 'MAIN_VISUAL_FENCE_REQUIRED');
  const maps = mapChangeAdapter || createMainMapChangeAdapter({ assertFencedAuthority, currentApaAdapter });
  const ownedWorlds = new WeakSet();
  const core = createAthleteVisualCore(Object.freeze({
    planVersion: MAIN_VISUAL_PLAN_VERSION, schemaName: 'athlete_academy_visual_v1',
    worldContract: MAIN_VISUAL_WORLD_CONTRACT,
    authorityDescription: 'one private authenticated canonical Athlete account and its exact saved reports; synthetic metadata is classification only, never identity or authorization',
    bindingProperties: Object.freeze({ actorId: Object.freeze({ type: 'string', minLength: 1, maxLength: 160 }) }),
    assertWorldInput(input) {
      assertMainMapSource(input.bundle, input.state);
      assertOwner(input.bundle, input.principal);
      requireThat(input.principal.grants?.reportsRead === true, 'COACH_REPORT_ACCESS_DENIED');
      requireThat(input.sessionId === input.state.sessionId && input.authority
        && typeof input.authority === 'object' && !Array.isArray(input.authority)
        && assertFencedAuthority({ ...input, operation: 'visual_world' }) === true,
      'MAIN_VISUAL_FENCE_REQUIRED');
    },
    visualBinding({ bundle, scopeId }) {
      return { actorId: bundle.binding.actorId,
        relationshipScopeHash: hash({ scopeId, ...bundle.binding }), mm: bundle.person.mm,
        bosHash: bundle.bos.artifact_sha256, baselineApaHash: bundle.apa.artifact_sha256 };
    },
    readCurrentApa(input) {
      if (input.currentApa !== undefined && input.currentApa !== null)
        requireThat(hash(input.currentApa) === hash(input.state.currentApa || null), 'MAIN_VISUAL_CURRENT_APA_SOURCE_REQUIRED');
      const view = currentApaAdapter.currentApaView({ bundle: input.bundle,
        record: input.state.currentApa || null, principal: input.principal });
      return { apa: view.artifact, version: String(view.version) };
    },
    classification: mainMapClassification,
    approvedLearning: (state, bundle) => (state.learning || []).filter(item =>
      item.actorId === bundle.binding.actorId && item.speaker === 'athlete'
      && typeof item.approved_at === 'string' && Number.isFinite(Date.parse(item.approved_at))
      && new Date(item.approved_at).toISOString() === item.approved_at
      && typeof item.text === 'string' && item.text.trim().length > 0 && item.text.length <= 1200),
    validateAcceptedPlan: mainAcceptedPlan,
    mapChange: input => input.state.sessionStartMap == null
      ? maps.buildLegacySessionMapChange(input) : maps.buildSessionMapChange(input),
  }));
  const ownWorld = world => requireThat(ownedWorlds.has(world), 'MAIN_VISUAL_WORLD_AUTHORITY_REQUIRED');
  return Object.freeze({
    ATHLETE_VISUAL_PLAN_VERSION: core.ATHLETE_VISUAL_PLAN_VERSION,
    ATHLETE_VISUAL_EVENTS: core.ATHLETE_VISUAL_EVENTS,
    ATHLETE_VISUAL_OUTPUT_SCHEMA: core.ATHLETE_VISUAL_OUTPUT_SCHEMA,
    buildAthleteVisualWorld(input) {
      const world = core.buildAthleteVisualWorld(input); ownedWorlds.add(world); return world;
    },
    validateAthleteVisualPlan: core.validateAthleteVisualPlan,
    materializeAthleteVisualPlan(input) { ownWorld(input.world); return core.materializeAthleteVisualPlan(input); },
    buildAthleteVisualRequest(world) { ownWorld(world); return core.buildAthleteVisualRequest(world); },
    createAthleteVisualComposer(options) {
      const compose = core.createAthleteVisualComposer(options);
      return world => { ownWorld(world); return compose(world); };
    },
    recoverAthleteVisualComposition(input) {
      ownWorld(input.world); return core.recoverAthleteVisualComposition(input);
    },
  });
}
