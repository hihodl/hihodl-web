"use client";

/**
 * The property page's parts — the app's `PhotoGallery.tsx`, `RateRow.tsx`,
 * `RoomGroup.tsx` and `StayInfo.tsx`.
 *
 * ONE RULE RUNS THROUGH ALL OF THEM: A SECTION WITH NOTHING TO SAY IS ABSENT
 *
 * Not empty, not "None", not a heading over a blank card — absent. Every
 * component here returns null when the supplier gave us nothing, because a
 * property page is already long and a row that exists only to report its own
 * emptiness is the thing that makes people stop reading the ones that matter.
 *
 * AND DISCLOSURE IS A LINK, NEVER A BUTTON
 *
 * "Show 12 more facilities" is green text. A filled control there would
 * compete with the one that books the room, and this page has exactly one of
 * those.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Ion, type IonName } from "../ion";

import { Photo, PointsPill } from "./kit";
import { PhotoViewer } from "./PhotoViewer";
import { P, boardLabel, count, distance, money, nights as nightsWord, roomSize, shortDate } from "./look";
import type { GalleryImage, Rate, RoomInfo, StayDetail } from "@/lib/app/stays";

/* ── Shared shapes ────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-[22px] flex flex-col gap-2.5">
      <h2 className="text-[13.5px] font-extrabold tracking-[-0.1px]" style={{ color: P.text }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-3.5 rounded-[18px] border-[0.5px] border-white/10 bg-white/[0.04] p-[14px] ${className}`}>
      {children}
    </div>
  );
}

/** Every disclosure on this page. Green text on a hairline, never a button. */
function More({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-t-[0.5px] pt-2.5 text-left text-[12.5px] font-bold"
      style={{ borderColor: P.divider, color: P.greenText }}
    >
      {children}
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[999px] px-2.5 py-1.5 text-[11.5px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: P.textMuted }}>
      {children}
    </span>
  );
}

/* ── The photographs ──────────────────────────────────────────────── */

/**
 * The gallery: one big frame with a strip under it.
 *
 * The counter is bottom right and it counts what is REACHABLE, not what the
 * property owns — the server caps the gallery at 80 and reports the true total
 * separately, and a denominator you cannot page to is a broken promise.
 */
export function Gallery({ images, alt }: { images: GalleryImage[]; alt: string }) {
  const [at, setAt] = useState(0);
  /** null when closed; otherwise the photograph the viewer opens on. */
  const [viewing, setViewing] = useState<number | null>(null);
  if (images.length === 0) {
    return (
      <div className="flex h-[280px] w-full items-center justify-center rounded-[18px]" style={{ background: "rgba(255,255,255,0.03)", color: P.textFaint }}>
        <Ion name="bed-outline" size={28} />
      </div>
    );
  }
  const shown = images[Math.min(at, images.length - 1)];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-[240px] w-full overflow-hidden rounded-[18px] sm:h-[340px]" style={{ background: "rgba(255,255,255,0.03)" }}>
        {/* The frame is the way in. A photograph you cannot open is a
            thumbnail, and this one is 340px of a room somebody is deciding
            four hundred euros on. The arrows and the counter sit above it and
            stop the click, so paging is still paging. */}
        <button
          type="button"
          aria-label="Open photographs"
          onClick={() => setViewing(at)}
          className="absolute inset-0 block h-full w-full cursor-zoom-in p-0"
        >
          <Photo image={shown} alt={shown.caption ?? alt} iconSize={28} priority sizes="(min-width: 1024px) 900px, 100vw" />
        </button>
        {images.length > 1 ? (
          <>
            <Arrow side="left" onClick={() => setAt((i) => (i - 1 + images.length) % images.length)} />
            <Arrow side="right" onClick={() => setAt((i) => (i + 1) % images.length)} />
            <span
              className="absolute bottom-3.5 right-3.5 rounded-[999px] px-2.5 py-[5px] text-[11.5px] font-extrabold tabular-nums tracking-[-0.1px]"
              style={{ background: "rgba(7,12,18,0.66)", color: P.text }}
            >
              {`${at + 1} / ${images.length}`}
            </span>
          </>
        ) : null}
        {shown.caption ? (
          <span
            className="absolute bottom-3.5 left-3.5 max-w-[60%] truncate rounded-[999px] px-2.5 py-[5px] text-[11.5px] font-semibold"
            style={{ background: "rgba(7,12,18,0.66)", color: P.text }}
          >
            {shown.caption}
          </span>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.slice(0, 24).map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => setAt(i)}
              className="h-[54px] w-[80px] shrink-0 overflow-hidden rounded-[12px] transition-opacity"
              style={{ opacity: i === at ? 1 : 0.55, outline: i === at ? `1.5px solid ${P.select}` : "none" }}
            >
              <Photo image={img} alt="" iconSize={16} sizes="80px" />
            </button>
          ))}
        </div>
      ) : null}

      <PhotoViewer
        images={images}
        initialIndex={viewing ?? 0}
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={alt}
      />
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      onClick={onClick}
      className={`absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[18px] transition-opacity hover:opacity-100 ${
        side === "left" ? "left-3" : "right-3"
      }`}
      style={{ background: "rgba(7,12,18,0.6)", color: P.text, opacity: 0.8 }}
    >
      <Ion name={side === "left" ? "chevron-back" : "chevron-forward"} size={18} />
    </button>
  );
}

/* ── One bookable rate ────────────────────────────────────────────── */

/**
 * A rate, and the four facts that decide whether to take it.
 *
 * Their ORDER is the design: cancellation first, because it is the one that
 * cannot be undone; then what it costs to cancel late; then who it sleeps;
 * then "Pay today", which is always shown because a rate that is paid now and
 * one that is paid at the desk look identical until you say so.
 */
export function RateRow({
  rate,
  nights,
  compact = false,
  selected = false,
  onPick,
}: {
  rate: Rate;
  nights: number;
  /** Inside a room group, where the room name is already the heading. */
  compact?: boolean;
  selected?: boolean;
  onPick: () => void;
}) {
  const facts: { icon: IonName; text: string; tone?: string }[] = [];

  if (rate.refundable) {
    facts.push({
      icon: "shield-checkmark-outline",
      text: rate.freeCancellationUntil ? `Free cancellation until ${shortDate(rate.freeCancellationUntil.slice(0, 10))}` : "Free cancellation",
      tone: P.greenText,
    });
    if (rate.freeCancellationUntil && rate.cancellationFee !== null) {
      facts.push({ icon: "information-circle-outline", text: `${money(rate.cancellationFee, rate.currency)} if you cancel later` });
    }
  } else {
    facts.push({ icon: "information-circle-outline", text: "Non-refundable", tone: P.caution });
  }
  if (rate.maxOccupancy) {
    facts.push({ icon: "person-outline", text: `For ${rate.maxOccupancy} ${rate.maxOccupancy === 1 ? "guest" : "guests"}` });
  }
  facts.push({ icon: "card-outline", text: "Pay today" });

  const board = boardLabel(rate.boardName);

  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex w-full flex-col text-left transition-opacity active:opacity-90 ${
        compact ? "mb-2 gap-2 rounded-[18px] p-3" : "mb-3 gap-2.5 rounded-[18px] p-[14px]"
      }`}
      style={{
        background: selected ? P.selectSoft : P.card,
        border: `0.5px solid ${selected ? "rgba(255,255,255,0.46)" : P.cardBorder}`,
      }}
    >
      <span className="flex items-start gap-2.5">
        <span className="min-w-0 flex-1">
          <span
            className={`line-clamp-2 font-bold ${compact ? "text-[14px] leading-[18px] tracking-[-0.2px]" : "text-[15.5px] leading-5 tracking-[-0.3px]"}`}
            style={{ color: P.text }}
          >
            {compact ? (board ?? rate.roomName) : rate.roomName}
          </span>
          {!compact && board ? (
            <span className="mt-[3px] block text-[12.5px] font-medium" style={{ color: P.textDim }}>
              {board}
            </span>
          ) : null}
        </span>
        {selected ? (
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[11px]" style={{ background: P.select, color: P.selectText }} aria-hidden>
            <Ion name="checkmark" size={14} />
          </span>
        ) : null}
      </span>

      <span className="flex flex-col gap-[5px]">
        {facts.map((f) => (
          <span key={f.text} className="flex items-center gap-1.5">
            <span className="shrink-0" style={{ color: f.tone ?? P.textDim }} aria-hidden>
              <Ion name={f.icon} size={13} />
            </span>
            <span className="text-[12.5px] font-medium tracking-[-0.1px]" style={{ color: f.tone ?? P.textMuted }}>
              {f.text}
            </span>
          </span>
        ))}
      </span>

      <span className="flex items-end gap-2.5 border-t-[0.5px] pt-2.5" style={{ borderColor: P.divider }}>
        <span className="min-w-0 flex-1">
          <span className="block text-[19px] font-extrabold tabular-nums tracking-[-0.5px]" style={{ color: P.text }}>
            {money(rate.price, rate.currency)}
          </span>
          <span className="mt-px block text-[11.5px] font-medium" style={{ color: P.textDim }}>
            {`total for ${nightsWord(nights)}`}
          </span>
        </span>
        <PointsPill points={rate.pointsEarned} size="md" />
      </span>
    </button>
  );
}

/* ── A room, and every way to book it ─────────────────────────────── */

const AMENITY_HEADLINE = 4;

/**
 * A room with its photographs, facts and rates.
 *
 * The header is NOT a card: it sits on the ground with the rates as cards
 * under it, so the group reads as "this room, these prices" rather than as a
 * box containing boxes.
 */
/**
 * A room's photographs: a strip that opens a viewer.
 *
 * TWO THINGS WERE MISSING AND THEY WERE THE SAME THING
 *
 * The thumbnails were `<span>`s — a dead strip. And the scrollbar is hidden
 * (it is, everywhere in this file, because a grey bar under eight photographs
 * is the ugliest thing on the page), which on a trackpad is fine and with a
 * mouse leaves no way to move it at all. So the pictures open a viewer, and
 * the strip gets arrows of its own for the pointer that cannot swipe.
 *
 * THE "+3" WAS TRUE AND STILL MISLED
 *
 * It was painted OVER the eighth photograph, inside a strip that scrolls. It
 * counted correctly — three more photographs did exist — but it read as "keep
 * going right", and right was the end of the rail, because the strip lays out
 * eight tiles and the other three were never in it. A label that is accurate
 * about the number and wrong about the gesture is still a label that lies.
 *
 * So the count is its own tile, after the eight, reachable by the same scroll
 * that runs out just before it, and it opens the viewer ON the ninth
 * photograph — the first one the strip never showed. Every other tile is now
 * just the photograph it is.
 *
 * And the arrows go when there is nothing that way. An arrow that does
 * nothing teaches people that the arrows do nothing.
 */
function RoomStrip({ photos, name }: { photos: GalleryImage[]; name: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [ends, setEnds] = useState({ left: false, right: false });
  const shown = photos.slice(0, STRIP_TILES);
  const hidden = photos.length - shown.length;

  // Which way there is still rail to travel. Read after layout and on every
  // scroll; the 2px is the slack a fractional scroll width leaves behind, and
  // without it the right arrow never quite goes away at the end.
  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setEnds({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = rail.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, photos.length]);

  // By a tile and a half, so the photograph the eye stopped on stays in frame
  // and the move is clearly a move.
  const nudge = (dir: 1 | -1) => rail.current?.scrollBy({ left: dir * 160, behavior: "smooth" });

  return (
    <div className="group/strip relative">
      <div
        ref={rail}
        onScroll={measure}
        className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shown.map((p, i) => (
          <button
            key={`${p.url}-${i}`}
            type="button"
            aria-label={`${name} — photograph ${i + 1}`}
            onClick={() => setViewing(i)}
            className="h-[70px] w-[104px] shrink-0 cursor-zoom-in overflow-hidden rounded-[12px] p-0"
          >
            <Photo image={p} alt={name} iconSize={16} sizes="104px" />
          </button>
        ))}

        {hidden > 0 ? (
          <button
            type="button"
            aria-label={`See all ${photos.length} photographs of ${name}`}
            onClick={() => setViewing(STRIP_TILES)}
            className="relative h-[70px] w-[104px] shrink-0 cursor-zoom-in overflow-hidden rounded-[12px] p-0"
          >
            {/* The ninth photograph, behind its own count: the tile shows
                what it opens. */}
            <Photo image={photos[STRIP_TILES]} alt="" iconSize={16} sizes="104px" />
            <span
              className="absolute inset-0 flex flex-col items-center justify-center gap-px text-[13px] font-extrabold tabular-nums"
              style={{ background: "rgba(7,12,18,0.66)", color: P.text }}
            >
              {`+${hidden}`}
              <span className="text-[10px] font-semibold" style={{ color: P.textMuted }}>
                more
              </span>
            </span>
          </button>
        ) : null}
      </div>

      {/* Pointer only: a touch screen has the strip itself, and these would
          sit on top of the photographs it is already dragging. */}
      {ends.left ? <StripArrow side="left" onClick={() => nudge(-1)} /> : null}
      {ends.right ? <StripArrow side="right" onClick={() => nudge(1)} /> : null}

      <PhotoViewer
        images={photos}
        initialIndex={viewing ?? 0}
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={name}
      />
    </div>
  );
}

/** How many tiles the strip lays out before it starts counting the rest. */
const STRIP_TILES = 8;

function StripArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Scroll photographs left" : "Scroll photographs right"}
      onClick={onClick}
      className={`absolute top-[35px] hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[999px] opacity-0 transition-opacity group-hover/strip:opacity-100 sm:flex ${
        side === "left" ? "left-1" : "right-1"
      }`}
      style={{ background: "rgba(7,12,18,0.72)", color: P.text }}
    >
      <Ion name={side === "left" ? "chevron-back" : "chevron-forward"} size={16} />
    </button>
  );
}

export function RoomGroup({
  room,
  rates,
  nights,
  picked,
  onPick,
}: {
  room: RoomInfo | null;
  rates: Rate[];
  nights: number;
  picked: string | null;
  onPick: (rate: Rate) => void;
}) {
  const [allAmenities, setAllAmenities] = useState(false);
  const [wholeProse, setWholeProse] = useState(false);

  const name = room?.name ?? rates[0]?.roomName ?? "Room";
  const beds = (room?.beds ?? []).map((b) => (b.quantity > 1 ? `${b.quantity} × ${b.type}` : b.type)).join(" · ");
  const size = roomSize(room?.sizeSquare ?? null, room?.sizeUnit ?? null);
  const amenities = room?.amenities ?? [];
  const headline = amenities.slice(0, AMENITY_HEADLINE);
  const rest = amenities.slice(AMENITY_HEADLINE);

  return (
    <div className="mb-[18px] flex flex-col gap-2">
      <h3 className="line-clamp-2 text-[16px] font-extrabold leading-[21px] tracking-[-0.35px]" style={{ color: P.text }}>
        {name}
      </h3>

      {room && room.photos.length > 0 ? (
        <RoomStrip photos={room.photos} name={name} />
      ) : null}

      {size || beds || headline.length > 0 ? (
        <div className="mt-0.5 flex flex-col gap-[9px]">
          {beds ? (
            <span className="flex items-center gap-[7px]">
              <span className="shrink-0" style={{ color: P.textMuted }} aria-hidden>
                <Ion name="bed-outline" size={14} />
              </span>
              <span className="text-[12.5px] font-semibold tracking-[-0.1px]" style={{ color: P.text }}>
                {beds}
              </span>
            </span>
          ) : null}
          <div className="flex flex-wrap gap-y-[9px]">
            {size ? <Fact icon="resize-outline" text={size} strong /> : null}
            {room?.maxOccupancy ? <Fact icon="people-outline" text={`For ${room.maxOccupancy} ${room.maxOccupancy === 1 ? "guest" : "guests"}`} strong /> : null}
            {headline.map((a) => (
              <Fact key={a} icon="checkmark" text={a} green />
            ))}
          </div>
          {rest.length > 0 ? (
            allAmenities ? (
              <>
                <div className="flex flex-wrap gap-[7px]">
                  {rest.map((a) => (
                    <Chip key={a}>{a}</Chip>
                  ))}
                </div>
                <button type="button" onClick={() => setAllAmenities(false)} className="self-start text-[12.5px] font-bold" style={{ color: P.greenText }}>
                  Show less
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setAllAmenities(true)} className="self-start text-[12.5px] font-bold" style={{ color: P.greenText }}>
                {`Show ${rest.length} more ${rest.length === 1 ? "amenity" : "amenities"}`}
              </button>
            )
          ) : null}
        </div>
      ) : null}

      {room?.description ? (
        <div className="flex flex-col gap-1">
          <p className={`text-[12.5px] font-medium leading-[18px] ${wholeProse ? "" : "line-clamp-2"}`} style={{ color: P.textDim }}>
            {room.description}
          </p>
          <button type="button" onClick={() => setWholeProse((v) => !v)} className="self-start text-[12.5px] font-bold" style={{ color: P.greenText }}>
            {wholeProse ? "Show less" : "Read more"}
          </button>
        </div>
      ) : null}

      <div className="mt-1 flex flex-col">
        {rates.map((r) => (
          <RateRow key={r.offerId} rate={r} nights={nights} compact selected={picked === r.offerId} onPick={() => onPick(r)} />
        ))}
      </div>
    </div>
  );
}

function Fact({ icon, text, strong = false, green = false }: { icon: IonName; text: string; strong?: boolean; green?: boolean }) {
  return (
    <span className="flex w-1/2 min-w-0 items-center gap-[7px] pr-2">
      <span className="shrink-0" style={{ color: green ? P.greenText : P.textMuted }} aria-hidden>
        <Ion name={icon} size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold tracking-[-0.1px]" style={{ color: strong ? P.text : P.textMuted }}>
        {text}
      </span>
    </span>
  );
}

/* ── What guests say ──────────────────────────────────────────────── */

export function ReviewSummary({ stay }: { stay: StayDetail }) {
  const s = stay.reviewSummary;
  if (!s || (s.categories.length === 0 && s.pros.length === 0 && s.cons.length === 0)) return null;

  return (
    <Section title="What guests say">
      <InfoCard>
        {stay.guestRating !== null ? (
          <div className="flex items-center gap-2.5">
            <span className="text-[30px] font-extrabold tabular-nums leading-none tracking-[-0.8px]" style={{ color: P.text }}>
              {stay.guestRating.toFixed(1)}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12.5px] font-bold" style={{ color: P.textMuted }}>
                out of 10
              </span>
              {stay.reviewCount ? (
                <span className="text-[11.5px] font-semibold" style={{ color: P.textDim }}>
                  {`${count(stay.reviewCount)} ${stay.reviewCount === 1 ? "review" : "reviews"}`}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {s.categories.length > 0 ? (
          <div className="flex flex-col gap-[9px]">
            {s.categories.slice(0, 6).map((c) => (
              <div key={c.name} className="flex items-center gap-2.5">
                <span className="w-24 shrink-0 truncate text-[12.5px] font-semibold" style={{ color: P.textMuted }}>
                  {c.name}
                </span>
                <span className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-[999px]" style={{ background: "rgba(255,255,255,0.09)" }}>
                  <span className="block h-full rounded-[999px]" style={{ width: `${Math.max(4, Math.min(100, c.rating * 10))}%`, background: P.green }} />
                </span>
                <span className="w-7 shrink-0 text-right text-[12px] font-extrabold tabular-nums" style={{ color: P.text }}>
                  {c.rating.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {s.pros.length > 0 || s.cons.length > 0 ? (
          <div className="flex flex-wrap gap-[7px]">
            {s.pros.slice(0, 6).map((p) => (
              <span key={p} className="flex items-center gap-1 rounded-[999px] px-[9px] py-[5px]" style={{ background: P.greenSoft }}>
                <span style={{ color: P.greenText }} aria-hidden>
                  <Ion name="add" size={11} />
                </span>
                <span className="text-[11.5px] font-bold" style={{ color: P.greenText }}>
                  {p}
                </span>
              </span>
            ))}
            {s.cons.slice(0, 6).map((c) => (
              <span key={c} className="flex items-center gap-1 rounded-[999px] px-[9px] py-[5px]" style={{ background: "rgba(255,255,255,0.06)" }}>
                <span style={{ color: P.textDim }} aria-hidden>
                  <Ion name="remove" size={11} />
                </span>
                <span className="text-[11.5px] font-bold" style={{ color: P.textMuted }}>
                  {c}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        <p className="text-[10.5px] font-semibold" style={{ color: P.textFaint }}>
          A summary of guest reviews, not individual quotes.
        </p>
      </InfoCard>
    </Section>
  );
}

/* ── What's nearby ────────────────────────────────────────────────── */

const POI_ICON: Record<string, IonName> = {
  transport: "train-outline",
  landmark: "flag-outline",
  museum: "color-palette-outline",
  religious: "business-outline",
  district: "map-outline",
  shopping: "bag-handle-outline",
  park: "leaf-outline",
  beach: "sunny-outline",
  airport: "airplane-outline",
};

export function Nearby({ places }: { places: StayDetail["nearby"] }) {
  const [all, setAll] = useState(false);
  if (places.length === 0) return null;
  const shown = all ? places : places.slice(0, 4);

  return (
    <Section title="What's nearby">
      <InfoCard className="!gap-0">
        {shown.map((p, i) => (
          <div
            key={`${p.name}-${i}`}
            className="flex items-center gap-2.5 py-[9px]"
            style={i > 0 ? { borderTop: `0.5px solid ${P.divider}` } : undefined}
          >
            <span className="shrink-0" style={{ color: p.iconic ? P.greenText : P.textDim }} aria-hidden>
              <Ion name={(p.category && POI_ICON[p.category]) || "location-outline"} size={14} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" style={{ color: P.text }}>
              {p.name}
            </span>
            {p.distanceKm !== null ? (
              <span className="shrink-0 text-[12px] font-bold tabular-nums" style={{ color: P.textDim }}>
                {distance(p.distanceKm)}
              </span>
            ) : null}
          </div>
        ))}
        {places.length > 4 ? (
          <More onClick={() => setAll((v) => !v)}>{all ? "Show less" : `Show all ${places.length}`}</More>
        ) : null}
      </InfoCard>
    </Section>
  );
}

/* ── Facilities ───────────────────────────────────────────────────── */

/**
 * The headline set, in a fixed order.
 *
 * A property lists up to about 120 facilities and no one reads 120 chips. The
 * first match of each pattern below gets an icon and a line; everything else
 * goes behind one disclosure. The ORDER is what somebody actually checks
 * before booking, which is why wifi is first and the laundry is near the end.
 */
const FACILITY_PRIORITY: { re: RegExp; icon: IonName }[] = [
  { re: /wifi/i, icon: "wifi-outline" },
  { re: /air.?condition/i, icon: "snow-outline" },
  { re: /breakfast/i, icon: "cafe-outline" },
  { re: /pool/i, icon: "water-outline" },
  { re: /parking/i, icon: "car-outline" },
  { re: /fitness|gym/i, icon: "barbell-outline" },
  { re: /spa|sauna/i, icon: "flower-outline" },
  { re: /restaurant/i, icon: "restaurant-outline" },
  { re: /bar|lounge/i, icon: "wine-outline" },
  { re: /shuttle/i, icon: "bus-outline" },
  { re: /front desk/i, icon: "time-outline" },
  { re: /elevator|lift/i, icon: "swap-vertical-outline" },
  { re: /laundry/i, icon: "shirt-outline" },
  { re: /pet/i, icon: "paw-outline" },
  { re: /family|kids|child/i, icon: "people-outline" },
];

export function Facilities({ facilities }: { facilities: string[] }) {
  const [all, setAll] = useState(false);
  if (facilities.length === 0) return null;

  const headline: { name: string; icon: IonName }[] = [];
  const taken = new Set<string>();
  for (const { re, icon } of FACILITY_PRIORITY) {
    const hit = facilities.find((f) => re.test(f) && !taken.has(f));
    if (hit) {
      taken.add(hit);
      headline.push({ name: hit, icon });
    }
  }
  const rest = facilities.filter((f) => !taken.has(f));

  return (
    <Section title="Facilities">
      <InfoCard>
        <div className="flex flex-wrap gap-y-2.5">
          {headline.map((f) => (
            <Fact key={f.name} icon={f.icon} text={f.name} green />
          ))}
        </div>
        {rest.length > 0 ? (
          all ? (
            <>
              <div className="flex flex-wrap gap-[7px]">
                {rest.map((f) => (
                  <Chip key={f}>{f}</Chip>
                ))}
              </div>
              <More onClick={() => setAll(false)}>Show less</More>
            </>
          ) : (
            <More onClick={() => setAll(true)}>{`${rest.length} more ${rest.length === 1 ? "facility" : "facilities"}`}</More>
          )
        ) : null}
      </InfoCard>
    </Section>
  );
}

/* ── About, and good to know ──────────────────────────────────────── */

export function About({ text }: { text: string | null }) {
  const [whole, setWhole] = useState(false);
  if (!text?.trim()) return null;
  return (
    <Section title="About this property">
      <InfoCard>
        <p className={`text-[12.5px] font-medium leading-[19px] ${whole ? "" : "line-clamp-4"}`} style={{ color: P.textMuted }}>
          {text}
        </p>
        <More onClick={() => setWhole((v) => !v)}>{whole ? "Show less" : "Read more"}</More>
      </InfoCard>
    </Section>
  );
}

export function GoodToKnow({ stay }: { stay: StayDetail }) {
  const [whole, setWhole] = useState(false);
  const flags: string[] = [];
  if (stay.childAllowed) flags.push("Children welcome");
  if (stay.petsAllowed === true) flags.push("Pets allowed");
  if (stay.petsAllowed === false) flags.push("No pets");
  const text = stay.importantInfo?.trim();
  if (!text && flags.length === 0) return null;

  return (
    <Section title="Good to know">
      <InfoCard>
        {flags.length > 0 ? (
          <div className="flex flex-wrap gap-[7px]">
            {flags.map((f) => (
              <Chip key={f}>{f}</Chip>
            ))}
          </div>
        ) : null}
        {text ? (
          <>
            <p className={`whitespace-pre-line text-[12.5px] font-medium leading-[19px] ${whole ? "" : "line-clamp-4"}`} style={{ color: P.textMuted }}>
              {text}
            </p>
            <More onClick={() => setWhole((v) => !v)}>{whole ? "Show less" : "Read more"}</More>
          </>
        ) : null}
      </InfoCard>
    </Section>
  );
}

/* ── When you can arrive ──────────────────────────────────────────── */

export function CheckinTimes({ stay }: { stay: StayDetail }) {
  if (!stay.checkinTime && !stay.checkoutTime) return null;
  return (
    <Section title="Arriving and leaving">
      <InfoCard className="!gap-0">
        {stay.checkinTime ? (
          <Row label="Check in" value={[stay.checkinTime && `from ${stay.checkinTime}`, stay.checkinUntil && `until ${stay.checkinUntil}`].filter(Boolean).join(" · ")} />
        ) : null}
        {stay.checkoutTime ? <Row label="Check out" value={`by ${stay.checkoutTime}`} divided /> : null}
      </InfoCard>
    </Section>
  );
}

function Row({ label, value, divided = false }: { label: string; value: string; divided?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5" style={divided ? { borderTop: `0.5px solid ${P.divider}` } : undefined}>
      <span className="text-[13px] font-medium tracking-[-0.1px]" style={{ color: P.textMuted }}>
        {label}
      </span>
      <span className="text-right text-[13.5px] font-bold tracking-[-0.2px]" style={{ color: P.text }}>
        {value}
      </span>
    </div>
  );
}
