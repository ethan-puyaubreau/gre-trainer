// Parser for Rich text (see types.ts). Shared by the React renderer and by the tests,
// which render every math segment with KaTeX to catch broken TeX before it ships.

export type Segment =
  | { type: 'text'; value: string; bold?: boolean }
  | { type: 'math'; value: string }
  | { type: 'display'; value: string };

export type Block =
  | { type: 'p'; segments: Segment[] }
  | { type: 'display'; tex: string }
  | { type: 'ul'; items: Segment[][] };

/** Split one line of rich text into text / inline math / display math segments. */
export function parseInline(s: string): Segment[] {
  const out: Segment[] = [];
  let text = '';
  let i = 0;
  const flushText = () => {
    if (!text) return;
    // **bold** support in plain text
    const parts = text.split(/(\*\*[^*]+\*\*)/);
    for (const p of parts) {
      if (!p) continue;
      if (p.startsWith('**') && p.endsWith('**') && p.length > 4) out.push({ type: 'text', value: p.slice(2, -2), bold: true });
      else out.push({ type: 'text', value: p });
    }
    text = '';
  };
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '$') {
      text += '$';
      i += 2;
      continue;
    }
    if (c === '$') {
      const display = s[i + 1] === '$';
      const open = display ? 2 : 1;
      const end = findClose(s, i + open, display);
      if (end < 0) throw new Error(`Unbalanced $ in rich text: ${s}`);
      flushText();
      out.push({ type: display ? 'display' : 'math', value: s.slice(i + open, end) });
      i = end + open;
      continue;
    }
    text += c;
    i++;
  }
  flushText();
  return out;
}

function findClose(s: string, from: number, display: boolean): number {
  for (let j = from; j < s.length; j++) {
    if (s[j] === '\\') {
      j++; // skip escaped char (including \$ inside math)
      continue;
    }
    if (s[j] === '$') {
      if (!display) return j;
      if (s[j + 1] === '$') return j;
    }
  }
  return -1;
}

/** Split rich text into paragraphs, display-math blocks and bullet lists. */
export function parseRich(s: string): Block[] {
  const blocks: Block[] = [];
  for (const para of s.split(/\n\s*\n/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const lines = trimmed.split('\n');
    if (lines.every((l) => /^\s*- /.test(l))) {
      blocks.push({ type: 'ul', items: lines.map((l) => parseInline(l.replace(/^\s*- /, ''))) });
      continue;
    }
    if (/^\$\$[\s\S]*\$\$$/.test(trimmed) && findClose(trimmed, 2, true) === trimmed.length - 2) {
      blocks.push({ type: 'display', tex: trimmed.slice(2, -2) });
      continue;
    }
    // Mixed paragraph: bullets after an intro line are allowed.
    const firstBullet = lines.findIndex((l) => /^\s*- /.test(l));
    if (firstBullet > 0 && lines.slice(firstBullet).every((l) => /^\s*- /.test(l))) {
      blocks.push({ type: 'p', segments: parseInline(lines.slice(0, firstBullet).join(' ')) });
      blocks.push({ type: 'ul', items: lines.slice(firstBullet).map((l) => parseInline(l.replace(/^\s*- /, ''))) });
      continue;
    }
    blocks.push({ type: 'p', segments: parseInline(lines.join(' ')) });
  }
  return blocks;
}

/** Every TeX string contained in a rich text (for validation). */
export function mathOf(s: string): string[] {
  const out: string[] = [];
  for (const b of parseRich(s)) {
    if (b.type === 'display') out.push(b.tex);
    const segs = b.type === 'p' ? b.segments : b.type === 'ul' ? b.items.flat() : [];
    for (const seg of segs) if (seg.type !== 'text') out.push(seg.value);
  }
  return out;
}
