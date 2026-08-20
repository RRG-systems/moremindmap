import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';

const privatePattern = /\b(?:customer|client|profile|email|phone|address|revenue|profit|name)\b\s*[:=]/iu;
const injectionPattern = /(?:ignore (?:all|previous)|system prompt|developer message|reveal secrets|exfiltrat)/iu;

export function createExternalEvidenceBroker({ searchAdapter, now = () => new Date().toISOString() }) {
  if (typeof searchAdapter !== 'function') throw new TypeError('SEARCH_ADAPTER_REQUIRED');
  return deepFreeze({
    async research(need) {
      if (!need?.needed) return deepFreeze({ ok: true, code: 'EXTERNAL_RESEARCH_NOT_NEEDED', evidence: [] });
      if (need.private_data_required || privatePattern.test(need.query || '')) return deepFreeze({ ok: false, code: 'EXTERNAL_PRIVATE_QUERY_DENIED', evidence: [] });
      if (need.materiality === 'LOW') return deepFreeze({ ok: false, code: 'EXTERNAL_RESEARCH_NOT_MATERIAL', evidence: [] });
      if (need.desired_source_type !== 'PRIMARY_OFFICIAL' && need.desired_source_type !== 'PRIMARY_RESEARCH') return deepFreeze({ ok: false, code: 'EXTERNAL_SOURCE_CLASS_DENIED', evidence: [] });
      const minimizedQuery = String(need.query || '').replace(/\s+/gu, ' ').trim().slice(0, 240);
      const results = await searchAdapter({ query: minimizedQuery, source_type: need.desired_source_type, limit: 3 });
      const evidence = [];
      for (const item of results || []) {
        if (!item?.url?.startsWith('https://') || !item.title || !item.citation || injectionPattern.test(`${item.title} ${item.citation}`)) continue;
        const body = { contract_id: 'external_evidence_object', schema_version: '1.0.0', external_evidence_id: `external_${hashCanonicalJson({ url: item.url, citation: item.citation }).slice(0, 24)}`, purpose: need.purpose, status: 'TEMPORARY_CONTEXT', source_url: item.url, source_title: item.title, source_trust: need.desired_source_type, published_at: item.published_at || null, retrieved_at: now(), freshness_policy: item.freshness_policy || 'CHECK_AT_RETRIEVAL', expires_at: item.expires_at || null, citation: item.citation, contradicts_evidence_ids: item.contradicts_evidence_ids || [], privacy_classification: 'PUBLIC', customer_truth_override_allowed: false };
        evidence.push(deepFreeze({ ...body, content_hash: hashCanonicalJson(body) }));
      }
      if (!evidence.length) return deepFreeze({ ok: false, code: 'EXTERNAL_PRIMARY_EVIDENCE_UNAVAILABLE', evidence: [] });
      return deepFreeze({ ok: true, code: 'EXTERNAL_EVIDENCE_RETRIEVED', minimized_query_hash: hashCanonicalJson(minimizedQuery), evidence });
    },
  });
}

