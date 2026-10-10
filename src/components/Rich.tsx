import katex from 'katex';
import { memo, type ReactNode } from 'react';
import { parseInline, parseRich, type Segment } from '../engine/rich';

const cache = new Map<string, string>();

function renderTex(tex: string, display: boolean): string {
  const key = (display ? 'D' : 'I') + tex;
  let html = cache.get(key);
  if (html === undefined) {
    html = katex.renderToString(tex, { throwOnError: false, displayMode: display, strict: 'ignore' });
    if (cache.size > 4000) cache.clear();
    cache.set(key, html);
  }
  return html;
}

function Segments({ segs }: { segs: Segment[] }) {
  return (
    <>
      {segs.map((s, i) => {
        if (s.type === 'text') return s.bold ? <strong key={i}>{s.value}</strong> : <span key={i}>{s.value}</span>;
        return (
          <span
            key={i}
            className={s.type === 'display' ? 'display' : undefined}
            dangerouslySetInnerHTML={{ __html: renderTex(s.value, s.type === 'display') }}
          />
        );
      })}
    </>
  );
}

/** Rich text block: paragraphs, display math, bullet lists. */
export const Rich = memo(function Rich({ text, className }: { text: string | undefined; className?: string }) {
  if (!text) return null;
  const blocks = parseRich(text);
  const out: ReactNode[] = blocks.map((b, i) => {
    if (b.type === 'display')
      return <div key={i} className="display" dangerouslySetInnerHTML={{ __html: renderTex(b.tex, true) }} />;
    if (b.type === 'ul')
      return (
        <ul key={i}>
          {b.items.map((it, j) => (
            <li key={j}>
              <Segments segs={it} />
            </li>
          ))}
        </ul>
      );
    return (
      <p key={i}>
        <Segments segs={b.segments} />
      </p>
    );
  });
  return <div className={`rich ${className ?? ''}`}>{out}</div>;
});

/** Single-line rich text without paragraph wrapper (choices, quantities, labels). */
export const RichInline = memo(function RichInline({ text }: { text: string | undefined }) {
  if (!text) return null;
  return <Segments segs={parseInline(text)} />;
});
