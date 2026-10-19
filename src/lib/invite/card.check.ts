/**
 * npx sucrase-node src/lib/invite/card.check.ts
 *
 * A group join link's card: the group's name and how many are in it, read
 * only from the backend's answer, and nothing when the answer is not one.
 */

import { groupCardOf, invitePreview, isGroupCode } from "./card";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(a)}\n  want ${JSON.stringify(b)}`);
  } else console.log(`ok   ${name}`);
}

eq("a join code", isGroupCode("MOqG9h2HwR5b"), true);
eq("not a code", [isGroupCode("abc"), isGroupCode("a b c d e f g h"), isGroupCode(undefined)], [false, false, false]);

eq("the envelope", groupCardOf({ data: { name: " Lisbon trip ", emoji: "🏝️", memberCount: 5 } }), { name: "Lisbon trip", emoji: "🏝️", memberCount: 5 });
eq("a bare body", groupCardOf({ name: "Dinner", emoji: null, memberCount: 2 }), { name: "Dinner", emoji: null, memberCount: 2 });
eq("an error is no card", groupCardOf({ success: false, error: "join_link_invalid" }), null);
eq("no name is no card", groupCardOf({ data: { name: "  ", memberCount: 3 } }), null);
eq("null is no card", groupCardOf(null), null);

eq("with an emoji", invitePreview({ name: "Lisbon trip", emoji: "🏝️", memberCount: 5 }), {
  title: "Join 🏝️ Lisbon trip on HOLD",
  description: "5 people are in this group, splitting costs. Join and pay your share from your phone.",
});
eq("one person, no emoji", invitePreview({ name: "Dinner", emoji: null, memberCount: 1 }).description.startsWith("1 person is"), true);
eq("a long name is clipped", Array.from(invitePreview({ name: "x".repeat(80), emoji: null, memberCount: 2 }).title).length, "Join ".length + 50 + " on HOLD".length);

if (fails) {
  console.error(`\n${fails} failed`);
  process.exit(1);
}
console.log("\nall ok");
