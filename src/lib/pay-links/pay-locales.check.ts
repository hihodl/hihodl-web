/**
 * npx sucrase-node src/lib/pay-links/pay-locales.check.ts
 *
 * The pay page's languages: the browser tags they answer to, and each extra
 * language's dictionary (./locales/<code>.json) carrying exactly the keys the
 * page shows, with English's variables and tags.
 */

import fs from "fs";
import path from "path";

import { EN } from "../app/i18n/en";
import { signature } from "../app/i18n/icu";
import { EXTRA_CODES, browserPayLocale, isExtraKey, isRtl, matchPayLocale } from "./pay-locales";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

eq("tl is Filipino", matchPayLocale("tl-PH"), "fil");
eq("fil", matchPayLocale("fil"), "fil");
eq("am-ET", matchPayLocale("am-ET"), "am");
eq("ru-RU", matchPayLocale("ru-RU"), "ru");
eq("bn-BD", matchPayLocale("bn-BD"), "bn");
eq("ha-NG", matchPayLocale("ha-NG"), "ha");
eq("yo-NG", matchPayLocale("yo-NG"), "yo");
eq("ur-PK", matchPayLocale("ur-PK"), "ur");
eq("pl-PL", matchPayLocale("pl-PL"), "pl");
eq("es-MX stays Mexican", matchPayLocale("es-MX"), "es-MX");
eq("es-AR stays Argentine", matchPayLocale("es-AR"), "es-AR");
eq("ar-IQ is Arabic", matchPayLocale("ar-IQ"), "ar-AE");
eq("ar-MR is Arabic", matchPayLocale("ar-MR"), "ar-AE");
eq("first known", browserPayLocale(["xx", "yo-NG", "en"]), "yo");
eq("none", browserPayLocale(["xx"]), null);
eq("rtl ur", isRtl("ur"), true);
eq("rtl ar", isRtl("ar-AE"), true);
eq("ltr ru", isRtl("ru"), false);

const english = Object.entries(EN as Record<string, string>).filter(([k]) => isExtraKey(k));
for (const code of EXTRA_CODES) {
  const file = path.join(__dirname, "locales", `${code}.json`);
  if (!fs.existsSync(file)) {
    fails++;
    console.log(`FAIL ${code}: no dictionary`);
    continue;
  }
  const d = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;
  let bad = 0;
  for (const [k, v] of english) {
    const tr = d[k];
    if (typeof tr !== "string" || !tr) {
      bad++;
      console.log(`FAIL ${code} missing ${k}`);
    } else if (JSON.stringify(signature(tr)) !== JSON.stringify(signature(v))) {
      bad++;
      console.log(`FAIL ${code} ${k}: ${JSON.stringify(signature(tr))} != ${JSON.stringify(signature(v))}`);
    }
  }
  for (const k of Object.keys(d)) {
    if (!english.some(([e]) => e === k)) {
      bad++;
      console.log(`FAIL ${code} ${k} is not a page key`);
    }
  }
  fails += bad;
  console.log(`${bad ? "FAIL" : "ok  "} ${code}: ${english.length} keys`);
}

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
