import assert from 'node:assert/strict';
import test from 'node:test';
import { bundles } from '../server/athleteConsultingV2/bundles.js';
import { selectAthleteVisuals, selectClosingAthleteVisual } from '../src/athleteConsultingV2/visualUi.js';

function receipt(bundle, event, changes = {}) {
  const sessionId = 'session-one';
  return { id: `visual-${event}`, event, session_id: sessionId, after_message_id: 'assistant-one',
    source_hash: 'a'.repeat(64), plan: { event, renderDecision: { render: true }, blocks: [{ blockId: 'one' }],
      interactions: [], stateBinding: { sessionId, mm: bundle.person.mm,
        bosHash: bundle.bos.artifact_sha256, baselineApaHash: bundle.apa.artifact_sha256,
        currentApaHash: bundle.apa.artifact_sha256,
        triggerHash: 'a'.repeat(64) } }, ...changes };
}
function stateFor(bundle) {
  return { mm: bundle.person.mm, sessionId: 'session-one',
    messages: [{ id: 'assistant-one', role: 'assistant', text: 'Synthetic opening' }],
    visuals: [receipt(bundle, 'SESSION_OPENING'), receipt(bundle, 'COACHING_MOMENT'),
      receipt(bundle, 'SESSION_FINALIZATION')] };
}

test('selected synthetic athlete sees only exact current-session, source-bound visuals', () => {
  const nia = stateFor(bundles.nia);
  const sofiaReceipt = receipt(bundles.sofia, 'COACHING_MOMENT', { id: 'private-sofia' });
  nia.visuals.push(sofiaReceipt, receipt(bundles.nia, 'COACHING_MOMENT', { id: 'older', session_id: 'previous' }),
    receipt(bundles.nia, 'COACHING_MOMENT', { id: 'no-source-message', after_message_id: 'missing' }),
    receipt(bundles.nia, 'COACHING_MOMENT', { id: 'action', plan: {
      ...receipt(bundles.nia, 'COACHING_MOMENT').plan, interactions: ['approve-plan'],
    } }));
  assert.deepEqual(selectAthleteVisuals(bundles.nia, nia).map((visual) => visual.id),
    ['visual-SESSION_OPENING', 'visual-COACHING_MOMENT', 'visual-SESSION_FINALIZATION']);
  assert.deepEqual(selectAthleteVisuals(bundles.sofia, nia), []);
  assert.deepEqual(selectAthleteVisuals({ ...bundles.nia, person: { ...bundles.nia.person, synthetic: false } }, nia), []);
  assert.deepEqual(selectAthleteVisuals(bundles.nia, { ...nia, sessionId: null }), []);
});

test('closing canvas is selected by exact saved visual ID, not latest unrelated visual', () => {
  const visuals = selectAthleteVisuals(bundles.nia, stateFor(bundles.nia));
  assert.equal(selectClosingAthleteVisual(visuals, { visual_id: 'visual-SESSION_FINALIZATION' }).event,
    'SESSION_FINALIZATION');
  assert.equal(selectClosingAthleteVisual(visuals, { visual_id: 'visual-COACHING_MOMENT' }), null);
  assert.equal(selectClosingAthleteVisual(visuals, null), null);
});

test('stale APA visuals are withheld after correction or current APA publication', () => {
  const state = stateFor(bundles.nia);
  const priorApaVisual = receipt(bundles.nia, 'COACHING_MOMENT', { id: 'prior-apa', plan: {
    ...receipt(bundles.nia, 'COACHING_MOMENT').plan,
    blocks: [{ blockId: 'one', objects: [{ id: 'athlete-apa', sourceIds: ['athlete-source-apa'] }],
      evidence: [{ id: 'athlete-source-apa' }] }],
  } });
  state.visuals.push(priorApaVisual);
  assert.ok(selectAthleteVisuals(bundles.nia, state).some((visual) => visual.id === 'prior-apa'));
  state.apaNeedsReview = true;
  assert.equal(selectAthleteVisuals(bundles.nia, state).some((visual) => visual.id === 'prior-apa'), false);
  state.apaNeedsReview = false;
  state.currentApa = { artifact: { artifact_sha256: 'f'.repeat(64) } };
  assert.equal(selectAthleteVisuals(bundles.nia, state).some((visual) => visual.id === 'prior-apa'), false);
});
