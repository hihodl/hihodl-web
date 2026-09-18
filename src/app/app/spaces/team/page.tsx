/**
 * Spaces › Team — the people who work a creator's listings with them, and the
 * teams this person is on.
 *
 * WHERE `?seat=` COMES FROM
 *
 * A creator's invitation is their own HOLD invite link, `/invite/<code>`, with
 * `?seat=<seat code>` on the end. `/invite/<code>` sends a link carrying a
 * seat here (app.hihodl.xyz/spaces/team?seat=…), because this is the only
 * place a seat can be taken today: the app's deep link carries the invite code
 * and drops everything after it. With a seat, the page renders on its own,
 * outside the shell (see components/app/Shell), with sign-in beside it.
 *
 * It is read here rather than with `useSearchParams`, the same way /x
 * reads its return: the value arrives with the first render, so the page never
 * paints a spinner it does not need and hands it down as a prop.
 *
 * WHO INVITED YOU, FROM THE SEAT
 *
 * `GET /ad-space/public/team/invite/:code` answers who made the seat, as what,
 * and until when, with no session — the person reading may not have an
 * account yet, and the code is the credential. The name is read from the SEAT
 * and never from the invite code in the rest of the link: that part is
 * anybody's to edit, and reading a name from it would let a stranger's
 * invitation arrive wearing a famous creator's name.
 *
 * Asked from this server so the first paint already says who it is. The call
 * goes out with the visitor's address (`upstreamHeaders`), uncached, so the
 * public limiter counts the person rather than our servers.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";

import { TeamScreen } from "@/components/app/spaces/TeamScreen";
import { SeatInvitation } from "@/components/creator/Team";
import { AD_SPACE_API } from "@/lib/ad-space/config";
import { upstreamHeaders } from "@/lib/ad-space/server";
import { isSeatCode, type InvitePreview, type SeatLookup } from "@/lib/creator/team";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team" };

async function preview(code: string): Promise<SeatLookup> {
  try {
    const res = await fetch(`${AD_SPACE_API}/public/team/invite/${encodeURIComponent(code)}`, {
      headers: upstreamHeaders(headers()),
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    const body = (await res.json().catch(() => null)) as
      | { data?: { invite?: InvitePreview }; error?: { code?: string } }
      | null;
    if (res.ok && body?.data?.invite) return { kind: "found", invite: body.data.invite };
    if (body?.error?.code === "invite_not_found" || body?.error?.code === "invite_expired") {
      return { kind: "refused", code: body.error.code };
    }
    return { kind: "unreachable" };
  } catch {
    // A slow answer costs the invitee the name on the first paint, never the
    // seat: accepting is still offered, and the server decides.
    return { kind: "unreachable" };
  }
}

export default async function TeamPage({ searchParams }: { searchParams: { seat?: string; tab?: string } }) {
  const seat = isSeatCode(searchParams.seat) ? searchParams.seat : null;
  if (!seat) return <TeamScreen tab={searchParams.tab ?? null} />;
  const lookup = await preview(seat);
  return <SeatInvitation seat={seat} lookup={lookup} />;
}
