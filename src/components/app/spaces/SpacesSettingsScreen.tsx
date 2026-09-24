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

import { useT } from "@/lib/app/i18n/react";

import { useHref } from "../base";
import { HoldCard, MenuRow, Switch } from "../hold";
import { Ion } from "../ion";
import { useShell } from "../Shell";
import { SectionLabel } from "./kit";
import { ReadyToPublish } from "./ReadyToPublish";
import { YourPagesCard, YourPagesScreen } from "./YourPages";

export function SpacesSettingsScreen({ screen, item }: { screen?: string; item?: string }) {
  const t = useT();
  const href = useHref();
  if (screen === "background") {
    return (
      <YourPagesScreen base={href("/settings?screen=background")} back={href("/settings")} backLabel={t("creator.settings.settings")} item={item} />
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
      <ReadyToPublish />
      <div className="flex flex-col gap-4">
        <CreativeDirector />
        <div className="flex flex-col gap-2.5">
          <SectionLabel>{t("creator.pages.title")}</SectionLabel>
          <YourPagesCard href={href("/settings?screen=background")} title={t("creator.settings.pageBackground")} />
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
  const t = useT();
  const { agency } = useShell();
  const href = useHref();
  const on = agency.on;
  return (
    <section id="team" aria-label={t("creator.settings.creativeDirector")} className="flex flex-col gap-2.5">
      <SectionLabel>{t("creator.teamScreen.team")}</SectionLabel>
      <HoldCard>
        <div className="flex w-full min-w-0 items-start gap-3 px-[18px] py-[18px]">
          <Ion name="people-outline" size={18} className="mt-[2px] shrink-0 text-white" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-5 text-white">{t("creator.settings.creativeDirector")}</span>
            <span className="mt-0.5 block text-[12px] leading-4 text-[#9FB7C2]">
              {agency.forced
                ? t("creator.settings.onWhileTeam")
                : t("creator.settings.cdBody")}
            </span>
          </span>
          <Switch checked={on} onChange={(v) => agency.set(v)} label={t("creator.settings.creativeDirector")} disabled={agency.forced} />
        </div>
        {on ? <MenuRow icon="people-outline" label={t("creator.settings.openTeam")} chevron href={href("/team")} /> : null}
      </HoldCard>
    </section>
  );
}
