import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../src/content';
import { generateQuestion } from '../src/engine/generate';
import { exportProgress, isProgressData, useProgress, type ProgressData } from '../src/store/progress';
import { CHUNK, Collector, decodeProfile, encodeProfile, parseFrame, toFrames } from '../src/transfer/codec';

function fill(n: number): ProgressData {
  useProgress.getState().reset();
  const st = useProgress.getState();
  for (let i = 0; i < n; i++) {
    const t = TEMPLATES[(i * 13) % TEMPLATES.length];
    const q = generateQuestion(t, ((i * 7) % 500) + 1, ((i % 3) + 1) as 1 | 2 | 3);
    st.recordAttempt({
      question: q,
      correct: i % 3 !== 0,
      timeMs: 30000 + ((i * 7919) % 90000),
      hintLevel: i % 11 === 0 ? 1 : 0,
      traps: i % 3 ? [] : [`trap-${i % 17}`],
      mode: i % 5 === 0 ? 'section' : 'practice',
      response: i % 2 ? { format: 'mcs', choice: i % 5 } : { format: 'ne', value: String(i) },
    });
  }
  return JSON.parse(exportProgress());
}

describe('profile transfer codec', () => {
  it('round-trips a full profile exactly', async () => {
    const data = fill(600);
    data.history[3] = { ...data.history[3], qid: 'legacy-id' };
    data.history[4] = { ...data.history[4], skillId: 'other.skill' };
    delete data.history[5].response;
    const back = await decodeProfile(await encodeProfile(data));
    expect(back).toEqual(data);
    expect(isProgressData(back)).toBe(true);
  });

  it('keeps a full 4000-answer history within a reasonable number of frames', async () => {
    const data = fill(4000);
    const payload = await encodeProfile(data);
    const frames = Math.ceil(payload.length / CHUNK);
    console.log(`4000 answers: ${JSON.stringify(data).length} B json -> ${payload.length} chars -> ${frames} frames`);
    expect(frames).toBeLessThan(80);
  });

  it('cuts into frame links and reassembles in any order, ignoring repeats', async () => {
    const payload = await encodeProfile(fill(300));
    const frames = toFrames(payload, 'https://x.github.io/gre-trainer/', 'ab12');
    expect(frames[0].startsWith('https://x.github.io/gre-trainer/#/receive/ab12.1.')).toBe(true);
    const c = new Collector();
    for (const f of [...frames].reverse()) expect(c.add(parseFrame(f)!)).toBe(true);
    expect(c.add(parseFrame(frames[0])!)).toBe(false);
    expect(c.done).toBe(true);
    expect(c.payload()).toBe(payload);
  });

  it('starts over on a frame of another transfer and rejects junk', () => {
    const c = new Collector();
    c.add(parseFrame('https://a/#/receive/aaaa.1.3.xyz')!);
    c.add(parseFrame('https://a/#/receive/bbbb.2.2.uvw')!);
    expect(c.id).toBe('bbbb');
    expect(c.parts.size).toBe(1);
    expect(parseFrame('https://example.com')).toBeNull();
    expect(parseFrame('https://a/#/receive/aaaa.4.3.xyz')).toBeNull();
  });

  it('rejects a payload that is not a profile', async () => {
    await expect(decodeProfile('bm90IGEgcHJvZmlsZQ')).rejects.toThrow();
  });
});
