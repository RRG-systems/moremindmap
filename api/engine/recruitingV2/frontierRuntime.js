import { stableHash } from '../../../src/lib/recruitingV1/contracts.js';
import { createRecruitingV2SyntheticWorld } from '../../../src/lib/recruitingV2/syntheticWorld.js';
import {
  FRONTIER_MODEL_CONFIG,
  FRONTIER_SURFACE_PLAN_SCHEMA,
  exactStateBinding,
  materializeFrontierPlan,
  validateFrontierPlan,
} from '../../../src/lib/recruitingV2/frontierContract.js';
import { buildFrontierMessages } from './frontierPrompt.js';
import { createRecruitingV2OpenRouterTransport } from './openRouterTransport.js';

function boundedText(value, max = 4000) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) throw Object.assign(new Error('RECRUITING_V2_PURPOSE_REQUIRED'), { code: 'RECRUITING_V2_PURPOSE_REQUIRED' });
  if (clean.length > max) throw Object.assign(new Error('RECRUITING_V2_PURPOSE_TOO_LONG'), { code: 'RECRUITING_V2_PURPOSE_TOO_LONG' });
  return clean;
}

function safeSessionContext(value, world) {
  if (!value || value.contract !== 'recruiting_v2_shared_business_session_003a_v1') throw new Error('RECRUITING_V2_SESSION_CONTEXT_INVALID');
  if (value.relationshipId !== world.relationship.id || value.worldVersion !== world.version) throw new Error('RECRUITING_V2_SESSION_SCOPE_DENIED');
  if (!Number.isInteger(value.revision) || value.revision < 1 || value.revision > 10_000) throw new Error('RECRUITING_V2_SESSION_REVISION_INVALID');
  const allowedActors = new Set(['DARREN', 'JORDAN', 'MORE', 'SYSTEM']);
  const recentEvents = Array.isArray(value.recentEvents) ? value.recentEvents.slice(-16).map((item) => ({
    eventId: boundedText(item.eventId, 120), type: boundedText(item.type, 120),
    actor: allowedActors.has(item.actor) ? item.actor : 'SYSTEM', assertedBy: boundedText(item.assertedBy, 120),
    subject: boundedText(item.subject, 240), text: boundedText(item.text, 4000),
    evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs.slice(0, 20).map((id) => boundedText(id, 140)) : [],
    perspectiveState: boundedText(item.perspectiveState, 120), occurredAt: boundedText(item.occurredAt, 80),
    lineage: item.lineage || null, metadata: item.metadata || null,
  })) : [];
  return Object.freeze({
    contract: value.contract, sessionId: boundedText(value.sessionId, 140), relationshipId: value.relationshipId,
    worldVersion: value.worldVersion, status: value.status === 'COMPLETED' ? 'COMPLETED' : 'OPEN', revision: value.revision,
    currentPurpose: value.currentPurpose ? boundedText(value.currentPurpose, 4000) : null,
    recentEvents,
    activeHypotheses: Array.isArray(value.activeHypotheses) ? value.activeHypotheses.slice(-8) : [],
    hypothesisHistory: Array.isArray(value.hypothesisHistory) ? value.hypothesisHistory.slice(-16) : [],
    decisions: Array.isArray(value.decisions) ? value.decisions.slice(-8) : [], commitments: Array.isArray(value.commitments) ? value.commitments.slice(-12) : [],
    scenarioAssumptions: value.scenarioAssumptions && typeof value.scenarioAssumptions === 'object' ? value.scenarioAssumptions : {},
    projectionEligibility: 'SESSION_ONLY',
  });
}

export function createRecruitingV2FrontierRuntime({ apiKey, transport, modelConfig = FRONTIER_MODEL_CONFIG, maxAttempts = 2, governedWorld = null } = {}) {
  const callFrontier = transport || createRecruitingV2OpenRouterTransport({ apiKey, modelConfig });
  const world = governedWorld || createRecruitingV2SyntheticWorld();
  const worldHash = stableHash(world);

  async function planSurface({ purpose, sessionContext }) {
    const startedAt = performance.now();
    const humanPurpose = boundedText(purpose);
    const safeContext = safeSessionContext(sessionContext, world);
    const sessionContextHash = stableHash(safeContext);
    const binding = exactStateBinding({ world, worldHash, sessionContext: safeContext, sessionContextHash });
    const attempts = [];
    let repair = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await callFrontier({
        messages: buildFrontierMessages({ world, stateBinding: binding, sessionContext: safeContext, humanPurpose, repair }),
        schema: FRONTIER_SURFACE_PLAN_SCHEMA,
        schemaName: 'more_recruiting_v2_surface_plan_003a',
      });
      const validation = validateFrontierPlan({
        candidate: response.parsed,
        world,
        stateBinding: binding,
        priorHypotheses: safeContext.hypothesisHistory,
        sessionContext: safeContext,
      });
      attempts.push({ attempt, validation, receipt: response.receipt });
      if (validation.ok) {
        const totalLatencyMs = Math.round(performance.now() - startedAt);
        const receipt = Object.freeze({
          runtime: 'recruiting-v2-frontier-runtime-003a-v1', modelConfig,
          attempts: attempts.length, repairEvents: attempts.filter((item) => !item.validation.ok).map((item) => item.validation.errors),
          provider: response.receipt, totalLatencyMs, worldHash, sessionContextHash,
          rawRequestPersisted: false, rawResponsePersisted: false, store: false,
        });
        return Object.freeze({ plan: materializeFrontierPlan({ candidate: response.parsed, world, validation, providerReceipt: receipt }), receipt });
      }
      repair = { candidate: response.parsed, errors: validation.errors };
    }
    const error = new Error('RECRUITING_V2_FRONTIER_PLAN_FAILED_CLOSED');
    error.code = 'RECRUITING_V2_FRONTIER_PLAN_FAILED_CLOSED';
    error.validationErrors = attempts.at(-1)?.validation?.errors || [];
    error.attempts = attempts.length;
    throw error;
  }

  return Object.freeze({ planSurface, world, worldHash, modelConfig });
}
