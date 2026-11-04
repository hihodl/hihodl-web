/**
 * The buyer's invoice details at checkout (sale-invoices-contract.md, Buyer):
 * the rules, with no browser and no network, so the check can run them.
 *
 * Every field is optional; the server takes any non empty subset, and a field
 * left out is cleared. Country is ISO 3166 alpha-2.
 */

export interface BillingDetails {
  companyName: string;
  addressLine1: string;
  city: string;
  postcode: string;
  country: string;
  taxId: string;
  email: string;
}

export const EMPTY_BILLING: BillingDetails = {
  companyName: "",
  addressLine1: "",
  city: "",
  postcode: "",
  country: "",
  taxId: "",
  email: "",
};

/** Limits that keep a typo from reaching the server; the server has its own. */
export const BILLING_MAX: Record<keyof BillingDetails, number> = {
  companyName: 200,
  addressLine1: 200,
  city: 120,
  postcode: 32,
  country: 2,
  taxId: 64,
  email: 254,
};

/** ISO 3166-1 alpha-2, every assigned code. Names come from the reader's own language. */
export const COUNTRY_CODES: readonly string[] = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const COUNTRIES = new Set(COUNTRY_CODES);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The fields as the server takes them: trimmed, empty ones left out, the country upper case. */
export function billingBody(d: BillingDetails): Partial<BillingDetails> {
  const out: Partial<BillingDetails> = {};
  for (const k of Object.keys(EMPTY_BILLING) as (keyof BillingDetails)[]) {
    const v = (typeof d[k] === "string" ? d[k] : "").trim();
    if (v) out[k] = k === "country" ? v.toUpperCase() : v;
  }
  return out;
}

export type BillingProblem = "empty" | "country" | "email" | "tooLong";

/** What stops these details from being used, or null when they are fine. */
export function billingProblem(d: BillingDetails): BillingProblem | null {
  const body = billingBody(d);
  if (Object.keys(body).length === 0) return "empty";
  for (const [k, v] of Object.entries(body) as [keyof BillingDetails, string][]) {
    if (v.length > BILLING_MAX[k]) return "tooLong";
  }
  if (body.country && !COUNTRIES.has(body.country)) return "country";
  if (body.email && !EMAIL.test(body.email)) return "email";
  return null;
}

/** Stored details read back: anything that is not the shape, or not usable, reads as nothing. */
export function parseStoredBilling(raw: string | null): BillingDetails | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const d = { ...EMPTY_BILLING };
    for (const k of Object.keys(EMPTY_BILLING) as (keyof BillingDetails)[]) {
      const x = (v as Record<string, unknown>)[k];
      if (typeof x === "string") d[k] = x;
    }
    return billingProblem(d) ? null : d;
  } catch {
    return null;
  }
}
