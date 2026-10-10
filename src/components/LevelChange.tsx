import { LEVEL_NAMES, type Level } from '../mastery/model';

const BURST = Array.from({ length: 8 }, (_, i) => i);

/** "Familiar -> Proficient" chip. Reaching Mastered adds a ring and a short particle burst; a drop stays neutral. */
export function LevelChange({ from, to }: { from: Level; to: Level }) {
  const up = to > from;
  const mastered = up && to === 4;
  return (
    <span className={`${!up ? 'chip' : mastered ? 'chip chip-accent' : 'chip chip-good'} level-change`}>
      <i className={`level-dot level-${from}`} />
      {LEVEL_NAMES[from]} →
      <span className="lc-dot">
        <i className={`level-dot level-${to}`} />
        {mastered && (
          <>
            <svg className="lc-ring" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" pathLength="1" />
            </svg>
            <span className="lc-burst" aria-hidden="true">
              {BURST.map((i) => (
                <span key={i} style={{ ['--a' as string]: `${i * 45}deg` }} />
              ))}
            </span>
          </>
        )}
      </span>
      {LEVEL_NAMES[to]}
      {!up && (
        <svg className="lc-review" viewBox="0 0 24 24" aria-label="review" role="img">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      )}
    </span>
  );
}
