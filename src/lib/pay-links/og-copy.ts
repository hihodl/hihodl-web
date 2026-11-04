/**
 * The link card a chat app draws for a pay page (og:title, og:description,
 * og:image), as words. The image is always the HOLD banner (./metadata).
 *
 * It sells the payment the way a bank's "send me money" link does: who you
 * pay, for what and how much, and that it takes a minute. No crypto word ever
 * reaches it (no wallet, USDC, chain): how the money moves is the page's
 * business. The warning to pay only people you know lives on the page itself,
 * under the pay button, not on the card.
 *
 * What reaches the card is only what the public payload already shows on the
 * page: the owner's verified or display name (else their @handle) and, for a
 * priced link, its title (which the server filters for links, emails and
 * impersonation) and its price, in the currency it was asked in: what a
 * group debt owes now, else the part asked (a euro split), else the link's own. A link that can't be paid, a disabled one, or
 * one with nobody to name gets the plain HOLD card.
 *
 * Pure: no React, no `@/` imports, so a .check.ts can load it.
 */

import type { PayLinkOwner, PayLinkPublic } from "./types";

/** The payPage og.* messages in the reader's language, ICU with `{name}`. */
export interface OgCopy {
  personalTitle: string;
  linkDescription: string;
  cardApplePay: string;
  byCard: string;
  plain: string;
  genericTitle: string;
}

export type OgFormat = (message: string, vars?: Record<string, string>) => string;

export interface PayPreview {
  title: string;
  description: string;
}

const TITLE_MAX = 60;

/** The name the page's big line shows: the verified or display name, else the server's label, else "@handle". */
export function previewName(owner: PayLinkOwner | null | undefined): string | null {
  const name = owner?.displayName?.trim() || owner?.label?.trim() || (owner?.handle ? `@${owner.handle}` : "");
  return name || null;
}

/** "$40", "$1,250.50": always dollars, separators in the reader's language. */
export function previewPrice(cents: number, intl: string): string {
  const whole = cents % 100 === 0;
  let n: string;
  try {
    n = new Intl.NumberFormat(intl, { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(cents / 100);
  } catch {
    n = (cents / 100).toFixed(whole ? 0 : 2);
  }
  return `$${n}`;
}

/** "30 €", "€30", "$1,250.50": any currency, in minor units, separators and symbol in the reader's language. */
export function previewMoney(minor: number, currency: string, intl: string): string {
  if (currency === "USD") return previewPrice(minor, intl);
  const whole = minor % 100 === 0;
  try {
    return new Intl.NumberFormat(intl, { style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(whole ? 0 : 2)} ${currency}`;
  }
}

/** A fixed link's price as the asker means it: a live group debt, else what was asked, else the link's own currency. */
export function askedPrice(link: PayLinkPublic & { amount: { mode: "fixed"; cents: number } }, intl: string): string {
  const debt = link.groupDebt;
  const debtMinor = debt && !debt.settled ? Number(debt.amountMinor) : NaN;
  if (debt && Number.isSafeInteger(debtMinor) && debtMinor > 0) return previewMoney(debtMinor, debt.currency, intl);
  const asked = link.asked ? Number(link.asked.minor) : NaN;
  if (link.asked && Number.isSafeInteger(asked) && asked > 0) return previewMoney(asked, link.asked.currency, intl);
  return previewMoney(link.amount.cents, link.currency === "EUR" ? "EUR" : "USD", intl);
}

export function clipText(text: string, max: number): string {
  const chars = Array.from(text.trim());
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : chars.join("");
}

export function genericPreview(copy: OgCopy): PayPreview {
  return { title: copy.genericTitle, description: copy.plain };
}

/** Whether a link is worth its own card: active, with its title, amount and a name to show. */
export function previewable(link: PayLinkPublic | null | undefined): link is PayLinkPublic & { title: string; amount: NonNullable<PayLinkPublic["amount"]> } {
  return Boolean(link && link.status === "active" && link.title !== null && link.amount !== null && previewName(link.owner));
}

export function payPreview(
  link: PayLinkPublic | null | undefined,
  personal: boolean,
  copy: OgCopy,
  fmt: OgFormat,
  intl: string,
): PayPreview {
  if (!previewable(link)) return genericPreview(copy);
  const name = previewName(link.owner) as string;

  if (personal || link.personal) {
    // Only what this link really takes: an older server names no methods, so no card is promised.
    const kinds = new Set((link.methods ?? []).map((m) => m.kind));
    const description = kinds.has("card") && kinds.has("apple_pay") ? copy.cardApplePay : kinds.has("card") ? copy.byCard : copy.plain;
    return { title: fmt(copy.personalTitle, { name }), description };
  }

  const what = clipText(link.title, TITLE_MAX);
  const title = link.amount.mode === "fixed" ? `${what} · ${askedPrice({ ...link, amount: link.amount }, intl)}` : what;
  return { title, description: fmt(copy.linkDescription, { name }) };
}
