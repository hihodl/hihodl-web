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
import { useT } from "@/lib/app/i18n/react";

import { useHref } from "../base";
import { useShell } from "../Shell";
import { Chip, ChipRow, SectionLabel, SheetRow } from "./kit";

type Tab = "members" | "owed" | "teams" | "earnings";

export function TeamScreen({ tab }: { tab: string | null }) {
  const t = useT();
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
          { key: "members" as const, label: t("creator.teamScreen.members") },
          { key: "owed" as const, label: t("creator.teamScreen.owedToTeam") },
        ]
      : []),
    ...(onTeams
      ? [
          { key: "teams" as const, label: t("creator.teamScreen.teamsOn") },
          { key: "earnings" as const, label: t("creator.teamScreen.owedToYou") },
        ]
      : []),
  ];
  const active: Tab = tabs.some((x) => x.key === tab) ? (tab as Tab) : tabs[0]?.key ?? "members";

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2.5">
      {tabs.length > 1 ? (
        <ChipRow label={t("creator.teamScreen.team")}>
          {tabs.map((x) => (
            <Chip key={x.key} label={x.label} selected={active === x.key} href={`${href("/team")}?tab=${x.key}`} />
          ))}
        </ChipRow>
      ) : null}
      {active === "members" ? (
        <>
          <Members onChanged={onTeamChanged} />
          <SectionLabel>{t("creator.teamScreen.money")}</SectionLabel>
          <SheetRow
            icon="receipt-outline"
            title={t("creator.teamScreen.moneyTitle")}
            meta={t("creator.teamScreen.moneyMeta")}
            href={`${href("/team")}?tab=owed`}
          />
          {onTeams ? (
            <>
              <SectionLabel>{t("creator.teamScreen.teamsOnLabel")}</SectionLabel>
              <Seats version={0} />
              <SheetRow
                icon="checkbox-outline"
                title={t("creator.teamScreen.deliverTitle")}
                meta={t("creator.teamScreen.deliverMeta")}
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
            title={t("creator.teamScreen.deliverTitle")}
            meta={t("creator.teamScreen.deliverMeta")}
            href={href("/deliveries")}
          />
        </>
      ) : null}
      {active === "earnings" ? <Earnings /> : null}
    </div>
  );
}
