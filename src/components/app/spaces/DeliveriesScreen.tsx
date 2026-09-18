"use client";

/**
 * Spaces › Deliveries: everything owed after the money moved — artwork to
 * approve, sold spots to deliver, the listing's own promises — across every
 * listing, one item at a time.
 *
 * The detail pane is the console's own card for that item (`Review`,
 * `SoldSpot`, `PromiseCard` for the creator; `SlotRow`, `DeliverableRow` for
 * somebody on a team), so marking something delivered is the same call it
 * always was. `?item=<kind>:<id>` opens one directly.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PromiseCard, Review, SoldSpot } from "@/components/creator/run/Work";
import { DeliverableRow, SlotRow } from "@/components/creator/team/TeamWork";
import { memberDeliveries, ownerDeliveries, sortDeliveries, type DeliveryItem } from "@/lib/app/spaces-model";
import { useListingViews, useRefresh } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { IconArrowLeft } from "../icons";
import { useShell } from "../Shell";
import { EmptyState, FilterPills, Panel, RowLink, Skeleton } from "../ui";
import { dueText, MasterDetail, ReadError } from "./common";

type Show = "todo" | "done" | "all";
type Kind = "all" | "artwork" | "spot" | "promise";

const KIND_TEXT: Record<DeliveryItem["kind"], string> = { artwork: "Artwork", spot: "Spot", promise: "Promise" };
const STATE_TEXT: Record<DeliveryItem["state"], string> = {
  todo: "To do",
  overdue: "Late",
  waiting: "Artwork pending",
  done: "Delivered",
};

export function DeliveriesScreen({ selected, view }: { selected: string | null; view: string | null }) {
  const { role, listings, work } = useShell();
  const running = useMemo(
    () => (role === "creator" ? listings.filter((l) => l.status !== "draft").map((l) => l.id) : null),
    [role, listings],
  );
  const views = useListingViews(running);
  const own = useMemo(() => new Set(listings.map((l) => l.id)), [listings]);

  const items = useMemo(
    () => sortDeliveries([...ownerDeliveries(views.data ?? []), ...memberDeliveries(work, own)]),
    [views.data, work, own],
  );
  const loading = role === "creator" && !views.data && !views.error;

  const router = useRouter();
  const pathname = usePathname();
  const href = useHref();
  const [kind, setKind] = useState<Kind>("all");
  const show: Show = view === "done" || view === "all" ? view : "todo";
  const setShow = (v: Show) => router.replace(`${pathname}?view=${v}`, { scroll: false });

  const inView = (i: DeliveryItem, s: Show) => (s === "all" ? true : s === "done" ? i.state === "done" : i.state !== "done");
  const list = items.filter((i) => inView(i, show) && (kind === "all" || i.kind === kind));
  const current = items.find((i) => i.id === selected) ?? null;
  const itemHref = (i: DeliveryItem) => `${href("/deliveries")}?view=${show}&item=${encodeURIComponent(i.id)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: "todo", label: "To do", count: items.filter((i) => inView(i, "todo")).length },
            { value: "done", label: "Delivered", count: items.filter((i) => inView(i, "done")).length },
            { value: "all", label: "All", count: items.length },
          ]}
        />
        <FilterPills
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "All" },
            ...(role === "creator" ? [{ value: "artwork" as const, label: "Artwork" }] : []),
            { value: "spot", label: "Spots" },
            { value: "promise", label: "Promises" },
          ]}
        />
      </div>
      <ReadError error={views.error} />

      <MasterDetail
        showDetail={!!current}
        list={
          <Panel title={show === "done" ? "Delivered" : show === "all" ? "All" : "To do"} meta={loading ? "" : `${list.length}`}>
            {loading ? (
              <Skeleton className="h-60" />
            ) : list.length === 0 ? (
              <EmptyState title={show === "todo" ? "Nothing to deliver." : "Nothing here."} />
            ) : (
              <ul className="flex flex-col gap-1">
                {list.map((i) => (
                  <li key={i.id}>
                    <RowLink
                      href={itemHref(i)}
                      selected={i.id === selected}
                      title={i.title}
                      sub={`${KIND_TEXT[i.kind]} · ${i.listing}`}
                      right={
                        <span className={`text-[11px] ${i.state === "overdue" || i.kind === "artwork" ? "text-amber" : "text-[#9FB7C2]"}`}>
                          {i.state === "done" ? STATE_TEXT.done : i.due ? dueText(i.due) : STATE_TEXT[i.state]}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        }
        detail={
          current ? (
            <Detail item={current} backHref={`${href("/deliveries")}?view=${show}`} />
          ) : (
            <Panel>
              <EmptyState title={list.length ? "Pick an item." : "Nothing selected."} />
            </Panel>
          )
        }
      />
    </div>
  );
}

function Detail({ item, backHref }: { item: DeliveryItem; backHref: string }) {
  const href = useHref();
  const { listings } = useShell();
  const refresh = useRefresh();
  const changed = () => void refresh("views", "work", "listings", "listing");
  const canOpen = listings.some((l) => l.id === item.spaceId) || item.member?.listing.role === "manager";

  return (
    <div className="flex flex-col gap-3">
      <Link href={backHref} scroll={false} className="inline-flex w-fit items-center gap-1.5 text-tiny text-[#9FB7C2] hover:text-text lg:hidden">
        <IconArrowLeft className="size-3.5" />
        Deliveries
      </Link>
      <Panel
        title={item.listing}
        meta={KIND_TEXT[item.kind]}
        action={
          canOpen ? (
            <Link href={href(`/listings/${item.spaceId}?tab=deliveries`)} className="text-tiny text-[#9FB7C2] hover:text-text">
              Open listing
            </Link>
          ) : null
        }
      >
        {item.owner?.position && item.kind === "artwork" ? (
          <Review key={item.id} position={item.owner.position} onChanged={changed} />
        ) : item.owner?.position ? (
          <SoldSpot key={item.id} position={item.owner.position} onChanged={changed} />
        ) : item.owner?.deliverable ? (
          <PromiseCard key={item.id} deliverable={item.owner.deliverable} onChanged={changed} />
        ) : item.member?.slot ? (
          <SlotRow
            key={item.id}
            slot={item.member.slot}
            canDeliver={item.member.listing.status === "live" || item.member.listing.status === "closed"}
            onChanged={changed}
          />
        ) : item.member?.deliverable ? (
          <DeliverableRow
            key={item.id}
            deliverable={item.member.deliverable}
            canDeliver={item.member.listing.status === "live" || item.member.listing.status === "closed"}
            onChanged={changed}
          />
        ) : null}
      </Panel>
    </div>
  );
}
