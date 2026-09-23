/**
 * Who last signed in on this browser, so the door can say "Welcome back".
 *
 * The app shows a returning person their name and photo on the lock screen;
 * the web does the same on its sign-in screen. What is kept is what that
 * screen draws and nothing that opens anything: the way they signed in
 * (Apple, Google or email), the email for the code form, the name to greet,
 * and the face: a small copy of the photo (a 128 px JPEG data URL, made in
 * this browser while signed in, since our photo URLs are signed and expire
 * within the hour) or the emoji the person chose in the app.
 * No token, no uid, no photo URL. Only this browser keeps it, for the person
 * who signed in on it. It stays after signing out, which is the point;
 * "Not you?" forgets it.
 */

"use client";

export type SignInMethod = "apple" | "google" | "email";

export interface Remembered {
  method: SignInMethod;
  email: string | null;
  /** "Alex", or "@alex" when there is no display name. */
  name: string | null;
}

const KEY = "hold-last-signin";
const FACE = "hold-last-signin-face";

export function readRemembered(): Remembered | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Remembered>;
    if (v.method !== "apple" && v.method !== "google" && v.method !== "email") return null;
    return {
      method: v.method,
      email: typeof v.email === "string" ? v.email.slice(0, 320) : null,
      name: typeof v.name === "string" ? v.name.slice(0, 80) : null,
    };
  } catch {
    return null;
  }
}

export function remember(next: Remembered): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* the next visit is greeted as a first one */
  }
}

export function forgetRemembered(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(FACE);
  } catch {
    /* nothing kept */
  }
}

/* ── The face ──────────────────────────────────────────────────────── */

export interface RememberedFace {
  /** Whose face it is: the email it was kept for, so another account never wears it. */
  email: string | null;
  /** "data:image/jpeg;base64,…", 128 px; null when there is no photo. */
  photo: string | null;
  /** Which photo it was made from (a hash of its path, never the URL): made again only when it changes. */
  photoKey: string | null;
  /** The app's emoji avatar ("🚀"), when /me carries one. */
  emoji: string | null;
}

/** A thumbnail is ~5-10 KB; anything much bigger is not one of ours. */
const MAX_PHOTO = 120_000;

function cleanEmoji(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  // An emoji, maybe with modifiers: short, no letters or digits, never a URL.
  if (!t || t.length > 16 || /[A-Za-z0-9:/]/.test(t)) return null;
  return t;
}

export function readFace(email: string | null): RememberedFace | null {
  try {
    const raw = window.localStorage.getItem(FACE);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<RememberedFace>;
    const owner = typeof v.email === "string" ? v.email : null;
    if ((owner ?? "").toLowerCase() !== (email ?? "").toLowerCase()) return null;
    const photo =
      typeof v.photo === "string" && v.photo.startsWith("data:image/jpeg;base64,") && v.photo.length <= MAX_PHOTO ? v.photo : null;
    return {
      email: owner,
      photo,
      photoKey: photo && typeof v.photoKey === "string" ? v.photoKey.slice(0, 32) : null,
      emoji: cleanEmoji(v.emoji),
    };
  } catch {
    return null;
  }
}

function writeFace(face: RememberedFace): void {
  try {
    window.localStorage.setItem(FACE, JSON.stringify(face));
  } catch {
    /* the door shows the default face */
  }
}

/** FNV-1a of the photo's path, without the signature that changes every hour. */
function photoKeyOf(url: string): string {
  let path = url;
  try {
    const u = new URL(url);
    path = `${u.host}${u.pathname}`;
  } catch {
    path = url.split("?")[0];
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** A 128 px square JPEG of the photo, cropped to cover; null when the browser will not let us read it. */
function thumbnail(url: string, size = 128): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        try {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          if (!w || !h) return resolve(null);
          const side = Math.min(w, h);
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
          const data = canvas.toDataURL("image/jpeg", 0.82);
          resolve(data.startsWith("data:image/jpeg;base64,") && data.length <= MAX_PHOTO ? data : null);
        } catch {
          // A photo served without CORS taints the canvas: keep the default face.
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Keep this person's face for the next "Welcome back". Called while signed in,
 * whenever /me answers. The thumbnail is made again only when the photo itself
 * changes (not its hourly signature); no photo clears it.
 */
export async function rememberFace(email: string | null, photoUrl: string | null, emoji: unknown): Promise<void> {
  const kept = readFace(email);
  const clean = cleanEmoji(emoji);
  if (!photoUrl) {
    writeFace({ email, photo: null, photoKey: null, emoji: clean });
    return;
  }
  const key = photoKeyOf(photoUrl);
  if (kept?.photo && kept.photoKey === key) {
    if (kept.emoji !== clean) writeFace({ ...kept, emoji: clean });
    return;
  }
  const photo = await thumbnail(photoUrl);
  // A photo we could not read leaves the default face, never the copy of an older photo.
  writeFace({ email, photo: photo ?? null, photoKey: photo ? key : null, emoji: clean });
}

const PENDING = "hold-auth-method";

/** Said at the moment somebody chooses a way in (this tab only), read once they are in. */
export function notePendingMethod(method: SignInMethod): void {
  try {
    window.sessionStorage.setItem(PENDING, method);
  } catch {
    /* falls back to Supabase's record */
  }
}

/**
 * How this session signed in: what this tab said when they chose, else what
 * was remembered, else Supabase's record (which is the account's FIRST
 * provider, so it is the last resort).
 */
export function currentMethod(provider: unknown): SignInMethod {
  let pending: string | null = null;
  try {
    pending = window.sessionStorage.getItem(PENDING);
  } catch {
    pending = null;
  }
  if (pending === "apple" || pending === "google" || pending === "email") return pending;
  const known = readRemembered()?.method;
  if (known) return known;
  return provider === "apple" || provider === "google" ? provider : "email";
}
