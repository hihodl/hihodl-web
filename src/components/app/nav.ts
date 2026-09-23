/**
 * The product's navigation, on two levels, like the app.
 *
 * MAIN is HOLD itself — Home, Invest, Analytics, Payments, Benefits and the products
 * under it (Stays, eSIM, Spaces) — and Menu at the foot, which holds the
 * person, Settings, Security, recovery, help, the wallet and signing out.
 *
 * THE COLUMN LISTS PLACES, AND A PLACE IS SOMEWHERE HOME CANNOT ALREADY TAKE
 * YOU. Three entries failed that test and left:
 *
 *   Savings   Home's scope strip switches the whole page to that container
 *   Activity  Home draws it as a card, and its "See all" pill opens it in full
 *   Wallet    a second money screen beside the one that has every account
 *
 * All three keep their route and their place in ⌘K (MAIN_HIDDEN); none takes a
 * line in the column. Four entries is not minimalism for its own sake — it is
 * what is left once nothing is listed twice.
 *
 * A PRODUCT level replaces the column when one is open: opening Spaces (or any
 * /spaces address) swaps the sidebar to the Spaces menu, with a "Back" row at
 * its top that returns to the main menu and Home. Every product that
 * gets web screens later is one more entry in PRODUCTS with its own groups.
 *
 * Every path here is relative to the PRODUCT (`/spaces/listings`, `/wallet`),
 * which is the root on app.hihodl.xyz and `/app` elsewhere (see hrefFor).
 */

import type { ComponentType, SVGProps } from "react";

import type { ShellRole } from "@/lib/app/spaces-model";

import {
  IconAccount,
  IconActivity,
  IconAdd,
  IconBed,
  IconDeliveries,
  IconGift,
  IconHome,
  IconInsights,
  IconInspire,
  IconInvest,
  IconListings,
  IconMegaphone,
  IconMenuDots,
  IconOffers,
  IconOverview,
  IconPayments,
  IconSales,
  IconSavings,
  IconSearch,
  IconGrid,
  IconSettings,
  IconSim,
  IconTeam,
  IconCrew,
  IconWallet,
} from "./icons";

export type NavKey =
  // main
  | "home"
  | "wallet"
  | "payments"
  | "groups"
  | "savings"
  | "invest"
  | "analytics"
  | "activity"
  | "add"
  | "pay-links"
  | "menu"
  | "benefits"
  | "stays"
  | "esim"
  | "spaces"
  | "account"
  // Spaces
  | "overview"
  | "listings"
  | "offers"
  | "sales"
  | "deliveries"
  | "team"
  | "crew"
  | "inspire"
  | "insights"
  | "board"
  | "bought"
  | "spaces-settings";

export type Level = "main" | "spaces";

export interface NavItem {
  key: NavKey;
  label: string;
  /** Relative to the product: "" is Home, "/spaces" is Spaces' home. */
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Who sees it; absent means everybody. Spaces items only. */
  roles?: readonly ShellRole[];
  keywords: string;
  /** Drawn under the entry above it (Benefits' products). */
  child?: boolean;
}

export interface NavGroup {
  title: string | null;
  items: readonly NavItem[];
}

const ALL: readonly ShellRole[] = ["creator", "manager", "rep"];

/* ── Main: HOLD ───────────────────────────────────────────────────── */

export const MAIN_GROUPS: readonly NavGroup[] = [
  {
    title: null,
    items: [
      { key: "home", label: "Home", path: "", icon: IconHome, keywords: "home dashboard balance summary pockets accounts savings earn move" },
      { key: "invest", label: "Invest", path: "/invest", icon: IconInvest, keywords: "portfolio holdings tokens coins performance profit loss" },
      // Analytics has its own line, right under Invest. In the app it is the
      // round disc beside Search on Home, and the phone web draws that disc
      // too; but a wide screen has no such header, so without this line the
      // desktop had no door into it at all.
      { key: "analytics", label: "Analytics", path: "/analytics", icon: IconInsights, keywords: "spending analytics spent income cashflow net saved categories budgets month recurring subscriptions where my money goes" },
      { key: "payments", label: "Payments", path: "/payments", icon: IconPayments, keywords: "sent received requests scheduled transactions history payouts pay links chat messages" },
      { key: "benefits", label: "Benefits", path: "/benefits", icon: IconGift, keywords: "products rewards points" },
      // The app's Benefits products, in the app's order (benefits/index.tsx productTiles).
      { key: "stays", label: "Stays", path: "/travel", icon: IconBed, keywords: "travel hotels hi travel", child: true },
      { key: "esim", label: "eSIM", path: "/esim", icon: IconSim, keywords: "data roaming abroad", child: true },
      { key: "spaces", label: "Spaces", path: "/spaces", icon: IconMegaphone, keywords: "sponsors listings creator ad space", child: true },
    ],
  },
];

export const MAIN_FOOT: readonly NavItem[] = [
  {
    key: "menu",
    label: "Menu",
    path: "/menu",
    icon: IconMenuDots,
    keywords: "account profile settings security account recovery sign-in help about statements plan invite friends sign out log out",
  },
];

/**
 * Pages of the main level that the column does not list.
 *
 * The app does not list them either: Account is the avatar at the top of the
 * Menu, Settings and the rest are rows inside it, and Add money is an action
 * on the Home screen, not a place. They are here so the top bar can still name
 * them and ⌘K can still find them.
 *
 * WALLET IS HERE AND NOT IN THE COLUMN
 *
 * Next to Home it read as a second money screen, and it is not one: Home is
 * every account and what they are worth, and there is nothing on Wallet that
 * Home does not already say better. What lives there is the three things that
 * happen ONCE — making the web wallet, unlocking it, and reading the recovery
 * words — plus the withdrawal those unlock. Those belong where Security and
 * Account recovery already are, which is the Menu, not beside the balance.
 */
export const MAIN_HIDDEN: readonly NavItem[] = [
  { key: "account", label: "Account", path: "/account", icon: IconAccount, keywords: "profile photo name username email x twitter payout wallet address" },
  { key: "wallet", label: "Wallet", path: "/wallet", icon: IconWallet, keywords: "solana usdc address receive passkey recovery phrase words export balance withdraw" },
  // Savings is a SCOPE of Home, not a place: /savings opens Home on that pill.
  { key: "savings", label: "Savings", path: "/savings", icon: IconSavings, keywords: "savings pockets goals yield interest apy earn aave kamino ways to earn" },
  // Activity is Home's own card, opened in full: its "See all" pill goes here.
  { key: "activity", label: "Activity", path: "/activity", icon: IconActivity, keywords: "activity history everything that moved transactions receipts" },
  { key: "add", label: "Add money", path: "/add", icon: IconAdd, keywords: "receive crypto qr code address deposit top up add cash bank transfer" },
  // Groups are a chip on Payments, as in the app; listed here so ⌘K finds them.
  { key: "groups", label: "Groups", path: "/payments/groups", icon: IconTeam, keywords: "groups split expenses bills share costs settle up owe owed trip flatmates crew chat" },
  // The app's pay links live behind a tile on Add money, not in a menu either.
  { key: "pay-links", label: "Pay links", path: "/pay-links", icon: IconPayments, keywords: "pay link get paid by anyone from any wallet usdc invoice charge someone without hold" },
];

/* ── Spaces ───────────────────────────────────────────────────────── */

export const SPACES_GROUPS: readonly NavGroup[] = [
  {
    title: null,
    items: [
      { key: "overview", label: "Overview", path: "/spaces", icon: IconOverview, roles: ["creator", "manager"], keywords: "home kpi summary" },
      { key: "listings", label: "Listings", path: "/spaces/listings", icon: IconListings, roles: ["creator", "manager"], keywords: "my spaces services drafts live" },
      { key: "offers", label: "Offers & bids", path: "/spaces/offers", icon: IconOffers, roles: ["creator", "manager"], keywords: "inbox bids counter accept decline" },
      { key: "sales", label: "Sales", path: "/spaces/sales", icon: IconSales, roles: ["creator"], keywords: "orders money received usdc" },
      { key: "deliveries", label: "Deliveries", path: "/spaces/deliveries", icon: IconDeliveries, roles: ALL, keywords: "work artwork approve deliver due promises" },
    ],
  },
  /*
   * SPACES HAS TWO SIDES, AND ONLY ONE OF THEM HAD A MENU.
   *
   * Everything above sells. This buys — and it is not a lesser mode of the
   * same job: a brand looking for a creator and a creator running listings
   * want opposite things from the same rows.
   *
   * No `roles`, on purpose. The rest of this column is gated on being a
   * creator or sitting on somebody's team; buying a spot asks nothing of you
   * but an account, and a brand that has never listed anything is exactly who
   * these two are for.
   */
  {
    title: "Sponsor",
    items: [
      {
        key: "board",
        label: "Find a spot",
        path: "/spaces/board",
        icon: IconSearch,
        keywords: "buy sponsor book a spot brand board marketplace what creators sell advertise place my logo",
      },
      {
        key: "bought",
        label: "Your spots",
        path: "/spaces/bought",
        icon: IconGrid,
        keywords: "bought orders sponsored paid receipts artwork my sponsorships",
      },
    ],
  },
  {
    title: "Grow",
    items: [
      { key: "team", label: "Team", path: "/spaces/team", icon: IconTeam, roles: ALL, keywords: "members invite shares owed paid teams" },
      {
        key: "crew",
        label: "Crew",
        path: "/spaces/crew",
        icon: IconCrew,
        roles: ALL,
        keywords: "crew collab package together split creators featuring expenses group",
      },
      { key: "insights", label: "Insights", path: "/spaces/insights", icon: IconInsights, roles: ["creator"], keywords: "market data what sells pricing timing brands buying pitch a brand" },
      { key: "inspire", label: "Inspire", path: "/spaces/inspire", icon: IconInspire, roles: ["creator"], keywords: "templates ideas new listing" },
    ],
  },
];

/** Spaces' own settings: Creative Director, and whether a listing can be published. */
export const SPACES_FOOT: readonly NavItem[] = [
  {
    key: "spaces-settings",
    label: "Spaces settings",
    path: "/spaces/settings",
    icon: IconSettings,
    roles: ["creator"],
    keywords: "creative director run a team ready to publish x payout",
  },
];

export interface LevelNav {
  groups: readonly NavGroup[];
  foot: readonly NavItem[];
}

export const LEVELS: Record<Level, LevelNav> = {
  main: { groups: MAIN_GROUPS, foot: MAIN_FOOT },
  spaces: { groups: SPACES_GROUPS, foot: SPACES_FOOT },
};

/** Which level a product-relative path belongs to. */
export function levelOf(rel: string): Level {
  return rel === "/spaces" || rel.startsWith("/spaces/") ? "spaces" : "main";
}

/**
 * What this person may open. `team` is false for a creator who runs no team
 * and sits on nobody else's; `wallet` is the backend's rollout gate
 * (lib/wallet/enabled).
 */
export function visible(item: NavItem, role: ShellRole, team: boolean, wallet = false): boolean {
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.key === "team" && !team) return false;
  if (item.key === "wallet" && !wallet) return false;
  return true;
}

function every(level: Level): NavItem[] {
  const l = LEVELS[level];
  const hidden = level === "main" ? MAIN_HIDDEN : [];
  return [...l.groups.flatMap((g) => g.items), ...l.foot, ...hidden];
}

export function itemsFor(level: Level, role: ShellRole, team = true, wallet = false): NavItem[] {
  return every(level).filter((i) => visible(i, role, team, wallet));
}

/** The product's prefix from Spaces' base: `` on app.hihodl.xyz, `/app` elsewhere. */
export function productPrefix(spacesBase: string): string {
  return spacesBase.replace(/\/spaces$/, "");
}

/** Where an item links on this host. */
export function hrefFor(item: Pick<NavItem, "path">, spacesBase: string): string {
  return `${productPrefix(spacesBase)}${item.path}` || "/";
}

/** Which item a product-relative path belongs to. */
export function activeKey(rel: string): NavKey | null {
  const path = rel.replace(/\/+$/, "");
  if (path === "") return "home";
  if (levelOf(path) === "spaces") {
    const second = path.split("/")[2] ?? "";
    if (second === "") return "overview";
    // Back from X finishes in Spaces' settings, where the X account is checked for publishing.
    if (second === "x") return "spaces-settings";
    return every("spaces").find((i) => i.path === `/spaces/${second}`)?.key ?? null;
  }
  const first = path.split("/")[1] ?? "";
  return every("main").find((i) => i.path === `/${first}`)?.key ?? null;
}

/**
 * Pages under /wallet that are open to everybody, whatever the web wallet's
 * rollout gate says: linking a phone (/wallet/link) and Send (/wallet/send),
 * which a wallet made in the app, or no wallet yet, still needs an answer
 * from. They sit under /wallet for its strict CSP (the link can seal the
 * wallet's secret; Send can open it).
 */
export function openToAll(rel: string): boolean {
  return /^\/wallet\/(link|send)\/?$/.test(rel.replace(/\/+$/, "") || "/");
}

/** The top bar's title for a product-relative path. */
export function titleFor(rel: string): string {
  // Stays' own pages. They are sub-paths of one nav entry, so the entry's own
  // label ("Stays") would sit over a booking, a checkout and a property alike.
  if (/^\/travel\/trips\/[^/]+/.test(rel)) return "Booking";
  if (/^\/travel\/trips\/?$/.test(rel)) return "Your trips";
  if (/^\/travel\/stay\/[^/]+\/book\/?$/.test(rel)) return "Confirm and pay";
  if (/^\/travel\/stay\/[^/]+/.test(rel)) return "Stay";
  if (/^\/travel\/search\/?$/.test(rel)) return "Stays";
  if (/^\/payments\/groups\/[^/]+/.test(rel)) return "Group";
  if (/^\/payments\/groups\/?$/.test(rel)) return "Groups";
  if (/^\/spaces\/listings\/new\/?$/.test(rel)) return "New listing";
  if (/^\/spaces\/listings\/[^/]+\/edit\/?$/.test(rel)) return "Edit draft";
  if (/^\/spaces\/listings\/[^/]+/.test(rel)) return "Listing";
  if (/^\/spaces\/x\/?$/.test(rel)) return "X account";
  if (/^\/invest\/performance\/?$/.test(rel)) return "Portfolio";
  if (/^\/invest\/report\/?$/.test(rel)) return "Realised gains";
  if (/^\/invest\/cost\/[^/]+/.test(rel)) return "What you paid";
  if (/^\/wallet\/link\/?$/.test(rel)) return "Link your phone";
  if (/^\/wallet\/send\/?$/.test(rel)) return "Send";
  const key = activeKey(rel);
  const all = [...every("main"), ...every("spaces")];
  return all.find((i) => i.key === key)?.label ?? "HOLD";
}
