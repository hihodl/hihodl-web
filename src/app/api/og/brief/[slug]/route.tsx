import { ImageResponse } from "next/og";

import { OG, OG_H, OG_W, OgBanner, OgChip, clip } from "@/components/ad-space/og";
import { getPublicBrief } from "@/lib/ad-space/server";

/**
 * The link card for a brief: 1200 × 630.
 *
 * This is the card that does the work. A brand posts the link on X and what
 * most people ever see of the campaign is this image, so it carries the three
 * things somebody scrolling needs to stop: who is asking, what they get, and
 * whether it is still open. The ask itself is the headline, because it is the
 * brand's own sentence and it is already written to be read in a feed.
 *
 * A decided brief says so on the card. A link shared after the winner was
 * named should not still read as an open call.
 */

const CACHE = "public, max-age=300, s-maxage=300, stale-while-revalidate=3600";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const found = await getPublicBrief(params.slug.toLowerCase(), 60);
  if (found.kind === "missing") return new Response("Not found", { status: 404 });

  if (found.kind !== "found") {
    return new ImageResponse(<Card eyebrow="HiSpace" title="Brands are asking for creators." lines={[]} chip={null} />, {
      width: OG_W,
      height: OG_H,
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  }

  const { brief } = found;
  const brand = brief.brand.name ?? "A brand";
  const decided = brief.winners.length > 0;
  const money =
    brief.budgetCents > 0 ? `$${(brief.budgetCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : null;
  const pays = [money, brief.perks].filter(Boolean).join(" · ") || "Costs covered";
  const where = brief.event?.name ?? brief.city ?? null;

  return new ImageResponse(
    (
      <Card
        eyebrow={decided ? `${brand} · picked` : `${brand} is looking for ${brief.peopleWanted === 1 ? "one creator" : `${brief.peopleWanted} creators`}`}
        title={brief.title}
        lines={[pays, where].filter((l): l is string => !!l)}
        chip={decided ? "Decided" : brief.applicationsOpen ? "Open for entries" : "Entries closed"}
      />
    ),
    { width: OG_W, height: OG_H, headers: { "Cache-Control": CACHE } },
  );
}

function Card({
  eyebrow,
  title,
  lines,
  chip,
}: {
  eyebrow: string;
  title: string;
  lines: string[];
  chip: string | null;
}) {
  return (
    <OgBanner banner={{ imageUrl: null, gradient: "steel", credit: null }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 88, width: OG_W }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 26, color: OG.amber, letterSpacing: 2, textTransform: "uppercase" }}>
            {clip(eyebrow, 60)}
          </div>
          {chip ? <OgChip tone={chip === "Open for entries" ? "amber" : undefined}>{chip}</OgChip> : null}
        </div>
        <div style={{ marginTop: 28, fontSize: title.length > 60 ? 58 : 70, lineHeight: 1.05, maxWidth: 940 }}>
          {clip(title, 110)}
        </div>
        {lines.length > 0 && (
          <div style={{ marginTop: 32, display: "flex", gap: 20, fontSize: 30, color: OG.muted }}>
            {lines.map((l) => (
              <div key={l}>{clip(l, 48)}</div>
            ))}
          </div>
        )}
      </div>
    </OgBanner>
  );
}
