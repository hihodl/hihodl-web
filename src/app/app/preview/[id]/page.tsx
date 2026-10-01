import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SpacesGround } from "@/components/ad-space/ground";
import { PreviewReady } from "@/components/ad-space/PreviewReady";
import { SpaceBoard } from "@/components/ad-space/SpaceBoard";
import { StudioSections } from "@/components/ad-space/StudioSections";
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
import { effectOf, effectParam, titleStyleParam } from "@/lib/ad-space/studio";
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
 * `?titleStyle=` and `?effect=` work the same way for the studio's title
 * style and effect: the pending pick, for this render only.
 *
 * `?embed=app` IS THE APP'S WEBVIEW
 *
 * Inside the HOLD app the page is framed by the app's own screen, so the
 * site's chrome goes (the footer, and the "sell your own" line written for a
 * stranger), and once rendered it posts `{"type":"hold-preview-ready"}`
 * through `window.ReactNativeWebView.postMessage` so the app can drop its
 * loader. Anywhere else the message has nowhere to go and is not sent.
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
  const titleStyle = titleStyleParam(searchParams.titleStyle);
  const effect = effectParam(searchParams.effect);
  const embed = searchParams.embed === "app";
  const space =
    found.kind === "found"
      ? { ...found.space, ...(titleStyle ? { titleStyle } : {}), ...(effect ? { effect } : {}) }
      : null;

  return (
    <SpacesGround
      ground={space ? override ?? space.pageGround ?? null : override}
      effect={space ? effectOf(space.effect) : "none"}
    >
      {embed && <PreviewReady />}
      {!space ? (
        <main>
          <SpaceUnavailable />
        </main>
      ) : (
        <>
          <main className="overflow-x-clip">
            <SpaceBoard
              space={space}
              head={<ListingHead space={space} />}
              stats={<SpaceStats space={space} />}
              details={
                <>
                  <BeforeYouPay space={space} />
                  <StudioSections space={space} />
                  <HowItWorks space={space} />
                </>
              }
            />
            <SpaceUpdates space={space} />
            {!embed && <SpaceInvite space={space} />}
          </main>
          {!embed && <SpaceFooter space={space} />}
        </>
      )}
    </SpacesGround>
  );
}
