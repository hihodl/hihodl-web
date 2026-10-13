"use client";

/**
 * HOLD Partners: app.hihodl.xyz/partners.
 *
 * One read decides the screen (GET /partners/me):
 *   no partner   the pitch and the form to apply
 *   pending      "we're reviewing it", with the link already kept for them
 *   active       Overview | Trips | Settings
 *   paused       the same, under a notice that nothing new earns for now
 *
 * The shell's Gate has already asked for a HOLD account with a wallet made in
 * the app, which is where a partner is paid, so nothing here asks again.
 */

import { useState } from "react";

import { usePartnerDashboard, usePartnerMe, usePartnerTrips, type PartnerMe } from "@/lib/app/partners";

import { BackHeader, Column, HoldCard, Notice } from "../hold";
import { ReadFailed } from "../money/kit";
import { Segmented, Skeleton } from "../ui";
import { ApplyScreen } from "./ApplyScreen";
import { OverviewTab } from "./OverviewTab";
import { PendingScreen } from "./PendingScreen";
import { SettingsTab } from "./SettingsTab";
import { TripsTab } from "./TripsTab";

type Tab = "overview" | "trips" | "settings";

const TABS: readonly { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "trips", label: "Trips" },
  { value: "settings", label: "Settings" },
];

export function PartnersScreen() {
  const me = usePartnerMe();
  const partner = me.data?.partner ?? null;
  const live = partner?.status === "active" || partner?.status === "paused";
  const dashboard = usePartnerDashboard(live);
  const [tab, setTab] = useState<Tab>("overview");
  const trips = usePartnerTrips(live && tab === "trips");

  /** A write answered with the partner: show it now, then read the rest again. */
  function took(next: PartnerMe) {
    void me.mutate(next, { revalidate: false });
    if (live) void dashboard.mutate();
  }

  const header = <BackHeader title="Partners" subtitle={partner && live ? partner.name : undefined} />;

  if (me.error && !me.data) {
    return (
      <Column wide>
        {header}
        <HoldCard className="mt-2">
          <ReadFailed title="Could not load HOLD Partners" onRetry={() => void me.mutate()} />
        </HoldCard>
      </Column>
    );
  }

  if (!me.data) {
    return (
      <Column wide>
        {header}
        <Skeleton className="mt-2 h-[220px]" />
        <Skeleton className="mt-4 h-[320px]" />
      </Column>
    );
  }

  if (!partner) {
    return (
      <Column wide>
        {header}
        <ApplyScreen onApplied={took} />
      </Column>
    );
  }

  if (partner.status === "pending") {
    return (
      <Column wide>
        {header}
        <PendingScreen partner={partner} link={me.data.link} />
      </Column>
    );
  }

  return (
    <Column wide>
      {header}
      <div className="flex flex-col gap-4">
        {partner.status === "paused" ? (
          <Notice icon="pause-outline">
            Your partner account is paused. New bookings do not earn and payouts wait until it is active again.
          </Notice>
        ) : null}

        <Segmented options={TABS} value={tab} onChange={setTab} label="Partner sections" />

        {tab === "overview" ? (
          dashboard.error && !dashboard.data ? (
            <HoldCard>
              <ReadFailed title="Could not load your numbers" onRetry={() => void dashboard.mutate()} />
            </HoldCard>
          ) : !dashboard.data ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[96px]" />
                ))}
              </div>
              <Skeleton className="h-[140px]" />
              <Skeleton className="h-[220px]" />
            </div>
          ) : (
            <OverviewTab data={dashboard.data} onLinkSaved={took} />
          )
        ) : tab === "trips" ? (
          <TripsTab
            trips={trips.data}
            error={trips.error}
            onRetry={() => void trips.mutate()}
            onChanged={() => void trips.mutate()}
            active={partner.status === "active"}
          />
        ) : (
          <SettingsTab partner={partner} onSaved={took} />
        )}
      </div>
    </Column>
  );
}
