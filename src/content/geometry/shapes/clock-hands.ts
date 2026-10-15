import { Frac } from '../../../engine/frac';
import { clock, decimal, num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { Redraw, retryAll } from '../redraw';

/* The angle between the hands of a clock: the hour hand creeps while the minute hand runs (NE). */

export const clockHandsTraps: Record<string, Trap> = {
  'geo-clk-hour-fixed': {
    label: 'Put the hour hand exactly on the hour number',
    fix: 'The hour hand moves all the time: it covers $30^\\circ$ per hour, so $0.5^\\circ$ per minute. At 7:20 it is a third of the way from 7 to 8, not on the 7.',
  },
  'geo-clk-other-angle': {
    label: 'Gave the other of the two angles the hands form',
    fix: 'Two hands make two angles that add up to $360^\\circ$. Read whether the question asks for the smaller or the larger one, then take $360^\\circ$ minus the difference if needed.',
  },
  'geo-clk-hour-back': {
    label: 'Moved the hour hand the wrong way',
    fix: 'After the hour, the hour hand is AHEAD of the number: its position is $30h + 0.5m$ degrees, not $30h - 0.5m$.',
  },
};

interface P {
  h: number;
  m: number;
  larger: boolean;
}

const dec = (f: Frac) => (f.isInt() ? num(f.n) : decimal(f));
const small2 = (diff2: number) => {
  const d = ((diff2 % 720) + 720) % 720;
  return Math.min(d, 720 - d);
};

const clockHands: Template<P> = {
  id: 'geo.lines-angles.clock-hands-ne',
  skill: 'geo.lines-angles',
  format: 'ne',
  style: 'angle between the hour hand and the minute hand of a clock',
  generate(rng, d) {
    const h = rng.int(1, 12);
    const m = d === 1 ? 10 * rng.int(0, 5) : d === 2 ? 5 + 10 * rng.int(0, 5) : rng.int(1, 59);
    if (d === 3 && (m % 5 === 0 || h === 12)) throw new Redraw('multiple of 5 or 12 o\'clock');
    const larger = d === 3 && rng.chance(0.5);
    const H2 = 60 * (h % 12) + m; // hour hand in half-degrees
    const M2 = 12 * m; // minute hand in half-degrees
    const s2 = small2(H2 - M2);
    if (s2 === 0 || s2 === 360) throw new Redraw('hands overlap or opposite');
    const ans2 = larger ? 720 - s2 : s2;
    const answer = new Frac(ans2, 2);
    const asked = (s: number) => new Frac(larger ? 720 - s : s, 2);
    const traps: { value: Frac; trap: string }[] = [];
    const push = (value: Frac, trap: string) => {
      if (!value.eq(answer) && value.sign() > 0 && !traps.some((t) => t.value.eq(value))) traps.push({ value, trap });
    };
    push(asked(small2(60 * (h % 12) - M2)), 'geo-clk-hour-fixed');
    push(new Frac(larger ? s2 : 720 - s2, 2), 'geo-clk-other-angle');
    push(asked(small2(60 * (h % 12) - m - M2)), 'geo-clk-hour-back');
    const time = clock((h % 12) * 60 + m + (rng.chance(0.5) ? 720 : 0), 'short');
    const word = larger ? 'larger' : 'smaller';
    const stem = rng.chance(0.5)
      ? `A clock shows ${time}${time.endsWith('.') ? '' : '.'} What is the degree measure of the ${word} angle formed by the hour hand and the minute hand?`
      : `At ${time}, the hour hand and the minute hand of an analog clock form two angles. What is the degree measure of the ${word} one?`;
    const Hd = new Frac(H2, 2);
    const Md = new Frac(M2, 2);
    const diff = new Frac(Math.abs(H2 - M2), 2);
    const hourTxt = h % 12 === 0 ? `30 \\times 0 + 0.5 \\times ${m} \\text{ (12 counts as 0)}` : `30 \\times ${h} + 0.5 \\times ${m}`;
    const gap = diff.gt(180)
      ? `their difference is $${dec(diff)}^\\circ$, more than a half turn, so the smaller angle is $360 - ${dec(diff)} = ${dec(new Frac(s2, 2))}^\\circ$`
      : `their difference is $${dec(diff)}^\\circ$, at most a half turn, so it is the smaller angle`;
    const fixed = traps.find((t) => t.trap === 'geo-clk-hour-fixed');
    const explanation = `Recognize: both hands move all the time, so the hour hand is not on the number when the minutes are not zero.

The minute hand turns $6^\\circ$ per minute, the hour hand $30^\\circ$ per hour, which is $0.5^\\circ$ per minute. At ${time}, the hour hand is at $${hourTxt} = ${dec(Hd)}^\\circ$ from 12 and the minute hand at $6 \\times ${m} = ${dec(Md)}^\\circ$, so ${gap}.${larger ? ` The larger angle is $360 - ${dec(new Frac(s2, 2))} = ${dec(answer)}^\\circ$.` : ''}

Check: the two angles add up to $360^\\circ$: $${dec(new Frac(s2, 2))} + ${dec(new Frac(720 - s2, 2))} = 360$.
${fixed ? `\nTrap: $${dec(fixed.value)}^\\circ$ puts the hour hand exactly on the ${h} and ignores its $${dec(new Frac(m, 2))}^\\circ$ of travel.` : ''}

Rule: hour hand $30h + 0.5m$, minute hand $6m$, then pick the angle asked.`;
    return {
      params: { h, m, larger },
      q: { format: 'ne', stem, answer, suffix: 'degrees', traps, explanation },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'format';
    // run the clock minute by minute from 12:00 in half-degrees
    let hour2 = 0;
    let min2 = 0;
    for (let t = 0; t < 60 * (p.h % 12) + p.m; t++) {
      hour2 += 1;
      min2 = (min2 + 12) % 720;
    }
    const d = Math.abs(hour2 - min2);
    const small = Math.min(d, 720 - d);
    const exp = new Frac(p.larger ? 720 - small : small, 2);
    return q.answer.eq(exp) ? null : `expected ${exp.toString()}`;
  },
};

export const clockHandsTemplates = retryAll([clockHands]);
