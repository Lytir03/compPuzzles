const COLORS = ["var(--gold)", "var(--brand)", "#6fa9df", "var(--coral)", "#d9f5c4"];
const PIECE_COUNT = 36;

/** mulberry32 — a deterministic PRNG so the layout is identical on server and client. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

/**
 * A win burst on the result screen. Purely decorative — `aria-hidden` and
 * `pointer-events-none`, so it can never sit between a player and the
 * "play again" button.
 *
 * Seeded off the match id rather than `Math.random()`: random in a render body
 * is impure (pieces would re-roll on every re-render) and makes the server and
 * client markup disagree. Different match, different burst; same match, same
 * burst.
 *
 * Reduced motion is handled in CSS (`.confetti-layer` is hidden outright in
 * globals.css) — the global rule that clamps animations to 0.01ms would
 * otherwise flash 36 squares across the screen for a single frame.
 */
export function Confetti({ seed }: { seed: string }) {
  const random = makeRandom(hashSeed(seed));
  const pieces = Array.from({ length: PIECE_COUNT }, (_, i) => ({
    key: i,
    left: random() * 100,
    drift: `${(random() - 0.5) * 30}vw`,
    spin: `${360 + random() * 720}deg`,
    fall: `${2.2 + random() * 1.6}s`,
    delay: `${random() * 0.5}s`,
    size: 6 + random() * 7,
    color: COLORS[i % COLORS.length],
    round: i % 3 === 0,
  }));

  return (
    <div
      aria-hidden="true"
      className="confetti-layer pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {pieces.map((piece) => (
        <span
          key={piece.key}
          className="confetti-piece absolute top-0 block"
          style={
            {
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.size * (piece.round ? 1 : 1.6),
              background: piece.color,
              borderRadius: piece.round ? "9999px" : "2px",
              "--drift": piece.drift,
              "--spin": piece.spin,
              "--fall": piece.fall,
              "--delay": piece.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
