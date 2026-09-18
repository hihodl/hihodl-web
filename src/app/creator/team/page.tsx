/**
 * /creator/team — the people who work a creator's listings with them.
 *
 * WHERE `?seat=` COMES FROM
 *
 * A creator's invitation is their own HOLD invite link, `/invite/<code>`, with
 * `?seat=<seat code>` on the end. `/invite/<code>` sends a link carrying a
 * seat here, as `?seat=<seat code>&from=<invite code>`, because this is the
 * only place a seat can be taken today: the app's deep link carries the invite
 * code and drops everything after it.
 *
 * Both are read here rather than with `useSearchParams`, the same way
 * /creator/x reads its return: the values arrive with the first render, so the
 * page never paints a spinner it does not need and hands them down as props.
 *
 * WHO INVITED YOU
 *
 * The invite code names a HOLD account, and `/referrals/resolve` says whose —
 * a public call with no token, made from this server because that router sends
 * no CORS for a browser. The name is what the LINK says, not what the seat
 * says: the seat's owner is only known to the server once it is accepted, and
 * the page says so beside the name rather than promising more than it knows.
 */

import { Team } from "@/components/creator/Team";
import { API_BASE } from "@/lib/ad-space/config";
import { isReferralCode, isSeatCode } from "@/lib/creator/team";

export const dynamic = "force-dynamic";

/** The backend's stand-in when an account has no name at all; saying it would be worse than saying nothing. */
const NO_NAME = "A HiHODL user";

async function inviterName(code: string | undefined): Promise<string | null> {
  if (!isReferralCode(code)) return null;
  try {
    const res = await fetch(`${API_BASE}/referrals/resolve`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { referrerName?: unknown } };
    const name = body.data?.referrerName;
    return typeof name === "string" && name.trim() && name !== NO_NAME ? name.trim().slice(0, 80) : null;
  } catch {
    // A slow or missing answer costs the invitee a name, never the seat.
    return null;
  }
}

export default async function CreatorTeamPage({
  searchParams,
}: {
  searchParams: { seat?: string; from?: string };
}) {
  const seat = isSeatCode(searchParams.seat) ? searchParams.seat : null;
  const from = seat && isReferralCode(searchParams.from) ? searchParams.from : null;
  const inviter = from ? await inviterName(from) : null;
  return <Team seat={seat} from={from} inviter={inviter} />;
}
