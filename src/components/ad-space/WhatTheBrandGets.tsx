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
const WORD: Record<ContentKind, string> = { logo: "logo", qr: "QR code", text: "text", photo: "photo" };

const STATE_PILL: Partial<Record<DeliverableState, string>> = {
  overdue: pill.attention,
  missed: pill.attention,
  delivered: pill.done,
};

function orWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

/** "Your logo, QR code or text on the suitcase: it's what makes people look", from what the spots take. */
function spotLine(space: Space): string {
  if (space.kind === "service") return `One slot: ${serviceName(space)}`;
  const taken = new Set(space.positions.flatMap((p) => p.accepts));
  const kinds = ORDER.filter((k) => taken.has(k)).map((k) => WORD[k]);
  const on = `the ${serviceName(space).toLowerCase()}`;
  return kinds.length
    ? `Your ${orWords(kinds)} on ${on}, on the spot you pick. It's what makes people look`
    : `Your brand on ${on}. It's what makes people look`;
}

/** "@demo_creator's reach: 12.4K followers on X", or null with no count to name. */
export function reachLine(space: Space): string | null {
  const c = space.creator;
  if (!c?.xHandle || !(c.xFollowers > 0)) return null;
  const where = space.event ? ` from ${space.event.name}` : "";
  return space.kind === "service"
    ? `@${c.xHandle}'s reach: ${compactNumber(c.xFollowers)} followers on X see what they post${where}`
    : `@${c.xHandle}'s reach: ${compactNumber(c.xFollowers)} followers on X see it in every post${where}`;
}

export function WhatTheBrandGets({ space }: { space: Space }) {
  const items = space.deliverables;
  const tiered = isTieredSpace(space);

  // Content production: the package itself, line by line, is what sells it.
  if (isProductionSpace(space) && space.production) {
    const pkg = space.production;
    const at = space.event ? `${space.event.name}, ${eventDates(space.event.startsOn, space.event.endsOn)}` : space.eventName;
    return (
      <div className={`${card} p-5 md:p-6`}>
        <ul className="flex flex-col gap-4">
          {pkg.lines.map((l) => (
            <Item key={l.key} text={`${l.count} × ${l.label}`} strong />
          ))}
          {at ? <Item text={`Filmed at ${at}`} /> : null}
          <Item text={`Delivered to you within ${pkg.turnaroundHours} hours of the shoot day, with one round of changes`} />
          <Item text={usageText(pkg)} />
          <Item text="You bring the brief before you pay: goal, key messages, who to interview" />
        </ul>
      </div>
    );
  }

  if (isSessionSpace(space)) {
    const where = space.event
      ? `In person at ${space.event.name}, ${eventDates(space.event.startsOn, space.event.endsOn)}`
      : space.eventName
        ? `In person at ${space.eventName}`
        : "In person, at the venue or in a public place";
    return (
      <div className={`${card} p-5 md:p-6`}>
        <ul className="flex flex-col gap-4">
          <Item text={`One session: ${serviceName(space)}`} strong />
          <Item text={where} />
          <Item text="Time and place set with you after you book" />
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
            {items.length ? "Every package also includes:" : "Each package lists what it includes."}
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
                      See it
                    </a>
                  ) : (
                    `By ${calendarDate(d.dueDate)}`
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
