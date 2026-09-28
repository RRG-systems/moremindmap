// Presentation-only, bounded block syntax for saved/model conversation text.
// The original text is never rewritten, interpreted as HTML, or persisted here.
const FENCE = /^ {0,3}(`{3,}|~{3,})[^\n]*$/u;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.+)$/u;
const BULLET = /^\s*[-*•][ \t]+(.+)$/u;
const NUMBER = /^\s*(\d{1,3})[.)][ \t]+(.+)$/u;
const SEPARATOR = /^:?-{3,}:?$/u;

function tableCells(line) {
  const source = line.trim();
  if (!source.includes('|')) return null;
  const content = source.replace(/^\|/u, '').replace(/\|$/u, '');
  const cells = [];
  let cell = '';
  for (let index = 0; index < content.length; index++) {
    if (content[index] === '\\' && content[index + 1] === '|') {
      cell += '|'; index++;
    } else if (content[index] === '|') {
      cells.push(cell.trim()); cell = '';
    } else {
      cell += content[index];
    }
  }
  cells.push(cell.trim());
  return cells.length >= 2 ? cells : null;
}

function tableAt(lines, index) {
  const header = tableCells(lines[index]);
  const separator = tableCells(lines[index + 1] ?? '');
  if (!header || !separator || header.length !== separator.length
    || !separator.every(cell => SEPARATOR.test(cell))) return null;
  const rows = [];
  let next = index + 2;
  while (next < lines.length && lines[next].trim()) {
    const cells = tableCells(lines[next]);
    if (!cells || cells.length !== header.length) break;
    rows.push(cells); next++;
  }
  return { block: { kind: 'table', header, rows }, next };
}

function fenceAt(lines, index) {
  const opening = lines[index].match(FENCE);
  if (!opening) return null;
  const marker = opening[1][0], width = opening[1].length;
  let next = index + 1;
  while (next < lines.length) {
    const closing = lines[next].match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/u);
    if (closing && closing[1][0] === marker && closing[1].length >= width) break;
    next++;
  }
  // An unfinished fence remains visible rather than silently dropping its marker.
  if (next === lines.length) return {
    block: { kind: 'code', text: lines.slice(index).join('\n'), complete: false }, next,
  };
  return { block: { kind: 'code', text: lines.slice(index + 1, next).join('\n'), complete: true }, next: next + 1 };
}

function listAt(lines, index) {
  const firstNumber = lines[index].match(NUMBER);
  const firstBullet = firstNumber ? null : lines[index].match(BULLET);
  if (!firstNumber && !firstBullet) return null;
  const kind = firstNumber ? 'ordered' : 'unordered', items = [];
  let next = index;
  while (next < lines.length) {
    const numbered = lines[next].match(NUMBER), bullet = numbered ? null : lines[next].match(BULLET);
    if ((kind === 'ordered' && !numbered) || (kind === 'unordered' && !bullet)) break;
    items.push({ lines: [numbered ? numbered[2] : bullet[1]],
      ...(numbered ? { number: Number(numbered[1]) } : {}) });
    next++;
    while (next < lines.length && /^\s{2,}\S/u.test(lines[next])
      && !NUMBER.test(lines[next]) && !BULLET.test(lines[next])) {
      items.at(-1).lines.push(lines[next].trim()); next++;
    }
  }
  return { block: { kind, items }, next };
}

function structuralAt(lines, index) {
  return fenceAt(lines, index) || (HEADING.test(lines[index])
    ? { block: { kind: 'heading', level: lines[index].match(HEADING)[1].length,
      text: lines[index].match(HEADING)[2].trim() }, next: index + 1 }
    : null) || tableAt(lines, index) || listAt(lines, index);
}

export function athleteChatTextBlocks(value) {
  const lines = String(value ?? '').replace(/\r\n?/gu, '\n').split('\n'), blocks = [];
  for (let index = 0; index < lines.length;) {
    if (!lines[index].trim()) { index++; continue; }
    const structural = structuralAt(lines, index);
    if (structural) { blocks.push(structural.block); index = structural.next; continue; }
    const paragraph = [];
    while (index < lines.length && lines[index].trim()
      && (paragraph.length === 0 || !structuralAt(lines, index))) {
      paragraph.push(lines[index]); index++;
    }
    blocks.push({ kind: 'paragraph', lines: paragraph });
  }
  return blocks;
}
