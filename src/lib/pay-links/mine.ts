"use client";

/**
 * A person's OWN pay links, read from the web.
 *
 * Ported from the app's src/features/pay-links/api.ts, types.ts and the
 * reading half of rules.ts. The paying half of a pay link already lives in
 * this folder (client.ts, types.ts); this is the other side of the same link:
 * the owner's list, one link with the payments it received, and closing it.
 *
 * WHY THE BROWSER MAY ASK AT ALL
 *
 * `/api/v1/pay-links` sits behind `requireAuth` and nothing else — no wallet
 * signature, no device approval, no unlock — so the Supabase bearer this page
 * already holds is the whole of it. Checked against production on 2026-09-20:
 * a GET with no token answers 401, not 404, so the router is mounted. (A
 * comment in AddMoneyScreen used to say otherwise; it was read off a stale
 * checkout.)
 *
 * WHAT IS HERE AND WHAT IS NOT
 *
 * Reads, and one write that needs no key: closing a link, which only stops it
 * being paid again. MAKING a link is not here. It is a plain authenticated
 * POST too, but it carries an `Idempotency-Key` header that hold-api's read()
 * does not send, and a create that timed out without one makes a second link
 * against the owner's ten a day. So the web lists and the app creates.
 *
 * ENVELOPES
 *
 * The contract names `{ links }` and `{ link, payments }`; a server that
 * answers bare is read the same way, exactly as the app's client does.
 */

import useSWR, { type SWRConfiguration } from "swr";

import { read } from "@/lib/app/hold-api";
import { t } from "@/lib/app/i18n";
import { useCreatorSession } from "@/lib/creator/session";
import { usdFromCents } from "@/lib/ad-space/format";
import type { Chain } from "@/lib/ad-space/types";

import type { PayLinkAmount, PayLinkPayment, PayLinkStatus } from "./types";

/* ── What a link is, to its owner ─────────────────────────────────── */

export type PayLinkUse = "single" | "reusable";

/** `GET /pay-links` and `GET /pay-links/:id` (service toLinkView). */
export interface MyPayLink {
  id: string;
  code: string;
  /** The page a payer opens: `https://hihodl.xyz/pay/<code>`. */
  url: string;
  title: string;
  note: string | null;
  amount: PayLinkAmount;
  use: PayLinkUse;
  chains: Chain[];
  status: PayLinkStatus;
  expiresAt: string | null;
  createdAt: string;
  totals: { payments: number; receivedCents: number };
}

/**
 * One link with what reached the owner. The server sends the payments that
 * landed — `paid` and `paid_duplicate` — and no attempt that never paid, so a
 * quiet list here means a quiet link, not a hidden queue.
 */
export interface MyPayLinkDetail {
  link: MyPayLink;
  payments: PayLinkPayment[];
}

function pick<T>(body: unknown, key: string): T {
  if (body && typeof body === "object" && key in (body as Record<string, unknown>)) {
    return (body as Record<string, unknown>)[key] as T;
  }
  return body as T;
}

export async function listMyPayLinks(): Promise<MyPayLink[]> {
  const links = pick<MyPayLink[]>(await read<unknown>("pay-links"), "links");
  return Array.isArray(links) ? links : [];
}

export async function getMyPayLink(id: string): Promise<MyPayLinkDetail> {
  const body = await read<unknown>(`pay-links/${encodeURIComponent(id)}`);
  const link = pick<MyPayLink & { payments?: PayLinkPayment[] }>(body, "link");
  const outer = body && typeof body === "object" ? (body as { payments?: PayLinkPayment[] }).payments : undefined;
  const payments = outer ?? link?.payments ?? [];
  return { link, payments: Array.isArray(payments) ? payments : [] };
}

/** Close a link. Closing one that is already closed answers the link as it is. */
export async function closeMyPayLink(id: string): Promise<MyPayLink | null> {
  const link = pick<MyPayLink | null>(await read<unknown>(`pay-links/${encodeURIComponent(id)}/close`, { json: {} }), "link");
  return link && typeof link === "object" && "id" in link ? link : null;
}

/* ── The reads, cached like the other money screens ───────────────── */

const OPTIONS: SWRConfiguration = {
  revalidateOnFocus: true,
  focusThrottleInterval: 30_000,
  shouldRetryOnError: false,
  dedupingInterval: 10_000,
};

/** lib/app/money's key shape, so a different account in the same tab never reads the last one's links. */
function useRead<T>(name: string | null, fetcher: () => Promise<T>, extra = "") {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  return useSWR<T>(uid && name ? ["money", uid, name, extra] : null, fetcher, OPTIONS);
}

export function useMyPayLinks() {
  return useRead<MyPayLink[]>("pay-links", listMyPayLinks);
}

export function useMyPayLink(id: string | null) {
  return useRead<MyPayLinkDetail>(id ? "pay-link" : null, () => getMyPayLink(id!), id ?? "");
}

/* ── Reading a link (app: features/pay-links/components + rules) ──── */

/** A link that can still be paid, and so can be shared or closed. */
export function isOpenPayLink(status: string | null | undefined): boolean {
  return status === "active";
}

/** "$150 · one payment" / "Payer chooses, up to $1,000 · reusable". */
export function payLinkAmountLine(link: Pick<MyPayLink, "amount" | "use">): string {
  const amount =
    link.amount.mode === "fixed"
      ? usdFromCents(link.amount.cents)
      : link.amount.maxCents != null
        ? t("home.payLinks.amount.upTo", { amount: usdFromCents(link.amount.maxCents) })
        : t("home.payLinks.amount.open");
  return t("home.payLinks.amount.line", { amount, use: link.use === "single" ? "single" : "reusable" });
}

/** "2 payments · $300 received". */
export function payLinkTotalsLine(link: Pick<MyPayLink, "totals">): string {
  return t("home.payLinks.totals", { count: link.totals?.payments ?? 0, amount: usdFromCents(link.totals?.receivedCents ?? 0) });
}

/* ── What went wrong (app: features/pay-links/errors.ts) ──────────── */

/**
 * The codes this side can actually meet. The create refusals
 * (`text_not_allowed`, `too_many_links`, `account_too_new`…) are the app's,
 * because creating is the app's.
 */
export function describeMyPayLinkError(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  switch (typeof code === "string" ? code : "") {
    case "link_not_active":
      return t("home.payLinks.error.notActive");
    case "not_found":
    case "NOT_FOUND":
      return t("home.payLinks.error.notFound");
    case "rate_limited":
    case "RATE_LIMIT_EXCEEDED":
      return t("home.payLinks.error.rateLimited");
    case "NETWORK":
    case "TIMEOUT":
      return t("home.payLinks.error.network");
    case "UNAUTHORIZED":
      return t("home.payLinks.error.unauthorized");
    default:
      return t("home.payLinks.error.other");
  }
}
