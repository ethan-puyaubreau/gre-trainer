import type { Choice } from '../../../engine/types';

/** First trap of `order` that survived as a wrong choice (the explanation may only cite those). */
export function firstTrap(choices: Choice[], order: string[]): string {
  const present = new Set(choices.map((c) => c.trap));
  return order.find((id) => present.has(id)) ?? order[0];
}

/** Value shown by a numeric choice text such as "$-\frac{3}{2}$" or "$1{,}200$". */
export function choiceFrac(text: string): { n: number; d: number } {
  const s = text.replace(/^\$|\$$/g, '').replace(/\{,\}/g, '');
  const m = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(s);
  return m ? { n: Number(m[2]) * (m[1] ? -1 : 1), d: Number(m[3]) } : { n: Number(s), d: 1 };
}
