"use client";

import type { CSSProperties, KeyboardEvent } from "react";

import { STATUS_LABEL, usdFromUsdc } from "@/lib/ad-space/format";
import { inkOn, isClosedPath, type ProductLook } from "@/lib/ad-space/product-look";
import type { PhotoRect, Position, SpacePhoto, Template, TemplateView, TemplateZone } from "@/lib/ad-space/types";
import { t as translate } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";

import { qrModules } from "./qr";
import { ZONE } from "./ui";

/**
 * The product, drawn from the catalog: each view's outline in its own viewBox,
 * stroke only, and every zone a rectangle in FRACTIONS of that viewBox.
 *
 * All views share one scale (pixels per viewBox unit), so the side of a
 * suitcase is narrower than its front and a helmet is smaller than a race suit,
 * the way the real objects are. The scale is set so the tallest view is 220px
 * on a phone (two suitcase faces still side by side at 400px) and
 * 340px from `md` up: the product is the page's banner, so it is drawn big.
 *
 * Zone states: open is a moonlight outline, held is an amber tint with a dashed
 * edge (someone is paying right now), sold is solid amber, or the sponsor's
 * approved logo, QR or text on a white plate. Zones nobody is selling are a
 * faint dashed outline and are not interactive.
 *
 * The creator can make the product theirs (product-look-rules.ts): its colours
 * (`look`: the body filled, handle, wheels and trim in the accent), or a real
 * photo per side (`viewPhotos`), each side's spots squares on its own photo.
 * On a coloured body or a photo an open spot sits on a dark glass plate with
 * white figures, so it reads on any colour; the outline's ink follows the
 * body's lightness. With neither, the outline takes the page's own ink
 * (`--sp-outline`), so it reads on a light ground too.
 */

/** Hover and focus change a colour, never a stroke width. */
const ACTIVE_STROKE = "#F4F6FA";
const HELD_FILL_ACTIVE = "rgba(255,183,3,0.28)";
/**
 * On a photo an open square sits over whatever the camera saw, bright or dark,
 * so it gets a dark glass under its price instead of the drawing's faint tint.
 * Hover lightens it to moonlight: a colour, as everywhere else.
 */
const PHOTO_OPEN_FILL = "rgba(8,12,24,0.58)";
const PHOTO_OPEN_FILL_ACTIVE = "rgba(91,124,255,0.55)";
/** The photo's viewBox is this wide; its height follows the photo's shape. */
const PHOTO_UNITS = 1000;

type Props = {
  template: Template;
  /** The product's colours, or null for the outline alone. */
  look?: ProductLook | null;
  /** A photo per side, keyed by view: that side is drawn as its photo with its squares. */
  viewPhotos?: Record<string, SpacePhoto> | null;
  /**
   * The creator's own photo, with every position's `rect` on it. When given it
   * is drawn INSTEAD of the catalog views; `getPublicSpace` only passes one on
   * when every position has its square.
   */
  photo?: SpacePhoto | null;
  positions: Position[];
  activeId: string | null;
  onHover: (positionId: string | null) => void;
  onPick: (position: Position) => void;
};

export function ProductBoard({ template, look = null, viewPhotos = null, photo, positions, activeId, onHover, onPick }: Props) {
  if (photo && positions.length > 0 && positions.every((p) => p.rect)) {
    return <PhotoFigure photo={photo} positions={positions} activeId={activeId} onHover={onHover} onPick={onPick} />;
  }
  const byZone = new Map(positions.map((p) => [p.zoneKey, p]));
  const tallest = Math.max(...template.views.map((v) => v.viewBox[1]), 1);

  const scaleVars = {
    "--u-sm": `${220 / tallest}px`,
    "--u-md": `${340 / tallest}px`,
  } as CSSProperties;

  return (
    <div
      className="flex flex-wrap items-end justify-center gap-x-4 gap-y-8 [--u:var(--u-sm)] md:gap-x-10 md:[--u:var(--u-md)]"
      style={scaleVars}
    >
      {template.views.map((view) => {
        const zones = template.zones.filter((z) => z.viewKey === view.key);
        const side = viewPhotos?.[view.key];
        const onSide = zones.flatMap((z) => {
          const p = byZone.get(z.zoneKey);
          return p ? [p] : [];
        });
        if (side && onSide.length > 0 && onSide.every((p) => p.rect)) {
          return (
            <ViewPhotoFigure
              key={view.key}
              view={view}
              photo={side}
              positions={onSide}
              activeId={activeId}
              onHover={onHover}
              onPick={onPick}
            />
          );
        }
        return (
          <ViewFigure
            key={view.key}
            view={view}
            zones={zones}
            byZone={byZone}
            look={look}
            activeId={activeId}
            onHover={onHover}
            onPick={onPick}
          />
        );
      })}
    </div>
  );
}

/**
 * The product's outline, in the creator's colours when they chose some: the
 * first path is the body (filled with `body`), every other closed shape a part
 * (handle grip, wheels, the laptop's base: filled with `accent`), and every
 * open line (a handle's uprights, a seam) drawn in `accent`. Exported for the
 * editor's live preview.
 */
export function ProductOutline({ view, look }: { view: TemplateView; look: ProductLook | null }) {
  if (!look) {
    return (
      <>
        {view.outline.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            style={{ stroke: "var(--sp-outline)" }}
            strokeWidth={1.25}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </>
    );
  }
  const bodyInk = inkOn(look.body);
  const accentInk = inkOn(look.accent);
  return (
    <>
      {view.outline.map((d, i) => {
        const body = i === 0;
        const closed = body || isClosedPath(d);
        return (
          <path
            key={i}
            d={d}
            fill={body ? look.body : closed ? look.accent : "none"}
            stroke={body ? bodyInk : closed ? accentInk : look.accent}
            strokeOpacity={body || closed ? 0.45 : 1}
            strokeWidth={body || closed ? 1.25 : 2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </>
  );
}

function ViewFigure({
  view,
  zones,
  byZone,
  look,
  activeId,
  onHover,
  onPick,
}: {
  view: TemplateView;
  zones: TemplateZone[];
  byZone: Map<string, Position>;
  look: ProductLook | null;
  activeId: string | null;
  onHover: (id: string | null) => void;
  onPick: (p: Position) => void;
}) {
  const [W, H] = view.viewBox;
  return (
    <figure
      className="flex flex-col items-center gap-3"
      style={{ width: `min(100%, calc(var(--u) * ${W}))` }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        style={{ aspectRatio: `${W} / ${H}` }}
        role="group"
        aria-label={`${view.label} view`}
      >
        <ProductOutline view={view} look={look} />
        {zones.map((z) => {
          const p = byZone.get(z.zoneKey);
          return p ? (
            <Zone
              key={z.zoneKey}
              rect={z.rect}
              position={p}
              W={W}
              H={H}
              active={activeId === p.id}
              onHover={onHover}
              onPick={onPick}
              onPhoto={Boolean(look)}
            />
          ) : (
            <IdleZone key={z.zoneKey} zone={z} W={W} H={H} ink={look ? inkOn(look.body) : null} />
          );
        })}
      </svg>
      <figcaption className="text-tiny uppercase tracking-wider text-sp-ink/80">{view.label}</figcaption>
    </figure>
  );
}

/**
 * One side of the product as the creator's own photo, as tall as that side's
 * drawing would be, with the spots on that side as squares on it.
 */
function ViewPhotoFigure({
  view,
  photo,
  positions,
  activeId,
  onHover,
  onPick,
}: {
  view: TemplateView;
  photo: SpacePhoto;
  positions: Position[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onPick: (p: Position) => void;
}) {
  const t = useT();
  const W = PHOTO_UNITS;
  const H = Math.max(1, Math.round((PHOTO_UNITS * photo.height) / photo.width));
  const aspect = photo.width / photo.height;
  return (
    <figure
      className="flex flex-col items-center gap-3"
      style={{ width: `min(100%, calc(var(--u) * ${view.viewBox[1]} * ${aspect.toFixed(5)}))` }}
    >
      <div className="w-full overflow-hidden rounded-[14px] border border-sp-ink/10">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          style={{ aspectRatio: `${W} / ${H}` }}
          role="group"
          aria-label={t("board.product.viewPhoto", { view: view.label })}
        >
          <image href={photo.url} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
          {positions.map((p) =>
            p.rect ? (
              <Zone
                key={p.id}
                rect={p.rect}
                position={p}
                W={W}
                H={H}
                active={activeId === p.id}
                onHover={onHover}
                onPick={onPick}
                onPhoto
              />
            ) : null,
          )}
        </svg>
      </div>
      <figcaption className="text-tiny uppercase tracking-wider text-sp-ink/80">{view.label}</figcaption>
    </figure>
  );
}

/**
 * The creator's own photo of the product, with each spot a square on it where
 * the creator placed it. One figure, as tall as the drawing's tallest view
 * could be and a little more (a photo carries more to look at), never wider
 * than the column. The squares are the same Zone the drawing uses: a sponsor
 * reads open, held and sold the same way on both.
 */
function PhotoFigure({
  photo,
  positions,
  activeId,
  onHover,
  onPick,
}: {
  photo: SpacePhoto;
  positions: Position[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onPick: (p: Position) => void;
}) {
  const t = useT();
  const W = PHOTO_UNITS;
  const H = Math.max(1, Math.round((PHOTO_UNITS * photo.height) / photo.width));
  const aspect = photo.width / photo.height;
  return (
    <figure
      className="mx-auto [--ph:300px] md:[--ph:440px]"
      style={{ width: `min(100%, calc(var(--ph) * ${aspect.toFixed(5)}))` }}
    >
      <div className="overflow-hidden rounded-[18px] border border-sp-ink/10">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          style={{ aspectRatio: `${W} / ${H}` }}
          role="group"
          aria-label={t("board.product.photo")}
        >
          <image href={photo.url} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
          {positions.map((p) =>
            p.rect ? (
              <Zone
                key={p.id}
                rect={p.rect}
                position={p}
                W={W}
                H={H}
                active={activeId === p.id}
                onHover={onHover}
                onPick={onPick}
                onPhoto
              />
            ) : null,
          )}
        </svg>
      </div>
    </figure>
  );
}

const NOOP = () => {};

/**
 * The spot being bought, on the product as the page draws it: the side it is
 * on, in the creator's photo of that side, or their one photo, or the drawing
 * in their colours, with this spot lit and the rest as they are. A picture for
 * the checkout, not a control.
 */
export function SpotPreview({
  template,
  look = null,
  viewPhotos = null,
  photo = null,
  positions,
  position,
}: {
  template: Template;
  look?: ProductLook | null;
  viewPhotos?: Record<string, SpacePhoto> | null;
  photo?: SpacePhoto | null;
  positions: Position[];
  position: Position;
}) {
  const zone = template.zones.find((z) => z.zoneKey === position.zoneKey);
  const view = zone ? template.views.find((v) => v.key === zone.viewKey) : undefined;
  if (!view) return null;
  const onView = template.zones.filter((z) => z.viewKey === view.key);
  const byZone = new Map(positions.map((p) => [p.zoneKey, p]));
  const sidePositions = onView.flatMap((z) => (byZone.get(z.zoneKey) ? [byZone.get(z.zoneKey)!] : []));
  const side = viewPhotos?.[view.key];

  const picture =
    photo && position.rect ? { img: photo, list: positions } : side && position.rect ? { img: side, list: sidePositions } : null;

  if (picture) {
    const W = PHOTO_UNITS;
    const H = Math.max(1, Math.round((PHOTO_UNITS * picture.img.height) / picture.img.width));
    return (
      <div className="overflow-hidden rounded-[12px] border border-white/10" style={{ height: 132, aspectRatio: `${W} / ${H}` }} aria-hidden>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full">
          <image href={picture.img.url} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
          {picture.list.map((p) =>
            p.rect ? (
              <Zone key={p.id} rect={p.rect} position={p} W={W} H={H} active={p.id === position.id} onHover={NOOP} onPick={NOOP} onPhoto still />
            ) : null,
          )}
        </svg>
      </div>
    );
  }

  const [W, H] = view.viewBox;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="overflow-visible" style={{ height: 132, width: "auto", aspectRatio: `${W} / ${H}` }} aria-hidden>
      <ProductOutline view={view} look={look} />
      {onView.map((z) => {
        const p = byZone.get(z.zoneKey);
        return p ? (
          <Zone key={z.zoneKey} rect={z.rect} position={p} W={W} H={H} active={p.id === position.id} onHover={NOOP} onPick={NOOP} onPhoto={Boolean(look)} still />
        ) : (
          <IdleZone key={z.zoneKey} zone={z} W={W} H={H} ink={look ? inkOn(look.body) : null} />
        );
      })}
    </svg>
  );
}

function IdleZone({ zone, W, H, ink = null }: { zone: TemplateZone; W: number; H: number; ink?: string | null }) {
  const { x, y, w, h } = zone.rect;
  return (
    <rect
      x={x * W}
      y={y * H}
      width={w * W}
      height={h * H}
      rx={Math.min(w * W, h * H) * 0.12}
      fill="none"
      style={{ stroke: ink ?? "var(--sp-idle)" }}
      strokeOpacity={ink ? 0.4 : 1}
      strokeWidth={1}
      strokeDasharray="2 3"
      vectorEffect="non-scaling-stroke"
      aria-hidden
    />
  );
}

function Zone({
  rect,
  position: p,
  W,
  H,
  active,
  onHover,
  onPick,
  onPhoto = false,
  still = false,
}: {
  rect: PhotoRect;
  position: Position;
  W: number;
  H: number;
  active: boolean;
  onHover: (id: string | null) => void;
  onPick: (p: Position) => void;
  onPhoto?: boolean;
  /** A picture of the spot (the checkout's), not a control: no focus, no clicks. */
  still?: boolean;
}) {
  useT(); // zoneFigure's words, in the language on screen
  const rx = rect.x * W;
  const ry = rect.y * H;
  const rw = rect.w * W;
  const rh = rect.h * H;
  const radius = Math.min(rw, rh) * 0.12;
  // The figure drawn in an open zone is what it costs to take it now. On a
  // takeover board it is also where bidding opens, and the spoken label says so:
  // the card is where a reader learns what the next hand would cost.
  const figure = zoneFigure(p);
  const price = p.status === "open" ? figure.spoken : "";
  const label = [p.label, STATUS_LABEL[p.status].toLowerCase(), price, p.sponsor?.name ?? ""]
    .filter(Boolean)
    .join(", ");

  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(p);
    }
  };

  return (
    <g
      role={still ? undefined : "button"}
      tabIndex={still ? -1 : 0}
      aria-label={still ? undefined : label}
      className="cursor-pointer outline-none [&:focus-visible>rect:first-of-type]:stroke-sp-ink"
      onPointerEnter={() => onHover(p.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(p.id)}
      onBlur={() => onHover(null)}
      onClick={() => onPick(p)}
      onKeyDown={onKey}
    >
      <title>{label}</title>
      {p.status === "open" && (
        <>
          <rect
            x={rx}
            y={ry}
            width={rw}
            height={rh}
            rx={radius}
            fill={
              onPhoto
                ? active
                  ? PHOTO_OPEN_FILL_ACTIVE
                  : PHOTO_OPEN_FILL
                : active
                  ? ZONE.openFillHover
                  : ZONE.openFill
            }
            stroke={active ? ACTIVE_STROKE : ZONE.openStroke}
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
          />
          <FittedText
            text={figure.short}
            x={rx}
            y={ry}
            w={rw}
            h={rh}
            fill="#F4F6FA"
            minVisible={14}
          />
        </>
      )}

      {p.status === "held" && (
        <>
          {onPhoto && <rect x={rx} y={ry} width={rw} height={rh} rx={radius} fill={PHOTO_OPEN_FILL} />}
          <rect
            x={rx}
            y={ry}
            width={rw}
            height={rh}
            rx={radius}
            fill={active ? HELD_FILL_ACTIVE : ZONE.heldFill}
            stroke={ZONE.heldStroke}
            strokeWidth={1.25}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}

      {p.status === "sold" && <SoldZone p={p} x={rx} y={ry} w={rw} h={rh} radius={radius} active={active} />}

      {/* One brand bought the whole piece, so this square was never sold and
          carries nobody's logo. A quiet plate: it is not for sale, and it is
          not an achievement to shout about either. */}
      {p.status === "closed" && (
        <rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          rx={radius}
          fill={ZONE.soldFill}
          opacity={0.45}
          stroke={ZONE.idleStroke}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

function SoldZone({
  p,
  x,
  y,
  w,
  h,
  radius,
  active,
}: {
  p: Position;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  active: boolean;
}) {
  const t = useT();
  const s = p.sponsor;
  const pad = Math.min(w, h) * 0.1;
  const edge = (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={radius}
      fill="none"
      stroke={active ? ACTIVE_STROKE : ZONE.soldFill}
      strokeWidth={1.25}
      vectorEffect="non-scaling-stroke"
    />
  );

  // A logo or photo on a white plate, so any artwork reads on the dark board.
  if (s?.imageUrl && (s.contentKind === "logo" || s.contentKind === "photo" || !s.contentText)) {
    return (
      <>
        <rect x={x} y={y} width={w} height={h} rx={radius} fill={ZONE.plate} />
        <image
          href={s.imageUrl}
          x={x + pad}
          y={y + pad}
          width={w - pad * 2}
          height={h - pad * 2}
          preserveAspectRatio={s.contentKind === "photo" ? "xMidYMid slice" : "xMidYMid meet"}
        />
        {edge}
      </>
    );
  }

  if (s?.contentKind === "qr" && s.contentText) {
    const qr = qrModules(s.contentText);
    const side = Math.min(w, h) - pad * 2;
    if (qr && side > 0) {
      return (
        <>
          <rect x={x} y={y} width={w} height={h} rx={radius} fill={ZONE.plate} />
          {/* A group, not a nested <svg>: the global `svg { height: auto }`
              reset would override a nested svg's height attribute. */}
          <g
            transform={`translate(${x + (w - side) / 2} ${y + (h - side) / 2}) scale(${side / qr.size})`}
            shapeRendering="crispEdges"
          >
            <path d={qr.d} fill={ZONE.soldInk} />
          </g>
          {edge}
        </>
      );
    }
  }

  // Text, a name, or a sale whose content the creator has not approved yet.
  const words = s ? s.contentText || s.name : t("board.status.sold");
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={radius} fill={ZONE.soldFill} />
      <FittedText text={words} x={x} y={y} w={w} h={h} fill={ZONE.soldInk} minVisible={12} />
      {edge}
    </>
  );
}

/**
 * One line of text centred in a zone, shrunk to fit and cut with an ellipsis
 * when it cannot. Plain SVG text rather than foreignObject, which Safari
 * misplaces inside a scaled SVG.
 *
 * @param minVisible zones smaller than this (in viewBox units, either side)
 *   draw no text at all; a price squeezed into a 6-unit sticker is noise.
 */
function FittedText({
  text,
  x,
  y,
  w,
  h,
  fill,
  minVisible,
}: {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  minVisible: number;
}) {
  if (w < minVisible || h < minVisible * 0.6) return null;
  const charW = 0.58; // average glyph width as a share of font size
  const room = w * 0.86;
  let size = Math.min(h * 0.5, room / Math.max(text.length * charW, 1));
  let shown = text;
  const floor = h * 0.24;
  if (size < floor) {
    size = floor;
    const fits = Math.max(1, Math.floor(room / (size * charW)));
    shown = text.length > fits ? `${text.slice(0, Math.max(1, fits - 1))}…` : text;
  }
  return (
    <text
      x={x + w / 2}
      y={y + h / 2}
      fill={fill}
      fontSize={size}
      fontWeight={500}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontFamily: "var(--font-body)", pointerEvents: "none" }}
    >
      {shown}
    </text>
  );
}

/**
 * What an open zone shows, and what a screen reader says after its name: the
 * price, or on an offers board the word "Offer", or on a bids board the highest
 * bid (else where bidding opens). Amounts are the server's strings.
 */
function zoneFigure(p: Position): { short: string; spoken: string } {
  const o = p.offers;
  if (o?.mode === "bids") {
    if (o.highestBidUsdc) {
      return { short: priceShort(o.highestBidUsdc), spoken: translate("board.product.highestBid", { amount: usdFromUsdc(o.highestBidUsdc) }) };
    }
    if (o.openingBidUsdc) {
      return { short: priceShort(o.openingBidUsdc), spoken: translate("board.product.biddingOpensAt", { amount: usdFromUsdc(o.openingBidUsdc) }) };
    }
    return { short: translate("board.tiers.bid"), spoken: translate("board.product.openForBids") };
  }
  if (o?.mode === "offers" || p.sponsorPaysUsdc === null) {
    return { short: translate("board.product.offer"), spoken: translate("board.product.openToOffers") };
  }
  const amount = usdFromUsdc(p.sponsorPaysUsdc);
  return {
    short: priceShort(p.sponsorPaysUsdc),
    spoken: p.takeover ? translate("board.product.biddingOpensAt", { amount }) : amount,
  };
}

/** "525.00" to "$525", "12.50" to "$12.50". Formatting only. */
function priceShort(usdc: string): string {
  const [whole, frac = "00"] = usdc.split(".");
  return /^0*$/.test(frac) ? `$${whole}` : `$${whole}.${frac.padEnd(2, "0").slice(0, 2)}`;
}
