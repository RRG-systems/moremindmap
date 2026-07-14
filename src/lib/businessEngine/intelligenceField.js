/**
 * Temporal / provenance wrappers for Business Engine Contract nodes.
 */

import {
  SNAPSHOT_REASON_FOR_CHANGE,
  SNAPSHOT_TREND,
  SOURCE_TYPES,
  INTELLIGENCE_STATUS,
} from './contractVersion.js';

export function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.filter((item) => hasMeaningfulValue(item)).length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

export function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined && item !== '');
  return [value];
}

export function clipText(value, max = 240) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

export function textFrom(value) {
  if (!hasMeaningfulValue(value)) return null;
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((item) => textFrom(item)).filter(Boolean);
    return parts.length ? parts.join('; ') : null;
  }
  if (typeof value === 'object') {
    return (
      textFrom(
        value.diagnostic_summary ||
          value.summary ||
          value.explanation ||
          value.label ||
          value.title ||
          value.recommendation ||
          value.signal ||
          value.body ||
          value.value
      ) || null
    );
  }
  return String(value);
}

/**
 * Build a versioned intelligence node with temporal + provenance metadata.
 */
export function makeIntelligenceNode({
  current = null,
  previous = null,
  trend = null,
  reason_for_change = null,
  evidence_sources = [],
  last_updated = null,
  confidence = null,
  provenance = null,
  source_type = SOURCE_TYPES.HONEST_ABSENCE,
  fallback_used = false,
  fallback_reason = null,
  intelligence_status = INTELLIGENCE_STATUS.ABSENT,
  extra = {},
} = {}) {
  const resolvedTrend =
    trend !== null && trend !== undefined
      ? trend
      : previous === null
        ? SNAPSHOT_TREND
        : null;
  const resolvedReason =
    reason_for_change !== null && reason_for_change !== undefined
      ? reason_for_change
      : previous === null
        ? SNAPSHOT_REASON_FOR_CHANGE
        : null;

  return {
    current,
    previous,
    trend: resolvedTrend,
    reason_for_change: resolvedReason,
    evidence_sources: asArray(evidence_sources),
    last_updated: last_updated || null,
    confidence: confidence ?? null,
    provenance: provenance || null,
    source_type,
    fallback_used: Boolean(fallback_used),
    fallback_reason: fallback_used ? fallback_reason || 'fallback_applied' : null,
    intelligence_status,
    ...extra,
  };
}

export function makeProvenance({
  source_artifact = null,
  source_path = null,
  source_rank = null,
  notes = null,
} = {}) {
  return {
    source_artifact,
    source_path,
    source_rank,
    notes: notes || null,
  };
}

/**
 * Select the first meaningful candidate in priority order.
 * Candidates: { value, source_type, provenance, confidence, fallback_used, fallback_reason, evidence_sources, intelligence_status, map }
 */
export function selectByPriority(candidates = [], { last_updated = null, mapCurrent } = {}) {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!candidate) continue;
    const value = typeof candidate.value === 'function' ? candidate.value() : candidate.value;
    if (!hasMeaningfulValue(value)) continue;

    const fallback_used = Boolean(
      candidate.fallback_used ||
        candidate.source_type === SOURCE_TYPES.LEGACY_FALLBACK ||
        candidate.source_type === SOURCE_TYPES.DETERMINISTIC_NORMALIZED
    );

    const mapper = typeof candidate.mapCurrent === 'function'
      ? candidate.mapCurrent
      : typeof mapCurrent === 'function'
        ? mapCurrent
        : null;
    const current = mapper ? mapper(value, candidate) : value;

    return makeIntelligenceNode({
      current,
      previous: null,
      trend: SNAPSHOT_TREND,
      reason_for_change: SNAPSHOT_REASON_FOR_CHANGE,
      evidence_sources: candidate.evidence_sources || [
        {
          artifact: candidate.provenance?.source_artifact || null,
          path: candidate.provenance?.source_path || null,
        },
      ],
      last_updated,
      confidence: candidate.confidence ?? null,
      provenance: {
        ...(candidate.provenance || {}),
        source_rank: index + 1,
      },
      source_type: candidate.source_type || SOURCE_TYPES.DOMAIN_INTELLIGENCE,
      fallback_used,
      fallback_reason: fallback_used
        ? candidate.fallback_reason || 'weaker_or_deterministic_source_selected'
        : null,
      intelligence_status:
        candidate.intelligence_status ||
        (fallback_used ? INTELLIGENCE_STATUS.FALLBACK : INTELLIGENCE_STATUS.AVAILABLE),
      extra: candidate.extra || {},
    });
  }

  return makeIntelligenceNode({
    current: null,
    last_updated,
    source_type: SOURCE_TYPES.HONEST_ABSENCE,
    fallback_used: false,
    fallback_reason: null,
    intelligence_status: INTELLIGENCE_STATUS.ABSENT,
    provenance: makeProvenance({
      source_artifact: null,
      source_path: null,
      source_rank: null,
      notes: 'No authorized intelligence source produced a value',
    }),
    evidence_sources: [],
  });
}

export function firstSectionBody(briefing, keys = []) {
  const sections = Array.isArray(briefing?.sections) ? briefing.sections : [];
  for (const key of keys) {
    const section = sections.find((item) => item?.key === key);
    if (hasMeaningfulValue(section?.body)) return section.body;
  }
  return null;
}

export function findFuture(futures, key) {
  const list = Array.isArray(futures) ? futures : [];
  return list.find((future) => future?.key === key) || null;
}
