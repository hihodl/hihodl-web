import Link from "next/link";
import type { ReactNode } from "react";

import { SectionHairline } from "@/components/site/SectionHairline";
import { BENEFITS_GROUND } from "@/components/ad-space/ground";

/**
 * The pieces the three Spaces pages on the website share: /spaces,
 * /spaces/creators and /spaces/brands.
 *
 * They stand on the site's own system (TopNav, Footer, night and abyss
 * sections, hairlines) because they are the website, not the product. The one
 * borrowing is the hero, which wears the Benefits ground the creator and event
 * pages wear, so a brand who reads this and then opens a creator's link feels
 * it is the same place.
 *
 * WHAT THESE PAGES MUST NEVER SAY
 *
 * - That HOLD holds, escrows, freezes or refunds the money. The sponsor pays
 *   the creator's wallet directly, in one transaction, and we never touch it.
 * - That HOLD rules on a dispute. The creator's fallback, chosen before the sale
 *   and shown before payment, is the only remedy there is.
 * - "Bet", "gamble", "auction house". It is an offer or a bid.
 * - Any chain but Solana, Base and Polygon, or any coin but USDC.
 * - A public board, a Discover page, Featured placement, instalments, card
 *   payments, printing or artwork help. None of them exist.
 * - "People" for QR scans. A scan is a redirect we served.
 * - That a blue check is an identity check. It is a paid X subscription; we
 *   show the facts (followers, account age, the check) and let the brand judge.
 * - Named creators, brands, events or counts. Nothing is invented here.
 */

export type SpacesPage = "overview" | "creators" | "brands";

const PAGES: { key: SpacesPage; href: string; label: string }[] = [
  { key: "overview", href: "/spaces", label: "Spaces" },
  { key: "creators", href: "/spaces/creators", label: "For creators" },
  { key: "brands", href: "/spaces/brands", label: "For brands" },
];

/** The three pages, one row. Selection changes a colour, never a border width. */
export function SpacesNav({ current }: { current: SpacesPage }) {
  return (
    <nav aria-label="Spaces" className="flex flex-wrap gap-2">
      {PAGES.map((page) => {
        const active = page.key === current;
        return (
          <Link
            key={page.key}
            href={page.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full border border-white/25 bg-white/15 px-4 py-2 text-small font-medium text-text"
                : "rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-small text-text-muted transition-colors hover:bg-white/10 hover:text-text"
            }
          >
            {page.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The top of each page: the Benefits ground, words on the left, the figure on the right. */
export function SpacesHero({
  current,
  title,
  titleMuted,
  lead,
  actions,
  figure,
}: {
  current: SpacesPage;
  title: ReactNode;
  titleMuted?: ReactNode;
  lead: ReactNode;
  actions: ReactNode;
  figure: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden" style={{ background: BENEFITS_GROUND }}>
      <div className="container-page relative pt-10 pb-20 md:pt-14 md:pb-28">
        <SpacesNav current={current} />
        <div className="mt-12 grid grid-cols-1 items-center gap-14 lg:mt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
          <div className="max-w-2xl">
            <h1 className="font-display text-[44px] font-light leading-[1.05] tracking-[-0.03em] text-text text-balance md:text-h1">
              {title}
              {titleMuted ? (
                <>
                  <br />
                  <span className="text-[#B9C7D6]">{titleMuted}</span>
                </>
              ) : null}
            </h1>
            <p className="mt-8 max-w-xl text-lead text-[#C9D4E0]">{lead}</p>
            <div className="mt-10 flex flex-wrap items-center gap-3">{actions}</div>
          </div>
          <div className="min-w-0">{figure}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * The overview's hero: a photograph across the whole header, and the words on
 * a solid ground rather than on the picture.
 *
 * From lg the photo takes the band from where the text column ends, the left is
 * solid navy, and a short fade joins them, so no line of copy ever sits on the
 * photograph itself (PRODUCT.md: text surfaces are solid). The photo is not
 * full-bleed because its subject is centred: across the whole band, the case
 * with the spots would land under the text. On a
 * phone a 16:9 band would shrink the suitcase to a thumbnail, so the phone gets
 * a square crop centred on the woman and the case, with the words below it.
 *
 * The spots on the case are composited onto the photo (same zones as the
 * catalog's carry-on), not generated: an image model draws them as a picture
 * of a suitcase stuck to a suitcase.
 */
export function SpacesPhotoHero({
  current,
  title,
  titleMuted,
  lead,
  actions,
  photo,
}: {
  current: SpacesPage;
  title: ReactNode;
  titleMuted?: ReactNode;
  lead: ReactNode;
  actions: ReactNode;
  photo: { wide: string; square: string; ambient?: string; alt: string };
}) {
  return (
    <section className="relative overflow-hidden bg-[#0a1929]">
      {/* Wide screens: the band is wider than the photo can cover without
          cutting her head and feet, and the margin left of the text was a flat
          block of navy. The same terminal, mirrored and blurred to light, fills
          it, and fades to solid navy before the text column begins. */}
      {photo.ambient ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden bg-cover bg-center opacity-70 lg:block"
            style={{ backgroundImage: `url(${photo.ambient})` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden lg:block"
            style={{
              background:
                "linear-gradient(90deg, rgba(10,25,41,0.35) 0%, rgba(10,25,41,0.7) max(0px, calc(50% - 900px)), #0a1929 max(0px, calc(50% - 620px)))",
            }}
          />
        </>
      ) : null}
      {/* From lg the photo starts at the middle of the band, never before
          660px: the text column is at most 560px from the content's edge, so
          the copy never runs onto the picture at any width. */}
      <picture className="block lg:absolute lg:inset-y-0 lg:right-0 lg:left-[max(660px,50%)]">
        <source media="(min-width: 640px)" srcSet={photo.wide} />
        {/* eslint-disable-next-line @next/next/no-img-element -- art direction
            between two crops needs <picture>; next/image cannot switch source
            by media query. */}
        <img
          src={photo.square}
          alt={photo.alt}
          fetchPriority="high"
          className="block aspect-square w-full object-cover sm:aspect-video lg:aspect-auto lg:h-full"
        />
      </picture>
      {/* Phone: the photo melts into the ground the words stand on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 aspect-square sm:aspect-video lg:hidden"
        style={{ background: "linear-gradient(180deg, transparent 72%, #0a1929 100%)" }}
      />
      {/* From lg: the photo's left edge fades into the navy the text stands on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 hidden w-40 lg:block lg:left-[max(660px,50%)]"
        style={{ background: "linear-gradient(90deg, #0a1929 0%, rgba(10,25,41,0.55) 45%, transparent 100%)" }}
      />
      <div className="container-page relative pb-16 pt-8 lg:flex lg:min-h-[720px] lg:flex-col lg:justify-center lg:py-20">
        <div className="lg:absolute lg:top-10">
          <SpacesNav current={current} />
        </div>
        <div className="mt-8 max-w-xl lg:mt-16 lg:max-w-[560px]">
          <h1 className="font-display text-[44px] font-light leading-[1.05] tracking-[-0.03em] text-text lg:text-h1">
            {title}
            {titleMuted ? (
              <>
                <br />
                <span className="text-[#B9C7D6]">{titleMuted}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-8 text-lead text-[#C9D4E0]">{lead}</p>
          <div className="mt-10 flex flex-wrap items-center gap-3">{actions}</div>
        </div>
      </div>
    </section>
  );
}

export function PrimaryAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-amber px-6 py-3.5 text-body font-semibold text-text-on-amber transition-colors hover:bg-amber-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
    >
      {children}
      <Arrow />
    </Link>
  );
}

export function SecondaryAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/[0.06] px-6 py-3.5 text-body font-medium text-text transition-colors hover:bg-white/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {children}
    </Link>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A page section on the site's own surfaces. */
export function Block({
  tone = "night",
  hairline = "moonlight",
  id,
  children,
}: {
  tone?: "night" | "abyss";
  hairline?: "moonlight" | "amber" | "blue";
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`relative overflow-hidden ${tone === "night" ? "bg-night" : "bg-abyss"}`}>
      <SectionHairline tone={hairline} />
      <div className="container-page section relative">{children}</div>
    </section>
  );
}

export function BlockHead({ title, intro }: { title: ReactNode; intro?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-[34px] font-light leading-tight text-text text-balance md:text-h2">{title}</h2>
      {intro ? <p className="mt-6 text-body leading-relaxed text-text-muted">{intro}</p> : null}
    </div>
  );
}

/**
 * Facts as a ruled list, two columns from md: a title that states the fact and
 * a sentence that earns it. Not a grid of identical cards.
 */
export function Rules({ items, columns = 2 }: { items: { title: string; body: ReactNode }[]; columns?: 1 | 2 }) {
  return (
    <dl className={`mt-12 grid grid-cols-1 gap-x-14 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
      {items.map((item) => (
        <div key={item.title} className="border-t border-white/10 py-7">
          <dt className="font-display text-h4 font-light leading-snug text-text">{item.title}</dt>
          <dd className="mt-3 max-w-[60ch] text-body leading-relaxed text-text-muted">{item.body}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A sequence where the order is the information: what happens first, then
 * next. A vertical line with a node per step, no numbers.
 */
export function Timeline({ steps }: { steps: { title: string; body: ReactNode; who?: string }[] }) {
  return (
    <ol className="relative mt-14 max-w-3xl">
      <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-px bg-white/15" />
      {steps.map((step) => (
        <li key={step.title} className="relative pb-10 pl-10 last:pb-0">
          <span aria-hidden className="absolute left-0 top-[9px] h-[15px] w-[15px] rounded-full border-2 border-amber bg-night" />
          <p className="font-display text-h4 font-light leading-snug text-text">
            {step.title}
            {step.who ? <span className="ml-3 align-middle text-small font-normal text-moonlight">{step.who}</span> : null}
          </p>
          <p className="mt-2 max-w-[62ch] text-body leading-relaxed text-text-muted">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** Three columns with a top rule: the three things a creator can sell. */
export function Offers({ items }: { items: { name: string; line: string; body: ReactNode; examples: string[] }[] }) {
  return (
    <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
      {items.map((item) => (
        <div key={item.name} className="border-t-2 border-amber/70 pt-6">
          <h3 className="font-display text-h3 font-light leading-tight text-text">{item.name}</h3>
          <p className="mt-2 text-body font-medium text-[#D6DEE8]">{item.line}</p>
          <p className="mt-4 text-body leading-relaxed text-text-muted">{item.body}</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {item.examples.map((example) => (
              <li key={example} className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-small text-[#C3CCD8]">
                {example}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The two doors at the foot of the overview, and the cross-link on the role pages. */
export function Door({ href, title, body, cta }: { href: string; title: string; body: string; cta: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-card border border-white/12 bg-white/[0.04] p-8 transition-colors hover:border-white/25 hover:bg-white/[0.07] md:p-10"
    >
      <div>
        <h3 className="font-display text-h3 font-light leading-tight text-text">{title}</h3>
        <p className="mt-4 max-w-[48ch] text-body leading-relaxed text-text-muted">{body}</p>
      </div>
      <span className="mt-10 inline-flex items-center gap-2 text-body font-medium text-amber">
        {cta}
        <span className="transition-transform group-hover:translate-x-1">
          <Arrow />
        </span>
      </span>
    </Link>
  );
}

/** The closing band every product page on the site carries: one line, one action. */
export function Closing({ line, body, actions }: { line: ReactNode; body: ReactNode; actions: ReactNode }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #2A1F18 0%, #1F1A14 45%, #1F2535 100%)" }}
    >
      <SectionHairline tone="amber" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(70% 60% at 50% 45%, rgba(255,183,3,0.10), transparent 70%)" }}
        aria-hidden
      />
      <div className="container-page section relative text-center">
        <p className="mx-auto max-w-3xl font-display text-[34px] font-light leading-snug text-text text-balance md:text-h2">{line}</p>
        <p className="mx-auto mt-8 max-w-2xl text-lead text-[#C9C2B8]">{body}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      </div>
    </section>
  );
}

/* ─── The figure ────────────────────────────────────────────────────────── */

export type SpotState = "sold" | "logo" | "qr" | "held" | "open";

export type Spot = {
  /** Fractions of the face, as the catalog stores zones. */
  x: number;
  y: number;
  w: number;
  h: number;
  state: SpotState;
  price?: string;
};

/**
 * A carry-on suitcase from the catalog, front and side, with its spots. Drawn in
 * the same language as the listing page's ProductBoard, so the picture here is
 * the picture a brand will meet: open is a moonlight outline with its price,
 * held is an amber tint with a dashed edge, sold is solid amber, and a sold spot
 * whose artwork is approved shows it on a white plate. The marks are abstract on
 * purpose: no brand is named on this site that has not signed anything.
 */
export function SuitcaseFigure({
  face,
  side,
  caption,
  callout,
}: {
  face: Spot[];
  side?: Spot[];
  caption?: ReactNode;
  callout?: { title: string; detail: string };
}) {
  return (
    <figure className="mx-auto w-full max-w-[520px]">
      {/* Above the drawing on a phone, where there is no room beside it; pinned
          to its corner from md up. */}
      {callout ? (
        <div className="mx-auto mb-6 w-fit max-w-full rounded-xl border border-white/15 bg-[#0d2238] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.35)] md:hidden">
          <p className="text-small font-semibold text-text">{callout.title}</p>
          <p className="mt-0.5 text-tiny text-[#AFC0D2]">{callout.detail}</p>
        </div>
      ) : null}
      <div className="relative flex items-end justify-center gap-6 md:gap-10">
        <Case width={100} spots={face} outline={FACE} label="Front" />
        {side ? <Case width={60} spots={side} outline={SIDE} label="Side" /> : null}
        {callout ? (
          <div className="absolute -top-8 right-0 hidden w-[210px] rounded-xl border border-white/15 bg-[#0d2238] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.35)] md:-right-4">
            <p className="text-small font-semibold text-text">{callout.title}</p>
            <p className="mt-0.5 text-tiny text-[#AFC0D2]">{callout.detail}</p>
          </div>
        ) : null}
      </div>
      <Legend />
      {caption ? <figcaption className="mt-4 text-center text-small text-[#AFC0D2]">{caption}</figcaption> : null}
    </figure>
  );
}

const FACE = (
  <>
    <rect x="10" y="22" width="80" height="104" rx="9" />
    <path d="M38 22 V12 Q38 7 43 7 H57 Q62 7 62 12 V22" />
    <path d="M10 30 H90 M10 118 H90" opacity="0.5" />
    <circle cx="24" cy="132" r="4.5" />
    <circle cx="76" cy="132" r="4.5" />
  </>
);

const SIDE = (
  <>
    <rect x="17" y="22" width="26" height="104" rx="5" />
    <path d="M30 22 V7 M26 7 H34" />
    <path d="M17 34 H43 M17 114 H43" opacity="0.5" />
    <circle cx="23" cy="132" r="4.5" />
    <circle cx="37" cy="132" r="4.5" />
  </>
);

function Case({ width, spots, outline, label }: { width: number; spots: Spot[]; outline: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${width} 140`}
        className="h-auto"
        style={{ width: `calc(${width / 100} * min(260px, 52vw))` }}
        role="img"
        aria-label={`${label} of a carry-on suitcase with ${spots.length} sponsor spots`}
      >
        <g fill="rgba(10,25,41,0.55)" stroke="#8FB3D1" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
          {outline}
        </g>
        {spots.map((spot, i) => (
          <SpotMark key={i} spot={spot} vw={width} />
        ))}
      </svg>
      <span className="mt-3 text-tiny text-[#8FA6BC]">{label}</span>
    </div>
  );
}

function SpotMark({ spot, vw }: { spot: Spot; vw: number }) {
  const x = spot.x * vw;
  const y = spot.y * 140;
  const w = spot.w * vw;
  const h = spot.h * 140;
  const cx = x + w / 2;
  const cy = y + h / 2;

  if (spot.state === "open") {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx="2" fill="rgba(91,124,255,0.10)" stroke="#7F9BFF" strokeWidth="0.9" />
        {spot.price ? (
          <text x={cx} y={cy + 2.4} textAnchor="middle" fontSize={Math.min(7, w / 4)} fontWeight="600" fill="#DCE4FF" fontFamily="Inter, sans-serif">
            {spot.price}
          </text>
        ) : null}
      </g>
    );
  }
  if (spot.state === "held") {
    return <rect x={x} y={y} width={w} height={h} rx="2" fill="rgba(255,183,3,0.22)" stroke="#FFB703" strokeWidth="0.9" strokeDasharray="2.2 1.6" />;
  }
  if (spot.state === "sold") {
    return <rect x={x} y={y} width={w} height={h} rx="2" fill="#FFB703" />;
  }
  if (spot.state === "qr") {
    const s = Math.min(w, h) - 3;
    const cell = s / 7;
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx="2" fill="#F4F6FA" />
        {QR_CELLS.map(([cxI, cyI]) => (
          <rect key={`${cxI}-${cyI}`} x={cx - s / 2 + cxI * cell} y={cy - s / 2 + cyI * cell} width={cell} height={cell} fill="#0A1929" />
        ))}
      </g>
    );
  }
  // "logo": an abstract mark on a white plate. A wide spot takes it side by
  // side, a squarer one stacked, so the mark never gets squeezed.
  if (w / h < 2) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx="2" fill="#F4F6FA" />
        <circle cx={cx} cy={cy - h * 0.12} r={h * 0.2} fill="#1a5276" />
        <rect x={cx - w * 0.28} y={cy + h * 0.18} width={w * 0.56} height={h * 0.12} rx={h * 0.06} fill="#0A1929" />
      </g>
    );
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" fill="#F4F6FA" />
      <circle cx={x + h * 0.55} cy={cy} r={h * 0.26} fill="#1a5276" />
      <rect x={x + h * 1.0} y={cy - h * 0.12} width={Math.max(w - h * 1.35, 4)} height={h * 0.24} rx={h * 0.12} fill="#0A1929" />
    </g>
  );
}

/** A fixed, readable-looking pattern. It is a drawing of a QR code, not one. */
const QR_CELLS: [number, number][] = [
  [0, 0], [1, 0], [2, 0], [4, 0], [6, 0], [5, 0],
  [0, 1], [2, 1], [4, 1], [6, 1],
  [0, 2], [1, 2], [2, 2], [3, 2], [5, 2], [6, 2],
  [3, 3], [5, 3],
  [0, 4], [1, 4], [2, 4], [4, 4], [6, 4],
  [0, 5], [2, 5], [3, 5], [5, 5],
  [0, 6], [1, 6], [2, 6], [4, 6], [5, 6], [6, 6],
];

function Legend() {
  return (
    <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-tiny text-[#AFC0D2]">
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px] border border-[#7F9BFF] bg-[rgba(91,124,255,0.10)]" />
        Open, with its price
      </li>
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px] border border-dashed border-amber bg-amber/20" />
        Someone is paying
      </li>
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px] bg-amber" />
        Sold
      </li>
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px] bg-[#F4F6FA]" />
        Artwork approved
      </li>
    </ul>
  );
}

/** The catalog's front-face zones, as fractions, so every figure on these pages is one real layout. */
export const FACE_ZONES = {
  headline: { x: 0.2, y: 0.257, w: 0.6, h: 0.129 },
  upperLeft: { x: 0.2, y: 0.429, w: 0.28, h: 0.157 },
  upperRight: { x: 0.52, y: 0.429, w: 0.28, h: 0.157 },
  lowerLeft: { x: 0.2, y: 0.629, w: 0.28, h: 0.157 },
  lowerRight: { x: 0.52, y: 0.629, w: 0.28, h: 0.157 },
} as const;

export const SIDE_ZONES = {
  upperLeft: { x: 0.333, y: 0.6, w: 0.15, h: 0.079 },
  upperRight: { x: 0.517, y: 0.6, w: 0.15, h: 0.079 },
  lowerLeft: { x: 0.333, y: 0.707, w: 0.15, h: 0.079 },
  lowerRight: { x: 0.517, y: 0.707, w: 0.15, h: 0.079 },
} as const;
