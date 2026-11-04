/**
 * The Ad Space gate's shared pieces, kept apart from the hook so both API
 * clients (lib/app/hold-api, lib/creator/api) can report a 403
 * `partners_only` without importing the module that imports them.
 */

import { mutate } from "swr";

export interface AdSpaceAccess {
  allowed: boolean;
  reason: "open" | "partner" | "existing" | null;
}

/** The SWR key's first element: `[ACCESS_KEY, uid]`. */
export const ACCESS_KEY = "ad-space-access";

/** The 403 the three creates answer with. */
export const PARTNERS_ONLY = "partners_only";

/**
 * A create call came back 403 `partners_only`: every screen reading
 * useAdSpaceAccess now draws the Partners panel instead of the form.
 */
export function notePartnersOnly(code: string | null | undefined, status: number): void {
  if (status !== 403 || code !== PARTNERS_ONLY) return;
  void mutate((key) => Array.isArray(key) && key[0] === ACCESS_KEY, { allowed: false, reason: null } satisfies AdSpaceAccess, { revalidate: false });
}
