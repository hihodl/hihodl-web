/**
 * The preview inside the HOLD app: what the page says to the app, what the
 * app may say back, and which of it the page believes.
 *
 * The app opens `/app/preview/<spaceId>?embed=app` in a full screen WebView,
 * with `&edit=1` when the page is its editor ("the draft is the page"). Web to
 * app goes through `window.ReactNativeWebView.postMessage(string)`; app to web
 * is a `message` event on `window` whose `data` is a JSON string.
 *
 *   web → app   hold-preview-ready          first render settled
 *               hold-preview-updated        an update was applied and drawn
 *               hold-preview-auth-failed    no token, or it was refused
 *               hold-preview-not-owner      a token, but not the creator's
 *               hold-edit {target, index?, kind?}   a tap on an editable part
 *   app → web   hold-preview-update {ground?, titleStyle?, effect?,
 *               bannerGradient?, sections?, title?, reason?}
 *
 * An update is validated by the same rules the server saves with
 * (./studio): a value the server would refuse is dropped, never drawn, and
 * unknown keys are ignored. Pure: no React, no DOM, checked by
 * preview-bridge.check.ts.
 */

import {
  MAX_SECTIONS,
  bannerGradientParam,
  effectParam,
  groundParam,
  reasonParam,
  sectionsOf,
  titleParam,
  titleStyleParam,
  type PageSection,
} from "./studio";

/* ── The mode ─────────────────────────────────────────────────────── */

/** `public`: the site. `preview`: the app's WebView, read only. `edit`: the app's editor. */
export type PreviewMode = "public" | "preview" | "edit";

/** `edit=1` counts only together with `embed=app`. */
export function previewModeOf(q: { embed?: unknown; edit?: unknown }): PreviewMode {
  if (q.embed !== "app") return "public";
  return q.edit === "1" ? "edit" : "preview";
}

/* ── The token the app injects ────────────────────────────────────── */

/**
 * `window.__HOLD_ACCESS_TOKEN__`, when it is shaped like a JWT. Read, used as
 * a bearer and dropped: never stored, never logged.
 */
export function injectedToken(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 8192) return null;
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v) ? v : null;
}

/* ── Web to app ───────────────────────────────────────────────────── */

export const EDIT_TARGETS = ["cover", "title", "story", "brandGets", "spots", "section", "addSection"] as const;
export type EditTarget = (typeof EDIT_TARGETS)[number];

export const SECTION_KINDS = ["audience", "link", "text", "pastWork"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export function isEditTarget(v: unknown): v is EditTarget {
  return typeof v === "string" && (EDIT_TARGETS as readonly string[]).includes(v);
}

export function isSectionKind(v: unknown): v is SectionKind {
  return typeof v === "string" && (SECTION_KINDS as readonly string[]).includes(v);
}

export const readyMessage = () => JSON.stringify({ type: "hold-preview-ready" });
export const updatedMessage = () => JSON.stringify({ type: "hold-preview-updated" });
export const authFailedMessage = () => JSON.stringify({ type: "hold-preview-auth-failed" });
export const notOwnerMessage = () => JSON.stringify({ type: "hold-preview-not-owner" });

/**
 * A tap on an editable part, or null when the parts do not make one: a
 * section needs its index, an add chip its kind, and nothing else carries
 * either.
 */
export function editMessage(target: unknown, extra: { index?: unknown; kind?: unknown } = {}): string | null {
  if (!isEditTarget(target)) return null;
  if (target === "section") {
    const i = typeof extra.index === "string" ? Number(extra.index) : extra.index;
    if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= MAX_SECTIONS) return null;
    return JSON.stringify({ type: "hold-edit", target, index: i });
  }
  if (target === "addSection") {
    return isSectionKind(extra.kind) ? JSON.stringify({ type: "hold-edit", target, kind: extra.kind }) : null;
  }
  return JSON.stringify({ type: "hold-edit", target });
}

/** The add chips still allowed: none at six sections, audience only once. */
export function addableKinds(sections: readonly PageSection[]): SectionKind[] {
  if (sections.length >= MAX_SECTIONS) return [];
  const hasAudience = sections.some((s) => s.kind === "audience");
  return SECTION_KINDS.filter((k) => k !== "audience" || !hasAudience);
}

/* ── App to web ───────────────────────────────────────────────────── */

export type PreviewPatch = {
  /** null: back to HOLD blue. */
  ground?: string | null;
  titleStyle?: string;
  effect?: string;
  bannerGradient?: string;
  sections?: PageSection[];
  title?: string;
  reason?: string | null;
};

/**
 * A `hold-preview-update`, as a JSON string or an object, reduced to the keys
 * whose values the server would accept. Null when it is not an update at all.
 * An update whose every key is refused is an empty patch, not null: the app
 * still hears `hold-preview-updated`, and the page shows what it showed.
 */
export function parsePreviewUpdate(data: unknown): PreviewPatch | null {
  let o: unknown = data;
  if (typeof data === "string") {
    if (data.length > 100_000) return null;
    try {
      o = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const m = o as Record<string, unknown>;
  if (m.type !== "hold-preview-update") return null;

  const patch: PreviewPatch = {};
  if ("ground" in m) {
    const g = m.ground === null ? null : groundParam(m.ground);
    if (g !== null || m.ground === null) patch.ground = g;
  }
  const style = titleStyleParam(m.titleStyle);
  if (style) patch.titleStyle = style;
  const effect = effectParam(m.effect);
  if (effect) patch.effect = effect;
  const gradient = bannerGradientParam(m.bannerGradient);
  if (gradient) patch.bannerGradient = gradient;
  if (Array.isArray(m.sections)) patch.sections = sectionsOf(m.sections);
  const title = titleParam(m.title);
  if (title) patch.title = title;
  if ("reason" in m) {
    const reason = reasonParam(m.reason);
    if (reason !== undefined) patch.reason = reason;
  }
  return patch;
}

/** The fields a patch touches on a space. Generic so this file needs no Space. */
type Patchable = {
  title: string;
  reason: string | null;
  bannerGradient: string;
  titleStyle?: string;
  effect?: string;
  sections?: unknown[];
  pageGround?: string | null;
};

/** The space as the patch draws it. A new object; the one passed in is untouched. */
export function applyPreviewPatch<S extends Patchable>(space: S, patch: PreviewPatch): S {
  const next: S = { ...space };
  if (patch.ground !== undefined) next.pageGround = patch.ground;
  if (patch.titleStyle !== undefined) next.titleStyle = patch.titleStyle;
  if (patch.effect !== undefined) next.effect = patch.effect;
  if (patch.bannerGradient !== undefined) next.bannerGradient = patch.bannerGradient as S["bannerGradient"];
  if (patch.sections !== undefined) next.sections = patch.sections;
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.reason !== undefined) next.reason = patch.reason;
  return next;
}
