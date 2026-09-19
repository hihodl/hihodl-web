/**
 * The product's navigation, on two levels, like the app.
 *
 * MAIN is HOLD itself: Dashboard, Wallet, Benefits and the products under it
 * (Stays, eSIM, Spaces, in the app's order), then Account and Settings.
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
  IconBed,
  IconDeliveries,
  IconGift,
  IconHome,
  IconInsights,
  IconInspire,
  IconListings,
  IconMegaphone,
  IconOffers,
  IconOverview,
  IconSales,
  IconSettings,
  IconSim,
  IconTeam,
  IconWallet,
} from "./icons";

export type NavKey =
  // main
  | "dashboard"
  | "wallet"
  | "benefits"
  | "stays"
  | "esim"
  | "spaces"
  | "account"
  | "settings"
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
      { key: "dashboard", label: "Dashboard", path: "", icon: IconHome, keywords: "home balance summary" },
      { key: "wallet", label: "Wallet", path: "/wallet", icon: IconWallet, keywords: "solana usdc address receive passkey recovery phrase words export balance" },
      { key: "benefits", label: "Benefits", path: "/benefits", icon: IconGift, keywords: "products rewards points" },
      // The app's Benefits products, in the app's order (benefits/index.tsx productTiles).
      { key: "stays", label: "Stays", path: "/travel", icon: IconBed, keywords: "travel hotels hi travel", child: true },
      { key: "esim", label: "eSIM", path: "/esim", icon: IconSim, keywords: "data roaming abroad", child: true },
      { key: "spaces", label: "Spaces", path: "/spaces", icon: IconMegaphone, keywords: "sponsors listings creator ad space", child: true },
    ],
  },
];

export const MAIN_FOOT: readonly NavItem[] = [
  { key: "account", label: "Account", path: "/account", icon: IconAccount, keywords: "profile photo name username email x twitter payout wallet address" },
  { key: "settings", label: "Settings", path: "/settings", icon: IconSettings, keywords: "sign out log out terms privacy support help sidebar display" },
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
  return [...l.groups.flatMap((g) => g.items), ...l.foot];
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
  if (path === "") return "dashboard";
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
