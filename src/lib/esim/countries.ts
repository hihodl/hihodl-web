/**
 * Countries for the eSIM pages: the code, the name people search for, the
 * slug in the URL and the flag.
 *
 * Names come from the runtime's own country list (Intl.DisplayNames) so there
 * is no table of 250 names to keep, with a few written by hand where the
 * official name is not the one people type ("Hong Kong SAR China", "Türkiye").
 * A slug is the name in plain lowercase words, so /esim/japan, never /esim/jp;
 * /esim/jp still works and redirects there.
 */

import { flagEmoji } from "../app/event-look";

/** ISO 3166-1 alpha-2, plus XK (Kosovo). The same list the backend sweeps. */
export const COUNTRY_CODES: readonly string[] = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY " +
  "BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK " +
  "FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR " +
  "IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK " +
  "ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM " +
  "PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF " +
  "TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW"
).split(" ");

/**
 * Destinations the app does not sell, mirrored from RESTRICTED_DESTINATIONS in
 * the backend (services/connectivity/catalog.ts). Only used when the price API
 * cannot be reached, so the site never builds a page for one of them blind.
 */
export const NOT_ON_SALE: ReadonlySet<string> = new Set(["AE", "IR", "SY", "KP", "CU", "RU", "BY"]);

/** The tiles on /esim before anybody types. */
export const POPULAR: readonly string[] = ["JP", "TH", "ID", "US", "MX", "BR", "ES", "FR", "IT", "GB", "TR", "PT"];

const NAME_OVERRIDES: Readonly<Record<string, string>> = {
  CD: "DR Congo",
  CG: "Congo",
  HK: "Hong Kong",
  MM: "Myanmar",
  MO: "Macau",
  PS: "Palestine",
  TR: "Turkey",
  UM: "US Outlying Islands",
  VI: "US Virgin Islands",
};

let names: Intl.DisplayNames | null | undefined;

/** "Japan" from "JP". Falls back to the code when the runtime has no name. */
export function countryName(code: string): string {
  const cc = code.toUpperCase();
  const own = NAME_OVERRIDES[cc];
  if (own) return own;
  try {
    if (names === undefined) names = new Intl.DisplayNames(["en"], { type: "region" });
    const name = names?.of(cc);
    return name && name !== cc ? name.replace(/ & /g, " and ") : cc;
  } catch {
    return cc;
  }
}

/** "bosnia-and-herzegovina" from "BA". */
export function countrySlug(code: string): string {
  return countryName(code)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let bySlug: Map<string, string> | null = null;

/** The code behind a slug, or null when it is not one of ours. */
export function codeFromSlug(slug: string): string | null {
  if (!bySlug) bySlug = new Map(COUNTRY_CODES.map((c) => [countrySlug(c), c]));
  return bySlug.get(slug.toLowerCase()) ?? null;
}

export function countryFlag(code: string): string {
  return flagEmoji(code) ?? "";
}

export function esimPath(code: string): string {
  return `/esim/${countrySlug(code)}`;
}

/** "$3.99", "$12" for a whole number. Always USD: the API prices in USD. */
export function usd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}
