/**
 * npx sucrase-node src/lib/ad-space/enquiry-rules.check.ts
 */

import { POLL_MAX_MS, POLL_MS, canAskAbout, isExpiredLink, isNewerThread, nextPollDelay } from "./enquiry-rules";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

/* Which spots can be asked about */
eq("open", canAskAbout({ id: "a", status: "open" }, null), true);
eq("sold", canAskAbout({ id: "a", status: "sold" }, null), false);
eq("closed", canAskAbout({ id: "a", status: "closed" }, "a"), false);
eq("held by somebody else", canAskAbout({ id: "a", status: "held" }, null), false);
eq("held by another of mine", canAskAbout({ id: "a", status: "held" }, "b"), false);
eq("held by this browser", canAskAbout({ id: "a", status: "held" }, "a"), true);

/* Polling */
eq("first wait", nextPollDelay(0), POLL_MS);
eq("one failure doubles", nextPollDelay(1), POLL_MS * 2);
eq("two failures", nextPollDelay(2), POLL_MS * 4);
eq("capped", nextPollDelay(50), POLL_MAX_MS);
eq("negative is zero", nextPollDelay(-3), POLL_MS);

/* Expired links */
eq("410", isExpiredLink(410, "anything"), true);
eq("410 no code", isExpiredLink(410, null), true);
eq("code says expired", isExpiredLink(404, "enquiry_link_expired"), true);
eq("code says EXPIRED", isExpiredLink(400, "LINK_EXPIRED"), true);
eq("404 not found", isExpiredLink(404, "not_found"), false);
eq("network", isExpiredLink(0, "network"), false);

/* A read never wipes a newer thread */
const m = (id: string) => ({ id, createdAt: "2026-10-05T10:00:00Z" });
eq("more messages", isNewerThread({ messages: [m("1")] }, { messages: [m("1"), m("2")] }), true);
eq("fewer messages", isNewerThread({ messages: [m("1"), m("2")] }, { messages: [m("1")] }), false);
eq("same", isNewerThread({ messages: [m("1")] }, { messages: [m("1")] }), false);
eq("same count, new last", isNewerThread({ messages: [m("1")] }, { messages: [m("2")] }), true);
eq("both empty", isNewerThread({ messages: [] }, { messages: [] }), false);

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
