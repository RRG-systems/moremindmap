import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import { contractHeader, sameScope, validateSubscriptionV1Contract } from './contracts.js';
import { DEFAULT_RETRIEVAL_POLICY } from './constants.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const OPEN_EVENT_TYPES = new Set(['CONTRADICTION_OPENED', 'MISSINGNESS_OPENED', 'QUESTION', 'COMMITMENT', 'ATTEMPT', 'FRICTION']);
const HIGH_SIGNAL_EVENT_TYPES = new Set(['OUTCOME', 'FALSIFICATION', 'VALIDATION', 'DECISION', 'PLAN_CHANGE', 'INTERVENTION']);

function estimateTokens(value) {
  return Math.ceil(new TextEncoder().encode(JSON.stringify(value)).length / 4);
}

function relevanceScore(event, { purpose, active_lens, topics, as_of_at }) {
  let score = 0;
  if (event.semantic_payload?.lens === active_lens) score += 60;
  if (event.semantic_payload?.purpose === purpose) score += 40;
  if (OPEN_EVENT_TYPES.has(event.event_type)) score += 35;
  if (HIGH_SIGNAL_EVENT_TYPES.has(event.event_type)) score += 25;
  const text = JSON.stringify(event.semantic_payload || {}).toLowerCase();
  for (const topic of topics) if (text.includes(String(topic).toLowerCase())) score += 15;
  const ageDays = Math.max(0, (Date.parse(as_of_at) - Date.parse(event.effective_at)) / 86_400_000);
  score += Math.max(0, 20 - Math.floor(ageDays / 30));
  return score;
}

export function retrieveRelevantPersonalHistory({
  store,
  scope,
  purpose,
  active_lens,
  topics = [],
  as_of_at,
  policy = DEFAULT_RETRIEVAL_POLICY,
}) {
  if (!policy?.scope_filter_must_run_first || !policy?.privacy_filter_must_run_before_ranking || !policy?.authority_filter_must_run_before_ranking) {
    return deepFreeze({ ok: false, code: 'RETRIEVAL_POLICY_SCOPE_FIRST_REQUIRED' });
  }
  const replay = store.replay({ scope, effective_as_of: as_of_at, recorded_as_of: as_of_at });
  if (!replay.ok) return replay;
  const scoped = replay.state.active_events.filter((event) => sameScope(event.scope, scope));
  if (scoped.length !== replay.state.active_events.length) return deepFreeze({ ok: false, code: 'RETRIEVAL_SCOPE_FILTER_INTEGRITY_FAILED' });
  const privacyEligible = scoped.filter((event) => event.semantic_payload?.privacy_classification !== 'COACH_SESSION_PRIVATE');
  const authorityEligible = privacyEligible.filter((event) => event.establishing_authority?.authority_hash && event.content_hash);
  const ranked = authorityEligible.map((event) => ({
    event,
    score: relevanceScore(event, { purpose, active_lens, topics, as_of_at }),
    token_estimate: estimateTokens(event.semantic_payload),
  })).sort((left, right) => right.score - left.score
    || right.event.effective_at.localeCompare(left.event.effective_at)
    || left.event.event_id.localeCompare(right.event.event_id));
  const selected = [];
  let tokenEstimate = 0;
  for (const candidate of ranked) {
    if (selected.length >= policy.max_events) break;
    if (tokenEstimate + candidate.token_estimate > policy.max_estimated_tokens) continue;
    selected.push(candidate);
    tokenEstimate += candidate.token_estimate;
  }
  const resultBody = {
    ...contractHeader('relevant_history_retrieval_result'),
    retrieval_id: `retrieval_${hashCanonicalJson({ scope, purpose, active_lens, topics: [...topics].sort(), as_of_at, replay: replay.replay_hash, policy: policy.policy_version }).slice(0, 24)}`,
    scope: clone(scope),
    purpose,
    policy_version: policy.policy_version,
    ranking_method: policy.ranking_method,
    scope_filter_applied_first: true,
    privacy_filter_applied_before_ranking: true,
    authority_filter_applied_before_ranking: true,
    future_ranking_methods_after_scope_filter: clone(policy.future_ranking_methods_after_scope_filter || []),
    candidate_count: scoped.length,
    selected_event_ids: selected.map(({ event }) => event.event_id),
    omitted_counts: {
      privacy: scoped.length - privacyEligible.length,
      authority: privacyEligible.length - authorityEligible.length,
      budget: authorityEligible.length - selected.length,
    },
    token_estimate: tokenEstimate,
    retrieved_at: new Date(as_of_at).toISOString(),
  };
  const result = deepFreeze({ ...resultBody, result_hash: hashCanonicalJson(resultBody) });
  const validation = validateSubscriptionV1Contract(result);
  if (!validation.valid) return deepFreeze({ ok: false, code: 'RETRIEVAL_RESULT_CONTRACT_INVALID', errors: validation.errors });
  return deepFreeze({
    ok: true,
    code: 'PERSONAL_HISTORY_RETRIEVED',
    result,
    selected_events: selected.map(({ event }) => clone(event)),
    universal_patterns: [],
    governed_external_evidence: [],
    universal_runtime_read_enabled: false,
    governed_external_runtime_read_enabled: false,
  });
}
