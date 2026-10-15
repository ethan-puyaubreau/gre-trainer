// Explanations name the wrong choices that are really there, never a mistake whose value is absent.

import type { Choice } from '../../engine/types';

/**
 * "Trap: ... Another trap: ..." for the wrong choices of a question, grouped by trap id. Each note receives the
 * texts of the choices that carry its trap ("$a$ or $b$") and returns a clause without final period.
 * `first` is the trap to name first when it is present.
 */
export function trapNotes(choices: Choice[], notes: Record<string, (values: string) => string>, max = 2, first?: string): string {
  const groups = new Map<string, string[]>();
  for (const c of choices) if (c.trap && notes[c.trap]) groups.set(c.trap, [...(groups.get(c.trap) ?? []), c.text]);
  let ids = [...groups.keys()];
  if (first && ids.includes(first)) ids = [first, ...ids.filter((i) => i !== first)];
  const clauses = ids.slice(0, max).map((id) => notes[id](groups.get(id)!.join(' or ')));
  if (!clauses.length) return '';
  return `Trap: ${clauses[0]}.${clauses[1] ? ` Another trap: ${clauses[1]}.` : ''}`;
}
