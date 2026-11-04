/**
 * npx sucrase-node src/lib/app/business-rules.check.ts
 *
 * The business console's rules: who sees which tab, money from base units,
 * prices typed into a box, the CSV range, the countdown, the action names
 * and that every code the console can be refused with has words.
 */

import * as R from "./business-rules";
import { NAMESPACES } from "./i18n/en";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) {
    fails++;
    console.log("FAIL", name, ja, "!=", jb);
  } else console.log("ok  ", name);
}

// tabs per role
eq("owner sees every tab", R.tabsFor("owner"), ["profile", "treasury", "inbox", "events", "sales", "activity", "team"]);
eq("manager without the owner's id: inbox only", R.tabsFor("manager"), ["inbox"]);
eq("manager acting for a business: inbox, events and activity", R.tabsFor("manager", { actingForOther: true }), ["inbox", "events", "activity"]);
eq("rep: inbox only, even acting for a business", R.tabsFor("rep", { actingForOther: true }), ["inbox"]);
eq("guardian opens treasury from a push", R.tabsFor("rep", { guardianChange: true }), ["treasury", "inbox"]);
eq("pickTab falls back to the first", R.pickTab("sales", R.tabsFor("rep")), "inbox");
eq("pickTab keeps an allowed tab", R.pickTab("activity", R.tabsFor("owner")), "activity");
eq("can: rep cannot quote", R.can("rep", "enquiry.quote"), false);
eq("can: manager can archive", R.can("manager", "enquiry.archive"), true);
eq("can: invoices are the owner's", [R.can("owner", "invoices"), R.can("manager", "invoices")], [true, false]);
eq("can: treasury is the owner's", R.can("manager", "treasury.manage"), false);

// money
eq("usdc base units", R.usdcFromBase("1234567890"), "1,234.56");
eq("usdc zero", R.usdcFromBase("0"), "0.00");
eq("usdc sub-cent", R.usdcFromBase("9999"), "0.00");
eq("usdc huge stays exact", R.usdcFromBase("123456789012345678"), "123,456,789,012.34");
eq("usdc null", R.usdcFromBase(null), null);
eq("usdc junk", R.usdcFromBase("12.5"), null);
eq("price whole", R.centsFromInput("1500"), 150000);
eq("price commas and dollar", R.centsFromInput("$1,500.5"), 150050);
eq("price two decimals", R.centsFromInput("25.05"), 2505);
eq("price three decimals refused", R.centsFromInput("1.005"), null);
eq("price zero refused", R.centsFromInput("0"), null);
eq("price words refused", R.centsFromInput("ten"), null);

// time
const now = Date.parse("2026-10-05T12:00:00Z");
eq("72h left", R.timeLeft("2026-10-08T12:00:00Z", now), { days: 3, hours: 0, minutes: 1 });
eq("1d 2h 30m left", R.timeLeft("2026-10-06T14:30:00Z", now), { days: 1, hours: 2, minutes: 30 });
eq("past is null", R.timeLeft("2026-10-05T11:00:00Z", now), null);
eq("junk is null", R.timeLeft("soon", now), null);

// csv range
eq("range ok", R.csvRangeProblem("2026-09-01", "2026-09-30"), null);
eq("range one day", R.csvRangeProblem("2026-09-01", "2026-09-01"), null);
eq("range backwards", R.csvRangeProblem("2026-09-30", "2026-09-01"), "range_invalid");
eq("range 366 days ok", R.csvRangeProblem("2024-01-01", "2024-12-31"), null);
eq("range 367 days too long", R.csvRangeProblem("2025-01-01", "2026-01-02"), "range_too_long");
eq("range bad format", R.csvRangeProblem("1/9/2026", "2026-09-30"), "range_invalid");
eq("last month from October", R.lastMonth(new Date("2026-10-05T12:00:00Z")), { from: "2026-09-01", to: "2026-09-30" });
eq("last month from January", R.lastMonth(new Date("2026-01-15T12:00:00Z")), { from: "2025-12-01", to: "2025-12-31" });

// actions and summaries
eq("action key dots", R.actionKey("space.created"), "business.action.spaceCreated");
eq("action key underscores", R.actionKey("team.member_invited"), "business.action.teamMemberInvited");
const en = NAMESPACES.business as Record<string, string>;
const missing = R.BUSINESS_ACTIONS.filter((a) => !(R.actionKey(a).replace(/^business\./, "") in en));
eq("every action has words", missing, []);
eq("summary before and after", R.summaryLines({ before: { feePayer: "sponsor" }, after: { feePayer: "creator" } }), ["feePayer: sponsor → creator"]);
eq("summary after only", R.summaryLines({ after: { positions: 3 } }), ["positions: 3"]);
eq("summary junk", R.summaryLines("nope"), []);

// errors
eq("role refusal has words", R.errorKey("role_not_allowed", 403), "business.error.roleNotAllowed");
eq("rep read only says role", R.errorKey("enquiry_read_only", 403), "business.error.roleNotAllowed");
eq("unknown 404", R.errorKey("HTTP_404", 404), "business.error.notFound");
eq("unknown 500", R.errorKey("HTTP_500", 500), "common.somethingWentWrong");
const badKeys = Object.values(
  Object.fromEntries(
    ["role_not_allowed", "website_invalid", "treasury_change_pending", "member_proof_expired", "quote_price_invalid", "range_too_long", "position_sold"].map((c) => [c, R.errorKey(c)]),
  ),
).filter((k) => !(k.replace(/^business\./, "") in en));
eq("every error key exists", badKeys, []);

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
