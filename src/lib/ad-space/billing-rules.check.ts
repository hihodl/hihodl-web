/**
 * npx sucrase-node src/lib/ad-space/billing-rules.check.ts
 */

import { EMPTY_BILLING, billingBody, billingProblem, parseStoredBilling } from "./billing-rules";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

const acme = { ...EMPTY_BILLING, companyName: " Acme Ltd ", country: "es", taxId: "B12345678", email: "ap@acme.com" };

eq("body trims, drops empties, upper cases the country", billingBody(acme), {
  companyName: "Acme Ltd",
  country: "ES",
  taxId: "B12345678",
  email: "ap@acme.com",
});
eq("empty", billingProblem(EMPTY_BILLING), "empty");
eq("only spaces is empty", billingProblem({ ...EMPTY_BILLING, companyName: "   " }), "empty");
eq("fine", billingProblem(acme), null);
eq("one field is enough", billingProblem({ ...EMPTY_BILLING, taxId: "X1" }), null);
eq("unknown country", billingProblem({ ...acme, country: "XX" }), "country");
eq("bad email", billingProblem({ ...acme, email: "ap@acme" }), "email");
eq("too long", billingProblem({ ...acme, companyName: "a".repeat(201) }), "tooLong");

eq("stored: nothing", parseStoredBilling(null), null);
eq("stored: junk", parseStoredBilling("{nope"), null);
eq("stored: not an object", parseStoredBilling("3"), null);
eq("stored: unusable", parseStoredBilling(JSON.stringify({ country: "XX" })), null);
eq("stored: fills missing fields", parseStoredBilling(JSON.stringify({ companyName: "Acme", taxId: 5 })), {
  ...EMPTY_BILLING,
  companyName: "Acme",
});

if (fails) {
  console.log(`\n${fails} failed`);
  process.exit(1);
}
console.log("\nall ok");
