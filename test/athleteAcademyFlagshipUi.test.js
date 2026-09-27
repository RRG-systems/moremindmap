import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import babel from '@babel/core';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { buildCanonicalCoachBundle, hash } from '../server/athleteAcademyV1/coaching/bundle.js';
import { initialCoachState } from '../server/athleteAcademyV1/coaching/state.js';
import { createMainCurrentApaAdapter } from '../server/athleteAcademyV1/coaching/currentApa.js';
import { createMainVisualAdapter } from '../server/athleteAcademyV1/coaching/visual.js';
import { eligibleApaMessages, continuityView, confirmApaCommand } from '../src/athleteAcademyV1/coach/currentApaUi.js';
import { confirmationReadingScope } from '../src/athleteAcademyV1/apa/projection.js';
import { selectMainAthleteVisuals, selectMainClosingVisual,
  presentClosingAthleteReview } from '../src/athleteAcademyV1/coach/visualUi.js';
import { frameViewContext } from '../src/athleteAcademyV1/coach/viewContextUi.js';

const clone = value => structuredClone(value);
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// Installed Babel core performs a small JS-only JSX transform. No Vite, esbuild,
// native worker, HTTP listener, browser, provider, or real account is created.
// The VM can import only the explicit component dependencies below.
function component(path, imports, named = null) {
  const plugin = ({ types: t }) => {
    const tag = node => t.isJSXIdentifier(node) ? (/^[a-z]/u.test(node.name)
      ? t.stringLiteral(node.name) : t.identifier(node.name))
      : t.memberExpression(tag(node.object), t.identifier(node.property.name));
    const children = nodes => nodes.flatMap(node => {
      if (t.isJSXText(node)) {
        const value = node.value.replace(/\s+/gu, ' ');
        return value.trim() ? [t.stringLiteral(value)] : [];
      }
      if (t.isJSXExpressionContainer(node)) return t.isJSXEmptyExpression(node.expression) ? [] : [node.expression];
      return [node];
    });
    const jsx = node => {
      const properties = node.openingElement.attributes.map(attr => {
        if (t.isJSXSpreadAttribute(attr)) return t.spreadElement(attr.argument);
        const value = attr.value === null ? t.booleanLiteral(true)
          : t.isJSXExpressionContainer(attr.value) ? attr.value.expression : attr.value;
        return t.objectProperty(t.stringLiteral(attr.name.name), value);
      });
      return t.callExpression(t.memberExpression(t.identifier('React'), t.identifier('createElement')),
        [tag(node.openingElement.name), properties.length ? t.objectExpression(properties) : t.nullLiteral(), ...children(node.children)]);
    };
    return { visitor: {
      ImportDeclaration(path) {
        const name = path.node.source.value;
        if (name.endsWith('.css')) { path.remove(); return; }
        assert.equal(Object.hasOwn(imports, name), true, `Unapproved component import ${name}`);
        const base = () => t.memberExpression(t.identifier('__imports'), t.stringLiteral(name), true);
        path.replaceWithMultiple(path.node.specifiers.map(spec => t.variableDeclaration('const', [t.variableDeclarator(
          t.identifier(spec.local.name), t.isImportDefaultSpecifier(spec) || t.isImportNamespaceSpecifier(spec)
            ? base() : t.memberExpression(base(), t.identifier(spec.imported.name)))])));
      },
      JSXElement: { exit(path) { path.replaceWith(jsx(path.node)); } },
      JSXFragment: { exit(path) { path.replaceWith(t.callExpression(t.memberExpression(t.identifier('React'), t.identifier('createElement')),
        [t.memberExpression(t.identifier('React'), t.identifier('Fragment')), t.nullLiteral(), ...children(path.node.children)])); } },
      ExportDefaultDeclaration(path) {
        path.replaceWith(t.expressionStatement(t.assignmentExpression('=',
          t.memberExpression(t.identifier('module'), t.identifier('exports')), t.toExpression(path.node.declaration))));
      },
    } };
  };
  const options = { babelrc: false, configFile: false,
    parserOpts: { sourceType: 'module', plugins: ['jsx'] }, plugins: [plugin] };
  const code = source(path);
  let transformed;
  if (named) {
    // Keep exact owning-source functions, rather than a rewritten Home fixture.
    // The App itself is not mounted: effects/transport cannot execute here.
    const ast = babel.parseSync(code, { ...options, plugins: [] });
    ast.program.body = ast.program.body.filter(node => node.type === 'ImportDeclaration'
      ? Object.hasOwn(imports, node.source.value)
      : node.type === 'FunctionDeclaration' && [named, 'Text', 'Orbit'].includes(node.id.name));
    ast.program.body.push(babel.types.exportDefaultDeclaration(babel.types.identifier(named)));
    transformed = babel.transformFromAstSync(ast, code, options).code;
  } else transformed = babel.transformSync(code, options).code;
  const module = { exports: null };
  runInNewContext(transformed, { module, __imports: Object.freeze(imports), structuredClone }, { timeout: 1000 });
  return module.exports;
}
const AthleteVisual = component('../src/athleteConsultingV2/AthleteVisual.jsx', { react: React });
const ClosingReview = component('../src/athleteAcademyV1/coach/ClosingReview.jsx', {
  react: React, '../../athleteConsultingV2/AthleteVisual.jsx': AthleteVisual });
const MemoryContinuity = component('../src/athleteAcademyV1/coach/MemoryContinuity.jsx', {
  react: React, './currentApaUi.js': { eligibleApaMessages } });
const Home = component('../src/athleteAcademyV1/coach/App.jsx', { react: React,
  '../../athleteConsultingV2/AthleteVisual.jsx': AthleteVisual,
  '../apa/projection.js': { confirmationReadingScope }, './currentApaUi.js': { continuityView } }, 'Home');

function fixture() {
  const actorId = 'fictional-ui-owner', mm = 'MM-FICTIONAL-FLAGSHIP-UI';
  const replace = value => JSON.parse(JSON.stringify(value).replaceAll(nia.person.mm, mm).replaceAll('Nia', 'Mira UI'));
  const bos = replace(nia.bos), apa = replace(nia.apa), bosInput = replace(nia.bos_source);
  bos.mm = mm; bos.synthetic = false; bos.subject.age = 18;
  delete bos.artifact_sha256; bos.artifact_sha256 = hash(bos);
  apa.mm = mm; apa.synthetic = false; apa.identity.age = 18;
  apa.identity.reading_sha256 = hash(bos); apa.bos_sha256 = hash(bos);
  delete apa.artifact_sha256; apa.artifact_sha256 = hash(apa);
  const person = { actorId, mm, name: 'Mira UI', age: 18, sport: 'Volleyball', synthetic: false };
  bosInput.person = { ...bosInput.person, ...person };
  const principal = { authenticated: true, actorId, subjectActorId: actorId, mm, role: 'athlete',
    grants: { reportsRead: true, coachingRead: true, participation: true } };
  const bundle = buildCanonicalCoachBundle({ person, bos, apa, bosInput }, principal);
  const state = initialCoachState(bundle);
  state.status = 'active'; state.flagship_enabled = true; state.capabilities = { currentApa: true };
  state.continuity = { contract: 'athlete_academy_current_apa_v1', binding: clone(bundle.binding),
    original: clone(bundle.apa), current: null, draft: null, changes: [], current_version: 0, stale: false };
  state.messages = [{ id: '11111111-1111-4111-8111-111111111111', role: 'assistant', text: 'MORE opening.' }];
  const authority = Object.freeze({ fixtureSnapshot: true });
  const assertFencedAuthority = input => input.authority === authority && input.state === state
    && input.principal === principal && input.bundle === bundle;
  const currentApaAdapter = createMainCurrentApaAdapter({ assertFencedAuthority });
  const visuals = createMainVisualAdapter({ assertFencedAuthority, currentApaAdapter });
  function visual(event = 'SESSION_OPENING', objectIds = ['athlete-apa']) {
    const world = visuals.buildAthleteVisualWorld({ bundle, principal, authority, state, event,
      scopeId: 'athlete-academy-private', sessionId: state.sessionId, triggerRequestId: 'fictional-ui-request' });
    const candidate = { planVersion: 'athlete-academy-visual-v1', event, stateBinding: clone(world.stateBinding),
      renderDecision: { render: true, reason: world.presentationCopy.renderReason }, guidance: clone(world.presentationCopy.guidance),
      blocks: [{ blockId: 'athlete-block-ui-replay', type: 'PLAIN_LANGUAGE',
        ...world.presentationCopy.blocksByType.PLAIN_LANGUAGE, objectIds, evidenceIds: [], emphasis: 'normal',
        reason: world.presentationCopy.blockReason }], interactions: [] };
    return { id: `fictional-ui-${event}`, event, session_id: state.sessionId,
      after_message_id: state.messages[0].id, trigger_request_id: world.stateBinding.triggerRequestId,
      source_hash: world.stateBinding.triggerHash, plan: visuals.materializeAthleteVisualPlan({ candidate, world }) };
  }
  return { bundle, state, principal, visual };
}
const closingProps = state => ({ state, working: false, remember: [], setRemember() {},
  act() { assert.fail('Static render must not send an action'); }, navigate() {}, setChatOpen() {}, reviewRef: null });

test('same authenticated owner visual projection renders saved source objects without mutation controls', () => {
  const f = fixture(); f.state.visuals = [f.visual()];
  const selected = selectMainAthleteVisuals(f.bundle, f.state);
  assert.equal(selected.length, 1);
  const html = renderToStaticMarkup(React.createElement(AthleteVisual, { plan: selected[0].plan }));
  assert.match(html, /Your sport and life now/u);
  assert.match(html, /data-athlete-visual-event="SESSION_OPENING"/u);
  assert.doesNotMatch(html, /<button|<form|<input|approve-plan|providerReceipt|request_sha256/u);
});

test('actual authenticated Home renders the opening visual inside the green card before its footer', () => {
  const f = fixture(); f.state.visuals = [f.visual()];
  const [openingVisual] = selectMainAthleteVisuals(f.bundle, f.state);
  const html = renderToStaticMarkup(React.createElement(Home, { b: f.bundle, s: f.state, busy: false,
    openingVisual, act() { assert.fail('Home render must not start a session'); }, navigate() {}, discuss() {} }));
  const green = html.indexOf('class="home-card green-card"'), blue = html.indexOf('class="home-card blue-card"');
  const visualIndex = html.indexOf('data-athlete-visual-event="SESSION_OPENING"');
  const footer = html.indexOf('<footer>', green);
  assert.equal(green >= 0 && green < visualIndex && visualIndex < footer && footer < blue, true);
  assert.match(html, /athlete-visual-home/u);
  assert.equal(f.state.currentApa, null); assert.equal(f.state.plan, null);
});

test('cross-account, session, source, version and incompatible visual projections render nothing', () => {
  const f = fixture(), valid = f.visual();
  for (const mutate of [
    v => { v.plan.stateBinding.actorId = 'foreign'; }, v => { v.plan.stateBinding.mm = 'foreign'; },
    v => { v.session_id = 'foreign'; }, v => { v.plan.stateBinding.relationshipScopeHash = '0'.repeat(64); },
    v => { v.plan.stateBinding.bosHash = '0'.repeat(64); }, v => { v.plan.stateBinding.baselineApaHash = '0'.repeat(64); },
    v => { v.plan.stateBinding.currentApaHash = '0'.repeat(64); }, v => { v.plan.stateBinding.currentApaVersion = '1'; },
    v => { v.after_message_id = 'unowned-assistant'; }, v => { v.plan.planVersion = 'athlete-consulting-v2-visual-v1'; },
    v => { v.plan.interactions.push('approve'); }, v => { v.source_hash = '0'.repeat(64); },
  ]) {
    const bad = clone(valid); mutate(bad); f.state.visuals = [bad];
    assert.deepEqual(selectMainAthleteVisuals(f.bundle, f.state), []);
  }
  f.state.visuals = [valid]; f.state.flagship_enabled = false;
  assert.deepEqual(selectMainAthleteVisuals(f.bundle, f.state), []);
});

test('pending owner APA changes suppress earlier current-APA guidance but allow BOS-only orientation', () => {
  const f = fixture(), prior = f.visual();
  f.state.visuals = [prior]; f.state.apaNeedsReview = true;
  const view = continuityView(f.bundle, f.state);
  assert.equal(view.verified, true); assert.equal(view.needsReview, true);
  assert.deepEqual(selectMainAthleteVisuals(f.bundle, f.state), []);
  const historicalSafe = f.visual('SESSION_OPENING', ['athlete-bos']);
  f.state.visuals = [historicalSafe];
  assert.equal(selectMainAthleteVisuals(f.bundle, f.state).length, 1);
  f.state.pendingAttempt = { id: 'unknown-attempt' }; f.state.status = 'unknown';
  assert.deepEqual(selectMainAthleteVisuals(f.bundle, f.state), []);
});

test('final main render puts actual map reveal before recap and keeps all publication/approval actions separate', () => {
  const f = fixture(); f.state.status = 'review'; f.state.closing_reveal_ready = true;
  f.state.closing = { summary: 'RECAP_SENTINEL: We discussed options without agreement.', continuity: 'Review next time.' };
  // Reverse requested object order deliberately; the actual shared renderer
  // lifts the map reveal without asking the model for another result.
  const visual = f.visual('SESSION_FINALIZATION', ['athlete-session-recap', 'athlete-map-change']);
  f.state.closing.visual_id = visual.id; f.state.visuals = [visual];
  const selected = selectMainAthleteVisuals(f.bundle, f.state);
  assert.equal(selectMainClosingVisual(selected, f.state.closing), visual);
  const html = renderToStaticMarkup(React.createElement(ClosingReview, { ...closingProps(f.state), visual }));
  const mapIndex = html.indexOf('Your map at this closing'), recapIndex = html.indexOf('RECAP_SENTINEL');
  assert.equal(mapIndex >= 0 && mapIndex < recapIndex, true);
  assert.match(html, /before-and-after comparison is unavailable/u);
  assert.match(html, /This review does not approve a plan or rewrite your assessment/u);
  assert.match(html, /Finish session/u);
  assert.doesNotMatch(html, /Publish|Use this plan|automatically updated/u);
});

test('legacy/unproven closing renders refresh control and preserved-history explanation, never an enabled finish shortcut', () => {
  const f = fixture(); f.state.status = 'review'; f.state.closing_reveal_ready = false;
  f.state.closing = { summary: 'Legacy recap.' };
  const html = renderToStaticMarkup(React.createElement(ClosingReview, closingProps(f.state)));
  assert.match(html, /Refresh closing review/u);
  assert.match(html, /no saved start map/u);
  assert.match(html, /conversation and plan remain saved/u);
  assert.doesNotMatch(html, /Finish session|Save preferences &amp; finish/u);
});

test('reviewed-memory form offers only actual owner messages and never submits or publishes during render', () => {
  const f = fixture(); let calls = 0;
  f.state.messages.push({ id: 'own', actorId: f.principal.actorId, role: 'user', speaker: 'athlete', text: 'OWN_MESSAGE_SENTINEL' },
    { id: 'foreign', actorId: 'foreign', role: 'user', speaker: 'athlete', text: 'FOREIGN_MESSAGE_SENTINEL' },
    { id: 'note', actorId: f.principal.actorId, role: 'user', speaker: 'athlete', text: 'COACH_NOTE_SENTINEL', capture: { reviewed: true } },
    { id: 'cross-mm', actorId: f.principal.actorId, mm: 'foreign-mm', role: 'user', speaker: 'athlete', text: 'CROSS_MM_SENTINEL' });
  f.state.personalMemory = { items: [{ event_id: 'prior-statement', text: 'Prior owner statement.' }], omitted_count: 1 };
  const html = renderToStaticMarkup(React.createElement(MemoryContinuity, { bundle: f.bundle, state: f.state,
    disabled: false, onAction() { calls++; } }));
  assert.match(html, /OWN_MESSAGE_SENTINEL/u);
  assert.doesNotMatch(html, /FOREIGN_MESSAGE_SENTINEL|COACH_NOTE_SENTINEL|CROSS_MM_SENTINEL/u);
  assert.match(html, /self-report, not independent verification/u);
  assert.match(html, /does not publish an APA or change your agreed plan/u);
  assert.match(html, /type="checkbox" disabled=""/u);
  assert.match(html, /type="submit" disabled=""/u);
  assert.match(html, /saved history remains preserved/u);
  assert.equal(calls, 0);
  assert.equal(f.state.currentApa, null); assert.equal(f.state.plan, null);
  f.state.flagship_enabled = false;
  assert.equal(renderToStaticMarkup(React.createElement(MemoryContinuity, { bundle: f.bundle, state: f.state,
    disabled: false, onAction() { calls++; } })), '');
});

test('compatibility read hold preserves authenticated saved reading while failing closed on APA confirmation', () => {
  const f = fixture();
  f.state.messages.push({ id: 'own-hold', actorId: f.principal.actorId, role: 'user', speaker: 'athlete', text: 'My explicit update.' });
  const before = clone(f.state);
  assert.equal(continuityView(f.bundle, f.state).actionAllowed, true);
  f.state.coaching_write_hold = { active: true, reason: 'flagship flag downgrade' };
  const view = continuityView(f.bundle, f.state);
  assert.equal(view.verified, true); assert.equal(view.actionAllowed, false);
  assert.deepEqual(view.artifact, f.bundle.apa);
  assert.throws(() => confirmApaCommand(f.bundle, f.state, { source_message_id: 'own-hold', reason: 'My choice', kind: 'reality' }),
    /could not be verified/u);
  const html = renderToStaticMarkup(React.createElement(MemoryContinuity, { bundle: f.bundle, state: f.state,
    disabled: true, onAction() { assert.fail('Read hold must not issue actions during render'); } }));
  assert.match(html, /type="submit" disabled=""/u);
  assert.deepEqual(f.state.messages, before.messages);
  assert.deepEqual(f.state.continuity, before.continuity);
  assert.equal(f.state.currentApa, null); assert.equal(f.state.plan, null);
});

test('iframe context accepts only exact authenticated origin/frame/MM/revision/artifact/version and bounded destination', () => {
  const f = fixture(), frame = {}, origin = 'https://fictional-preview.invalid';
  const event = { origin, source: frame, data: { contract: 'athlete-academy-apa-context', mm: f.bundle.person.mm,
    revision: f.state.revision, box: 'futures', reading: 'current', objectId: 'future-bold_future',
    version: 0, artifact_hash: f.bundle.apa.artifact_sha256 } };
  const expected = { section: 'futures', reading: 'current', objectId: 'future-bold_future' };
  assert.deepEqual(frameViewContext(event, { origin, frame, bundle: f.bundle, state: f.state }), expected);
  for (const mutate of [
    e => { e.origin = 'https://foreign.invalid'; }, e => { e.source = {}; },
    e => { e.data.mm = 'foreign-mm'; }, e => { e.data.revision++; },
    e => { e.data.artifact_hash = '0'.repeat(64); }, e => { e.data.version++; },
    e => { e.data.box = 'unbounded-box'; }, e => { e.data.objectId = 'foreign-actor'; },
    e => { e.data.reading = 'live-authority'; }, e => { e.data.contract = 'foreign-contract'; },
  ]) {
    const bad = { ...event, data: clone(event.data) }; mutate(bad);
    assert.equal(frameViewContext(bad, { origin, frame, bundle: f.bundle, state: f.state }), null);
  }
  f.state.apaNeedsReview = true;
  assert.equal(frameViewContext(event, { origin, frame, bundle: f.bundle, state: f.state }), null);
  const historical = { ...event, data: { ...event.data, reading: 'historical' } };
  assert.deepEqual(frameViewContext(historical, { origin, frame, bundle: f.bundle, state: f.state }), {
    ...expected, reading: 'historical' });
});

test('closing focus targets actual map reveal instead of scrolling to chat bottom', () => {
  const calls = [], reveal = { scrollIntoView(options) { calls.push(['reveal', options]); } };
  const review = { focus(options) { calls.push(['focus', options]); },
    querySelector(selector) { assert.equal(selector, '.athlete-visual-map-reveal'); return reveal; } };
  assert.equal(presentClosingAthleteReview(review), true);
  assert.deepEqual(calls, [['focus', { preventScroll: true }], ['reveal', { block: 'start', inline: 'nearest' }]]);
  assert.equal(presentClosingAthleteReview(null), false);
});

test('frozen owning UI actually mounts memory, home/chat visuals, closing review and scoped iframe context', () => {
  const app = source('../src/athleteAcademyV1/coach/App.jsx');
  assert.match(app, /<MemoryContinuity bundle=\{b\} state=\{s\}/u);
  assert.match(app, /<ClosingReview state=\{s\} visual=\{closingVisual\}/u);
  assert.match(app, /<AthleteVisual plan=\{openingVisual\.plan\}/u);
  assert.match(app, /after_message_id===m\.id&&v\.event!=='SESSION_FINALIZATION'/u);
  assert.match(app, /if\(closingReviewKey\)return;/u);
  assert.match(app, /presentClosingAthleteReview\(closingReview\.current\)/u);
  assert.match(app, /onSectionChange=\{section=>\{bosSection\.current=section;/u);
  assert.match(app, /frameViewContext\(event,\{origin:location\.origin,frame:iframe\.contentWindow,bundle:b,state:s\}\)/u);
  assert.match(app, /const working =[\s\S]*?s\?\.coaching_write_hold\?\.active===true/u);
  assert.match(app, /readHoldNotice[\s\S]*?<MemoryContinuity bundle=\{b\} state=\{s\} disabled=\{working\}/u);
  const apa = source('../src/athleteAcademyV1/apa/main.jsx');
  assert.match(apa, /event\.origin!==location\.origin\|\|event\.source!==window\.parent/u);
  assert.match(apa, /contract:'athlete-academy-apa-context',mm,revision:loaded\.state\.revision/u);
  assert.match(apa, /artifact_hash:selected\.artifact\.artifact_sha256/u);
  const css = source('../src/athleteAcademyV1/coach/style.css');
  assert.match(css, /athlete-visual-map-reveal/u);
  assert.match(css, /@media/u);
  assert.doesNotMatch(app, /fetch\([^)]*api\.openai|OPENAI_API_KEY|REDIS_URL/u);
});
