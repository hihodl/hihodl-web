/**
 * npx sucrase-node src/lib/ad-space/enquiry-rules.check.ts
 */

import {
  POLL_MAX_MS,
  POLL_MS,
  canAskAbout,
  isExpiredLink,
  isNewerThread,
  nextPollDelay,
  quoteOfMessage,
  quoteStateAt,
  quotesMoved,
} from "./enquiry-rules";

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
eq("a quote's offer_expired is not the link", isExpiredLink(409, "offer_expired"), false);
eq("enquiry_link_expired", isExpiredLink(409, "enquiry_link_expired"), true);

/* A read never wipes a newer thread */
const m = (id: string) => ({ id, createdAt: "2026-10-05T10:00:00Z" });
eq("more messages", isNewerThread({ messages: [m("1")] }, { messages: [m("1"), m("2")] }), true);
eq("fewer messages", isNewerThread({ messages: [m("1"), m("2")] }, { messages: [m("1")] }), false);
eq("same", isNewerThread({ messages: [m("1")] }, { messages: [m("1")] }), false);
eq("same count, new last", isNewerThread({ messages: [m("1")] }, { messages: [m("2")] }), true);
eq("both empty", isNewerThread({ messages: [] }, { messages: [] }), false);

/* Quotes move without a new message */
const q = (state: string, updatedAt: string, quoteId = "q1") => ({ quoteId, state, updatedAt, expiresAt: null });
const T1 = "2026-10-05T10:00:00.000Z";
const T2 = "2026-10-05T11:00:00.000Z";
eq("accepted elsewhere", isNewerThread({ messages: [m("1")], quotes: [q("open", T1)] }, { messages: [m("1")], quotes: [q("accepted", T2)] }), true);
eq("slow read never reopens", isNewerThread({ messages: [m("1")], quotes: [q("accepted", T2)] }, { messages: [m("1")], quotes: [q("open", T1)] }), false);
eq("expired on read, same version", quotesMoved([q("open", T1)], [q("expired", T1)]), true);
eq("nothing moved", quotesMoved([q("open", T1)], [q("open", T1)]), false);
eq("a new quote", quotesMoved([q("open", T1)], [q("open", T1), q("open", T2, "q2")]), true);
eq("no quotes on either side", quotesMoved([], []), false);
eq("threads without quotes", isNewerThread({ messages: [m("1")] }, { messages: [m("1")] }), false);

/* The state drawn */
const NOW = Date.parse("2026-10-05T12:00:00Z");
eq("open in time", quoteStateAt({ state: "open", expiresAt: "2026-10-06T12:00:00Z" }, NOW), "open");
eq("open past its end", quoteStateAt({ state: "open", expiresAt: "2026-10-05T11:59:59Z" }, NOW), "expired");
eq("accepted hold over", quoteStateAt({ state: "accepted", expiresAt: "2026-10-05T12:00:00Z" }, NOW), "expired");
eq("paid stays paid", quoteStateAt({ state: "paid", expiresAt: null }, NOW), "paid");
eq("before the clock is known", quoteStateAt({ state: "open", expiresAt: "2026-10-01T00:00:00Z" }, null), "open");

/* The freshest copy */
eq("from the list", quoteOfMessage({ quote: q("open", T1) }, [q("paid", T2)])?.state, "paid");
eq("own copy when unlisted", quoteOfMessage({ quote: q("open", T1) }, [])?.state, "open");
eq("no quote", quoteOfMessage({}, [q("open", T1)]), null);

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
