"use client";

/**
 * Spaces › Business: a company runs its HOLD business from a desk.
 *
 *   Profile    public name, logo, website; legal and billing details; tax note
 *   Treasury   the vault sponsors pay, its members, balance, last payments,
 *              and a pending change with its countdown and Cancel
 *   Inbox      enquiries from brands, answered in place, quotes, archive
 *   Events     the Luma events (and calendars) it hosts: claim one with a
 *              code, its sponsor link, its packages (`?claim=<luma link>`
 *              pre-fills the claim, from the sponsor page's "Claim it")
 *   Sales      invoices and receipts, their PDFs, the sales CSV
 *   Activity   who did what, by space, person and action
 *   Team       the seats and their roles, managed on Spaces › Team
 *
 * One tab at a time, in the address (`?tab=`), like Spaces › Team. An open
 * thread is `?e=<enquiryId>`, a change from its push `?change=<id>`.
 *
 * WHO IS LOOKING
 *
 * The signed-in account is the owner of its own business. Somebody who holds
 * a seat on another business acts for it as that seat's role (`?as=<seat>`):
 * manager or rep. The tabs a role would be refused are not drawn
 * (business-rules `tabsFor`), and a refusal that still arrives is said in
 * words, never as a failure.
 *
 * A seat names its owner's user id only once the backend sends `ownerUserId`
 * on `/ad-space/team/seats`; until then a team member's console is the inbox
 * (which lists every business they work for by itself) and the activity log
 * waits for that id.
 */

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { useBusinessProfile } from "@/lib/app/business";
import { pickTab, tabsFor, type BusinessRole, type BusinessTab } from "@/lib/app/business-rules";
import { useT } from "@/lib/app/i18n/react";
import { useCreatorSession } from "@/lib/creator/session";

import { useHref } from "../base";
import { useShell } from "../Shell";
import { Chip, ChipRow, h1, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { ActivityTab } from "./ActivityTab";
import { EventsTab } from "./EventsTab";
import { InboxTab } from "./InboxTab";
import { ErrorNote } from "./parts";
import { ProfileTab } from "./ProfileTab";
import { SalesTab } from "./SalesTab";
import { TeamTab } from "./TeamTab";
import { TreasuryTab } from "./TreasuryTab";

interface Acting {
  key: string;
  role: BusinessRole;
  /** The owner's user id, for `?asBusiness=`; null for the person's own, or when the seat does not name it. */
  ownerUserId: string | null;
  name: string;
}

export function BusinessScreen({
  tab,
  enquiry,
  change,
  as,
  claim = null,
}: {
  tab: string | null;
  enquiry: string | null;
  change: string | null;
  as: string | null;
  /** A Luma link to claim, handed over by the sponsor page. */
  claim?: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const href = useHref();
  const { seats, listings, work } = useShell();
  const { session } = useCreatorSession();
  const profile = useBusinessProfile();

  const others = useMemo<Acting[]>(
    () =>
      seats
        .filter((s) => s.status === "active")
        .map((s) => ({
          key: s.id,
          role: s.role,
          ownerUserId: s.ownerUserId ?? null,
          name: s.creatorName || (s.creatorHandle ? `@${s.creatorHandle}` : t("business.aTeam")),
        })),
    [seats, t],
  );

  const own: Acting = { key: "me", role: "owner", ownerUserId: null, name: profile.data?.profile?.displayName || t("business.yourBusiness") };
  const hasProfile = !!profile.data?.profile;
  // Somebody with no business of their own who sits on a team opens on that team.
  const acting = others.find((o) => o.key === as) ?? (as === "me" || hasProfile || others.length === 0 ? own : others[0]);
  const isOwn = acting.key === "me";

  const tabs = tabsFor(acting.role, { guardianChange: !!change, actingForOther: !isOwn && !!acting.ownerUserId });
  const active: BusinessTab = enquiry ? "inbox" : change && tabs.includes("treasury") && !tab ? "treasury" : pickTab(tab, tabs);

  const link = (next: Partial<{ tab: string; e: string | null; as: string }>) => {
    const q = new URLSearchParams();
    const asKey = next.as ?? acting.key;
    if (asKey !== "me" || others.length) q.set("as", asKey);
    q.set("tab", next.tab ?? active);
    if (next.e) q.set("e", next.e);
    if (change && (next.tab ?? active) === "treasury") q.set("change", change);
    return `${href("/business")}?${q}`;
  };

  const spaces = isOwn ? listings.map((l) => ({ id: l.id, title: l.title })) : work.map((w) => ({ id: w.spaceId, title: w.title }));

  if (profile.data === undefined && !profile.error) return <Skeleton className="mx-auto h-64 w-full max-w-[960px]" />;

  const label: Record<BusinessTab, string> = {
    profile: t("business.tab.profile"),
    treasury: t("business.tab.treasury"),
    inbox: t("business.tab.inbox"),
    events: t("business.tab.events"),
    sales: t("business.tab.sales"),
    activity: t("business.tab.activity"),
    team: t("business.tab.team"),
  };

  const verified = isOwn && profile.data?.profile?.verification.status === "verified";

  return (
    <div className={`mx-auto flex w-full flex-col gap-3 ${active === "inbox" ? "max-w-[1100px]" : "max-w-[760px]"}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className={`${h1} truncate`}>{acting.name}</h1>
          <span className="flex items-center gap-2 text-[12.5px] text-white/55">
            {isOwn ? t("business.role.owner") : t(`business.role.${acting.role}`)}
            {verified ? <Tag label={t("business.profile.verified")} tone="good" /> : null}
          </span>
        </div>
      </header>

      {others.length ? (
        <ChipRow label={t("business.actingAs")}>
          <Chip label={t("business.yourBusiness")} selected={isOwn} href={link({ as: "me", tab: "profile" })} />
          {others.map((o) => (
            <Chip key={o.key} label={o.name} selected={acting.key === o.key} href={link({ as: o.key, tab: "inbox" })} />
          ))}
        </ChipRow>
      ) : null}

      {tabs.length > 1 ? (
        <ChipRow label={t("business.sections")}>
          {tabs.map((x) => (
            <Chip key={x} label={label[x]} selected={active === x} href={link({ tab: x })} />
          ))}
        </ChipRow>
      ) : null}

      {isOwn && profile.error ? <ErrorNote error={profile.error} /> : null}

      {active === "profile" ? <ProfileTab profile={profile.data?.profile ?? null} /> : null}
      {active === "treasury" ? <TreasuryTab isOwner={isOwn} hasProfile={hasProfile} changeId={change} /> : null}
      {active === "inbox" ? (
        <InboxTab role={acting.role} open={enquiry} onOpen={(id) => router.replace(link({ tab: "inbox", e: id }), { scroll: false })} />
      ) : null}
      {active === "events" ? (
        <EventsTab
          // One's own account claims for its business when it has a profile, else for the person.
          actingForBusinessId={isOwn ? (hasProfile ? session?.user?.id ?? null : null) : acting.ownerUserId}
          isOwn={isOwn}
          prefill={claim}
        />
      ) : null}
      {active === "sales" ? <SalesTab /> : null}
      {active === "activity" ? <ActivityTab asBusiness={isOwn ? null : acting.ownerUserId} spaces={spaces} /> : null}
      {active === "team" ? <TeamTab /> : null}
    </div>
  );
}
