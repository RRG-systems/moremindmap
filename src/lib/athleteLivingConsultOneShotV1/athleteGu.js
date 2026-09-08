import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import {
  SUBSCRIPTION_S2_GU_PLAN_VERSION,
  materializeSubscriptionS2GuPlan,
  validateSubscriptionS2GuPlan,
} from '../subscriptionS2/guContract.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const HASH = /^[a-f0-9]{64}$/u;

function source(id, label, classification) {
  return { id, label, classification };
}

function object({ id, kind, title, statement, qualifier = '', items = [], sourceIds = [] }) {
  return { id, kind, title, statement, qualifier, items, sourceIds };
}

function futuresStatement(futures) {
  if (typeof futures?.direction === 'string' && futures.direction.trim()) return futures.direction.trim();
  if (!Array.isArray(futures?.paths) || !futures.paths.length) return 'The longer direction is still open.';
  return futures.paths.slice(0, 3).map((path) => {
    const label = String(path?.label || '').trim();
    const meaning = String(path?.meaning || '').trim();
    return [label, meaning].filter(Boolean).join(': ');
  }).filter(Boolean).join(' · ') || 'The longer direction is still open.';
}

function mapObjects(publication) {
  const state = publication?.state || {};
  const current = state.athlete_current_reality || {};
  const futures = state.athlete_futures || {};
  const move = state.athlete_one_move || {};
  const plan = state.athlete_plan || {};
  const evidence = state.athlete_evidence || {};
  return [
    object({
      id: 's2-vision', kind: 'VISION', title: 'Where you are going',
      statement: futuresStatement(futures),
      sourceIds: ['s2-source-athlete-map'],
    }),
    object({
      id: 's2-perspective', kind: 'PERSPECTIVE', title: 'Where you are now',
      statement: String(current.focus || current.summary || 'The current sport picture is still being understood.'),
      qualifier: String(evidence.confidence || 'Use only what the athlete, instructor, and qualified records support.'),
      sourceIds: ['s2-source-athlete-map', 's2-source-athlete-evidence'],
    }),
    object({
      id: 's2-one-move', kind: 'ONE_MOVE', title: 'One useful move',
      statement: String(move.proposal || move.statement || plan.intervention || 'No shared next move has been agreed yet.'),
      sourceIds: ['s2-source-athlete-map'],
    }),
    object({
      id: 's2-relationship-preferences', kind: 'RELATIONSHIP', title: 'How we work together',
      statement: 'One conversation across every view. The athlete and instructor make shared decisions together.',
      items: [
        { label: 'Athlete voice', value: 'Always included', note: 'Correction and disagreement remain welcome.' },
        { label: 'Shared change', value: 'Two clear yeses', note: 'MORE can suggest but cannot agree for either person.' },
      ],
      sourceIds: ['s2-source-shared-authority'],
    }),
  ];
}

function continuityObjects(scorecard) {
  const interventions = scorecard?.interventions || [];
  const latest = interventions.at(-1);
  return [
    object({
      id: 's2-prior-agreements', kind: 'COMMITMENTS', title: 'What you agreed to',
      statement: latest?.decided || 'No earlier shared agreement is current.',
      items: latest ? [
        { label: 'Current status', value: latest.open_loop_state, note: latest.due_at || '' },
        ...(latest.original_reason ? [{ label: 'Why you chose it', value: latest.original_reason, note: '' }] : []),
      ] : [],
      sourceIds: ['s2-source-personal-rsl'],
    }),
    object({
      id: 's2-progress', kind: 'PROGRESS', title: 'What happened',
      statement: latest?.what_happened?.at(-1)?.summary || latest?.actually_tried?.at(-1)?.summary || 'Nothing new has been established yet.',
      sourceIds: ['s2-source-personal-rsl'],
    }),
    object({
      id: 's2-open-loops', kind: 'OPEN_LOOPS', title: 'What is still open',
      statement: latest?.open_loop_state || 'No current shared open loop.',
      items: interventions.filter((entry) => !['COMPLETED', 'SUPERSEDED', 'INTELLIGENTLY_ABANDONED'].includes(entry.open_loop_state))
        .slice(-3).map((entry) => ({
          label: entry.decided || 'Shared next step',
          value: entry.open_loop_state,
          note: entry.original_reason || entry.due_at || '',
        })),
      sourceIds: ['s2-source-personal-rsl'],
    }),
  ];
}

function learningObject(sessionLearning) {
  if (!sessionLearning) return null;
  return object({
    id: 's2-session-learning', kind: 'SESSION_LEARNING', title: 'What we are carrying forward',
    statement: sessionLearning.summary || sessionLearning.what_mattered || 'A short shared recap for next time.',
    items: [
      ['What mattered', sessionLearning.what_mattered],
      ['What changed', sessionLearning.what_changed],
      ['What you both said at close', sessionLearning.mutual_alignment],
      ['What was decided', sessionLearning.what_was_decided],
      ['What remains open', sessionLearning.what_remains_open],
      ['Next time', sessionLearning.pick_up_next_time],
    ].filter(([, value]) => value).map(([label, value]) => ({ label, value, note: '' })),
    sourceIds: ['s2-source-session-learning'],
  });
}

function deltaObject(delta) {
  if (!delta?.material_change) return null;
  const context = delta.proposal_context || {};
  const contextItems = [
    context.source ? { label: 'Approved by', value: context.source, note: '' } : null,
    context.reason ? { label: 'Why you chose it', value: context.reason, note: '' } : null,
    context.observation_window_end ? { label: 'When you will look again', value: context.observation_window_end, note: context.observation_window_start || '' } : null,
    context.falsifier ? { label: 'What would change your mind', value: context.falsifier, note: '' } : null,
    context.residual_disagreement ? { label: 'Still not settled', value: String(context.residual_disagreement), note: '' } : null,
    context.remaining_uncertainty ? { label: 'Still to learn', value: Array.isArray(context.remaining_uncertainty) ? context.remaining_uncertainty.join(' · ') : String(context.remaining_uncertainty), note: '' } : null,
  ].filter(Boolean);
  return object({
    id: 's2-map-delta', kind: 'MAP_DELTA', title: 'Your Athlete map changed',
    statement: context.summary || 'The shared change both people approved is now part of the living Athlete map.',
    items: [...(delta.deltas || []).map((entry) => ({
      label: String(entry.field || '').replace(/^athlete_/u, '').replaceAll('.', ' ').replaceAll('_', ' '),
      value: `${entry.before == null ? 'Not set' : String(entry.before)} → ${String(entry.after)}`,
      note: entry.before == null ? 'Added together' : 'Changed together',
    })), ...contextItems],
    sourceIds: ['s2-source-map-delta'],
  });
}

export function buildAthleteS2GuWorldV1({
  event,
  packet,
  publication,
  relationship_scope_hash,
  scorecard = null,
  session_learning = null,
  map_delta = null,
}) {
  if (!['FIRST_SESSION_WELCOME', 'SESSION_OPENING', 'COACHING_MOMENT', 'MAP_CHANGE', 'SESSION_CLOSING'].includes(event)) throw new TypeError('ATHLETE_S2_GU_EVENT_INVALID');
  if (!packet?.packet_hash || !packet?.session_id || !packet?.provider_understanding) throw new TypeError('ATHLETE_S2_GU_UNDERSTANDING_REQUIRED');
  if (!publication?.publication_hash || !Number.isInteger(publication?.publication_version)) throw new TypeError('ATHLETE_S2_GU_PUBLICATION_REQUIRED');
  if (!HASH.test(relationship_scope_hash || '')) throw new TypeError('ATHLETE_S2_GU_SCOPE_HASH_REQUIRED');
  const objects = [...mapObjects(publication), ...continuityObjects(scorecard)];
  const learning = learningObject(session_learning);
  const delta = deltaObject(map_delta);
  if (learning) objects.push(learning);
  if (delta) objects.push(delta);
  const trigger = {
    event,
    session_id: packet.session_id,
    publication_version: publication.publication_version,
    publication_hash: publication.publication_hash,
    understanding_hash: packet.packet_hash,
    session_learning_hash: session_learning ? hashCanonicalJson(session_learning) : null,
    map_delta_hash: map_delta ? hashCanonicalJson(map_delta) : null,
  };
  return deepFreeze({
    contract: 'SUBSCRIPTION_FLAGSHIP_S2_GU_WORLD_V1',
    domain: 'ATHLETE',
    event,
    stateBinding: {
      sessionId: packet.session_id,
      relationshipScopeHash: relationship_scope_hash,
      publicationVersion: publication.publication_version,
      publicationHash: publication.publication_hash,
      understandingHash: packet.packet_hash,
      triggerHash: hashCanonicalJson(trigger),
    },
    objects,
    evidence: [
      source('s2-source-athlete-map', 'Current derived Athlete map', 'GOVERNED_SYNTHETIC'),
      source('s2-source-athlete-evidence', 'Source-separated Athlete and instructor evidence', 'GOVERNED_SYNTHETIC'),
      source('s2-source-personal-rsl', 'Exact-scope relationship memory', 'PRIVATE_GOVERNED_SYNTHETIC'),
      source('s2-source-shared-authority', 'Athlete and instructor shared authority', 'GOVERNED_SYNTHETIC'),
      source('s2-source-session-learning', 'Mutually aligned session learning', 'SESSION_ONLY_NONCANONICAL'),
      source('s2-source-map-delta', 'Committed shared map delta', 'GOVERNED_SYNTHETIC'),
    ],
    truthBoundaries: {
      values: 'Use only the supplied governed objects. Never generate facts or numbers.',
      authority: 'A visual cannot authorize or perform a change.',
      mapChange: 'Only a supplied committed two-human delta may say the Athlete map changed.',
      sourceSeparation: 'Athlete report, instructor observation, qualified record, inference, contradiction, and missingness remain distinct.',
    },
  });
}

function fallbackSelection(event, world) {
  if (event === 'FIRST_SESSION_WELCOME') return { objectIds: ['s2-relationship-preferences'], type: 'RELATIONSHIP', title: 'Welcome to MORE', subtitle: 'One conversation. Two human voices. Shared decisions stay shared.' };
  if (event === 'SESSION_OPENING') {
    const prior = world.objects.find((item) => item.id === 's2-prior-agreements' && !/No earlier/u.test(item.statement));
    return prior
      ? { objectIds: ['s2-prior-agreements', 's2-open-loops'], type: 'COMMITMENTS', title: 'Here is where you left off', subtitle: prior.statement }
      : { objectIds: ['s2-perspective'], type: 'PLAIN_LANGUAGE', title: 'Here is where you are', subtitle: world.objects.find((item) => item.id === 's2-perspective').statement };
  }
  if (event === 'MAP_CHANGE') return { objectIds: ['s2-map-delta'], type: 'COMPARISON', title: 'Here is how your map changed', subtitle: 'This is the exact shared change both people approved.' };
  if (event === 'SESSION_CLOSING') return { objectIds: ['s2-session-learning'], type: 'PLAIN_LANGUAGE', title: 'Here is what you are carrying forward', subtitle: 'A short shared understanding for next time.' };
  return null;
}

export function createAthleteDeterministicTruthGuV1({ event, world }) {
  const selected = fallbackSelection(event, world);
  const mandatory = event !== 'COACHING_MOMENT';
  const candidate = {
    planVersion: SUBSCRIPTION_S2_GU_PLAN_VERSION,
    event,
    stateBinding: clone(world.stateBinding),
    renderDecision: { render: mandatory, reason: mandatory ? 'This product event requires a small truthful visual.' : 'Conversation is enough for this moment.' },
    guidance: {
      eyebrow: event === 'FIRST_SESSION_WELCOME' ? 'WELCOME TO MORE' : event === 'SESSION_CLOSING' ? 'UNTIL NEXT TIME' : event === 'MAP_CHANGE' ? 'YOUR LIVING MAP' : event === 'SESSION_OPENING' ? 'HERE IS WHERE YOU ARE' : 'A CLEARER VIEW',
      headline: selected?.title || 'Keep talking',
      summary: selected?.subtitle || 'No visual is needed.',
      nextCue: event === 'SESSION_CLOSING' ? 'The relationship will be ready when you return.' : 'What matters most now?',
    },
    blocks: selected ? [{
      blockId: `s2-block-athlete-${event.toLowerCase().replaceAll('_', '-')}`,
      type: selected.type,
      title: selected.title,
      subtitle: selected.subtitle,
      objectIds: selected.objectIds,
      evidenceIds: [],
      emphasis: 'PRIMARY',
      reason: 'Show only the smallest product-required truth.',
    }] : [],
    interactions: [],
  };
  const validation = validateSubscriptionS2GuPlan({ candidate, world });
  if (!validation.ok) return deepFreeze({ ok: false, code: 'ATHLETE_S2_GU_TRUTH_FALLBACK_INVALID', errors: validation.errors });
  const receipt = {
    runtime: 'athlete-living-consult-s2-truth-fallback-v1',
    provider_called: false,
    structural_proof_only: true,
    model_behavior_claimed: false,
    mutation_authority: false,
    world_hash: hashCanonicalJson(world),
    state_binding_hash: hashCanonicalJson(world.stateBinding),
  };
  return deepFreeze({ ok: true, plan: materializeSubscriptionS2GuPlan({ candidate, world, receipt }), receipt, world });
}

export async function generateAthleteS2GuV1({ generate, ...input }) {
  const world = buildAthleteS2GuWorldV1(input);
  if (typeof generate === 'function') {
    try {
      const generated = await generate({ ...input, world });
      if (generated?.plan) {
        const validation = validateSubscriptionS2GuPlan({ candidate: generated.plan, world });
        if (validation.ok) return deepFreeze({ ...generated, ok: true, world });
      }
    } catch {
      // GU has no mutation authority. A compiler/provider failure falls back to
      // the deterministic truth-bound renderer, never to invented content.
    }
    if (input.event === 'COACHING_MOMENT') return createAthleteDeterministicTruthGuV1({ event: input.event, world });
  }
  return createAthleteDeterministicTruthGuV1({ event: input.event, world });
}
