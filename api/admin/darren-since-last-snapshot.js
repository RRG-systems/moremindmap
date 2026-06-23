import {
  DARREN_STRATEGY_CONTEXT_TYPE,
  loadDarrenOutcomeLedgerEvents,
  loadLatestDarrenGeneratedStrategy
} from './darren-generated-strategy-core.js';
import { DARREN_PROFILE_ID } from './darren-intelligence-snapshot-core.js';

const DEFAULT_ADMIN_CODE = 'MOREADMIN26';
const WEAK_EVIDENCE = new Set(['none', 'weak', 'early']);
const RECORDED_EVIDENCE = new Set(['weak', 'early', 'moderate', 'strong', 'validated', 'invalidated']);
const MODERATE_EVIDENCE = new Set(['moderate']);
const STRONG_EVIDENCE = new Set(['strong', 'validated']);

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Code');
}

function configuredAdminCode() {
  return process.env.MOREMINDMAP_ADMIN_DASHBOARD_CODE || DEFAULT_ADMIN_CODE;
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

function latestStatusAction(strategy) {
  const latest = asArray(strategy?.status_history).slice(-1)[0];
  return latest?.action || null;
}

function summarizeLatestEvent(events) {
  const latest = asArray(events)[0] || null;
  return {
    outcome_event_count: events.length,
    latest_event_type: latest?.event_type || null,
    latest_signal_type: latest?.signal_type || null,
    latest_signal_strength: latest?.signal_strength || null,
    latest_evidence_weight: latest?.evidence_weight || null,
    latest_event_at: latest?.created_at || null
  };
}

function movementForEvidence(evidenceWeight, latestEventType) {
  if (!latestEventType) {
    return {
      future_movement_supported: false,
      movement_allowed: false,
      movement_summary: 'No Outcome Ledger evidence has been recorded yet.',
      reason: 'There is no ledger event to support future movement.'
    };
  }

  if (WEAK_EVIDENCE.has(evidenceWeight)) {
    return {
      future_movement_supported: false,
      movement_allowed: false,
      movement_summary: 'Future movement remains unchanged.',
      reason: latestEventType === 'one_move_planned' && evidenceWeight === 'none'
        ? 'The loop is active, but no proof signal has been created yet.'
        : 'The latest evidence is none, weak, or early, so it is not strong enough to move a future path.'
    };
  }

  if (MODERATE_EVIDENCE.has(evidenceWeight)) {
    return {
      future_movement_supported: false,
      movement_allowed: false,
      movement_summary: 'Future movement is possible but not validated.',
      reason: 'Moderate evidence can be noted, but v0 does not move futures without stronger proof and repeatable signal.'
    };
  }

  if (STRONG_EVIDENCE.has(evidenceWeight)) {
    return {
      future_movement_supported: true,
      movement_allowed: true,
      movement_summary: 'Future movement may be supported by the latest evidence, without numeric prediction.',
      reason: 'Strong or validated evidence can support a non-numeric movement note, but future scoring is not implemented in v0.'
    };
  }

  return {
    future_movement_supported: false,
    movement_allowed: false,
    movement_summary: 'Future movement remains unchanged.',
    reason: 'Evidence weight is unavailable or not recognized.'
  };
}

function buildSafeSummary({ strategy, ledgerSummary, movement }) {
  if (!strategy) {
    return 'No saved generated strategy exists yet, so there is nothing to compare.';
  }
  if (ledgerSummary.latest_event_type === 'one_move_planned' && ledgerSummary.latest_evidence_weight === 'none') {
    return "Since the last strategy, Darren's One Move moved to planned and one Outcome Ledger event was created. No proof signal has been created yet, so future movement remains unchanged. The next step is to turn the planned move into a real partner, channel, revenue, or proof-target signal.";
  }
  if (ledgerSummary.outcome_event_count > 0 && !movement.future_movement_supported) {
    return 'Since the last strategy, evidence activity was recorded, but the current signal is not strong enough to honestly move a future path yet.';
  }
  if (movement.future_movement_supported) {
    return 'Since the last strategy, stronger evidence was recorded. V0 can flag that future movement may be supported, but it does not create numeric predictions or automatic learning.';
  }
  return 'Since the last strategy, no material proof signal has been recorded yet. The system can show status movement, but future paths remain unchanged.';
}

export function buildComparison(strategy, events) {
  const ledgerSummary = summarizeLatestEvent(events);
  const evidenceWeight = ledgerSummary.latest_evidence_weight || 'none';
  const movement = movementForEvidence(evidenceWeight, ledgerSummary.latest_event_type);
  const statusHistory = asArray(strategy?.status_history);
  const oneMoveStatusChanged = statusHistory.length > 0;
  const outcomeEventAdded = ledgerSummary.outcome_event_count > 0;
  const evidenceAdded = RECORDED_EVIDENCE.has(evidenceWeight);
  const strongEvidenceAdded = STRONG_EVIDENCE.has(evidenceWeight);
  const validatedEvidenceAdded = evidenceWeight === 'validated';

  return {
    ok: true,
    profile_id: DARREN_PROFILE_ID,
    context_type: DARREN_STRATEGY_CONTEXT_TYPE,
    comparison_generated_at: new Date().toISOString(),
    current_strategy_present: Boolean(strategy),
    current_strategy_id: strategy?.strategy_id || null,
    strategy_created_at: strategy?.created_at || null,
    strategy_updated_at: strategy?.updated_at || null,
    one_move_status: {
      accepted_status: strategy?.accepted_status || null,
      outcome_status: strategy?.outcome_status || null,
      status_history_count: statusHistory.length,
      latest_status_action: latestStatusAction(strategy)
    },
    outcome_ledger_summary: ledgerSummary,
    changes_since_last_strategy: {
      one_move_status_changed: oneMoveStatusChanged,
      outcome_event_added: outcomeEventAdded,
      evidence_added: evidenceAdded,
      strong_evidence_added: strongEvidenceAdded,
      validated_evidence_added: validatedEvidenceAdded,
      future_movement_supported: movement.future_movement_supported
    },
    future_path_movement_v0: {
      movement_allowed: movement.movement_allowed,
      movement_summary: movement.movement_summary,
      reason: movement.reason,
      evidence_required_for_movement: [
        'moderate, strong, or validated evidence tied to a named path',
        'repeatable partner/channel/revenue/proof-target signal',
        'later snapshot comparison showing what changed over time',
        'clear separation between interest, access, adoption, funding, and revenue'
      ]
    },
    still_missing: [
      'verified revenue or paid conversion signal',
      'partner capital commitment or funded pilot signal',
      'channel adoption beyond audience access',
      'RRG opportunity or recovery signal',
      'repeatable profile or assessment volume tied to a path',
      'later snapshot comparison for actual movement'
    ],
    safe_summary: buildSafeSummary({ strategy, ledgerSummary, movement }),
    not_yet_claims: [
      'Do not claim automatic learning is live.',
      'Do not claim a future path moved without moderate, strong, or validated evidence.',
      'Do not claim prediction accuracy.',
      'Do not treat a planned One Move as proof.',
      'Do not treat channel access as adoption.',
      'Do not treat partner interest as funding.',
      'Do not treat audience reach as revenue.'
    ],
    next_best_prompt: movement.future_movement_supported
      ? 'What repeatable proof would confirm this signal is more than a one-time event?'
      : 'What action this week can turn the planned One Move into a real partner, channel, revenue, or proof-target signal?'
  };
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'admin_since_last_snapshot_access_denied' });
  }

  try {
    const strategy = await loadLatestDarrenGeneratedStrategy();
    const events = strategy?.strategy_id
      ? await loadDarrenOutcomeLedgerEvents({ strategy_id: strategy.strategy_id, limit: 10 })
      : [];
    return res.status(200).json(buildComparison(strategy, events));
  } catch {
    return res.status(500).json({
      ok: false,
      error: 'darren_since_last_snapshot_unavailable'
    });
  }
}
