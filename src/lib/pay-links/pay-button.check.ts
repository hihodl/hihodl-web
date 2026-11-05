/**
 * npx sucrase-node src/lib/pay-links/pay-button.check.ts
 *
 * "Button for your site": the snippets escape what the creator wrote, only a
 * hosted HOLD pay page is a target, and public/button.js stays small, draws
 * the same pill as the <a>, and checks the same target rule.
 */

import fs from "fs";
import path from "path";
import vm from "vm";

import { BUTTON_STYLE, buttonHtml, buttonScript, buttonText, escapeHtml, isHoldPayUrl } from "./pay-button";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

eq("escape", escapeHtml(`<b>"Tom's" & co</b>`), "&lt;b&gt;&quot;Tom&#39;s&quot; &amp; co&lt;/b&gt;");
eq("text with amount", buttonText("Pay with HOLD", "$40.00"), "Pay with HOLD · $40.00");
eq("text open amount", buttonText("Dinner", null), "Dinner");
eq("text empty label", buttonText("  ", null), "Pay with HOLD");

eq("target link", isHoldPayUrl("https://hihodl.xyz/pay/k7x2m9qa"), true);
eq("target personal", isHoldPayUrl("https://hihodl.xyz/pay/@dana"), true);
eq("target checkout", isHoldPayUrl("https://hihodl.xyz/pay/c/chk_abc"), true);
eq("target other host", isHoldPayUrl("https://evil.example/pay/k7x2m9qa"), false);
eq("target lookalike host", isHoldPayUrl("https://hihodl.xyz.evil.example/pay/x"), false);
eq("target http", isHoldPayUrl("http://hihodl.xyz/pay/k7x2m9qa"), false);
eq("target other path", isHoldPayUrl("https://hihodl.xyz/app"), false);

const spec = { url: "https://hihodl.xyz/pay/k7x2m9qa", label: `Mug "XL" <3`, amount: "$12.00" };
const html = buttonHtml(spec);
eq("html one line", html.includes("\n"), false);
eq("html escapes the title", html.includes("Mug &quot;XL&quot; &lt;3 · $12.00</a>"), true);
eq("html new tab", html.startsWith(`<a href="https://hihodl.xyz/pay/k7x2m9qa" target="_blank" rel="noopener" style="`), true);
eq("html pill radius is half the height", /height:44px;.*border-radius:22px/.test(html) && !html.includes("999"), true);
const script = buttonScript(spec);
eq("script", script, `<script src="https://hihodl.xyz/button.js" data-link="https://hihodl.xyz/pay/k7x2m9qa" data-label="Mug &quot;XL&quot; &lt;3" data-amount="$12.00" async></script>`);
eq("script open amount", buttonScript({ ...spec, amount: null }).includes("data-amount"), false);

/* public/button.js */
const file = path.join(__dirname, "../../../public/button.js");
const src = fs.readFileSync(file, "utf8");
eq("button.js under 3 KB", Buffer.byteLength(src) < 3072, true);
eq("button.js draws the same pill", src.includes(`var S = "${BUTTON_STYLE}"`), true);

// Run it against a tiny fake DOM: one script tag, the button lands after it.
function runWith(link: string, ua: string) {
  const inserted: { tag: string; attrs: Record<string, string>; children: unknown[]; listeners: Record<string, (e: unknown) => void>; href?: string }[] = [];
  const opened: string[] = [];
  const el = (tag: string) => {
    const node = { tag, attrs: {} as Record<string, string>, children: [] as unknown[], listeners: {} as Record<string, (e: unknown) => void>, setAttribute(k: string, v: string) { this.attrs[k] = v; }, appendChild(c: unknown) { this.children.push(c); }, addEventListener(k: string, f: (e: unknown) => void) { this.listeners[k] = f; } };
    return node;
  };
  const script = {
    src: "https://hihodl.xyz/button.js",
    attrs: { "data-link": link, "data-label": "Pay with HOLD", "data-amount": "$40.00" } as Record<string, string>,
    getAttribute(k: string) { return this.attrs[k] ?? null; },
    setAttribute(k: string, v: string) { this.attrs[k] = v; },
    parentNode: { insertBefore(n: (typeof inserted)[number]) { inserted.push(n); } },
    nextSibling: null,
  };
  const sandbox = {
    URL,
    screen: { width: 1440, height: 900 },
    navigator: { userAgent: ua, maxTouchPoints: 0 },
    window: { screenX: 0, screenY: 0, outerWidth: 1440, outerHeight: 900, open: (u: string) => (opened.push(u), {}) },
    document: {
      currentScript: script,
      readyState: "complete",
      createElement: el,
      createTextNode: (t: string) => ({ text: t }),
      querySelectorAll: () => [script],
      addEventListener() {},
    },
  };
  vm.runInNewContext(src, sandbox);
  return { inserted, opened };
}

const desk = runWith("https://hihodl.xyz/pay/k7x2m9qa", "Mozilla/5.0 (Windows NT 10.0)");
eq("button.js draws one button", desk.inserted.length, 1);
eq("button.js label", (desk.inserted[0]?.children[1] as { text: string })?.text, "Pay with HOLD · $40.00");
let prevented = false;
desk.inserted[0]?.listeners.click({ preventDefault: () => (prevented = true) });
eq("desktop opens a popup", [desk.opened, prevented], [["https://hihodl.xyz/pay/k7x2m9qa"], true]);

const phone = runWith("https://hihodl.xyz/pay/k7x2m9qa", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile");
prevented = false;
phone.inserted[0]?.listeners.click({ preventDefault: () => (prevented = true) });
eq("phone follows the link (new tab)", [phone.opened.length, prevented], [0, false]);

eq("button.js refuses another site", runWith("https://evil.example/pay/x", "Mozilla/5.0").inserted.length, 0);

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
