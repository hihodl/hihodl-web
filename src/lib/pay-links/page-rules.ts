/**
 * The public pay page's decisions that need no network and no React: which
 * device this is, which currency to start in, what an amount typed in that
 * currency is worth, what Coinflow's checkout is telling the page, and which
 * `hihodl://` address opens the app.
 *
 * Pure: no React, no `@/` imports, so `page-rules.check.ts` runs it under
 * sucrase-node.
 */

import { regionCurrency } from "../app/i18n/currencies";
import type { PayLinkAmount, PayLinkBankTransfer, PayLinkFallback, PayLinkMethod, PayLinkMethodKind, PayLinkStatus } from "./types";

/* ── The device ─────────────────────────────────────────────────── */

export type Platform = "ios" | "android" | "mac" | "desktop";

/**
 * iPadOS reports itself as a Mac, so a "Macintosh" with a touch screen is an
 * iPad. Everything that is not Apple or Android is "desktop".
 */
export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh|Mac OS X/i.test(ua)) return maxTouchPoints > 1 ? "ios" : "mac";
  return "desktop";
}

export function isPhone(p: Platform): boolean {
  return p === "ios" || p === "android";
}

/** Apple Pay on Apple devices, Google Pay everywhere else. Never both. */
export function walletMethodFor(p: Platform): "applePay" | "googlePay" {
  return p === "ios" || p === "mac" ? "applePay" : "googlePay";
}

/* ── The ways to pay ─────────────────────────────────────────────── */

/**
 * Whether the server offers this way to pay the link. The server decides per
 * link (a card only within its limits, say) and the page shows only what it
 * names, without saying why a row is missing. A server that names none is
 * older than the list: every row shows, as it did.
 */
export function offers(link: { methods?: PayLinkMethod[] | null }, kind: PayLinkMethodKind): boolean {
  if (!Array.isArray(link.methods)) return true;
  return link.methods.some((m) => m?.kind === kind);
}

/**
 * The bank transfers the page may show: those the server lists in `methods`
 * AND sent the account for, each well formed. Unlike the other rows, an older
 * server that names no methods shows none: a bank transfer is never assumed.
 */
export function bankTransfersOf(link: { methods?: PayLinkMethod[] | null; bankTransfers?: PayLinkBankTransfer[] | null }): PayLinkBankTransfer[] {
  if (!Array.isArray(link.methods) || !Array.isArray(link.bankTransfers)) return [];
  const listed = new Set(link.methods.flatMap((m) => (m?.kind === "bank_transfer" && typeof m.currency === "string" ? [m.currency.toUpperCase()] : [])));
  const seen = new Set<string>();
  return link.bankTransfers.filter((b) => {
    const cur = typeof b?.currency === "string" ? b.currency.toUpperCase() : "";
    if (!listed.has(cur) || seen.has(cur) || typeof b.reference !== "string" || !b.reference.trim() || !b.account) return false;
    const a = b.account as Record<string, unknown>;
    const holder = typeof a.holderName === "string" && a.holderName.trim() !== "";
    const iban = typeof a.iban === "string" && a.iban.trim() !== "";
    const us = typeof a.accountNumber === "string" && a.accountNumber.trim() !== "" && typeof a.routingNumber === "string" && a.routingNumber.trim() !== "";
    if (!holder || !(iban || us)) return false;
    seen.add(cur);
    return true;
  });
}

/** An IBAN as a bank prints it: groups of four. What is copied stays unspaced. */
export function groupIban(iban: string): string {
  return iban.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}

/** The kind Apple Pay and Google Pay are offered as. The card checkout keeps Coinflow's names. */
export function walletMethodKind(m: "applePay" | "googlePay"): "apple_pay" | "google_pay" {
  return m === "applePay" ? "apple_pay" : "google_pay";
}

/* ── Opening the app ────────────────────────────────────────────── */

const HANDLE = /^[a-z0-9_.]{1,63}$/;
/** A link code, as the server makes them (eight of 2-9 and a-z without i, l, o). */
const CODE = /^[23456789a-hjkmnp-z]{8}$/;

/** Whether this is a group debt's link (the server sends `groupDebt` only on those). */
export function isGroupDebt(link: { groupDebt?: { settled?: unknown } | null }): boolean {
  return Boolean(link.groupDebt && typeof link.groupDebt === "object");
}

/**
 * The app's own address for this link, or null when it has none.
 *
 * The app (src/lib/personalPayLink.ts) reads `hihodl://pay/@handle` and opens
 * Quick Send to that handle; it takes no amount and no note. A group debt's
 * link opens as `hihodl://pay/<code>`: the app asks the group what is owed
 * and opens that group's Pay sheet, so the payment settles the debt in the
 * group. A settled debt has nothing to open. Any other code link has no app
 * route and goes straight to the store.
 */
export function appSchemeUrl(link: {
  code?: string;
  personal?: boolean;
  owner: { handle: string | null } | null;
  groupDebt?: { settled?: unknown } | null;
}): string | null {
  if (isGroupDebt(link)) {
    const code = (link.code ?? "").toLowerCase();
    return link.groupDebt?.settled !== true && CODE.test(code) ? `hihodl://pay/${code}` : null;
  }
  const h = (link.owner?.handle ?? "").toLowerCase();
  if (!link.personal || !HANDLE.test(h)) return null;
  return `hihodl://pay/@${h}`;
}

/* ── Currencies and amounts ─────────────────────────────────────── */

/**
 * The currency to start in: the browser's region (es-ES EUR, es-MX MXN,
 * pt-BR BRL, en-GB GBP), when the card takes it; else US dollars when it
 * does; else the card's first. No card: US dollars.
 */
export function defaultCurrency(tags: readonly string[] | null | undefined, offered: readonly string[] | null | undefined): string {
  const list = (offered ?? []).map((c) => c.toUpperCase());
  if (!list.length) return "USD";
  const region = regionCurrency(tags);
  if (region && list.includes(region)) return region;
  if (list.includes("USD")) return "USD";
  return list[0];
}

/** How many decimals a currency's minor unit has (EUR 2, JPY 0). */
export function minorDigits(currency: string): number {
  try {
    const d = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
    return typeof d === "number" ? d : 2;
  } catch {
    return 2;
  }
}

/**
 * What the amount field keeps of a keystroke: digits and one decimal point
 * ("." or ","), at most the currency's decimals after it, no leading zeros.
 * The field is the app's keypad: it never holds anything `parseMinor` refuses.
 */
export function cleanAmountInput(text: string, currency: string): string {
  const digits = minorDigits(currency);
  let out = "";
  let sep = -1;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") {
      if (sep >= 0 && out.length - sep - 1 >= digits) continue;
      if (sep < 0 && out.replace(/^0+/, "").length >= 9) continue;
      out += ch;
    } else if ((ch === "." || ch === ",") && sep < 0 && digits > 0) {
      if (!out) out = "0";
      sep = out.length;
      out += ch;
    }
  }
  // "007" reads 7; "0.5" keeps its zero.
  return out.replace(/^0+(?=\d)/, "");
}

/**
 * "25", "25.5", "25,50" to minor units, or null. One decimal point, "." or
 * ",", and at most the currency's decimals. No floating point.
 */
export function parseMinor(text: string, currency: string): number | null {
  const digits = minorDigits(currency);
  const s = text.trim();
  const m = s.match(/^(\d{1,9})(?:[.,](\d*))?$/);
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > digits) return null;
  return Number(m[1]) * 10 ** digits + Number(frac.padEnd(digits, "0") || "0");
}

/**
 * Minor units of `currency` in US cents, by `unitsPerUsd` (units of the
 * currency per dollar, the server's /fx/rates book). Null without a rate.
 */
export function usdCentsFromMinor(minor: number, currency: string, rates: Readonly<Record<string, number>> | null): number | null {
  if (currency === "USD") return minor;
  const r = rates?.[currency];
  if (!r || !(r > 0)) return null;
  const units = minor / 10 ** minorDigits(currency);
  return Math.round((units / r) * 100);
}

/** US cents in minor units of `currency`, or null without a rate. */
export function minorFromUsdCents(cents: number, currency: string, rates: Readonly<Record<string, number>> | null): number | null {
  if (currency === "USD") return cents;
  const r = rates?.[currency];
  if (!r || !(r > 0)) return null;
  return Math.round((cents / 100) * r * 10 ** minorDigits(currency));
}

/* ── Coinflow's hosted checkout ─────────────────────────────────── */

/** Where Coinflow's checkout posts from: its sandbox and its production host. */
export const COINFLOW_ORIGINS: ReadonlySet<string> = new Set(["https://sandbox.coinflow.cash", "https://coinflow.cash"]);

/**
 * Whether a message came from Coinflow: one of its two origins, or the origin
 * of the checkout URL the server handed us when that is a Coinflow host.
 */
export function isCoinflowOrigin(origin: string, checkoutUrl?: string | null): boolean {
  if (COINFLOW_ORIGINS.has(origin)) return true;
  if (!checkoutUrl) return false;
  try {
    const u = new URL(checkoutUrl);
    const coinflowHost = u.hostname === "coinflow.cash" || u.hostname.endsWith(".coinflow.cash");
    return u.protocol === "https:" && coinflowHost && u.origin === origin;
  } catch {
    return false;
  }
}

/** Only an https URL on a Coinflow host is framed. */
export function isCoinflowCheckoutUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "coinflow.cash" || u.hostname.endsWith(".coinflow.cash"));
  } catch {
    return false;
  }
}

export type CoinflowMessage = { kind: "success"; paymentId: string | null } | { kind: "height"; px: number } | null;

/**
 * What a `message` from Coinflow's checkout says. A string that JSON-parses to
 * `{ data: "success", info: { paymentId } }` is an accepted card. A
 * `{ method: "heightChange", data }` is the frame asking for more room.
 * Anything else is ignored.
 */
export function readCoinflowMessage(data: unknown): CoinflowMessage {
  let v: unknown = data;
  if (typeof data === "string") {
    try {
      v = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.data === "success") {
    const info = o.info && typeof o.info === "object" ? (o.info as Record<string, unknown>) : null;
    const id = info && typeof info.paymentId === "string" ? info.paymentId : null;
    return { kind: "success", paymentId: id };
  }
  if (o.method === "heightChange") {
    const px = Number(o.data);
    return Number.isFinite(px) && px > 0 ? { kind: "height", px: Math.ceil(px) } : null;
  }
  return null;
}

/* ── The face ───────────────────────────────────────────────────── */

/**
 * Two letters for a face with no photo, the app's rule (Avatar.tsx
 * initialsFromName): the first letters of the first two words of the display
 * name ("Demo Creator" DC), else the first two of one word, else the handle's
 * first two ("@dana" DA). "?" only when there is nothing at all.
 */
export function initialsFor(displayName: string | null | undefined, handle: string | null | undefined): string {
  const name = (displayName ?? "").trim();
  const words = name.split(/\s+/).filter(Boolean);
  const first = (w: string) => Array.from(w)[0] ?? "";
  if (words.length >= 2) return (first(words[0]) + first(words[1])).toUpperCase();
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  const h = (handle ?? "").replace(/^@/, "").replace(/[^A-Za-z0-9]/g, "");
  return h ? h.slice(0, 2).toUpperCase() : "?";
}

/** Only a signed https photo is drawn; anything else draws the initials. */
export function safeAvatarUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/* ── Opening this page inside a wallet ──────────────────────────── */

export type WalletLinkId = "hold" | "phantom" | "solflare" | "backpack" | "metamask" | "coinbase" | "trust";

/**
 * A wallet's own browser, opened on this page. Mobile browsers can't tell
 * which apps are installed, and a bare `solana:` link opens whatever the
 * phone picked as its Solana handler, so each wallet gets its own button.
 * Inside the wallet the page finds the wallet injected and pays in one tap.
 */
export function walletBrowseUrl(id: Exclude<WalletLinkId, "hold">, pageUrl: string): string {
  const u = encodeURIComponent(pageUrl);
  let origin = "";
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = pageUrl;
  }
  const ref = encodeURIComponent(origin);
  switch (id) {
    case "phantom":
      return `https://phantom.app/ul/browse/${u}?ref=${ref}`;
    case "solflare":
      return `https://solflare.com/ul/v1/browse/${u}?ref=${ref}`;
    case "backpack":
      // docs.backpack.app/deeplinks/other-methods/browse (30-Sep-2026).
      return `https://backpack.app/ul/v1/browse/${u}?ref=${ref}`;
    case "metamask":
      return `https://metamask.app.link/dapp/${pageUrl.replace(/^https?:\/\//, "")}`;
    case "coinbase":
      return `https://go.cb-w.com/dapp?cb_url=${u}`;
    case "trust":
      return `https://link.trustwallet.com/open_url?coin_id=60&url=${u}`;
  }
}

/** The flags a wallet's injected provider carries, as far as the page reads them. */
type Flags = { isPhantom?: boolean; isSolflare?: boolean; isBackpack?: boolean; isMetaMask?: boolean; isCoinbaseWallet?: boolean; isTrust?: boolean; isTrustWallet?: boolean };

/**
 * The wallet whose own browser this page is open in, or null. Only on a
 * phone: a mobile browser has no extensions, so a provider there means the
 * page is inside that wallet's app. On a computer an extension injects the
 * same provider into every tab, and that tab still takes a card.
 *
 * Phantom and Trust also inject `ethereum` (with `isMetaMask` on some
 * versions), so their own flag is read first and MetaMask comes last.
 * Backpack is read first, by its own `window.backpack`: a `window.solana`
 * it may also set must not read as another wallet.
 */
export function walletBrowserOf(
  platform: Platform,
  w: { phantom?: { solana?: Flags; ethereum?: Flags }; solflare?: Flags; backpack?: Flags; solana?: Flags; ethereum?: Flags; trustwallet?: unknown },
): Exclude<WalletLinkId, "hold"> | null {
  if (!isPhone(platform)) return null;
  const eth = w.ethereum;
  if (w.backpack || w.solana?.isBackpack) return "backpack";
  if (w.phantom?.solana?.isPhantom || w.solana?.isPhantom || eth?.isPhantom) return "phantom";
  if (w.solflare?.isSolflare || w.solana?.isSolflare) return "solflare";
  if (w.trustwallet || eth?.isTrust || eth?.isTrustWallet) return "trust";
  if (eth?.isCoinbaseWallet) return "coinbase";
  if (eth?.isMetaMask) return "metamask";
  return null;
}

/**
 * This page's URL carrying what the payer chose, so the page reopens inside a
 * wallet with the same amount, currency and network, straight on the
 * stablecoin sheet.
 *
 * It rides in the PATH (`/pay/<code>/w/USD-25.00-solana`), never the query: a
 * wallet's browse link carries this whole URL encoded inside its own, and
 * Phantom decodes it once as a whole, so an inner `?amount=` became the
 * browse link's own query and the page opened with nothing typed. A path
 * segment of letters, digits, dots and dashes reads the same however many
 * times it is decoded.
 */
export function payStateUrl(
  base: string,
  s: { amount: string | null; currency: string; network: string | null },
): string {
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    return base;
  }
  u.hash = "";
  u.search = "";
  u.pathname = payPagePath(u.pathname);
  const amount = s.amount ? s.amount.replace(",", ".") : "";
  const cur = (s.currency || "USD").toUpperCase();
  const seg = [cur, /^\d{1,9}(?:\.\d{0,2})?$/.test(amount) ? amount : "0", s.network ?? "any"].join("-");
  u.pathname = `${u.pathname.replace(/\/+$/, "")}/${STATE_SEGMENT}/${seg}`;
  return u.toString();
}

/** The path marker before the state a wallet's browser brings back. */
export const STATE_SEGMENT = "w";

/** `/pay/<code>/w/USD-25.00-solana` as `/pay/<code>`; any other path as it is. */
export function payPagePath(pathname: string): string {
  const m = pathname.match(new RegExp(`^(/pay/[^/]+)/${STATE_SEGMENT}/[^/]*/?$`));
  return m ? m[1] : pathname;
}

/** The note field's length on the page, and the most a prefilled note carries. */
export const PAY_NOTE_MAX = 140;

/**
 * A note that arrives in the address: one line of plain text, no control or
 * direction-override characters, at most PAY_NOTE_MAX. Null when nothing is left.
 */
export function cleanPrefillNote(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, " ").replace(/\s+/g, " ").trim();
  return s ? Array.from(s).slice(0, PAY_NOTE_MAX).join("").trim() : null;
}

/** What a reopened page reads back, and what a dead link hands its owner's page. Anything malformed is dropped. */
export function readPayState(
  search: string,
  pathname = "",
): {
  amount: string | null;
  currency: string | null;
  stablecoins: boolean;
  network: string | null;
  note: string | null;
} {
  const q = new URLSearchParams(search);
  // What a wallet's browser brought back rides in the path (payStateUrl); an older page's link, in the query.
  const inPath = pathname.match(new RegExp(`^/pay/[^/]+/${STATE_SEGMENT}/([A-Za-z]{3})-([\\d.,]+)-([a-z]+)/?$`));
  const amount = inPath ? (inPath[2] === "0" ? null : inPath[2]) : q.get("amount");
  const currency = (inPath ? inPath[1] : q.get("currency") ?? "").toUpperCase();
  const network = inPath ? inPath[3] : q.get("network");
  return {
    amount: amount && /^\d{1,9}(?:[.,]\d{0,2})?$/.test(amount) ? amount : null,
    currency: currency === "USD" || currency === "EUR" ? currency : null,
    stablecoins: inPath !== null || q.get("pay") === "stablecoins",
    network: network === "solana" || network === "base" || network === "polygon" || network === "arc" ? network : null,
    note: cleanPrefillNote(q.get("note")),
  };
}

/* ── A link that can't be paid ──────────────────────────────────── */

/** The statuses a link is sent on from, to its owner's personal link. Never `disabled`. */
const SENDS_ON: readonly PayLinkStatus[] = ["paid", "closed", "expired", "frozen"];

/**
 * Where a link that can't be paid sends the payer: its owner's personal page,
 * `/pay/@handle`, or null. The address is built here from the handle, and only
 * when the server's own `path` says the same, so a payload can never send the
 * payer anywhere but a HOLD pay page.
 *
 * A link that asked a fixed amount carries it (`amount=25.00&currency=USD`)
 * and its title as the note, and the payer can still change both. A paid
 * link carries nothing: it was paid, and this may be somebody else.
 */
export function fallbackHref(link: {
  status: PayLinkStatus;
  personal?: boolean;
  title: string | null;
  amount: PayLinkAmount | null;
  fallback?: PayLinkFallback | null;
  groupDebt?: { settled?: unknown } | null;
}): string | null {
  const f = link.fallback;
  // A group debt is paid in its group: a settled one says so, and a payment to
  // the owner's personal link would be a transfer the group never hears of.
  if (isGroupDebt(link)) return null;
  // A personal link is already the owner's page: sending it on would come back here.
  if (!f || link.personal || typeof f.handle !== "string" || typeof f.path !== "string") return null;
  if (!SENDS_ON.includes(link.status)) return null;
  const h = f.handle.replace(/^@/, "").toLowerCase();
  if (!HANDLE.test(h)) return null;
  const path = `/pay/@${h}`;
  if (f.path.toLowerCase() !== path) return null;
  if (link.status === "paid") return path;
  const q = new URLSearchParams();
  const cents = link.amount?.mode === "fixed" ? link.amount.cents : null;
  if (cents !== null && Number.isInteger(cents) && cents > 0 && cents < 1e11) {
    q.set("amount", (cents / 100).toFixed(2));
    q.set("currency", "USD");
  }
  const note = cleanPrefillNote(link.title);
  if (note) q.set("note", note);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** "@dana", "dana" or " @Dana " as the handle `/pay/@handle` takes, or null. */
export function payHandleOf(input: string): string | null {
  const h = input.trim().replace(/^@/, "").toLowerCase();
  return HANDLE.test(h) ? h : null;
}

/**
 * The app's address with the amount along (the app reads the handle; the rest
 * rides for later). A link code's address carries nothing: the app reads the
 * debt live.
 */
export function holdPayUrl(scheme: string, amount: string | null, currency: string): string {
  if (!amount || !scheme.startsWith("hihodl://pay/@")) return scheme;
  return `${scheme}?amount=${encodeURIComponent(amount)}&currency=${encodeURIComponent(currency)}`;
}
