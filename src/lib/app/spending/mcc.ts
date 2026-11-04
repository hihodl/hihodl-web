// src/lib/app/spending/mcc.ts: ported VERBATIM from the app's
// hihodl-wallet src/features/spending/mcc.ts. Change the app first, then this.
//
// ISO 18245 Merchant Category Code → HOLD spending category. This is the
// EXACT signal for card spend: the card processor (Pomelo) sends an MCC on every
// authorization. Mapping it to our taxonomy gives bank-grade categorization for
// card transactions — no keyword guessing. MCCs only exist on card spend; other
// rails fall back to counterparty-type + keyword heuristics.
//
// Ranges follow the standard MCC groupings. We map the common codes explicitly
// and cover the rest by numeric range so an unseen-but-in-range code still lands
// in a sensible bucket. Anything truly outside the known ranges returns null and
// the caller falls back to keyword inference.

import type { CategoryId } from "./categories";

// Exact high-frequency codes first (override any range).
const EXACT: Record<string, CategoryId> = {
  // Groceries / supermarkets
  "5411": "groceries", // grocery stores, supermarkets
  "5422": "groceries", // freezer/meat provisioners
  "5441": "groceries", // candy/nut/confectionery
  "5451": "groceries", // dairy
  "5462": "groceries", // bakeries
  "5499": "groceries", // misc food stores / convenience

  // Eating out
  "5812": "eating_out", // restaurants
  "5813": "eating_out", // bars, taverns, nightclubs
  "5814": "eating_out", // fast food

  // Transport / fuel
  "4111": "transport", // commuter transport, ferries
  "4121": "transport", // taxis, rideshare
  "4131": "transport", // bus lines
  "4784": "transport", // tolls, bridge fees
  "7523": "transport", // parking lots/garages
  "5541": "transport", // service stations (fuel)
  "5542": "transport", // automated fuel dispensers

  // Bills / utilities / telecom
  "4900": "bills", // utilities: electric, gas, water, sanitary
  "4814": "bills", // telecom
  "4899": "bills", // cable/satellite/pay TV
  "6513": "bills", // real estate agents / rentals (rent)
  "6300": "bills", // insurance
  "9311": "bills", // tax payments
  "9399": "bills", // government services

  // Subscriptions / digital
  "5815": "subscriptions", // digital goods media/books/apps
  "5816": "subscriptions", // digital goods games
  "5817": "subscriptions", // digital goods applications (excl. games)
  "5818": "subscriptions", // digital goods large merchant

  // Entertainment
  "7832": "entertainment", // cinemas
  "7922": "entertainment", // theatrical / ticket agencies
  "7929": "entertainment", // bands, orchestras
  "7994": "entertainment", // video game arcades
  "7996": "entertainment", // amusement parks
  "7998": "entertainment", // aquariums, zoos
  "7999": "entertainment", // recreation services

  // Travel
  "3000": "travel", // airlines (3000–3299 range handled below too)
  "4511": "travel", // airlines, air carriers
  "4722": "travel", // travel agencies
  "7011": "travel", // hotels, lodging
  "4411": "travel", // cruise lines

  // Health
  "5912": "health", // drug stores / pharmacies
  "8011": "health", // doctors
  "8021": "health", // dentists
  "8062": "health", // hospitals
  "8099": "health", // health practitioners
  "7997": "health", // gyms / country clubs / membership
  "7298": "health", // health & beauty spas

  // Shopping / retail
  "5311": "shopping", // department stores
  "5310": "shopping", // discount stores
  "5399": "shopping", // misc general merchandise
  "5651": "shopping", // family clothing
  "5661": "shopping", // shoe stores
  "5691": "shopping", // men's & women's clothing
  "5732": "shopping", // electronics stores
  "5733": "shopping", // music instrument stores
  "5734": "shopping", // computer software stores
  "5735": "shopping", // record stores
  "5942": "shopping", // book stores
  "5999": "shopping", // misc retail
};

/** [inclusiveLow, inclusiveHigh, category] — checked after EXACT misses. */
const RANGES: Array<[number, number, CategoryId]> = [
  [3000, 3299, "travel"], // airlines (carrier-specific codes)
  [3300, 3499, "travel"], // car rental
  [3500, 3999, "travel"], // lodging (hotel-specific codes)
  [4000, 4199, "transport"],
  [4400, 4599, "travel"],
  [4800, 4999, "bills"],
  [5300, 5399, "shopping"],
  [5400, 5499, "groceries"],
  [5500, 5599, "transport"], // automotive / fuel
  [5600, 5699, "shopping"], // apparel
  [5700, 5799, "shopping"], // home furnishing / electronics
  [5800, 5819, "eating_out"],
  [5900, 5999, "shopping"],
  [7000, 7099, "travel"], // lodging
  [7200, 7299, "health"], // personal services
  [7800, 7999, "entertainment"],
  [8000, 8099, "health"],
  [9300, 9399, "bills"],
];

/** Map an MCC to a spending category, or null if unknown. */
export function categoryFromMcc(mcc: string | null | undefined): CategoryId | null {
  if (!mcc) return null;
  const code = mcc.trim();
  if (!code) return null;
  const exact = EXACT[code];
  if (exact) return exact;
  const n = parseInt(code, 10);
  if (!Number.isFinite(n)) return null;
  for (const [lo, hi, cat] of RANGES) {
    if (n >= lo && n <= hi) return cat;
  }
  return null;
}
