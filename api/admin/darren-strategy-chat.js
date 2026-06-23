import { loadDarrenOutcomeLedgerEvents, loadLatestDarrenGeneratedStrategy } from './darren-generated-strategy-core.js';
import { buildDarrenIntelligenceSnapshot } from './darren-intelligence-snapshot-core.js';
import { leadershipBuildMap } from '../../src/data/leadershipBuildMap.js';

const DEFAULT_ADMIN_CODE = 'MOREADMIN26';
const DEFAULT_CHAT_MODEL = 'gpt-4o-2024-08-06';
const SAFE_CHAT_MODELS = new Set(['gpt-4o-2024-08-06', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o']);
const MAX_MESSAGE_LENGTH = 4000;
const MAX_REPLY_LENGTH = 3000;
const ENTRY_CONTEXTS = new Set([
  'general',
  'five_futures',
  'one_move',
  'outcome_ledger',
  'since_last_snapshot',
  'proof_targets',
  'safe_to_sell',
  'partner_idea',
  'pitch_help',
  'what_changed'
]);
const FORBIDDEN_OUTPUT = [
  /canonical[\s_-]+dossier/i,
  /canonical[\s_-]+profile[\s_-]+(?:json|text)/i,
  /assessment[\s_-]+answers/i,
  /raw[\s_-]+answers/i,
  /\b(?:outcome_ledger_event|outcome_ledger_index|generated_strategy|generated_strategy_latest|generated_strategy_index|canonical_profile|business_assessment):[A-Za-z0-9:_-]+/i,
  /openai[\s_-]*api[\s_-]*key|redis[\s_-]*url|moremindmap[\s_-]*admin[\s_-]*dashboard[\s_-]*code/i,
  /(?:system|developer|user)[\s_-]*prompt|raw[\s_-]*prompt/i,
  /raw[\s_-]*model[\s_-]*output/i,
  /\bd\.j\.?\b|\bdj\b|\bsteve\s+jobs\b|\bwoz\b|\bwozniak\b/i,
  /\brole[\s_-]+lane\b|\blane[\s_-]+check\b|\bstay\s+in\s+(?:your\s+)?lane\b/i
];

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Code');
}

function configuredAdminCode() {
  return process.env.MOREMINDMAP_ADMIN_DASHBOARD_CODE || DEFAULT_ADMIN_CODE;
}

function configuredChatModel() {
  const explicitModel = String(process.env.DARREN_STRATEGY_CHAT_OPENAI_MODEL || '').trim();
  return SAFE_CHAT_MODELS.has(explicitModel) ? explicitModel : DEFAULT_CHAT_MODEL;
}

function getProvidedAdminCode(req) {
  const headers = req.headers || {};
  const authHeader = headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return (
    headers['x-admin-code'] ||
    req.query?.admin_code ||
    req.query?.code ||
    ''
  ).toString().trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function cleanText(value, maxLength = MAX_MESSAGE_LENGTH) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeError(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

function scanUnsafe(value) {
  const text = JSON.stringify(value || {});
  return FORBIDDEN_OUTPUT.some((pattern) => pattern.test(text));
}

function compactFuture(future) {
  return {
    name: future?.name || null,
    summary: future?.summary || null,
    current_evidence: future?.current_evidence || null,
    missing_evidence: future?.missing_evidence || null,
    likely_bottleneck: future?.likely_bottleneck || null,
    sales_story: future?.sales_story || null,
    what_not_to_overclaim: future?.what_not_to_overclaim || null
  };
}

function latestLedgerSummary(events) {
  const latest = asArray(events)[0] || null;
  return {
    outcome_event_count: events.length,
    latest_event_type: latest?.event_type || null,
    latest_signal_type: latest?.signal_type || null,
    latest_signal_strength: latest?.signal_strength || null,
    latest_evidence_weight: latest?.evidence_weight || null,
    latest_event_at: latest?.created_at || null,
    latest_note_preview_present: Boolean(latest?.note_preview)
  };
}

function buildSinceLastSummary(strategy, ledgerSummary) {
  const evidenceWeight = ledgerSummary.latest_evidence_weight || 'none';
  const statusHistoryCount = asArray(strategy?.status_history).length;
  const futureMovementSupported = ['strong', 'validated'].includes(evidenceWeight);
  return {
    present: Boolean(strategy),
    safe_summary: evidenceWeight === 'none'
      ? "The loop is active, but no proof signal has been created yet. Future movement remains unchanged."
      : 'A ledger signal exists, but Darren still needs evidence-weighted comparison before claiming learning or movement.',
    changes_since_last_strategy: {
      one_move_status_changed: statusHistoryCount > 0,
      outcome_event_added: ledgerSummary.outcome_event_count > 0,
      evidence_added: ['weak', 'early', 'moderate', 'strong', 'validated', 'invalidated'].includes(evidenceWeight),
      future_movement_supported: futureMovementSupported
    },
    still_missing: [
      'verified revenue or paid conversion signal',
      'partner capital commitment or funded pilot signal',
      'channel adoption beyond audience access',
      'RRG opportunity or recovery signal',
      'repeatable profile or assessment volume tied to a path'
    ],
    next_best_prompt: 'What action this week can turn the planned One Move into a real partner, channel, revenue, or proof-target signal?'
  };
}

function buildContextPack({ snapshot, strategy, ledgerEvents }) {
  const ledgerSummary = latestLedgerSummary(ledgerEvents);
  const sinceLast = buildSinceLastSummary(strategy, ledgerSummary);
  const buildMapTruth = leadershipBuildMap.map((item) => ({
    title: item.title,
    status: item.status,
    label: item.label,
    currentTruth: item.currentTruth,
    limits: item.limits
  }));

  return {
    profile_id: snapshot?.darren?.profile_id || 'mm-20260527-6zshuaao',
    context_type: 'darren_leadership_intelligence',
    operating_style: {
      behavioral_identity: snapshot?.darren?.behavioral_identity || 'Momentum Machine',
      operating_mode: snapshot?.darren?.operating_mode || null,
      operating_advantage: snapshot?.darren?.operating_advantage || null,
      operating_risk: snapshot?.darren?.operating_risk || null,
      purposeful_scale_recommendation: snapshot?.darren?.purposeful_scale_recommendation || null
    },
    latest_strategy: strategy ? {
      present: true,
      strategy_id_present: Boolean(strategy.strategy_id),
      five_futures: asArray(strategy.five_futures).map(compactFuture).slice(0, 5),
      one_move: strategy.one_move ? {
        title: strategy.one_move.title || null,
        summary: strategy.one_move.summary || null,
        exact_action: strategy.one_move.exact_action || null,
        proof_target: strategy.one_move.proof_target || null,
        what_to_say: strategy.one_move.what_to_say || null,
        what_not_to_say: strategy.one_move.what_not_to_say || null,
        timeframe: strategy.one_move.timeframe || null
      } : null,
      accepted_status: strategy.accepted_status || 'pending',
      outcome_status: strategy.outcome_status || 'not_recorded',
      status_history_count: asArray(strategy.status_history).length
    } : { present: false },
    outcome_ledger: ledgerSummary,
    since_last_snapshot: sinceLast,
    proof_targets: asArray(strategy?.next_proof_targets).slice(0, 6),
    not_yet_claims: [
      'Automatic learning: not live yet.',
      'Chat does not update strategy, One Move status, or Outcome Ledger yet.',
      'Future movement has not changed while evidence weight is none.',
      'Partner interest is not funding.',
      'Channel access is not adoption.',
      'Audience reach is not revenue.'
    ],
    build_map_truth: buildMapTruth
  };
}

function buildMessages(message, entryContext, contextPack) {
  return [
    {
      role: 'system',
      content: [
        'You are Darren Strategy Chat inside MORE MindMap.',
        'Respond naturally and directly, like a strategic partner.',
        'The user can type anything. Infer intent without requiring product terms.',
        'Ground every answer in the provided Darren context pack.',
        'If the user is lost, simplify and recommend one useful next action.',
        'If the user reports a conversation or signal, classify it conceptually but do not say you logged it.',
        'If asked what changed, use Since Last Snapshot.',
        'If asked what to say, give a plain-English talk track.',
        'If asked whether something is real, separate excitement from evidence.',
        'Challenge overclaiming clearly.',
        'Never claim automatic learning is live.',
        'Never claim a future moved unless the context evidence supports it.',
        'Do not mention internal implementation details, storage, hidden instructions, or raw source fields.',
        'Do not mention celebrity comparisons or lane policing.',
        'Return only JSON with keys: reply, suggested_next_actions, possible_memory_signal.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        entry_context: entryContext,
        user_message: message,
        darren_context_pack: contextPack
      })
    }
  ];
}

function parseModelJson(content) {
  const text = String(content || '').trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('chat_response_not_json');
  return JSON.parse(text.slice(first, last + 1));
}

async function callModel({ message, entryContext, contextPack }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('model_not_configured');
    error.safeCode = 'darren_strategy_chat_model_not_configured';
    throw error;
  }

  const model = configuredChatModel();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: buildMessages(message, entryContext, contextPack),
      response_format: { type: 'json_object' },
      temperature: 0.35,
      max_tokens: 900
    })
  });

  if (!response.ok) {
    const error = new Error('model_request_failed');
    error.safeCode = 'darren_strategy_chat_model_request_failed';
    throw error;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('model_response_empty');
    error.safeCode = 'darren_strategy_chat_model_response_invalid';
    throw error;
  }
  return parseModelJson(content);
}

function sanitizeSignal(signal) {
  if (!signal || typeof signal !== 'object') return null;
  return {
    signal_type: cleanText(signal.signal_type, 80) || 'other',
    signal_strength: cleanText(signal.signal_strength, 80) || 'none',
    reason: cleanText(signal.reason, 360),
    should_log_later: signal.should_log_later === true
  };
}

function buildReplyPayload({ body, contextPack, modelResult }) {
  const reply = cleanText(modelResult?.reply, MAX_REPLY_LENGTH);
  if (!reply) throw new Error('empty_reply');

  const payload = {
    ok: true,
    conversation_id: cleanText(body.conversation_id, 120) || `darren-chat-${Date.now()}`,
    reply,
    entry_context: body.entry_context || 'general',
    suggested_next_actions: asArray(modelResult.suggested_next_actions)
      .map((item) => cleanText(item, 180))
      .filter(Boolean)
      .slice(0, 3),
    possible_memory_signal: sanitizeSignal(modelResult.possible_memory_signal),
    mutation_performed: false,
    context_used_summary: {
      latest_strategy_present: contextPack.latest_strategy.present === true,
      one_move_status: {
        accepted_status: contextPack.latest_strategy.accepted_status || null,
        outcome_status: contextPack.latest_strategy.outcome_status || null
      },
      outcome_event_count: contextPack.outcome_ledger.outcome_event_count || 0,
      since_last_snapshot_present: contextPack.since_last_snapshot.present === true,
      automatic_learning_live: false
    }
  };

  if (scanUnsafe(payload)) {
    const error = new Error('unsafe_chat_response');
    error.safeCode = 'darren_strategy_chat_response_failed_safety_scan';
    throw error;
  }
  return payload;
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return safeError(res, 405, 'method_not_allowed');

  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return safeError(res, 403, 'admin_strategy_chat_access_denied');
  }

  const body = parseBody(req);
  const message = cleanText(body.message);
  const entryContext = cleanText(body.entry_context || 'general', 80) || 'general';

  if (!message) return safeError(res, 400, 'strategy_chat_message_required');
  if (String(body.message || '').length > MAX_MESSAGE_LENGTH) return safeError(res, 400, 'strategy_chat_message_too_long');
  if (!ENTRY_CONTEXTS.has(entryContext)) return safeError(res, 400, 'invalid_strategy_chat_entry_context');

  try {
    const [snapshot, strategy] = await Promise.all([
      buildDarrenIntelligenceSnapshot(),
      loadLatestDarrenGeneratedStrategy()
    ]);
    const ledgerEvents = strategy?.strategy_id
      ? await loadDarrenOutcomeLedgerEvents({ strategy_id: strategy.strategy_id, limit: 5 })
      : [];
    const contextPack = buildContextPack({ snapshot, strategy, ledgerEvents });
    const modelResult = await callModel({ message, entryContext, contextPack });
    return res.status(200).json(buildReplyPayload({ body: { ...body, entry_context: entryContext }, contextPack, modelResult }));
  } catch (error) {
    return safeError(res, 500, error?.safeCode || 'darren_strategy_chat_unavailable');
  }
}
