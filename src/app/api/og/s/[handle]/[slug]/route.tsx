import { ImageResponse } from "next/og";

import { OG, OgBanner, OgEventCard, clip as clipOg, loadOgImage } from "@/components/ad-space/og";
import { CHAIN_LABEL, usdFromCents } from "@/lib/ad-space/format";
import { bannerFor } from "@/lib/ad-space/look";
import { getPublicSpace } from "@/lib/ad-space/server";
import type { Position, Space, TemplateView } from "@/lib/ad-space/types";

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
  const { totals } = s;
  const noun = s.kind === "service" ? "slots" : "spots";
  const soldOut = totals.positions > 0 && totals.sold >= totals.positions;
  const progress = soldOut ? `Sold out: all ${totals.positions} ${noun} taken` : `${totals.sold} of ${totals.positions} ${noun} sold`;

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
          </div>
        }
      />
    </OgBanner>
  );
}

function Card({ space: s }: { space: Space }) {
  const { totals } = s;
  const soldOut = totals.positions > 0 && totals.sold >= totals.positions;
  const noun = s.kind === "service" ? "slots" : "spots";
  const pct = totals.positions ? Math.min(100, (totals.sold / totals.positions) * 100) : 0;
  const full = [s.eventName, s.template.name].filter(Boolean).join(" · ");
  const eyebrow = full.length <= 38 ? full : (s.eventName ?? s.template.name);

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
        {s.template.kind === "service" ? <Slots positions={s.positions} /> : <Views space={s} />}
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
            <div style={{ fontSize: 104, lineHeight: 1, color: C.amber, letterSpacing: -3 }}>SOLD OUT</div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{ fontSize: 104, lineHeight: 1, letterSpacing: -3 }}>{`${totals.sold} of ${totals.positions}`}</div>
              <div style={{ fontSize: 40, color: C.muted, marginLeft: 18 }}>{`${noun} sold`}</div>
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
          <div style={{ display: "flex", marginTop: 18, fontSize: 28, color: C.muted }}>
            {`${usdFromCents(totals.committedCents)} committed in USDC`}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginRight: 24 }}>
            <div style={{ fontSize: 32 }}>{`@${s.creator.xHandle}`}</div>
            <div style={{ fontSize: 20, color: C.faint, marginTop: 6 }}>
              {`USDC on ${s.chains.map((c) => CHAIN_LABEL[c]).join(", ")}`}
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
