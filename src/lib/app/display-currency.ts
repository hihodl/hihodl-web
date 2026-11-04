/**
 * The currency a stay is quoted in.
 *
 * The app quotes stays in the person's display currency (`useSettingsStore`
 * `currency`, read by `useTravel.ts` as `displayCurrency || "EUR"`), so a
 * Mexico City search is priced in pesos for somebody whose whole app is in
 * pesos. The web now has the same setting (lib/app/i18n): the account's
 * `displayCurrency`, else this browser's choice, else the browser's region
 * (`es-MX` reads as MXN, `en-GB` as GBP, any euro-area region as EUR). When
 * none of those says anything, a stay keeps the app's own fallback, EUR,
 * where every other figure falls back to US dollars.
 *
 * Only what is quoted changes. Paying is unaffected: the amount that moves is
 * the settlement intent's, in USDC, computed by the server.
 *
 * A component that quotes must re-render when the choice changes: read
 * `useDisplayCurrency()` (lib/app/i18n/react) and pass it on, or call this
 * under it.
 */

import { regionCurrency } from "./i18n/currencies";
import { getPrefs } from "./i18n/store";

export const STAYS_FALLBACK_CURRENCY = "EUR";

/** The quote currency for this person. */
export function staysCurrency(): string {
  const { currency, currencySource } = getPrefs();
  if (currencySource !== "default") return currency;
  // Before the provider has run (or outside it): the browser's region, as before.
  if (typeof navigator !== "undefined") {
    const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
    const region = regionCurrency(tags);
    if (region) return region;
  }
  return STAYS_FALLBACK_CURRENCY;
}
