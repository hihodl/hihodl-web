"use client";

/**
 * `?demo-open=<steps>` on any page: once it has rendered, press what the
 * steps name, one after the other, so the screen index can link straight to
 * a checkout, a sheet or a form that only opens on a click.
 *
 *   steps     separated by `>`: "@spot>claim this spot"
 *   a step    alternatives separated by `|`, each the start of a button's or
 *             link's text (any case); `@spot` is the first open spot on a
 *             product drawing; `b:` before the words presses only a real
 *             button (not a link that scrolls to it)
 *
 * Each step is tried for a few seconds, then the page is left as it is.
 */

import { useEffect } from "react";

/** What this page already pressed: a later step with the same words presses the next one. */
const clicked = new Set<Element>();

function find(step: string): Element | null {
  for (const alt of step.split("|").map((a) => a.trim().toLowerCase())) {
    if (!alt) continue;
    if (alt === "@spot") {
      const spot = [...document.querySelectorAll('g[role="button"][aria-label*=", available"]')].find((el) => !clicked.has(el));
      if (spot) return spot;
      continue;
    }
    // "b:" narrows a step to real buttons (not a link that only scrolls to them).
    const onlyButtons = alt.startsWith("b:");
    const words = (onlyButtons ? alt.slice(2) : alt).replace(/[’']/g, "'");
    const hit = [...document.querySelectorAll<HTMLElement>(onlyButtons ? "button" : "button, a, [role=button]")].find((el) => {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase().replace(/[’']/g, "'");
      return !clicked.has(el) && !el.hasAttribute("disabled") && text.startsWith(words);
    });
    if (hit) return hit;
  }
  return null;
}

export function DemoAutoOpen() {
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("demo-open");
    if (!want) return;
    const steps = want.split(">");
    let at = 0;
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      const el = find(steps[at]);
      if (el) {
        clicked.add(el);
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        at += 1;
        tries = 0;
        if (at >= steps.length) clearInterval(t);
      } else if (tries > 60) clearInterval(t);
    }, 200);
    return () => clearInterval(t);
  }, []);
  return null;
}
