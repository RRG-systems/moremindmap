import crypto from 'crypto';
import Redis from 'ioredis';
import { DARREN_STRATEGY_CONTEXT_TYPE } from './darren-generated-strategy-core.js';
import { DARREN_PROFILE_ID } from './darren-intelligence-snapshot-core.js';

export const USAGE_EVENT_VERSION = 'darren_usage_event_v0';
export const USAGE_EVENT_TYPES = new Set([
  'dashboard_opened',
  'panel_opened',
  'panel_collapsed',
  'strategy_chat_prompt_submitted',
  'strategy_chat_response_received',
  'strategy_review_opened',
  'strategy_recommendation_accepted',
  'strategy_recommendation_rejected',
  'strategy_recommendation_revised',
  'strategy_recommendation_deferred',
  'one_move_reviewed',
  'proof_target_reviewed',
  'evidence_added',
  'outcome_added',
  'future_movement_reviewed'
]);

const MAX_TEXT_LENGTH = 500;
const MAX_METADATA_ITEMS = 10;

function usageEventKey(eventId) {
  return `darren_usage_event:${eventId}`;
}

function usageEventIndexKey(profileId, contextType) {
  return `darren_usage_event_index:${profileId}:${contextType}`;
}

function createEventId(now = new Date()) {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `due-${datePart}-${crypto.randomBytes(5).toString('hex')}`;
}

function statusError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function getRedis() {
  if (!process.env.REDIS_URL) throw statusError('usage_event_persistence_not_configured', 500);
  return new Redis(process.env.REDIS_URL);
}

function boundedText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.length > maxLength) throw statusError('usage_event_text_too_long', 400);
  if (/canonical[\s_-]+dossier|canonical[\s_-]+profile[\s_-]+json|canonical[\s_-]+profile[\s_-]+text|assessment[\s_-]+answers|raw[\s_-]+answers/i.test(text)) {
    throw statusError('usage_event_private_source_reference_rejected', 400);
  }
  if (/redis[\s_-]*url|openai[\s_-]*api[\s_-]*key|moremindmap[\s_-]*admin[\s_-]*dashboard[\s_-]*code/i.test(text)) {
    throw statusError('usage_event_environment_reference_rejected', 400);
  }
  return text;
}

function compactMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const compact = {};
  for (const [key, rawValue] of Object.entries(value).slice(0, MAX_METADATA_ITEMS)) {
    const safeKey = String(key || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
    if (!safeKey) continue;
    if (rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue === 'boolean') compact[safeKey] = rawValue;
    else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) compact[safeKey] = rawValue;
    else compact[safeKey] = boundedText(rawValue, 240);
  }
  return compact;
}

function buildUsageEvent(input = {}) {
  const eventType = String(input.event_type || '').trim();
  if (!USAGE_EVENT_TYPES.has(eventType)) throw statusError('invalid_usage_event_type', 400);
  const now = new Date();
  return {
    event_id: createEventId(now),
    profile_id: DARREN_PROFILE_ID,
    context_type: DARREN_STRATEGY_CONTEXT_TYPE,
    subject_id: boundedText(input.subject_id || DARREN_PROFILE_ID, 160),
    event_type: eventType,
    event_source: boundedText(input.event_source || 'darren_dashboard', 120),
    panel_id: boundedText(input.panel_id, 160),
    action_id: boundedText(input.action_id, 160),
    related_strategy_review_id: boundedText(input.related_strategy_review_id, 160),
    related_one_move_id: boundedText(input.related_one_move_id, 160),
    related_proof_target_id: boundedText(input.related_proof_target_id, 160),
    related_chat_session_id: boundedText(input.related_chat_session_id, 160),
    metadata: compactMetadata(input.metadata),
    created_at: now.toISOString(),
    event_version: USAGE_EVENT_VERSION
  };
}

export function sanitizeUsageEvent(event) {
  if (!event) return null;
  return {
    event_id: event.event_id || null,
    profile_id: event.profile_id || null,
    context_type: event.context_type || null,
    subject_id: event.subject_id || null,
    event_type: event.event_type || null,
    event_source: event.event_source || null,
    panel_id: event.panel_id || null,
    action_id: event.action_id || null,
    related_strategy_review_id: event.related_strategy_review_id || null,
    related_one_move_id: event.related_one_move_id || null,
    related_proof_target_id: event.related_proof_target_id || null,
    related_chat_session_id: event.related_chat_session_id || null,
    metadata: event.metadata || {},
    created_at: event.created_at || null,
    event_version: event.event_version || USAGE_EVENT_VERSION
  };
}

export async function createDarrenUsageEvent(input = {}) {
  const redis = getRedis();
  try {
    const event = buildUsageEvent(input);
    await redis.set(usageEventKey(event.event_id), JSON.stringify(event));
    await redis.sadd(usageEventIndexKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE), event.event_id);
    return sanitizeUsageEvent(event);
  } finally {
    redis.disconnect();
  }
}
