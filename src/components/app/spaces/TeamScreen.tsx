"use client";

/**
 * Spaces › Team: members and invitations, what the creator owes them, and —
 * for somebody who works for other creators — the teams they are on and what
 * they are owed. One tab at a time (`?tab=`).
 *
 * The cards are the console's own (`Members`, `Owed`, `Seats`, `Earnings`),
 * laid out as the app's Your team: the people, then a row into the money,
 * then the teams this person is on with a row into what they deliver. HOLD
 * never moves this money: it is the creator's bookkeeping, paid by the
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
import { Chip, ChipRow, SectionLabel, SheetRow } from "./kit";

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
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2.5">
      {tabs.length > 1 ? (
        <ChipRow label="Team">
          {tabs.map((t) => (
            <Chip key={t.key} label={t.label} selected={active === t.key} href={`${href("/team")}?tab=${t.key}`} />
          ))}
        </ChipRow>
      ) : null}
      {active === "members" ? (
        <>
          <Members onChanged={onTeamChanged} />
          <SectionLabel>Money</SectionLabel>
          <SheetRow
            icon="receipt-outline"
            title="What you owe, and what you're owed"
            meta="Your own records. You pay your team yourself."
            href={`${href("/team")}?tab=owed`}
          />
          {onTeams ? (
            <>
              <SectionLabel>Teams you&apos;re on</SectionLabel>
              <Seats version={0} />
              <SheetRow
                icon="checkbox-outline"
                title="What you have to deliver"
                meta="The listings you were put on, and what's still to do"
                href={href("/deliveries")}
              />
            </>
          ) : null}
        </>
      ) : null}
      {active === "owed" ? <Owed /> : null}
      {active === "teams" ? (
        <>
          <Seats version={0} />
          <SheetRow
            icon="checkbox-outline"
            title="What you have to deliver"
            meta="The listings you were put on, and what's still to do"
            href={href("/deliveries")}
          />
        </>
      ) : null}
      {active === "earnings" ? <Earnings /> : null}
    </div>
  );
}
