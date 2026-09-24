// src/lib/app/spending/catalog.ts: the app's catalog resolver
// (hihodl-wallet src/features/spending/catalog.ts `getCategoryDef`) without the
// user's renames and created categories, which live in the phone's storage
// (spendingCategoryConfig.store). The web draws the built-in taxonomy.
//
// Falls back to "Other" for an id it does not know (a custom category the
// phone made), so a lookup never indexes `undefined`.

import { CATEGORIES, CATEGORY_IDS, categoryName, type CategoryDef, type CategoryId } from "./categories";

// Synthetic (non-spend) def for the internal-transfers drill-down. Not a real
// spend category — it's the "Transfers" ring in the donut — but it flows through
// the same category detail screen, so it needs a label + icon here.
const TRANSFERS_DEF: CategoryDef = {
  id: "transfers",
  label: "Transfers",
  icon: "swap-horizontal-outline",
};

export function getCategoryDef(id: string): CategoryDef {
  if (id === "transfers") return { ...TRANSFERS_DEF, label: categoryName(TRANSFERS_DEF.id) };
  const builtin = (CATEGORIES as Record<string, CategoryDef>)[id];
  const base = builtin ?? CATEGORIES.other;
  return { id: base.id, label: categoryName(base.id), icon: base.icon };
}

/** The full ordered built-in taxonomy, as the app's `useCategoryCatalog().list` with nothing customised. */
export function categoryList(): CategoryDef[] {
  return CATEGORY_IDS.map((id) => ({ ...CATEGORIES[id], label: categoryName(id) }));
}

/** Whether an id is a built-in category. */
export function isBuiltinCategory(id: string): id is CategoryId {
  return id in CATEGORIES;
}
