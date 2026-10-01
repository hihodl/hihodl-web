/**
 * "Button for your site": one line of HTML a creator pastes into Carrd,
 * Notion, Webflow, Linktree or their own page, for any pay link.
 *
 *   html     a self-contained <a> with inline styles: no script, works
 *            wherever HTML does, opens the hosted page in a new tab
 *   script   <script src="https://hihodl.xyz/button.js" data-link=…>, which
 *            draws the same button and opens a centred popup on a computer
 *            (a new tab on a phone). public/button.js is that script.
 *
 * The look is HOLD's dark pill: navy #0D1820, a white hairline at 16%, the
 * white label at 600, 44 high with a radius of half that (never 999px).
 *
 * The page it opens still answers X-Frame-Options: DENY, so nothing here
 * frames it; an embedded checkout is a later step.
 *
 * Pure: no React, no `@/` imports (checked by pay-button.check.ts).
 */

export const BUTTON_SCRIPT_URL = "https://hihodl.xyz/button.js";
export const BUTTON_FACE_URL = "https://hihodl.xyz/favicon.png";

/** The pill, as one inline style. public/button.js draws the same values. */
export const BUTTON_STYLE =
  "display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 20px 0 14px;border-radius:22px;" +
  "background:#0D1820;border:1px solid rgba(255,255,255,0.16);color:#FFFFFF;" +
  "font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" +
  "text-decoration:none;white-space:nowrap;box-sizing:border-box;cursor:pointer";

const FACE_STYLE = "width:20px;height:20px;border-radius:6px;display:block";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Only a hosted HOLD pay page is ever a button's target. */
export function isHoldPayUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "hihodl.xyz" || u.hostname === "www.hihodl.xyz") && /^\/pay\/[^/]+(\/[^/]+)?\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** "Pay with HOLD · $40.00": the label, then the price when the link has one. */
export function buttonText(label: string, amount: string | null): string {
  const l = label.trim() || "Pay with HOLD";
  return amount ? `${l} · ${amount}` : l;
}

export interface ButtonSpec {
  url: string;
  /** "Pay with HOLD" or the link's title. */
  label: string;
  /** The fixed price, formatted ("$40.00"), or null for an open amount. */
  amount: string | null;
}

/** The self-contained <a>, on one line. */
export function buttonHtml(b: ButtonSpec): string {
  return (
    `<a href="${escapeHtml(b.url)}" target="_blank" rel="noopener" style="${BUTTON_STYLE}">` +
    `<img src="${BUTTON_FACE_URL}" alt="" width="20" height="20" style="${FACE_STYLE}">` +
    `${escapeHtml(buttonText(b.label, b.amount))}</a>`
  );
}

/** The script variant: the same button, a popup on a computer. */
export function buttonScript(b: ButtonSpec): string {
  const attrs = [`src="${BUTTON_SCRIPT_URL}"`, `data-link="${escapeHtml(b.url)}"`, `data-label="${escapeHtml(b.label.trim() || "Pay with HOLD")}"`];
  if (b.amount) attrs.push(`data-amount="${escapeHtml(b.amount)}"`);
  return `<script ${attrs.join(" ")} async></script>`;
}
