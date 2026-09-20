/**
 * Rates under the room they belong to.
 *
 * A property answers with twenty rates that are four rooms sold five ways.
 * Flat, that reads as twenty decisions; grouped, it reads as four.
 *
 * THE JOIN IS THE SUPPLIER'S ID, NEVER THE NAME
 *
 * Two rooms called "Double Room" at one property is normal, not a data error,
 * and matching on the name puts a sea-view rate under a room with no window
 * and its photographs. The app makes the same rule in `BookingDetailsSheet`
 * ("Never name-matched") and for the same reason.
 *
 * A rate the supplier could not place — `roomId` null — becomes a group of its
 * own keyed on its own name. That is the honest answer: we do not know which
 * room it is, so we do not claim it is one of the ones with photographs.
 *
 * Cheapest group first, and cheapest rate within each, because the results
 * list is cheapest-first too and a page that sorts its rooms one way and its
 * prices another cannot be read.
 */

import type { Rate, RoomInfo } from "@/lib/app/stays";

export interface RoomGrouping {
  key: string;
  room: RoomInfo | null;
  rates: Rate[];
}

export function groupByRoom(rates: readonly Rate[], rooms: readonly RoomInfo[]): RoomGrouping[] {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const out = new Map<string, RoomGrouping>();

  for (const rate of rates) {
    const room = rate.roomId ? (byId.get(rate.roomId) ?? null) : null;
    // The two key spaces are kept apart on purpose: a room whose id happens to
    // be another room's NAME must not collide with it.
    const key = room ? `id:${room.id}` : `name:${rate.roomName}`;
    const held = out.get(key);
    if (held) held.rates.push(rate);
    else out.set(key, { key, room, rates: [rate] });
  }

  return [...out.values()]
    .map((g) => ({ ...g, rates: [...g.rates].sort((a, b) => a.price - b.price) }))
    .sort((a, b) => a.rates[0].price - b.rates[0].price);
}
