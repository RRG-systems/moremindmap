import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import { createSubscriptionS2GuRuntime } from '../api/engine/subscriptionS2/guRuntime.js';
import { createSyntheticLivingRelationshipLab } from '../src/lab/subscriptionLivingBusinessRelationshipV1/createSyntheticLivingRelationshipLab.js';
import { InMemoryLivingRelationshipStore } from '../src/lib/subscriptionV1/afw05/store.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { buildSubscriptionS2GuWorld, validateSubscriptionS2GuPlan } from '../src/lib/subscriptionS2/guContract.js';
import { SUBSCRIPTION_LOCKED_NORTH_STAR } from '../src/lib/subscriptionV1/freeGptV2/constants.js';
import { createFrontierConversationSeamV2 } from '../src/lib/subscriptionV1/freeGptV2/providerSeams.js';

// Compile this one component in memory. No Vite server, listener, browser,
// filesystem artifact, provider binding or provider request is needed.
const rendererUrl = new URL('../src/subscriptionS2/SubscriptionS2GuRenderer.jsx', import.meta.url);
const rendererSource = await fs.readFile(rendererUrl, 'utf8');
const transformed = await transformWithOxc(rendererSource, rendererUrl.pathname, { jsx: { runtime: 'classic' } });
const reactUrl = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const moduleCode = transformed.code.replace(/from ["']react["']/gu, `from ${JSON.stringify(reactUrl)}`);
const Renderer = (await import(`data:text/javascript;base64,${Buffer.from(moduleCode).toString('base64')}`)).default;
const render = (plan) => renderToStaticMarkup(React.createElement(Renderer, { plan }));

function worldInput(lab, event) {
  const current = lab.controller.current();
  return { event, packet: lab.controller.wholeUnderstandingPacket(), publication: current.publication, viewModel: current.view_model, relationshipScopeHash: hashCanonicalJson(lab.scope) };
}
function fakeOutput(objectId, summary, nextCue) {
  return {
    renderDecision: { render: true, reason: 'One relevant point starts useful work.' },
    guidance: { eyebrow: 'MORE', headline: 'Our work', summary, nextCue },
    blocks: [{ blockId: 's2-block-opening', type: 'PLAIN_LANGUAGE', title: 'Our work', subtitle: '', objectIds: [objectId], evidenceIds: [], emphasis: 'PRIMARY', reason: 'Connect the available understanding to today.' }],
  };
}

test('first opening supplies actual person, business, direction and uncertainty in its existing single GU request', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const lab = await createSyntheticLivingRelationshipLab({ store, subject_key: 're-mid', session_kind: 'FIRST_EVER', seed_weekly_fixture: false });
  const before = hashCanonicalJson(store.snapshot());
  const input = worldInput(lab, 'FIRST_SESSION_WELCOME');
  const summary = 'Jordan, your review points to growth that leaves less work depending on you. We can work on useful practice together; correct me if that misses your experience.';
  const invitation = 'Which part of the work would you most like to make easier, or is a different concern more important today?';
  const requests = [];
  const runtime = createSubscriptionS2GuRuntime({ transport: async (request) => {
    requests.push(request);
    return { output: fakeOutput('s2-first-session-welcome', summary, invitation), receipt: { synthetic_test: true } };
  } });
  const result = await runtime.generate(input);
  assert.equal(requests.length, 1);
  const requestWorld = JSON.parse(requests[0].input[1].content).governedWorld;
  assert.equal(requestWorld.objects.length, 1);
  const recognition = requestWorld.objects[0].recognitionContext;
  assert.deepEqual(recognition.wholePerson, input.packet.provider_understanding.whole_person);
  assert.deepEqual(recognition.wholeBusiness, input.packet.provider_understanding.whole_business);
  assert.deepEqual(recognition.chosenDirection, input.packet.provider_understanding.plan);
  assert.deepEqual(recognition.evidence, input.packet.provider_understanding.evidence);
  assert.deepEqual(recognition.currentBusinessState, input.packet.provider_understanding.living_business_twin);
  assert.ok(requestWorld.objects[0].sourceIds.includes('s2-source-whole-person'));
  assert.deepEqual(result.plan.guidance.summary, summary);
  assert.deepEqual(result.plan.guidance.nextCue, invitation);
  const html = render(result.plan);
  assert.ok(html.includes(summary));
  assert.ok(html.includes(invitation));
  assert.equal(html.split(summary).length - 1, 1);
  assert.doesNotMatch(html, /recognitionContext|wholePerson|sourceIds|s2-gu-grid|Congratulations|<input|<form/u);
  assert.equal(hashCanonicalJson(store.snapshot()), before);
});

test('missing first-session understanding stays missing and source context is never dumped into the welcome', async () => {
  const lab = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', session_kind: 'FIRST_EVER', seed_weekly_fixture: false });
  const input = worldInput(lab, 'FIRST_SESSION_WELCOME');
  input.packet = { ...input.packet, provider_understanding: { coaching_session: { preferred_conversational_name: 'Jordan' } } };
  const world = buildSubscriptionS2GuWorld(input);
  const recognition = world.objects[0].recognitionContext;
  for (const field of ['wholePerson', 'wholeBusiness', 'chosenDirection', 'currentBusinessState', 'evidence']) assert.deepEqual(recognition[field], {});
  assert.deepEqual(recognition.activeCorrections, []);
  const summary = 'Jordan, we can begin with what matters to you and fill in the missing picture together.';
  const runtime = createSubscriptionS2GuRuntime({ transport: async () => ({ output: fakeOutput('s2-first-session-welcome', summary, 'What would be useful to work on today?'), receipt: { synthetic_test: true } }) });
  assert.ok(render((await runtime.generate(input)).plan).includes(summary));
});

test('return after absence carries actual dated agreements, results and active corrections without promoting a proposal', async () => {
  const store = new InMemoryLivingRelationshipStore();
  const common = { store, subject_key: 're-mid', relationship_key: 'rel_synthetic_sandwich_opening', session_kind: 'WEEKLY' };
  await createSyntheticLivingRelationshipLab(common);
  const now = '2026-09-09T12:00:00.000Z';
  const history = { session_history: [{ session_id: 'session_prior_sandwich', charge_point_reached: true, activated_at: '2026-08-22T11:40:00.000Z', ended_at: '2026-08-22T12:00:00.000Z' }] };
  const candidate = (type, target, field, value) => ({ candidate_type: type, proposal_type: type, target_contract: target, operation: 'PROPOSE', summary: value, items: [{ field, value }], reason: 'The customer requested this exact change.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE' });
  const correction = 'Ask what matters today before suggesting another task.';
  const unapproved = 'A proposed daily call sprint has not been agreed.';
  const resumed = await createSyntheticLivingRelationshipLab({ ...common, seed_weekly_fixture: false, clock: () => now, session_temporal_context: history,
    conversation_outputs: [{ customer_message: 'Jordan, I can correct that after your approval.' }, { customer_message: 'That remains a proposal.' }],
    candidate_outputs: [
      { candidate: candidate('CORRECTION_CANDIDATE', 'EVIDENCE_LEDGER', 'evidence.communication_preference', correction) },
      { candidate: candidate('COMMITMENT_CANDIDATE', 'PLAN_135', 'commitment.intervention', unapproved) },
    ],
  });
  const proposedCorrection = await resumed.controller.send({ message: `Correct my preference: ${correction}` });
  assert.equal(proposedCorrection.ok, true, proposedCorrection.code);
  const accepted = await resumed.controller.decide({ proposal_id: proposedCorrection.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'sandwich-correct-preference' });
  assert.equal(accepted.ok, true, accepted.code);
  const pending = await resumed.controller.send({ message: 'We could try a daily call sprint, but I have not agreed to it.' });
  assert.equal(pending.ok, true, pending.code);
  assert.equal(pending.confirmation_required, true);
  const fresh = await createSyntheticLivingRelationshipLab({ ...common, seed_weekly_fixture: false, clock: () => now, session_temporal_context: history });
  const before = hashCanonicalJson(store.snapshot());
  const input = worldInput(fresh, 'SESSION_OPENING');
  let request;
  const runtime = createSubscriptionS2GuRuntime({ transport: async (value) => {
    request = value;
    return { output: fakeOutput('s2-prior-agreements', 'We can pick up the practice you agreed to, with your corrected preference in mind.', 'What happened with that work, and what matters most today?'), receipt: { synthetic_test: true } };
  } });
  const result = await runtime.generate(input);
  const world = JSON.parse(request.input[1].content).governedWorld;
  const agreements = world.objects.find((item) => item.id === 's2-prior-agreements');
  assert.ok(agreements.governedRecords.some((record) => record.Kind === 'Intervention'));
  assert.equal(JSON.stringify(agreements).includes(unapproved), false);
  const corrections = world.objects.find((item) => item.id === 's2-current-corrections');
  assert.equal(corrections.governedRecords.length, 1);
  assert.equal(corrections.governedRecords[0].Meaning.Items[0].Value, correction);
  assert.deepEqual(world.openingContext.temporalState, input.packet.provider_understanding.temporal_state);
  assert.equal(world.openingContext.temporalState['Last coaching session']['Elapsed days since end'], 18);
  assert.deepEqual(world.openingContext.currentConversation, []);
  const results = world.objects.find((item) => item.id === 's2-progress');
  assert.ok(results.governedRecords.some((record) => record.Kind === 'Outcome'));
  assert.equal(results.governedRecords.some((record) => record.Kind === 'Confidence change'), false);
  assert.ok(results.governedRecords.every((record) => record['Happened at']));
  const correctionPlan = structuredClone(result.plan);
  correctionPlan.blocks[0].objectIds = ['s2-current-corrections'];
  assert.equal(validateSubscriptionS2GuPlan({ candidate: correctionPlan, world }).ok, true);
  // Full field meaning survives the old twelve-word rendering cutoff.
  assert.equal(result.plan.blocks[0].objects[0].items[0].label, agreements.items[0].label);
  assert.equal(hashCanonicalJson(store.snapshot()), before);
});

test('absence with no reported outcomes creates neither an agreement nor progress', async () => {
  const lab = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', session_kind: 'WEEKLY', seed_weekly_fixture: false,
    clock: () => '2026-09-09T12:00:00.000Z',
    session_temporal_context: { session_history: [{ session_id: 'session_prior_unknown_result', charge_point_reached: true, ended_at: '2026-08-22T12:00:00.000Z' }] },
  });
  const input = worldInput(lab, 'SESSION_OPENING');
  const world = buildSubscriptionS2GuWorld(input);
  assert.equal(world.objects.some((item) => ['s2-prior-agreements', 's2-progress', 's2-current-corrections'].includes(item.id)), false);
  assert.equal(world.openingContext.temporalState['Last coaching session']['Elapsed days since end'], 18);
  assert.match(world.openingContext.use, /establish neither completion nor failure/u);
});

test('the exact chosen-outcomes north star reaches opening and free coaching without adding a coaching call', async () => {
  const exact = 'Help each customer achieve the outcomes they choose by turning insight into action, action into effective habits, and sustained practice into results—with an accountability partner that understands them and helps them follow through.';
  assert.equal(SUBSCRIPTION_LOCKED_NORTH_STAR, exact);
  const lab = await createSyntheticLivingRelationshipLab({ subject_key: 're-mid', session_kind: 'FIRST_EVER', seed_weekly_fixture: false });
  let openingRequest, coachingRequest;
  const gu = createSubscriptionS2GuRuntime({ transport: async (request) => {
    openingRequest = request;
    return { output: fakeOutput('s2-first-session-welcome', 'Jordan, we can work toward the future you choose.', 'What matters most today?'), receipt: { synthetic_test: true } };
  } });
  await gu.generate(worldInput(lab, 'FIRST_SESSION_WELCOME'));
  const coach = createFrontierConversationSeamV2({ enabled: true, transport: async (request) => {
    coachingRequest = request;
    return { output: { customer_message: 'Jordan, what would make that practice worthwhile for you?' }, usage: {}, latency_ms: 1 };
  } });
  await coach.coach({ packet: lab.controller.wholeUnderstandingPacket(), customer_message: 'I want a practice that is useful, not just a streak.' });
  assert.ok(openingRequest.input[0].content.includes(exact));
  assert.ok(coachingRequest.input[0].content.includes(exact));
  assert.match(coachingRequest.input[0].content, /customer authorization and successful persistence are verified/u);
});
