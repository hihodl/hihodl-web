import { ImageResponse } from "next/og";

import { OG, OgBanner, OgEventCard, clip as clipOg, loadOgImage } from "@/components/ad-space/og";
import {
  payChainsText,
  bidsSummaryText,
  serviceName,
  spaceProgressText,
  spaceSoldOut,
  spaceTiers,
  takeableSpots,
  usdFromCents,
  type SpaceTier,
} from "@/lib/ad-space/format";
import { bannerFor } from "@/lib/ad-space/look";
import { getPublicSpace } from "@/lib/ad-space/server";
import type { Position, Space, SpacePhoto, TemplateView } from "@/lib/ad-space/types";

/**
 * The link card for an Ad Space: 1200 × 630, the board as it stands now.
 *
 * The page's og:image carries `?m=<sold>`, so every milestone is a new URL and
 * X fetches a fresh card instead of showing the one it cached at the first
 * share. The image itself always draws the live board; `m` is the cache key.
 *
 * Satori renders this, so: flex layout only, no classes, inline SVG with
 * explicit sizes, and the default font. Fetching is the slow part, so the API
 * read is cached for 30 s and the image for 5 minutes.
 *
 * A space for an event draws the event's composition instead of the board: the
 * banner (creator image, then city photo, then gradient), the event's small card,
 * and "@handle is going to {event}" with the creator's avatar, so every creator
 * who shares a link advertises the event too. The board count stays on it.
 *
 * A space sold by bidding (hispace-offers-v0.md) adds the highest bid and the
 * time left, counted when the card is drawn: the card is cached for 5 minutes,
 * and "2d left" is as fine as a picture on X can honestly be.
 */

const W = 1200;
const H = 630;
const PAD = 56;
const BOARD_W = 500;
const BOARD_H = H - PAD * 2;

const C = {
  bg: "#141F2E",
  text: "#F4F6FA",
  muted: "#9BA3B0",
  faint: "#5A6068",
  amber: "#FFB703",
  moonlight: "#5B7CFF",
  outline: "rgba(244,246,250,0.6)",
  idle: "rgba(255,255,255,0.18)",
};

const CACHE = "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";

export async function GET(_req: Request, { params }: { params: { handle: string; slug: string } }) {
  const found = await getPublicSpace(params.handle, params.slug, 30);
  if (found.kind === "missing") return new Response("Not found", { status: 404 });

  if (found.kind === "unreachable") {
    return new ImageResponse(<Fallback />, {
      width: W,
      height: H,
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  }

  if (found.space.event) {
    return new ImageResponse(await EventCard({ space: found.space }), {
      width: W,
      height: H,
      headers: { "Cache-Control": CACHE },
    });
  }

  return new ImageResponse(<Card space={found.space} />, {
    width: W,
    height: H,
    headers: { "Cache-Control": CACHE },
  });
}

async function EventCard({ space: s }: { space: Space }) {
  const event = s.event!;
  const banner = bannerFor(s, event);
  const [image, avatar] = await Promise.all([loadOgImage(banner.imageUrl), loadOgImage(s.creator.xAvatarUrl)]);
  // A takeover board is never "sold out" while a sold spot can still be taken.
  const soldOut = spaceSoldOut(s);
  const progress = spaceProgressText(s);
  const bids = bidsSummaryText(s);

  return (
    <OgBanner banner={{ ...banner, imageUrl: image, credit: image ? banner.credit : null }}>
      <OgEventCard
        event={event}
        now={Date.now()}
        compact
        header={
          <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>
              <img src={avatar} alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: 32 }} />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#2C4566",
                  fontSize: 30,
                }}
              >
                {(s.creator.xName || s.creator.xHandle).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", marginLeft: 18, fontSize: 30 }}>
              {`@${clipOg(s.creator.xHandle, 15)} is going to ${clipOg(event.name, 22)}`}
            </div>
          </div>
        }
        footer={
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 18,
              paddingTop: 16,
              borderTop: `1px solid ${OG.cardBorder}`,
            }}
          >
            <div style={{ fontSize: 24, color: OG.muted }}>{clipOg(s.title, 48)}</div>
            <div style={{ fontSize: 28, color: soldOut ? OG.amber : OG.text, marginTop: 4 }}>{progress}</div>
            {bids && <div style={{ fontSize: 28, color: OG.amber, marginTop: 4 }}>{bids}</div>}
          </div>
        }
      />
    </OgBanner>
  );
}

function Card({ space: s }: { space: Space }) {
  const { totals } = s;
  const isTakeover = s.pricingMode === "takeover";
  const soldOut = spaceSoldOut(s);
  const noun = s.kind === "service" ? "slots" : "spots";
  // A takeover board counts what can still be taken, as its page does.
  const headline = isTakeover ? takeableSpots(s) : totals.sold;
  // The bar tracks the headline, so the two never disagree.
  const pct = totals.positions ? Math.min(100, (headline / totals.positions) * 100) : 0;
  const name = serviceName(s);
  // A tiered service is drawn as its ladder: see Ladder.
  const tiers = spaceTiers(s);
  const full = [s.eventName, name].filter(Boolean).join(" · ");
  const eyebrow = full.length <= 38 ? full : (s.eventName ?? name);
  const bids = bidsSummaryText(s);
  /* Offers and bids have no listed total (`totalCents` null) and commit only
     what was paid at an agreed amount: nothing before the first sale, rather
     than "$0 committed". */
  const noTotal = totals.totalCents === null || s.pricingMode === "offers" || s.pricingMode === "bids";
  const committedLine =
    noTotal && totals.committedCents <= 0 ? null : `${usdFromCents(totals.committedCents)} committed in USDC`;

  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        padding: PAD,
        color: C.text,
        backgroundColor: C.bg,
        backgroundImage:
          "radial-gradient(60% 80% at 15% 20%, rgba(255,183,3,0.12), transparent 70%), radial-gradient(70% 70% at 100% 100%, rgba(79,112,144,0.30), transparent 70%)",
      }}
    >
      <div style={{ width: BOARD_W, height: BOARD_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {tiers.length > 0 ? (
          <Ladder tiers={tiers} />
        ) : s.template.kind === "service" ? (
          <Slots positions={s.positions} />
        ) : s.photo ? (
          <PhotoBoard photo={s.photo} positions={s.positions} />
        ) : (
          <Views space={s} />
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingLeft: 56,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 20, color: C.amber, letterSpacing: 2, textTransform: "uppercase" }}>
            {clip(eyebrow, 38)}
          </div>
          <div style={{ marginTop: 18, fontSize: 54, lineHeight: 1.08, letterSpacing: -1 }}>{clip(s.title, 60)}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {soldOut ? (
            <div style={{ fontSize: 104, lineHeight: 1, color: C.amber, letterSpacing: -3 }}>
              {isTakeover ? "ALL SETTLED" : "SOLD OUT"}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{ fontSize: 104, lineHeight: 1, letterSpacing: -3 }}>{`${headline} of ${totals.positions}`}</div>
              <div style={{ fontSize: 40, color: C.muted, marginLeft: 18 }}>
                {isTakeover ? `${noun} up for grabs` : `${noun} sold`}
              </div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              marginTop: 24,
              height: 10,
              width: "100%",
              borderRadius: 5,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ width: `${pct}%`, height: 10, borderRadius: 5, backgroundColor: C.amber }} />
          </div>
          {bids ? (
            <div style={{ display: "flex", marginTop: 18, fontSize: 32, color: C.amber }}>{bids}</div>
          ) : committedLine ? (
            <div style={{ display: "flex", marginTop: 18, fontSize: 28, color: C.muted }}>{committedLine}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginRight: 24 }}>
            <div style={{ fontSize: 32 }}>{`@${s.creator.xHandle}`}</div>
            <div style={{ fontSize: 20, color: C.faint, marginTop: 6 }}>
              {`USDC on ${payChainsText(s)}`}
            </div>
          </div>
          <div style={{ fontSize: 24, color: C.muted, letterSpacing: 1 }}>hihodl.xyz</div>
        </div>
      </div>
    </div>
  );
}

/**
 * The product views at one shared scale, in one row or two, whichever draws
 * them bigger.
 */
function Views({ space: s }: { space: Space }) {
  const views = s.template.views;
  if (views.length === 0) return null;
  const gap = 28;
  const byZone = new Map(s.positions.map((p) => [p.zoneKey, p]));

  const scaleFor = (rows: TemplateView[][]) => {
    const byWidth = Math.min(
      ...rows.map((r) => (BOARD_W - gap * (r.length - 1)) / r.reduce((a, v) => a + v.viewBox[0], 0)),
    );
    const tall = rows.reduce((a, r) => a + Math.max(...r.map((v) => v.viewBox[1])), 0);
    const byHeight = (BOARD_H - gap * (rows.length - 1)) / tall;
    return Math.min(byWidth, byHeight);
  };

  const one = [views];
  const half = Math.ceil(views.length / 2);
  const two = views.length > 1 ? [views.slice(0, half), views.slice(half)] : one;
  const rows = scaleFor(two) > scaleFor(one) ? two : one;
  const k = scaleFor(rows);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-end", gap }}>
          {row.map((v) => (
            <ViewSvg key={v.key} view={v} k={k} zones={s.template.zones.filter((z) => z.viewKey === v.key)} byZone={byZone} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * The creator's own photo with the spots on it, as big as the board allows.
 * Squares as on the drawing: sold filled amber, held a dashed amber, open a
 * moonlight edge over a dark glass so it reads on any photo. The API sends a
 * photo here only once every spot has its square.
 */
function PhotoBoard({ photo, positions }: { photo: SpacePhoto; positions: Position[] }) {
  const k = Math.min(BOARD_W / photo.width, BOARD_H / photo.height);
  const w = Math.round(photo.width * k);
  const h = Math.round(photo.height * k);
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, borderRadius: 18, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img> */}
      <img src={photo.url} alt="" width={w} height={h} style={{ width: w, height: h, objectFit: "cover" }} />
      {positions.map((p) => {
        if (!p.rect) return null;
        const r = p.rect;
        const side = Math.min(r.w * w, r.h * h);
        const box = {
          position: "absolute" as const,
          display: "flex",
          left: r.x * w,
          top: r.y * h,
          width: r.w * w,
          height: r.h * h,
          borderRadius: Math.max(4, side * 0.12),
        };
        if (p.status === "sold") return <div key={p.id} style={{ ...box, backgroundColor: C.amber }} />;
        if (p.status === "held") {
          return <div key={p.id} style={{ ...box, backgroundColor: "rgba(8,12,24,0.45)", border: `3px dashed ${C.amber}` }} />;
        }
        return <div key={p.id} style={{ ...box, backgroundColor: "rgba(8,12,24,0.58)", border: `3px solid ${C.moonlight}` }} />;
      })}
    </div>
  );
}

function ViewSvg({
  view,
  k,
  zones,
  byZone,
}: {
  view: TemplateView;
  k: number;
  zones: Space["template"]["zones"];
  byZone: Map<string, Position>;
}) {
  const [vw, vh] = view.viewBox;
  const sw = (px: number) => px / k;
  return (
    <svg width={vw * k} height={vh * k} viewBox={`0 0 ${vw} ${vh}`}>
      {view.outline.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={C.outline} strokeWidth={sw(2)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {zones.map((z) => {
        const p = byZone.get(z.zoneKey);
        const x = z.rect.x * vw;
        const y = z.rect.y * vh;
        const w = z.rect.w * vw;
        const h = z.rect.h * vh;
        const r = Math.min(w, h) * 0.12;
        if (!p) {
          return (
            <rect key={z.zoneKey} x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={C.idle} strokeWidth={sw(1.5)} strokeDasharray={`${sw(3)} ${sw(4)}`} />
          );
        }
        if (p.status === "sold") return <rect key={z.zoneKey} x={x} y={y} width={w} height={h} rx={r} fill={C.amber} />;
        if (p.status === "held") {
          return (
            <rect key={z.zoneKey} x={x} y={y} width={w} height={h} rx={r} fill="rgba(255,183,3,0.18)" stroke={C.amber} strokeWidth={sw(2)} strokeDasharray={`${sw(5)} ${sw(3)}`} />
          );
        }
        return <rect key={z.zoneKey} x={x} y={y} width={w} height={h} rx={r} fill="rgba(91,124,255,0.12)" stroke={C.moonlight} strokeWidth={sw(2)} />;
      })}
    </svg>
  );
}

/** A service: one tile per slot, sold ones filled. */
/**
 * A service ladder, as the ladder it is.
 *
 * A tiered listing is several different things at several prices — a $50 logo
 * in the mini strip, a $200 card and mic placement, a $1,300 flagship
 * interview. Drawn as slots it became ten identical squares, which threw away
 * the only thing that made the listing worth stopping on: that the rungs are
 * not the same rung. So each rung gets a row with its name, its price and
 * what is left of it.
 *
 * In the creator's order, which is the order they built the ladder in and the
 * order the API sends. At most four rows fit at this size legibly; a fifth
 * rung and beyond is counted on one line rather than shrinking every row.
 */
function Ladder({ tiers }: { tiers: SpaceTier[] }) {
  const shown = tiers.slice(0, 4);
  const more = tiers.length - shown.length;

  /** What the rung costs, or how it is sold when it carries no price. */
  const priceOf = (t: SpaceTier): string => {
    if (t.priceCents !== null) return usdFromCents(t.priceCents);
    return t.offers?.mode === "bids" ? "To the highest bid" : "Open to offers";
  };

  /** What is left of the rung, from the brand's side. */
  const leftOf = (t: SpaceTier): string => {
    const total = t.positions.length;
    if (t.open.length === 0) return total === 1 ? "Taken" : "All taken";
    if (total === 1) return "One only";
    return `${t.open.length} of ${total} left`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: BOARD_W, gap: 14 }}>
      {shown.map((t) => {
        const gone = t.open.length === 0;
        return (
          <div
            key={t.key}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: 18,
              borderRadius: 18,
              backgroundColor: gone ? "rgba(255,183,3,0.14)" : "rgba(91,124,255,0.12)",
              border: `3px solid ${gone ? C.amber : C.moonlight}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ display: "flex", fontSize: 26 }}>{clip(t.title, 20)}</div>
              <div style={{ display: "flex", fontSize: 30, color: C.amber, marginLeft: 12 }}>{priceOf(t)}</div>
            </div>
            <div style={{ display: "flex", fontSize: 20, color: C.muted, marginTop: 8 }}>{leftOf(t)}</div>
          </div>
        );
      })}
      {more > 0 && (
        <div style={{ display: "flex", fontSize: 22, color: C.muted, paddingLeft: 4 }}>
          {`+ ${more} more ${more === 1 ? "tier" : "tiers"}`}
        </div>
      )}
    </div>
  );
}

function Slots({ positions }: { positions: Position[] }) {
  const n = Math.max(positions.length, 1);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gap = 18;
  const side = Math.min((BOARD_W - gap * (cols - 1)) / cols, (BOARD_H - gap * (rows - 1)) / rows, 150);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap, width: cols * side + gap * (cols - 1) }}>
      {positions.map((p) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            width: side,
            height: side,
            borderRadius: 18,
            backgroundColor:
              p.status === "sold" ? C.amber : p.status === "held" ? "rgba(255,183,3,0.18)" : "rgba(91,124,255,0.12)",
            border: `3px ${p.status === "held" ? "dashed" : "solid"} ${p.status === "open" ? C.moonlight : C.amber}`,
          }}
        />
      ))}
    </div>
  );
}

function Fallback() {
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 96,
        color: C.text,
        backgroundColor: C.bg,
        backgroundImage: "radial-gradient(60% 80% at 15% 20%, rgba(255,183,3,0.14), transparent 70%)",
      }}
    >
      <div style={{ fontSize: 26, color: C.amber, letterSpacing: 2, textTransform: "uppercase" }}>HiSpace</div>
      <div style={{ marginTop: 24, fontSize: 72, lineHeight: 1.05 }}>Sponsor a creator directly, in USDC.</div>
      <div style={{ marginTop: 32, fontSize: 28, color: C.muted }}>hihodl.xyz</div>
    </div>
  );
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
