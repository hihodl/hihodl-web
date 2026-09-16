import { ImageResponse } from "next/og";

import { OG, OG_H, OG_W, OgBanner, OgEventCard, loadOgImage } from "@/components/ad-space/og";
import { getPublicEvent } from "@/lib/ad-space/server";

/**
 * The link card for an event page: 1200 × 630, the city photo with the steel
 * gradient and a small card holding the name, city, dates and countdown.
 *
 * The page's og:image carries `?d=<today>`, so the countdown on a card X has
 * cached is at most a day old. `d` is only a cache key; the image always counts
 * from now. A merged slug draws the event it was merged into.
 */

const CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  let found = await getPublicEvent(params.slug, 300);
  if (found.kind === "moved") found = await getPublicEvent(found.slug, 300);
  if (found.kind === "missing") return new Response("Not found", { status: 404 });

  if (found.kind !== "found") {
    return new ImageResponse(<Fallback />, {
      width: OG_W,
      height: OG_H,
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  }

  const { event } = found.page;
  const image = await loadOgImage(event.coverUrl);
  return new ImageResponse(
    (
      <OgBanner banner={{ imageUrl: image, gradient: "steel", credit: image ? event.coverCredit : null }}>
        <OgEventCard event={event} now={Date.now()} />
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
        <div style={{ marginTop: 24, fontSize: 72, lineHeight: 1.05 }}>Sponsor creators going to the event.</div>
      </div>
    </OgBanner>
  );
}
