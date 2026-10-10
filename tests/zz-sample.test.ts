import { it } from 'vitest';
import { TEMPLATES } from '../src/content';
import { generateBody } from '../src/engine/generate';

// Prints sample questions for review. Skipped unless PRINT is set:
//   PRINT=1 ONLY=arith.cycles SEED=3 npx vitest run tests/zz-sample.test.ts
it.skipIf(!process.env.PRINT)('print sample questions', () => {
  const only = process.env.ONLY ?? '';
  for (const t of TEMPLATES.filter((t) => t.id.includes(only))) {
    for (const d of [1, 2, 3] as const) {
      const { q } = generateBody(t, Number(process.env.SEED ?? 3), d);
      console.log(`\n===== ${t.id} d${d}\n` + JSON.stringify(q, null, 1));
    }
  }
});
