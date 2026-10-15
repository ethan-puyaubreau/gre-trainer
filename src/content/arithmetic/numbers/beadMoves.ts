import type { Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { decimal } from '../../../engine/tex';
import type { Difficulty, Template, Trap } from '../../../engine/types';
import { expectNE, F, pickWeighted } from './util';

export const beadMovesTraps: Record<string, Trap> = {
  'nl-net-for-total': {
    label: 'Gave the net change when the question asks for the total distance traveled',
    fix: 'Distance traveled adds the length of every move, whatever its direction. Going 7 right and 7 left is 14 units traveled but ends where it began.',
  },
  'nl-total-for-net': {
    label: 'Gave the total distance traveled when the question asks how far the end is from the start',
    fix: 'How far the bead ends from where it started is the absolute value of the net move: moves in opposite directions cancel.',
  },
  'nl-final-for-extreme': {
    label: 'Looked only at the end point instead of the whole path',
    fix: 'The farthest point reached can be in the middle of the journey. List the position after every move and compare them all.',
  },
  'nl-start-forgotten': {
    label: 'Forgot the starting coordinate',
    fix: 'The final coordinate is the start plus the net move; the net move alone is the distance from the start, not the coordinate.',
  },
};

type Ask = 'total' | 'net' | 'final' | 'farthest-origin' | 'farthest-start';
interface Params {
  start: Frac;
  steps: Frac[]; // signed, + right
  ask: Ask;
}

const who = ['bead', 'beetle', 'robot', 'token'];
const verbs: Record<string, string> = { bead: 'slides', beetle: 'crawls', robot: 'rolls', token: 'is moved' };

function pos(start: Frac, steps: Frac[]): Frac[] {
  const out = [start];
  for (const s of steps) out.push(out[out.length - 1].add(s));
  return out;
}

const beadMoves: Template<Params> = {
  id: 'arith.number-line.bead-moves-ne',
  skill: 'arith.number-line',
  format: 'ne',
  style: 'a point moves right and left along the number line: distance traveled, net change, farthest point',
  generate(rng: Rng, diff: Difficulty) {
    for (;;) {
      const n = diff === 1 ? 3 : diff === 2 ? 4 : rng.pick([4, 5]);
      const half = diff === 3;
      const mag = () => (half ? F(rng.int(2, 40), 2) : F(rng.int(1, diff === 1 ? 9 : 14)));
      const start = F(diff === 1 ? rng.int(0, 5) : rng.int(-9, 9));
      let steps: Frac[] = Array.from({ length: n }, () => mag().mul(rng.sign()));
      if (diff === 1) {
        // make sure there are moves in both directions
        if (steps.every((s) => s.sign() > 0) || steps.every((s) => s.sign() < 0)) continue;
      }
      steps = steps.filter((s) => s.sign() !== 0);
      if (steps.length !== n) continue;
      const ask = pickWeighted<Ask>(
        rng,
        diff === 1 ? [['total', 1], ['net', 1.3], ['final', 1]] : diff === 2 ? [['total', 1.2], ['net', 1], ['final', 1], ['farthest-start', 1]] : [['farthest-origin', 2], ['farthest-start', 1.5], ['total', 1], ['net', 0.7]],
      );
      const path = pos(start, steps);
      const total = steps.reduce((t, s) => t.add(s.abs()), F(0));
      const netSigned = path[path.length - 1].sub(start);
      const net = netSigned.abs();
      const finalPos = path[path.length - 1];
      const farOrigin = path.reduce((m, x) => (x.abs().gt(m) ? x.abs() : m), F(0));
      const farStart = path.reduce((m, x) => (x.sub(start).abs().gt(m) ? x.sub(start).abs() : m), F(0));
      let key: Frac;
      let q: string;
      const trapsAll: { value: Frac; trap: string }[] = [];
      if (ask === 'total') {
        key = total;
        q = 'What is the total distance the bead travels?';
        trapsAll.push({ value: net, trap: 'nl-net-for-total' });
      } else if (ask === 'net') {
        key = net;
        q = 'How far from its starting point is the bead at the end?';
        trapsAll.push({ value: total, trap: 'nl-total-for-net' });
      } else if (ask === 'final') {
        key = finalPos;
        q = 'What is the coordinate of the bead at the end?';
        trapsAll.push({ value: netSigned.abs(), trap: 'nl-start-forgotten' });
      } else if (ask === 'farthest-origin') {
        key = farOrigin;
        q = 'During the trip, what is the greatest distance between the bead and 0?';
        trapsAll.push({ value: finalPos.abs(), trap: 'nl-final-for-extreme' }, { value: start.abs(), trap: 'nl-final-for-extreme' });
      } else {
        key = farStart;
        q = 'During the trip, what is the greatest distance between the bead and its starting point?';
        trapsAll.push({ value: net, trap: 'nl-final-for-extreme' });
      }
      if (key.sign() <= 0 || (ask === 'final' && key.sign() < 0)) continue;
      const traps = trapsAll.filter((t, i, a) => !t.value.eq(key) && t.value.sign() > 0 && a.findIndex((u) => u.value.eq(t.value)) === i);
      if (!traps.length) continue;
      const w = rng.pick(who);
      const t = (x: Frac) => `$${x.sign() < 0 ? '-' : ''}${decimal(x.abs())}$`;
      const moveText = steps.map((s) => `${decimal(s.abs())} ${s.abs().eq(1) ? 'unit' : 'units'} to the ${s.sign() > 0 ? 'right' : 'left'}`);
      const joined = moveText.length === 3 ? `${moveText[0]}, then ${moveText[1]}, and finally ${moveText[2]}` : `${moveText.slice(0, -1).join(', then ')}, and finally ${moveText[moveText.length - 1]}`;
      const stem = `A ${w} starts at the point with coordinate ${t(start)} on a number line. It ${verbs[w]} ${joined}. ${q.replace('the bead', `the ${w}`).replace('its', 'its')}`;
      const pathTex = path.map((x) => `${x.sign() < 0 ? '-' : ''}${decimal(x.abs())}`).join(' \\to ');
      const body: Record<Ask, string> = {
        total: `Distance traveled adds the length of every move, whatever its direction: $${steps.map((s) => decimal(s.abs())).join(' + ')} = ${decimal(total)}$.`,
        net: `Compare the end with the start: the net move is $${steps.map((s, i) => (i === 0 ? '' : s.sign() < 0 ? '- ' : '+ ') + (i === 0 && s.sign() < 0 ? '-' : '') + decimal(s.abs())).join(' ')} = ${netSigned.sign() < 0 ? '-' : ''}${decimal(net)}$, so the end is ${decimal(net)} ${net.eq(1) ? 'unit' : 'units'} from the start.`,
        final: `The coordinate changes by each signed move: the end is at ${t(finalPos)}.`,
        'farthest-origin': `Compare the distances from 0 of all the positions: ${path.map((x) => decimal(x.abs())).join(', ')}. The greatest is ${decimal(farOrigin)}.`,
        'farthest-start': `Compare the distances from the start of all the positions: ${path.map((x) => decimal(x.sub(start).abs())).join(', ')}. The greatest is ${decimal(farStart)}.`,
      };
      const trapSentence: Record<string, string> = {
        'nl-net-for-total': `Trap: the net change (${decimal(net)}) ignores the back-and-forth travel.`,
        'nl-total-for-net': `Trap: the total (${decimal(total)}) counts moves that partly cancel.`,
        'nl-final-for-extreme': `Trap: looking only at the end, or at the start, misses a point in the middle of the path.`,
        'nl-start-forgotten': `Trap: the net move (${decimal(netSigned.abs())}) alone forgets the starting coordinate.`,
      };
      return {
        params: { start, steps, ask },
        q: {
          format: 'ne',
          stem,
          answer: key,
          traps,
          explanation: `Recognize: a trip along a line with moves in both directions, so list where the ${w} is after each move.

Positions: $${pathTex}$. ${body[ask]}

Check: start plus net move, $${start.sign() < 0 ? '-' : ''}${decimal(start.abs())} ${netSigned.sign() < 0 ? '-' : '+'} ${decimal(net)} = ${t(finalPos).slice(1, -1)}$, which is the last position listed.

${trapSentence[traps[0].trap]} Direction matters for position and for net change, but not for distance traveled.`,
        },
      };
    }
  },
  check(q, { start, steps, ask }) {
    // Step-by-step simulation in floating point.
    let x = start.toNumber();
    const s0 = x;
    let travelled = 0;
    let far0 = Math.abs(x);
    let farS = 0;
    for (const s of steps) {
      x += s.toNumber();
      travelled += Math.abs(s.toNumber());
      far0 = Math.max(far0, Math.abs(x));
      farS = Math.max(farS, Math.abs(x - s0));
    }
    const v = ask === 'total' ? travelled : ask === 'net' ? Math.abs(x - s0) : ask === 'final' ? x : ask === 'farthest-origin' ? far0 : farS;
    return expectNE(q, v);
  },
};

export const beadMovesTemplates: Template<any>[] = [beadMoves];
