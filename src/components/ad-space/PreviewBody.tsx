import { effectOf } from "@/lib/ad-space/studio";
import type { Space } from "@/lib/ad-space/types";

import { SpacesGround } from "./ground";
import { SpaceBoard } from "./SpaceBoard";
import { StudioSections } from "./StudioSections";
import {
  BeforeYouPay,
  HowItWorks,
  ListingHead,
  SpaceFooter,
  SpaceInvite,
  SpaceStats,
  SpaceUnavailable,
  SpaceUpdates,
} from "./sections";

/**
 * The preview's one layout: the public page's components, in its order. The
 * server renders it for the console's frame and the client re-renders it for
 * the app's WebView (PreviewCanvas), so the two can never drift apart.
 *
 * `embed` drops the site's chrome (the footer, the "sell your own" line).
 * `space` null with `ground` set is the page while the owner's read is on its
 * way: the ground alone, no "unavailable" flash.
 */
export function PreviewBody({
  space,
  ground,
  embed,
  pending = false,
}: {
  space: Space | null;
  ground: string | null;
  embed: boolean;
  pending?: boolean;
}) {
  return (
    <SpacesGround ground={ground} effect={space ? effectOf(space.effect) : "none"}>
      {!space ? (
        pending ? null : (
          <main>
            <SpaceUnavailable />
          </main>
        )
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
