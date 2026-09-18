import {
  calendarDate,
  deliverableNote,
  deliverableText,
  isSessionSpace,
  isTieredSpace,
  serviceName,
} from "@/lib/ad-space/format";
import type { ContentKind, Space } from "@/lib/ad-space/types";

import { card, eyebrow } from "./ui";

/**
 * The bundle a brand buys, in one place, before it picks a spot: the spot
 * itself, and a checklist of everything the creator adds to every sale, each
 * with its count and the date it is due.
 *
 * The deliverables are the space's, so every spot comes with all of them. The
 * list under "What the creator promises" further down tracks each one's state;
 * this one only says what is included.
 *
 * Nothing on a session space: time in person has no logo and no posts.
 */

const ORDER: ContentKind[] = ["logo", "qr", "text", "photo"];
const WORD: Record<ContentKind, string> = { logo: "logo", qr: "QR code", text: "text", photo: "photo" };

function orWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

/** "Your logo, QR code or text on the spot you pick", from what the spots take. */
function spotLine(space: Space): string {
  if (space.kind === "service") return `One slot: ${serviceName(space)}`;
  const taken = new Set(space.positions.flatMap((p) => p.accepts));
  const kinds = ORDER.filter((k) => taken.has(k)).map((k) => WORD[k]);
  return kinds.length ? `Your ${orWords(kinds)} on the spot you pick` : "Your brand on the spot you pick";
}

export function WhatTheBrandGets({ space }: { space: Space }) {
  const items = space.deliverables;
  if (items.length === 0 || isSessionSpace(space)) return null;
  const unit = space.kind === "service" ? "slot" : "spot";
  /* On a ladder each rung already says what it is, and they are not the same
     thing at three prices — so "One slot: Event coverage" would be the one
     sentence on the page that flattens the ladder back into N of one thing.
     What stays true is everything below: the creator adds these to every sale,
     whichever rung the brand buys. */
  const tiered = isTieredSpace(space);

  return (
    <section className={`${card} p-5 md:p-6`} aria-labelledby="what-the-brand-gets">
      <h2 id="what-the-brand-gets" className={`${eyebrow} text-moonlight`}>
        {tiered ? `Every ${unit}, whichever you pick, also includes` : `Every ${unit} includes`}
      </h2>
      <div
        className={`mt-5 grid grid-cols-1 gap-6 md:gap-10 ${
          tiered ? "" : "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        }`}
      >
        {!tiered && (
          <div>
            <p className="flex items-start gap-3 text-body text-text">
              <Check />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{spotLine(space)}</span>
            </p>
          </div>
        )}
        <div>
          <h3 className={`${eyebrow} text-text-faint`}>
            Also included <span className="font-mono">· {items.length}</span>
          </h3>
          <ul className="mt-3 flex flex-col gap-3">
            {items.map((d) => {
              const note = deliverableNote(d);
              return (
                <li key={d.id} className="flex items-start gap-3">
                  <Check />
                  <div className="min-w-0">
                    <p className="break-words text-small text-text [overflow-wrap:anywhere]">{deliverableText(d)}</p>
                    {note && (
                      <p className="mt-0.5 break-words text-tiny text-text-muted [overflow-wrap:anywhere]">{note}</p>
                    )}
                    <p className="mt-0.5 text-tiny text-text-faint">
                      {d.state === "delivered" ? "Already delivered" : `By ${calendarDate(d.dueDate)}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-[3px] shrink-0 text-moonlight">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
