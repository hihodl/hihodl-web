/**
 * npx sucrase-node src/lib/app/i18n/i18n.check.ts
 *
 * 1. The message format does what the product's words need.
 * 2. Every language has every English key, no key English lacks, and the same
 *    variables and tags as English in each message.
 * 3. Spanish is Spain's: no voseo.
 */

import fs from "fs";
import path from "path";

import { NAMESPACES } from "./en";
import { formatMessage, signature, splitTags } from "./icu";
import { browserLocale, DICTIONARY_CODES, matchLocale } from "./locales";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) {
    fails++;
    console.log("FAIL", name, ja, "!=", jb);
  } else console.log("ok  ", name);
}

/* 1 ── the format */
eq("plain", formatMessage("Hello", undefined, "en"), "Hello");
eq("var", formatMessage("Hi {name}", { name: "Ana" }, "en"), "Hi Ana");
eq("missing var stays visible", formatMessage("Hi {name}", {}, "en"), "Hi {name}");
const members = "{count, plural, =0 {Nobody yet} one {# member} other {# members}}";
eq("plural =0", formatMessage(members, { count: 0 }, "en"), "Nobody yet");
eq("plural one", formatMessage(members, { count: 1 }, "en"), "1 member");
eq("plural other", formatMessage(members, { count: 1200 }, "en"), "1,200 members");
eq("plural es other", formatMessage(members, { count: 1200 }, "es-ES"), "1200 members");
eq("plural de grouping", formatMessage(members, { count: 12000 }, "de"), "12.000 members");
eq("plural ar", formatMessage("{n, plural, zero {z} one {o} two {t} few {f} many {m} other {x}}", { n: 3 }, "ar-AE"), "f");
eq("select", formatMessage("{r, select, admin {Admin} other {Member}}", { r: "admin" }, "en"), "Admin");
eq("select other", formatMessage("{r, select, admin {Admin} other {Member}}", { r: "x" }, "en"), "Member");
eq("nested", formatMessage("{n, plural, one {{who} paid # bill} other {{who} paid # bills}}", { n: 2, who: "Ana" }, "en"), "Ana paid 2 bills");
eq("lone brace kept", formatMessage("a { b", {}, "en"), "a { b");
eq("tags", splitTags("Tap <b>Pay</b> now"), [
  { tag: null, text: "Tap " },
  { tag: "b", text: "Pay" },
  { tag: null, text: " now" },
]);
eq("signature", signature("{n, plural, one {# of {x}} other {<b>#</b>}}"), ["<b>", "{n}", "{x}"].sort());
eq("match es", matchLocale("es"), "es-ES");
eq("match es-419", matchLocale("es-419"), "es-ES");
eq("match es-mx", matchLocale("es-mx"), "es-MX");
eq("match pt-PT", matchLocale("pt-PT"), "pt-BR");
eq("match zh-TW", matchLocale("zh-TW"), "zh-CN");
eq("match ar-SA", matchLocale("ar-SA"), "ar-AE");
eq("match unknown", matchLocale("pl-PL"), null);
eq("browser first known", browserLocale(["pl-PL", "de-AT", "en"]), "de");

/* 2 ── the dictionaries */
const root = path.join(__dirname, "locales");
let englishKeys = 0;
for (const messages of Object.values(NAMESPACES)) englishKeys += Object.keys(messages).length;
console.log(`English: ${englishKeys} keys in ${Object.keys(NAMESPACES).length} namespaces`);

const VOSEO = /\b(vos|tenés|podés|querés|sabés|hacés|decís|elegí|tocá|mirá|probá|escribí|agregá|confirmá|pagá|revisá|ingresá|volvé|fijate|andá)\b/i;
const LATAM = /\b(ustedes|celular|computadora|platica)\b/i;

const strict = process.argv.includes("--strict");
for (const code of DICTIONARY_CODES) {
  if (code === "en") continue;
  let missing = 0;
  let extra = 0;
  let badSig = 0;
  for (const [ns, messages] of Object.entries(NAMESPACES)) {
    const file = path.join(root, code, `${ns}.json`);
    const tr: Record<string, string> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    const en = messages as Record<string, string>;
    for (const k of Object.keys(en)) {
      const v = tr[k];
      if (typeof v !== "string" || v === "") {
        missing++;
        if (strict && missing <= 5) console.log(`  ${code} missing ${ns}.${k}`);
        continue;
      }
      if (JSON.stringify(signature(v)) !== JSON.stringify(signature(en[k]))) {
        badSig++;
        console.log(`FAIL ${code} ${ns}.${k}: ${JSON.stringify(signature(v))} != ${JSON.stringify(signature(en[k]))}`);
      }
      if (code === "es-ES" && (VOSEO.test(v) || LATAM.test(v))) {
        badSig++;
        console.log(`FAIL es-ES ${ns}.${k} is not Spain Spanish: ${v}`);
      }
    }
    for (const k of Object.keys(tr)) {
      if (!(k in en)) {
        extra++;
        console.log(`FAIL ${code} ${ns}.${k} is not an English key`);
      }
    }
  }
  if (badSig || extra) fails += badSig + extra;
  if (missing && strict) fails++;
  console.log(`${missing || badSig || extra ? (strict || badSig || extra ? "FAIL" : "note") : "ok  "} ${code}: ${englishKeys - missing}/${englishKeys} translated${badSig ? `, ${badSig} bad` : ""}${extra ? `, ${extra} stale` : ""}`);
}

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
