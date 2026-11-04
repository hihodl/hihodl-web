"use client";

/**
 * Your pages: what the creator's public pages stand on, in one place.
 *
 *   Profile page       /s/<handle> and its event screens
 *   Listings, default  every listing without its own ("Same as my profile")
 *   Each listing       its own override, opened on the listing's own screen
 *
 * The same screen is reached from the product's Settings ("Your pages") and
 * from Spaces › Settings ("Page background"): one component and the server's
 * settings as the one source of truth, so the two can never disagree. Each
 * choice is a card that opens its own screen with Back (`item=`), drawn with
 * the same GroundPicker a listing uses for its own.
 *
 * The app has no screen for this (a creator's public pages are the web's), so
 * it is drawn with the app's parts: a GlassSurface card of rows, SectionTitle
 * over each group, and the Spaces card for each choice.
 */

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { GroundPicker, GroundSwatch, labelOf } from "@/components/creator/run/GroundPicker";
import { getCreatorSettings, setPageGround, type CreatorSettings } from "@/lib/creator/listings";
import { useT } from "@/lib/app/i18n/react";

import { useHref } from "../base";
import { BackHeader, Column, HoldCard, SectionTitle } from "../hold";
import { Ion } from "../ion";
import { useShell } from "../Shell";
import { Card } from "./kit";

type Grounds = Pick<CreatorSettings, "pageGround" | "listingGround">;

/** The creator's two defaults, read once and re-read after every save. */
export function useGrounds(): { grounds: Grounds | null; reload: () => void } {
  const [grounds, setGrounds] = useState<Grounds | null>(null);
  const reload = useCallback(() => {
    void getCreatorSettings()
      .then(({ settings }) => setGrounds({ pageGround: settings.pageGround ?? null, listingGround: settings.listingGround ?? null }))
      .catch(() => setGrounds({ pageGround: null, listingGround: null }));
  }, []);
  useEffect(reload, [reload]);
  return { grounds, reload };
}

/** The row that opens this screen, in a card of its own, for any settings page. */
export function YourPagesCard({ href, title: titleIn }: { href: string; title?: string }) {
  const t = useT();
  const title = titleIn ?? t("creator.pages.title");
  const { grounds } = useGrounds();
  return (
    <HoldCard>
      <Link href={href} aria-label={title} className="flex w-full min-w-0 items-center gap-3 px-[18px] py-[14px] transition-colors hover:bg-white/[0.03]">
        <div className="w-14 shrink-0 overflow-hidden rounded-[10px]">
          <GroundSwatch value={grounds?.pageGround ?? null} height={40} />
        </div>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-strong leading-5 text-white">{title}</span>
          <span className="mt-0.5 block truncate text-[12px] leading-4 text-[#9FB7C2]">
            {grounds
              ? t("creator.pages.cardNote", { profile: labelOf(grounds.pageGround), listings: labelOf(grounds.listingGround ?? grounds.pageGround) })
              : "…"}
          </span>
        </span>
        <Ion name="chevron-forward" size={16} className="shrink-0 text-white/35" />
      </Link>
    </HoldCard>
  );
}

export function YourPagesScreen({
  base,
  back,
  backLabel,
  item,
}: {
  /** This screen's own URL, without `item` (e.g. `/app/settings?screen=pages`). */
  base: string;
  /** Where Back goes from the top of this screen. */
  back: string;
  backLabel: string;
  item?: string;
}) {
  const t = useT();
  const href = useHref();
  const { listings } = useShell();
  const { grounds, reload } = useGrounds();
  const sep = base.includes("?") ? "&" : "?";

  if (item === "profile" || item === "listings") {
    const profile = item === "profile";
    return (
      <Frame back={base} backLabel={t("creator.pages.title")} title={profile ? t("creator.pages.profile") : t("creator.pages.listingsDefault")}>
        <p className="mb-4 px-1 text-[15px] font-medium leading-[21px] text-white/[0.72]">
          {profile
            ? t("creator.pages.profileBody")
            : t("creator.pages.listingsBody")}
        </p>
        {grounds ? (
          <GroundPicker
            key={`${item}-${profile ? grounds.pageGround : grounds.listingGround}`}
            value={profile ? grounds.pageGround ?? null : grounds.listingGround ?? null}
            allowDefault={!profile}
            defaultValue={grounds.pageGround ?? null}
            defaultLabel={t("creator.pages.sameAsProfile")}
            onSave={(next) => setPageGround(profile ? { pageGround: next } : { listingGround: next }).then(reload)}
          />
        ) : null}
      </Frame>
    );
  }

  const listingDefault = grounds ? grounds.listingGround ?? grounds.pageGround ?? null : null;
  return (
    <Frame back={back} backLabel={backLabel} title={t("creator.pages.title")}>
      <p className="mb-2 px-1 text-[15px] font-medium leading-[21px] text-white/[0.72]">
        {t("creator.pages.intro")}
      </p>
      <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <li>
          <GroundCard href={`${base}${sep}item=profile`} value={grounds?.pageGround ?? null} title={t("creator.pages.profile")} note={grounds ? labelOf(grounds.pageGround) : "…"} />
        </li>
        <li>
          <GroundCard
            href={`${base}${sep}item=listings`}
            value={listingDefault}
            title={t("creator.pages.listingsDefault")}
            note={
              grounds
                ? grounds.listingGround
                  ? labelOf(grounds.listingGround)
                  : t("creator.pages.sameAsProfileWith", { ground: labelOf(grounds.pageGround) })
                : "…"
            }
          />
        </li>
      </ul>

      <SectionTitle>{t("creator.pages.eachListing")}</SectionTitle>
      {listings.length === 0 ? (
        <p className="px-1 text-[13px] text-[#9FB7C2]">{t("creator.pages.noListings")}</p>
      ) : (
        <HoldCard>
          {listings.map((l) => {
            const own = l.pageGroundOwn ?? null;
            return (
              <Link key={l.id} href={href(`/listings/${l.id}?tab=ground`)} className="flex items-center gap-3 px-[18px] py-[14px] transition-colors hover:bg-white/[0.03]">
                <div className="w-14 shrink-0 overflow-hidden rounded-[10px]">
                  <GroundSwatch value={own ?? listingDefault} height={36} />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-strong leading-5 text-white">{l.serviceName || l.title}</span>
                  <span className="mt-0.5 block truncate text-[12px] leading-4 text-[#9FB7C2]">{own ? t("creator.pages.itsOwn", { ground: labelOf(own) }) : t("creator.pages.default", { ground: labelOf(listingDefault) })}</span>
                </span>
                <Ion name="chevron-forward" size={16} className="shrink-0 text-white/35" />
              </Link>
            );
          })}
        </HoldCard>
      )}
    </Frame>
  );
}

function GroundCard({ href, value, title, note }: { href: string; value: string | null; title: string; note: string }) {
  return (
    <Card href={href} className="h-full">
      <div className="overflow-hidden rounded-[12px]">
        <GroundSwatch value={value} height={96} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-strong tracking-[-0.2px] text-white">{title}</p>
          <p className="truncate text-[12.5px] font-strong text-white/55">{note}</p>
        </div>
        <Ion name="chevron-forward" size={16} className="shrink-0 text-white/55" />
      </div>
    </Card>
  );
}

/** A screen under Settings: the app's header, a chevron back and the title centred. */
function Frame({ back, title, children }: { back: string; backLabel: string; title: string; children: ReactNode }) {
  return (
    <Column wide>
      <BackHeader title={title} backHref={back} />
      {children}
    </Column>
  );
}
