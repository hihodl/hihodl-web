"use client";

import type { CSSProperties, KeyboardEvent } from "react";

import { STATUS_LABEL } from "@/lib/ad-space/format";
import type { Position, Template, TemplateView, TemplateZone } from "@/lib/ad-space/types";

import { qrModules } from "./qr";
import { ZONE } from "./ui";

/**
 * The product, drawn from the catalog: each view's outline in its own viewBox,
 * stroke only, and every zone a rectangle in FRACTIONS of that viewBox.
 *
 * All views share one scale (pixels per viewBox unit), so the side of a
 * suitcase is narrower than its front and a helmet is smaller than a race suit,
 * the way the real objects are. The scale is set so the tallest view is 200px
 * on a phone (two suitcase faces side by side at 400px) and 300px from `md` up.
 *
 * Zone states: open is a moonlight outline, held is an amber tint with a dashed
 * edge (someone is paying right now), sold is solid amber, or the sponsor's
 * approved logo, QR or text on a white plate. Zones nobody is selling are a
 * faint dashed outline and are not interactive.
 */

type Props = {
  template: Template;
  positions: Position[];
  activeId: string | null;
  onHover: (positionId: string | null) => void;
  onPick: (position: Position) => void;
};

export function ProductBoard({ template, positions, activeId, onHover, onPick }: Props) {
  const byZone = new Map(positions.map((p) => [p.zoneKey, p]));
  const tallest = Math.max(...template.views.map((v) => v.viewBox[1]), 1);

  const scaleVars = {
    "--u-sm": `${200 / tallest}px`,
    "--u-md": `${300 / tallest}px`,
  } as CSSProperties;

  return (
    <div
      className="flex flex-wrap items-end justify-center gap-x-4 gap-y-8 [--u:var(--u-sm)] md:gap-x-10 md:[--u:var(--u-md)]"
      style={scaleVars}
    >
      {template.views.map((view) => (
        <ViewFigure
          key={view.key}
          view={view}
          zones={template.zones.filter((z) => z.viewKey === view.key)}
          byZone={byZone}
          activeId={activeId}
          onHover={onHover}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

function ViewFigure({
  view,
  zones,
  byZone,
  activeId,
  onHover,
  onPick,
}: {
  view: TemplateView;
  zones: TemplateZone[];
  byZone: Map<string, Position>;
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
        {view.outline.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={ZONE.outline}
            strokeWidth={1.25}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {zones.map((z) => {
          const p = byZone.get(z.zoneKey);
          return p ? (
            <Zone
              key={z.zoneKey}
              zone={z}
              position={p}
              W={W}
              H={H}
              active={activeId === p.id}
              onHover={onHover}
              onPick={onPick}
            />
          ) : (
            <IdleZone key={z.zoneKey} zone={z} W={W} H={H} />
          );
        })}
      </svg>
      <figcaption className="text-tiny uppercase tracking-wider text-text-faint">{view.label}</figcaption>
    </figure>
  );
}

function IdleZone({ zone, W, H }: { zone: TemplateZone; W: number; H: number }) {
  const { x, y, w, h } = zone.rect;
  return (
    <rect
      x={x * W}
      y={y * H}
      width={w * W}
      height={h * H}
      rx={Math.min(w * W, h * H) * 0.12}
      fill="none"
      stroke={ZONE.idleStroke}
      strokeWidth={1}
      strokeDasharray="2 3"
      vectorEffect="non-scaling-stroke"
      aria-hidden
    />
  );
}

function Zone({
  zone,
  position: p,
  W,
  H,
  active,
  onHover,
  onPick,
}: {
  zone: TemplateZone;
  position: Position;
  W: number;
  H: number;
  active: boolean;
  onHover: (id: string | null) => void;
  onPick: (p: Position) => void;
}) {
  const rx = zone.rect.x * W;
  const ry = zone.rect.y * H;
  const rw = zone.rect.w * W;
  const rh = zone.rect.h * H;
  const radius = Math.min(rw, rh) * 0.12;
  const label = `${p.label}, ${STATUS_LABEL[p.status].toLowerCase()}${
    p.status === "open" ? `, ${p.sponsorPaysUsdc} USDC` : ""
  }${p.sponsor ? `, ${p.sponsor.name}` : ""}`;

  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(p);
    }
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      className="cursor-pointer outline-none [&:focus-visible>rect:first-of-type]:stroke-text"
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
            fill={active ? ZONE.openFillHover : ZONE.openFill}
            stroke={ZONE.openStroke}
            strokeWidth={active ? 2 : 1.25}
            vectorEffect="non-scaling-stroke"
          />
          <FittedText
            text={priceShort(p.sponsorPaysUsdc)}
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
        <rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          rx={radius}
          fill={ZONE.heldFill}
          stroke={ZONE.heldStroke}
          strokeWidth={active ? 2 : 1.25}
          strokeDasharray="3 2"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {p.status === "sold" && <SoldZone p={p} x={rx} y={ry} w={rw} h={rh} radius={radius} active={active} />}
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
      stroke={ZONE.soldFill}
      strokeWidth={active ? 2.5 : 1.25}
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
  const words = s ? s.contentText || s.name : "Sold";
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

/** "525.00" to "$525", "12.50" to "$12.50". Formatting only. */
function priceShort(usdc: string): string {
  const [whole, frac = "00"] = usdc.split(".");
  return /^0*$/.test(frac) ? `$${whole}` : `$${whole}.${frac.padEnd(2, "0").slice(0, 2)}`;
}
