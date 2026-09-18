"use client";

/**
 * Spaces › Team: members and invitations, what the creator owes them, and —
 * for somebody who works for other creators — the teams they are on and what
 * they are owed. One tab at a time (`?tab=`).
 *
 * The cards are the console's own (`Members`, `Owed`, `Seats`, `Earnings`).
 * HOLD never moves this money: it is the creator's bookkeeping, paid by the
 * creator.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { Members, Seats } from "@/components/creator/team/Members";
import { Earnings, Owed } from "@/components/creator/team/Money";
import { useRefresh } from "@/lib/app/spaces-data";
import { pendingSeat } from "@/lib/creator/team";

import { useHref } from "../base";
import { useShell } from "../Shell";
import { LinkTabs } from "../ui";

type Tab = "members" | "owed" | "teams" | "earnings";

export function TeamScreen({ tab }: { tab: string | null }) {
  const { role, seats } = useShell();
  const href = useHref();
  const router = useRouter();
  const refresh = useRefresh();
  // The shell reads the team too: whether this person is a Creative Director follows it.
  const onTeamChanged = useCallback(() => void refresh("team"), [refresh]);

  // Back from a sign-in link, which lands without the seat: the one kept in
  // this browser is reopened by its address, so the server reads it again.
  useEffect(() => {
    const kept = pendingSeat();
    if (kept) router.replace(href(`/team?seat=${encodeURIComponent(kept.seat)}`));
  }, [router, href]);

  const onTeams = seats.some((s) => s.status === "active");
  const tabs: { key: Tab; label: string }[] = [
    ...(role === "creator"
      ? [
          { key: "members" as const, label: "Members" },
          { key: "owed" as const, label: "Owed to team" },
        ]
      : []),
    ...(onTeams
      ? [
          { key: "teams" as const, label: "Teams you’re on" },
          { key: "earnings" as const, label: "Owed to you" },
        ]
      : []),
  ];
  const active: Tab = tabs.some((t) => t.key === tab) ? (tab as Tab) : tabs[0]?.key ?? "members";

  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 ? (
        <LinkTabs active={active} tabs={tabs.map((t) => ({ ...t, href: `${href("/team")}?tab=${t.key}` }))} />
      ) : null}
      <div className={`w-full ${active === "members" ? "" : "mx-auto max-w-[860px]"}`}>
        {active === "members" ? <Members onChanged={onTeamChanged} /> : null}
        {active === "owed" ? <Owed /> : null}
        {active === "teams" ? <Seats version={0} /> : null}
        {active === "earnings" ? <Earnings /> : null}
      </div>
    </div>
  );
}
