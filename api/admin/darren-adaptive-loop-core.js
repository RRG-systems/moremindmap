import crypto from 'crypto';
import Redis from 'ioredis';
import {
  DARREN_STRATEGY_CONTEXT_TYPE,
  EVIDENCE_WEIGHTS,
  loadDarrenOutcomeLedgerEvents,
  loadLatestDarrenGeneratedStrategy
} from './darren-generated-strategy-core.js';
import { DARREN_PROFILE_ID, buildDarrenIntelligenceSnapshot } from './darren-intelligence-snapshot-core.js';
import { buildDarrenDashboardContextCompact } from './darren-dashboard-context-core.js';
import { buildComparison } from './darren-since-last-snapshot.js';

export const CHAT_SESSION_SUMMARY_VERSION = 'chat_session_summary_v0';
export const FUTURE_MOVEMENT_VERSION = 'future_movement_v0';
export const ADAPTIVE_STRATEGY_DRAFT_VERSION = 'adaptive_strategy_draft_v0';

export const SESSION_INTENTS = new Set([
  'general',
  'partner_idea',
  'pitch_help',
  'one_move',
  'what_changed',
  'overclaim_risk',
  'proof_target',
  'other'
]);

export const MOVEMENT_BANDS = new Set([
  'unchanged',
  'watch',
  'early_support',
  'strengthening',
  'strong_support',
  'validated',
  'weakening',
  'invalidated'
]);

const DEFAULT_DRAFT_MODEL = 'gpt-4o-2024-08-06';
const SAFE_DRAFT_MODELS = new Set(['gpt-4o-2024-08-06', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o']);
const MAX_NOTE_LENGTH = 1600;
const MAX_SESSION_MESSAGES = 12;

function createId(prefix, now = new Date()) {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${datePart}-${crypto.randomBytes(5).toString('hex')}`;
}

function chatSessionSummaryKey(summaryId) {
  return `chat_session_summary:${summaryId}`;
}

function chatSessionSummaryIndexKey(profileId, contextType) {
  return `chat_session_summary_index:${profileId}:${contextType}`;
}

function futureMovementAssessmentKey(assessmentId) {
  return `future_movement_assessment:${assessmentId}`;
}

function futureMovementLatestKey(profileId, contextType) {
  return `future_movement_latest:${profileId}:${contextType}`;
}

function adaptiveStrategyDraftKey(draftId) {
  return `adaptive_strategy_draft:${draftId}`;
}

function adaptiveStrategyDraftLatestKey(profileId, contextType) {
  return `adaptive_strategy_draft_latest:${profileId}:${contextType}`;
}

function getRedis() {
  if (!process.env.REDIS_URL) {
    const error = new Error('adaptive_loop_persistence_not_configured');
    error.code = 'adaptive_loop_persistence_not_configured';
    error.status = 500;
    throw error;
  }
  return new Redis(process.env.REDIS_URL);
}

function statusError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function boundedText(value, maxLength = MAX_NOTE_LENGTH) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.length > maxLength) throw statusError('adaptive_loop_text_too_long', 400);
  if (/canonical[\s_-]+dossier|canonical[\s_-]+profile[\s_-]+json|canonical[\s_-]+profile[\s_-]+text|assessment[\s_-]+answers|raw[\s_-]+answers/i.test(text)) {
    throw statusError('adaptive_loop_private_source_reference_rejected', 400);
  }
  if (/redis[\s_-]*url|openai[\s_-]*api[\s_-]*key|moremindmap[\s_-]*admin[\s_-]*dashboard[\s_-]*code/i.test(text)) {
    throw statusError('adaptive_loop_environment_reference_rejected', 400);
  }
  if (/\bd\.j\.?\b|\bdj\b|\bsteve\s+jobs\b|\bwoz\b|\bwozniak\b|\brole[\s_-]+lane\b|\blane[\s_-]+check\b|\bstay\s+in\s+(?:your\s+)?lane\b/i.test(text)) {
    throw statusError('adaptive_loop_forbidden_framing_rejected', 400);
  }
  return text;
}

function compactText(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeArray(values, maxItems = 6, maxLength = 240) {
  return asArray(values)
    .map((item) => boundedText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function safeDraftText(value, fallback, maxLength) {
  try {
    return boundedText(value, maxLength) || fallback;
  } catch {
    return fallback;
  }
}

function safeDraftArray(values, fallback = []) {
  try {
    const cleaned = safeArray(values, 6, 220);
    return cleaned.length ? cleaned : fallback;
  } catch {
    return fallback;
  }
}

function normalizeAdoptionRecommendation(value) {
  const cleaned = safeDraftText(value, 'review_first', 80);
  if (['adopt_now', 'review_first', 'wait_for_more_evidence'].includes(cleaned)) return cleaned;
  const lower = cleaned.toLowerCase();
  if (lower.includes('wait')) return 'wait_for_more_evidence';
  if (lower.includes('adopt')) return 'adopt_now';
  return 'review_first';
}

function summarizeMessages(messages) {
  const safeMessages = asArray(messages)
    .slice(-MAX_SESSION_MESSAGES)
    .map((message) => boundedText(message?.text || message?.content || message, 360))
    .filter(Boolean);
  if (!safeMessages.length) return null;
  return safeMessages.join(' / ').slice(0, MAX_NOTE_LENGTH);
}

function sanitizeSummary(summary) {
  if (!summary) return null;
  return {
    summary_id: summary.summary_id || null,
    profile_id: summary.profile_id || null,
    context_type: summary.context_type || null,
    strategy_id: summary.strategy_id || null,
    conversation_id: summary.conversation_id || null,
    created_at: summary.created_at || null,
    session_intent: summary.session_intent || 'general',
    summary_text: summary.summary_text || null,
    decisions: asArray(summary.decisions),
    open_questions: asArray(summary.open_questions),
    possible_signals: asArray(summary.possible_signals),
    proof_targets_discussed: asArray(summary.proof_targets_discussed),
    overclaim_risks: asArray(summary.overclaim_risks),
    recommended_follow_up: summary.recommended_follow_up || null,
    source_labels: summary.source_labels || {},
    summary_version: summary.summary_version || CHAT_SESSION_SUMMARY_VERSION
  };
}

function sanitizeMovementAssessment(assessment) {
  if (!assessment) return null;
  return {
    assessment_id: assessment.assessment_id || null,
    profile_id: assessment.profile_id || null,
    context_type: assessment.context_type || null,
    strategy_id: assessment.strategy_id || null,
    created_at: assessment.created_at || null,
    movement_version: assessment.movement_version || FUTURE_MOVEMENT_VERSION,
    inputs_summary: assessment.inputs_summary || {},
    future_movements: asArray(assessment.future_movements),
    overall_summary: assessment.overall_summary || null,
    not_yet_claims: asArray(assessment.not_yet_claims),
    automatic_learning_status: assessment.automatic_learning_status || 'evidence-gated draft only; not autonomous replacement',
    source_labels: assessment.source_labels || {}
  };
}

function sanitizeDraft(draft) {
  if (!draft) return null;
  return {
    draft_id: draft.draft_id || null,
    profile_id: draft.profile_id || null,
    context_type: draft.context_type || null,
    source_strategy_id: draft.source_strategy_id || null,
    created_at: draft.created_at || null,
    draft_status: draft.draft_status || 'pending_review',
    what_changed_since_last_strategy: draft.what_changed_since_last_strategy || null,
    evidence_summary: draft.evidence_summary || null,
    future_movement_summary: draft.future_movement_summary || null,
    updated_recommendation: draft.updated_recommendation || null,
    suggested_one_move: draft.suggested_one_move || null,
    proof_target_next: draft.proof_target_next || null,
    what_not_to_overclaim: draft.what_not_to_overclaim || null,
    what_to_watch_next: draft.what_to_watch_next || null,
    adoption_recommendation: draft.adoption_recommendation || null,
    reason: draft.reason || null,
    source_labels: draft.source_labels || {},
    model_limits: asArray(draft.model_limits),
    automatic_learning_boundary: draft.automatic_learning_boundary || 'This draft does not replace the active strategy until reviewed/adopted.',
    draft_version: draft.draft_version || ADAPTIVE_STRATEGY_DRAFT_VERSION
  };
}

export async function createDarrenChatSessionSummary(input) {
  const strategyId = boundedText(input?.strategy_id, 120);
  if (!strategyId) throw statusError('strategy_id_required', 400);
  const sessionIntent = String(input?.session_intent || 'general').trim();
  if (!SESSION_INTENTS.has(sessionIntent)) throw statusError('invalid_chat_session_intent', 400);

  const latestStrategy = await loadLatestDarrenGeneratedStrategy();
  if (!latestStrategy || latestStrategy.strategy_id !== strategyId) {
    throw statusError('generated_strategy_not_found', 404);
  }

  const summaryText = boundedText(input?.summary_note, MAX_NOTE_LENGTH) || summarizeMessages(input?.session_messages);
  if (!summaryText) throw statusError('chat_session_summary_required', 400);

  const now = new Date();
  const summary = {
    summary_id: createId('css', now),
    profile_id: DARREN_PROFILE_ID,
    context_type: DARREN_STRATEGY_CONTEXT_TYPE,
    strategy_id: strategyId,
    conversation_id: boundedText(input?.conversation_id, 120),
    created_at: now.toISOString(),
    session_intent: sessionIntent,
    summary_text: summaryText,
    decisions: safeArray(input?.decisions),
    open_questions: safeArray(input?.open_questions),
    possible_signals: safeArray(input?.possible_signals),
    proof_targets_discussed: safeArray(input?.proof_targets_discussed),
    overclaim_risks: safeArray(input?.overclaim_risks),
    recommended_follow_up: boundedText(input?.recommended_follow_up, 360),
    source_labels: {
      source: 'strategy_chat_summary',
      transcript_storage: 'raw_transcript_not_persisted',
      strategy: 'latest_generated_strategy_reference'
    },
    summary_version: CHAT_SESSION_SUMMARY_VERSION
  };

  const redis = getRedis();
  try {
    await redis.set(chatSessionSummaryKey(summary.summary_id), JSON.stringify(summary));
    await redis.sadd(chatSessionSummaryIndexKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE), summary.summary_id);
    return sanitizeSummary(summary);
  } finally {
    redis.disconnect();
  }
}

export async function loadDarrenChatSessionSummaries({ limit = 5 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 5, 10));
  const redis = getRedis();
  try {
    const ids = await redis.smembers(chatSessionSummaryIndexKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE));
    if (!ids.length) return [];
    const rawItems = await Promise.all(ids.map((id) => redis.get(chatSessionSummaryKey(id))));
    return rawItems
      .map((raw) => {
        if (!raw) return null;
        try {
          return sanitizeSummary(JSON.parse(raw));
        } catch {
          return null;
        }
      })
      .filter((item) => item?.profile_id === DARREN_PROFILE_ID && item?.context_type === DARREN_STRATEGY_CONTEXT_TYPE)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, safeLimit);
  } finally {
    redis.disconnect();
  }
}

function latestEvent(events) {
  return asArray(events)[0] || null;
}

function isRelevantFuture(futureName, signalType) {
  const name = String(futureName || '').toLowerCase();
  const signal = String(signalType || '').toLowerCase();
  if (signal === 'channel_distribution') return /channel|distribution|dashboard|sales|partner|capital|mortgage/.test(name);
  if (signal === 'partner_capital' || signal === 'funded_pilot') return /partner|capital|full|company/.test(name);
  if (signal === 'customer_revenue') return /sales|dashboard|continuation|company/.test(name);
  if (signal === 'profile_volume' || signal === 'assessment_volume') return /dashboard|sales|channel|continuation/.test(name);
  if (signal === 'RRG_opportunity') return /channel|partner|company|continuation/.test(name);
  return /continuation/.test(name);
}

function movementBandFor({ futureName, evidenceWeight, signalType }) {
  if (evidenceWeight === 'none') return 'unchanged';
  if (evidenceWeight === 'weak') return 'watch';
  if (evidenceWeight === 'early') return isRelevantFuture(futureName, signalType) ? 'early_support' : 'watch';
  if (evidenceWeight === 'moderate') return isRelevantFuture(futureName, signalType) ? 'strengthening' : 'watch';
  if (evidenceWeight === 'strong') return isRelevantFuture(futureName, signalType) ? 'strong_support' : 'watch';
  if (evidenceWeight === 'validated') return isRelevantFuture(futureName, signalType) ? 'validated' : 'watch';
  if (evidenceWeight === 'invalidated') return isRelevantFuture(futureName, signalType) ? 'weakening' : 'unchanged';
  return 'unchanged';
}

function buildFutureMovement({ future, event }) {
  const futureName = future?.name || 'Unnamed future';
  const evidenceWeight = EVIDENCE_WEIGHTS.has(event?.evidence_weight) ? event.evidence_weight : 'none';
  const signalType = event?.signal_type || 'none';
  const movementBand = movementBandFor({ futureName, evidenceWeight, signalType });

  return {
    future_name: futureName,
    movement_band: movementBand,
    prior_band: 'unchanged',
    evidence_basis: event
      ? `${event.event_type || 'event'} / ${signalType} / ${evidenceWeight}`
      : 'No ledger event available.',
    evidence_weight: evidenceWeight,
    signal_type: signalType,
    what_changed: movementBand === 'unchanged'
      ? 'No material movement is supported yet.'
      : 'A ledger signal is relevant enough to flag this path for review.',
    what_is_still_missing: 'Repeatable proof, adoption, revenue, funded commitment, or stronger evidence before claiming movement.',
    what_would_strengthen: 'A moderate, strong, or validated signal tied directly to this path.',
    what_would_invalidate: 'A skipped, invalidated, or contradictory ledger event tied directly to this path.'
  };
}

export async function createDarrenFutureMovementAssessment() {
  const strategy = await loadLatestDarrenGeneratedStrategy();
  if (!strategy?.strategy_id) throw statusError('generated_strategy_not_found', 404);
  const [events, summaries] = await Promise.all([
    loadDarrenOutcomeLedgerEvents({ strategy_id: strategy.strategy_id, limit: 10 }),
    loadDarrenChatSessionSummaries({ limit: 5 })
  ]);
  const event = latestEvent(events);
  const now = new Date();
  const futureMovements = asArray(strategy.five_futures)
    .slice(0, 5)
    .map((future) => buildFutureMovement({ future, event }));
  const anySupport = futureMovements.some((item) => ['early_support', 'strengthening', 'strong_support', 'validated'].includes(item.movement_band));

  const assessment = {
    assessment_id: createId('fma', now),
    profile_id: DARREN_PROFILE_ID,
    context_type: DARREN_STRATEGY_CONTEXT_TYPE,
    strategy_id: strategy.strategy_id,
    created_at: now.toISOString(),
    movement_version: FUTURE_MOVEMENT_VERSION,
    inputs_summary: {
      outcome_event_count: events.length,
      latest_event_type: event?.event_type || null,
      latest_signal_type: event?.signal_type || null,
      latest_evidence_weight: event?.evidence_weight || 'none',
      chat_session_summary_count: summaries.length,
      numeric_probabilities_used: false
    },
    future_movements: futureMovements,
    overall_summary: anySupport
      ? 'At least one future path has an evidence-gated movement note. This is not validated proof and not a numeric prediction.'
      : 'Future paths remain unchanged or on watch because evidence is not strong enough for movement.',
    not_yet_claims: [
      'Do not claim validated future movement.',
      'Do not claim automatic learning is fully live.',
      'Do not use numeric probability scoring.',
      'Do not treat early evidence as proof.'
    ],
    automatic_learning_status: 'evidence-gated draft only; not autonomous replacement',
    source_labels: {
      strategy: 'latest_generated_strategy',
      ledger: 'outcome_ledger_v0',
      chat_summary: 'chat_session_summary_v0',
      scoring: 'non_numeric_evidence_band_gate'
    }
  };

  const redis = getRedis();
  try {
    await redis.set(futureMovementAssessmentKey(assessment.assessment_id), JSON.stringify(assessment));
    await redis.set(futureMovementLatestKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE), assessment.assessment_id);
    return sanitizeMovementAssessment(assessment);
  } finally {
    redis.disconnect();
  }
}

export async function loadLatestDarrenFutureMovementAssessment() {
  const redis = getRedis();
  try {
    const assessmentId = await redis.get(futureMovementLatestKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE));
    if (!assessmentId) return null;
    const raw = await redis.get(futureMovementAssessmentKey(assessmentId));
    if (!raw) return null;
    return sanitizeMovementAssessment(JSON.parse(raw));
  } catch {
    return null;
  } finally {
    redis.disconnect();
  }
}

function configuredDraftModel() {
  const explicitModel = String(process.env.DARREN_ADAPTIVE_STRATEGY_OPENAI_MODEL || '').trim();
  return SAFE_DRAFT_MODELS.has(explicitModel) ? explicitModel : DEFAULT_DRAFT_MODEL;
}

function buildDraftContext({ strategy, events, comparison, summaries, movement, dashboardContext }) {
  return {
    strategy_id_present: Boolean(strategy?.strategy_id),
    one_move_status: {
      accepted_status: strategy?.accepted_status || 'pending',
      outcome_status: strategy?.outcome_status || 'not_recorded'
    },
    current_one_move: strategy?.one_move ? {
      title: strategy.one_move.title || null,
      timeframe: strategy.one_move.timeframe || null,
      proof_target: strategy.one_move.proof_target || null,
      what_not_to_say: strategy.one_move.what_not_to_say || null
    } : null,
    five_future_names: asArray(strategy?.five_futures).map((future) => future?.name).filter(Boolean).slice(0, 5),
    outcome_ledger: {
      event_count: events.length,
      latest_event_type: events[0]?.event_type || null,
      latest_signal_type: events[0]?.signal_type || null,
      latest_evidence_weight: events[0]?.evidence_weight || 'none'
    },
    since_last_snapshot: {
      evidence_added: comparison?.changes_since_last_strategy?.evidence_added === true,
      future_movement_supported: comparison?.changes_since_last_strategy?.future_movement_supported === true,
      safe_summary: comparison?.safe_summary || null,
      next_best_prompt: comparison?.next_best_prompt || null
    },
    chat_session_summaries: asArray(summaries).map((summary) => ({
      session_intent: summary.session_intent,
      summary_text: summary.summary_text,
      recommended_follow_up: summary.recommended_follow_up
    })).slice(0, 5),
    future_movement: movement ? {
      assessment_id_present: Boolean(movement.assessment_id),
      overall_summary: movement.overall_summary,
      bands: asArray(movement.future_movements).map((item) => ({
        future_name: item.future_name,
        movement_band: item.movement_band,
        evidence_weight: item.evidence_weight,
        signal_type: item.signal_type
      }))
    } : null,
    boundaries: [
      'Do not replace the active strategy.',
      'Do not claim automatic learning is fully live.',
      'Do not use numeric probabilities.',
      'Do not claim validated future movement from early evidence.',
      'Future movement requires accepted decisions and recorded proof. External or displayed context alone does not justify automatic future percentage movement.'
    ],
    dashboard_intelligence_context: dashboardContext || null
  };
}

async function callDraftModel(context) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw statusError('darren_adaptive_strategy_model_not_configured', 500);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: configuredDraftModel(),
      messages: [
        {
          role: 'system',
          content: [
            'Create a concise Adaptive Strategy Draft for Darren.',
            'Use plain English. Use evidence bands, not percentages.',
            'The draft is pending review and must not replace the active strategy.',
            'Use dashboard_intelligence_context as low-to-medium weight context for current operating state, reality completeness, financial/admin status, business model focus, roadmap status, and confidence boundaries.',
            'Dashboard context is not authority to replace strategy, mutate records, or move future percentages.',
            'Do not claim automatic learning is fully live.',
            'Return only JSON with fields: what_changed_since_last_strategy, evidence_summary, future_movement_summary, updated_recommendation, suggested_one_move, proof_target_next, what_not_to_overclaim, what_to_watch_next, adoption_recommendation, reason, model_limits.'
          ].join(' ')
        },
        { role: 'user', content: JSON.stringify(context) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.25,
      max_tokens: 900
    })
  });

  if (!response.ok) throw statusError('darren_adaptive_strategy_model_request_failed', 502);
  const data = await response.json();
  const content = String(data?.choices?.[0]?.message?.content || '').trim();
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first === -1 || last <= first) throw statusError('darren_adaptive_strategy_model_response_invalid', 502);
  return JSON.parse(content.slice(first, last + 1));
}

export async function createDarrenAdaptiveStrategyDraft() {
  const strategy = await loadLatestDarrenGeneratedStrategy();
  if (!strategy?.strategy_id) throw statusError('generated_strategy_not_found', 404);
  const [events, summaries, movement, snapshot] = await Promise.all([
    loadDarrenOutcomeLedgerEvents({ strategy_id: strategy.strategy_id, limit: 10 }),
    loadDarrenChatSessionSummaries({ limit: 5 }),
    loadLatestDarrenFutureMovementAssessment(),
    buildDarrenIntelligenceSnapshot()
  ]);
  const comparison = buildComparison(strategy, events);
  const dashboardContext = buildDarrenDashboardContextCompact({ snapshot, strategy });
  const modelResult = await callDraftModel(buildDraftContext({ strategy, events, comparison, summaries, movement, dashboardContext }));
  const now = new Date();
  const draft = {
    draft_id: createId('asd', now),
    profile_id: DARREN_PROFILE_ID,
    context_type: DARREN_STRATEGY_CONTEXT_TYPE,
    source_strategy_id: strategy.strategy_id,
    created_at: now.toISOString(),
    draft_status: 'pending_review',
    what_changed_since_last_strategy: safeDraftText(modelResult.what_changed_since_last_strategy, comparison.safe_summary || 'Evidence was added, but the active strategy remains unchanged.', 900),
    evidence_summary: safeDraftText(modelResult.evidence_summary, 'Latest evidence is early and should be treated as a signal to review, not validated proof.', 900),
    future_movement_summary: safeDraftText(modelResult.future_movement_summary, movement?.overall_summary || 'Future movement remains evidence-gated and non-numeric.', 900),
    updated_recommendation: safeDraftText(modelResult.updated_recommendation, 'Review the early signal and decide whether Darren should create a more specific partner commitment next.', 900),
    suggested_one_move: safeDraftText(modelResult.suggested_one_move, 'Ask for one specific next commitment tied to a pilot, cohort, or measurable partner action.', 900),
    proof_target_next: safeDraftText(modelResult.proof_target_next, 'A named commitment with scope, owner, and next meeting.', 600),
    what_not_to_overclaim: safeDraftText(modelResult.what_not_to_overclaim, 'Do not claim validated adoption, funding, revenue, or automatic learning from early interest.', 600),
    what_to_watch_next: safeDraftText(modelResult.what_to_watch_next, 'Watch whether the partner converts interest into a concrete next action.', 600),
    adoption_recommendation: normalizeAdoptionRecommendation(modelResult.adoption_recommendation),
    reason: safeDraftText(modelResult.reason, 'The draft is useful for review, but evidence is still early.', 600),
    source_labels: {
      strategy: 'latest_generated_strategy_read_only',
      ledger: 'outcome_ledger_v0',
      chat_summary: 'chat_session_summary_v0',
      future_movement: 'future_movement_assessment_v0'
    },
    model_limits: safeDraftArray(modelResult.model_limits, [
      'This draft is pending review and does not replace the active strategy.',
      'No numeric probabilities are used.',
      'Early evidence is not validated proof.'
    ]),
    automatic_learning_boundary: 'This draft does not replace the active strategy until reviewed/adopted.',
    draft_version: ADAPTIVE_STRATEGY_DRAFT_VERSION
  };

  const redis = getRedis();
  try {
    await redis.set(adaptiveStrategyDraftKey(draft.draft_id), JSON.stringify(draft));
    await redis.set(adaptiveStrategyDraftLatestKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE), draft.draft_id);
    return sanitizeDraft(draft);
  } finally {
    redis.disconnect();
  }
}

export async function loadLatestDarrenAdaptiveStrategyDraft() {
  const redis = getRedis();
  try {
    const draftId = await redis.get(adaptiveStrategyDraftLatestKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE));
    if (!draftId) return null;
    const raw = await redis.get(adaptiveStrategyDraftKey(draftId));
    if (!raw) return null;
    return sanitizeDraft(JSON.parse(raw));
  } catch {
    return null;
  } finally {
    redis.disconnect();
  }
}
