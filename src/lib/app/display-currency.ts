/**
 * The currency a stay is quoted in.
 *
 * The app quotes stays in the person's display currency (`useSettingsStore`
 * `currency`, read by `useTravel.ts` as `displayCurrency || "EUR"`), so a
 * Mexico City search is priced in pesos for somebody whose whole app is in
 * pesos. That setting lives on the phone and is not sent to the server, so the
 * web cannot read it. The nearest thing the person has set is their browser's
 * region: `es-MX` reads as MXN, `en-GB` as GBP, any euro-area region as EUR.
 * A region not in the table, or no region at all, falls back to the app's own
 * fallback, EUR.
 *
 * Only what is quoted changes. Paying is unaffected: the amount that moves is
 * the settlement intent's, in USDC, computed by the server.
 */

const EURO_AREA = [
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
  "AD", "MC", "SM", "VA", "ME", "XK",
];

const BY_REGION: Record<string, string> = {
  ...Object.fromEntries(EURO_AREA.map((r) => [r, "EUR"])),
  US: "USD", PR: "USD", EC: "USD", SV: "USD", PA: "USD",
  GB: "GBP", CH: "CHF", LI: "CHF", NO: "NOK", SE: "SEK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", IS: "ISK", TR: "TRY",
  CA: "CAD", MX: "MXN", BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", UY: "UYU",
  AU: "AUD", NZ: "NZD", JP: "JPY", KR: "KRW", CN: "CNY", HK: "HKD", TW: "TWD", SG: "SGD", MY: "MYR", TH: "THB", ID: "IDR", PH: "PHP", VN: "VND", IN: "INR",
  AE: "AED", SA: "SAR", QA: "QAR", IL: "ILS", ZA: "ZAR", NG: "NGN", KE: "KES", EG: "EGP", MA: "MAD",
};

export const STAYS_FALLBACK_CURRENCY = "EUR";

/** `es-MX` → "MX"; null when the tag names no region. */
function regionOf(tag: string): string | null {
  try {
    const region = new Intl.Locale(tag).maximize().region;
    return region ? region.toUpperCase() : null;
  } catch {
    const m = tag.match(/[-_]([A-Za-z]{2})\b/);
    return m ? m[1].toUpperCase() : null;
  }
}

/** The quote currency for this browser. Pure apart from reading `navigator`. */
export function staysCurrency(): string {
  if (typeof navigator === "undefined") return STAYS_FALLBACK_CURRENCY;
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    if (!tag) continue;
    // Only a tag that NAMES a region counts: `maximize()` would read a bare
    // "en" as the US, which is a guess, not something the person set.
    if (!/[-_][A-Za-z]{2}\b/.test(tag)) continue;
    const region = regionOf(tag);
    if (region && BY_REGION[region]) return BY_REGION[region];
  }
  return STAYS_FALLBACK_CURRENCY;
}
