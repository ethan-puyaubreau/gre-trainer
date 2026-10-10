// Builds GRE-like timed sections: official sizes, QC first, one data interpretation set.

import { skillById, TEMPLATES } from '../content';
import { generateQuestion, poolSeed } from '../engine/generate';
import type { Rng } from '../engine/rng';
import type { Area, Difficulty, Format, Question, Template } from '../engine/types';

export type Level = 'easy' | 'medium' | 'hard';

export interface SectionSpec {
  questions: number;
  minutes: number;
  /** Format slots, QC first like the official sections. */
  formats: Record<Format, number>;
  /** Size of the data interpretation set that replaces some non-QC slots (the book's 15-question sets end with a 4-item set). */
  setSize?: number;
}

export const SPECS: Record<'s1' | 's2', SectionSpec> = {
  s1: { questions: 12, minutes: 21, formats: { qc: 4, mcs: 5, mcm: 1, ne: 2 }, setSize: 3 },
  s2: { questions: 15, minutes: 26, formats: { qc: 5, mcs: 6, mcm: 2, ne: 2 }, setSize: 4 },
};

/**
 * Content mix of the standalone questions. Across the book's 150 questions the split is about
 * arithmetic 27%, algebra 22%, geometry 16%, data analysis 35%, and most data analysis items come
 * from the data interpretation set, so standalone slots lean away from data analysis.
 */
const AREA_WEIGHTS: Record<Area, number> = { arithmetic: 7, algebra: 6, geometry: 4, data: 3 };

/** Split n slots between areas in proportion to their weights (largest remainder), in random order. */
function areaSlots(rng: Rng, areas: Area[], n: number): Area[] {
  const total = areas.reduce((s, a) => s + AREA_WEIGHTS[a], 0);
  const exact = areas.map((a) => (AREA_WEIGHTS[a] * n) / total);
  const counts = exact.map(Math.floor);
  const order = exact.map((x, i) => [x - Math.floor(x) + rng.next() * 1e-6, i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; counts.reduce((s, c) => s + c, 0) < n; k++) counts[order[k % order.length][1]]++;
  return rng.shuffle(areas.flatMap((a, i) => Array<Area>(counts[i]).fill(a)));
}

/** Which standalone slot each data-set question replaces, in order (keeps at least one of each format). */
const SET_REPLACES: Format[] = ['mcs', 'ne', 'mcs', 'mcm', 'mcs'];

const DIFF_WEIGHTS: Record<Level, [number, number, number]> = {
  easy: [0.45, 0.5, 0.05],
  medium: [0.15, 0.6, 0.25],
  hard: [0.0, 0.4, 0.6],
};

function pickDifficulty(rng: Rng, level: Level): Difficulty {
  const [a, b] = DIFF_WEIGHTS[level];
  const r = rng.next();
  return r < a ? 1 : r < a + b ? 2 : 3;
}

export interface BuiltSection {
  questions: Question[];
  /** Data interpretation sets as [first, last] question indices. */
  sets: [number, number][];
}

export function buildSection(rng: Rng, spec: SectionSpec, level: Level, areas: Area[]): BuiltSection {
  const pool = TEMPLATES.filter((t) => areas.includes(skillById.get(t.skill)!.area));

  // One data interpretation set (2-3 questions on a shared figure) when a family is available.
  const families = new Map<string, Template<any>[]>();
  for (const t of pool) if (t.set) families.set(t.set, [...(families.get(t.set) ?? []), t]);
  const famList = [...families.values()].filter((f) => f.length >= 2);
  let setQuestions: Question[] = [];
  let setFamily: string | undefined;
  if (famList.length) {
    const fam = rng.pick(famList);
    setFamily = fam[0].set;
    const seed = poolSeed();
    const d = pickDifficulty(rng, level);
    setQuestions = rng.sample(fam, Math.min(spec.setSize ?? 3, fam.length)).map((t) => generateQuestion(t, seed, d));
  }

  const usedSkills = new Set<string>();
  const usedTemplates = new Set<string>(setQuestions.map((q) => q.templateId));
  const out: Question[] = [];
  let slots: Format[] = (Object.entries(spec.formats) as [Format, number][]).flatMap(([f, n]) => Array<Format>(n).fill(f));
  // The set replaces standalone non-QC slots.
  for (let k = 0; k < setQuestions.length; k++) {
    let i = slots.lastIndexOf(SET_REPLACES[k % SET_REPLACES.length]);
    if (i < 0) i = slots.map((f) => f !== 'qc').lastIndexOf(true);
    slots = slots.filter((_, j) => j !== i);
  }
  const regularPool = pool.filter((t) => !setFamily || t.set !== setFamily);
  const slotAreas = areaSlots(rng, areas, slots.length);
  slots.forEach((format, i) => {
    const preferredArea = slotAreas[i];
    const candidates = (filter: (t: Template<any>) => boolean) => regularPool.filter((t) => t.format === format && filter(t));
    const tiers = [
      candidates((t) => skillById.get(t.skill)!.area === preferredArea && !usedSkills.has(t.skill)),
      candidates((t) => !usedSkills.has(t.skill)),
      candidates((t) => !usedTemplates.has(t.id)),
      candidates(() => true),
      regularPool.filter((t) => !usedTemplates.has(t.id)),
      regularPool.length ? regularPool : pool,
    ];
    const tier = tiers.find((c) => c.length)!;
    const t = rng.pick(tier);
    usedSkills.add(t.skill);
    usedTemplates.add(t.id);
    out.push(generateQuestion(t, poolSeed(), pickDifficulty(rng, level)));
  });
  // QC first like the official sections, then the other formats, then the data interpretation set.
  const qc = out.filter((q) => q.format === 'qc');
  const rest = rng.shuffle(out.filter((q) => q.format !== 'qc'));
  const questions = [...qc, ...rest, ...setQuestions];
  const sets: [number, number][] = setQuestions.length ? [[questions.length - setQuestions.length, questions.length - 1]] : [];
  return { questions, sets };
}
