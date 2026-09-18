"use client";

/**
 * Spaces › Offers & bids: the inbox across every listing.
 *
 * A list on the left, the one you picked on the right, answered with the same
 * card the listing page uses (`OfferCard`), so an answer here is the same call
 * with the same version pin. `?id=<offer>` opens one directly, which is where
 * the Overview's "Needs you" rows land.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { OfferCard } from "@/components/creator/run/Offers";
import { timeLeft } from "@/lib/ad-space/format";
import type { OfferView } from "@/lib/creator/listing";
import { OPEN_OFFER } from "@/lib/app/spaces-model";
import { useListing, useManagedOffers, useOffers, useRefresh } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { IconArrowLeft } from "../icons";
import { useShell } from "../Shell";
import { EmptyState, FilterPills, Panel, RowLink, Skeleton } from "../ui";
import { MasterDetail, ReadError } from "./common";

type Show = "waiting" | "open" | "all";
type Kind = "all" | "offer" | "bid";

const STATUS_TEXT: Record<string, string> = {
  pending: "Waiting on you",
  countered: "Countered",
  accepted: "Accepted",
  paid: "Paid",
  declined: "Declined",
  expired: "Expired",
  withdrawn: "Withdrawn",
  lapsed: "Lapsed",
  superseded: "Outbid",
};

export function OffersScreen({ selected, view }: { selected: string | null; view: string | null }) {
  const { role, managed } = useShell();
  const ids = useMemo(() => managed.map((m) => m.spaceId), [managed]);
  const own = useOffers(role === "creator");
  const theirs = useManagedOffers(role === "manager" ? ids : null);
  const read = role === "creator" ? own : theirs;
  const offers = useMemo(() => read.data ?? (role === "manager" && ids.length === 0 ? [] : null), [read.data, role, ids.length]);

  const router = useRouter();
  const pathname = usePathname();
  const href = useHref();
  const [kind, setKind] = useState<Kind>("all");
  const show: Show = view === "open" || view === "all" ? view : "waiting";
  const setShow = (v: Show) => router.replace(`${pathname}?view=${v}${selected ? `&id=${selected}` : ""}`, { scroll: false });

  const inView = (o: OfferView, s: Show) =>
    s === "all" ? true : s === "open" ? OPEN_OFFER.includes(o.status) : o.status === "pending";
  const list = (offers ?? []).filter((o) => inView(o, show) && (kind === "all" || o.kind === kind));
  const current = offers?.find((o) => o.id === selected) ?? null;

  const rowHref = (o: OfferView) => `${href("/offers")}?view=${show}&id=${o.id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: "waiting", label: "Waiting on you", count: (offers ?? []).filter((o) => inView(o, "waiting")).length },
            { value: "open", label: "Open", count: (offers ?? []).filter((o) => inView(o, "open")).length },
            { value: "all", label: "All", count: offers?.length ?? 0 },
          ]}
        />
        <FilterPills
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "Offers & bids" },
            { value: "offer", label: "Offers" },
            { value: "bid", label: "Bids" },
          ]}
        />
      </div>
      <ReadError error={read.error} />

      <MasterDetail
        showDetail={!!current}
        list={
          <Panel title="Inbox" meta={offers ? `${list.length}` : ""}>
            {offers === null ? (
              <Skeleton className="h-60" />
            ) : list.length === 0 ? (
              <EmptyState title={show === "waiting" ? "Nothing waiting on you." : "No offers."} />
            ) : (
              <ul className="flex flex-col gap-1">
                {list.map((o) => {
                  const left = o.expiresAt ? new Date(o.expiresAt).getTime() - Date.now() : null;
                  return (
                    <li key={o.id}>
                      <RowLink
                        href={rowHref(o)}
                        selected={o.id === selected}
                        title={`${o.sponsor.name} · ${o.amountUsdc} USDC`}
                        sub={`${o.kind === "bid" ? "Bid" : "Offer"} · ${o.serviceName || o.spaceTitle}${o.positionLabel ? ` · ${o.positionLabel}` : ""}`}
                        right={
                          <span className={`text-[11px] ${o.status === "pending" ? "text-amber" : "text-[#9FB7C2]"}`}>
                            {o.status === "pending" && left !== null && left > 0 ? `${timeLeft(left)} left` : STATUS_TEXT[o.status] ?? o.status}
                          </span>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        }
        detail={
          current ? (
            <OfferDetail offer={current} backHref={`${href("/offers")}?view=${show}`} />
          ) : (
            <Panel>
              <EmptyState title={offers && list.length ? "Pick an offer." : "Nothing selected."} />
            </Panel>
          )
        }
      />
    </div>
  );
}

function OfferDetail({ offer, backHref }: { offer: OfferView; backHref: string }) {
  const href = useHref();
  const space = useListing(offer.spaceId);
  const refresh = useRefresh();

  return (
    <div className="flex flex-col gap-3">
      <Link href={backHref} scroll={false} className="inline-flex w-fit items-center gap-1.5 text-tiny text-[#9FB7C2] hover:text-text lg:hidden">
        <IconArrowLeft className="size-3.5" />
        Inbox
      </Link>
      <Panel
        title={offer.serviceName || offer.spaceTitle}
        meta={offer.positionLabel ?? undefined}
        action={
          <Link href={href(`/listings/${offer.spaceId}?tab=offers`)} className="text-tiny text-[#9FB7C2] hover:text-text">
            Open listing
          </Link>
        }
      >
        {space.data ? (
          <OfferCard
            offer={offer}
            space={space.data}
            onChanged={() => void refresh("offers", "managed-offers", "listing", "listings", "views")}
          />
        ) : space.error ? (
          <ReadError error={space.error} />
        ) : (
          <Skeleton className="h-48" />
        )}
      </Panel>
    </div>
  );
}
