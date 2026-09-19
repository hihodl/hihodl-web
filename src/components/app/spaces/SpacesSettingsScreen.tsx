"use client";

/**
 * Spaces › Settings: what is Spaces' own.
 *
 *   Ready to publish  the publish gate's checks, in its order (`publishRefusal`
 *                     on the backend), each a link to the Account screen that
 *                     fixes it
 *   Creative Director run a team: the Team page, "Who works it" on every
 *                     listing, the title under your name (lib/app/agency)
 *   Page background   the grounds of your profile and your listings: the same
 *                     screen as Settings › Your pages (./YourPages)
 *
 * Who you are and where you get paid are the person's, on Account.
 */

import { useHref } from "../base";
import { HoldCard, MenuRow, Switch } from "../hold";
import { Ion } from "../ion";
import { useShell } from "../Shell";
import { SectionLabel } from "./kit";
import { ReadyToPublish } from "./ReadyToPublish";
import { YourPagesCard, YourPagesScreen } from "./YourPages";

export function SpacesSettingsScreen({ screen, item }: { screen?: string; item?: string }) {
  const href = useHref();
  if (screen === "background") {
    return (
      <YourPagesScreen base={href("/settings?screen=background")} back={href("/settings")} backLabel="Settings" item={item} />
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
      <ReadyToPublish />
      <div className="flex flex-col gap-4">
        <CreativeDirector />
        <div className="flex flex-col gap-2.5">
          <SectionLabel>Your pages</SectionLabel>
          <YourPagesCard href={href("/settings?screen=background")} title="Page background" />
        </div>
      </div>
    </div>
  );
}

/**
 * Creator or Creative Director: one switch, on the app's settings card (its
 * Row with a Switch on the right). On, the Team page appears, the title under
 * the name changes and every listing gains "Who works it". While a team
 * exists it stays on (the server's `/ad-space/settings` keeps the choice;
 * lib/app/agency).
 */
function CreativeDirector() {
  const { agency } = useShell();
  const href = useHref();
  const on = agency.on;
  return (
    <section id="team" aria-label="Creative Director" className="flex flex-col gap-2.5">
      <SectionLabel>Team</SectionLabel>
      <HoldCard>
        <div className="flex w-full min-w-0 items-start gap-3 px-[18px] py-[18px]">
          <Ion name="people-outline" size={18} className="mt-[2px] shrink-0 text-white" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-5 text-white">Creative Director</span>
            <span className="mt-0.5 block text-[12px] leading-4 text-[#9FB7C2]">
              {agency.forced
                ? "On while you have a team."
                : "Run a team on your listings. You invite people by email, choose who works each listing, and set what each of them earns from a sale. You pay them; HOLD only keeps the count."}
            </span>
          </span>
          <Switch checked={on} onChange={(v) => agency.set(v)} label="Creative Director" disabled={agency.forced} />
        </div>
        {on ? <MenuRow icon="people-outline" label="Open Team" chevron href={href("/team")} /> : null}
      </HoldCard>
    </section>
  );
}
