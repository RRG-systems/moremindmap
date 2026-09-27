// Pure parser/JSX structure checks only: no SSR, native runtime or provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { athleteTextBlocks, athleteTextSegments } from '../src/athleteConsultingV2/athleteText.js';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
function nodes(root, predicate) {
  const found = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (predicate(value)) found.push(value);
    for (const child of Object.values(value)) if (Array.isArray(child)) child.forEach(visit); else visit(child);
  }
  visit(root); return found;
}
const tree = file => parse(read(file), { sourceType: 'module', plugins: ['jsx'] });
const elements = (root, name) => nodes(root, n => n.type === 'JSXElement' && n.openingElement.name.name === name);
const attribute = (node, name) => node.openingElement.attributes.find(n => n.type === 'JSXAttribute' && n.name.name === name);

test('closing checklist keeps paragraphs, single-line breaks, bullets, bold and ordered numbers visible', () => {
  const raw = '**Before you go**\nYour saved map is reviewed.\n\n• **Keep:** one chosen cue\n• Check whether it helps\n  No result is assumed.\n\n3. Review on October 5\n5. Decide what still fits';
  const blocks = athleteTextBlocks(raw);
  assert.deepEqual(blocks, [
    { kind: 'paragraph', lines: ['**Before you go**', 'Your saved map is reviewed.'] },
    { kind: 'unordered', items: [{ lines: ['**Keep:** one chosen cue'] },
      { lines: ['Check whether it helps', 'No result is assumed.'] }] },
    { kind: 'ordered', items: [{ lines: ['Review on October 5'], number: 3 },
      { lines: ['Decide what still fits'], number: 5 }] },
  ]);
  assert.deepEqual(athleteTextSegments(blocks[1].items[0].lines[0]), [
    { kind: 'strong', text: 'Keep:' }, { kind: 'text', text: ' one chosen cue' } ]);
  assert.equal(raw.includes('**Keep:**'), true, 'saved text remains untouched');
});
test('no paragraph or list content is silently dropped by normal blank-line and newline conventions', () => {
  assert.deepEqual(athleteTextBlocks('First\r\nSecond\rThird'), [{ kind: 'paragraph', lines: ['First', 'Second', 'Third'] }]);
  assert.deepEqual(athleteTextBlocks('• first\n\n• second'), [
    { kind: 'unordered', items: [{ lines: ['first'] }] }, { kind: 'unordered', items: [{ lines: ['second'] }] } ]);
  assert.deepEqual(athleteTextBlocks(null), []);
  assert.deepEqual(athleteTextBlocks('Not - a list\n2x is not a number'), [
    { kind: 'paragraph', lines: ['Not - a list', '2x is not a number'] } ]);
});
test('unsafe-looking HTML, links, unmatched bold and code remain ordinary escaped text segments', () => {
  for (const text of ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>',
    '[open](javascript:alert(1))', '**unfinished', '****', '`<iframe>`']) {
    assert.deepEqual(athleteTextSegments(text), [{ kind: 'text', text }]);
    assert.deepEqual(athleteTextBlocks(text), [{ kind: 'paragraph', lines: [text] }]);
  }
  assert.deepEqual(athleteTextSegments('**<svg onload=alert(1)>**'), [{ kind: 'strong', text: '<svg onload=alert(1)>' }]);
});
test('shared closing formatter uses only React text children with native list semantics and no HTML interpreter', () => {
  const file = 'src/athleteConsultingV2/AthleteText.jsx', root = tree(file), source = read(file);
  for (const name of ['p', 'br', 'ul', 'ol', 'li', 'strong']) assert(elements(root, name).length > 0);
  assert.equal(elements(root, 'a').length, 0); assert.equal(elements(root, 'img').length, 0);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML|document\.|eval\(|DOMParser|markdown-it|marked/u);
  assert.match(source, /\{segment\.text\}/u);
  assert.match(source, /value: item\.number/u, 'original ordered labels are not renumbered');
});
test('both closing destinations share the formatter without changing ordinary conversation rendering', () => {
  const demo = read('src/athleteConsultingV2/App.jsx'), main = read('src/athleteAcademyV1/coach/ClosingReview.jsx');
  assert.match(demo, /<AthleteText value=\{s\.closing\.summary\}/u);
  assert.match(main, /<AthleteText value=\{state\.closing\.summary\}/u);
  assert.match(demo, /<Text value=\{m\.text\}/u);
  assert.match(read('src/athleteAcademyV1/coach/App.jsx'), /function Text\(/u);
});
test('recap formatting is limited to server-owned SESSION_RECAP and exact full comparisons stay available', () => {
  const file = 'src/athleteConsultingV2/AthleteVisual.jsx', source = read(file), root = tree(file);
  assert.match(source, /value\.kind === 'SESSION_RECAP'/u);
  assert.match(source, /<AthleteText value=\{value\.statement\}/u);
  const details = elements(root, 'details').find(node => attribute(node, 'className')?.value?.value === 'athlete-visual-change-details');
  assert(details); assert.equal(attribute(details, 'open'), undefined);
  const content = source.slice(details.start, details.end);
  assert.match(content, /Review all saved changes/u);
  assert.match(content, /details\.map/u);
  assert.match(content, /detail\.before.*detail\.before_lines/su);
  assert.match(content, /detail\.now.*detail\.now_lines/su);
  assert.match(content, /Same wording, reviewed evidence/u);
  assert.match(content, /Recorded athlete review/u);
  assert.equal(elements(details, 'article').length, 1);
  assert.equal(nodes(details, node => node.type === 'JSXExpressionContainer'
    && node.expression.type === 'MemberExpression' && node.expression.object.name === 'detail'
    && node.expression.property.name === 'path').length, 0, 'path is never rendered as visible text');
  assert.doesNotMatch(content, /slice\(|dangerouslySetInnerHTML|hidden=|aria-hidden=/u);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML|eval\(|DOMParser/u);
});
