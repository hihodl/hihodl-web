/**
 * One listing, in the product shell: a hub of cards.
 *
 * On top, the listing's own picture, big, with its name and the one number that
 * matters. Under it, one card per part of running it — the link, the events,
 * the offers, the floors, the spots, the deliveries, the updates, "Offer them
 * content" once a brand holds a spot (./ContentOffer: a spot is often where a
 * content deal starts) and, for a Creative Director, who works it — each with
 * one small figure. A card opens
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

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useHref } from "@/components/app/base";
import { BackHeader, ctaPrimary, Notice as HoldNotice } from "@/components/app/hold";
import { Ion, type IonName } from "@/components/app/ion";
import { ContentOfferScreen, midSentence, useOffersContent, type ContentLead } from "@/components/app/spaces/ContentOffer";
import { Body, Card, Chip, dateTimeText, Group as Panel, SectionLabel, SheetRow, Tag } from "@/components/app/spaces/kit";
import { useShell } from "@/components/app/Shell";
import { Skeleton } from "@/components/app/ui";
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
  getCreatorSettings,
  getListing,
  getSeries,
  listingOffers,
  listingTeam,
  removeUpdate,
  setListingFloor,
  setListingPageGround,
  setPositionFloor,
  shareListing,
} from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Money, Text } from "./listing/parts";
import { Notice } from "./parts";
import { ListingBanner } from "./run/ListingBanner";
import { Offers } from "./run/Offers";
import { PhotoEditor } from "./run/PhotoEditor";
import { ColourEditor, ProductHub, drawingOf } from "./run/ProductLook";
import { GroundPicker, labelOf } from "./run/GroundPicker";
import { Work } from "./run/Work";
import { ListingSeries } from "./series/Series";
import { ListingTeam } from "./team/ListingTeam";

/** A screen's body scrolls inside itself on a wide screen, so the page stays one screen. */
const SCREEN_BODY = "lg:max-h-[calc(var(--app-vh,100dvh)-196px)] lg:overflow-y-auto";

type Screen = "events" | "offers" | "floors" | "spots" | "photo" | "ground" | "deliveries" | "updates" | "content" | "team";

const SCREEN_TITLE: Record<Screen, string> = {
  events: "Events",
  offers: "Offers & bids",
  floors: "Floor prices",
  spots: "Spots",
  photo: "Your product",
  ground: "Page background",
  deliveries: "Deliveries",
  updates: "Updates",
  content: "Offer them content",
  team: "Who works it",
};

export function ListingRunner({ spaceId, tab, item }: { spaceId: string; tab?: string; item?: string }) {
  const href = useHref();
  const { listings, agency, role } = useShell();
  const refresh = useRefresh();
  const offersContent = useOffersContent();
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
        <Skeleton className="h-[168px] rounded-[16px] sm:h-[200px] xl:h-[220px]" />
        <Skeleton className="h-[112px] rounded-[18px]" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[58px] rounded-[14px]" />
          ))}
        </div>
      </div>
    );
  }
  if (error || !space) return <HoldNotice icon="cloud-offline-outline">{error ?? "This space isn't loading"}</HoldNotice>;

  const takesOffers = space.pricingMode !== "fixed" || space.acceptsOffers || space.positions.some((p) => p.saleMode);
  const floors = floorGroups(space);
  const hasFloors = floors.length > 0;
  // Brands holding a spot here, by name: a spot is often where a content deal starts.
  const leads: ContentLead[] =
    owner && offersContent(listings.find((l) => l.id === space.id))
      ? space.positions
          .filter((p) => p.status === "sold" && p.sponsor?.name)
          .map((p) => ({
            key: p.id,
            brand: p.sponsor!.name!,
            bought: p.title ?? p.label,
            kind: space.kind,
            product: midSentence(space.template?.name ?? space.serviceName ?? (space.kind === "placement" ? "product" : "content")),
            listing: space.serviceName || space.title,
            event: space.event
              ? { slug: space.event.slug, name: space.event.name, city: space.event.city, startsOn: space.event.startsOn, endsOn: space.event.endsOn }
              : null,
          }))
      : [];
  const shown: Record<Screen, boolean> = {
    events: owner && space.status !== "delisted",
    offers: takesOffers,
    floors: hasFloors,
    spots: true,
    // The creator's own photo with the spots on it: a product's, never a service's slots.
    photo: owner && space.kind === "placement" && space.status !== "delisted",
    // What this listing's page stands on, over the creator's default. Any listing, the owner's alone.
    ground: owner && space.status !== "delisted",
    deliveries: space.status !== "draft",
    updates: space.status !== "draft",
    content: leads.length > 0,
    team: owner && agency.on,
  };

  const screen = (Object.keys(shown) as Screen[]).find((k) => k === tab && shown[k]) ?? null;

  if (screen === "content") {
    return <ContentOfferScreen back={href(`/listings/${space.id}`)} crumb={space.serviceName || space.title} leads={leads} initial={item ?? null} />;
  }

  if (screen === "photo" && item) {
    // One way of dressing the product, on its own screen, with Back to "Your product".
    const back = href(`/listings/${space.id}?tab=photo`);
    const side = item.startsWith("side-") ? decodeURIComponent(item.slice(5)) : null;
    const sideLabel = side ? drawingOf(space).views.find((v) => v.key === side)?.label ?? side : null;
    const title = item === "colour" ? "Colours" : item === "one" ? "One photo" : sideLabel ? `${sideLabel} photo` : "Your product";
    return (
      <ScreenFrame space={space} title={title} back={back}>
        {item === "colour" ? <ColourEditor space={space} onChanged={changed} /> : null}
        {item === "one" ? <PhotoEditor space={space} onChanged={changed} /> : null}
        {side ? <PhotoEditor key={side} space={space} onChanged={changed} view={side} viewLabel={sideLabel} /> : null}
      </ScreenFrame>
    );
  }

  if (screen) {
    return (
      <ScreenFrame space={space} title={SCREEN_TITLE[screen]}>
        {screen === "events" ? (
          <div className={SCREEN_BODY}>
            <ListingSeries space={space} onChanged={changed} />
          </div>
        ) : null}
        {screen === "offers" ? (
          <Panel title="Offers & bids" meta={`${offers.length}`}>
            <Offers space={space} offers={offers} onChanged={changed} />
          </Panel>
        ) : null}
        {screen === "floors" ? <Floors space={space} groups={floors} onChanged={changed} /> : null}
        {screen === "spots" ? <Spots space={space} /> : null}
        {screen === "photo" ? <ProductHub space={space} /> : null}
        {screen === "ground" ? <ListingGround space={space} onChanged={changed} /> : null}
        {screen === "deliveries" ? (
          <Panel title="Deliveries">
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
  const placedSquares = space.positions.filter((p) => p.rect).length;
  const sidesLive = Object.values(space.viewPhotos ?? {}).filter((v) => v.ready).length;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3.5">
      <BackHeader title={space.serviceName || space.title} backHref={href("/listings")} right={<ShareButton share={share} />} />

      {space.status === "delisted" ? (
        <HoldNotice icon="eye-off-outline">This space was taken down after a review. It isn&apos;t public and takes no new sponsors.</HoldNotice>
      ) : space.status === "closed" ? (
        <HoldNotice icon="lock-closed-outline" tone="calm">
          This space is closed. Unsold spots stay unsold.
        </HoldNotice>
      ) : null}

      <ListingBanner space={space} owner={owner} publicUrl={share?.url ?? null} onChanged={changed} />

      {space.status === "live" ? <LinkCard share={share} /> : null}

      <ul className="flex flex-col gap-2">
        {shown.events ? (
          <HubCard screen="events" space={space} icon="calendar-outline" value={events} unit={events === 1 ? "event" : "events"} />
        ) : null}
        {shown.offers ? (
          <HubCard
            screen="offers"
            space={space}
            // The inbox's own screen for this listing, with Back to this hub. A rep has no inbox.
            to={role === "rep" ? undefined : `/offers?listing=${encodeURIComponent(space.id)}&from=listing`}
            icon="pricetags-outline"
            value={waiting}
            unit={waiting ? "waiting on you" : offers.length ? `${offers.length} in total` : "none yet"}
            attention={waiting > 0}
          />
        ) : null}
        {shown.floors ? (
          <HubCard screen="floors" space={space} icon="cash-outline" value={floorsSet} unit={`of ${floors.length} set`} />
        ) : null}
        <HubCard screen="spots" space={space} icon="grid-outline" value={`${space.totals.sold} of ${space.totals.positions}`} unit="sold" />
        {shown.photo ? (
          <HubCard
            screen="photo"
            space={space}
            icon="camera-outline"
            value={
              space.photo
                ? space.photo.ready
                  ? "Photo"
                  : `${placedSquares} of ${space.positions.length}`
                : sidesLive > 0
                  ? `${sidesLive} ${sidesLive === 1 ? "side" : "sides"}`
                  : space.productLook
                    ? "Colours"
                    : "–"
            }
            unit={
              space.photo
                ? space.photo.ready
                  ? "on your page"
                  : "spots placed"
                : sidesLive > 0
                  ? "photographed"
                  : space.productLook
                    ? "on the drawing"
                    : "colours or photos"
            }
          />
        ) : null}
        {shown.ground ? (
          <HubCard
            screen="ground"
            space={space}
            icon="color-palette-outline"
            value={labelOf(space.pageGround ?? null)}
            unit={space.pageGroundOwn ? "this listing's own" : "your default"}
          />
        ) : null}
        {shown.deliveries ? (
          <HubCard
            screen="deliveries"
            space={space}
            icon="checkbox-outline"
            value={artwork + toDeliver}
            unit={artwork ? `to do · ${artwork} artwork` : "to do"}
            attention={artwork + toDeliver > 0}
          />
        ) : null}
        {shown.updates ? (
          <HubCard screen="updates" space={space} icon="megaphone-outline" value={space.updates.length} unit="posted" />
        ) : null}
        {shown.content ? (
          <HubCard screen="content" space={space} icon="chatbubble-ellipses-outline" value={leads.length} unit={leads.length === 1 ? "brand to offer content" : "brands to offer content"} />
        ) : null}
        {shown.team ? (
          <HubCard screen="team" space={space} icon="people-outline" value={crew ?? "–"} unit={crew === 1 ? "person" : "people"} />
        ) : null}
      </ul>
    </div>
  );
}

/* ── The hub's rows ──────────────────────────────────────────────── */

/**
 * One part of running the listing, as the app's SheetRow: an icon, the name,
 * the figure on the meta line, a chevron. Amber when it waits on the creator.
 */
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
  icon: IonName;
  value: ReactNode;
  unit: string;
  attention?: boolean;
}) {
  const href = useHref();
  return (
    <li>
      <SheetRow
        href={href(to ?? `/listings/${space.id}?tab=${screen}`)}
        icon={icon}
        title={SCREEN_TITLE[screen]}
        meta={
          <span className={attention ? "text-amber" : undefined}>
            {value === "–" ? unit : typeof value === "string" && !/\d/.test(value) ? `${value} · ${unit}` : <>{value} {unit}</>}
          </span>
        }
        attention={attention}
      />
    </li>
  );
}

/** Opens the browser's share sheet, or a post on X where there is none. */
function sendShare(share: { url: string; text: string }) {
  const text = share.text.includes(share.url) ? share.text : `${share.text} ${share.url}`;
  if (typeof navigator.share === "function") {
    void navigator.share({ text: share.text, url: share.url }).catch(() => undefined);
    return;
  }
  window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

/** The header's share icon, as the app's creator header carries it. */
function ShareButton({ share }: { share: { url: string; text: string } | null }) {
  if (!share) return null;
  return (
    <button
      type="button"
      aria-label="Share progress"
      onClick={() => sendShare(share)}
      className="flex h-9 w-9 items-center justify-center rounded-[18px] text-white transition-colors hover:bg-white/10"
    >
      <Ion name="share-outline" size={21} />
    </button>
  );
}

/** "Share progress" (the app's TravelCta) and the link under it, copied on a tap. */
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

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={ctaPrimary} disabled={!share} onClick={() => share && sendShare(share)}>
        <Ion name="share-outline" size={20} />
        Share progress
      </button>
      {share ? (
        <button type="button" onClick={copy} className="flex max-w-full items-center gap-1.5 self-center py-1 text-white/55 hover:text-white">
          <Ion name={copied ? "checkmark" : "link-outline"} size={14} />
          <span className="truncate text-[13px] font-strong text-white/[0.62]">
            {copied ? "Link copied." : share.url.replace(/^https:\/\//, "").replace(/\?.*$/, "")}
          </span>
          {copied ? null : <Ion name="copy-outline" size={14} />}
        </button>
      ) : null}
      <p className="text-center text-[12px] leading-[17px] text-white/55">
        The link card on X shows your board as it is right now. We never post for you.
      </p>
    </div>
  );
}

/* ── A card's own screen ──────────────────────────────────────────── */

function ScreenFrame({
  space,
  title,
  back,
  children,
}: {
  space: SpaceView;
  title: string;
  /** Where Back goes: the listing's hub unless this screen sits under another. */
  back?: string;
  children: ReactNode;
}) {
  const href = useHref();
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3.5">
      <BackHeader title={title} backHref={back ?? href(`/listings/${space.id}`)} />
      <p className="-mt-3 truncate text-center text-[12.5px] font-strong text-white/55">{space.serviceName || space.title}</p>
      {children}
    </div>
  );
}

/* ── Page background ──────────────────────────────────────────────── */

/** This listing's own ground, or "Same as my default" (Spaces › Settings). */
function ListingGround({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const [fallback, setFallback] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void getCreatorSettings()
      .then(({ settings }) => setFallback(settings.listingGround ?? settings.pageGround ?? null))
      .catch(() => setFallback(null));
  }, []);
  if (fallback === undefined) return <Skeleton className="h-[240px]" />;
  return (
    <div className={`${SCREEN_BODY} flex flex-col gap-3`}>
      <Body dim>
        What this listing&rsquo;s page stands on. &ldquo;Same as my default&rdquo; follows your listings&rsquo; default in Settings ›
        Your pages.
      </Body>
      <GroundPicker
        key={space.pageGroundOwn ?? "default"}
        value={space.pageGroundOwn ?? null}
        allowDefault
        defaultValue={fallback}
        onSave={(next) => setListingPageGround(space.id, next).then(onChanged)}
      />
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
    <section className="flex flex-col gap-2">
      <SectionLabel right={<span className="text-[12.5px] font-strong normal-case tracking-normal text-white/55">{`${space.totals.sold} of ${space.totals.positions} sold`}</span>}>
        {space.kind === "service" ? "Slots" : "Spots"}
      </SectionLabel>
      {rungs.map((r) => {
        const sold = r.positions.filter((p) => p.status === "sold").length;
        const held = r.positions.filter((p) => p.status === "held").length;
        const sponsors = r.positions.map((p) => p.sponsor?.name).filter((n): n is string => !!n);
        const all = sold === r.positions.length;
        return (
          // The app's PositionRow: label and status tag, the price, who sponsored it.
          <div key={r.key} className="flex flex-col gap-[5px] rounded-[14px] border border-transparent bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-2.5">
              <p className="min-w-0 flex-1 truncate text-[14.5px] font-bold text-white">{r.title}</p>
              <Tag
                label={r.positions.length > 1 ? `${sold} of ${r.positions.length} sold${held ? ` · ${held} being paid` : ""}` : all ? "Sold" : held ? "Being paid" : "Open"}
                tone={all ? "good" : held ? "caution" : "calm"}
              />
            </div>
            <p className="text-[13.5px] font-bold tabular-nums text-white">{priceText(r.positions[0])}</p>
            {sponsors.length ? <p className="text-[12.5px] leading-[17px] text-white/55">Sponsored by {sponsors.join(", ")}</p> : null}
          </div>
        );
      })}
    </section>
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
    <Panel title="Floor prices" meta="Private">
      <ul className="flex flex-col divide-y divide-white/[0.08]">
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
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
        <p className="min-w-0 flex-1 truncate text-[14.5px] font-bold text-white">
          {group.title}
          <span className="font-normal text-white/55"> · {current !== null ? usd(current) : "No floor"}</span>
        </p>
        <div className="flex items-center gap-2">
          <div className="w-full min-w-0 lg:w-[180px]">
            <Money value={value} onChange={setValue} placeholder={`Min ${usd(2_500)}`} />
          </div>
          <Chip
            label={busy ? "Saving…" : "Save"}
            selected
            disabled={busy || (value.trim() !== "" && centsFromDollars(value) === null)}
            onClick={() => save(value.trim() ? centsFromDollars(value) : null)}
          />
          {/* Kept in place without a floor, so every row's buttons line up. */}
          <span className={current === null ? "invisible" : ""}>
            <Chip label="Remove" disabled={busy || current === null} onClick={() => save(null)} />
          </span>
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
  const labelOf = new Map(space.positions.map((p) => [p.id, p.label]));

  return (
    <section className="flex flex-col gap-2.5">
      <SectionLabel>Post an update</SectionLabel>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Text value={body} onChange={setBody} maxLength={280} placeholder="The mini strip is printed and on the case" />
        </div>
        <Chip
          label={busy ? "Posting…" : "Post"}
          icon="send-outline"
          selected
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
        />
      </div>
      {notice ? <Notice>{notice}</Notice> : null}

      <SectionLabel>Updates</SectionLabel>
      {space.updates.length > 0 ? (
        // The app's UpdatesList: one Card per update, the words, then when and which spot, and Delete.
        <ul className="flex flex-col gap-2.5">
          {space.updates.map((u) => (
            <li key={u.id}>
              <Card>
                <p className="text-[13.5px] leading-[19px] text-white/[0.62]">{u.body}</p>
                <div className="flex items-center justify-between gap-2.5">
                  <p className="text-[12.5px] leading-[17px] text-white/55">
                    {dateTimeText(u.createdAt)}
                    {u.positionId && labelOf.get(u.positionId) ? ` · ${labelOf.get(u.positionId)}` : ""}
                  </p>
                  <button
                    type="button"
                    className="text-[13px] font-strong text-white/[0.62] hover:text-white"
                    onClick={() => {
                      void removeUpdate(space.id, u.id)
                        .then(onChanged)
                        .catch((e) => setNotice(describeRunError(e)));
                    }}
                  >
                    Delete update
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] leading-[17px] text-white/55">Photos from the road go here. Pinned to a sold spot, a photo is its delivery proof.</p>
      )}
    </section>
  );
}
