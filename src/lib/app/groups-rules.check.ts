import * as R from "./groups-rules";
let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  const ja = JSON.stringify(a, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  const jb = JSON.stringify(b, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  if (ja !== jb) { fails++; console.log("FAIL", name, ja, "!=", jb); } else console.log("ok  ", name);
}
const sh = (c: R.SplitCheck) => Object.fromEntries(c.shares.map((s) => [s.userId, s.shareMinor.toString()]));
// equal: remainder to payer
eq("equal 100/3 payer b", sh(R.checkSplit({ mode: "equal", totalMinor: "100", currency: "USD", payerUserId: "b", people: ["a", "b", "c"], inputs: {} })), { a: "33", b: "34", c: "33" });
eq("equal 101/3 payer out -> first by id", sh(R.checkSplit({ mode: "equal", totalMinor: "101", currency: "USD", payerUserId: "z", people: ["c", "a", "b"], inputs: {} })), { a: "35", b: "33", c: "33" });
// percent: contract example 60/40 of 4500
eq("percent 60/40", sh(R.checkSplit({ mode: "percent", totalMinor: "4500", currency: "EUR", payerUserId: "a", people: ["a", "b"], inputs: { a: "60", b: "40" } })), { a: "2700", b: "1800" });
// percent thirds of 100: 33.34/33.33/33.33
const t = R.checkSplit({ mode: "percent", totalMinor: "100", currency: "USD", payerUserId: "a", people: ["a", "b", "c"], inputs: R.evenPercents(["a", "b", "c"]) });
eq("evenPercents", R.evenPercents(["a", "b", "c"]), { a: "33.34", b: "33.33", c: "33.33" });
eq("percent thirds ok", t.ok, true);
eq("percent thirds sum", t.shares.reduce((x, s) => x + s.shareMinor, 0n), 100n);
const left = R.checkSplit({ mode: "percent", totalMinor: "100", currency: "USD", payerUserId: "a", people: ["a", "b"], inputs: { a: "50", b: "20" } });
eq("percent left", [left.ok, left.ok ? null : left.reason, left.ok ? null : left.leftBp], [false, "percent_left", 3000n]);
const over = R.checkSplit({ mode: "percent", totalMinor: "100", currency: "USD", payerUserId: "a", people: ["a", "b"], inputs: { a: "80", b: "30" } });
eq("percent over", [over.ok ? null : over.reason, over.ok ? null : over.leftBp], ["percent_over", -1000n]);
const bad = R.checkSplit({ mode: "percent", totalMinor: "100", currency: "USD", payerUserId: "a", people: ["a", "b"], inputs: { a: "50.123", b: "50" } });
eq("percent 3 decimals refused", bad.ok ? null : bad.badUserIds, ["a"]);
eq("parsePercent 100.01", R.parsePercent("100.01"), null);
eq("parsePercent 0", R.parsePercent("0"), 0n);
eq("parsePercent comma", R.parsePercent("12,5"), 1250n);
eq("bpText", [R.bpText(3333n), R.bpText(5000n), R.bpText(1250n)], ["33.33", "50", "12.5"]);
// exact
const ex = R.checkSplit({ mode: "exact", totalMinor: "4500", currency: "EUR", payerUserId: "a", people: ["a", "b"], inputs: { a: "30", b: "15" } });
eq("exact ok", [ex.ok, sh(ex)], [true, { a: "3000", b: "1500" }]);
const exl = R.checkSplit({ mode: "exact", totalMinor: "4500", currency: "EUR", payerUserId: "a", people: ["a", "b"], inputs: { a: "30", b: "" } });
eq("exact left", [exl.ok ? null : exl.reason, exl.ok ? null : exl.leftMinor], ["amount_left", 1500n]);
const exo = R.checkSplit({ mode: "exact", totalMinor: "4500", currency: "EUR", payerUserId: "a", people: ["a", "b"], inputs: { a: "30", b: "20" } });
eq("exact over", [exo.ok ? null : exo.reason, exo.ok ? null : exo.leftMinor], ["amount_over", -500n]);
const exj = R.checkSplit({ mode: "exact", totalMinor: "4500", currency: "JPY", payerUserId: "a", people: ["a"], inputs: { a: "4500.5" } });
eq("exact JPY decimals refused", exj.ok ? null : exj.reason, "bad_input");
eq("no people", R.checkSplit({ mode: "equal", totalMinor: "100", currency: "USD", payerUserId: "a", people: [], inputs: {} }).ok, false);
// bodies
eq("body equal everyone", R.splitBody({ mode: "equal", totalMinor: "1", currency: "USD", payerUserId: "a", people: ["a"], inputs: {} }, true), { mode: "equal" });
eq("body percent", R.splitBody({ mode: "percent", totalMinor: "1", currency: "USD", payerUserId: "a", people: ["a", "b"], inputs: { a: "60", b: "40.5" } }, false), { mode: "percent", percents: [{ userId: "a", percent: "60" }, { userId: "b", percent: "40.5" }] });
eq("body exact", R.splitBody({ mode: "exact", totalMinor: "1", currency: "USD", payerUserId: "a", people: ["a", "b"], inputs: { a: "12.5", b: "" } }, false), { mode: "exact", amounts: [{ userId: "a", amountMinor: "1250" }, { userId: "b", amountMinor: "0" }] });
// seen by
const reads = [{ userId: "a", lastReadAt: "2026-09-23T10:00:00.000Z" }, { userId: "b", lastReadAt: "2026-09-23T12:00:00+02:00" }, { userId: "c", lastReadAt: "2026-09-23T09:00:00Z" }];
eq("seenBy instants", R.seenBy({ userId: "a", at: "2026-09-23T10:00:00Z" }, reads), ["b"]);
eq("seenBy equal counts", R.seenBy({ userId: "c", at: "2026-09-23T10:00:00Z" }, reads), ["a", "b"]);
eq("seenLine one", R.seenLine(["b"], 2, (id) => id.toUpperCase()), "Seen by B");
eq("seenLine everyone", R.seenLine(["a", "b"], 2, (id) => id), "Seen by everyone");
eq("seenLine many", R.seenLine(["a", "b", "c", "d"], 6, (id) => id), "Seen by a, b and 2 more");
// faces
eq("face photo", R.faceOf({ avatarUrl: "https://x", avatarEmoji: "🦊" }), { kind: "photo", url: "https://x" });
eq("face emoji", R.faceOf({ avatarUrl: null, avatarEmoji: "🦊" }), { kind: "emoji", emoji: "🦊" });
eq("face private", R.faceOf({ profileVisibility: "private", displayName: "Ana" }), { kind: "hold" });
eq("face initials", R.faceOf({ displayName: "Ana Ruiz" }), { kind: "initials", text: "AR" });
// money
eq("format", [R.formatMinor("123456", "USD"), R.formatMinor("1200", "JPY"), R.formatMinor("-5", "KWD")], ["1,234.56", "1,200", "-0.005"]);
eq("minorToInput", R.minorToInput("123456", "USD"), "1234.56");
eq("parseAllowZero", [R.parseMajorAllowZero("0", "USD"), R.parseMajorAllowZero("", "USD"), R.parseMajorToMinor("0", "USD")], ["0", null, null]);
eq("todayLocal", R.todayLocal(new Date(2026, 8, 3, 23, 59)), "2026-09-03");

// shares
const shw = R.checkSplit({ mode: "shares", totalMinor: "1000", currency: "EUR", payerUserId: "a", people: ["a", "b", "c"], inputs: { a: "2", b: "1", c: "1" } });
eq("shares 2:1:1 of 10.00", [shw.ok, sh(shw)], [true, { a: "500", b: "250", c: "250" }]);
const sh3 = R.checkSplit({ mode: "shares", totalMinor: "100", currency: "USD", payerUserId: "a", people: ["a", "b", "c"], inputs: { a: "1", b: "1", c: "1" } });
eq("shares thirds: odd unit by largest remainder, lowest id", sh(sh3), { a: "34", b: "33", c: "33" });
eq("shares sum exact", sh3.shares.reduce((x, s) => x + s.shareMinor, 0n), 100n);
const shz = R.checkSplit({ mode: "shares", totalMinor: "100", currency: "USD", payerUserId: "a", people: ["a", "b"], inputs: { a: "0", b: "" } });
eq("shares all zero -> split_is_empty", shz.ok ? null : shz.reason, "all_zero");
const shb = R.checkSplit({ mode: "shares", totalMinor: "100", currency: "USD", payerUserId: "a", people: ["a", "b"], inputs: { a: "1001", b: "1.5" } });
eq("shares over 1000 or decimal refused", shb.ok ? null : shb.badUserIds, ["a", "b"]);
eq("shares zero weight keeps a 0 share", sh(R.checkSplit({ mode: "shares", totalMinor: "999", currency: "USD", payerUserId: "a", people: ["a", "b"], inputs: { a: "3", b: "0" } })), { a: "999", b: "0" });
eq("body shares", R.splitBody({ mode: "shares", totalMinor: "1", currency: "USD", payerUserId: "a", people: ["a", "b"], inputs: { a: "2", b: "" } }, false), { mode: "shares", weights: [{ userId: "a", weight: 2 }, { userId: "b", weight: 0 }] });
// the Amount tab's autofill
eq("autofill nothing typed = equal", R.autoFillAmounts(1000n, ["a", "b", "c"], {}, "b"), { a: 333n, b: 334n, c: 333n });
eq("autofill rest shared", R.autoFillAmounts(1000n, ["a", "b", "c"], { a: 400n }, "a"), { a: 400n, b: 300n, c: 300n });
eq("autofill over leaves 0", R.autoFillAmounts(1000n, ["a", "b"], { a: 1200n }, "a"), { a: 1200n, b: 0n });
// bills
const B = (currency: string, amountMinor: string, usdCents?: string | null): R.Bill => ({ key: Math.random().toString(), kind: "transfer", label: "x", amountMinor, currency, usdCents });
eq("bills one currency", R.billTotal([B("EUR", "129"), B("EUR", "1032")]), { ok: true, amountMinor: "1161", currency: "EUR", converted: false });
eq("bills mixed with dollar values", R.billTotal([B("USD", "500", "500"), B("EUR", "1000", "1080")]), { ok: true, amountMinor: "1580", currency: "USD", converted: true });
eq("bills mixed without", R.billTotal([B("USD", "500", "500"), B("EUR", "1000", null)]), { ok: false, reason: "mixed_currencies", currencies: ["USD", "EUR"] });
eq("bills none", R.billTotal([]).ok, false);
eq("decimalToMinor rounds half up", [R.decimalToMinor("12.345", "USD"), R.decimalToMinor("12.344999", "USD"), R.decimalToMinor("0.004", "USD"), R.decimalToMinor("1200.6", "JPY")], ["1235", "1234", null, "1201"]);
// the calculator
const type = (keys: string, cur = "EUR") => [...keys].reduce((e, k) => R.pressKey(e, (k === "<" ? "back" : k) as R.CalcKey, cur), "");
eq("calc digits", type("125"), "125");
eq("calc leading zero replaced", type("05"), "5");
eq("calc decimal capped", type("1.2345"), "1.23");
eq("calc point starts 0.", type(".5"), "0.5");
eq("calc one point per number", type("1..5+2.5.1"), "1.5+2.51");
eq("calc operator replaces operator", type("5+*2"), "5*2");
eq("calc no leading operator", type("+5"), "5");
eq("calc JPY has no point", type("12.5", "JPY"), "125");
eq("calc backspace", type("12<3"), "13");
eq("calc precedence", R.evaluate("2+3*4", "EUR"), 1400n);
eq("calc division rounds half up", R.evaluate("10/3", "EUR"), 333n);
eq("calc 2/3", R.evaluate("2/3", "EUR"), 67n);
eq("calc trailing operator ignored", R.evaluate("12.5+", "EUR"), 1250n);
eq("calc divide by zero", R.evaluate("5/0", "EUR"), null);
eq("calc negative refused", R.evaluate("5-8", "EUR"), null);
eq("calc = collapses", R.pressKey("12.5+7.25", "=", "EUR"), "19.75");
eq("calc = whole", R.pressKey("2*3", "=", "EUR"), "6");
eq("calc JPY", R.evaluate("1000/3", "JPY"), 333n);
eq("calc display", R.displayExpression("1234.5*2", ","), "1234,5 × 2");
eq("calc hasOperator", [R.hasOperator("12+"), R.hasOperator("12+3")], [false, true]);
// §10.3 rates: one USD is 0.92 EUR; one JPY is 0.0061 EUR
const RATES = { USD: "0.9200000000", JPY: "0.0061000000", KWD: "3.0000000000" };
eq("fx same currency", R.convertMinor("1234", "EUR", "EUR", RATES), "1234");
eq("fx USD->EUR", R.convertMinor("1000", "USD", "EUR", RATES), "920");
eq("fx JPY (0 decimals) -> EUR", R.convertMinor("1000", "JPY", "EUR", RATES), "610");
eq("fx KWD (3 decimals) -> EUR", R.convertMinor("1500", "KWD", "EUR", RATES), "450");
eq("fx half up", R.convertMinor("1", "USD", "EUR", { USD: "0.5" }), "1");
eq("fx no rate", R.convertMinor("1000", "GBP", "EUR", RATES), null);
eq("fx bad rate", R.parseRate("-1"), null);
// §10.1 several bills
const BB = (currency: string, amountMinor: string, usdCents?: string | null, kind: R.Bill["kind"] = "custom"): R.Bill => ({ key: `${currency}${amountMinor}${Math.random()}`, kind, label: "x", amountMinor, currency, usdCents, ...(kind !== "custom" ? { ref: "r1" } : {}) });
eq("bills one currency, not the group's", R.billsTotal([BB("USD", "4500"), BB("USD", "1200")], "EUR", null), { ok: true, amountMinor: "5700", currency: "USD", basis: "same", converted: ["4500", "1200"] });
const mixed = R.billsTotal([BB("EUR", "4500"), BB("USD", "1000"), BB("USD", "1")], "EUR", RATES);
eq("bills mixed via fx, one rounding", mixed, { ok: true, amountMinor: "5421", currency: "EUR", basis: "fx", converted: ["4500", "920", "1"] });
const halves = R.billsTotal([BB("USD", "1"), BB("USD", "1"), BB("EUR", "3")], "EUR", { USD: "0.5" });
eq("bills: each rounded, the last takes the unit, the sum is the total", halves.ok ? [halves.amountMinor, halves.converted] : null, ["4", ["1", "1", "2"]]);
eq("bills mixed, no rate, dollar fallback", R.billsTotal([BB("USD", "500", "500"), BB("GBP", "1000", "1270")], "EUR", {}), { ok: true, amountMinor: "1770", currency: "USD", basis: "usd", converted: ["500", "1270"] });
eq("bills mixed, no rate, no dollars: name the currency", R.billsTotal([BB("EUR", "500"), BB("GBP", "1000")], "EUR", RATES), { ok: false, reason: "mixed_currencies", currencies: ["GBP"] });
eq("items body", R.itemsBody([{ key: "k", kind: "stay", ref: "st_9", label: " Hotel ", amountMinor: "21000", currency: "usd" }, { key: "c", kind: "custom", label: "", amountMinor: "1200", currency: "EUR" }]), [
  { label: "Hotel", amountMinor: "21000", currency: "USD", sourceKind: "stay", sourceRef: "st_9" },
  { label: "Bill", amountMinor: "1200", currency: "EUR" },
]);
eq("bills title", [R.billsTitle([BB("EUR", "1")].map((b) => ({ ...b, label: "Dinner" }))), R.billsTitle(["Dinner", "Taxi"].map((l) => ({ ...BB("EUR", "1"), label: l }))), R.billsTitle(["Dinner", "Taxi", "Museum", "Bus"].map((l) => ({ ...BB("EUR", "1"), label: l }))), R.billsTitle([{ ...BB("EUR", "1"), label: "Custom bill" }])], ["Dinner", "Dinner and Taxi", "Dinner, Taxi and 2 more", null]);
// §10.2
eq("category", [R.asCategory("food"), R.asCategory("spa"), R.asCategory(null)], ["food", null, null]);
if (fails) { console.log(fails, "FAILED"); process.exit(1); } else console.log("all passed");
