/**
 * A creator's checkout: hihodl.xyz/pay/c/<id>.
 *
 * The creator's own server makes it with an API key (`POST /v1/checkouts`)
 * and sends its buyer here. The page is the pay page with the checkout's
 * fixed amount, its description as the note, and a way back to the
 * creator's site: `successUrl?checkout_id=<id>&status=paid` once paid, and
 * `cancelUrl` for a buyer who changes their mind.
 *
 * The public read (`GET /pay-links/public/checkout/:id`) answers the pay
 * link's public shape plus `successUrl`, `cancelUrl`, `orderId`, `mode` and
 * `status`. Everything here reads that answer defensively: the envelope may
 * nest it under `checkout` or `link`, `status` may be the checkout's word
 * (`open`, `paid`, `expired`, `failed`, `canceled`) or the link's, and a URL
 * that is not plainly the creator's own web page is never followed.
 *
 * Pure: no React, no `@/` value imports (checked by checkout.check.ts).
 */

import type { PayLinkPublic, PayLinkStatus } from "./types";

export type CheckoutMode = "live" | "test";
export type CheckoutStatus = "open" | "paid" | "expired" | "failed" | "canceled";

/** What the pay page needs beyond the link: where to go back to, and whether money is real. */
export interface CheckoutView {
  id: string;
  mode: CheckoutMode;
  status: CheckoutStatus;
  successUrl: string | null;
  cancelUrl: string | null;
  orderId: string | null;
}

/** Checkout ids are opaque and URL-safe. Anything else names no checkout. */
export const CHECKOUT_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

const LINK_STATUSES: readonly PayLinkStatus[] = ["active", "paid", "closed", "expired", "frozen", "disabled"];

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** The checkout's own word for where it is, whichever spelling the server uses. */
export function checkoutStatusOf(raw: unknown): CheckoutStatus {
  switch (typeof raw === "string" ? raw.toLowerCase() : "") {
    case "paid":
    case "succeeded":
    case "completed":
    case "complete":
      return "paid";
    case "expired":
      return "expired";
    case "failed":
      return "failed";
    case "canceled":
    case "cancelled":
    case "closed":
      return "canceled";
    default:
      return "open";
  }
}

/**
 * The link status the page draws. A paid, expired or canceled checkout is a
 * dead link (the page's existing behaviour); an open or failed one can be
 * paid unless the link itself says otherwise (frozen, disabled).
 */
export function linkStatusFor(checkout: CheckoutStatus, linkRaw: unknown): PayLinkStatus {
  if (checkout === "paid") return "paid";
  if (checkout === "expired") return "expired";
  if (checkout === "canceled") return "closed";
  const own = typeof linkRaw === "string" && (LINK_STATUSES as readonly string[]).includes(linkRaw) ? (linkRaw as PayLinkStatus) : null;
  return own === "frozen" || own === "disabled" ? own : "active";
}

/**
 * A URL the page may send a buyer to: https, or http only on the creator's
 * own machine (localhost, 127.0.0.1) so a test checkout can come back to a
 * dev server. No credentials in it. Null for anything else.
 */
export function safeReturnUrl(raw: unknown): string | null {
  const s = str(raw);
  if (!s || s.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.username || u.password) return null;
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  if (u.protocol === "https:" || (u.protocol === "http:" && local)) return u.toString();
  return null;
}

/**
 * A return URL with `checkout_id` and `status` added (or replaced), its own
 * query and fragment kept: `paid` on success, `cancelled` on the way back
 * without paying (the backend's redirectWith spells them the same).
 */
export function successReturnUrl(successUrl: string, id: string, status: "paid" | "cancelled" = "paid"): string {
  const u = new URL(successUrl);
  u.searchParams.set("checkout_id", id);
  u.searchParams.set("status", status);
  return u.toString();
}

/** "shop.example.com" for a return URL: what the page names as the place it goes back to. */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The amount, as a fixed `PayLinkAmount`, from the shapes a checkout may carry it in. */
function amountOf(o: Record<string, unknown>): PayLinkPublic["amount"] {
  const a = o.amount;
  if (typeof a === "number" && Number.isInteger(a) && a > 0) return { mode: "fixed", cents: a };
  // The API's own spelling: "40.00".
  if (typeof a === "string" && /^\d{1,7}(\.\d{1,2})?$/.test(a)) {
    const [whole, frac = ""] = a.split(".");
    const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
    return cents > 0 ? { mode: "fixed", cents } : null;
  }
  const ao = obj(a);
  if (ao?.mode === "fixed" && typeof ao.cents === "number") return { mode: "fixed", cents: ao.cents };
  if (ao?.mode === "open") return { mode: "open", maxCents: typeof ao.maxCents === "number" ? ao.maxCents : null };
  if (typeof o.amountCents === "number" && Number.isInteger(o.amountCents) && o.amountCents > 0) return { mode: "fixed", cents: o.amountCents };
  return null;
}

/**
 * The public answer as the pay page's link plus the checkout. Undefined when
 * it carries no link at all (the server then counts as unreachable).
 */
export function readCheckout(id: string, data: unknown): { link: PayLinkPublic; checkout: CheckoutView } | undefined {
  const d = obj(data);
  if (!d) return undefined;
  const outer = obj(d.checkout) ?? d;
  const inner = obj(outer.link) ?? obj(d.link) ?? outer;
  // A test checkout has no pay link behind it, so it may come without a code: it is never paid for real.
  const code = typeof inner.code === "string" && inner.code ? inner.code : null;
  const testHint = outer.mode === "test" || d.mode === "test";
  if (!code && !testHint) return undefined;

  const pick = (k: string): unknown => (outer[k] !== undefined ? outer[k] : d[k] !== undefined ? d[k] : inner[k]);
  // When the link sits apart, its `status` is the link's own and the checkout's is on the outside.
  const status = checkoutStatusOf(outer !== inner ? outer.status ?? pick("checkoutStatus") : pick("checkoutStatus") ?? inner.status);
  const mode: CheckoutMode = pick("mode") === "test" || pick("livemode") === false ? "test" : "live";
  const description = str(pick("description"));
  const orderId = str(pick("orderId") ?? pick("order_id"));

  const base = inner as unknown as PayLinkPublic;
  const amount = amountOf(inner) ?? amountOf(outer);
  const title = str(base.title) ?? description ?? (orderId ? `#${orderId}` : null);
  const noteRaw = str(base.note) ?? description;
  const currency = String(pick("currency") ?? "").toUpperCase() === "EUR" ? "EUR" : "USD";
  const link: PayLinkPublic = {
    ...base,
    code: code ?? id,
    personal: false,
    currency,
    title,
    // The description is the note, unless it already is the title.
    note: noteRaw && noteRaw !== title ? noteRaw : null,
    amount,
    chains: Array.isArray(base.chains) ? base.chains : [],
    owner: base.owner ?? null,
    payTo: base.payTo ?? null,
    status: linkStatusFor(status, inner.status),
  };
  return {
    link,
    checkout: {
      id,
      mode,
      status,
      successUrl: safeReturnUrl(pick("successUrl") ?? pick("success_url")),
      cancelUrl: safeReturnUrl(pick("cancelUrl") ?? pick("cancel_url")),
      orderId,
    },
  };
}
