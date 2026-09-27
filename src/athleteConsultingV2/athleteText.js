// Presentation only. Saved/model text is never rewritten or interpreted as HTML.
export function athleteTextSegments(value) {
  return String(value ?? '').split(/(\*\*[^*\n]+\*\*)/gu).filter(Boolean)
    .map(text => /^\*\*[^*\n]+\*\*$/u.test(text)
      ? { kind: 'strong', text: text.slice(2, -2) } : { kind: 'text', text });
}

export function athleteTextBlocks(value) {
  const blocks = [];
  let current = null;
  for (const line of String(value ?? '').replace(/\r\n?/gu, '\n').split('\n')) {
    if (!line.trim()) { current = null; continue; }
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/u);
    const numbered = line.match(/^\s*(\d{1,3})[.)]\s+(.+)$/u);
    if (bullet || numbered) {
      const kind = numbered ? 'ordered' : 'unordered';
      if (current?.kind !== kind) { current = { kind, items: [] }; blocks.push(current); }
      current.items.push({ lines: [numbered ? numbered[2] : bullet[1]],
        ...(numbered ? { number: Number(numbered[1]) } : {}) });
    } else if (current?.items && /^\s{2,}\S/u.test(line)) {
      current.items.at(-1).lines.push(line.trim());
    } else {
      if (current?.kind !== 'paragraph') { current = { kind: 'paragraph', lines: [] }; blocks.push(current); }
      current.lines.push(line);
    }
  }
  return blocks;
}
