import * as I from "./group-insights";
let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) { fails++; console.log("FAIL", name, ja, "!=", jb); } else console.log("ok  ", name);
}
// The contract's own example, §10.5.
const full = I.normaliseGroupStats({
  currency: "EUR", from: "2025-10", to: "2026-09", totalMinor: "123400", expenseCount: 31,
  byMonth: [{ month: "2026-09", totalMinor: "40000", count: 9, yourShareMinor: "10000" }, { month: "2026-08", totalMinor: "50000", count: 3, yourShareMinor: "1" }],
  byCategory: [{ category: "food", totalMinor: "30000", count: 12 }, { category: "spa", totalMinor: "5", count: 1 }, { category: "other", totalMinor: "10", count: 2 }, { category: "stay", totalMinor: "90000", count: 1 }],
  byMember: [{ userId: "a", paidMinor: "60000", shareMinor: "30000", settledOutMinor: "0", settledInMinor: "5000", netMinor: "25000" }],
  you: { paidMinor: "60000", shareMinor: "30000", netMinor: "25000", withEach: [{ userId: "b", netMinor: "1500" }, { userId: "c", netMinor: "-700" }, { userId: "d", netMinor: "0" }, { userId: "e", netMinor: "4000" }] },
  plan: [{ fromUserId: "b", toUserId: "a", amountMinor: "1500" }, { fromUserId: "x", toUserId: "a", amountMinor: "0" }],
  topExpenses: [{ expenseId: "e1", description: "Hotel", groupMinor: "21000", spentAt: "2026-08-02T12:00:00Z", payerUserId: "a", category: "stay" }],
  averagePerPersonMinor: "30850", biggestMonth: "2026-08",
});
eq("months oldest first", full.byMonth.map((m) => m.month), ["2026-08", "2026-09"]);
eq("categories biggest first, unknown folds into other", full.byCategory.map((c) => [c.category, c.totalMinor, c.count]), [["stay", "90000", 1], ["food", "30000", 12], ["other", "15", 3]]);
eq("plan drops zero", full.plan.length, 1);
eq("top expense category", full.topExpenses[0].category, "stay");
// An older server, or a half-built one: nothing crashes, everything is zero.
const empty = I.normaliseGroupStats({}, "GBP");
eq("empty answer", [empty.currency, empty.totalMinor, empty.expenseCount, empty.byMonth.length, empty.you.withEach.length, empty.biggestMonth], ["GBP", "0", 0, 0, 0, null]);
eq("junk answer", I.normaliseGroupStats(null).totalMinor, "0");
eq("number money accepted", I.normaliseGroupStats({ totalMinor: 1250 }).totalMinor, "1250");
eq("float money refused", I.normaliseGroupStats({ totalMinor: 12.5 }).totalMinor, "0");
// You card
const p = I.pairLines(full.you.withEach);
eq("pairs", [p.owesYou.map((x) => x.userId), p.youOwe.map((x) => [x.userId, x.minor]), p.owed, p.owe], [["e", "b"], [["c", "700"]], "5500", "700"]);
// Bars
eq("fractions", I.fractions(["0", "50", "100", "-5"]), [0, 0.5, 1, 0]);
eq("fractions all zero", I.fractions(["0", "0"]), [0, 0]);
eq("month label", [I.monthLabel("2026-09"), I.monthLabel("2026-01", true), I.monthLabel("bad")], ["Sep", "Jan 2026", "bad"]);
eq("last 12 months", I.lastMonths(12, new Date(Date.UTC(2026, 8, 24))), { from: "2025-10", to: "2026-09" });
eq("last 3 months over a year end", I.lastMonths(3, new Date(Date.UTC(2026, 0, 5))), { from: "2025-11", to: "2026-01" });
eq("labels up to 6: all", [...I.labelledMonths(4)].sort(), [0, 1, 2, 3]);
eq("labels 12: every other, last kept", [...I.labelledMonths(12)].sort((a, b) => a - b), [1, 3, 5, 7, 9, 11]);
// Across groups: per currency, never summed
const all = I.normaliseAllStats({
  totals: [{ currency: "EUR", youOweMinor: "500", owedToYouMinor: "4000", yourShareMinor: "90000", paidMinor: "120000" }, { currency: "usd", youOweMinor: "1" }],
  groups: [{ groupId: "g", name: "Lisbon trip", currency: "EUR", netMinor: "3500", lastActivityAt: "2026-09-20T00:00:00Z" }],
  byMonth: [{ month: "2026-09", currency: "EUR", yourShareMinor: "10000" }, { month: "2026-09", currency: "USD", yourShareMinor: "7" }, { month: "2026-08", currency: "EUR", yourShareMinor: "5" }],
});
eq("totals per currency", all.totals.map((t) => [t.currency, t.youOweMinor, t.owedToYouMinor]), [["EUR", "500", "4000"], ["USD", "1", "0"]]);
eq("months of one currency", I.monthsOf(all.byMonth, "EUR"), [{ month: "2026-08", yourShareMinor: "5" }, { month: "2026-09", yourShareMinor: "10000" }]);
eq("all stats empty", I.normaliseAllStats(undefined), { totals: [], groups: [], byMonth: [] });
if (fails) { console.log(fails, "FAILED"); process.exit(1); } else console.log("all passed");
