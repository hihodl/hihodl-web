/**
 * npx sucrase-node src/lib/invite/card.check.ts
 *
 * A group join link's card: the group's name and how many are in it, read
 * only from the backend's answer, and nothing when the answer is not one.
 */

import { groupCardOf, invitePreview, isGroupCode, whenText } from "./card";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(a)}\n  want ${JSON.stringify(b)}`);
  } else console.log(`ok   ${name}`);
}

eq("a join code", isGroupCode("MOqG9h2HwR5b"), true);
eq("not a code", [isGroupCode("abc"), isGroupCode("a b c d e f g h"), isGroupCode(undefined)], [false, false, false]);

eq("the envelope", groupCardOf({ data: { name: " Lisbon trip ", emoji: "🏝️", memberCount: 5 } }), { name: "Lisbon trip", emoji: "🏝️", memberCount: 5, plan: null });
eq("a bare body", groupCardOf({ name: "Dinner", emoji: null, memberCount: 2 }), { name: "Dinner", emoji: null, memberCount: 2, plan: null });
eq(
  "with its plan",
  groupCardOf({ data: { name: "Lisbon", emoji: null, memberCount: 3, plan: { startsOn: "2026-10-12", endsOn: "2026-10-15", place: " Lisbon " } } })?.plan,
  { startsOn: "2026-10-12", endsOn: "2026-10-15", place: "Lisbon" },
);
eq("a plan that says nothing is none", groupCardOf({ name: "Flat", memberCount: 2, plan: { startsOn: null, endsOn: "soon", place: " " } })?.plan, null);
eq("an error is no card", groupCardOf({ success: false, error: "join_link_invalid" }), null);
eq("no name is no card", groupCardOf({ data: { name: "  ", memberCount: 3 } }), null);
eq("null is no card", groupCardOf(null), null);

eq("with an emoji", invitePreview({ name: "Lisbon trip", emoji: "🏝️", memberCount: 5, plan: null }), {
  title: "Join 🏝️ Lisbon trip on HOLD",
  description: "5 people are in this group, splitting costs. Join and pay your share from your phone.",
});
eq("one person, no emoji", invitePreview({ name: "Dinner", emoji: null, memberCount: 1, plan: null }).description.startsWith("1 person is"), true);
eq("a long name is clipped", Array.from(invitePreview({ name: "x".repeat(80), emoji: null, memberCount: 2, plan: null }).title).length, "Join ".length + 50 + " on HOLD".length);

eq("one day", whenText({ startsOn: "2026-10-22", endsOn: null }), "Thu 22 Oct");
eq("the same day twice is one day", whenText({ startsOn: "2026-10-22", endsOn: "2026-10-22" }), "Thu 22 Oct");
eq("days in one month", whenText({ startsOn: "2026-10-12", endsOn: "2026-10-15" }), "12 to 15 Oct");
eq("across two months", whenText({ startsOn: "2026-10-30", endsOn: "2026-11-02" }), "30 Oct to 2 Nov");
eq("no day", whenText({ startsOn: null, endsOn: null }), null);
eq("a plan's card", invitePreview({ name: "Dinner", emoji: "🍝", memberCount: 4, plan: { startsOn: "2026-10-22", endsOn: null, place: "Lisbon" } }), {
  title: "Join 🍝 Dinner on HOLD",
  description: "Thu 22 Oct · Lisbon. 4 people are going. Join and pay your share from your phone.",
});
eq("a place only", invitePreview({ name: "Flat", emoji: null, memberCount: 1, plan: { startsOn: null, endsOn: null, place: "Madrid" } }).description, "Madrid. 1 person is going. Join and pay your share from your phone.");

if (fails) {
  console.error(`\n${fails} failed`);
  process.exit(1);
}
console.log("\nall ok");
