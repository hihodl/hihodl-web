/**
 * npx sucrase-node src/lib/pay-links/og-copy.check.ts
 *
 * The link card of a pay page: who, what and how much, only what the page
 * shows, the card promised only when the link takes it, never a crypto word,
 * and the reader's language from Accept-Language.
 */

import fs from "fs";
import path from "path";

import { EN } from "../app/i18n/en";
import { formatMessage } from "../app/i18n/icu";
import { type OgCopy, payPreview, previewName, previewPrice } from "./og-copy";
import { acceptLanguageTags, payLocaleFrom } from "./pay-locales";
import type { PayLinkPublic } from "./types";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

const en = EN as Record<string, string>;
const copyOf = (d: Record<string, string>, pre: string): OgCopy => ({
  personalTitle: d[`${pre}og.personalTitle`],
  linkDescription: d[`${pre}og.linkDescription`],
  cardApplePay: d[`${pre}og.cardApplePay`],
  byCard: d[`${pre}og.byCard`],
  plain: d[`${pre}og.plain`],
  genericTitle: d[`${pre}og.genericTitle`],
});
const COPY = copyOf(en, "payPage.");
const fmt = (m: string, v?: Record<string, string>) => formatMessage(m, v, "en");

const owner = { displayName: "Demo C.", handle: "demo_creator", label: "@demo_creator", verified: true, face: null };
const base: PayLinkPublic = {
  code: "k7x2m9qa",
  title: "Dinner at Lucio",
  note: null,
  amount: { mode: "fixed", cents: 4000 },
  chains: ["solana"],
  status: "active",
  owner,
  payTo: null,
};
const personal: PayLinkPublic = { ...base, personal: true, title: "Pay @demo_creator", amount: { mode: "open", maxCents: null } };

eq("name: verified name first", previewName(owner), "Demo C.");
eq("name: handle without a name", previewName({ displayName: null, handle: "demo_creator" }), "@demo_creator");
eq("name: nobody", previewName({ displayName: " ", handle: null }), null);
eq("price whole", previewPrice(4000, "en"), "$40");
eq("price cents", previewPrice(125050, "en"), "$1,250.50");
eq("price de", previewPrice(125050, "de"), "$1.250,50");

eq("priced", payPreview(base, false, COPY, fmt, "en"), { title: "Dinner at Lucio · $40", description: "Demo C. sent you a payment request. Pay it in seconds." });
eq("open amount: no price", payPreview({ ...base, amount: { mode: "open", maxCents: 5000 } }, false, COPY, fmt, "en").title, "Dinner at Lucio");
eq("personal, card and Apple Pay", payPreview({ ...personal, methods: [{ kind: "card" }, { kind: "apple_pay" }, { kind: "hold" }] }, true, COPY, fmt, "en"), {
  title: "Pay Demo C. in a minute",
  description: "Card or Apple Pay. Done in seconds.",
});
eq("personal, card only", payPreview({ ...personal, methods: [{ kind: "card" }] }, true, COPY, fmt, "en").description, "Pay by card. Done in seconds.");
eq("personal, no card: nothing promised", payPreview({ ...personal, methods: [{ kind: "hold" }, { kind: "stablecoins" }] }, true, COPY, fmt, "en").description, "Instant payments. Beautifully simple.");
eq("personal, older server: nothing promised", payPreview(personal, true, COPY, fmt, "en").description, "Instant payments. Beautifully simple.");
eq("personal flag from the server", payPreview(personal, false, COPY, fmt, "en").title, "Pay Demo C. in a minute");
const generic = { title: "Pay with HOLD", description: "Instant payments. Beautifully simple." };
eq("paid: plain card", payPreview({ ...base, status: "paid" }, false, COPY, fmt, "en"), generic);
eq("frozen: plain card", payPreview({ ...base, status: "frozen" }, false, COPY, fmt, "en"), generic);
eq("disabled: plain card", payPreview({ ...base, status: "disabled", title: null, amount: null, owner: null }, false, COPY, fmt, "en"), generic);
eq("unreachable: plain card", payPreview(null, false, COPY, fmt, "en"), generic);
eq("nobody to name: plain card", payPreview({ ...base, owner: { displayName: null, handle: null } }, false, COPY, fmt, "en"), generic);
eq("long title clipped", payPreview({ ...base, title: "x".repeat(90) }, false, COPY, fmt, "en").title.startsWith("x".repeat(59) + "…"), true);

eq("accept-language order", acceptLanguageTags("en;q=0.5, es-ES, fr;q=0.8"), ["es-ES", "fr", "en"]);
eq("accept-language q=0 dropped", acceptLanguageTags("de;q=0, *"), []);
eq("locale es", payLocaleFrom("es-ES,es;q=0.9,en;q=0.8"), "es-ES");
eq("locale ru extra", payLocaleFrom("ru-RU"), "ru");
eq("locale none", payLocaleFrom(null), "en");
eq("locale unknown", payLocaleFrom("xx-YY"), "en");

// Every language's card words: no crypto word, the name kept.
const CRYPTO = /wallet|usdc|eurc|stablecoin|crypto|cripto|blockchain|\bchain\b|solana|polygon|ethereum|token/i;
const dicts: [string, Record<string, string>, string][] = [["en", en, "payPage."]];
const DIR = path.join(__dirname, "../app/i18n/locales");
for (const code of fs.readdirSync(DIR).filter((c) => fs.statSync(path.join(DIR, c)).isDirectory())) {
  dicts.push([code, JSON.parse(fs.readFileSync(path.join(DIR, code, "payPage.json"), "utf8")), ""]);
}
for (const code of ["ru", "bn", "ur", "pl"]) {
  dicts.push([code, JSON.parse(fs.readFileSync(path.join(__dirname, "locales", `${code}.json`), "utf8")), "payPage."]);
}
for (const [code, d, pre] of dicts) {
  const c = copyOf(d, pre);
  const all = Object.values(c).concat(d[`${pre}safety`]);
  eq(`${code}: card words present`, all.every((v) => typeof v === "string" && v.length > 0), true);
  eq(`${code}: no crypto word`, all.filter((v) => CRYPTO.test(v)), []);
  eq(`${code}: names the person`, [c.personalTitle, c.linkDescription].every((v) => v.includes("{name}")), true);
}

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
