/**
 * npx sucrase-node src/lib/ad-space/preview-bridge.check.ts
 */

import {
  addableKinds,
  applyPreviewPatch,
  authFailedMessage,
  editMessage,
  injectedToken,
  notOwnerMessage,
  parsePreviewUpdate,
  previewModeOf,
  readyMessage,
  updatedMessage,
} from "./preview-bridge";
import { bannerGradientParam, groundParam, reasonParam, titleParam } from "./studio";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

/* mode */
eq("site", previewModeOf({}), "public");
eq("edit without embed is the site", previewModeOf({ edit: "1" }), "public");
eq("app preview", previewModeOf({ embed: "app" }), "preview");
eq("app edit", previewModeOf({ embed: "app", edit: "1" }), "edit");
eq("edit=true is not edit", previewModeOf({ embed: "app", edit: "true" }), "preview");
eq("repeated params are not edit", previewModeOf({ embed: "app", edit: ["1", "1"] }), "preview");

/* token */
eq("jwt shape", injectedToken("aaa.bbb.ccc"), "aaa.bbb.ccc");
eq("not a jwt", injectedToken("Bearer aaa.bbb.ccc"), null);
eq("not a string", injectedToken({}), null);
eq("absent", injectedToken(undefined), null);

/* web to app */
eq("ready", JSON.parse(readyMessage()), { type: "hold-preview-ready" });
eq("updated", JSON.parse(updatedMessage()), { type: "hold-preview-updated" });
eq("auth failed", JSON.parse(authFailedMessage()), { type: "hold-preview-auth-failed" });
eq("not owner", JSON.parse(notOwnerMessage()), { type: "hold-preview-not-owner" });
eq("cover", JSON.parse(editMessage("cover")!), { type: "hold-edit", target: "cover" });
eq("title", JSON.parse(editMessage("title")!), { type: "hold-edit", target: "title" });
eq("story", JSON.parse(editMessage("story")!), { type: "hold-edit", target: "story" });
eq("brandGets", JSON.parse(editMessage("brandGets")!), { type: "hold-edit", target: "brandGets" });
eq("spots", JSON.parse(editMessage("spots")!), { type: "hold-edit", target: "spots" });
eq("section from a data attribute", JSON.parse(editMessage("section", { index: "2" })!), { type: "hold-edit", target: "section", index: 2 });
eq("section needs an index", editMessage("section"), null);
eq("section index in range", editMessage("section", { index: 6 }), null);
eq("section index whole", editMessage("section", { index: "1.5" }), null);
eq("add link", JSON.parse(editMessage("addSection", { kind: "link" })!), { type: "hold-edit", target: "addSection", kind: "link" });
eq("add needs a known kind", editMessage("addSection", { kind: "video" }), null);
eq("unknown target", editMessage("checkout"), null);

/* add chips */
eq("all four on an empty page", addableKinds([]), ["audience", "link", "text", "pastWork"]);
eq("audience once", addableKinds([{ kind: "audience" }]), ["link", "text", "pastWork"]);
const six = Array.from({ length: 6 }, () => ({ kind: "text" as const, title: "a", body: "b" }));
eq("none at six", addableKinds(six), []);

/* validators shared with the server's rules */
eq("ground preset", groundParam("night"), "night");
eq("ground hex", groundParam("#AABBCC"), "#AABBCC");
eq("ground short hex refused", groundParam("#abc"), null);
eq("gradient known", bannerGradientParam("sea"), "sea");
eq("gradient unknown", bannerGradientParam("pink"), null);
eq("title trimmed", titleParam("  Hello  "), "Hello");
eq("title too short", titleParam("Hi"), null);
eq("title too long", titleParam("x".repeat(121)), null);
eq("reason kept as typed", reasonParam(" why "), " why ");
eq("reason blank is none", reasonParam("   "), null);
eq("reason too long ignored", reasonParam("x".repeat(281)), undefined);
eq("reason not a string ignored", reasonParam(3), undefined);

/* app to web */
eq("not an update", parsePreviewUpdate(JSON.stringify({ type: "something" })), null);
eq("not json", parsePreviewUpdate("{nope"), null);
eq("an array", parsePreviewUpdate([]), null);
eq(
  "every key, valid",
  parsePreviewUpdate(
    JSON.stringify({
      type: "hold-preview-update",
      ground: "white",
      titleStyle: "fancy",
      effect: "snow",
      bannerGradient: "ember",
      sections: [{ kind: "audience" }, { kind: "link", label: "Site", url: "https://a.io" }],
      title: "  My page ",
      reason: "Because",
    }),
  ),
  {
    ground: "white",
    titleStyle: "fancy",
    effect: "snow",
    bannerGradient: "ember",
    sections: [{ kind: "audience" }, { kind: "link", label: "Site", url: "https://a.io/" }],
    title: "My page",
    reason: "Because",
  },
);
eq(
  "refused values and unknown keys are dropped",
  parsePreviewUpdate({
    type: "hold-preview-update",
    ground: "#12",
    titleStyle: "gothic",
    effect: "fireworks",
    bannerGradient: "pink",
    title: "no",
    reason: 5,
    price: 1,
    sections: [{ kind: "link", label: "x", url: "http://insecure.io" }, { kind: "audience" }, { kind: "audience" }],
  }),
  { sections: [{ kind: "audience" }] },
);
eq("ground null resets", parsePreviewUpdate({ type: "hold-preview-update", ground: null }), { ground: null });
eq("reason null clears", parsePreviewUpdate({ type: "hold-preview-update", reason: null }), { reason: null });
eq("sections capped at six", parsePreviewUpdate({ type: "hold-preview-update", sections: [...six, ...six] })!.sections!.length, 6);

const base = { title: "Old", reason: "r", bannerGradient: "steel", titleStyle: "classic", effect: "none", sections: [], pageGround: null as string | null, id: "x" };
const patched = applyPreviewPatch(base, { title: "New", ground: "night", sections: [{ kind: "audience" }] });
eq("patch applies", [patched.title, patched.pageGround, patched.sections, patched.reason, patched.id], ["New", "night", [{ kind: "audience" }], "r", "x"]);
eq("patch leaves the original alone", base.title, "Old");
eq("empty patch is the same page", applyPreviewPatch(base, {}), base);

if (fails) {
  console.log(`\n${fails} failed`);
  process.exit(1);
}
console.log("\nall ok");
