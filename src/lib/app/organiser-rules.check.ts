/**
 * npx sucrase-node src/lib/app/organiser-rules.check.ts
 *
 * The organiser's rules on the web: a pasted Luma link, the sponsor link, the
 * claim pills (never red), every refusal in words, the package's last close
 * and the report link a paid order carries.
 */

import { NAMESPACES } from "./i18n/en";
import * as R from "./organiser-rules";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) {
    fails++;
    console.log("FAIL", name, ja, "!=", jb);
  } else console.log("ok  ", name);
}

// a pasted Luma link
eq("luma.com", R.lumaKeyOf("https://luma.com/breakpoint2026"), "breakpoint2026");
eq("lu.ma with a query", R.lumaKeyOf("https://lu.ma/breakpoint2026?tk=abc"), "breakpoint2026");
eq("no scheme, www", R.lumaKeyOf("www.luma.com/token2049-week"), "token2049-week");
eq("spaces around", R.lumaKeyOf("  luma.com/abc_1  "), "abc_1");
eq("not luma", R.lumaKeyOf("https://eventbrite.com/e/123"), null);
eq("empty", R.lumaKeyOf(""), null);
eq("bad characters", R.lumaKeyOf("https://luma.com/%3Cscript%3E"), null);
eq("bad escape", R.lumaKeyOf("https://luma.com/%E0%A4%A"), null);
eq("luma url back", R.lumaUrlOf("abc"), "https://luma.com/abc");
eq("sponsor link", R.sponsorLinkOf("https://hihodl.xyz/", "abc"), "https://hihodl.xyz/sponsor/abc");

// statuses and pills
eq("unknown status is pending", R.claimStatusOf("whatever"), "pending");
eq("known status kept", R.claimStatusOf("lost"), "lost");
eq("verified is green", R.claimPill("verified").tone, "good");
eq("pending waits in amber", R.claimPill("pending").tone, "caution");
eq("no pill is red", R.CLAIM_STATUSES.every((s) => ["calm", "good", "caution", "dim"].includes(R.claimPill(s).tone)), true);
eq("only pending verifies", R.CLAIM_STATUSES.filter(R.canVerify), ["pending"]);
eq("only expired restarts", R.CLAIM_STATUSES.filter(R.canRestart), ["expired"]);

// refusals
eq("code not on luma", R.claimErrorKey("code_not_on_luma", 422), "business.events.error.codeNotOnLuma");
eq("429 by status", R.claimErrorKey("HTTP_429", 429), "business.events.error.rateLimited");
eq("410 by status", R.claimErrorKey(null, 410), "business.events.error.expired");
eq("503 by status", R.claimErrorKey(null, 503), "business.events.error.lumaUnreachable");
eq("unknown", R.claimErrorKey("nope", 500), "common.somethingWentWrong");

// every key the rules name exists in English
const english = new Set<string>();
for (const [ns, dict] of Object.entries(NAMESPACES)) for (const k of Object.keys(dict)) english.add(`${ns}.${k}`);
const named = [
  ...R.CLAIM_STATUSES.map((s) => R.claimPill(s).key),
  ...[
    "luma_url_invalid",
    "luma_not_an_event",
    "event_in_the_past",
    "event_already_claimed",
    "code_not_on_luma",
    "luma_unreachable",
    "claim_expired",
    "claim_rejected",
    "claim_changed_try_again",
    "not_a_business",
    "role_not_allowed",
    "calendar_has_no_upcoming_events",
    "not_found",
    "rate_limited",
  ].map((c) => R.claimErrorKey(c, 422)),
];
eq("every key has English", named.filter((k) => !english.has(k)), []);

// a package closes by the end of the day after the event
eq("closes by", new Date(R.packageClosesByMs("2026-11-12")!).toISOString(), "2026-11-13T23:59:59.999Z");
eq("closes by, no date", R.packageClosesByMs(""), null);

// the report link
const token = "A".repeat(43);
eq("report path from the full url", R.reportPathOf(`https://hihodl.xyz/r/${token}`), `/r/${token}`);
eq("report path from a path", R.reportPathOf(`/r/${token}`), `/r/${token}`);
eq("short token is not a report", R.reportPathOf("https://hihodl.xyz/r/abc"), null);
eq("another page is not a report", R.reportPathOf(`https://hihodl.xyz/o/${token}`), null);
eq("null", R.reportPathOf(null), null);

if (fails) {
  console.log(`\n${fails} failed`);
  process.exit(1);
}
console.log("\nall passed");
