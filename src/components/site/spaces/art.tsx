import { ZONE } from "@/components/ad-space/ui";

/**
 * The hooks on the homepage, drawn the way a space draws them: the object as a
 * stroke outline, every spot a rectangle on it, open spots in moonlight and
 * sold ones in solid amber. They are examples, and every card that shows one
 * says so. No prices and no brand names on them: a figure on the homepage has
 * to be one we can cite.
 *
 * The suitcase is the catalog's own outline (the same paths the backend serves
 * for the carry-on template), so the example and the real board look alike.
 */

type Zone = { x: number; y: number; w: number; h: number; sold?: boolean };

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r} ${y} H${x + w - r} a${r} ${r} 0 0 1 ${r} ${r} V${y + h - r} ` +
    `a${r} ${r} 0 0 1 ${-r} ${r} H${x + r} a${r} ${r} 0 0 1 ${-r} ${-r} V${y + r} a${r} ${r} 0 0 1 ${r} ${-r} Z`
  );
}

const SUITCASE_FACE = [
  roundRect(12, 28, 76, 100, 7),
  "M41 28 V7 a2 2 0 0 1 2 -2 H57 a2 2 0 0 1 2 2 V28",
  "M45 28 V9 M55 28 V9",
  circle(22, 132, 4.5),
  circle(78, 132, 4.5),
];

const SUITCASE_SIDE = [
  roundRect(17, 28, 26, 100, 5),
  "M30 28 V5 M26 5 H34",
  "M17 40 H43 M17 116 H43",
  circle(23, 132, 4.5),
  circle(37, 132, 4.5),
];

const SUITCASE_FACE_ZONES: Zone[] = [
  { x: 0.2, y: 0.257, w: 0.6, h: 0.129, sold: true },
  { x: 0.2, y: 0.429, w: 0.28, h: 0.157 },
  { x: 0.52, y: 0.429, w: 0.28, h: 0.157, sold: true },
  { x: 0.2, y: 0.629, w: 0.28, h: 0.157 },
  { x: 0.52, y: 0.629, w: 0.28, h: 0.157 },
];

const SUITCASE_SIDE_ZONES: Zone[] = [
  { x: 0.333, y: 0.6, w: 0.15, h: 0.079 },
  { x: 0.517, y: 0.6, w: 0.15, h: 0.079, sold: true },
  { x: 0.333, y: 0.707, w: 0.15, h: 0.079 },
  { x: 0.517, y: 0.707, w: 0.15, h: 0.079 },
];

const DRESS = [
  "M38 6 L42 6 L45 28 L55 28 L58 6 L62 6 L65 32 Q70 42 65 52 L84 130 Q50 138 16 130 L35 52 Q30 42 35 32 Z",
  "M35 52 Q50 57 65 52",
];

const DRESS_ZONES: Zone[] = [
  { x: 0.4, y: 0.24, w: 0.2, h: 0.09, sold: true },
  { x: 0.33, y: 0.47, w: 0.34, h: 0.1 },
  { x: 0.26, y: 0.63, w: 0.2, h: 0.1 },
  { x: 0.54, y: 0.63, w: 0.2, h: 0.1, sold: true },
  { x: 0.24, y: 0.78, w: 0.52, h: 0.08 },
];

function Spots({ zones, w, h }: { zones: Zone[]; w: number; h: number }) {
  return (
    <>
      {zones.map((z, i) => (
        <rect
          key={i}
          x={z.x * w}
          y={z.y * h}
          width={z.w * w}
          height={z.h * h}
          rx={1.5}
          fill={z.sold ? ZONE.soldFill : ZONE.openFill}
          stroke={z.sold ? ZONE.soldFill : ZONE.openStroke}
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
}

function Outline({ paths }: { paths: string[] }) {
  return (
    <g fill="none" stroke={ZONE.outline} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}

/** Front and one side of the carry-on, side by side at one scale, like the real board. */
export function SuitcaseArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 172 140" className={className} role="img" aria-label="A suitcase with ad spots, some open and some sold">
      <g>
        <Outline paths={SUITCASE_FACE} />
        <Spots zones={SUITCASE_FACE_ZONES} w={100} h={140} />
      </g>
      <g transform="translate(112 0)">
        <Outline paths={SUITCASE_SIDE} />
        <Spots zones={SUITCASE_SIDE_ZONES} w={60} h={140} />
      </g>
    </svg>
  );
}

export function DressArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 140" className={className} role="img" aria-label="A dress with ad spots, some open and some sold">
      <Outline paths={DRESS} />
      <Spots zones={DRESS_ZONES} w={100} h={140} />
    </svg>
  );
}

/**
 * The creator's own photo with squares on it. Drawn as a scene (sky, a skyline,
 * a person) rather than a real photograph: an example must not look like a
 * real creator's post.
 */
export function PhotoArt({ className = "" }: { className?: string }) {
  const squares: Zone[] = [
    { x: 0.08, y: 0.1, w: 0.2, h: 0.14, sold: true },
    { x: 0.72, y: 0.1, w: 0.2, h: 0.14 },
    { x: 0.08, y: 0.74, w: 0.2, h: 0.14 },
    { x: 0.72, y: 0.74, w: 0.2, h: 0.14, sold: true },
  ];
  return (
    <svg viewBox="0 0 120 140" className={className} role="img" aria-label="A photo with squares where brand logos go">
      <defs>
        <linearGradient id="photo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2C4566" />
          <stop offset="60%" stopColor="#7295B5" />
          <stop offset="100%" stopColor="#FFD234" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="120" height="140" rx="6" fill="url(#photo-sky)" />
      <path
        d="M0 104 V88 H10 V78 H18 V92 H26 V70 H34 V94 H44 V84 H52 V100 H70 V80 H78 V66 H86 V90 H96 V82 H106 V96 H120 V104 Z"
        fill="#1B2638"
        opacity="0.75"
      />
      <rect x="0" y="104" width="120" height="36" fill="#141F2E" />
      <circle cx="60" cy="76" r="9" fill="#0A1929" />
      <path d="M42 140 Q42 98 60 92 Q78 98 78 140 Z" fill="#0A1929" />
      <g>
        {squares.map((z, i) => (
          <rect
            key={i}
            x={z.x * 120}
            y={z.y * 140}
            width={z.w * 120}
            height={z.h * 140}
            rx={1.5}
            fill={z.sold ? ZONE.soldFill : "rgba(8,12,24,0.58)"}
            stroke={z.sold ? ZONE.soldFill : ZONE.openStroke}
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  );
}

/** Content production: what the brand receives, as the checklist on the private delivery link. */
export function ProductionArt({ className = "" }: { className?: string }) {
  const items = [
    { label: "Brief from the brand", done: true },
    { label: "Interviews on the floor", done: true },
    { label: "Short videos", done: true },
    { label: "Event recap", done: false },
  ];
  return (
    <div className={`flex flex-col justify-center gap-2 ${className}`} role="img" aria-label="A delivery checklist for content made for a brand">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3 rounded-tight border border-[color:var(--color-hairline)] bg-white/[0.03] px-3 py-1.5">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
              it.done ? "border-amber bg-amber" : "border-[color:var(--color-hairline-strong)]"
            }`}
            aria-hidden
          >
            {it.done && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l2.5 2.5L9 1" stroke="#0A0500" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className={`text-small ${it.done ? "text-text" : "text-text-muted"}`}>{it.label}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-3 rounded-tight bg-moonlight/10 px-3 py-2 text-small">
        <span className="text-text">Private delivery link</span>
        <span className="whitespace-nowrap text-text-muted">24 to 72h</span>
      </div>
    </div>
  );
}
