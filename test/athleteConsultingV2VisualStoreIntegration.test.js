import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { bundles } from '../server/athleteConsultingV2/bundles.js';
import { createStore, PERSIST_LUA } from '../server/athleteConsultingV2/store.js';
import { materializeAthleteVisualPlan } from '../server/athleteConsultingV2/visual.js';

class FakeRedis {
  values = new Map();
  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, String(value)); return 'OK';
  }
  async eval(script, count, ...args) {
    const keys = args.slice(0, count), argv = args.slice(count);
    if (script === PERSIST_LUA) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      const prior = this.values.get(keys[1]);
      if ((prior ?? '') !== argv[2]) return -1;
      if (argv[3] === '1' && prior) {
        const backup = this.values.get(keys[2]);
        if (backup && backup !== prior) return -2;
        if (!backup) this.values.set(keys[2], prior);
      }
      this.values.set(keys[1], argv[1]); return 1;
    }
    if (script.includes("redis.call('PEXPIRE'")) return this.values.get(keys[0]) === argv[0] ? 1 : 0;
    if (script.includes("redis.call('DEL'")) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      this.values.delete(keys[0]); return 1;
    }
    throw new Error('UNEXPECTED_LUA');
  }
}

const noPlan = (reply) => ({ reply, plan: null, plan_change: 'none', retire_draft: false, learning: [], recap: '' });
const proposedPlan = () => ({ title: 'Try one useful cue', why: 'A possible next step, not an agreement.',
  steps: [{ action: 'Try one short cue', when: 'At the next practice', notice: 'Whether it helped', owner: 'athlete' }],
  review: 'After practice' });
function visualCandidate(world, { render = true, objectIds, type = 'PLAIN_LANGUAGE' } = {}) {
  const ids = objectIds || (world.event === 'SESSION_FINALIZATION' ? ['athlete-session-recap'] : ['athlete-apa']);
  const chosen = world.objects.filter((item) => ids.includes(item.id));
  const sourceIds = [...new Set(chosen.flatMap((item) => item.sourceIds))];
  return { planVersion: 'athlete-consulting-v2-visual-v1', event: world.event,
    stateBinding: structuredClone(world.stateBinding),
    renderDecision: { render, reason: render
      ? world.presentationCopy.renderReason : world.presentationCopy.noRenderReason },
    guidance: structuredClone(world.presentationCopy.guidance),
    blocks: render ? [{ blockId: 'athlete-block-current-view', type,
      ...world.presentationCopy.blocksByType[type], objectIds: ids, evidenceIds: sourceIds,
      emphasis: 'normal', reason: world.presentationCopy.blockReason }] : [], interactions: [] };
}
function validComposer({ choose = () => ({}) } = {}) {
  const calls = [];
  const compose = async (world) => {
    calls.push(world);
    const candidate = visualCandidate(world, choose(world));
    return { plan: materializeAthleteVisualPlan({ candidate, world,
      receipt: { test_only: true, event: world.event } }), receipt: { test_only: true } };
  };
  return { compose, calls };
}
function fixture({ coach = async (_bundle, _state, task) => noPlan(task === 'CLOSE' ? 'We can review without making a plan.' : 'Let us talk.'),
  visualComposer, redis = new FakeRedis(), scopeId = 'private-visual-store-test' } = {}) {
  return { redis, store: createStore({ redis, bundles, coach, scopeId, visualComposer }) };
}
async function act(store, slug, body, requestId = randomUUID()) {
  const before = await store.read(slug);
  return store.act(slug, { ...body, revision: before.revision, requestId });
}

test('mandatory opening and closing visuals persist with exact selected athlete and session', async () => {
  const { compose, calls } = validComposer();
  const { store } = fixture({ visualComposer: compose });
  const opened = await act(store, 'nia', { action: 'start' }, 'opening-one');
  assert.equal(opened.status, 'active');
  assert.equal(opened.visuals.length, 1);
  assert.equal(opened.visuals[0].event, 'SESSION_OPENING');
  assert.equal(opened.visuals[0].session_id, opened.sessionId);
  assert.equal(opened.visuals[0].plan.stateBinding.mm, bundles.nia.person.mm);
  assert.equal(opened.visuals[0].after_message_id, opened.messages.at(-1).id);
  const closed = await act(store, 'nia', { action: 'close' }, 'close-one');
  assert.equal(closed.status, 'review');
  assert.equal(closed.visuals.length, 2);
  assert.equal(closed.visuals[1].event, 'SESSION_FINALIZATION');
  assert.equal(closed.closing.visual_id, closed.visuals[1].id);
  assert.equal(closed.visuals[1].plan.blocks[0].objects[0].id, 'athlete-session-recap');
  assert.deepEqual(calls.map((world) => world.event), ['SESSION_OPENING', 'SESSION_FINALIZATION']);
  const reloaded = await store.read('nia');
  assert.deepEqual(reloaded.visuals, closed.visuals);
  assert.equal(reloaded.plan, null);
});

test('middle visual is selective, source-bound and not generated on every turn', async () => {
  let middle = 0;
  const { compose, calls } = validComposer({ choose: (world) => world.event === 'COACHING_MOMENT'
    ? ++middle === 1 ? { render: false } : { objectIds: ['athlete-option-m1', 'athlete-option-m2'], type: 'COMPARISON' }
    : {} });
  const { store } = fixture({ visualComposer: compose });
  await act(store, 'sofia', { action: 'start' });
  let state = await act(store, 'sofia', { action: 'message', text: 'I am thinking about it.' });
  assert.equal(state.visuals.length, 1);
  state = await act(store, 'sofia', { action: 'message', text: 'Can you compare the options?' });
  assert.equal(state.visuals.length, 1);
  assert.equal(state.events.filter((event) => event.type === 'visual_considered').length, 2);
  state = await act(store, 'sofia', { action: 'message', text: 'Compare those options again.' });
  assert.equal(state.visuals.length, 2);
  assert.deepEqual(state.visuals[1].plan.blocks[0].objects.map((item) => item.id),
    ['athlete-option-m1', 'athlete-option-m2']);
  state = await act(store, 'sofia', { action: 'message', text: 'Compare again, please.' });
  assert.equal(state.visuals.length, 2);
  assert.equal(calls.filter((world) => world.event === 'COACHING_MOMENT').length, 2);
  assert.equal(state.plan, null);
});

test('a plan first proposed at CLOSE remains a draft through the visual and session finish', async () => {
  const coach = async (_bundle, _state, task) => task === 'CLOSE'
    ? { ...noPlan('Here is an optional step to review.'), plan: proposedPlan(), plan_change: 'replace', recap: 'No plan has been agreed.' }
    : noPlan('Let us begin.');
  const { compose } = validComposer({ choose: (world) => world.event === 'SESSION_FINALIZATION'
    ? { objectIds: ['athlete-session-recap', 'athlete-draft'] } : {} });
  const { store } = fixture({ coach, visualComposer: compose });
  await act(store, 'nia', { action: 'start' });
  const closed = await act(store, 'nia', { action: 'close' });
  assert.equal(closed.status, 'review');
  assert.equal(closed.plan, null);
  assert.equal(closed.draft.title, proposedPlan().title);
  assert.deepEqual(closed.draft.approvals, []);
  assert.equal(closed.visuals.at(-1).plan.blocks[0].objects.find((item) => item.id === 'athlete-draft').kind,
    'PROPOSED_PLAN');
  const finished = await act(store, 'nia', { action: 'finish' });
  assert.equal(finished.status, 'closed');
  assert.equal(finished.plan, null);
  assert.equal(finished.draft.title, proposedPlan().title);
  assert.equal(finished.sessions.at(-1).unapproved_draft, proposedPlan().title);
});

test('a previously accepted plan appears by exact saved identity in the final review', async () => {
  const { compose } = validComposer({ choose: (world) => world.event === 'SESSION_FINALIZATION'
    ? { objectIds: ['athlete-session-recap', 'athlete-plan'] } : {} });
  const { store } = fixture({ visualComposer: compose });
  await act(store, 'nia', { action: 'start' });
  const drafted = await act(store, 'nia', { action: 'draft', plan: proposedPlan() });
  const accepted = await act(store, 'nia', { action: 'approve', id: drafted.draft.id,
    hash: drafted.draft.hash, actor: 'athlete' });
  assert.equal(accepted.plan.title, proposedPlan().title);
  const closed = await act(store, 'nia', { action: 'close' });
  assert.equal(closed.status, 'review');
  const finalObjects = closed.visuals.at(-1).plan.blocks.flatMap(block => block.objects);
  const visualPlan = finalObjects.find(item => item.id === 'athlete-plan');
  assert.equal(visualPlan.kind, 'ACCEPTED_PLAN');
  assert.equal(visualPlan.statement, accepted.plan.title);
  assert.equal(closed.plan.id, accepted.plan.id);
  assert.equal(closed.draft, null);
});

test('invalid opening visual leaves prior ready state and repeated request does not retry', async () => {
  let calls = 0;
  const { store } = fixture({ visualComposer: async (world) => {
    calls++;
    const candidate = visualCandidate(world);
    candidate.stateBinding.mm = bundles.sofia.person.mm;
    return { plan: candidate };
  } });
  const body = { action: 'start', revision: 0, requestId: 'bad-opening' };
  const failed = await store.act('nia', body);
  assert.equal(failed.status, 'ready');
  assert.equal(failed.opening, null);
  assert.equal(failed.sessionId, null);
  assert.deepEqual(failed.visuals, []);
  assert.ok(failed.lastError);
  assert.deepEqual(await store.act('nia', body), failed);
  assert.equal(calls, 1);
});

test('final visual failure cannot claim review, close or draft while preserving earlier visual', async () => {
  let failFinal = true, finalCalls = 0;
  const { compose } = validComposer({ choose: (world) => world.event === 'SESSION_FINALIZATION'
    ? { objectIds: ['athlete-session-recap', 'athlete-draft'] } : {} });
  const { store } = fixture({ coach: async (_bundle, _state, task) => task === 'CLOSE'
    ? { ...noPlan('A new optional step.'), plan: proposedPlan(), plan_change: 'replace', recap: 'Still open.' }
    : noPlan('Opening.'), visualComposer: async (world) => {
    if (world.event === 'SESSION_FINALIZATION') {
      finalCalls++;
      if (failFinal) throw new Error('ATHLETE_VISUAL_PLAN_FAILED_CLOSED');
    }
    return compose(world);
  } });
  const opened = await act(store, 'nia', { action: 'start' });
  const body = { action: 'close', revision: opened.revision, requestId: 'failed-finalization' };
  const failed = await store.act('nia', body);
  assert.equal(failed.status, 'active');
  assert.equal(failed.closing, null);
  assert.equal(failed.draft, null);
  assert.equal(failed.visuals.length, 1);
  assert.deepEqual(await store.act('nia', body), failed);
  assert.equal(finalCalls, 1);
  failFinal = false;
  const recovered = await act(store, 'nia', { action: 'close' }, 'fresh-finalization');
  assert.equal(recovered.status, 'review');
  assert.equal(recovered.visuals.length, 2);
  assert.equal(finalCalls, 2);
});

test('visual source IDs are independently scoped to Nia and Sofia; duplicate requests are one-shot', async () => {
  const { compose, calls } = validComposer();
  const { store } = fixture({ visualComposer: compose });
  const niaBody = { action: 'start', revision: 0, requestId: 'same-id' };
  const nia = await store.act('nia', niaBody);
  assert.deepEqual(await store.act('nia', niaBody), nia);
  const sofia = await store.act('sofia', niaBody);
  assert.equal(nia.visuals.length, 1);
  assert.equal(sofia.visuals.length, 1);
  assert.notEqual(nia.visuals[0].plan.stateBinding.mm, sofia.visuals[0].plan.stateBinding.mm);
  assert.notEqual(nia.visuals[0].plan.stateBinding.relationshipScopeHash,
    sofia.visuals[0].plan.stateBinding.relationshipScopeHash);
  assert.equal(calls.length, 2);
  assert.equal((await store.read('sofia')).messages.some((message) => message.text.includes('Nia')), false);
});

test('store rejects a composer result that invents an object ID despite a valid binding', async () => {
  const { store } = fixture({ visualComposer: async (world) => {
    const plan = visualCandidate(world);
    plan.blocks[0].objectIds = ['athlete-option-invented'];
    return { plan };
  } });
  const failed = await act(store, 'nia', { action: 'start' });
  assert.equal(failed.status, 'ready');
  assert.deepEqual(failed.visuals, []);
  assert.ok(failed.lastError);
});
