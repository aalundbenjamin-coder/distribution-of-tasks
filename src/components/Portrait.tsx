/**
 * The illustrated portraits used across the roster.
 *
 * The five people carried over from the presentation keep the exact palettes
 * they were drawn with, so the person on the projected slide and the person in
 * the app are recognisably the same. Everyone else is given a palette derived
 * from their name: the same name always produces the same face, which is what
 * makes a portrait feel like it belongs to someone rather than being decoration
 * reshuffled on every render.
 *
 * Faces are illustrations, not photographs. Nobody depicted here exists, and
 * the demo should not imply otherwise.
 */

export type PortraitPalette = {
  bg: string;
  shirt: string;
  shirtDark: string;
  skin: string;
  skinShade: string;
  hairBack: string;
  hairFront: string;
  /// Long hair is a mass drawn behind the head; short hair is a cap drawn over it.
  hair: 'long' | 'short';
  beard: boolean;
  glasses: boolean;
};

/** Skin tone paired with the deeper shade used for neck, ears and nose. */
const SKINS: ReadonlyArray<readonly [string, string]> = [
  ['#f3d3b5', '#e0b894'],
  ['#eec5a3', '#dbab86'],
  ['#e5b992', '#cfa079'],
  ['#f0cdae', '#dbb28c'],
  ['#c98d5f', '#b0784d'],
  ['#a9714a', '#8f5c39'],
  ['#8a5a3b', '#70472d'],
];

/** Hair, as the mass behind the head paired with the lighter front sweep. */
const HAIRS: ReadonlyArray<readonly [string, string]> = [
  ['#573719', '#6b4423'],
  ['#bd8a2e', '#d9a441'],
  ['#3a2e26', '#2a211b'],
  ['#8a6a3f', '#6d5330'],
  ['#171010', '#241a1a'],
  ['#7a4a2a', '#8f5b34'],
  ['#8d8d8d', '#a5a5a5'],
];

/** Shirt, its collar shadow, and a background tinted to match. */
const SHIRTS: ReadonlyArray<readonly [string, string, string]> = [
  ['#24406b', '#1a2f4f', '#dbe6fb'],
  ['#1c6b63', '#14514b', '#d9f0ea'],
  ['#48525f', '#353d47', '#e6e9ee'],
  ['#3d4b5c', '#2c3745', '#e2e8f4'],
  ['#7a2f3a', '#5d222b', '#f6e3e6'],
  ['#4d5f2a', '#3a4820', '#e9f0dc'],
  ['#5b3a72', '#452b57', '#ece0f5'],
];

const NAMED: Record<string, PortraitPalette> = {
  sofie: palette(1, 0, 0, 'long', false, true),
  freja: palette(0, 1, 1, 'long', false, false),
  mikkel: palette(2, 2, 2, 'short', true, false),
  jonas: palette(3, 3, 3, 'short', false, true),
  amira: palette(4, 4, 4, 'long', false, false),
};

function palette(
  skin: number,
  hair: number,
  shirt: number,
  style: 'long' | 'short',
  beard: boolean,
  glasses: boolean,
): PortraitPalette {
  const [s, sShade] = SKINS[skin]!;
  const [hBack, hFront] = HAIRS[hair]!;
  const [sh, shDark, bg] = SHIRTS[shirt]!;
  return {
    bg,
    shirt: sh,
    shirtDark: shDark,
    skin: s,
    skinShade: sShade,
    hairBack: hBack,
    hairFront: hFront,
    hair: style,
    beard,
    glasses,
  };
}

/**
 * A stable 32-bit hash of the seed.
 *
 * Deliberately not a cryptographic digest: it has to give the same answer in
 * the browser and on the server, across restarts and deployments, or a face
 * would change identity between two renders of the same page.
 */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function paletteFor(seed: string): PortraitPalette {
  const key = seed.trim().toLowerCase();
  const named = NAMED[key];
  if (named) return named;

  const h = hash(key);
  // Independent digits of the hash, so two people whose names differ by a
  // single letter do not come out wearing the same everything.
  const style = (h >>> 19) % 2 === 0 ? 'long' : 'short';
  return palette(
    h % SKINS.length,
    (h >>> 5) % HAIRS.length,
    (h >>> 11) % SHIRTS.length,
    style,
    style === 'short' && (h >>> 23) % 3 === 0,
    (h >>> 17) % 3 === 0,
  );
}

/** Brows read as part of the hairline, so they follow whichever mass is on top. */
function browColour(p: PortraitPalette): string {
  return p.hair === 'long' ? p.hairBack : p.hairFront;
}

/** A DOM id that is unique per portrait and valid regardless of the seed. */
function clipId(seed: string): string {
  return `pt-${seed.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${hash(seed).toString(36)}`;
}

export default function Portrait({
  seed,
  size = 48,
  className,
}: {
  seed: string;
  size?: number;
  className?: string;
}) {
  const p = paletteFor(seed);
  const id = clipId(seed);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Portrait illustration"
      style={{ display: 'block', borderRadius: '50%', flexShrink: 0 }}
    >
      <defs>
        <clipPath id={id}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="120" height="120" fill={p.bg} />
        <path d="M12 120c0-22 20-33 48-33s48 11 48 33z" fill={p.shirt} />
        <path d="M48 89l12 16 12-16-12-6z" fill={p.shirtDark} />
        <path d="M51 70h18v18c0 5-18 5-18 0z" fill={p.skinShade} />
        {p.hair === 'long' && (
          <path
            d="M31 62c0-24 10-38 29-38s29 14 29 38c0 14-3 24-5 30l-8-4c3-9 4-18 4-26 0-16-6-24-20-24s-20 8-20 24c0 8 1 17 4 26l-8 4c-2-6-5-16-5-30z"
            fill={p.hairBack}
          />
        )}
        <ellipse cx="60" cy="52" rx="21" ry="24" fill={p.skin} />
        <ellipse cx="39" cy="54" rx="3.5" ry="5" fill={p.skinShade} />
        <ellipse cx="81" cy="54" rx="3.5" ry="5" fill={p.skinShade} />
        {p.hair === 'long' ? (
          <>
            <path d="M38 46c2-14 9-22 22-22s20 8 22 22c-4-8-11-11-22-11s-18 3-22 11z" fill={p.hairFront} />
            <path
              d="M38 46c0-6 1-11 3-15 3 7 10 10 19 10s16-3 19-10c2 4 3 9 3 15-3-9-11-13-22-13s-19 4-22 13z"
              fill={p.hairFront}
            />
          </>
        ) : (
          <path
            d="M38 48c0-16 8-24 22-24s22 8 22 24c-3-9-6-13-9-13-4 0-6 3-13 3s-9-3-13-3c-3 0-6 4-9 13z"
            fill={p.hairBack}
          />
        )}
        <rect x="48" y="47" width="9" height="2.2" rx="1.1" fill={browColour(p)} opacity="0.85" />
        <rect x="63" y="47" width="9" height="2.2" rx="1.1" fill={browColour(p)} opacity="0.85" />
        <circle cx="52.5" cy="54" r="2.4" fill="#2a2320" />
        <circle cx="67.5" cy="54" r="2.4" fill="#2a2320" />
        <path d="M60 56v6h-3" stroke={p.skinShade} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M55 67q5 4 10 0" stroke="#a8654f" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {p.beard && (
          <>
            <path
              d="M40 55c1 15 9 23 20 23s19-8 20-23c1 12-2 27-20 27s-21-15-20-27z"
              fill={p.hairBack}
              opacity="0.92"
            />
            <path d="M53 64q7 5 14 0" stroke={p.hairFront} strokeWidth="1.4" fill="none" opacity="0.5" />
          </>
        )}
        {p.glasses && (
          <g fill="none" stroke="#2f3a49" strokeWidth="1.9" opacity="0.9">
            <rect x="45" y="49.5" width="15" height="10" rx="4" />
            <rect x="60" y="49.5" width="15" height="10" rx="4" />
            <path d="M60 54h0M39.5 52.5l5.5 1M80.5 52.5l-5.5 1" />
          </g>
        )}
      </g>
    </svg>
  );
}
