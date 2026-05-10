/**
 * Shared security helpers for the marketing API surface.
 *
 * Why this file exists: the waitlist + referral system grew organically
 * without a security pass. The four primitives below are the minimum-viable
 * hardening pulled out of the API routes so each route stays small.
 *
 *   - escapeHtml(s): prevent HTML/XSS injection in transactional emails.
 *   - validateEmail(s): regex check + length cap.
 *   - validateDisplayName(s): length cap + strip control chars.
 *   - ipRateLimit(req, key, opts): in-memory sliding-window per-IP rate
 *     limiter. No Redis dependency — for a marketing site at pre-launch
 *     traffic this is sufficient. Cold-start resets are a non-issue
 *     because attackers can't forecast / coordinate cold-start timing.
 *   - signToken(payload) / verifyToken(token): HMAC-SHA256 tokens used
 *     to gate /api/referral/stats and /api/milestones (otherwise IDOR —
 *     anyone can query anyone's stats by email).
 *
 * Token secret: requires WAITLIST_TOKEN_SECRET env var. If missing, the
 * sign/verify functions throw — fail-closed so we never accidentally ship
 * an "everyone's a valid user" mode.
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

// ── HTML escape ──────────────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

export function escapeHtml(input: unknown): string {
  return String(input ?? "").replace(/[&<>"'/]/g, (c) => HTML_ENTITIES[c] ?? c);
}

// ── Input validation ─────────────────────────────────────────────────────

// RFC 5322-ish — strict enough to reject obvious garbage and email-injection
// attempts (newlines, BCC headers, etc.) without being so strict it rejects
// legitimate addresses with + tags or subdomains.
const EMAIL_RE = /^[^\s<>@,;:"'`\\]+@[^\s<>@,;:"'`\\]+\.[^\s<>@,;:"'`\\]+$/;

export function validateEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 120) return null;
  if (!EMAIL_RE.test(trimmed)) return null;
  // Reject CR/LF anywhere (header injection guard for Resend).
  if (/[\r\n]/.test(trimmed)) return null;
  return trimmed;
}

export function validateDisplayName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  // Strip control chars (including CR/LF) and cap length. We don't HTML-escape
  // here — escapeHtml() runs at render time so we keep the raw cleaned value
  // in the DB for human readability in the admin view.
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (cleaned.length === 0 || cleaned.length > 50) return null;
  return cleaned;
}

// ── In-memory rate limit ─────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number };
const _buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

function getClientIp(req: NextRequest): string {
  // Vercel forwards the real client IP in `x-forwarded-for` (first entry).
  // Fall back to `x-real-ip` and finally a synthetic key so the limiter
  // still operates in dev / behind a misconfigured proxy.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export function ipRateLimit(
  req: NextRequest,
  scope: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const ip = getClientIp(req);
  const key = `${scope}:${ip}`;
  const now = Date.now();

  const existing = _buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    _buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.max - 1, retryAfterMs: 0 };
  }

  if (existing.count >= opts.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: existing.resetAt - now,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: opts.max - existing.count,
    retryAfterMs: 0,
  };
}

// ── Signed tokens (HMAC) ─────────────────────────────────────────────────

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(): Buffer {
  const raw = process.env.WAITLIST_TOKEN_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "WAITLIST_TOKEN_SECRET env var missing or too short (must be at least 32 chars). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  }
  return Buffer.from(raw, "utf8");
}

export interface TokenPayload {
  userId: string;
  email: string;
}

// Body separator — pipe `|` is intentionally chosen because:
//   - validateEmail() rejects pipe (it's not in the allowed email charset)
//   - UUID v4 doesn't use pipe
//   - The numeric expiresAt doesn't either
// Original implementation used `.` which silently broke verify for any email
// with a dot in the domain (i.e. every real email).
const BODY_SEP = "|";

/**
 * Sign a short-lived (7-day) HMAC token tied to the user's email + id.
 * Returned to the client on successful waitlist join; client passes it back
 * in `Authorization: Bearer <token>` on subsequent stats/milestones reads.
 *
 * Wire format: `${base64url(body)}.${base64url(sig)}` where body is
 * `userId|email|expiresAt`. The outer `.` separator is safe because
 * base64url does not include `.`.
 */
export function signToken(payload: TokenPayload): string {
  const secret = getSecret();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const body = `${payload.userId}${BODY_SEP}${payload.email}${BODY_SEP}${expiresAt}`;
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  const bodyB64 = Buffer.from(body, "utf8").toString("base64url");
  return `${bodyB64}.${sig}`;
}

/**
 * Verify a token from `Authorization: Bearer <token>`. Returns the payload
 * on success, null on any verification failure (bad shape, bad sig, expired,
 * email mismatch, secret missing).
 *
 * If `requiredEmail` is provided, the token's email must match — enforces
 * "you can only query stats for your own email" instead of "any signed user
 * can query any email".
 */
export function verifyToken(
  token: string | null,
  requiredEmail?: string,
): TokenPayload | null {
  if (!token) return null;
  let secret: Buffer;
  try {
    secret = getSecret();
  } catch {
    return null; // fail-closed if secret missing
  }

  // Split outer wire format on `.` (one dot, two parts: body + sig).
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0 || dotIdx === token.length - 1) return null;
  const bodyB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);

  let body: string;
  try {
    body = Buffer.from(bodyB64, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSig = createHmac("sha256", secret).update(body).digest();
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigB64, "base64url");
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  // Split body on `|` (chosen because it's not in any payload field) — emails
  // contain dots so the previous `.` separator silently failed for all real
  // signups.
  const bodyParts = body.split(BODY_SEP);
  if (bodyParts.length !== 3) return null;
  const [userId, email, expiresAtStr] = bodyParts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  if (requiredEmail && email !== requiredEmail.trim().toLowerCase()) return null;

  return { userId, email };
}

/** Read `Authorization: Bearer <token>` header. */
export function bearerFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
