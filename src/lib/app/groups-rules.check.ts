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
if (fails) { console.log(fails, "FAILED"); process.exit(1); } else console.log("all passed");
