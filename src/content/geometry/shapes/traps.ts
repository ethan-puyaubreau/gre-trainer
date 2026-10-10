import type { Trap } from '../../../engine/types';

export const shapesTraps: Record<string, Trap> = {
  /* ---------------------------------------------------------------- lines & angles */
  'geo-par-equal-not-supp': {
    label: 'Set two angles equal when they are supplementary',
    fix: 'Parallel lines make only two angle measures. Angles in matching positions (corresponding, alternate, vertical) are equal; an angle of one kind plus an angle of the other kind is $180^\\circ$.',
  },
  'geo-par-supp-not-equal': {
    label: 'Made two angles add to $180^\\circ$ when they are equal',
    fix: 'Corresponding, alternate interior and alternate exterior angles are equal, not supplementary. Only an angle of each kind (e.g. same-side interior angles) adds up to $180^\\circ$.',
  },
  'geo-par-bend': {
    label: 'Took the angle at the bend as $180^\\circ$ minus the other two',
    fix: 'Draw a line through the bend parallel to the two lines: the bend angle splits into two alternate interior angles, so it equals the SUM of the two outer angles.',
  },
  'geo-ang-wrong-unknown': {
    label: 'Answered a different quantity than the one asked',
    fix: 'After solving for $x$, reread the question: if it asks for an angle (or a length), substitute $x$ back into the expression.',
  },
  'geo-ang-line-360': {
    label: 'Used $360^\\circ$ for angles along a straight line',
    fix: 'Angles that together form a straight line add up to $180^\\circ$. $360^\\circ$ is a full turn around a point.',
  },
  'geo-ang-point-180': {
    label: 'Used $180^\\circ$ for angles all the way around a point',
    fix: 'Angles that fill the whole turn around a point add up to $360^\\circ$; $180^\\circ$ is only for angles along a straight line.',
  },
  'geo-ang-ratio-whole': {
    label: 'Read a part-to-whole ratio as a part-to-part ratio (or the reverse)',
    fix: '$\\frac{r}{r + s} = \\frac{3}{8}$ means $r$ is $\\frac{3}{8}$ of the whole; $r : s = 3 : 8$ means the whole is $3 + 8 = 11$ parts.',
  },
  'geo-ang-vertical-adjacent': {
    label: 'Treated adjacent angles as vertical angles',
    fix: 'Vertical angles are opposite each other at an intersection and are equal. Adjacent angles along a line are supplementary.',
  },
};
