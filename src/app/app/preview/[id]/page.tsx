import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SpacesGround } from "@/components/ad-space/ground";
import { SpaceBoard } from "@/components/ad-space/SpaceBoard";
import {
  BeforeYouPay,
  HowItWorks,
  ListingHead,
  SpaceFooter,
  SpaceInvite,
  SpaceStats,
  SpaceUnavailable,
  SpaceUpdates,
} from "@/components/ad-space/sections";
import { getPublicSpace } from "@/lib/ad-space/server";
import { PAGE_GROUND_PRESETS } from "@/lib/ad-space/theme";

/**
 * The creator's own page, before anybody else can see it.
 *
 * A draft has no `/s/<handle>/<slug>`: `getPublicSpaceByPath` only answers for
 * a space that is live or closed, so until the day they publish, the one thing
 * a creator cannot look at is the thing they are building. This route is that
 * look. It renders the PUBLIC page — the same components, in the same order,
 * from the same read — so nothing here can drift from what a sponsor gets.
 * There is no second layout to keep in step, because there is no second layout.
 *
 * WHY IT LIVES UNDER /app AND NOT UNDER /s
 *
 * The console frames it, and a frame is same-origin or it is nothing:
 * `X-Frame-Options: DENY` covers the whole site, and the product has its own
 * origin in production (app.hihodl.xyz). A preview served from the product's
 * own tree is same-origin with the console that shows it, and next.config
 * relaxes the frame rule for this path alone.
 *
 * `?ground=` IS THE PENDING PICK, NOT THE SAVED ONE
 *
 * The background picker would otherwise only show its choice after saving it,
 * which is backwards: you choose a background by looking at it. The parameter
 * overrides the stored ground for this render and nothing else — it is read
 * nowhere but here, and the canonical page at /s never looks at it.
 *
 * Fresh every time (`revalidate: 0`): a preview that is ten seconds stale is a
 * preview of the wrong thing after every save.
 */

type Params = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

/** A preset name or a #RRGGBB. Anything else is ignored rather than drawn. */
function groundParam(searchParams: SearchParams): string | null {
  const g = searchParams.ground;
  if (typeof g !== "string") return null;
  if ((PAGE_GROUND_PRESETS as readonly string[]).includes(g)) return g;
  return /^#[0-9a-fA-F]{6}$/.test(g) ? g : null;
}

export default async function ListingPreviewPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  // `id` as the handle is the backend's own share shape for a space whose
  // creator has no handle on record; it maps to GET /public/spaces/:id.
  const found = await getPublicSpace("id", params.id, 0);
  if (found.kind === "missing") notFound();

  const override = groundParam(searchParams);

  return (
    <SpacesGround ground={found.kind === "found" ? override ?? found.space.pageGround ?? null : override}>
      {found.kind === "unreachable" ? (
        <main>
          <SpaceUnavailable />
        </main>
      ) : (
        <>
          <main className="overflow-x-clip">
            <SpaceBoard
              space={found.space}
              head={<ListingHead space={found.space} />}
              stats={<SpaceStats space={found.space} />}
              details={
                <>
                  <BeforeYouPay space={found.space} />
                  <HowItWorks space={found.space} />
                </>
              }
            />
            <SpaceUpdates space={found.space} />
            <SpaceInvite space={found.space} />
          </main>
          <SpaceFooter space={found.space} />
        </>
      )}
    </SpacesGround>
  );
}
