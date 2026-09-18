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
  IconTeam,
} from "./icons";

export type NavKey =
  | "overview"
  | "listings"
  | "offers"
  | "sales"
  | "deliveries"
  | "team"
  | "inspire"
  | "account";

export interface NavItem {
  key: NavKey;
  label: string;
  /** Relative to the module's base: "" is the module's home. */
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  roles: readonly ShellRole[];
  keywords: string;
}

export interface NavGroup {
  title: string;
  items: readonly NavItem[];
}

const ALL: readonly ShellRole[] = ["creator", "manager", "rep"];

export const SPACES_GROUPS: readonly NavGroup[] = [
  {
    title: "Spaces",
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

export const ACCOUNT_ITEM: NavItem = {
  key: "account",
  label: "Account",
  path: "/account",
  icon: IconAccount,
  roles: ["creator"],
  keywords: "x twitter payout wallet address settings",
};

export function itemsFor(role: ShellRole): NavItem[] {
  return [...SPACES_GROUPS.flatMap((g) => g.items), ACCOUNT_ITEM].filter((i) => i.roles.includes(role));
}

/** Which item a path (relative to the base) belongs to. */
export function activeKey(rel: string): NavKey | null {
  if (rel === "" || rel === "/") return "overview";
  const first = rel.split("/")[1] ?? "";
  const all = [...SPACES_GROUPS.flatMap((g) => g.items), ACCOUNT_ITEM];
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
  const all = [...SPACES_GROUPS.flatMap((g) => g.items), ACCOUNT_ITEM];
  return all.find((i) => i.key === key)?.label ?? "Spaces";
}
