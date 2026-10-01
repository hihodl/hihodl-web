/**
 * npx sucrase-node src/lib/ad-space/studio.check.ts
 */

import { bioOf, effectOf, effectParam, hostOf, safeHttpsUrl, sectionsOf, titleStyleOf, titleStyleParam } from "./studio";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

eq("style known", titleStyleOf("fancy"), "fancy");
eq("style unknown is classic", titleStyleOf("gothic"), "classic");
eq("style absent is classic", titleStyleOf(undefined), "classic");
eq("effect known", effectOf("snow"), "snow");
eq("effect unknown is none", effectOf("fireworks"), "none");
eq("preview style param", titleStyleParam("literary"), "literary");
eq("preview style param junk", titleStyleParam(["fancy"]), null);
eq("preview effect param", effectParam("none"), "none");
eq("preview effect param junk", effectParam("<b>"), null);

eq("https kept", safeHttpsUrl("https://example.com/kit"), "https://example.com/kit");
eq("http dropped", safeHttpsUrl("http://example.com"), null);
eq("javascript dropped", safeHttpsUrl("javascript:alert(1)"), null);
eq("credentials dropped", safeHttpsUrl("https://a:b@example.com"), null);
eq("host without www", hostOf("https://www.example.com/a"), "example.com");

eq(
  "sections keep order, drop junk, audience once, https only",
  sectionsOf([
    { kind: "text", title: "About", body: "Hi" },
    { kind: "audience" },
    { kind: "link", label: "Kit", url: "javascript:alert(1)" },
    { kind: "audience" },
    { kind: "embed", html: "<script>" },
    { kind: "pastWork", items: [{ label: "A", url: "https://a.co" }, { label: "B", url: "http://b.co" }] },
    { kind: "link", label: "Kit", url: "https://kit.co" },
  ]),
  [
    { kind: "text", title: "About", body: "Hi" },
    { kind: "audience" },
    { kind: "pastWork", items: [{ label: "A", url: "https://a.co/" }] },
    { kind: "link", label: "Kit", url: "https://kit.co/" },
  ],
);
eq("sections at most six", sectionsOf(Array.from({ length: 9 }, () => ({ kind: "link", label: "x", url: "https://x.co" }))).length, 6);
eq("sections absent", sectionsOf(undefined), []);
eq("empty past work dropped", sectionsOf([{ kind: "pastWork", items: [] }]), []);

eq("bio one line", bioOf("  Builder.\n Runner. "), "Builder. Runner.");
eq("bio empty is null", bioOf("   "), null);

if (fails) {
  console.log(`\n${fails} failed`);
  process.exit(1);
}
console.log("\nall ok");
