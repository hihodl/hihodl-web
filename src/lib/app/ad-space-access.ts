/**
 * Whether this person may open a space, list an event or claim one as host.
 *
 * Ad Space comes with HOLD Partners (backend, 14-oct-2026): those three
 * creates answer 403 `partners_only` unless the person is on an active
 * Partners team or already uses Ad Space (owns a space, lists or hosts an
 * event, holds a team seat). `GET /ad-space/access` says which, before a
 * screen offers a door the server would close.
 *
 * FAILS OPEN. A failed read, a 404 (a server from before the gate) or no
 * answer yet all read as allowed: the gate lives on the server, and the web
 * hiding Spaces from everybody because one read blinked would be worse than
 * showing a door the server then refuses. A 403 `partners_only` from any
 * create call flips this to "not allowed" on the spot (notePartnersOnly).
 *
 * Buying a spot (the board, what you bought) is never gated here: it asks
 * nothing of a brand but an account.
 */

"use client";

import useSWR from "swr";

import { useCreatorSession } from "@/lib/creator/session";

import { ACCESS_KEY, type AdSpaceAccess } from "./ad-space-gate";
import { read } from "./hold-api";

export type { AdSpaceAccess } from "./ad-space-gate";
export { notePartnersOnly, PARTNERS_ONLY } from "./ad-space-gate";

export function useAdSpaceAccess(): { allowed: boolean; settled: boolean } {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  const q = useSWR<AdSpaceAccess>(uid ? [ACCESS_KEY, uid] : null, () => read<AdSpaceAccess>("ad-space/access"), {
    revalidateOnFocus: false,
    errorRetryCount: 1,
  });
  // Only an explicit "no" closes the door; anything else (loading, error, a body without the field) leaves it open.
  const allowed = q.data?.allowed !== false;
  return { allowed, settled: q.data !== undefined || q.error !== undefined };
}
