/**
 * npx sucrase-node src/lib/esim/countries.check.ts
 *
 * Every country has one slug, every slug leads back to its country, and the
 * names people search for are the ones in the URL.
 */

import { COUNTRY_CODES, NOT_ON_SALE, POPULAR, codeFromSlug, countryName, countrySlug, esimPath, usd } from "./countries";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

eq("250 codes, none twice", [COUNTRY_CODES.length, new Set(COUNTRY_CODES).size], [250, 250]);

const slugs = COUNTRY_CODES.map(countrySlug);
eq("every slug is unique", new Set(slugs).size, COUNTRY_CODES.length);
eq("every slug is plain lowercase words", slugs.filter((s) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)), []);
eq("every slug leads back", COUNTRY_CODES.filter((c) => codeFromSlug(countrySlug(c)) !== c), []);
eq("no slug is two letters (those redirect as codes)", slugs.filter((s) => s.length === 2), []);
eq("every code has a name", COUNTRY_CODES.filter((c) => countryName(c) === c), []);

eq("japan", esimPath("JP"), "/esim/japan");
eq("united states", esimPath("US"), "/esim/united-states");
eq("& reads and", esimPath("BA"), "/esim/bosnia-and-herzegovina");
eq("accents go", esimPath("CI"), "/esim/cote-divoire");
eq("hong kong, not the SAR", esimPath("HK"), "/esim/hong-kong");
eq("turkey, as searched", esimPath("TR"), "/esim/turkey");
eq("slug lookup ignores case", codeFromSlug("Japan"), "JP");
eq("unknown slug", codeFromSlug("atlantis"), null);

eq("popular never lists a destination not on sale", POPULAR.filter((c) => NOT_ON_SALE.has(c)), []);
eq("usd cents", usd(3.5), "$3.50");
eq("usd whole", usd(12), "$12");

if (fails) {
  console.log(`\n${fails} failed`);
  process.exit(1);
}
console.log("\nall passed");
