/**
 * One listing, in the product shell: a hub of cards.
 *
 * On top, the listing's own picture, big, with its name and the one number that
 * matters. Under it, one card per part of running it — the link, the events,
 * the offers, the floors, the spots, the deliveries, the updates and, for a
 * Creative Director, who works it — each with one small figure. A card opens
 * its own screen (`?tab=`), with Back to the hub. Nothing is a long page.
 *
 * Money has its own place (Sales); nothing here says where it goes.
 *
 * WHY EVERYTHING RELOADS THE WHOLE LISTING AFTER AN ANSWER
 *
 * Accepting an offer reserves a spot, which changes that spot's status, which
 * changes what the other offers on it may become. Patching one card in place
 * would leave a screen where half the state is from before the change. The
 * listing is one read, so it is re-read — and the shell's cached counts with it.
 *
 * WHO SEES WHICH CARDS
 *
 * The owner sees all of them ("Who works it" only as a Creative Director).
 * Somebody who sells for the owner (a manager) sees the link, the offers, the
 * floors, the spots, the deliveries and the updates: the events and the team
 * are the owner's alone, as the API has it.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";

import { btnSmall, btnSmallSecondary, pill } from "@/components/ad-space/ui";
import { useHref } from "@/components/app/base";
import {
  IconArrowLeft,
  IconCalendar,
  IconCopy,
  IconDeliveries,
  IconFloor,
  IconGrid,
  IconLink,
  IconMegaphone,
  IconOffers,
  IconShare,
  IconTeam,
} from "@/components/app/icons";
import { useShell } from "@/components/app/Shell";
import { glass, Panel, Skeleton } from "@/components/app/ui";
import { useRefresh } from "@/lib/app/spaces-data";
import { describeCreatorError } from "@/lib/creator/api";
import {
  centsFromDollars,
  centsFromUsdc,
  dollarsFromCents,
  usd,
  type OfferView,
  type PositionView,
  type SeriesView,
  type SpaceView,
} from "@/lib/creator/listing";
import {
  addUpdate,
  getListing,
  getSeries,
  listingOffers,
  listingTeam,
  removeUpdate,
  setListingFloor,
  setPositionFloor,
  shareListing,
} from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Money, Text } from "./listing/parts";
import { Notice } from "./parts";
import { ListingBanner } from "./run/ListingBanner";
import { Offers } from "./run/Offers";
import { Work } from "./run/Work";
import { ListingSeries } from "./series/Series";
import { ListingTeam } from "./team/ListingTeam";

/** A screen's body scrolls inside itself on a wide screen, so the page stays one screen. */
const SCREEN_BODY = "lg:max-h-[calc(var(--app-vh,100dvh)-196px)] lg:overflow-y-auto";
/** The same, inside a panel that has its own title and padding. */
const PANEL_BODY = "lg:max-h-[calc(var(--app-vh,100dvh)-252px)] lg:overflow-y-auto";

type Screen = "events" | "offers" | "floors" | "spots" | "deliveries" | "updates" | "team";

const SCREEN_TITLE: Record<Screen, string> = {
  events: "Events",
  offers: "Offers & bids",
  floors: "Floor prices",
  spots: "Spots",
  deliveries: "Deliveries",
  updates: "Updates",
  team: "Who works it",
};

export function ListingRunner({ spaceId, tab }: { spaceId: string; tab?: string; item?: string }) {
  const { listings, agency, role } = useShell();
  const refresh = useRefresh();
  const owner = listings.some((l) => l.id === spaceId);

  const [space, setSpace] = useState<SpaceView | null>(null);
  const [offers, setOffers] = useState<OfferView[]>([]);
  const [share, setShare] = useState<{ url: string; text: string } | null>(null);
  const [series, setSeries] = useState<SeriesView | null>(null);
  const [crew, setCrew] = useState<number | null>(null);
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
      const [o, s, sr, t] = await Promise.all([
        wants ? listingOffers(spaceId).catch(() => ({ offers: [] as OfferView[] })) : Promise.resolve({ offers: [] as OfferView[] }),
        next.status === "draft" ? Promise.resolve(null) : shareListing(spaceId).catch(() => null),
        owner && next.status !== "delisted" ? getSeries(spaceId).catch(() => ({ series: null })) : Promise.resolve({ series: null }),
        owner && agency.on ? listingTeam(spaceId).catch(() => null) : Promise.resolve(null),
      ]);
      setOffers(o.offers);
      setShare(s);
      setSeries(sr.series);
      setCrew(t ? t.assignments.length : null);
    } catch (e) {
      setError(describeCreatorError(e));
    } finally {
      setLoading(false);
    }
  }, [spaceId, owner, agency.on]);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = useCallback(() => {
    void load();
    void refresh("listings", "offers", "views", "sales", "managed-offers", "work");
  }, [load, refresh]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[240px] sm:h-[280px] xl:h-[300px]" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[128px]" />
          ))}
        </div>
      </div>
    );
  }
  if (error || !space) return <Notice>{error ?? "Listing not found."}</Notice>;

  const takesOffers = space.pricingMode !== "fixed" || space.acceptsOffers || space.positions.some((p) => p.saleMode);
  const floors = floorGroups(space);
  const hasFloors = floors.length > 0;
  const shown: Record<Screen, boolean> = {
    events: owner && space.status !== "delisted",
    offers: takesOffers,
    floors: hasFloors,
    spots: true,
    deliveries: space.status !== "draft",
    updates: space.status !== "draft",
    team: owner && agency.on,
  };

  const screen = (Object.keys(shown) as Screen[]).find((k) => k === tab && shown[k]) ?? null;

  if (screen) {
    return (
      <ScreenFrame space={space} title={SCREEN_TITLE[screen]}>
        {screen === "events" ? (
          <div className={SCREEN_BODY}>
            <ListingSeries space={space} onChanged={changed} />
          </div>
        ) : null}
        {screen === "offers" ? (
          <Panel title="Offers & bids" meta={`${offers.length}`} bodyClassName={PANEL_BODY}>
            <Offers space={space} offers={offers} onChanged={changed} />
          </Panel>
        ) : null}
        {screen === "floors" ? <Floors space={space} groups={floors} onChanged={changed} /> : null}
        {screen === "spots" ? <Spots space={space} /> : null}
        {screen === "deliveries" ? (
          <Panel title="Deliveries" bodyClassName={PANEL_BODY}>
            <Work space={space} onChanged={changed} />
          </Panel>
        ) : null}
        {screen === "updates" ? <Updates space={space} onChanged={changed} /> : null}
        {screen === "team" ? (
          <div className={SCREEN_BODY}>
            <ListingTeam spaceId={space.id} />
          </div>
        ) : null}
      </ScreenFrame>
    );
  }

  const waiting = offers.filter((o) => o.status === "pending").length;
  const artwork = space.positions.filter((p) => p.content?.status === "pending").length;
  const toDeliver =
    space.positions.filter((p) => p.status === "sold" && !p.delivered).length +
    space.deliverables.filter((d) => !d.deliveredUrl).length;
  const events = series?.spaces.length ?? (space.event ? 1 : 0);
  const floorsSet = floors.filter((g) => g.current !== null).length;

  return (
    <div className="flex flex-col gap-4">
      <ListingBanner space={space} owner={owner} publicUrl={share?.url ?? null} onChanged={changed} />

      {/* Two across even on a phone: each card is one figure. The link's two buttons take a row of their own there. */}
      <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <li className="col-span-2 sm:col-span-1">
          <LinkCard share={share} />
        </li>
        {shown.events ? (
          <HubCard screen="events" space={space} icon={IconCalendar} value={events} unit={events === 1 ? "event" : "events"} />
        ) : null}
        {shown.offers ? (
          <HubCard
            screen="offers"
            space={space}
            // The inbox's own screen for this listing, with Back to this hub. A rep has no inbox.
            to={role === "rep" ? undefined : `/offers?listing=${encodeURIComponent(space.id)}&from=listing`}
            icon={IconOffers}
            value={waiting}
            unit={waiting ? "waiting on you" : offers.length ? `${offers.length} in total` : "none yet"}
            attention={waiting > 0}
          />
        ) : null}
        {shown.floors ? (
          <HubCard screen="floors" space={space} icon={IconFloor} value={floorsSet} unit={`of ${floors.length} set`} />
        ) : null}
        <HubCard screen="spots" space={space} icon={IconGrid} value={`${space.totals.sold}/${space.totals.positions}`} unit="sold" />
        {shown.deliveries ? (
          <HubCard
            screen="deliveries"
            space={space}
            icon={IconDeliveries}
            value={artwork + toDeliver}
            unit={artwork ? `to do · ${artwork} artwork` : "to do"}
            attention={artwork + toDeliver > 0}
          />
        ) : null}
        {shown.updates ? (
          <HubCard screen="updates" space={space} icon={IconMegaphone} value={space.updates.length} unit="posted" />
        ) : null}
        {shown.team ? (
          <HubCard screen="team" space={space} icon={IconTeam} value={crew ?? "–"} unit={crew === 1 ? "person" : "people"} />
        ) : null}
      </ul>
    </div>
  );
}

/* ── The hub's cards ──────────────────────────────────────────────── */

const cardBox = `${glass} flex h-full min-h-[112px] min-w-0 flex-col justify-between gap-4 p-4 sm:min-h-[128px] sm:p-5`;

function CardHead({ icon: Icon, title }: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.06] text-[#CFE3EC]">
        <Icon />
      </span>
      <span className="truncate text-small font-medium text-text">{title}</span>
    </div>
  );
}

function HubCard({
  screen,
  space,
  icon,
  value,
  unit,
  attention,
  to,
}: {
  screen: Screen;
  space: SpaceView;
  /** Where the card opens, when that is a screen of its own outside the listing. */
  to?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  value: ReactNode;
  unit: string;
  attention?: boolean;
}) {
  const href = useHref();
  return (
    <li>
      <Link href={href(to ?? `/listings/${space.id}?tab=${screen}`)} className={`${cardBox} transition-colors hover:bg-white/[0.07]`}>
        <CardHead icon={icon} title={SCREEN_TITLE[screen]} />
        <p className="flex min-w-0 items-baseline gap-2">
          <span className={`text-[22px] font-medium leading-none tabular-nums sm:text-[26px] ${attention ? "text-amber" : "text-text"}`}>{value}</span>
          <span className="truncate text-tiny text-[#9FB7C2]">{unit}</span>
        </p>
      </Link>
    </li>
  );
}

const actionBtn =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-white/10 bg-white/[0.06] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text disabled:cursor-not-allowed disabled:opacity-40";

/** "Your link": copy it or share it. The address itself is never printed. */
function LinkCard({ share }: { share: { url: string; text: string } | null }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  function copy() {
    if (!share) return;
    const done = navigator.clipboard?.writeText(share.url);
    if (done) void done.then(() => setCopied(true), () => setCopied(false));
  }

  function send() {
    if (!share) return;
    const text = share.text.includes(share.url) ? share.text : `${share.text} ${share.url}`;
    if (typeof navigator.share === "function") {
      void navigator.share({ text: share.text, url: share.url }).catch(() => undefined);
      return;
    }
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={cardBox}>
      <CardHead icon={IconLink} title="Your link" />
      <div className="flex gap-2">
        <button type="button" className={`${actionBtn} flex-1`} disabled={!share} onClick={copy}>
          <IconCopy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className={`${actionBtn} flex-1`} disabled={!share} onClick={send}>
          <IconShare className="h-3.5 w-3.5" />
          Share
        </button>
      </div>
    </div>
  );
}

/* ── A card's own screen ──────────────────────────────────────────── */

function ScreenFrame({ space, title, children }: { space: SpaceView; title: string; children: ReactNode }) {
  const href = useHref();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={href(`/listings/${space.id}`)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-[#9FB7C2]">{space.serviceName || space.title}</p>
          <h2 className="truncate text-body font-medium text-text">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Rungs: one row per thing sold, not per copy of it ────────────── */

interface Rung {
  key: string;
  title: string;
  positions: PositionView[];
}

/**
 * The positions grouped back into what the creator listed: a rung with three
 * available is three positions sharing a `tierKey`. A placement's zones, and
 * slots with no rung, are one each.
 */
function rungsOf(positions: readonly PositionView[]): Rung[] {
  const out: Rung[] = [];
  for (const p of positions) {
    const key = p.tierKey ?? p.id;
    const seen = out.find((r) => r.key === key);
    if (seen) seen.positions.push(p);
    else out.push({ key, title: p.title ?? p.label, positions: [p] });
  }
  return out;
}

function priceText(p: PositionView): string {
  if (p.priceCents !== null) return usd(p.priceCents);
  return p.offers?.mode === "bids" ? "Bids" : "Offers";
}

/* ── Spots ────────────────────────────────────────────────────────── */

function Spots({ space }: { space: SpaceView }) {
  const rungs = rungsOf(space.positions);
  return (
    <Panel title="Spots" meta={`${space.totals.sold}/${space.totals.positions} sold`} bodyClassName={PANEL_BODY}>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-small">
          <thead>
            <tr className="text-[11px] text-[#9FB7C2]">
              <th className="px-2 py-2 font-normal">Spot</th>
              <th className="px-2 py-2 font-normal">Price</th>
              <th className="px-2 py-2 font-normal">Sold</th>
              <th className="px-2 py-2 font-normal">Sponsors</th>
            </tr>
          </thead>
          <tbody>
            {rungs.map((r) => {
              const sold = r.positions.filter((p) => p.status === "sold").length;
              const held = r.positions.filter((p) => p.status === "held").length;
              const sponsors = r.positions.map((p) => p.sponsor?.name).filter((n): n is string => !!n);
              return (
                <tr key={r.key} className="border-t border-white/[0.06]">
                  <td className="max-w-[260px] truncate px-2 py-2.5 text-text">{r.title}</td>
                  <td className="px-2 py-2.5 tabular-nums text-[#CFE3EC]">{priceText(r.positions[0])}</td>
                  <td className="px-2 py-2.5">
                    <span className={sold === r.positions.length ? pill.sold : held ? pill.held : pill.open}>
                      {sold}/{r.positions.length}
                      {held ? ` · ${held} held` : ""}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate px-2 py-2.5 text-[#CFE3EC]">{sponsors.length ? sponsors.join(", ") : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ── Floor prices: one per rung ───────────────────────────────────── */

interface FloorGroup {
  key: string;
  title: string;
  /** Set on every one of these at once. */
  save: (cents: number | null) => Promise<unknown>;
  current: string | null;
}

function floorGroups(space: SpaceView): FloorGroup[] {
  const out: FloorGroup[] = [];
  if (space.spaceOffers?.minOfferUsdc !== undefined) {
    out.push({
      key: "listing",
      title: "Every slot",
      current: space.spaceOffers.minOfferUsdc ?? null,
      save: (cents) => setListingFloor(space.id, cents),
    });
  }
  for (const r of rungsOf(space.positions.filter((p) => p.offers?.minOfferUsdc !== undefined))) {
    out.push({
      key: r.key,
      title: r.title,
      current: r.positions.find((p) => p.offers?.minOfferUsdc)?.offers?.minOfferUsdc ?? null,
      // The server keeps a floor per position: a rung's floor is set on each copy of it.
      save: (cents) => Promise.all(r.positions.map((p) => setPositionFloor(p.id, cents))),
    });
  }
  return out;
}

function Floors({ space, groups, onChanged }: { space: SpaceView; groups: FloorGroup[]; onChanged: () => void }) {
  return (
    <Panel title="Floor prices" meta="Private" bodyClassName={PANEL_BODY}>
      <ul className="flex flex-col">
        {groups.map((g) => (
          <FloorRow key={`${space.id}-${g.key}`} group={g} onChanged={onChanged} />
        ))}
      </ul>
    </Panel>
  );
}

function FloorRow({ group, onChanged }: { group: FloorGroup; onChanged: () => void }) {
  const [value, setValue] = useState(dollarsFromCents(centsFromUsdc(group.current)));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const current = centsFromUsdc(group.current);

  function save(cents: number | null) {
    setBusy(true);
    setNotice(null);
    void group
      .save(cents)
      .then(onChanged)
      .catch((e) => setNotice(describeRunError(e)))
      .finally(() => setBusy(false));
  }

  return (
    <li className="flex flex-col gap-2 border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
        <p className="min-w-0 flex-1 truncate text-small text-text">
          {group.title}
          <span className="text-[#9FB7C2]"> · {current !== null ? usd(current) : "No floor"}</span>
        </p>
        <div className="flex items-center gap-2">
          <div className="w-full min-w-0 lg:w-[180px]">
            <Money value={value} onChange={setValue} placeholder={`Min ${usd(2_500)}`} />
          </div>
          <button
            type="button"
            className={btnSmall}
            disabled={busy || (value.trim() !== "" && centsFromDollars(value) === null)}
            onClick={() => save(value.trim() ? centsFromDollars(value) : null)}
          >
            {busy ? "Saving…" : "Save"}
          </button>
          {/* Kept in place without a floor, so every row's buttons line up. */}
          <button
            type="button"
            className={`${btnSmallSecondary} ${current === null ? "invisible" : ""}`}
            disabled={busy || current === null}
            onClick={() => save(null)}
          >
            Remove
          </button>
        </div>
      </div>
      {notice ? <Notice>{notice}</Notice> : null}
    </li>
  );
}

/* ── Updates ──────────────────────────────────────────────────────── */

function Updates({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Panel title="Updates" meta={`${space.updates.length}`} bodyClassName={PANEL_BODY}>
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
    </Panel>
  );
}
