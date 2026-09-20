/**
 * The person behind the account: profile, username, photo, recovery codes.
 *
 * Every call here is one the HOLD app already makes, against the same routes,
 * with the same rules, so an account set up on the web is the same account in
 * the app and the other way round:
 *
 *   GET   /me                              profile (avatarUrl comes back signed, 1 h)
 *   PATCH /me                              { displayName } { aliasHandle } { avatarUrl: storage path }
 *   GET   /me/check-handle?handle=         { available, reason }
 *   GET   /me/addresses                    the app wallet's addresses
 *   GET   /recovery-codes/status           { hasActiveCodes }
 *   POST  /recovery-codes/generate-and-email
 *   DELETE /x-account                      unlink X
 *
 * The photo goes where the app puts it: the private `user-avatars` bucket at
 * `{supabaseUid}/avatar-{ts}.jpg` (own-folder storage policies), and /me is
 * told the PATH, never a URL; the backend signs it on read
 * (hihodl-wallet/src/services/avatar.service.ts, server/services/avatar-url.service.ts).
 */

"use client";

import { call } from "@/lib/creator/api";
import { creatorDemoEnabled } from "@/lib/creator/demo";
import { creatorAuth } from "@/lib/creator/session";

export interface Me {
  id: string;
  supabaseUid: string | null;
  /** "@alex" as stored; null until one is chosen. */
  aliasHandle: string | null;
  /** When the username may change next (14-day rule); null or absent when it may now. */
  aliasChangeableAt?: string | null;
  email: string | null;
  profile: {
    displayName: string | null;
    avatarUrl: string | null;
    country: string | null;
    railsRegion: string | null;
    plan: string;
    cardWaitlistJoinedAt: string | null;
  };
}

export const getMe = () => call<Me>("me");

/** The answer carries no signed photo and no username window: read GET /me again after it. */
export const updateMe = (patch: { displayName?: string; aliasHandle?: string; avatarUrl?: string }) =>
  call<unknown>("me", { method: "PATCH", json: patch }).then(() => undefined);

/**
 * The HOLD wallet's addresses as the app registered them, by chain
 * (`solana`, `base`, `polygon`, `ethereum`; missing when there is none).
 * Empty for somebody whose only wallet is the web one: that one is
 * `registered_address` on /wallet-backup/status.
 */
export const getMyAddresses = () => call<{ addresses: Partial<Record<string, string>> }>("me/addresses").then((r) => r.addresses);

/* ── Username ─────────────────────────────────────────────────────── */

/**
 * The app's rule (src/lib/username.ts and onboarding/setup.tsx): 3 or more of
 * letters, digits, `_`, `.`, `-`; the backend caps it at 50. Reserved words
 * are the app's list and the backend's together, so neither says yes to a
 * name the other refuses.
 */
export const USERNAME_RE = /^[a-z0-9_.-]{3,50}$/i;

const RESERVED = new Set([
  "admin", "administrator", "root", "support", "help", "test", "tester", "hihodl", "wallet", "security", "service",
  "contact", "info", "solana", "bitcoin", "ethereum", "crypto", "blockchain", "web3", "hodl", "husd", "system",
]);

/** The bare name from what somebody typed: no @, no spaces. */
export function cleanUsername(v: string): string {
  return v.replace(/^@+/, "").trim();
}

/** "@alex" → "alex"; the app's auto-made `user_3fa9…` counts as none chosen. */
export function chosenUsername(me: Pick<Me, "aliasHandle"> | null | undefined): string | null {
  const bare = (me?.aliasHandle ?? "").replace(/^@/, "");
  if (bare.length < 3 || /^user_[a-f0-9]+$/i.test(bare)) return null;
  return bare;
}

export type UsernameVerdict = "available" | "own" | "taken" | "reserved" | "invalid";

export async function checkUsername(v: string): Promise<UsernameVerdict> {
  const bare = cleanUsername(v);
  if (!USERNAME_RE.test(bare)) return "invalid";
  if (RESERVED.has(bare.toLowerCase())) return "reserved";
  const r = await call<{ available: boolean; reason: string | null }>(`me/check-handle?handle=${encodeURIComponent(bare)}`);
  if (r.available) return r.reason === "own_handle" ? "own" : "available";
  if (r.reason === "reserved") return "reserved";
  if (r.reason === "invalid_characters") return "invalid";
  return "taken";
}

/* ── Photo ────────────────────────────────────────────────────────── */

const AVATAR_BUCKET = "user-avatars";
const AVATAR_SIDE = 512;

/** Decode a file into an image we can measure and draw. */
export function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => {
      URL.revokeObjectURL(url);
      resolve(i);
    };
    i.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("not_an_image"));
    };
    i.src = url;
  });
}

/** A square of the source image, in its own pixels. */
export interface CropRect {
  sx: number;
  sy: number;
  side: number;
}

/**
 * The chosen square, as a JPEG at most 512 px.
 *
 * The rectangle is clamped to the image before it is drawn: a crop that runs
 * off the edge would be padded with transparent black, which a JPEG then
 * flattens to a black wedge across somebody's face.
 */
export async function cropToJpeg(img: HTMLImageElement, rect: CropRect): Promise<Blob> {
  const max = Math.min(img.naturalWidth, img.naturalHeight);
  const side = Math.max(1, Math.min(rect.side, max));
  const sx = Math.max(0, Math.min(rect.sx, img.naturalWidth - side));
  const sy = Math.max(0, Math.min(rect.sy, img.naturalHeight - side));
  const out = Math.min(AVATAR_SIDE, Math.round(side));
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode_failed"))), "image/jpeg", 0.88),
  );
}

/**
 * A square JPEG, centre-cropped, at most 512 px.
 *
 * The fallback for anything that hands over a file without a chosen crop. The
 * avatar screen does not: it opens the cropper, because the middle of a
 * photograph is very rarely the middle of a face.
 */
export async function squareJpeg(file: Blob): Promise<Blob> {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error("not_an_image");
  return cropToJpeg(img, { sx: (img.naturalWidth - side) / 2, sy: (img.naturalHeight - side) / 2, side });
}

/** The storage path inside a signed or public URL of our bucket, or the path itself. */
function storagePathOf(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  for (const marker of [`/object/public/${AVATAR_BUCKET}/`, `/object/sign/${AVATAR_BUCKET}/`]) {
    const i = value.indexOf(marker);
    if (i >= 0) return value.slice(i + marker.length).split("?")[0];
  }
  return null;
}

/**
 * Upload a photo and make it the profile's. The previous one is removed
 * afterwards, best effort, only from this person's own folder.
 */
export async function uploadAvatar(file: Blob, supabaseUid: string, previous: string | null): Promise<void> {
  // Demo mode: no storage bucket; the picture is kept as a data URL on the demo profile.
  if (creatorDemoEnabled()) {
    const jpeg = await squareJpeg(file);
    const url = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(jpeg);
    });
    await updateMe({ avatarUrl: url });
    return;
  }
  const auth = creatorAuth();
  if (!auth) throw new Error("not_configured");
  const jpeg = await squareJpeg(file);
  const path = `${supabaseUid}/avatar-${Date.now()}.jpg`;
  const { error } = await auth.storage.from(AVATAR_BUCKET).upload(path, jpeg, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error("upload_failed");
  await updateMe({ avatarUrl: path });
  const old = storagePathOf(previous);
  if (old && old !== path && old.startsWith(`${supabaseUid}/`)) {
    void auth.storage.from(AVATAR_BUCKET).remove([old]).catch(() => undefined);
  }
}

/** Back to the initial. The stored object is removed too, best effort. */
export async function removeAvatar(supabaseUid: string, previous: string | null): Promise<void> {
  await updateMe({ avatarUrl: "" });
  const old = storagePathOf(previous);
  const auth = creatorAuth();
  if (auth && old && old.startsWith(`${supabaseUid}/`)) {
    void auth.storage.from(AVATAR_BUCKET).remove([old]).catch(() => undefined);
  }
}

/* ── Recovery codes ───────────────────────────────────────────────── */

export const recoveryCodesStatus = () =>
  call<{ hasActiveCodes: boolean; unusedCount: number; generatedAt: string | null }>("recovery-codes/status");

/** Eight single-use codes, to this email only; the response never carries them. */
export const emailRecoveryCodes = (email: string) =>
  call<{ sent: boolean; email: string }>("recovery-codes/generate-and-email", { json: { email } });

/* ── X ────────────────────────────────────────────────────────────── */

export const unlinkX = () => call<{ unlinked: boolean }>("x-account", { method: "DELETE" });
