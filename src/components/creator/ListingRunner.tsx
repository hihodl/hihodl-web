/**
 * One listing, in the product shell: a header with its numbers, and each part
 * of running it as its own tab (`?tab=`), so no screen answers more than one
 * question — the spots, the offers, the deliveries, the link, the series, the
 * team on it, the updates, the floors.
 *
 * WHY THE MONEY IS SAID TWICE
 *
 * Because there are two numbers and they are not the same. When the sponsor
 * carries our five percent they pay more than the price and the creator
 * receives the price; when the creator carries it they pay the price and the
 * creator receives less. So every figure here says whose it is, and what the
 * creator RECEIVES is the one in the larger type.
 *
 * WHY EVERYTHING RELOADS THE WHOLE LISTING AFTER AN ANSWER
 *
 * Accepting an offer reserves a spot, which changes that spot's status, which
 * changes what the other offers on it may become. Patching one card in place
 * would leave a screen where half the state is from before the change. The
 * listing is one read, so it is re-read — and the shell's cached counts with it.
 *
 * WHO SEES WHICH TABS
 *
 * The owner sees all of them. Somebody who sells for the owner (a manager)
 * sees the spots, the offers, the deliveries, the link and the updates: the
 * team and its shares are the owner's alone, as the API has it.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { btnSmall, btnSmallSecondary, pill } from "@/components/ad-space/ui";
import { useHref } from "@/components/app/base";
import { IconArrowLeft } from "@/components/app/icons";
import { useShell } from "@/components/app/Shell";
import { StatusPill } from "@/components/app/spaces/common";
import { dollars, glass, LinkTabs, Panel } from "@/components/app/ui";
import { closesText } from "@/lib/ad-space/format";
import { useRefresh } from "@/lib/app/spaces-data";
import { describeCreatorError } from "@/lib/creator/api";
import {
  centsFromDollars,
  centsFromUsdc,
  dollarsFromCents,
  usd,
  type OfferView,
  type SpaceView,
} from "@/lib/creator/listing";
import {
  addUpdate,
  getListing,
  listingOffers,
  removeUpdate,
  setListingFloor,
  setPositionFloor,
  shareListing,
} from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Money, Text } from "./listing/parts";
import { Address, Loading, Notice, Section } from "./parts";
import { Offers } from "./run/Offers";
import { Work } from "./run/Work";
import { ListingSeries } from "./series/Series";
import { ListingTeam } from "./team/ListingTeam";

/** A tab's content scrolls inside its panel on a wide screen, so the page stays one screen. */
const TAB_BODY = "lg:max-h-[calc(100dvh-480px)] lg:overflow-y-auto";

type Tab = "spots" | "offers" | "deliveries" | "share" | "series" | "team" | "updates" | "floors";

export function ListingRunner({ spaceId, tab }: { spaceId: string; tab?: string; item?: string }) {
  const { listings } = useShell();
  const href = useHref();
  const refresh = useRefresh();
  const owner = listings.some((l) => l.id === spaceId);

  const [space, setSpace] = useState<SpaceView | null>(null);
  const [offers, setOffers] = useState<OfferView[]>([]);
  const [share, setShare] = useState<{ url: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { space: next } = await getListing(spaceId);
      setSpace(next);
      setError(null);
      // Offers only exist on a listing that takes them, and a draft has no
      // page to share; neither is worth a call that can only answer no.
      const wants = next.pricingMode !== "fixed" || next.acceptsOffers || next.positions.some((p) => p.saleMode);
      const [o, s] = await Promise.all([
        wants ? listingOffers(spaceId).catch(() => ({ offers: [] as OfferView[] })) : Promise.resolve({ offers: [] as OfferView[] }),
        next.status === "draft" ? Promise.resolve(null) : shareListing(spaceId).catch(() => null),
      ]);
      setOffers(o.offers);
      setShare(s);
    } catch (e) {
      setError(describeCreatorError(e));
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = useCallback(() => {
    void load();
    void refresh("listings", "offers", "views", "sales", "managed-offers", "work");
  }, [load, refresh]);

  if (loading) {
    return (
      <Frame>
        <Panel>
          <Loading what="this listing" />
        </Panel>
      </Frame>
    );
  }
  if (error || !space) {
    return (
      <Frame>
        <Notice>{error ?? "Listing not found."}</Notice>
      </Frame>
    );
  }

  const openOffers = offers.filter((o) => o.status === "pending").length;
  const artwork = space.positions.filter((p) => p.content?.status === "pending").length;
  const toDeliver =
    space.positions.filter((p) => p.status === "sold" && !p.delivered).length +
    space.deliverables.filter((d) => !d.deliveredUrl).length;
  const takesOffers = space.pricingMode !== "fixed" || space.acceptsOffers || space.positions.some((p) => p.saleMode);
  const hasFloors =
    space.positions.some((p) => p.offers?.minOfferUsdc !== undefined) || space.spaceOffers?.minOfferUsdc !== undefined;

  const tabs: { key: Tab; label: string; count?: number; show: boolean }[] = [
    { key: "spots", label: "Spots", show: true },
    { key: "offers", label: "Offers", count: openOffers, show: takesOffers },
    { key: "deliveries", label: "Deliveries", count: artwork + toDeliver, show: space.status !== "draft" },
    { key: "share", label: "Share", show: !!share },
    { key: "series", label: "Series", show: owner && space.status !== "delisted" },
    { key: "team", label: "Team", show: owner },
    { key: "updates", label: "Updates", count: space.updates.length || undefined, show: space.status !== "draft" },
    { key: "floors", label: "Floors", show: hasFloors },
  ];
  const visible = tabs.filter((t) => t.show);
  const active: Tab = visible.some((t) => t.key === tab) ? (tab as Tab) : "spots";
  const tabHref = (t: Tab) => href(`/listings/${space.id}${t === "spots" ? "" : `?tab=${t}`}`);

  return (
    <Frame>
      <header className={`${glass} flex flex-col gap-4 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words text-[20px] font-medium text-text">{space.serviceName || space.title}</h2>
              <StatusPill status={space.status} />
            </div>
            <p className="mt-1 text-tiny text-[#9FB7C2]">
              {space.status === "draft" ? "Only you see this" : closesText(space.closesAt, space.status === "closed")}
              {space.event ? ` · ${space.event.name}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {space.status === "draft" ? (
              <Link href={href(`/listings/${space.id}/edit`)} className={btnSmall}>
                Finish draft
              </Link>
            ) : null}
            {share ? (
              <a href={share.url} target="_blank" rel="noreferrer" className={btnSmallSecondary}>
                Public page
              </a>
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Stat label="Committed" value={dollars(space.totals.committedCents)} big />
          <Stat label="Sold" value={`${space.totals.sold}/${space.totals.positions}`} />
          <Stat label="Open offers" value={String(openOffers)} />
          <Stat label="To deliver" value={String(artwork + toDeliver)} />
        </dl>
      </header>

      <LinkTabs
        active={active}
        tabs={visible.map((t) => ({ key: t.key, label: t.label, count: t.count, href: tabHref(t.key) }))}
      />

      {active === "spots" ? <Spots space={space} /> : null}
      {active === "offers" ? (
        <Section title="Offers & bids">
          <div className={TAB_BODY}>
            <Offers space={space} offers={offers} onChanged={changed} />
          </div>
        </Section>
      ) : null}
      {active === "deliveries" ? (
        <Section title="Deliveries">
          <div className={TAB_BODY}>
            <Work space={space} onChanged={changed} />
          </div>
        </Section>
      ) : null}
      {active === "share" && share ? <Share share={share} /> : null}
      {active === "series" ? <ListingSeries space={space} onChanged={changed} /> : null}
      {active === "team" ? <ListingTeam spaceId={space.id} /> : null}
      {active === "updates" ? <Updates space={space} onChanged={changed} /> : null}
      {active === "floors" ? <Floors space={space} onChanged={changed} /> : null}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const href = useHref();
  return (
    <div className="flex flex-col gap-4">
      <Link href={href("/listings")} className="inline-flex w-fit items-center gap-1.5 text-tiny text-[#9FB7C2] hover:text-text">
        <IconArrowLeft className="h-3.5 w-3.5" />
        Listings
      </Link>
      {children}
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[#9FB7C2]">{label}</dt>
      <dd className={`mt-1 truncate font-medium leading-none tabular-nums text-text ${big ? "text-[24px]" : "text-[18px]"}`}>{value}</dd>
    </div>
  );
}

/* ── The spots ────────────────────────────────────────────────────── */

const SPOT_LABEL: Record<string, string> = { open: "Open", held: "Held", sold: "Sold" };

function Spots({ space }: { space: SpaceView }) {
  return (
    <Panel title="Spots" meta={`${space.positions.length}`}>
      <div className={`-mx-1 overflow-x-auto ${TAB_BODY}`}>
        <table className="w-full min-w-[520px] text-left text-small">
          <thead>
            <tr className="text-[11px] text-[#9FB7C2]">
              <th className="px-2 py-2 font-normal">Spot</th>
              <th className="px-2 py-2 font-normal">Price</th>
              <th className="px-2 py-2 font-normal">To you</th>
              <th className="px-2 py-2 font-normal">Sponsor</th>
              <th className="px-2 py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {space.positions.map((p) => (
              <tr key={p.id} className="border-t border-white/[0.06]">
                <td className="max-w-[240px] truncate px-2 py-2.5 text-text">{p.title ?? p.label}</td>
                <td className="px-2 py-2.5 tabular-nums text-[#CFE3EC]">
                  {p.priceCents !== null ? usd(p.priceCents) : p.offers?.mode === "bids" ? "Bids" : "Offers"}
                </td>
                <td className="px-2 py-2.5 tabular-nums text-text">{p.creatorReceivesUsdc ? `${p.creatorReceivesUsdc}` : "–"}</td>
                <td className="max-w-[180px] truncate px-2 py-2.5 text-[#CFE3EC]">{p.sponsor?.name ?? "–"}</td>
                <td className="px-2 py-2.5">
                  <span className={p.status === "sold" ? pill.sold : p.status === "held" ? pill.held : pill.open}>
                    {SPOT_LABEL[p.status] ?? p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-[#7F97A3]">
        {space.feePayer === "sponsor" ? "Sponsor pays the 5% fee on top" : "You carry the 5% fee"} · USDC on{" "}
        {space.chains.join(", ")}
      </p>
    </Panel>
  );
}

/* ── The link ─────────────────────────────────────────────────────── */

function Share({ share }: { share: { url: string; text: string } }) {
  return (
    <Section title="Share link">
      <div className="flex flex-col gap-4">
        <Address value={share.url} />
        <p className="break-words rounded-input border border-[color:var(--color-hairline)] px-4 py-3 text-small text-text-muted [overflow-wrap:anywhere]">
          {share.text}
        </p>
      </div>
    </Section>
  );
}

/* ── The floors nobody else can see ───────────────────────────────── */

function Floors({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const perSpot = space.positions.filter((p) => p.offers?.minOfferUsdc !== undefined);
  const spaceLevel = space.spaceOffers?.minOfferUsdc !== undefined;
  if (perSpot.length === 0 && !spaceLevel) return null;

  return (
    <Section title="Floors">
      <div className="flex flex-col gap-3">
        <p className="text-tiny text-text-muted">Private. Offers below a floor never reach you.</p>
        {spaceLevel ? (
          <Floor
            label="Every slot"
            current={space.spaceOffers?.minOfferUsdc ?? null}
            onSave={(cents) => setListingFloor(space.id, cents)}
            onChanged={onChanged}
          />
        ) : null}
        {perSpot.map((p) => (
          <Floor
            key={p.id}
            label={p.title ?? p.label}
            current={p.offers?.minOfferUsdc ?? null}
            onSave={(cents) => setPositionFloor(p.id, cents)}
            onChanged={onChanged}
          />
        ))}
      </div>
    </Section>
  );
}

function Floor({
  label,
  current,
  onSave,
  onChanged,
}: {
  label: string;
  current: string | null;
  onSave: (cents: number | null) => Promise<unknown>;
  onChanged: () => void;
}) {
  const [value, setValue] = useState(dollarsFromCents(centsFromUsdc(current)));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function save(cents: number | null) {
    setBusy(true);
    setNotice(null);
    void onSave(cents)
      .then(onChanged)
      .catch((e) => setNotice(describeRunError(e)))
      .finally(() => setBusy(false));
  }

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-white/[0.08] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-small text-text">{label}</p>
        <p className="text-tiny text-text-muted">{current ? `Now ${current} USDC` : "No floor"} · minimum {usd(2_500)}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Money value={value} onChange={setValue} placeholder="No floor" />
        </div>
        <button
          type="button"
          className={btnSmall}
          disabled={busy || (value.trim() !== "" && centsFromDollars(value) === null)}
          onClick={() => save(value.trim() ? centsFromDollars(value) : null)}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {current ? (
          <button type="button" className={btnSmallSecondary} disabled={busy} onClick={() => save(null)}>
            Remove
          </button>
        ) : null}
      </div>
      {notice ? <Notice>{notice}</Notice> : null}
    </div>
  );
}

/* ── Telling people how it is going ───────────────────────────────── */

function Updates({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (space.status === "draft") return null;

  return (
    <Section title="Updates">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Text value={body} onChange={setBody} maxLength={280} placeholder="The mini strip is printed and on the case" />
          </div>
          <button
            type="button"
            className={btnSmall}
            disabled={busy || !body.trim()}
            onClick={() => {
              setBusy(true);
              setNotice(null);
              void addUpdate(space.id, body.trim())
                .then(() => {
                  setBody("");
                  onChanged();
                })
                .catch((e) => setNotice(describeRunError(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </div>

        {space.updates.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {space.updates.map((u) => (
              <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[14px] border border-white/[0.08] p-3">
                <span className="min-w-0 text-small text-text">{u.body}</span>
                <button
                  type="button"
                  className={btnSmallSecondary}
                  onClick={() => {
                    void removeUpdate(space.id, u.id)
                      .then(onChanged)
                      .catch((e) => setNotice(describeRunError(e)));
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-text-muted">No updates yet.</p>
        )}

        {notice ? <Notice>{notice}</Notice> : null}
      </div>
    </Section>
  );
}
