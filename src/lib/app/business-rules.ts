/**
 * The business console's rules, with nothing that needs React or a network,
 * so `business-rules.check.ts` runs every one under sucrase-node.
 *
 * Contracts (documentation/ in the workspace):
 *   business-treasury-contract.md          profile, treasury, the 72 hour guard
 *   business-roles-and-activity-contract.md who may do what, the activity log
 *   spot-enquiries-contract.md             the inbox
 *   seller-quotes-contract.md              quotes, archive
 *   sale-invoices-contract.md              invoices and the sales CSV
 *
 * WHAT THIS MIRRORS AND WHAT IT DOES NOT
 *
 * The server decides every permission; this only hides what a role would be
 * refused, so a rep never meets a button that answers "not allowed". A
 * `403 role_not_allowed` that still arrives (a role changed since the page
 * loaded) is said in words by `errorKey`, never as a failure.
 */

import type { MessageKey } from "./i18n";

export type BusinessRole = "owner" | "manager" | "rep";

export type BusinessTab = "profile" | "treasury" | "inbox" | "sales" | "activity" | "team";

export const TABS: readonly BusinessTab[] = ["profile", "treasury", "inbox", "sales", "activity", "team"];

/**
 * The permission matrix (business-roles-and-activity-contract.md), the rows
 * this console touches.
 *
 * Invoices and the CSV are the owner's only (sale-invoices-contract.md, "Out
 * of scope: team members reading the seller's documents"), although managers
 * hold `sales.money` elsewhere in Spaces. Treasury, profile and team are the
 * signed-in account's own data, so only the owner ever acts on them.
 */
export type BusinessAction =
  | "business.profile"
  | "treasury.manage"
  | "invoices"
  | "activity.view"
  | "team.view"
  | "enquiry.reply"
  | "enquiry.quote"
  | "enquiry.archive";

const MATRIX: Record<BusinessAction, readonly BusinessRole[]> = {
  "business.profile": ["owner"],
  "treasury.manage": ["owner"],
  invoices: ["owner"],
  "activity.view": ["owner", "manager"],
  "team.view": ["owner"],
  "enquiry.reply": ["owner", "manager"],
  "enquiry.quote": ["owner", "manager"],
  "enquiry.archive": ["owner", "manager"],
};

export function can(role: BusinessRole, action: BusinessAction): boolean {
  return MATRIX[action].includes(role);
}

/**
 * The tabs a role sees. The inbox is everybody's: the server lists every
 * owner the caller works for in one place. `guardianChange` opens Treasury for
 * somebody who is not the owner but was told about a pending change (a
 * manager, a member of the multisig): they may read it and cancel it.
 */
export function tabsFor(role: BusinessRole, opts: { guardianChange?: boolean; actingForOther?: boolean } = {}): BusinessTab[] {
  return TABS.filter((tab) => {
    switch (tab) {
      case "profile":
        return can(role, "business.profile");
      case "treasury":
        return can(role, "treasury.manage") || !!opts.guardianChange;
      case "inbox":
        return true;
      case "sales":
        return can(role, "invoices");
      case "activity":
        // A team member reads a business's log with ?asBusiness=, so it needs the owner's id.
        return can(role, "activity.view") && (role === "owner" || !!opts.actingForOther);
      case "team":
        return can(role, "team.view");
      default:
        return false;
    }
  });
}

export function pickTab(wanted: string | null | undefined, tabs: readonly BusinessTab[]): BusinessTab {
  return tabs.find((x) => x === wanted) ?? tabs[0] ?? "inbox";
}

/* ── Money ───────────────────────────────────────────────────────── */

/**
 * USDC base units (6 decimals, a string) to "1,234.56": exact, through
 * BigInt, so a vault balance never rounds through a float.
 */
export function usdcFromBase(base: string | null | undefined): string | null {
  if (base == null || !/^-?\d+$/.test(String(base).trim())) return null;
  let n = BigInt(String(base).trim());
  const neg = n < BigInt(0);
  if (neg) n = -n;
  const million = BigInt(1_000_000);
  const whole = n / million;
  const cents = (n % million) / BigInt(10_000);
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}.${cents.toString().padStart(2, "0")}`;
}

/** "1500", "1,500.5", "1500.00" typed into a price box, to whole cents; null when it is not a price. */
export function centsFromInput(text: string): number | null {
  const clean = text.replace(/[\s,$]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/* ── Time ────────────────────────────────────────────────────────── */

/** What is left until `iso`, in whole days, hours and minutes; null once it has passed or when it is not a date. */
export function timeLeft(iso: string | null | undefined, now = Date.now()): { days: number; hours: number; minutes: number } | null {
  if (!iso) return null;
  const end = Date.parse(iso);
  if (!Number.isFinite(end) || end <= now) return null;
  const ms = end - now;
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.max(1, Math.floor((ms % 3_600_000) / 60_000)),
  };
}

/** The sales CSV's range rule: YYYY-MM-DD both, from ≤ to, at most 366 days inclusive (as the server counts). */
export function csvRangeProblem(from: string, to: string): "range_invalid" | "range_too_long" | null {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!day.test(from) || !day.test(to)) return "range_invalid";
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return "range_invalid";
  return (b - a) / 86_400_000 + 1 > 366 ? "range_too_long" : null;
}

/** The first and last day of the month before `now`, as YYYY-MM-DD: what an accountant asks for. */
export function lastMonth(now = new Date()): { from: string; to: string } {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

/* ── The activity log ────────────────────────────────────────────── */

/** Every action the log records (business-roles-and-activity-contract.md), in the order the filter lists them. */
export const BUSINESS_ACTIONS = [
  "space.created",
  "space.edited",
  "space.published",
  "space.closed",
  "space.deleted",
  "price.changed",
  "offer.accepted",
  "offer.countered",
  "offer.declined",
  "offer.noted",
  "artwork.approved",
  "artwork.rejected",
  "delivered",
  "team.member_invited",
  "team.member_added",
  "team.member_removed",
  "team.role_changed",
  "business.profile_changed",
  "treasury.activated",
  "treasury.change_requested",
  "treasury.change_cancelled",
  "treasury.change_applied",
  "treasury.member_added",
] as const;

export type BusinessActionName = (typeof BUSINESS_ACTIONS)[number];

/** The message key for an action: dots and underscores become one camelCase word. */
export function actionKey(action: string): `business.action.${string}` {
  const camel = action.replace(/[._]([a-z])/g, (_, c: string) => c.toUpperCase());
  return `business.action.${camel}`;
}

/**
 * A summary's before and after, as "feePayer: sponsor → creator" lines.
 * Lists arrive as counts and billing as the names of the fields that changed,
 * never their values (the server's rule); this only lays them out.
 */
export function summaryLines(summary: unknown, max = 4): string[] {
  if (!summary || typeof summary !== "object") return [];
  const s = summary as { before?: unknown; after?: unknown };
  const before = (s.before && typeof s.before === "object" ? s.before : {}) as Record<string, unknown>;
  const after = (s.after && typeof s.after === "object" ? s.after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return keys.slice(0, max).map((k) => (k in before ? `${k}: ${show(before[k])} → ${show(after[k])}` : `${k}: ${show(after[k])}`));
}

/* ── Errors ──────────────────────────────────────────────────────── */

/**
 * The server's refusal, as words. Every code the console's calls can answer
 * with has a sentence; anything else is "Something went wrong".
 */
const ERRORS: Record<string, MessageKey> = {
  role_not_allowed: "business.error.roleNotAllowed",
  enquiry_read_only: "business.error.roleNotAllowed",
  not_found: "business.error.notFound",
  display_name_required: "business.error.displayNameRequired",
  website_invalid: "business.error.websiteInvalid",
  country_invalid: "business.error.countryInvalid",
  billing_email_invalid: "business.error.billingEmailInvalid",
  business_profile_required: "business.error.profileRequired",
  image_required: "business.error.imageType",
  image_too_large: "business.error.imageTooLarge",
  image_type_not_supported: "business.error.imageType",
  storage_unavailable: "business.error.tryLater",
  chain_unavailable: "business.error.tryLater",
  treasury_change_not_found: "business.error.changeNotFound",
  treasury_change_not_pending: "business.error.changeNotPending",
  treasury_change_pending: "business.error.changePending",
  member_address_invalid: "business.error.memberAddressInvalid",
  member_proof_expired: "business.error.memberProofExpired",
  member_proof_invalid: "business.error.memberProofInvalid",
  member_label_invalid: "business.error.memberLabelInvalid",
  hold_cannot_be_a_member: "business.error.holdCannotBeMember",
  enquiry_message_invalid: "business.error.messageInvalid",
  enquiry_closed: "business.error.enquiryClosed",
  chat_request_pending: "business.error.chatRequestPending",
  space_not_taking_enquiries: "business.error.spaceNotTaking",
  too_close_to_closing: "business.error.tooCloseToClosing",
  position_not_found: "business.error.spotGone",
  position_sold: "business.error.spotSold",
  position_reserved: "business.error.spotReserved",
  position_held: "business.error.spotHeld",
  quote_accepted: "business.error.quoteAccepted",
  bidding_in_progress: "business.error.biddingInProgress",
  quote_changed: "business.error.quoteChanged",
  quote_price_invalid: "business.error.quotePriceInvalid",
  quote_days_invalid: "business.error.quoteDaysInvalid",
  quote_note_invalid: "business.error.quoteNoteInvalid",
  quote_not_open: "business.error.quoteNotOpen",
  package_not_organised: "publicPages.sponsor.noLongerOnSale",
  no_space: "business.partner.logoNotYours",
  range_invalid: "business.error.rangeInvalid",
  range_too_long: "business.error.rangeTooLong",
  rate_limited: "business.error.rateLimited",
  RATE_LIMIT_EXCEEDED: "business.error.rateLimited",
  NETWORK: "business.error.network",
  network: "business.error.network",
  UNAUTHORIZED: "business.error.signIn",
};

export function errorKey(code: string | null | undefined, status = 0): MessageKey {
  if (code && ERRORS[code]) return ERRORS[code];
  // A 404 on a route this console calls means the backend for it is not out yet, or the thing is gone.
  if (status === 404) return "business.error.notFound";
  if (status === 403) return "business.error.roleNotAllowed";
  return "common.somethingWentWrong";
}
