// src/lib/app/spending/categories.ts: ported VERBATIM from the app's
// hihodl-wallet src/features/spending/categories.ts. Change the app first, then this.
//
// The spending-category taxonomy for the day-to-day Analytics screen.
//
// Categories don't exist on the backend (no MCC / merchant tagging), so the
// whole system lives on-device: we INFER a concrete category for every spend
// (see categorize.ts) and let the user correct it, learning per-counterparty
// (see spendingCategories.store.ts). There is intentionally NO "uncategorized"
// default — every payment gets a real best-guess; `other` is the rare last
// resort for the genuinely unknowable.
//
// COLOR: per Alex's rule, the spending visual language is GREEN + WHITE (not a
// rainbow — that reads "AI/toy"). Segment colors are therefore NOT fixed per
// category; they're assigned by size-rank at render time via `rampColor()` so
// the biggest slice is the strongest green and the tail fades to white. The
// per-category `icon` is stable; the color is contextual.

import type { IonName } from "@/components/app/ion";

type IoniconName = IonName;

export type CategoryId =
  | "groceries"
  | "eating_out"
  | "transport"
  | "bills"
  | "shopping"
  | "subscriptions"
  | "health"
  | "entertainment"
  | "travel"
  | "people"
  | "other";

export interface CategoryDef {
  // Built-in categories use a CategoryId; user-created ones carry a generated
  // string id, so the def id is widened to string.
  id: string;
  label: string;
  icon: IoniconName;
}

// Order = the default display order when amounts tie (largest amount still wins
// at render time). `other` is always last.
export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  groceries: { id: "groceries", label: "Groceries", icon: "cart-outline" },
  eating_out: { id: "eating_out", label: "Eating out", icon: "restaurant-outline" },
  transport: { id: "transport", label: "Transport", icon: "car-outline" },
  bills: { id: "bills", label: "Bills", icon: "receipt-outline" },
  shopping: { id: "shopping", label: "Shopping", icon: "bag-handle-outline" },
  subscriptions: { id: "subscriptions", label: "Subscriptions", icon: "repeat-outline" },
  health: { id: "health", label: "Health", icon: "fitness-outline" },
  entertainment: { id: "entertainment", label: "Entertainment", icon: "game-controller-outline" },
  travel: { id: "travel", label: "Travel", icon: "airplane-outline" },
  people: { id: "people", label: "People", icon: "person-outline" },
  other: { id: "other", label: "Other", icon: "pricetag-outline" },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

export function categoryDef(id: CategoryId): CategoryDef {
  return CATEGORIES[id] ?? CATEGORIES.other;
}

export function categoryLabel(id: CategoryId): string {
  return categoryDef(id).label;
}

// ─── Green → white ramp ──────────────────────────────────────────────────────
// A cohesive spending palette: the strongest green is HOLD's gain-green
// (invest.up #3DDC84); subsequent ranks lighten toward green-white, then to
// translucent white for the long tail. Used by the donut segments AND the
// category-list dots so the two read as one object.
const SPENDING_RAMP = [
  "#3DDC84", // rank 0 — gain green
  "#6FE6A2", // rank 1
  "#9CEFC0", // rank 2
  "#C7F5DB", // rank 3 — pale green-white
  "rgba(255,255,255,0.82)", // rank 4
  "rgba(255,255,255,0.60)", // rank 5
  "rgba(255,255,255,0.42)", // rank 6
  "rgba(255,255,255,0.28)", // rank 7+
] as const;

/** Color for the Nth-largest spending slice (0 = biggest). Clamps to the tail. */
export function rampColor(rank: number): string {
  if (rank < 0) return SPENDING_RAMP[0];
  return SPENDING_RAMP[Math.min(rank, SPENDING_RAMP.length - 1)];
}

/** Solid green used to highlight a SELECTED slice/row (phase-2 donut tap). */
export const SPENDING_SELECTED = "#3DDC84";
