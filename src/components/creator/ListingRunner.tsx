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
import { t as tl } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
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
import { PagePreview } from "./run/PagePreview";
import { PhotoEditor, viewOfZones } from "./run/PhotoEditor";
import { ColourEditor, ProductHub, drawingOf } from "./run/ProductLook";
import { GroundPicker, labelOf } from "./run/GroundPicker";
import { Work } from "./run/Work";
import { ListingSeries } from "./series/Series";
import { ListingTeam } from "./team/ListingTeam";
import { ListingPackage } from "./crew/ListingPackage";

/** A screen's body scrolls inside itself on a wide screen, so the page stays one screen. */
const SCREEN_BODY = "lg:max-h-[calc(var(--app-vh,100dvh)-196px)] lg:overflow-y-auto";

type Screen = "events" | "offers" | "floors" | "spots" | "photo" | "ground" | "deliveries" | "updates" | "content" | "team" | "together";

const SCREEN_TITLE = {
  events: "runner.screen.events",
  offers: "runner.screen.offers",
  floors: "runner.screen.floors",
  spots: "runner.screen.spots",
  photo: "runner.screen.photo",
  ground: "runner.screen.ground",
  deliveries: "runner.screen.deliveries",
  updates: "runner.screen.updates",
  content: "runner.screen.content",
  team: "runner.screen.team",
  together: "runner.screen.together",
} as const satisfies Record<Screen, string>;

export function ListingRunner({ spaceId, tab, item }: { spaceId: string; tab?: string; item?: string }) {
  const t = useT();
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
      const [o, s, sr, tm] = await Promise.all([
        wants ? listingOffers(spaceId).catch(() => ({ offers: [] as OfferView[] })) : Promise.resolve({ offers: [] as OfferView[] }),
        next.status === "draft" ? Promise.resolve(null) : shareListing(spaceId).catch(() => null),
        owner && next.status !== "delisted" ? getSeries(spaceId).catch(() => ({ series: null })) : Promise.resolve({ series: null }),
        owner && agency.on ? listingTeam(spaceId).catch(() => null) : Promise.resolve(null),
      ]);
      setOffers(o.offers);
      setShare(s);
      setSeries(sr.series);
      setCrew(tm ? tm.assignments.length : null);
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
  if (error || !space) return <HoldNotice icon="cloud-offline-outline">{error ?? t("runner.hub.notLoading")}</HoldNotice>;

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
    // A package several creators sell together, each paid in the brand's one payment.
    together: owner && space.status !== "delisted" && space.status !== "closed",
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
    const title =
      item === "colour"
        ? t("runner.photo.colours")
        : item === "one"
          ? t("runner.photo.onePhoto")
          : sideLabel
            ? t("runner.hub.sidePhoto", { side: sideLabel })
            : t("runner.screen.photo");
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
      <ScreenFrame space={space} title={t(SCREEN_TITLE[screen])}>
        {screen === "events" ? (
          <div className={SCREEN_BODY}>
            <ListingSeries space={space} onChanged={changed} />
          </div>
        ) : null}
        {screen === "offers" ? (
          <Panel title={t("runner.screen.offers")} meta={`${offers.length}`}>
            <Offers space={space} offers={offers} onChanged={changed} />
          </Panel>
        ) : null}
        {/* Keyed on what the server holds: a save reloads the listing and the card starts from it. */}
        {screen === "floors" ? (
          <Floors key={floorsKey(floors)} groups={floors} onChanged={changed} views={drawingOf(space).views} />
        ) : null}
        {screen === "spots" ? <Spots space={space} /> : null}
        {screen === "photo" ? <ProductHub space={space} /> : null}
        {screen === "ground" ? <ListingGround space={space} onChanged={changed} /> : null}
        {screen === "deliveries" ? (
          <Panel title={t("runner.screen.deliveries")}>
            <div className={SCREEN_BODY}>
              <Work space={space} onChanged={changed} />
            </div>
          </Panel>
        ) : null}
        {screen === "updates" ? <Updates space={space} onChanged={changed} /> : null}
        {screen === "team" ? (
          <div className={SCREEN_BODY}>
            <ListingTeam spaceId={space.id} />
          </div>
        ) : null}
        {screen === "together" ? (
          <div className={SCREEN_BODY}>
            <ListingPackage spaceId={space.id} title={space.title} offersSolana={space.chains.includes("solana")} onChanged={changed} />
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
        <HoldNotice icon="eye-off-outline">{t("runner.hub.delisted")}</HoldNotice>
      ) : space.status === "closed" ? (
        <HoldNotice icon="lock-closed-outline" tone="calm">
          {t("runner.hub.closed")}
        </HoldNotice>
      ) : null}

      <ListingBanner space={space} owner={owner} publicUrl={share?.url ?? null} onChanged={changed} />

      {space.status === "live" ? <LinkCard share={share} /> : null}

      <ul className="flex flex-col gap-2">
        {shown.events ? (
          <HubCard screen="events" space={space} icon="calendar-outline" value={events} unit={t("runner.hub.events", { count: events })} />
        ) : null}
        {shown.offers ? (
          <HubCard
            screen="offers"
            space={space}
            // The inbox's own screen for this listing, with Back to this hub. A rep has no inbox.
            to={role === "rep" ? undefined : `/offers?listing=${encodeURIComponent(space.id)}&from=listing`}
            icon="pricetags-outline"
            value={waiting}
            unit={waiting ? t("runner.hub.waiting") : offers.length ? t("runner.hub.inTotal", { count: offers.length }) : t("runner.hub.noneYet")}
            attention={waiting > 0}
          />
        ) : null}
        {shown.floors ? (
          <HubCard screen="floors" space={space} icon="cash-outline" value={floorsSet} unit={t("runner.hub.ofSet", { count: floors.length })} />
        ) : null}
        <HubCard screen="spots" space={space} icon="grid-outline" value={t("runner.xOfY", { n: space.totals.sold, total: space.totals.positions })} unit={t("runner.hub.sold")} />
        {shown.photo ? (
          <HubCard
            screen="photo"
            space={space}
            icon="camera-outline"
            value={
              space.photo
                ? space.photo.ready
                  ? t("runner.hub.photo")
                  : t("runner.xOfY", { n: placedSquares, total: space.positions.length })
                : sidesLive > 0
                  ? t("runner.hub.sides", { count: sidesLive })
                  : space.productLook
                    ? t("runner.photo.colours")
                    : "–"
            }
            unit={
              space.photo
                ? space.photo.ready
                  ? t("runner.hub.onYourPage")
                  : t("runner.hub.spotsPlaced")
                : sidesLive > 0
                  ? t("runner.hub.photographed")
                  : space.productLook
                    ? t("runner.hub.onTheDrawing")
                    : t("runner.hub.coloursOrPhotos")
            }
          />
        ) : null}
        {shown.ground ? (
          <HubCard
            screen="ground"
            space={space}
            icon="color-palette-outline"
            value={labelOf(space.pageGround ?? null)}
            unit={space.pageGroundOwn ? t("runner.hub.listingOwn") : t("runner.hub.yourDefault")}
          />
        ) : null}
        {shown.deliveries ? (
          <HubCard
            screen="deliveries"
            space={space}
            icon="checkbox-outline"
            value={artwork + toDeliver}
            unit={artwork ? t("runner.hub.toDoArtwork", { count: artwork }) : t("runner.hub.toDo")}
            attention={artwork + toDeliver > 0}
          />
        ) : null}
        {shown.updates ? (
          <HubCard screen="updates" space={space} icon="megaphone-outline" value={space.updates.length} unit={t("runner.hub.posted")} />
        ) : null}
        {shown.content ? (
          <HubCard screen="content" space={space} icon="chatbubble-ellipses-outline" value={leads.length} unit={t("runner.hub.brands", { count: leads.length })} />
        ) : null}
        {shown.team ? (
          <HubCard screen="team" space={space} icon="people-outline" value={crew ?? "–"} unit={t("runner.hub.people", { count: crew ?? 0 })} />
        ) : null}
        {shown.together ? (
          <HubCard
            screen="together"
            space={space}
            icon="people-outline"
            value={space.crew ? space.crew.name : "–"}
            unit={
              space.crew
                ? space.crew.ready
                  ? t("runner.hub.creators", { count: space.crew.members.length })
                  : t("runner.hub.waitingYes")
                : t("runner.hub.sellWithOthers")
            }
            attention={Boolean(space.crew && !space.crew.ready)}
          />
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
  const t = useT();
  const href = useHref();
  return (
    <li>
      <SheetRow
        href={href(to ?? `/listings/${space.id}?tab=${screen}`)}
        icon={icon}
        title={t(SCREEN_TITLE[screen])}
        meta={
          <span className={attention ? "text-amber" : undefined}>
            {value === "–" ? unit : typeof value === "string" && !/\p{Nd}/u.test(value) ? `${value} · ${unit}` : <>{value} {unit}</>}
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
  const t = useT();
  if (!share) return null;
  return (
    <button
      type="button"
      aria-label={t("runner.share.progress")}
      onClick={() => sendShare(share)}
      className="flex h-9 w-9 items-center justify-center rounded-[18px] text-white transition-colors hover:bg-white/10"
    >
      <Ion name="share-outline" size={21} />
    </button>
  );
}

/** "Share progress" (the app's TravelCta) and the link under it, copied on a tap. */
function LinkCard({ share }: { share: { url: string; text: string } | null }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
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
        {t("runner.share.progress")}
      </button>
      {share ? (
        <button type="button" onClick={copy} className="flex max-w-full items-center gap-1.5 self-center py-1 text-white/55 hover:text-white">
          <Ion name={copied ? "checkmark" : "link-outline"} size={14} />
          <span className="truncate text-[13px] font-strong text-white/[0.62]">
            {copied ? t("runner.share.copied") : share.url.replace(/^https:\/\//, "").replace(/\?.*$/, "")}
          </span>
          {copied ? null : <Ion name="copy-outline" size={14} />}
        </button>
      ) : null}
      <p className="text-center text-[12px] leading-[17px] text-white/55">
        {t("runner.share.note")}
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
      <BackHeader title={title} subtitle={space.serviceName || space.title} backHref={back ?? href(`/listings/${space.id}`)} />
      {children}
    </div>
  );
}

/* ── Page background ──────────────────────────────────────────────── */

/**
 * This listing's own ground, or "Same as my default" (Spaces › Settings), with
 * the page itself beside it.
 *
 * A background was picked from five small cards and a hex field, and the only
 * way to see what it did was to save it and go and look — on a live listing,
 * in front of sponsors. The page is here now, and it repaints on every pick,
 * unsaved: `?ground=` on the preview route overrides the stored one for that
 * render alone. Saving still saves; looking no longer costs anything.
 */
function ListingGround({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const t = useT();
  const [fallback, setFallback] = useState<string | null | undefined>(undefined);
  const [picked, setPicked] = useState<string | null>(space.pageGroundOwn ?? null);
  const [saved, setSaved] = useState(0);
  useEffect(() => {
    void getCreatorSettings()
      .then(({ settings }) => setFallback(settings.listingGround ?? settings.pageGround ?? null))
      .catch(() => setFallback(null));
  }, []);
  if (fallback === undefined) return <Skeleton className="h-[240px]" />;
  // "Same as my default" is null on the listing, and the preview must then
  // stand on the default itself, not on whatever the server last stored.
  const showing = picked ?? fallback;
  return (
    <div className={`${SCREEN_BODY} flex flex-col gap-4 xl:flex-row xl:items-start`}>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Body dim>{t("runner.ground.intro")}</Body>
        <GroundPicker
          key={space.pageGroundOwn ?? "default"}
          value={space.pageGroundOwn ?? null}
          allowDefault
          defaultValue={fallback}
          onPicked={setPicked}
          onSave={(next) =>
            setListingPageGround(space.id, next).then((r) => {
              setSaved((n) => n + 1);
              return onChanged(), r;
            })
          }
        />
      </div>
      <PagePreview spaceId={space.id} ground={showing} reload={saved} className="xl:w-[420px]" />
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
  return p.offers?.mode === "bids" ? tl("runner.price.bids") : tl("runner.price.offers");
}

/* ── Spots ────────────────────────────────────────────────────────── */

/**
 * Every spot as a small card, in a grid.
 *
 * Eighteen spots were eighteen full-width rows and a page that scrolled twice.
 * A spot is four short things — what it is, what it costs, whether it is sold,
 * and who bought it — so it fits a card a quarter of the width, and eighteen
 * of them fit a screen.
 */
function Spots({ space }: { space: SpaceView }) {
  const t = useT();
  const rungs = rungsOf(space.positions);
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel right={<span className="text-[12.5px] font-strong normal-case tracking-normal text-white/55">{t("runner.spots.soldOf", { sold: space.totals.sold, total: space.totals.positions })}</span>}>
        {space.kind === "service" ? t("runner.spots.slots") : t("runner.screen.spots")}
      </SectionLabel>
      {/* Three to a row, not four: the screen is 720 wide, and a fourth column
          would cut "Front face, large" in half. */}
      <ul className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${SCREEN_BODY}`}>
        {rungs.map((r) => {
          const sold = r.positions.filter((p) => p.status === "sold").length;
          const held = r.positions.filter((p) => p.status === "held").length;
          const sponsors = r.positions.map((p) => p.sponsor?.name).filter((n): n is string => !!n);
          const all = sold === r.positions.length;
          return (
            // The app's PositionRow, folded into a card: name, price, state, who bought it.
            <li key={r.key} className="flex min-w-0 flex-col gap-1.5 rounded-[14px] bg-white/[0.04] p-2.5">
              <p className="min-w-0 truncate text-[13.5px] font-bold text-white">{r.title}</p>
              <p className="text-[13.5px] font-bold tabular-nums text-white">{priceText(r.positions[0])}</p>
              <Tag
                label={
                  r.positions.length > 1
                    ? held
                      ? t("runner.spots.soldOfHeld", { sold, total: r.positions.length, held })
                      : t("runner.spots.soldOf", { sold, total: r.positions.length })
                    : all
                      ? t("runner.spots.sold")
                      : held
                        ? t("runner.spots.beingPaid")
                        : t("runner.spots.open")
                }
                tone={all ? "good" : held ? "caution" : "calm"}
              />
              {sponsors.length ? <p className="min-w-0 truncate text-[12px] leading-4 text-white/55">{sponsors.join(", ")}</p> : null}
            </li>
          );
        })}
      </ul>
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
  /** The side of the product this one sits on, so eighteen floors read as four groups of four or five. */
  view?: string | null;
}

function floorGroups(space: SpaceView): FloorGroup[] {
  const out: FloorGroup[] = [];
  if (space.spaceOffers?.minOfferUsdc !== undefined) {
    out.push({
      key: "listing",
      title: tl("runner.floors.everySlot"),
      current: space.spaceOffers.minOfferUsdc ?? null,
      save: (cents) => setListingFloor(space.id, cents),
    });
  }
  const zoneView = viewOfZones(space);
  for (const r of rungsOf(space.positions.filter((p) => p.offers?.minOfferUsdc !== undefined))) {
    out.push({
      key: r.key,
      title: r.title,
      current: r.positions.find((p) => p.offers?.minOfferUsdc)?.offers?.minOfferUsdc ?? null,
      // The server keeps a floor per position: a rung's floor is set on each copy of it.
      save: (cents) => Promise.all(r.positions.map((p) => setPositionFloor(p.id, cents))),
      view: zoneView.get(r.positions[0].zoneKey) ?? null,
    });
  }
  return out;
}

/**
 * The floors split by the side they sit on, in the drawing's own order, with
 * anything the drawing does not place last and unlabelled. One section when
 * there is only one, so a service's slots never grow a heading for nothing.
 */
function floorSections(groups: readonly FloorGroup[], views: readonly { key: string; label: string }[]) {
  const order = new Map(views.map((v, i) => [v.key, i]));
  const byView = new Map<string, FloorGroup[]>();
  for (const g of groups) {
    const k = g.view ?? "";
    const list = byView.get(k) ?? [];
    list.push(g);
    byView.set(k, list);
  }
  const sections = [...byView].map(([key, rows]) => ({
    key,
    label: views.find((v) => v.key === key)?.label ?? null,
    rows,
  }));
  // The listing-wide floor ("Every slot") carries no side, and goes first.
  const at = (key: string) => order.get(key) ?? (key === "" ? -1 : 99);
  sections.sort((a, b) => at(a.key) - at(b.key));
  return sections.length > 1 ? sections : [{ key: "", label: null, rows: [...groups] }];
}

/** What each row holds now, as typed. An empty string is "no floor". */
type FloorValues = Record<string, string>;

function typedNow(groups: readonly FloorGroup[]): FloorValues {
  return Object.fromEntries(groups.map((g) => [g.key, dollarsFromCents(centsFromUsdc(g.current))]));
}

/** A row's figure is a floor, nothing at all, or something that is not money. */
function readFloor(text: string): { ok: true; cents: number | null } | { ok: false } {
  if (!text.trim()) return { ok: true, cents: null };
  const cents = centsFromDollars(text);
  return cents === null ? { ok: false } : { ok: true, cents };
}

/** A signature of what the server holds: the card starts over when that changes. */
function floorsKey(groups: readonly FloorGroup[]): string {
  return groups.map((g) => `${g.key}:${g.current ?? ""}`).join("|");
}

/**
 * Every floor on one card, with one Save.
 *
 * There was a Save and a Remove on every row — eighteen of each on a board
 * with eighteen spots, and no way to tell whether the card as a whole was
 * saved. The rows are fields now. One Save writes every row that changed,
 * "Set the same floor for all" copies the first row's figure down the card,
 * and "Clear all" empties them (saving then takes every floor off).
 *
 * MINI-CARDS, GROUPED BY SIDE
 *
 * Eighteen full-width rows was a column three screens tall inside a box one
 * screen tall, so the eighteenth was cut in half by the edge and the Save
 * under it looked like it belonged to whatever row happened to be showing.
 * Each floor is a small card in a grid instead — the same shape the Spots
 * screen settled on — and the cards are grouped by the side of the product
 * they sit on, which is how the creator thinks about them. Eighteen rows
 * become four short groups, and nothing is cut.
 */
function Floors({ groups, onChanged, views = [] }: { groups: FloorGroup[]; onChanged: () => void; views?: readonly { key: string; label: string }[] }) {
  const t = useT();
  const [values, setValues] = useState<FloorValues>(() => typedNow(groups));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const saved = typedNow(groups);
  const changed = groups.filter((g) => (values[g.key] ?? "") !== saved[g.key]);
  const bad = groups.some((g) => !readFloor(values[g.key] ?? "").ok);
  // What "the same floor for all" copies: the first row that holds a figure.
  const first = groups.map((g) => (values[g.key] ?? "").trim()).find((v) => v !== "") ?? "";

  const set = (key: string, text: string) => setValues((v) => ({ ...v, [key]: text }));
  const fill = (text: string) => setValues(Object.fromEntries(groups.map((g) => [g.key, text])));

  async function saveAll() {
    setBusy(true);
    setNotice(null);
    try {
      for (const g of changed) {
        const read = readFloor(values[g.key] ?? "");
        if (!read.ok) continue;
        await g.save(read.cents);
      }
      onChanged();
    } catch (e) {
      setNotice(describeRunError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={t("runner.screen.floors")} meta={t("runner.floors.private")}>
      <div className={`flex flex-col gap-3 pb-1 ${SCREEN_BODY}`}>
        {floorSections(groups, views).map((section) => (
          <section key={section.key || "all"} className="flex flex-col gap-2">
            {section.label ? <SectionLabel>{section.label}</SectionLabel> : null}
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.rows.map((g) => {
                const current = centsFromUsdc(g.current);
                return (
                  <li key={g.key} className="flex min-w-0 flex-col gap-2 rounded-[14px] bg-white/[0.04] p-2.5">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="min-w-0 truncate text-[13.5px] font-bold text-white">{g.title}</p>
                      {/* What the server holds now, so a typed figure that is not saved yet reads as a change. */}
                      <p className="text-[12px] leading-4 text-white/55">
                        {current !== null ? t("runner.floors.now", { amount: usd(current) }) : t("runner.floors.none")}
                      </p>
                    </div>
                    <Money value={values[g.key] ?? ""} onChange={(text) => set(g.key, text)} placeholder={t("runner.floors.min", { amount: usd(2_500) })} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-3">
        <Chip
          label={busy ? t("common.saving") : changed.length ? t("runner.floors.saveChanges", { count: changed.length }) : t("common.save")}
          selected
          disabled={busy || bad || changed.length === 0}
          onClick={() => void saveAll()}
        />
        <Chip label={t("runner.floors.sameForAll")} disabled={busy || groups.length < 2 || first === ""} onClick={() => fill(first)} />
        <Chip label={t("runner.floors.clearAll")} disabled={busy || groups.every((g) => (values[g.key] ?? "") === "")} onClick={() => fill("")} />
        {bad ? <span className="text-[12.5px] font-strong text-amber">{t("runner.floors.bad")}</span> : null}
      </div>
      {notice ? <Notice>{notice}</Notice> : null}
    </Panel>
  );
}

/* ── Updates ──────────────────────────────────────────────────────── */

function Updates({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const t = useT();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const labelOf = new Map(space.positions.map((p) => [p.id, p.label]));

  return (
    <section className="flex flex-col gap-2.5">
      <SectionLabel>{t("runner.updates.post")}</SectionLabel>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Text value={body} onChange={setBody} maxLength={280} placeholder={t("runner.updates.placeholder")} />
        </div>
        <Chip
          label={busy ? t("runner.updates.posting") : t("runner.updates.postButton")}
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

      <SectionLabel>{t("runner.screen.updates")}</SectionLabel>
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
                    {t("runner.updates.delete")}
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] leading-[17px] text-white/55">{t("runner.updates.empty")}</p>
      )}
    </section>
  );
}
