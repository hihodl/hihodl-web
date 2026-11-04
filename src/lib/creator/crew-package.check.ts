/**
 * Proof for a listing's package split and readiness (no test runner here):
 *
 *   npx sucrase-node src/lib/creator/crew-package.check.ts
 *
 * Exits 1 on the first failure.
 */

import {
  bpsFromPct,
  crewOfListing,
  defaultPackageName,
  leadKeepsBps,
  othersBps,
  packageBlockers,
  roomFor,
  shareOk,
  suggestShareBps,
  type PackageMember,
} from "./crew-package";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}

const m = (over: Partial<PackageMember> & { id: string }): PackageMember => ({
  isLead: false,
  status: "active",
  agreed: true,
  hasPayout: true,
  shareBps: 0,
  handle: null,
  name: null,
  byLink: false,
  ...over,
});

const lead = m({ id: "lead", isLead: true, shareBps: 5000, handle: "demo_creator" });
const ana = m({ id: "ana", shareBps: 3000, handle: "demo_ana" });
const cam = m({ id: "cam", shareBps: 2000, handle: "demo_cam" });

// Percent as people type it.
check("30 is 3000", bpsFromPct("30") === 3000);
check("12,5 is 1250", bpsFromPct("12,5") === 1250);
check("12.5% is 1250", bpsFromPct("12.5%") === 1250);
check("empty is null", bpsFromPct("  ") === null);
check("words are null", bpsFromPct("abc") === null);

// The lead keeps the rest.
check("others add up", othersBps([lead, ana, cam]) === 5000);
check("lead keeps what is left for someone new", leadKeepsBps(5000, 1000) === 4000);
check("changing a share leaves their own out", leadKeepsBps(5000, 4000, 3000) === 4000);
check("past 100% is negative", leadKeepsBps(5000, 6000) < 0);

// Each other member at least 1%, never past 100% together.
check("1% is taken", shareOk("1", 0) === 100);
check("0.5% is refused", shareOk("0.5", 0) === null);
check("past 100% is refused", shareOk("60", 5000) === null);
check("exactly 100% for the others is taken", shareOk("50", 5000) === 5000);
check("a change is read against the others", shareOk("40", 5000, 3000) === 4000);

// The suggestion for the next person.
check("two people start at 50%", suggestShareBps([lead]) === 5000, String(suggestShareBps([lead])));
check("four people start at 25%", suggestShareBps([m({ id: "l", isLead: true, shareBps: 5000 }), m({ id: "a", shareBps: 2500 }), m({ id: "b", shareBps: 2500 })]) === 2500);
check("never more than leaves the lead 1%", suggestShareBps([m({ id: "l", isLead: true, shareBps: 1000 }), m({ id: "a", shareBps: 9000 })]) === 900);
check("no room at all is null", suggestShareBps([m({ id: "l", isLead: true, shareBps: 50 }), m({ id: "a", shareBps: 9950 })]) === null);

// 2 to 6 people.
check("room for four more next to two", roomFor([lead, ana]) === 4);
check("no room at six", roomFor([1, 2, 3, 4, 5, 6]) === 0);

// The default name.
check("the listing title", defaultPackageName("  TOKEN2049   suitcase ") === "TOKEN2049 suitcase");
check("cut to 64", defaultPackageName("x".repeat(80)).length === 64);
check("nothing is empty", defaultPackageName(null) === "");

// Readiness.
const ready = packageBlockers([lead, ana, cam]);
check("everyone in, agreed and paid: nothing blocks", ready.length === 0);
const blocked = packageBlockers([
  lead,
  m({ id: "inv", status: "invited", agreed: false, hasPayout: false }),
  m({ id: "no", agreed: false }),
  m({ id: "pay", hasPayout: false }),
]);
check("an invitation blocks as invited", blocked.find((b) => b.memberId === "inv")?.reason === "invited");
check("a missing yes blocks", blocked.find((b) => b.memberId === "no")?.reason === "not_agreed");
check("a missing payout blocks", blocked.find((b) => b.memberId === "pay")?.reason === "no_payout");
check("one reason per member", blocked.length === 3);
check("the lead's payout never blocks", packageBlockers([m({ id: "l", isLead: true, hasPayout: false })]).length === 0);

// Which crew a listing is sold as.
const crews = [
  { id: "c1", youAreLead: false, spaces: [{ id: "s1" }] },
  { id: "c2", youAreLead: true, spaces: [{ id: "s1" }] },
];
check("only a crew you lead", crewOfListing(crews, "s1")?.id === "c2");
check("none for another listing", crewOfListing(crews, "s2") === null);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
