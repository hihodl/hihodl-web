import {
  DELIVERABLE_STATE_LABEL,
  calendarDate,
  compactNumber,
  deliverableNote,
  deliverableText,
  eventDates,
  isProductionSpace,
  isSessionSpace,
  isTieredSpace,
  serviceName,
  usageText,
} from "@/lib/ad-space/format";
import type { ContentKind, DeliverableState, Space } from "@/lib/ad-space/types";
import { t } from "@/lib/app/i18n";

import { card, pill } from "./ui";

/**
 * "What you get": the whole bundle as a checklist, from the brand's side. The
 * spot itself first, then everything the creator adds to every sale, each with
 * the date it is due and, once it is, a link to it. This is the only place the
 * deliverables are listed, so their state (delivered, overdue) lives here too.
 *
 * On a ladder each rung says what it is, so the list is what EVERY rung also
 * includes. On a session it is the session: time in person has no logo.
 *
 * What creators learned selling at TOKEN2049: the product is the hook, the
 * reason people look, and what a brand really buys is the creator's reach and
 * the content they make. So a spot's list opens with the reach, then the spot
 * as the thing that gets it seen, then the content. A production is made for
 * the brand's own channels and a session is time in person: neither leads
 * with the creator's audience.
 */

const ORDER: ContentKind[] = ["logo", "qr", "text", "photo"];
/** The content kinds as a word inside a sentence ("Your logo or text on…"). */
function word(k: ContentKind): string {
  switch (k) {
    case "logo":
      return t("board.gets.word.logo");
    case "qr":
      return t("board.gets.word.qr");
    case "text":
      return t("board.gets.word.text");
    case "photo":
      return t("board.gets.word.photo");
  }
}

const STATE_PILL: Partial<Record<DeliverableState, string>> = {
  overdue: pill.attention,
  missed: pill.attention,
  delivered: pill.done,
};

function orWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return t("board.list.or", { first: items.slice(0, -1).join(", "), last: items[items.length - 1] });
}

/** "Your logo, QR code or text on the suitcase: it's what makes people look", from what the spots take. */
function spotLine(space: Space): string {
  if (space.kind === "service") return t("board.gets.oneSlot", { name: serviceName(space) });
  const taken = new Set(space.positions.flatMap((p) => p.accepts));
  const kinds = ORDER.filter((k) => taken.has(k)).map(word);
  const product = serviceName(space).toLowerCase();
  return kinds.length
    ? t("board.gets.spotKinds", { kinds: orWords(kinds), product })
    : t("board.gets.spotBrand", { product });
}

/** "@demo_creator's reach: 12.4K followers on X", or null with no count to name. */
export function reachLine(space: Space): string | null {
  const c = space.creator;
  if (!c?.xHandle || !(c.xFollowers > 0)) return null;
  const vars = {
    handle: c.xHandle,
    followers: compactNumber(c.xFollowers),
    at: space.event ? "event" : "none",
    event: space.event?.name ?? "",
  };
  return space.kind === "service" ? t("board.gets.reachService", vars) : t("board.gets.reachSpot", vars);
}

export function WhatTheBrandGets({ space }: { space: Space }) {
  const items = space.deliverables;
  const tiered = isTieredSpace(space);

  // Content production: the package itself, line by line, is what sells it.
  if (isProductionSpace(space) && space.production) {
    const pkg = space.production;
    const at = space.event
      ? t("board.gets.eventAndDates", { event: space.event.name, dates: eventDates(space.event.startsOn, space.event.endsOn) })
      : space.eventName;
    return (
      <div className={`${card} p-5 md:p-6`}>
        <ul className="flex flex-col gap-4">
          {pkg.lines.map((l) => (
            <Item key={l.key} text={t("board.gets.production.line", { count: l.count, label: l.label })} strong />
          ))}
          {at ? <Item text={t("board.gets.production.filmedAt", { at })} /> : null}
          <Item text={t("board.gets.production.turnaround", { hours: pkg.turnaroundHours })} />
          <Item text={usageText(pkg)} />
          <Item text={t("board.gets.production.brief")} />
        </ul>
      </div>
    );
  }

  if (isSessionSpace(space)) {
    const where = space.event
      ? t("board.gets.session.inPersonAt", {
          at: t("board.gets.eventAndDates", {
            event: space.event.name,
            dates: eventDates(space.event.startsOn, space.event.endsOn),
          }),
        })
      : space.eventName
        ? t("board.gets.session.inPersonAt", { at: space.eventName })
        : t("board.gets.session.inPersonAnywhere");
    return (
      <div className={`${card} p-5 md:p-6`}>
        <ul className="flex flex-col gap-4">
          <Item text={t("board.gets.session.one", { name: serviceName(space) })} strong />
          <Item text={where} />
          <Item text={t("board.gets.session.timeAndPlace")} />
        </ul>
      </div>
    );
  }

  // The creator's lines in their order; untouched, our two suggestions. A
  // ladder's rungs each say what they are, so a ladder never shows "the spot".
  const lines = (space.brandGets ?? [{ kind: "reach" }, { kind: "spot" }]).filter((l) => !(tiered && l.kind === "spot"));
  const shown = lines.flatMap((l, i) => {
    const text = l.kind === "text" ? l.text : l.kind === "reach" ? reachLine(space) : spotLine(space);
    return text ? [<Item key={`${l.kind}-${i}`} text={text} strong />] : [];
  });
  return (
    <div className={`${card} p-5 md:p-6`}>
      <ul className="flex flex-col gap-4">
        {shown}
        {tiered ? (
          <li className="text-small text-sp-ink/85">
            {items.length ? t("board.gets.everyPackage") : t("board.gets.eachPackage")}
          </li>
        ) : null}
        {items.map((d) => {
          const note = deliverableNote(d);
          const statePill = STATE_PILL[d.state];
          return (
            <li key={d.id} className="flex items-start gap-3">
              <Check />
              <div className="min-w-0 flex-1">
                <p className="break-words text-body text-sp-ink [overflow-wrap:anywhere]">{deliverableText(d)}</p>
                {note && (
                  <p className="mt-0.5 break-words text-small text-sp-ink/85 [overflow-wrap:anywhere]">{note}</p>
                )}
                <p className="mt-0.5 text-tiny text-sp-ink/80">
                  {d.state === "delivered" && d.deliveredUrl ? (
                    <a href={d.deliveredUrl} target="_blank" rel="noopener noreferrer" className="text-sp-ok hover:underline">
                      {t("board.gets.seeIt")}
                    </a>
                  ) : (
                    t("board.gets.dueBy", { date: calendarDate(d.dueDate) })
                  )}
                </p>
              </div>
              {statePill && <span className={statePill}>{DELIVERABLE_STATE_LABEL[d.state]}</span>}
            </li>
          );
        })}
        {shown.length === 0 && items.length === 0 && !tiered ? (
          <Item text={spotLine(space)} strong />
        ) : null}
      </ul>
    </div>
  );
}

function Item({ text, strong = false }: { text: string; strong?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <Check />
      <span className={`min-w-0 break-words [overflow-wrap:anywhere] ${strong ? "text-body text-sp-ink" : "text-body text-sp-ink/85"}`}>
        {text}
      </span>
    </li>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-[5px] shrink-0 text-sp-cool">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
