/**
 * The product's navigation, module by module.
 *
 * Spaces is the first module. The next one (Stays) is another entry in
 * MODULES with its own base and items; the shell draws whatever is here.
 */

import type { ComponentType, SVGProps } from "react";

import type { ShellRole } from "@/lib/app/spaces-model";

import {
  IconAccount,
  IconDeliveries,
  IconInspire,
  IconListings,
  IconOffers,
  IconOverview,
  IconSales,
  IconSettings,
  IconTeam,
  IconWallet,
} from "./icons";

export type NavKey =
  | "overview"
  | "listings"
  | "offers"
  | "sales"
  | "deliveries"
  | "team"
  | "inspire"
  | "account"
  | "settings"
  | "wallet";

export interface NavItem {
  key: NavKey;
  label: string;
  /** Relative to the module's base: "" is the module's home. */
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  roles: readonly ShellRole[];
  keywords: string;
  /**
   * A page of another module, whose path is relative to the PRODUCT (`/wallet`)
   * rather than to Spaces' base (see hrefFor).
   */
  module?: "wallet";
}

export interface NavGroup {
  /** The first group has none: the sidebar's header already says "Spaces". */
  title: string | null;
  items: readonly NavItem[];
}

const ALL: readonly ShellRole[] = ["creator", "manager", "rep"];

export const SPACES_GROUPS: readonly NavGroup[] = [
  {
    title: null,
    items: [
      { key: "overview", label: "Overview", path: "", icon: IconOverview, roles: ["creator", "manager"], keywords: "home kpi summary" },
      { key: "listings", label: "Listings", path: "/listings", icon: IconListings, roles: ["creator", "manager"], keywords: "my spaces services drafts live" },
      { key: "offers", label: "Offers & bids", path: "/offers", icon: IconOffers, roles: ["creator", "manager"], keywords: "inbox bids counter accept decline" },
      { key: "sales", label: "Sales", path: "/sales", icon: IconSales, roles: ["creator"], keywords: "orders money received usdc" },
      { key: "deliveries", label: "Deliveries", path: "/deliveries", icon: IconDeliveries, roles: ALL, keywords: "work artwork approve deliver due promises" },
    ],
  },
  {
    title: "Grow",
    items: [
      { key: "team", label: "Team", path: "/team", icon: IconTeam, roles: ALL, keywords: "members invite shares owed paid teams" },
      { key: "inspire", label: "Inspire", path: "/inspire", icon: IconInspire, roles: ["creator"], keywords: "templates ideas new listing" },
    ],
  },
];

/**
 * The wallet: a module of its own (routes under src/app/app/wallet), drawn in
 * the same shell. Everybody signed in can have one.
 */
export const WALLET_ITEM: NavItem = {
  key: "wallet",
  label: "Wallet",
  path: "/wallet",
  icon: IconWallet,
  roles: ALL,
  keywords: "solana usdc address receive passkey recovery phrase words export balance",
  module: "wallet",
};

export const WALLET_GROUP: NavGroup = { title: "Money", items: [WALLET_ITEM] };

export const ACCOUNT_ITEM: NavItem = {
  key: "account",
  label: "Account",
  path: "/account",
  icon: IconAccount,
  roles: ["creator"],
  keywords: "x twitter payout wallet address plan creative director run a team",
};

/** The app itself: signing out, help and the legal pages, how the sidebar is drawn. Everybody has it. */
export const SETTINGS_ITEM: NavItem = {
  key: "settings",
  label: "Settings",
  path: "/settings",
  icon: IconSettings,
  roles: ALL,
  keywords: "sign out log out terms privacy support help sidebar display",
};

/** The sidebar's bottom block, in order. */
export const FOOT_ITEMS: readonly NavItem[] = [ACCOUNT_ITEM, SETTINGS_ITEM];

/**
 * What this person may open. `team` is false for a creator who runs no team
 * and sits on nobody else's: then there is no Team page at all.
 */
export function visible(item: NavItem, role: ShellRole, team: boolean): boolean {
  return item.roles.includes(role) && (item.key !== "team" || team);
}

/** Every group the sidebar draws, in order. */
export const NAV_GROUPS: readonly NavGroup[] = [...SPACES_GROUPS, WALLET_GROUP];

export function itemsFor(role: ShellRole, team = true): NavItem[] {
  return [...NAV_GROUPS.flatMap((g) => g.items), ...FOOT_ITEMS].filter((i) => visible(i, role, team));
}

/**
 * Where an item links on this host. Spaces items hang off Spaces' base
 * (`/spaces` or `/app/spaces`); another module's hang off the product's own
 * prefix (`` or `/app`), which is that base without its `/spaces`.
 */
export function hrefFor(item: NavItem, spacesBase: string): string {
  if (item.module) return `${spacesBase.replace(/\/spaces$/, "")}${item.path}`;
  return `${spacesBase}${item.path}`;
}

/** Which item a path (relative to the base) belongs to. */
export function activeKey(rel: string): NavKey | null {
  if (rel === "" || rel === "/") return "overview";
  const first = rel.split("/")[1] ?? "";
  const all = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOT_ITEMS];
  if (first === "x") return "account";
  return all.find((i) => i.path === `/${first}`)?.key ?? null;
}

/** The top bar's title for a path. */
export function titleFor(rel: string): string {
  if (/^\/listings\/new\/?$/.test(rel)) return "New listing";
  if (/^\/listings\/[^/]+\/edit\/?$/.test(rel)) return "Edit draft";
  if (/^\/listings\/[^/]+/.test(rel)) return "Listing";
  if (/^\/x\/?$/.test(rel)) return "X account";
  const key = activeKey(rel);
  const all = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOT_ITEMS];
  return all.find((i) => i.key === key)?.label ?? "Spaces";
}
