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
 */

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { GroundPicker, GroundSwatch, labelOf } from "@/components/creator/run/GroundPicker";
import { getCreatorSettings, setPageGround, type CreatorSettings } from "@/lib/creator/listings";

import { useHref } from "../base";
import { IconArrowLeft } from "../icons";
import { useShell } from "../Shell";
import { glass } from "../ui";

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

/** The card that opens this screen, for any settings page. */
export function YourPagesCard({ href, title = "Your pages" }: { href: string; title?: string }) {
  const { grounds } = useGrounds();
  return (
    <Link href={href} aria-label={title} className={`${glass} flex items-center gap-4 p-5 transition-colors hover:bg-white/[0.07]`}>
      <div className="w-24 shrink-0">
        <GroundSwatch value={grounds?.pageGround ?? null} height={64} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-small font-medium text-text">{title}</p>
        <p className="truncate text-tiny text-[#CFE3EC]">
          {grounds ? `Background: ${labelOf(grounds.pageGround)} profile, ${labelOf(grounds.listingGround ?? grounds.pageGround)} listings` : "…"}
        </p>
      </div>
      <span aria-hidden className="text-[#CFE3EC]">
        &rarr;
      </span>
    </Link>
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
  const href = useHref();
  const { listings } = useShell();
  const { grounds, reload } = useGrounds();
  const sep = base.includes("?") ? "&" : "?";

  if (item === "profile" || item === "listings") {
    const profile = item === "profile";
    return (
      <Frame back={base} backLabel="Your pages" title={profile ? "Profile page" : "Listings, by default"}>
        <p className="max-w-2xl text-small text-[#CFE3EC]">
          {profile
            ? "What your profile and its event screens stand on."
            : "What every listing stands on unless it has its own. “Same as my profile” follows your profile page."}
        </p>
        {grounds ? (
          <GroundPicker
            key={`${item}-${profile ? grounds.pageGround : grounds.listingGround}`}
            value={profile ? grounds.pageGround ?? null : grounds.listingGround ?? null}
            allowDefault={!profile}
            defaultValue={grounds.pageGround ?? null}
            defaultLabel="Same as my profile"
            onSave={(next) => setPageGround(profile ? { pageGround: next } : { listingGround: next }).then(reload)}
          />
        ) : null}
      </Frame>
    );
  }

  const listingDefault = grounds ? grounds.listingGround ?? grounds.pageGround ?? null : null;
  return (
    <Frame back={back} backLabel={backLabel} title="Your pages">
      <p className="max-w-2xl text-small text-[#CFE3EC]">
        The background sponsors see on your public pages. The payment sheet keeps the app&rsquo;s dark on every one.
      </p>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <li>
          <GroundCard href={`${base}${sep}item=profile`} value={grounds?.pageGround ?? null} title="Profile page" note={grounds ? labelOf(grounds.pageGround) : "…"} />
        </li>
        <li>
          <GroundCard
            href={`${base}${sep}item=listings`}
            value={listingDefault}
            title="Listings, by default"
            note={grounds ? (grounds.listingGround ? labelOf(grounds.listingGround) : `Same as my profile · ${labelOf(grounds.pageGround)}`) : "…"}
          />
        </li>
      </ul>

      <section className="flex flex-col gap-2">
        <h3 className="text-small font-medium text-text">Each listing</h3>
        {listings.length === 0 ? (
          <p className="text-tiny text-[#CFE3EC]">No listings yet.</p>
        ) : (
          <ul className={`${glass} divide-y divide-white/[0.06] overflow-hidden`}>
            {listings.map((l) => {
              const own = l.pageGroundOwn ?? null;
              return (
                <li key={l.id}>
                  <Link
                    href={href(`/listings/${l.id}?tab=ground`)}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.05]"
                  >
                    <div className="w-14 shrink-0">
                      <GroundSwatch value={own ?? listingDefault} height={36} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small text-text">{l.serviceName || l.title}</p>
                      <p className="truncate text-tiny text-[#CFE3EC]">
                        {own ? `Its own: ${labelOf(own)}` : `Default · ${labelOf(listingDefault)}`}
                      </p>
                    </div>
                    <span aria-hidden className="text-[#CFE3EC]">
                      &rarr;
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Frame>
  );
}

function GroundCard({ href, value, title, note }: { href: string; value: string | null; title: string; note: string }) {
  return (
    <Link href={href} className={`${glass} flex h-full flex-col gap-3 p-4 transition-colors hover:bg-white/[0.07]`}>
      <GroundSwatch value={value} height={96} />
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-text">{title}</p>
          <p className="truncate text-tiny text-[#CFE3EC]">{note}</p>
        </div>
        <span aria-hidden className="text-[#CFE3EC]">
          &rarr;
        </span>
      </div>
    </Link>
  );
}

function Frame({ back, backLabel, title, children }: { back: string; backLabel: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={back}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-[#CFE3EC]">{backLabel}</p>
          <h2 className="truncate text-body font-medium text-text">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}
