/**
 * The display currencies: the app's list, 1:1 (hihodl-wallet
 * src/constants/currencies.tsx, Kast's "Display Currency"), with the app's
 * flag country for each (constants/currencyToCountry.ts). A null country is
 * drawn as the code on a chip: metals, SDR and the pan-regional francs.
 *
 * Names are the app's English ones; the picker shows the language's own name
 * for a currency when the browser has one (Intl.DisplayNames) and searches both.
 *
 * Pure: no React, no `@/` imports.
 */

/** [ISO 4217, the app's English name]. USD first, then A to Z, as the app lists them. */
export const CURRENCIES: readonly (readonly [string, string])[] = [
  ["USD", "US Dollar"],
  ["AED", "UAE Dirham"],
  ["AFN", "Afghani"],
  ["ALL", "Lek"],
  ["AMD", "Armenian Dram"],
  ["ANG", "Netherlands Antillean Guilder"],
  ["AOA", "Kwanza"],
  ["ARS", "Argentine Peso"],
  ["AUD", "Australian Dollar"],
  ["AWG", "Aruban Florin"],
  ["AZN", "Azerbaijan Manat"],
  ["BAM", "Convertible Mark"],
  ["BBD", "Barbados Dollar"],
  ["BDT", "Taka"],
  ["BGN", "Bulgarian Lev"],
  ["BHD", "Bahraini Dinar"],
  ["BIF", "Burundi Franc"],
  ["BMD", "Bermudian Dollar"],
  ["BND", "Brunei Dollar"],
  ["BOB", "Boliviano"],
  ["BRL", "Brazilian Real"],
  ["BSD", "Bahamian Dollar"],
  ["BTN", "Ngultrum"],
  ["BWP", "Pula"],
  ["BYN", "Belarusian Ruble"],
  ["BZD", "Belize Dollar"],
  ["CAD", "Canadian Dollar"],
  ["CDF", "Congolese Franc"],
  ["CHF", "Swiss Franc"],
  ["CLF", "Unidad de Fomento"],
  ["CLP", "Chilean Peso"],
  ["CNY", "Yuan Renminbi"],
  ["COP", "Colombian Peso"],
  ["CRC", "Costa Rican Colon"],
  ["CUP", "Cuban Peso"],
  ["CVE", "Cabo Verde Escudo"],
  ["CZK", "Czech Koruna"],
  ["DJF", "Djibouti Franc"],
  ["DKK", "Danish Krone"],
  ["DOP", "Dominican Peso"],
  ["DZD", "Algerian Dinar"],
  ["EGP", "Egyptian Pound"],
  ["ERN", "Nakfa"],
  ["ETB", "Ethiopian Birr"],
  ["EUR", "Euro"],
  ["FJD", "Fiji Dollar"],
  ["FKP", "Falkland Islands Pound"],
  ["GBP", "Pound Sterling"],
  ["GEL", "Lari"],
  ["GHS", "Ghana Cedi"],
  ["GIP", "Gibraltar Pound"],
  ["GMD", "Dalasi"],
  ["GNF", "Guinean Franc"],
  ["GTQ", "Quetzal"],
  ["GYD", "Guyana Dollar"],
  ["HKD", "Hong Kong Dollar"],
  ["HNL", "Lempira"],
  ["HTG", "Gourde"],
  ["HUF", "Forint"],
  ["IDR", "Rupiah"],
  ["ILS", "New Israeli Sheqel"],
  ["INR", "Indian Rupee"],
  ["IQD", "Iraqi Dinar"],
  ["IRR", "Iranian Rial"],
  ["ISK", "Iceland Krona"],
  ["JMD", "Jamaican Dollar"],
  ["JOD", "Jordanian Dinar"],
  ["JPY", "Yen"],
  ["KES", "Kenyan Shilling"],
  ["KGS", "Som"],
  ["KHR", "Riel"],
  ["KMF", "Comorian Franc"],
  ["KPW", "North Korean Won"],
  ["KRW", "Won"],
  ["KWD", "Kuwaiti Dinar"],
  ["KYD", "Cayman Islands Dollar"],
  ["KZT", "Tenge"],
  ["LBP", "Lebanese Pound"],
  ["LKR", "Sri Lanka Rupee"],
  ["LRD", "Liberian Dollar"],
  ["LSL", "Loti"],
  ["LYD", "Libyan Dinar"],
  ["MAD", "Moroccan Dirham"],
  ["MDL", "Moldovan Leu"],
  ["MGA", "Malagasy Ariary"],
  ["MKD", "Denar"],
  ["MMK", "Kyat"],
  ["MNT", "Tugrik"],
  ["MOP", "Pataca"],
  ["MRU", "Ouguiya"],
  ["MUR", "Mauritius Rupee"],
  ["MVR", "Rufiyaa"],
  ["MWK", "Kwacha"],
  ["MXN", "Mexican Peso"],
  ["MYR", "Malaysian Ringgit"],
  ["MZN", "Mozambique Metical"],
  ["NAD", "Namibia Dollar"],
  ["NGN", "Naira"],
  ["NOK", "Norwegian Krone"],
  ["NPR", "Nepalese Rupee"],
  ["NZD", "New Zealand Dollar"],
  ["OMR", "Rial Omani"],
  ["PAB", "Balboa"],
  ["PEN", "Sol"],
  ["PGK", "Kina"],
  ["PHP", "Philippine Peso"],
  ["PKR", "Pakistan Rupee"],
  ["PLN", "Zloty"],
  ["PYG", "Guarani"],
  ["QAR", "Qatari Rial"],
  ["RON", "Romanian Leu"],
  ["RSD", "Serbian Dinar"],
  ["RUB", "Russian Ruble"],
  ["RWF", "Rwanda Franc"],
  ["SAR", "Saudi Riyal"],
  ["SBD", "Solomon Islands Dollar"],
  ["SCR", "Seychelles Rupee"],
  ["SDG", "Sudanese Pound"],
  ["SEK", "Swedish Krona"],
  ["SGD", "Singapore Dollar"],
  ["SHP", "Saint Helena Pound"],
  ["SLE", "Leone"],
  ["SLL", "Leone"],
  ["SOS", "Somali Shilling"],
  ["SRD", "Surinam Dollar"],
  ["STN", "Dobra"],
  ["SVC", "El Salvador Colon"],
  ["SYP", "Syrian Pound"],
  ["SZL", "Lilangeni"],
  ["THB", "Baht"],
  ["TJS", "Somoni"],
  ["TMT", "Turkmenistan New Manat"],
  ["TND", "Tunisian Dinar"],
  ["TOP", "Pa'anga"],
  ["TRY", "New Turkish Lira"],
  ["TTD", "Trinidad and Tobago Dollar"],
  ["TWD", "New Taiwan Dollar"],
  ["TZS", "Tanzanian Shilling"],
  ["UAH", "Hryvnia"],
  ["UGX", "Uganda Shilling"],
  ["UYU", "Peso Uruguayo"],
  ["UZS", "Uzbekistan Sum"],
  ["VES", "Bolívar Soberano"],
  ["VND", "Dong"],
  ["VUV", "Vatu"],
  ["WST", "Tala"],
  ["XAF", "CFA Franc BEAC"],
  ["XAG", "Silver"],
  ["XAU", "Gold"],
  ["XCD", "East Caribbean Dollar"],
  ["XDR", "SDR (Special Drawing Right)"],
  ["XOF", "CFA Franc BCEAO"],
  ["XPF", "CFP Franc"],
  ["YER", "Yemeni Rial"],
  ["ZAR", "Rand"],
  ["ZMW", "Zambian Kwacha"],
  ["ZWG", "Zimbabwe Gold"],
];

export const CURRENCY_CODES: readonly string[] = CURRENCIES.map(([c]) => c);

/** Currency → flag country (ISO 3166-1 alpha-2); null when it has none. */
export const CURRENCY_COUNTRY: Record<string, string | null> = {
  USD: "US", AED: "AE", AFN: "AF", ALL: "AL", AMD: "AM", ANG: "SX",
  AOA: "AO", ARS: "AR", AUD: "AU", AWG: "AW", AZN: "AZ", BAM: "BA",
  BBD: "BB", BDT: "BD", BGN: "BG", BHD: "BH", BIF: "BI", BMD: "BM",
  BND: "BN", BOB: "BO", BRL: "BR", BSD: "BS", BTN: "BT", BWP: "BW",
  BYN: "BY", BZD: "BZ", CAD: "CA", CDF: "CD", CHF: "CH", CLF: "CL",
  CLP: "CL", CNY: "CN", COP: "CO", CRC: "CR", CUP: "CU",
  CVE: "CV", CZK: "CZ", DJF: "DJ", DKK: "DK", DOP: "DO", DZD: "DZ",
  EGP: "EG", ERN: "ER", ETB: "ET", EUR: "EU", FJD: "FJ", FKP: "FK",
  GBP: "GB", GEL: "GE", GHS: "GH", GIP: "GI", GMD: "GM", GNF: "GN",
  GTQ: "GT", GYD: "GY", HKD: "HK", HNL: "HN", HTG: "HT", HUF: "HU",
  IDR: "ID", ILS: "IL", INR: "IN", IQD: "IQ", IRR: "IR", ISK: "IS",
  JMD: "JM", JOD: "JO", JPY: "JP", KES: "KE", KGS: "KG", KHR: "KH",
  KMF: "KM", KPW: "KP", KRW: "KR", KWD: "KW", KYD: "KY", KZT: "KZ",
  LBP: "LB", LKR: "LK", LRD: "LR", LSL: "LS",
  LYD: "LY", MAD: "MA", MDL: "MD", MGA: "MG", MKD: "MK", MMK: "MM",
  MNT: "MN", MOP: "MO", MRU: "MR", MUR: "MU", MVR: "MV", MWK: "MW",
  MXN: "MX", MYR: "MY", MZN: "MZ", NAD: "NA", NGN: "NG", NOK: "NO",
  NPR: "NP", NZD: "NZ", OMR: "OM", PAB: "PA", PEN: "PE", PGK: "PG",
  PHP: "PH", PKR: "PK", PLN: "PL", PYG: "PY", QAR: "QA", RON: "RO",
  RSD: "RS", RUB: "RU", RWF: "RW", SAR: "SA", SBD: "SB", SCR: "SC",
  SDG: "SD", SEK: "SE", SGD: "SG", SHP: "SH", SLE: "SL", SLL: "SL",
  SOS: "SO", SRD: "SR", STN: "ST", SVC: "SV", SYP: "SY", SZL: "SZ",
  THB: "TH", TJS: "TJ", TMT: "TM", TND: "TN", TOP: "TO", TRY: "TR",
  TTD: "TT", TWD: "TW", TZS: "TZ", UAH: "UA", UGX: "UG", UYU: "UY",
  UZS: "UZ", VES: "VE", VND: "VN", VUV: "VU", WST: "WS",
  XAF: null, XAG: null, XAU: null, XCD: null, XDR: null, XOF: null,
  XPF: null, YER: "YE", ZAR: "ZA", ZMW: "ZM", ZWG: "ZW",
};

export function isDisplayCurrency(v: unknown): v is string {
  return typeof v === "string" && CURRENCY_CODES.includes(v.toUpperCase());
}

/* ── The browser's region, as a currency ──────────────────────────── */

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

/**
 * The currency of the first browser language that NAMES a region ("es-MX" is
 * MXN, "en-GB" GBP); null when none does. A bare "en" is not read as the US:
 * that would be a guess, not something the person set.
 */
export function regionCurrency(tags: readonly string[] | null | undefined): string | null {
  for (const tag of tags ?? []) {
    if (!tag || !/[-_][A-Za-z]{2}\b/.test(tag)) continue;
    const region = regionOf(tag);
    if (region && BY_REGION[region]) return BY_REGION[region];
  }
  return null;
}
