/**
 * How a buyer or a sponsor with no account says where to reach them: an X or
 * Telegram handle, or an email address. Shared by a booked session's contact
 * (hispace-in-the-room-v0.md) and an offer or bid (hispace-offers-v0.md), which
 * the contract validates the same way.
 */

import { t } from "@/lib/app/i18n";

import { CONTACT_KIND_LABEL } from "./format";
import type { ContactKind } from "./types";

export const CONTACT_KINDS: ContactKind[] = ["telegram", "x", "email"];

/** Read at render: each placeholder is a getter, so it is in the language on screen. */
export const CONTACT_PLACEHOLDER: Record<ContactKind, string> = {
  get x() {
    return t("offers.contact.placeholder.x");
  },
  get telegram() {
    return t("offers.contact.placeholder.telegram");
  },
  get email() {
    return t("offers.contact.placeholder.email");
  },
};

/** Our reading of what each kind accepts. The server's `contact_invalid` is the real check. */
export function contactProblem(kind: ContactKind, value: string, whoReaches?: string): string | null {
  const v = value.trim();
  if (!v) {
    return whoReaches
      ? t("offers.contact.problem.empty", { kind: CONTACT_KIND_LABEL[kind], who: whoReaches })
      : t("offers.contact.problem.emptyCreator", { kind: CONTACT_KIND_LABEL[kind] });
  }
  if (kind === "x" && !/^@?[A-Za-z0-9_]{1,15}$/.test(v)) return t("offers.contact.problem.x");
  if (kind === "telegram" && !/^@?[A-Za-z0-9_]{5,32}$/.test(v)) {
    return t("offers.contact.problem.telegram");
  }
  if (kind === "email" && (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) {
    return t("offers.contact.problem.email");
  }
  return null;
}

/** Handles go out as "@name", an email as typed (trimmed). */
export function normaliseContact(kind: ContactKind, value: string): string {
  const v = value.trim();
  if (kind === "email") return v;
  return `@${v.replace(/^@/, "")}`;
}
