import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PreviewBody } from "@/components/ad-space/PreviewBody";
import { PreviewCanvas } from "@/components/ad-space/PreviewCanvas";
import { previewModeOf } from "@/lib/ad-space/preview-bridge";
import { getPublicSpace } from "@/lib/ad-space/server";
import { effectParam, groundParam, titleStyleParam } from "@/lib/ad-space/studio";

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
 * `?embed=app` IS THE APP'S WEBVIEW, `&edit=1` ITS EDITOR
 *
 * Inside the HOLD app the page is framed by the app's own screen, so the
 * site's chrome goes (the footer, and the "sell your own" line written for a
 * stranger) and nothing on it acts: no checkout, no offer, no link out. The
 * page is then drawn by `PreviewCanvas`, which loads the creator's own read
 * (drafts included) with the app's token, makes the page tappable part by
 * part when `edit=1`, and redraws from the app's live updates without a
 * reload. `edit=1` means nothing without `embed=app`. The protocol, message
 * by message, is lib/ad-space/preview-bridge.ts.
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
  const mode = previewModeOf(searchParams);

  const ground = groundParam(searchParams.ground);
  const titleStyle = titleStyleParam(searchParams.titleStyle);
  const effect = effectParam(searchParams.effect);
  const overrides = {
    ...(ground ? { pageGround: ground } : {}),
    ...(titleStyle ? { titleStyle } : {}),
    ...(effect ? { effect } : {}),
  };

  // In the app a draft is not missing: the public read never answers for one,
  // and the creator's own read (with the app's token) happens in the canvas.
  if (mode !== "public") {
    return <PreviewCanvas initial={found.kind === "found" ? found.space : null} overrides={overrides} edit={mode === "edit"} />;
  }

  if (found.kind === "missing") notFound();
  const space = found.kind === "found" ? { ...found.space, ...overrides } : null;
  return <PreviewBody space={space} ground={space ? space.pageGround ?? null : ground} embed={false} />;
}
