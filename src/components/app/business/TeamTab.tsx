"use client";

/**
 * Business › Team: who holds a seat on the business and as what. Read only:
 * inviting, removing and changing roles live on Spaces › Team, which already
 * does all three, so this links there instead of doing them twice.
 *
 * On a business an active seat covers every space of the owner (the roles
 * contract), so the role is the whole story: what each can do is said once
 * under the list.
 */

import { useTeam } from "@/lib/app/spaces-data";
import { useT } from "@/lib/app/i18n/react";

import { useHref } from "../base";
import { btnGlassPill, Card, Empty, ListRow, SectionLabel, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { ErrorNote } from "./parts";

export function TeamTab() {
  const t = useT();
  const href = useHref();
  const team = useTeam();
  const seats = (team.data ?? []).filter((m) => m.status !== "removed");

  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel right={<a href={href("/team")} className={btnGlassPill}>{t("business.team.manage")}</a>}>{t("business.team.seats")}</SectionLabel>
      {team.error ? (
        <ErrorNote error={team.error} />
      ) : !team.data ? (
        <Skeleton className="h-32" />
      ) : seats.length === 0 ? (
        <Card>
          <Empty icon="people-outline" title={t("business.team.emptyTitle")} body={t("business.team.emptyBody")} />
        </Card>
      ) : (
        <Card className="gap-0 py-1.5">
          {seats.map((m) => (
            <ListRow
              key={m.id}
              title={m.label}
              meta={m.status === "invited" ? t("business.team.invited") : t("business.team.active")}
              right={<Tag label={t(`business.role.${m.role}` as const)} tone={m.status === "invited" ? "dim" : "calm"} />}
            />
          ))}
        </Card>
      )}
      <SectionLabel>{t("business.team.rolesTitle")}</SectionLabel>
      <Card className="gap-2">
        <p className="text-[13.5px] leading-5 text-white/[0.82]">{t("business.team.managerCan")}</p>
        <p className="text-[13.5px] leading-5 text-white/[0.82]">{t("business.team.repCan")}</p>
        <p className="text-[13.5px] leading-5 text-white/[0.82]">{t("business.team.ownerOnly")}</p>
      </Card>
    </div>
  );
}
