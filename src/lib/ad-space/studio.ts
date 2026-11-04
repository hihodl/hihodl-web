/**
 * The page studio, as the web reads it: a listing's title style, its one
 * effect and its sections, and the hub's bio and title style.
 *
 * The backend keeps the values (server/services/ad-space/page-studio-rules.ts)
 * and refuses anything else; this file reads them back defensively all the
 * same, because a page must never draw a value it does not know (an older
 * or newer server, a hand-edited row), and a link must never be anything but
 * https. Pure: no React, no fetch, checked by studio.check.ts.
 */

export const TITLE_STYLES = ["classic", "eclectic", "fancy", "literary"] as const;
export type TitleStyle = (typeof TITLE_STYLES)[number];

export const PAGE_EFFECTS = ["none", "sparkles", "confetti", "petals", "snow"] as const;
export type PageEffect = (typeof PAGE_EFFECTS)[number];

/** The four named grounds; anything else a page stands on is a #RRGGBB. */
export const PAGE_GROUND_PRESETS = ["hold", "app", "night", "white"] as const;
export type PageGroundPreset = (typeof PAGE_GROUND_PRESETS)[number];

/** The banner gradients the server accepts (`BANNER_GRADIENT_KEYS`); colours live in ./look. */
export const BANNER_GRADIENTS = ["steel", "ember", "night", "slate", "sea"] as const;

/** A listing's title and reason as the server bounds them (`updateBody` in ad-space.router). */
export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
export const REASON_MAX = 280;

export type StudioLink = { label: string; url: string };

export type PageSection =
  | { kind: "audience" }
  | ({ kind: "link" } & StudioLink)
  | { kind: "text"; title: string; body: string }
  | { kind: "pastWork"; items: StudioLink[] };

export const MAX_SECTIONS = 6;
const MAX_PAST_WORK = 6;

/** A known title style, else classic. */
export function titleStyleOf(v: unknown): TitleStyle {
  return typeof v === "string" && (TITLE_STYLES as readonly string[]).includes(v) ? (v as TitleStyle) : "classic";
}

/** A known effect, else none. */
export function effectOf(v: unknown): PageEffect {
  return typeof v === "string" && (PAGE_EFFECTS as readonly string[]).includes(v) ? (v as PageEffect) : "none";
}

/** A preview's `?titleStyle=` / `?effect=`: the value when it is one we know, else null (the saved one stands). */
export function titleStyleParam(v: unknown): TitleStyle | null {
  return typeof v === "string" && (TITLE_STYLES as readonly string[]).includes(v) ? (v as TitleStyle) : null;
}

export function effectParam(v: unknown): PageEffect | null {
  return typeof v === "string" && (PAGE_EFFECTS as readonly string[]).includes(v) ? (v as PageEffect) : null;
}

/** A preview's `?ground=`: a preset name or a #RRGGBB, else null (the saved one stands). */
export function groundParam(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if ((PAGE_GROUND_PRESETS as readonly string[]).includes(v)) return v;
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
}

/** A known banner gradient key, else null. */
export function bannerGradientParam(v: unknown): (typeof BANNER_GRADIENTS)[number] | null {
  return typeof v === "string" && (BANNER_GRADIENTS as readonly string[]).includes(v)
    ? (v as (typeof BANNER_GRADIENTS)[number])
    : null;
}

/** A title the server would save: trimmed, 3 to 120 characters, else null. */
export function titleParam(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length >= TITLE_MIN && s.length <= TITLE_MAX ? s : null;
}

/**
 * A reason the server would save. `undefined` is "not a reason" (ignore it);
 * null is "none" (an empty or blank string, or null itself).
 */
export function reasonParam(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string" || v.length > REASON_MAX) return undefined;
  return v.trim() ? v : null;
}

/** An https URL, or null. The server already refuses anything else; this is the second lock. */
export function safeHttpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The host a link goes to, without `www.`: what a brand reads before they tap. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function link(v: unknown): StudioLink | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const label = text(o.label);
  const url = safeHttpsUrl(o.url);
  return label && url ? { label, url } : null;
}

/**
 * The sections a page draws, in the creator's order: anything malformed is
 * dropped rather than drawn, `audience` once, at most six. Absent on an older
 * server: none.
 */
export function sectionsOf(v: unknown): PageSection[] {
  if (!Array.isArray(v)) return [];
  const out: PageSection[] = [];
  for (const s of v) {
    if (out.length >= MAX_SECTIONS) break;
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    if (o.kind === "audience") {
      if (!out.some((x) => x.kind === "audience")) out.push({ kind: "audience" });
    } else if (o.kind === "link") {
      const l = link(o);
      if (l) out.push({ kind: "link", ...l });
    } else if (o.kind === "text") {
      const title = text(o.title);
      const body = text(o.body);
      if (title && body) out.push({ kind: "text", title, body });
    } else if (o.kind === "pastWork" && Array.isArray(o.items)) {
      const items = o.items.map(link).filter((l): l is StudioLink => l !== null).slice(0, MAX_PAST_WORK);
      if (items.length) out.push({ kind: "pastWork", items });
    }
  }
  return out;
}

/** The hub bio as drawn: one trimmed line, or null. */
export function bioOf(v: unknown): string | null {
  const s = text(v);
  return s ? s.replace(/\s+/g, " ").slice(0, 160) : null;
}
