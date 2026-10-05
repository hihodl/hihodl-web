import { ImageResponse } from "next/og";

import { OG, OG_H, OG_W, OgBanner, OgChip, OgEventCard, clip, loadOgImage } from "@/components/ad-space/og";
import { getSponsorPage } from "@/lib/ad-space/server";

/**
 * The link card for a sponsor page: the event's cover with the event page's
 * small card, and the host and their packages on it. The page's og:image
 * carries `?d=<today>` so the countdown is never a day stale.
 *
 * A Luma event nobody sells on HOLD yet (or a backend older than this page)
 * still gets a card: the Luma cover when we know it, and the invitation.
 */

const CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
const SHORT = { "Cache-Control": "public, max-age=60, s-maxage=60" };

export async function GET(_req: Request, { params }: { params: { lumaKey: string } }) {
  const found = await getSponsorPage(params.lumaKey, 300);

  if (found.kind === "found") {
    const { event, packages } = found.page;
    const image = await loadOgImage(event.coverUrl);
    const host = event.organiser ? event.organiser.businessName?.trim() || event.organiser.name : null;
    return new ImageResponse(
      (
        <OgBanner banner={{ imageUrl: image, gradient: "steel", credit: image ? event.coverCredit : null }}>
          <OgEventCard
            event={event}
            now={Date.now()}
            header={
              <div style={{ display: "flex", fontSize: 22, color: OG.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
                Sponsor this event
              </div>
            }
            footer={
              host ? (
                <div style={{ display: "flex", alignItems: "center", marginTop: 20 }}>
                  <OgChip>Verified host</OgChip>
                  <div style={{ fontSize: 26, color: OG.muted }}>
                    {packages.length > 0
                      ? `${clip(host, 24)} · ${packages.length} ${packages.length === 1 ? "package" : "packages"}`
                      : clip(host, 32)}
                  </div>
                </div>
              ) : undefined
            }
          />
        </OgBanner>
      ),
      { width: OG_W, height: OG_H, headers: { "Cache-Control": CACHE } },
    );
  }

  const luma = found.kind === "notOnHold" ? found.luma : null;
  const image = luma ? await loadOgImage(luma.coverUrl) : null;
  return new ImageResponse(
    (
      <OgBanner banner={{ imageUrl: image, gradient: "steel", credit: null }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 96px 120px" }}>
          {luma && <div style={{ fontSize: 30, color: OG.muted }}>{clip(luma.name, 40)}</div>}
          <div style={{ marginTop: 16, fontSize: 72, lineHeight: 1.05 }}>Is this your event?</div>
          <div style={{ marginTop: 16, fontSize: 34, color: OG.amber }}>Sell its sponsorship on HOLD</div>
        </div>
      </OgBanner>
    ),
    // Short either way: once the host starts selling, the card should say so within the minute.
    { width: OG_W, height: OG_H, headers: SHORT },
  );
}
