/**
 * The words a creator's hub uses, and only those.
 *
 * These belong next to the rest of the display helpers in `./format`, and
 * should move there once nobody else is writing to that file. They are kept
 * apart for now rather than edited into it from two places at once.
 */

/**
 * What a creator has on sale, in one line under their name: "9 spaces · 34
 * spots open · 3 events". Events are left out when everything they sell is tied
 * to none, rather than printed as a zero a sponsor has to interpret.
 */
export function creatorTotalsText(totals: { spaces: number; openSpots: number; events: number }): string {
  const parts = [
    `${totals.spaces} ${totals.spaces === 1 ? "space" : "spaces"}`,
    `${totals.openSpots} ${totals.openSpots === 1 ? "spot" : "spots"} open`,
  ];
  if (totals.events > 0) parts.push(`${totals.events} ${totals.events === 1 ? "event" : "events"}`);
  return parts.join(" · ");
}

/**
 * The way out of a creator's hub and into the event's own page, which is how a
 * brand this creator did not win still finds one that fits — and how the event
 * page finds its next reader.
 *
 * With nobody else listed there it names no number. "0 other creators are
 * going" is both true and useless, and a link that invents a crowd is worse
 * than one that simply opens the event.
 */
export function otherCreatorsLine(othersAtEvent: number, eventName: string): string {
  if (othersAtEvent <= 0) return `See everything on sale at ${eventName}`;
  if (othersAtEvent === 1) return `1 more creator is going to ${eventName}`;
  return `${othersAtEvent} more creators are going to ${eventName}`;
}
