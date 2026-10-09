import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PayPage, type PayPageState } from "@/components/pay-links/PayPage";
import { payPageMetadata } from "@/lib/pay-links/metadata";
import { payPreview } from "@/lib/pay-links/og-copy";
import { ogCopyFor } from "@/lib/pay-links/og-locale";
import { fallbackHref } from "@/lib/pay-links/page-rules";
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

/** One read per request, shared by the link card and the page. */
const lookup = cache((raw: string) => (raw.startsWith("@") ? getPersonalPayLink(raw.slice(1), headers()) : getPayLink(raw, headers())));

/**
 * The link card: "Pay Alex L. in a minute" for a personal link, "Dinner · $40"
 * for a priced one, in the reader's language, over the HOLD banner.
 * Anything that can't be paid gets the plain HOLD card.
 */
export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const raw = decodeURIComponent(params.code);
  const [found, words] = await Promise.all([lookup(raw), ogCopyFor(headers().get("accept-language"))]);
  const link = found.kind === "found" ? found.value : null;
  const preview = payPreview(link, raw.startsWith("@"), words.copy, words.fmt, words.intl);
  // Only a link that can be paid offers the App Clip.
  return payPageMetadata("Pay link", { ...preview, lang: words.lang }, { appClip: link !== null });
}

export default async function PayLinkPage({ params }: { params: { code: string } }) {
  // `/pay/@dana` arrives as `%40dana`.
  const raw = decodeURIComponent(params.code);
  const found = await lookup(raw);
  if (found.kind === "missing") notFound();

  const state: PayPageState =
    found.kind === "unreachable"
      ? { kind: "unreachable" }
      : isShown(found.value)
        ? { kind: "shown", link: found.value }
        : elsewhere(found.value) ??
          // Nothing the owner wrote is shown on a link we took down.
          { kind: "disabled" };

  return <PayPage state={state} />;
}

/** A disabled link, or one that comes back without its title or amount, shows nothing the owner wrote. */
function isShown(link: PayLinkPublic): link is ShownPayLink {
  return link.status !== "disabled" && link.title !== null && link.amount !== null;
}

/**
 * A link that can't be paid and came back without its title or amount, but
 * with its owner's page to go to. Never a disabled one (fallbackHref refuses it).
 */
function elsewhere(link: PayLinkPublic): PayPageState | null {
  const href = fallbackHref(link);
  return href ? { kind: "elsewhere", status: link.status, owner: link.owner, href } : null;
}
