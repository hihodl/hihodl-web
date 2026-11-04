/**
 * What the account card says about whose name a virtual account is in. The
 * same decision as the app's src/lib/holderDisclosure.ts, kept pure so it can
 * be checked without a browser.
 *
 * The payer's bank matches the holder name under Verification of Payee (SEPA)
 * and Confirmation of Payee (UK). A salary sent to an account held in the
 * provider's name comes back "no match", so a pooled account is said out loud.
 *
 * `heldInYourName` comes from the backend, which reads it from the name the
 * provider actually returned; it decides whenever it is a boolean. The
 * currency list is only for when there is no answer, and it answers toward
 * warning. Bridge moved EUR into the customer's name on 2026-09-25, which is
 * why the currency alone stopped being the answer.
 */

/** Currencies a provider has issued in its own name. Fallback only. */
export const POOLED_CURRENCIES = new Set(["EUR", "GBP"]);

/**
 * Named accounts that still refuse some payers. EUR: Bridge does not accept
 * SEPA deposits from other individuals for self-serve developers; employers,
 * companies and the person's own accounts are fine.
 */
export const NAMED_BUT_NOT_FROM_INDIVIDUALS = new Set(["EUR"]);

export type HolderDisclosure = "none" | "named" | "pooled";

export function holderDisclosureFor(
  currency: string | null | undefined,
  heldInYourName: boolean | null | undefined,
): HolderDisclosure {
  const ccy = (currency ?? "").trim().toUpperCase();
  if (!ccy) return "none";
  if (heldInYourName === true) return NAMED_BUT_NOT_FROM_INDIVIDUALS.has(ccy) ? "named" : "none";
  if (heldInYourName === false) return "pooled";
  return POOLED_CURRENCIES.has(ccy) ? "pooled" : "none";
}
