import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { PayPage, type PayPageState } from "@/components/pay-links/PayPage";
import { payPageMetadata } from "@/lib/pay-links/metadata";
import { getPayLink, getPersonalPayLink } from "@/lib/pay-links/server";
import type { PayLinkPublic, ShownPayLink } from "@/lib/pay-links/types";

/**
 * /pay/<code> — somebody asks to be paid, and the payer has no HOLD account
 * (pay-links-v0.md).
 *
 * `/pay/@handle` is the same page for a person's personal link (the QR in
 * their app): anyone pays them any amount, whether or not they have HOLD.
 *
 * The page itself (components/pay-links/PayPage) is the app's Quick Send, as
 * revolut.me does it: who you pay, how much, a note, and how to pay (HOLD,
 * card, Apple Pay or Google Pay, stablecoins).
 *
 * Not a marketplace page: not in the sitemap, `noindex`, and read on every
 * request (`no-store`) so a single-use link that has just been paid never
 * shows a pay button.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = payPageMetadata("Pay link");

export default async function PayLinkPage({ params }: { params: { code: string } }) {
  // `/pay/@dana` arrives as `%40dana`.
  const raw = decodeURIComponent(params.code);
  const found = raw.startsWith("@") ? await getPersonalPayLink(raw.slice(1), headers()) : await getPayLink(raw, headers());
  if (found.kind === "missing") notFound();

  const state: PayPageState =
    found.kind === "unreachable"
      ? { kind: "unreachable" }
      : isShown(found.value)
        ? { kind: "shown", link: found.value }
        : // Nothing the owner wrote is shown on a link we took down.
          { kind: "disabled" };

  return <PayPage state={state} />;
}

/** A disabled link, or one that comes back without its title or amount, shows nothing the owner wrote. */
function isShown(link: PayLinkPublic): link is ShownPayLink {
  return link.status !== "disabled" && link.title !== null && link.amount !== null;
}
