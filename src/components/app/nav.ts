/**
 * The product's navigation, on two levels, like the app.
 *
 * MAIN is HOLD itself, in the app's own order: Home, Wallet, Payments,
 * Savings, Invest, Activity, then Benefits and the products under it (Stays,
 * eSIM, Spaces), and Menu at the foot — the app's menu, which holds the
 * person, Settings, Security, recovery, help and signing out.
 * A PRODUCT level replaces the column when one is open: opening Spaces (or any
 * /spaces address) swaps the sidebar to the Spaces menu, with a "Back" row at
 * its top that returns to the main menu and the Dashboard. Every product that
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
  IconSettings,
  IconSim,
  IconTeam,
  IconWallet,
} from "./icons";

export type NavKey =
  // main
  | "home"
  | "wallet"
  | "payments"
  | "savings"
  | "invest"
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
  | "inspire"
  | "insights"
  | "spaces-settings";

export type Level = "main" | "spaces";

export interface NavItem {
  key: NavKey;
  label: string;
  /** Relative to the product: "" is the Dashboard, "/spaces" is Spaces' home. */
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
      { key: "home", label: "Home", path: "", icon: IconHome, keywords: "home dashboard balance summary pockets accounts move" },
      { key: "payments", label: "Payments", path: "/payments", icon: IconPayments, keywords: "sent received requests scheduled transactions history payouts pay links" },
      { key: "savings", label: "Savings", path: "/savings", icon: IconSavings, keywords: "pockets goals yield interest apy earn aave kamino" },
      { key: "invest", label: "Invest", path: "/invest", icon: IconInvest, keywords: "portfolio holdings tokens coins performance profit loss" },
      { key: "activity", label: "Activity", path: "/activity", icon: IconActivity, keywords: "history everything that moved transactions receipts" },
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
  { key: "add", label: "Add money", path: "/add", icon: IconAdd, keywords: "receive crypto qr code address deposit top up add cash bank transfer" },
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
  {
    title: "Grow",
    items: [
      { key: "team", label: "Team", path: "/spaces/team", icon: IconTeam, roles: ALL, keywords: "members invite shares owed paid teams" },
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

/** The top bar's title for a product-relative path. */
export function titleFor(rel: string): string {
  if (/^\/spaces\/listings\/new\/?$/.test(rel)) return "New listing";
  if (/^\/spaces\/listings\/[^/]+\/edit\/?$/.test(rel)) return "Edit draft";
  if (/^\/spaces\/listings\/[^/]+/.test(rel)) return "Listing";
  if (/^\/spaces\/x\/?$/.test(rel)) return "X account";
  const key = activeKey(rel);
  const all = [...every("main"), ...every("spaces")];
  return all.find((i) => i.key === key)?.label ?? "HOLD";
}
