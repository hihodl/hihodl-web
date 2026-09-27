import { ImageResponse } from "next/og";

import { OG_H, OG_W, loadOgImage } from "@/components/ad-space/og";
import { PayOgCard } from "@/components/pay-links/og-card";
import { previewName, previewPrice, previewable } from "@/lib/pay-links/og-copy";
import { initialsFor, safeAvatarUrl } from "@/lib/pay-links/page-rules";
import { getPayLink, getPersonalPayLink } from "@/lib/pay-links/server";

/**
 * The link card's image for a pay page: 1200 × 630, in the page's own look
 * (the dark HOLD ground with its cyan glow at the top).
 *
 *   personal link   the person's face, big, their name and @handle
 *   priced link     the face and name small, then what it is for and its price, big
 *
 * The face is their photo only when their profile is public (the server sends
 * `face.avatarUrl` only then); private or invisible draws their initials on the
 * app's amber circle, never an emoji. No sentence is drawn, so the image is
 * the same in every language; the words live in og:title and og:description.
 *
 * Anything that goes wrong (no such link, a link that can't be paid, the API
 * down, Satori failing on a glyph) sends the static HOLD banner instead.
 */

const CACHE = "public, max-age=600, s-maxage=600, stale-while-revalidate=3600";

function fallback(req: Request): Response {
  return Response.redirect(new URL("/banner-social.png", req.url), 302);
}

export async function GET(req: Request, { params }: { params: { code: string } }) {
  try {
    const raw = decodeURIComponent(params.code);
    const personal = raw.startsWith("@");
    const found = personal ? await getPersonalPayLink(raw.slice(1), req.headers) : await getPayLink(raw, req.headers);
    const link = found.kind === "found" ? found.value : null;
    if (!previewable(link)) return fallback(req);

    const owner = link.owner;
    const name = previewName(owner) as string;
    const handle = owner?.handle ? `@${owner.handle}` : null;
    const [photo, logo] = await Promise.all([
      loadOgImage(safeAvatarUrl(owner?.face?.avatarUrl)),
      loadOgImage(new URL("/logo-white.png", req.url).href),
    ]);
    const initials = initialsFor(owner?.displayName, owner?.handle);
    const priced = !(personal || link.personal);
    const price = link.amount.mode === "fixed" ? previewPrice(link.amount.cents, "en-US") : null;

    const image = new ImageResponse(
      <PayOgCard name={name} handle={handle} photo={photo} logo={logo} initials={initials} title={priced ? link.title : null} price={priced ? price : null} />,
      { width: OG_W, height: OG_H },
    );
    // Rendered here, inside the try: a glyph Satori can't draw falls back to the banner, not to no card.
    const png = await image.arrayBuffer();
    return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": CACHE } });
  } catch {
    return fallback(req);
  }
}
