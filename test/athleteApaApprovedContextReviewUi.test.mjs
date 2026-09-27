// Pure/static private UI proof. No SSR, Vite, native worker, browser or listener.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const reviewSource = read('src/athleteConsultingV2/ApaNarrativeChanges.jsx');
const helperSource = reviewSource.slice(0, reviewSource.indexOf('const Value ='))
  .replace("import React from 'react';", '')
  + '\nexport { selectApaNarrativeChanges, apaNarrativeChangePresentation };\n';
const helpers = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`);
const files = ['src/athleteConsultingV2/approved-apa/ReportPage.jsx', 'src/athleteAcademyV1/apa/ReportPage.jsx'];
const AST = source => parse(source, { sourceType: 'module', plugins: ['jsx'] });
function nodes(root, predicate) {
  const result = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (predicate(value)) result.push(value);
    for (const entry of Object.values(value)) if (Array.isArray(entry)) entry.forEach(visit); else visit(entry);
  }
  visit(root); return result;
}
const elements = (root, name) => nodes(root, item => item.type === 'JSXElement'
  && item.openingElement.name.type === 'JSXIdentifier' && item.openingElement.name.name === name);
const exactSource = (source, node) => source.slice(node.start, node.end);
const attribute = (node, name) => node.openingElement.attributes.find(item => item.type === 'JSXAttribute' && item.name.name === name);
const fieldList = ['headline', 'opening', 'connection', 'main_obstacle', 'what_we_dont_know',
  'confirmation.priority', 'confirmation.review_date', 'confirmation.horizon_date'];
function change(field) {
  const before = field === 'what_we_dont_know' ? ['Whether the draft is finished.']
    : field.endsWith('_date') ? '2026-10-04' : `Earlier exact ${field} words`;
  const after = field === 'what_we_dont_know' ? ['Whether Friday practice timing fits.', 'Whether the cue helps.']
    : field.endsWith('_date') ? '2026-10-05' : `Reviewed exact ${field} words`;
  return { field, path: field.startsWith('confirmation.') ? field : `report.${field}`, before, after,
    value_changed: true, reference_changed: true, before_refs: null,
    after_refs: ['APA:CURRENT:11111111-1111-4111-8111-111111111111'], version: 1 };
}

test('default-closed native disclosure keeps every exact before/after article and evidence inside it', () => {
  const tree = AST(reviewSource), disclosures = elements(tree, 'details');
  assert.equal(disclosures.length, 1);
  const disclosure = disclosures[0];
  assert.equal(attribute(disclosure, 'open'), undefined, 'never expand eight comparisons on initial reading');
  const summaries = elements(disclosure, 'summary'); assert.equal(summaries.length, 1);
  assert.match(exactSource(reviewSource, summaries[0]), /Review what changed/u);
  assert.doesNotMatch(exactSource(reviewSource, summaries[0]), /onClick|role=|tabIndex=/u,
    'native details/summary keeps browser keyboard and expanded-state semantics');
  const articles = elements(tree, 'article'); assert.equal(articles.length, 1);
  assert(elements(disclosure, 'article').includes(articles[0]), 'mapped comparison articles remain inside the disclosure');
  const article = exactSource(reviewSource, articles[0]);
  for (const receiptValue of ['change.before', 'change.after', 'copy.beforeEvidence', 'copy.afterEvidence'])
    assert(article.includes(receiptValue), `exact ${receiptValue} remains available`);
  assert.match(article, /change\.value_changed/u); assert.match(article, /copy\.unchangedText/u);
  assert.equal(elements(disclosure, 'article').length, elements(tree, 'article').length);
});

test('compact visible boundary distinguishes unpublished proposal, earlier review, saved reading and accepted plan', () => {
  const section = elements(AST(reviewSource), 'section')[0];
  const details = elements(section, 'details')[0];
  const visible = reviewSource.slice(section.start, details.start);
  for (const text of ['PROPOSED WHOLE-PICTURE UPDATE · NOT SAVED', 'EARLIER WHOLE-PICTURE UPDATE · REVIEW NEEDED',
    'SAVED WHOLE-PICTURE UPDATE', 'Your current reading and accepted plan are unchanged.',
    'Earlier APA changes await review. Your accepted plan remains separate.',
    'Reviewed APA changes. Your accepted plan remains separate.']) assert(visible.includes(text));
  assert.doesNotMatch(visible, /field-level|source reference|changes\.map|<article/u);
});

test('all eight existing typed receipt fields preserve exact values, arrays and evidence without mutation', () => {
  const receipt = { narrative_changes: fieldList.map(change) }, before = structuredClone(receipt);
  const selected = helpers.selectApaNarrativeChanges(receipt);
  assert.deepEqual(selected.map(item => item.field), fieldList);
  assert.deepEqual(receipt, before);
  selected.forEach((item, index) => {
    assert.equal(item, receipt.narrative_changes[index]);
    assert.deepEqual(item.before, before.narrative_changes[index].before);
    assert.deepEqual(item.after, before.narrative_changes[index].after);
    assert.deepEqual(item.after_refs, before.narrative_changes[index].after_refs);
    const proposed = helpers.apaNarrativeChangePresentation(item, { proposed: true });
    assert.equal(proposed.afterHeading, 'Proposed · not saved');
    assert.match(proposed.beforeEvidence, /No earlier citation has been invented/u);
    assert.match(proposed.afterEvidence, /Proposed evidence: 1 source reference.*version 1/u);
    assert.equal(helpers.apaNarrativeChangePresentation(item).afterHeading, 'Published value');
  });
  assert(Array.isArray(selected[4].after));
  const reconfirmed = { ...change('opening'), value_changed: false, before_refs: ['original-source'] };
  const copy = helpers.apaNarrativeChangePresentation(reconfirmed);
  assert.match(copy.unchangedText, /value is unchanged.*reviewed again/u);
  assert.match(copy.beforeEvidence, /Before: 1 field-level source reference/u);
  assert.deepEqual(helpers.selectApaNarrativeChanges({ narrative_changes: [
    { ...change('opening'), after: ['Wrong type'] }, { ...change('opening'), path: 'confirmation.priority' },
    { ...change('opening'), field: 'unsupported' } ] }), []);
});

for (const file of files) test(`${file}: original coach assessment date is honest and unrelated to later timing`, async () => {
  const source = read(file), start = source.indexOf('function originalCoachPerspectiveScope('), end = source.indexOf('const Action=');
  assert(start >= 0 && end > start);
  const design = new URL(`../${file.slice(0, file.lastIndexOf('/'))}/design.js`, import.meta.url).href;
  const pure = `import { dateLabel } from ${JSON.stringify(design)};\n${source.slice(start, end)}\nexport { originalCoachPerspectiveScope };`;
  const { originalCoachPerspectiveScope } = await import(`data:text/javascript;base64,${Buffer.from(pure).toString('base64')}`);
  const original = { confirmation: { assessment_date: '2026-09-01', review_date: '2026-09-08', horizon_date: '2026-10-01' },
    report: { coach_view: { summary: 'An original observation before the Thursday game.' } } };
  const changed = structuredClone(original); changed.confirmation.review_date = '2026-10-05'; changed.confirmation.horizon_date = '2026-12-03';
  const before = structuredClone(changed), oldScope = originalCoachPerspectiveScope(original), scope = originalCoachPerspectiveScope(changed);
  assert.deepEqual(scope, oldScope); assert.deepEqual(changed, before);
  assert.match(scope.label, /Original assessment · September 1 · 2026-09-01/u);
  assert.match(scope.note, /not a current observed fact/u);
  assert.match(scope.note, /Later athlete updates do not rewrite this coach perspective/u);
  for (const value of [undefined, 'bad', '2026-02-29', '2026-09-31', '2026-09-01T00:00:00Z'])
    assert.equal(originalCoachPerspectiveScope({ confirmation: { assessment_date: value } }).label,
      'Original assessment · date unavailable');
  const coach = elements(AST(source), 'section').find(item => attribute(item, 'aria-label')?.value?.value === 'Coach perspective from the original assessment');
  assert(coach); const content = exactSource(source, coach);
  assert.match(content, /Coach perspective from the original assessment/u);
  assert.match(content, /\{coachScope\.label\}/u); assert.match(content, /\{coachScope\.note\}/u);
  assert.match(content, /<p>\{r\.coach_view\.summary\}<\/p>/u, 'coach source text remains unchanged');
  assert.doesNotMatch(source, /<h2>Your coach’s perspective<\/h2>/u);
});

test('repair keeps exact goal lineage, current/proposal scope and independently accepted plan controls', () => {
  for (const file of files) {
    const source = read(file);
    assert.match(source, /confirmationReadingScope\(a,\{version,showOriginal,showPreview,needsReview,stale\}\)/u);
    assert.match(source, /<h2>\{x\.goal\}<\/h2>/u);
    assert.match(source, /<p>\{a\.confirmation\.goals\[d\.id\]\}<\/p>/u);
    assert.doesNotMatch(source, /Original goals|Original assessment goals|goals from the original assessment/iu);
    assert.match(source, /AGREED · YOUR CURRENT PLAN/u);
    assert.match(source, /PROPOSED APA SUGGESTION · NOT CURRENT/u);
    assert.match(source, /This agreement was accepted separately from the APA One Move suggestion/u);
    assert.match(source, /historical=\{needsReview\|\|stale\}/u);
  }
  // The same compact disclosure is consumed by the full approved reader as
  // well as Box 5; no entry-point, transport, state or final-map change needed.
  assert.match(read('src/athleteConsultingV2/approved-apa/main.jsx'), /<ApaNarrativeChanges receipt=\{reading\.receipt\}/u);
});
