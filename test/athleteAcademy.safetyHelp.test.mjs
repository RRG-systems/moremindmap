import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse } from '@babel/parser';
import { createServer } from './helpers/inMemoryRenderCompiler.mjs';

const compiler = await createServer();
const { default: SafetyHelp } = await compiler.ssrLoadModule('/src/athleteAcademyV1/SafetyHelp.jsx');
await compiler.close();
const html = renderToStaticMarkup(React.createElement(SafetyHelp));

test('emergency and crisis links render without account, guardian, model or storage inputs', () => {
  assert.match(html, /href="tel:911"/);
  assert.match(html, /href="tel:988"/);
  assert.match(html, /Do not wait for sign-in, guardian approval/);
  assert.match(html, /your current location/);
});

test('adopted contact and coverage render without a 24-hour monitoring or receipt claim', () => {
  assert.match(html, /href="tel:\+19517416964"/);
  assert.match(html, /href="mailto:darren@moremindmap\.com"/);
  assert.match(html, /Monday–Friday/);
  assert.match(html, /9 a\.m\.–5 p\.m\. Pacific/);
  assert.match(html, /does not provide continuous or emergency monitoring/);
  assert.match(html, /does not submit or store a safety report/);
});

test('implicated-contact guidance preserves external help without inventing a backup', () => {
  assert.match(html, /guardian or coach is involved/);
  assert.match(html, /Darren is involved or cannot be reached/);
  assert.match(html, /do not wait for him/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /backup contact|24-hour|help is on the way|report received/);
});

test('help is informational only and preserves private records and participation authority', async () => {
  assert.doesNotMatch(html, /<form|<input|<textarea|<script/);
  assert.match(html, /does not automatically change your BOS, APA, plan or participation status/);
  assert.match(html, /does not give them access to your private conversation/);
  const source = await readFile(new URL('../src/athleteAcademyV1/SafetyHelp.jsx', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const executableCalls = [], forbiddenMembers = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression') executableCalls.push(node);
    if (node.type === 'MemberExpression' &&
      ['localStorage', 'sessionStorage', 'navigator', 'location'].includes(node.object?.name)) forbiddenMembers.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'start', 'end', 'comments', 'tokens'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast);
  assert.equal(executableCalls.length, 0, 'informational component has no calls, hooks or transport');
  assert.equal(forbiddenMembers.length, 0, 'no browser persistence or private location access');
});

test('public help route precedes bootstrap and guardian gates; existing staff gate remains capability-bound', async () => {
  const source = await readFile(new URL('../src/athleteAcademyV1/App.jsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf("if(page==='safety')content=<SafetyHelp/>") < source.indexOf('else if(!session)'));
  assert.ok(source.indexOf("if(page==='safety')content=<SafetyHelp/>") < source.indexOf("else if(session.account?.role==='guardian'"));
  assert.match(source, /<nav><a href="#safety">Safety help<\/a>/);
  assert.match(source, /session\.account&&session\.capabilities\.youthApprovalRegister\?<YouthApprovalRegisterPanel key=\{session\.account\.id\}/);
});

test('real App renders the public safety route before a session exists, with zero requests', async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const previousFetch = globalThis.fetch;
  let requests = 0;
  Object.defineProperty(globalThis, 'location', { configurable: true,
    value: { hash: '#safety', pathname: '/athlete/workspace/index.html' } });
  globalThis.fetch = () => { requests++; throw Error('OFFLINE_NETWORK_DENIED'); };
  const appCompiler = await createServer();
  try {
    const { default: App } = await appCompiler.ssrLoadModule('/src/athleteAcademyV1/App.jsx');
    const rendered = renderToStaticMarkup(React.createElement(App));
    assert.match(rendered, /Your safety comes first/);
    assert.match(rendered, /href="tel:911"/);
    assert.doesNotMatch(rendered, /Opening MORE Athlete/);
    assert.equal(requests, 0);
  } finally {
    await appCompiler.close();
    globalThis.fetch = previousFetch;
    if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation);
    else delete globalThis.location;
  }
});
