import crypto from 'crypto';
import Redis from 'ioredis';
import { DARREN_STRATEGY_CONTEXT_TYPE } from './darren-generated-strategy-core.js';
import { DARREN_PROFILE_ID } from './darren-intelligence-snapshot-core.js';

export const STRATEGY_REVIEW_VERSION = 'strategy_review_v0';
export const STRATEGY_REVIEW_STATUSES = new Set([
  'accepted',
  'rejected',
  'revised',
  'needs_discussion',
  'deferred'
]);

const MAX_TEXT_LENGTH = 1200;
const MAX_METADATA_ITEMS = 8;

function strategyReviewKey(reviewId) {
  return `strategy_review:${reviewId}`;
}

function strategyReviewIndexKey(profileId, contextType) {
  return `strategy_review_index:${profileId}:${contextType}`;
}

function strategyReviewSubjectIndexKey(subjectId) {
  return `strategy_review_index:subject:${subjectId}`;
}

function createReviewId(now = new Date()) {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `strrev-${datePart}-${crypto.randomBytes(5).toString('hex')}`;
}

function statusError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function getRedis() {
  if (!process.env.REDIS_URL) throw statusError('strategy_review_persistence_not_configured', 500);
  return new Redis(process.env.REDIS_URL);
}

function boundedText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.length > maxLength) throw statusError('strategy_review_text_too_long', 400);
  if (/canonical[\s_-]+dossier|canonical[\s_-]+profile[\s_-]+json|canonical[\s_-]+profile[\s_-]+text|assessment[\s_-]+answers|raw[\s_-]+answers/i.test(text)) {
    throw statusError('strategy_review_private_source_reference_rejected', 400);
  }
  if (/redis[\s_-]*url|openai[\s_-]*api[\s_-]*key|moremindmap[\s_-]*admin[\s_-]*dashboard[\s_-]*code/i.test(text)) {
    throw statusError('strategy_review_environment_reference_rejected', 400);
  }
  return text;
}

function compactObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const compact = {};
  for (const [key, rawValue] of Object.entries(value).slice(0, MAX_METADATA_ITEMS)) {
    const safeKey = String(key || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
    if (!safeKey) continue;
    if (rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue === 'boolean') compact[safeKey] = rawValue;
    else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) compact[safeKey] = rawValue;
    else compact[safeKey] = boundedText(rawValue, 300);
  }
  return compact;
}

export function sanitizeStrategyReview(review) {
  if (!review) return null;
  return {
    review_id: review.review_id || null,
    profile_id: review.profile_id || null,
    context_type: review.context_type || null,
    subject_id: review.subject_id || null,
    subject_type: review.subject_type || null,
    source_type: review.source_type || null,
    source_id: review.source_id || null,
    source_title: review.source_title || null,
    decision_status: review.decision_status || null,
    active_strategy_candidate: review.active_strategy_candidate === true,
    human_notes: review.human_notes || null,
    evidence_basis: review.evidence_basis || {},
    linked_one_move: review.linked_one_move || {},
    linked_future_context: review.linked_future_context || {},
    created_at: review.created_at || null,
    reviewed_at: review.reviewed_at || null,
    created_by: review.created_by || null,
    mutation_scope: review.mutation_scope || 'review_record_only',
    no_auto_future_movement: review.no_auto_future_movement !== false,
    review_version: review.review_version || STRATEGY_REVIEW_VERSION
  };
}

function buildStrategyReview(input = {}) {
  const decisionStatus = String(input.decision_status || '').trim();
  if (!STRATEGY_REVIEW_STATUSES.has(decisionStatus)) throw statusError('invalid_strategy_review_decision_status', 400);

  const subjectId = boundedText(input.subject_id, 160);
  if (!subjectId) throw statusError('strategy_review_subject_id_required', 400);

  const now = new Date();
  return {
    review_id: createReviewId(now),
    profile_id: DARREN_PROFILE_ID,
    context_type: DARREN_STRATEGY_CONTEXT_TYPE,
    subject_id: subjectId,
    subject_type: boundedText(input.subject_type || 'strategy_recommendation', 120),
    source_type: boundedText(input.source_type || 'dashboard_review', 120),
    source_id: boundedText(input.source_id || subjectId, 160),
    source_title: boundedText(input.source_title, 240),
    decision_status: decisionStatus,
    active_strategy_candidate: decisionStatus === 'accepted',
    human_notes: boundedText(input.human_notes, MAX_TEXT_LENGTH),
    evidence_basis: compactObject(input.evidence_basis),
    linked_one_move: compactObject(input.linked_one_move),
    linked_future_context: compactObject(input.linked_future_context),
    created_at: now.toISOString(),
    reviewed_at: now.toISOString(),
    created_by: boundedText(input.created_by || 'darren_admin_dashboard', 120),
    mutation_scope: 'review_record_only',
    no_auto_future_movement: true,
    review_version: STRATEGY_REVIEW_VERSION
  };
}

export async function createDarrenStrategyReview(input = {}) {
  const redis = getRedis();
  try {
    const review = buildStrategyReview(input);
    await redis.set(strategyReviewKey(review.review_id), JSON.stringify(review));
    await redis.sadd(strategyReviewIndexKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE), review.review_id);
    await redis.sadd(strategyReviewSubjectIndexKey(review.subject_id), review.review_id);
    return sanitizeStrategyReview(review);
  } finally {
    redis.disconnect();
  }
}

export async function loadLatestDarrenStrategyReviews({ limit = 10 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 10, 25));
  const redis = getRedis();
  try {
    const reviewIds = await redis.smembers(strategyReviewIndexKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE));
    if (!reviewIds.length) return [];
    const rawReviews = await Promise.all(reviewIds.map((reviewId) => redis.get(strategyReviewKey(reviewId))));
    return rawReviews
      .map((raw) => {
        if (!raw) return null;
        try {
          return sanitizeStrategyReview(JSON.parse(raw));
        } catch {
          return null;
        }
      })
      .filter((review) => review?.profile_id === DARREN_PROFILE_ID && review?.context_type === DARREN_STRATEGY_CONTEXT_TYPE)
      .sort((a, b) => String(b.reviewed_at || '').localeCompare(String(a.reviewed_at || '')))
      .slice(0, safeLimit);
  } finally {
    redis.disconnect();
  }
}
