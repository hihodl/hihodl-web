"use client";

/**
 * "Claim it" on the sponsor page's "Is this your event?" (round 2 item 6 of
 * organiser-sells-its-event-contract.md): the host goes straight to the
 * business console's Events tab with this Luma page pre-filled, and gets the
 * code there.
 *
 * Signed in on this site: the button. Signed out (and sessions are per origin,
 * so on hihodl.xyz that is most people): a quieter link to the same place,
 * which signs them in first and brings them back. Get HOLD stays beside it for
 * the host who has no account at all.
 */

import { useT } from "@/lib/app/i18n/react";
import { lumaUrlOf } from "@/lib/app/organiser-rules";
import { productUrl } from "@/lib/app/paths";
import { useCreatorSession } from "@/lib/creator/session";

import { btnPrimary, btnSecondary } from "./ui";

export function claimHref(lumaKey: string): string {
  const q = new URLSearchParams({ tab: "events", claim: lumaUrlOf(lumaKey) });
  return productUrl(`/spaces/business?${q}`);
}

export function ClaimIt({ lumaKey }: { lumaKey: string }) {
  const t = useT();
  const { session } = useCreatorSession();
  // Until the session is read, nothing: the page never flickers a button it then takes away.
  if (session === undefined) return null;
  return (
    <a href={claimHref(lumaKey)} className={session ? btnPrimary : btnSecondary}>
      {session ? t("publicPages.sponsor.notOnHold.claimIt") : t("publicPages.sponsor.notOnHold.claimItSignIn")}
    </a>
  );
}
