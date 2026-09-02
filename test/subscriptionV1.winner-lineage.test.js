import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemoryLivingRelationshipStore,
  InMemoryPersonalRslStore,
  createConfirmedPersonalRslMutation,
  createGovernedChangeProposal,
  createHiddenCandidateFromExtraction,
  createPersonalRslEvent,
  createProposalDecision,
  createRelationshipEpisodeEvent,
  derivePrivateLongitudinalScorecard,
  scopeFingerprint,
} from '../src/lib/subscriptionV1/index.js';
import { createSyntheticLivingRelationshipLab } from '../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

const relationshipKey = 'rel_abcdefabcdefabcdefab';
const sessionId = (ordinal) => `session_${String(ordinal).padStart(24, '0')}`;

async function openEpisode({ store, ordinal, at }) {
  return createSyntheticLivingRelationshipLab({
    store,
    subject_key: 're-mid',
    relationship_key: relationshipKey,
    suppliedSessionId: sessionId(ordinal),
    session_kind: ordinal === 1 ? 'FIRST_EVER' : 'WEEKLY',
    seed_weekly_fixture: false,
    clock: () => at,
  });
}

async function stageCandidate({ lab, store, candidate, at, episode = true, supersedes_event_ids = [] }) {
  const packet = lab.controller.wholeUnderstandingPacket();
  const publication = store.readCurrent({ scope: lab.scope }).publication;
  const hidden = createHiddenCandidateFromExtraction({
    session_id: packet.base_state_packet.session_id,
    scope_hash: scopeFingerprint(lab.scope),
    state_packet_hash: packet.base_state_packet.packet_hash,
    candidate,
    created_at: at,
  });
  const governed = createGovernedChangeProposal({
    hidden_proposal: hidden,
    scope: lab.scope,
    source_state_packet: packet.base_state_packet,
    current_publication: publication,
    created_at: at,
    supersedes_event_ids,
  });
  assert.equal(governed.ok, true, governed.code);
  const episodes = [];
  if (episode) {
    for (const [event_type, role] of [['CUSTOMER_DISCUSSION', 'customer'], ['MORE_SUGGESTION', 'coach']]) {
      const created = createRelationshipEpisodeEvent({
        scope: lab.scope,
        session_id: packet.base_state_packet.session_id,
        event_type,
        summary: event_type === 'MORE_SUGGESTION' ? `MORE suggested: ${candidate.summary}` : `The customer discussed: ${candidate.summary}`,
        occurred_at: at,
        source_content_hash: hashCanonicalJson({ role, candidate: candidate.summary }),
        proposal_id: governed.proposal.proposal_id,
      });
      assert.equal(created.ok, true, created.code);
      episodes.push(created.event);
    }
  }
  const saved = await store.saveProposal({
    scope: lab.scope,
    proposal: governed.proposal,
    saved_at: at,
    relationship_episode_events: episodes,
  });
  assert.equal(saved.ok, true, saved.code);
  return governed.proposal;
}

async function authorizeCandidate(options) {
  const proposal = await stageCandidate(options);
  const previewDecision = createProposalDecision({
    proposal,
    decision: 'CONFIRM',
    actor: { actor_type: 'CUSTOMER', actor_ref: options.lab.scope.subject_id },
    decided_at: options.at,
    note: 'Synthetic longitudinal proof through the exact AFW-05 customer authorization path.',
  });
  const previewReplay = options.store.buildPersonalRslStore({ scope: options.lab.scope }).replay({ scope: options.lab.scope, effective_as_of: options.at, recorded_as_of: options.at });
  const previewMutation = createConfirmedPersonalRslMutation({
    proposal,
    decision: previewDecision.decision,
    active_personal_rsl_events: previewReplay.state.active_events,
    event_id: `rsl_preview_${proposal.proposal_id.slice(-12)}`,
    recorded_at: options.at,
  });
  assert.equal(previewMutation.ok, true, JSON.stringify({
    code: previewMutation.code,
    requested: proposal.proposed_items,
    available: previewReplay.state.active_events.map((event) => ({ type: event.event_type, lineage: event.semantic_payload?.lineage, scope: event.scope })),
    proposal_scope: proposal.scope,
  }));
  const committed = await options.lab.controller.decide({
    proposal_id: proposal.proposal_id,
    decision: 'CONFIRM',
    note: 'Synthetic longitudinal proof through the exact AFW-05 customer authorization path.',
    idempotency_key: `winner-lineage:${proposal.proposal_id}`,
  });
  assert.equal(committed.ok, true, committed.code);
  return committed;
}

const candidate = ({ proposal_type = 'EVIDENCE_CANDIDATE', candidate_type = 'OUTCOME_CANDIDATE', target_contract = 'EVIDENCE_LEDGER', summary, items }) => ({
  candidate_type,
  proposal_type,
  target_contract,
  operation: 'PROPOSE',
  summary,
  items,
  reason: 'Frozen synthetic longitudinal proof input.',
  evidence_ref_ids: [],
  authority_ref_ids: [],
  confirmation_required: true,
  generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
});

test('winner lineage keeps suggestion, discussion, agreement, attempt, outcome, and causal review epistemically distinct', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const first = await openEpisode({ store, ordinal: 1, at: '2026-09-01T09:00:00.000Z' });

  const unaccepted = candidate({
    proposal_type: 'COMMITMENT_CANDIDATE', candidate_type: 'COMMITMENT_CANDIDATE', target_contract: 'PLAN_135',
    summary: 'Call five past clients this week.',
    items: [{ field: 'commitment.intervention', value: 'Call five past clients this week.' }],
  });
  await stageCandidate({ lab: first, store, candidate: unaccepted, at: '2026-09-01T09:00:00.000Z' });
  assert.equal(first.controller.longitudinalScorecard({ as_of_at: '2026-09-01T09:00:00.000Z' }).scorecard.interventions.length, 0);

  const intervention = await authorizeCandidate({
    lab: first,
    store,
    at: '2026-09-01T09:05:00.000Z',
    candidate: candidate({
      proposal_type: 'COMMITMENT_CANDIDATE', candidate_type: 'COMMITMENT_CANDIDATE', target_contract: 'PLAN_135',
      summary: 'Protect two database follow-up blocks each week for four weeks.',
      items: [
        { field: 'commitment.intervention', value: 'Protect two database follow-up blocks each week for four weeks.' },
        { field: 'commitment.due_at', value: '2026-09-29T09:00:00.000Z' },
        { field: 'commitment.observation_window_start', value: '2026-09-01T09:00:00.000Z' },
        { field: 'commitment.observation_window_end', value: '2026-10-02T09:00:00.000Z' },
        { field: 'commitment.falsifiers', value: 'Follow-up blocks do not occur; protected time creates no qualified conversations.' },
      ],
    }),
  });
  assert.equal(intervention.event.event_type, 'INTERVENTION');
  const lineageId = intervention.event.semantic_payload.lineage.intervention_lineage_id;
  assert.match(lineageId, /^intervention_[a-f0-9]{24}$/u);

  const later = await openEpisode({ store, ordinal: 2, at: '2026-09-08T09:00:00.000Z' });
  const laterReplay = store.buildPersonalRslStore({ scope: later.scope }).replay({ scope: later.scope, effective_as_of: '2026-09-08T09:00:00.000Z', recorded_as_of: '2026-09-08T09:00:00.000Z' });
  assert.equal(laterReplay.state.active_events.some((event) => event.semantic_payload?.lineage?.intervention_lineage_id === lineageId), true);
  const attempt = await authorizeCandidate({
    lab: later,
    store,
    at: '2026-09-08T09:00:00.000Z',
    candidate: candidate({
      summary: 'Jordan completed three of eight planned follow-up blocks.',
      items: [
        { field: 'evidence.attempt', value: 'Jordan completed three of eight planned follow-up blocks.' },
        { field: 'evidence.execution_degree', value: 'PARTIAL' },
        { field: 'evidence.intervention_lineage_id', value: lineageId },
      ],
    }),
  });
  assert.equal(attempt.event.event_type, 'ATTEMPT');
  let scorecard = later.controller.longitudinalScorecard({ as_of_at: '2026-09-08T09:00:00.000Z' }).scorecard;
  assert.equal(scorecard.interventions[0].open_loop_state, 'ATTEMPTED');
  assert.equal(scorecard.interventions[0].what_happened.length, 0);

  const tenth = await openEpisode({ store, ordinal: 10, at: '2026-11-10T09:00:00.000Z' });
  const outcome = await authorizeCandidate({
    lab: tenth,
    store,
    at: '2026-11-10T09:00:00.000Z',
    candidate: candidate({
      summary: 'Jordan reported two signed clients after the follow-up period, with a rate drop and a referral campaign also in market.',
      items: [
        { field: 'evidence.execution_outcome', value: 'Two signed clients followed the test period.' },
        { field: 'evidence.outcome_classification', value: 'CONFOUNDED' },
        { field: 'evidence.intervention_lineage_id', value: lineageId },
        { field: 'evidence.confounders', value: 'Mortgage rates fell; a referral campaign ran during the same period.' },
        { field: 'evidence.requested_attribution', value: 'ASSOCIATED_ONLY' },
      ],
    }),
  });
  assert.equal(outcome.event.event_type, 'OUTCOME');
  assert.equal(outcome.derived_events.length, 1);
  assert.equal(outcome.derived_events[0].event_type, 'CONFIDENCE_CHANGE');
  assert.notEqual(outcome.derived_events[0].semantic_payload.outcome_validation.attribution_status, 'CAUSAL');

  scorecard = tenth.controller.longitudinalScorecard({ as_of_at: '2027-09-01T09:00:00.000Z' }).scorecard;
  assert.deepEqual(scorecard.month_12_answers.what_did_we_decide, ['Protect two database follow-up blocks each week for four weeks.']);
  assert.equal(scorecard.month_12_answers.what_did_you_actually_try[0].degree, 'PARTIAL');
  assert.equal(scorecard.month_12_answers.what_happened[0].classification, 'CONFOUNDED');
  assert.equal(scorecard.month_12_answers.what_remains_uncertain.length, 1);
  assert.equal(scorecard.raw_transcript_required, false);
  assert.equal(scorecard.second_truth_store, false);
  assert.equal(store.verifyRelationshipEpisodes({ scope: first.scope }).ok, true);
  const episodes = store.readRelationshipEpisodes({ scope: first.scope }).records.map((record) => record.event.event_type);
  assert.ok(episodes.includes('CUSTOMER_DISCUSSION'));
  assert.ok(episodes.includes('MORE_SUGGESTION'));
  assert.ok(episodes.includes('CUSTOMER_AGREEMENT'));
  assert.equal(store.readPersonalRsl({ scope: first.scope }).records.some((record) => record.event.event_type === 'MORE_SUGGESTION'), false);
  const future = tenth.controller.futureLearningCandidates({ as_of_at: '2027-09-01T09:00:00.000Z' });
  assert.equal(future.ok, true);
  assert.equal(future.candidates.length, 1);
  assert.equal(future.candidates[0].state, 'PERSONAL_ONLY');
  assert.equal(future.universal_runtime_read_enabled, false);
  assert.equal(future.universal_promotion_enabled, false);
  const serializedFuture = JSON.stringify(future);
  assert.doesNotMatch(serializedFuture, new RegExp(first.scope.profile_id, 'u'));
  assert.doesNotMatch(serializedFuture, new RegExp(first.scope.subject_id, 'u'));
});

test('winner lineage enforces execution/outcome linkage, open-loop aging, abandonment, supersession, and privacy isolation', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const first = await openEpisode({ store, ordinal: 1, at: '2026-09-01T09:00:00.000Z' });
  const neverAttempted = await authorizeCandidate({
    lab: first,
    store,
    at: '2026-09-01T09:00:00.000Z',
    candidate: candidate({
      proposal_type: 'COMMITMENT_CANDIDATE', candidate_type: 'COMMITMENT_CANDIDATE', target_contract: 'PLAN_135',
      summary: 'Test one expired-listing follow-up block.',
      items: [
        { field: 'commitment.intervention', value: 'Test one expired-listing follow-up block.' },
        { field: 'commitment.due_at', value: '2026-09-08T09:00:00.000Z' },
      ],
    }),
  });
  const neverId = neverAttempted.event.semantic_payload.lineage.intervention_lineage_id;
  assert.equal(neverAttempted.event.semantic_payload.lineage.due_at, '2026-09-08T09:00:00.000Z');
  let scorecard = first.controller.longitudinalScorecard({ as_of_at: '2026-09-08T12:00:00.000Z' }).scorecard;
  assert.equal(scorecard.interventions.find((item) => item.intervention_lineage_id === neverId).open_loop_state, 'DUE');
  scorecard = first.controller.longitudinalScorecard({ as_of_at: '2026-09-10T12:00:00.000Z' }).scorecard;
  assert.equal(scorecard.interventions.find((item) => item.intervention_lineage_id === neverId).open_loop_state, 'MISSED');

  const abandoned = await authorizeCandidate({
    lab: first,
    store,
    at: '2026-09-01T10:00:00.000Z',
    candidate: candidate({
      proposal_type: 'COMMITMENT_CANDIDATE', candidate_type: 'COMMITMENT_CANDIDATE', target_contract: 'PLAN_135',
      summary: 'Try a daily door-knocking block.',
      items: [{ field: 'commitment.intervention', value: 'Try a daily door-knocking block.' }],
    }),
  });
  const abandonedId = abandoned.event.semantic_payload.lineage.intervention_lineage_id;
  await authorizeCandidate({
    lab: first,
    store,
    at: '2026-09-01T10:05:00.000Z',
    candidate: candidate({
      summary: 'Jordan tried one door-knocking block and intelligently abandoned it after a safety constraint emerged.',
      items: [
        { field: 'evidence.attempt', value: 'Jordan tried one door-knocking block.' },
        { field: 'evidence.execution_degree', value: 'PARTIAL' },
        { field: 'evidence.intervention_lineage_id', value: abandonedId },
        { field: 'evidence.open_loop_state', value: 'INTELLIGENTLY_ABANDONED' },
      ],
    }),
  });
  scorecard = first.controller.longitudinalScorecard({ as_of_at: '2027-09-01T09:00:00.000Z' }).scorecard;
  assert.equal(scorecard.interventions.find((item) => item.intervention_lineage_id === abandonedId).open_loop_state, 'INTELLIGENTLY_ABANDONED');

  const correctionCandidate = candidate({
    proposal_type: 'CORRECTION_CANDIDATE', candidate_type: 'CORRECTION_CANDIDATE', target_contract: 'EVIDENCE_LEDGER',
    summary: 'Door knocking is no longer a current intervention.',
    items: [{ field: 'evidence.corrected_goal', value: 'Use referral and database follow-up instead of door knocking.' }],
  });
  await authorizeCandidate({
    lab: first,
    store,
    candidate: correctionCandidate,
    at: '2026-09-01T10:10:00.000Z',
    supersedes_event_ids: [abandoned.event.event_id],
  });
  scorecard = first.controller.longitudinalScorecard({ as_of_at: '2027-09-01T09:00:00.000Z' }).scorecard;
  assert.equal(scorecard.interventions.find((item) => item.intervention_lineage_id === abandonedId).open_loop_state, 'SUPERSEDED');
  assert.equal(scorecard.month_12_answers.what_changed.length, 1);

  const invalidOutcome = candidate({
    summary: 'An outcome was claimed without any linked execution observation.',
    items: [
      { field: 'evidence.execution_outcome', value: 'A result was reported.' },
      { field: 'evidence.outcome_classification', value: 'BENEFICIAL' },
      { field: 'evidence.intervention_lineage_id', value: neverId },
    ],
  });
  const invalidProposal = await stageCandidate({ lab: first, store, candidate: invalidOutcome, at: '2026-09-01T10:15:00.000Z' });
  const denied = await first.controller.decide({ proposal_id: invalidProposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'winner-lineage-outcome-without-attempt' });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'PERSONAL_RSL_OUTCOME_REQUIRES_LINKED_EXECUTION');

  const other = await createSyntheticLivingRelationshipLab({ subject_key: 're-early', relationship_key: relationshipKey, seed_weekly_fixture: false });
  const foreignEvent = createPersonalRslEvent({
    event_id: 'rsl_foreign_scope_proof',
    scope: other.scope,
    session_id: sessionId(99),
    event_type: 'CONTRADICTION_OPENED',
    effective_at: '2026-09-01T09:00:00.000Z',
    recorded_at: '2026-09-01T09:00:00.000Z',
    source_class: 'DETERMINISTIC_RUNTIME',
    actor: { actor_type: 'DETERMINISTIC_RUNTIME', actor_ref: 'winner_lineage_test' },
    establishing_authority: { authority_id: 'winner-lineage-test', authority_version: '1.0.0', authority_hash: hashCanonicalJson({ authority: 'winner-lineage-test' }) },
    semantic_payload: { summary: 'Foreign-scope contradiction.', privacy_classification: 'TENANT_PRIVATE' },
    evidence_refs: [],
    supersedes_event_ids: [],
    retracts_event_ids: [],
    confirmation_event_id: null,
  });
  assert.equal(foreignEvent.ok, true, foreignEvent.code);
  const mixed = derivePrivateLongitudinalScorecard({
    scope: first.scope,
    active_events: [
      ...store.buildPersonalRslStore({ scope: first.scope }).replay({ scope: first.scope }).state.active_events,
      foreignEvent.event,
    ],
    as_of_at: '2027-09-01T09:00:00.000Z',
  });
  assert.equal(mixed.ok, false);
  assert.equal(mixed.code, 'LONGITUDINAL_SCORECARD_SCOPE_DENIED');
});

test('contradictions remain active until an exact later event resolves them', () => {
  const scope = {
    subject_id: 'subject_synthetic_contradiction',
    membership_id: 'membership_synthetic_contradiction',
    tenant_id: 'tenant_synthetic_subscription_founder_demo',
    profile_id: 'SYNTHETIC-CONTRADICTION',
    business_id: 'business_synthetic_contradiction',
  };
  const rsl = new InMemoryPersonalRslStore();
  const makeEvent = ({ event_id, event_type, at, summary, supersedes_event_ids = [] }) => createPersonalRslEvent({
    event_id,
    scope,
    session_id: sessionId(event_type === 'CONTRADICTION_OPENED' ? 3 : 4),
    event_type,
    effective_at: at,
    recorded_at: at,
    source_class: 'DETERMINISTIC_RUNTIME',
    actor: { actor_type: 'DETERMINISTIC_RUNTIME', actor_ref: 'subscription_contradiction_runtime' },
    establishing_authority: { authority_id: 'subscription-contradiction-runtime', authority_version: '1.0.0', authority_hash: hashCanonicalJson({ authority: 'subscription-contradiction-runtime' }) },
    semantic_payload: { summary, privacy_classification: 'TENANT_PRIVATE' },
    evidence_refs: [],
    supersedes_event_ids,
    retracts_event_ids: [],
    confirmation_event_id: null,
  });
  const opened = makeEvent({ event_id: 'rsl_contradiction_opened', event_type: 'CONTRADICTION_OPENED', at: '2026-10-01T09:00:00.000Z', summary: 'Two governed sources disagree about whether follow-up is happening.' });
  assert.equal(opened.ok, true, opened.code);
  assert.equal(rsl.append({ scope, event: opened.event, appended_at: opened.event.recorded_at }).ok, true);
  let replay = rsl.replay({ scope, effective_as_of: '2026-10-15T09:00:00.000Z', recorded_as_of: '2026-10-15T09:00:00.000Z' });
  let scorecard = derivePrivateLongitudinalScorecard({ scope, active_events: replay.state.active_events, historical_events: rsl.read({ scope }).records.map((record) => record.event), as_of_at: '2026-10-15T09:00:00.000Z' });
  assert.equal(scorecard.scorecard.unresolved_contradictions.length, 1);
  const resolved = makeEvent({
    event_id: 'rsl_contradiction_resolved',
    event_type: 'CONTRADICTION_RESOLVED',
    at: '2026-11-01T09:00:00.000Z',
    summary: 'The customer clarified which dated source represented current reality.',
    supersedes_event_ids: [opened.event.event_id],
  });
  assert.equal(resolved.ok, true, resolved.code);
  assert.equal(rsl.append({ scope, event: resolved.event, appended_at: resolved.event.recorded_at }).ok, true);
  replay = rsl.replay({ scope, effective_as_of: '2026-11-02T09:00:00.000Z', recorded_as_of: '2026-11-02T09:00:00.000Z' });
  scorecard = derivePrivateLongitudinalScorecard({ scope, active_events: replay.state.active_events, historical_events: rsl.read({ scope }).records.map((record) => record.event), as_of_at: '2026-11-02T09:00:00.000Z' });
  assert.equal(scorecard.scorecard.unresolved_contradictions.length, 0);
  assert.equal(replay.state.superseded_event_ids.includes(opened.event.event_id), true);
  assert.equal(rsl.verify({ scope }).ok, true);
});
