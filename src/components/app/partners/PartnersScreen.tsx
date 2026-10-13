"use client";

/**
 * HOLD Partners: app.hihodl.xyz/partners (and partners.hihodl.xyz).
 *
 * One read decides the screen (GET /partners/me):
 *   not on a team   the pitch and the form to apply
 *   pending         "we're reviewing it", with the link already kept for them
 *   active/paused   the desk: full width, its own side nav, tables
 *
 * The desk lives in HOLD web on purpose: a partner is paid into HOLD Savings,
 * so the money they earn is one tap from where they spend it. The shell's
 * Gate has already asked for a HOLD account with a wallet made in the app
 * (signed in with Apple, Google or email), so nothing here asks again. Every
 * person on a team has their own login and their own wallet.
 *
 * Owners and admins read the whole team or only what they brought; members
 * read what they brought. The section and the view are in the URL
 * (?s=travellers&view=me), so a link opens the right page.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { canSeeTeam, usePaged, usePartnerDashboard, usePartnerMe, type PartnerMe, type Scope, type TripRow } from "@/lib/app/partners";

import { BackHeader, Column, Notice } from "../hold";
import { ReadFailed } from "../money/kit";
import { Segmented, Skeleton } from "../ui";
import { ApplyScreen } from "./ApplyScreen";
import { CommissionsSection } from "./CommissionsSection";
import { DeskPanel, SECTIONS, SideNav, type Section } from "./desk";
import { LinksSection } from "./LinksSection";
import { OverviewSection } from "./OverviewSection";
import { PayoutsSection } from "./PayoutsSection";
import { PendingScreen } from "./PendingScreen";
import { SettingsSection } from "./SettingsSection";
import { TeamSection } from "./TeamSection";
import { TravellersSection } from "./TravellersSection";
import { TripsSection } from "./TripsSection";
import { Pill } from "./kit";

const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Member" } as const;

export function PartnersScreen() {
  const me = usePartnerMe();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const partner = me.data?.partner ?? null;
  const role = me.data?.me?.role ?? null;
  const team = canSeeTeam(role);
  const live = partner?.status === "active" || partner?.status === "paused";

  const raw = params.get("s") as Section | null;
  const section: Section = raw && SECTIONS.some((s) => s.key === raw && (team || !s.teamOnly)) ? raw : "overview";
  const scope: Scope = team && params.get("view") !== "me" ? "team" : "me";

  const go = useCallback(
    (next: { s?: Section; view?: Scope }) => {
      const q = new URLSearchParams(params.toString());
      if (next.s) next.s === "overview" ? q.delete("s") : q.set("s", next.s);
      if (next.view) next.view === "team" ? q.delete("view") : q.set("view", next.view);
      const qs = q.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const dashboard = usePartnerDashboard(live, scope);
  // Trip names for the filters: the most recent 200 is plenty for a select.
  const tripOptions = usePaged<TripRow>("partners/me/trips", { scope, limit: "200" }, live && section !== "overview");
  const trips = useMemo(() => tripOptions.items, [tripOptions.items]);

  /** A write answered with the partner: show it now, then read the rest again. */
  function took(next: PartnerMe) {
    void me.mutate(next, { revalidate: false });
    if (live) void dashboard.mutate();
  }

  if (me.error && !me.data) {
    return (
      <Column wide>
        <BackHeader title="Partners" />
        <DeskPanel>
          <ReadFailed title="Could not load HOLD Partners" onRetry={() => void me.mutate()} />
        </DeskPanel>
      </Column>
    );
  }

  if (!me.data) {
    return (
      <div className="flex w-full gap-6">
        <div className="hidden w-[208px] shrink-0 flex-col gap-2 lg:flex">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[96px]" />
            ))}
          </div>
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[320px]" />
        </div>
      </div>
    );
  }

  if (!partner || !me.data.me) {
    return (
      <Column wide>
        <BackHeader title="Partners" />
        <ApplyScreen onApplied={took} />
      </Column>
    );
  }

  if (partner.status === "pending") {
    return (
      <Column wide>
        <BackHeader title="Partners" />
        <PendingScreen partner={partner} link={me.data.link} />
      </Column>
    );
  }

  const myLink = role === "owner" ? (me.data.link ?? "") : (me.data.links.find((l) => !l.archived && l.mine && !l.main)?.url ?? me.data.link ?? "");
  const active = partner.status === "active";

  return (
    <div className="flex w-full min-w-0 flex-col pb-8">
      <BackHeader title="Partners" subtitle={partner.name} />
      <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:gap-6">
        <SideNav value={section} onChange={(s) => go({ s })} showTeam={team} />

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="truncate text-[22px] font-bold tracking-[-0.4px] text-white">{SECTIONS.find((s) => s.key === section)?.label}</h1>
              <Pill tone={role === "owner" ? "amber" : role === "admin" ? "blue" : "quiet"}>{ROLE_LABEL[role ?? "member"]}</Pill>
              {partner.status === "paused" ? <Pill tone="amber">Paused</Pill> : null}
            </div>
            {team && section !== "team" && section !== "settings" ? (
              <div className="w-[220px]">
                <Segmented
                  options={[
                    { value: "team" as Scope, label: "Whole team" },
                    { value: "me" as Scope, label: "Only mine" },
                  ]}
                  value={scope}
                  onChange={(view) => go({ view })}
                  label="Whose numbers"
                />
              </div>
            ) : null}
          </div>

          {partner.status === "paused" ? (
            <Notice icon="pause-outline">Your partner account is paused. New bookings do not earn and payouts wait until it is active again.</Notice>
          ) : null}

          {section === "overview" ? (
            dashboard.error && !dashboard.data ? (
              <DeskPanel>
                <ReadFailed title="Could not load your numbers" onRetry={() => void dashboard.mutate()} />
              </DeskPanel>
            ) : !dashboard.data || dashboard.data.scope !== scope ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-[96px]" />
                  ))}
                </div>
                <Skeleton className="h-[160px]" />
                <Skeleton className="h-[220px]" />
              </div>
            ) : (
              <OverviewSection data={dashboard.data} link={myLink} scope={scope} onLinkSaved={took} go={(s) => go({ s })} />
            )
          ) : section === "travellers" ? (
            <TravellersSection scope={scope} trips={trips} />
          ) : section === "trips" ? (
            <TripsSection scope={scope} active={active} onChanged={() => tripOptions.reload()} />
          ) : section === "commissions" ? (
            <CommissionsSection scope={scope} trips={trips} />
          ) : section === "payouts" ? (
            <PayoutsSection scope={scope} billing={dashboard.data?.billing ?? "missing"} payoutsEnabled={dashboard.data?.payoutsEnabled ?? false} go={(s) => go({ s })} />
          ) : section === "links" ? (
            <LinksSection scope={scope} canManageAny={team} active={active} />
          ) : section === "team" && me.data.me ? (
            <TeamSection partner={partner} me={me.data.me} onChanged={() => void me.mutate()} />
          ) : (
            <SettingsSection
              partner={partner}
              me={me.data.me}
              onSaved={took}
              onLeft={() => {
                void me.mutate();
                go({ s: "overview" });
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
