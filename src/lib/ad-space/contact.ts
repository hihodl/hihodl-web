/**
 * How a buyer or a sponsor with no account says where to reach them: an X or
 * Telegram handle, or an email address. Shared by a booked session's contact
 * (hispace-in-the-room-v0.md) and an offer or bid (hispace-offers-v0.md), which
 * the contract validates the same way.
 */

import { CONTACT_KIND_LABEL } from "./format";
import type { ContactKind } from "./types";

export const CONTACT_KINDS: ContactKind[] = ["telegram", "x", "email"];

export const CONTACT_PLACEHOLDER: Record<ContactKind, string> = {
  x: "@yourhandle",
  telegram: "@yourname",
  email: "you@company.com",
};

/** Our reading of what each kind accepts. The server's `contact_invalid` is the real check. */
export function contactProblem(kind: ContactKind, value: string, whoReaches = "the creator"): string | null {
  const v = value.trim();
  if (!v) return `Add your ${CONTACT_KIND_LABEL[kind]} so ${whoReaches} can reach you.`;
  if (kind === "x" && !/^@?[A-Za-z0-9_]{1,15}$/.test(v)) return "An X handle is up to 15 letters, numbers or underscores.";
  if (kind === "telegram" && !/^@?[A-Za-z0-9_]{5,32}$/.test(v)) {
    return "A Telegram username is 5 to 32 letters, numbers or underscores.";
  }
  if (kind === "email" && (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) {
    return "That email address doesn't look complete.";
  }
  return null;
}

/** Handles go out as "@name", an email as typed (trimmed). */
export function normaliseContact(kind: ContactKind, value: string): string {
  const v = value.trim();
  if (kind === "email") return v;
  return `@${v.replace(/^@/, "")}`;
}
