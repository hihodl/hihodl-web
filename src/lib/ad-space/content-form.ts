/**
 * What a brand hands over for its spot, minus the markup.
 *
 * ── WHY THIS IS A MODULE AND NOT A COMPONENT ──
 *
 * Two screens now ask for the same thing. The public listing page asks an
 * anonymous sponsor, holding a checkout key, on the creator's own light
 * ground; the brand console asks a signed-in account, holding a session, on
 * the app's dark one. They cannot share markup — the second would look like a
 * hole cut in the first — and they must not each own a copy of the rules.
 *
 * A drifted copy here is not a cosmetic bug. The rule that a QR needs a real
 * link, or that a logo needs a file, is what stops a brand paying for a spot
 * and then sending the creator something unprintable. So the rules live here,
 * once, and each screen only decides how to draw them.
 *
 * The server validates all of this again and is the real limit. This exists so
 * the brand hears about it before the request, not after.
 */

import { t } from "@/lib/app/i18n";

import type { ContentKind } from "./types";

/** Exactly the body `PUT /ad-space/orders/:orderId/content` takes. */
export interface ContentBody {
  sponsorName: string;
  sponsorUrl?: string;
  xHandle?: string;
  contentKind: ContentKind;
  contentText?: string;
  imagePath?: string;
}

// TODO(contract): no maximum lengths are published for sponsorName or
// contentText. These are generous guesses; the server's validation is the
// real limit.
export const NAME_MAX = 60;
export const TEXT_MAX = 140;

/** Read at render: each hint is a getter, so it is in the language on screen. */
export const KIND_HINT: Record<ContentKind, string> = {
  get logo() {
    return t("offers.content.hint.logo");
  },
  get qr() {
    return t("offers.content.hint.qr");
  },
  get text() {
    return t("offers.content.hint.text");
  },
  get photo() {
    return t("offers.content.hint.photo");
  },
};

/** The two kinds that cannot be sent without a file. */
export function needsImage(kind: ContentKind): boolean {
  return kind === "logo" || kind === "photo";
}

export interface ContentDraft {
  kind: ContentKind;
  name: string;
  url: string;
  xHandle: string;
  text: string;
  hasFile: boolean;
}

/**
 * The first thing wrong with this draft, in the words the brand needs, or null.
 *
 * Order matters: the name is asked for first because it is the only field
 * every kind needs, so somebody who filled nothing in is told the same thing
 * whichever kind they picked.
 */
export function validateContent(d: ContentDraft): string | null {
  if (!d.name.trim()) return t("offers.content.problem.name");
  if (d.url.trim() && !/^https?:\/\/\S+\.\S+/i.test(d.url.trim())) {
    return t("offers.content.problem.url");
  }
  if (d.xHandle.trim() && !/^@?[A-Za-z0-9_]{1,15}$/.test(d.xHandle.trim())) {
    return t("offers.content.problem.xHandle");
  }
  if (needsImage(d.kind) && !d.hasFile) {
    return t("offers.content.problem.file", { kind: d.kind === "logo" ? "logo" : "photo" });
  }
  if (d.kind === "qr" && !/^https?:\/\/\S+\.\S+/i.test(d.text.trim())) {
    return t("offers.content.problem.qr");
  }
  if (d.kind === "text" && !d.text.trim()) return t("offers.content.problem.text");
  return null;
}

/**
 * The draft as the server wants it: trimmed, the leading @ off the handle, and
 * every optional field absent rather than empty — an empty string is a value,
 * and `nullish()` on the server does not mean "blank is fine".
 */
export function buildContentBody(d: ContentDraft, imagePath?: string): ContentBody {
  return {
    sponsorName: d.name.trim(),
    contentKind: d.kind,
    ...(d.url.trim() ? { sponsorUrl: d.url.trim() } : {}),
    ...(d.xHandle.trim() ? { xHandle: d.xHandle.trim().replace(/^@/, "") } : {}),
    ...(d.kind === "qr" || d.kind === "text" ? { contentText: d.text.trim() } : {}),
    ...(imagePath ? { imagePath } : {}),
  };
}

/** What went wrong with the file, in the brand's words. */
export function describeImageProblem(reason: string): string {
  return reason === "type"
    ? t("offers.content.image.type")
    : reason === "too_big"
      ? t("offers.content.image.tooBig")
      : t("offers.content.image.unreadable");
}
