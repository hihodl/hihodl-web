import { ImageResponse } from "next/og";

import { OG, OG_H, OG_W, OgBanner, OgChip, clip, loadOgImage } from "@/components/ad-space/og";
import { creatorTotalsText } from "@/lib/ad-space/format";
import { getPublicCreator } from "@/lib/ad-space/server";

/**
 * The link card for a creator's hub: 1200 × 630, the creator over the cover of
 * the first event they are going to.
 *
 * A hub is posted on X, so the card has to answer "who is this and what are
 * they selling" in one glance: the avatar, the name, the totals, and the events
 * as chips. The event photo is the background because that is the part a brand
 * recognises before it recognises the creator.
 *
 * Satori renders this, so: flex layout only, inline styles, no classes, the
 * default font. The page's og:image carries `?d=<today>`, which is a cache key
 * and nothing else; the image always counts from now.
 */

const CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(_req: Request, { params }: { params: { handle: string } }) {
  const found = await getPublicCreator(params.handle, 300);
  if (found.kind === "missing") return new Response("Not found", { status: 404 });

  if (found.kind !== "found") {
    return new ImageResponse(<Fallback />, {
      width: OG_W,
      height: OG_H,
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  }

  const { creator, groups, totals } = found.page;
  const cover = groups.find((g) => g.event?.coverUrl)?.event ?? null;
  const [photo, avatar] = await Promise.all([loadOgImage(cover?.coverUrl ?? null), loadOgImage(creator.xAvatarUrl)]);
  const events = groups.map((g) => g.event?.name).filter((n): n is string => Boolean(n));
  const name = creator.xName || `@${creator.xHandle}`;

  return new ImageResponse(
    (
      <OgBanner banner={{ imageUrl: photo, gradient: "steel", credit: photo ? cover?.coverCredit ?? null : null }}>
        <div
          style={{
            position: "absolute",
            left: 48,
            bottom: 40,
            maxWidth: 800,
            display: "flex",
            flexDirection: "column",
            padding: 32,
            borderRadius: 24,
            backgroundColor: OG.card,
            border: `1px solid ${OG.cardBorder}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>
              <img src={avatar} alt="" width={96} height={96} style={{ width: 96, height: 96, borderRadius: 48 }} />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#2C4566",
                  fontSize: 44,
                }}
              >
                {name.replace(/^@/, "").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 24 }}>
              <div style={{ fontSize: 56, lineHeight: 1.05, letterSpacing: -1.5 }}>{clip(name, 26)}</div>
              {creator.xName && (
                <div style={{ fontSize: 28, color: OG.muted, marginTop: 6 }}>{`@${clip(creator.xHandle, 15)}`}</div>
              )}
            </div>
          </div>

          {events.length > 0 && (
            <div style={{ display: "flex", marginTop: 26 }}>
              {events.slice(0, 3).map((e) => (
                <OgChip key={e}>{clip(e, 22)}</OgChip>
              ))}
              {events.length > 3 && <OgChip>{`+${events.length - 3} more`}</OgChip>}
            </div>
          )}

          <div
            style={{
              display: "flex",
              marginTop: 24,
              paddingTop: 20,
              borderTop: `1px solid ${OG.cardBorder}`,
              fontSize: 30,
              color: OG.amber,
            }}
          >
            {creatorTotalsText(totals)}
          </div>
        </div>
      </OgBanner>
    ),
    { width: OG_W, height: OG_H, headers: { "Cache-Control": CACHE } },
  );
}

function Fallback() {
  return (
    <OgBanner banner={{ imageUrl: null, gradient: "steel", credit: null }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 96 }}>
        <div style={{ fontSize: 26, color: OG.amber, letterSpacing: 2, textTransform: "uppercase" }}>HiSpace</div>
        <div style={{ marginTop: 24, fontSize: 72, lineHeight: 1.05 }}>Sponsor a creator directly, in USDC.</div>
      </div>
    </OgBanner>
  );
}
