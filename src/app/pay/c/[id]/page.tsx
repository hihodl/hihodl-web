import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PayPage, type PayPageState } from "@/components/pay-links/PayPage";
import { payPageMetadata } from "@/lib/pay-links/metadata";
import { payPreview } from "@/lib/pay-links/og-copy";
import { ogCopyFor } from "@/lib/pay-links/og-locale";
import { getCheckout } from "@/lib/pay-links/server";
import type { ShownPayLink } from "@/lib/pay-links/types";

/**
 * /pay/c/<id>: a creator's checkout (lib/pay-links/checkout).
 *
 * Their server made it with an API key and sent the buyer here. It is the pay
 * page, with the checkout's fixed amount and its description as the note;
 * once paid it goes back to the creator's `successUrl` with the checkout id
 * and the status, and a `cancelUrl` gives the buyer a way back. A test
 * checkout shows "Test mode" and two buttons instead of ways to pay.
 *
 * Paid, expired or canceled: the pay page's own dead-link page. Private like
 * every /pay page (noindex, no-store, no referrer, never framed).
 */

export const dynamic = "force-dynamic";

const lookup = cache((id: string) => getCheckout(id, headers()));

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const [found, words] = await Promise.all([lookup(decodeURIComponent(params.id)), ogCopyFor(headers().get("accept-language"))]);
  const link = found.kind === "found" ? found.value.link : null;
  const preview = payPreview(link, false, words.copy, words.fmt, words.intl);
  return payPageMetadata("Checkout", { ...preview, lang: words.lang });
}

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const found = await lookup(decodeURIComponent(params.id));
  if (found.kind === "missing") notFound();
  if (found.kind === "unreachable") return <PayPage state={{ kind: "unreachable" }} />;

  const { link, checkout } = found.value;
  const shown = link.status !== "disabled" && link.title !== null && link.amount !== null;
  const state: PayPageState = shown ? { kind: "shown", link: link as ShownPayLink } : { kind: "disabled" };
  return <PayPage state={state} checkout={checkout} />;
}
