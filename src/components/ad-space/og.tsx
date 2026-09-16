import type { ReactNode } from "react";

import { eventCountdown, eventDates } from "@/lib/ad-space/format";
import { type Banner, categoryLabel, gradientCss, gradientOverPhotoCss } from "@/lib/ad-space/look";
import type { EventSummary } from "@/lib/ad-space/types";

/**
 * The X card's banner, built from the same parts as the page's: photo, gradient
 * over its lower half, and a small card that leaves the city in view.
 *
 * Satori renders this, so: flex layout only, inline styles, no classes, the
 * default font, and no backdrop blur (the card's ground is simply more opaque).
 */

export const OG_W = 1200;
export const OG_H = 630;

export const OG = {
  text: "#F4F6FA",
  muted: "rgba(244,246,250,0.78)",
  faint: "rgba(244,246,250,0.55)",
  amber: "#FFB703",
  card: "rgba(20,31,46,0.80)",
  cardBorder: "rgba(255,255,255,0.16)",
  chip: "rgba(255,255,255,0.14)",
};

const OG_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** The body, or null as soon as it passes `max` bytes (the rest is never downloaded). */
async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * A remote image as a data URI, or null. Satori throws on an image it cannot
 * decode, which would turn one bad upload into no card at all, so anything that
 * is not a PNG or JPEG (WebP included, which Satori does not draw), anything
 * slow and anything over 4 MB is dropped and the gradient stands in.
 */
export async function loadOgImage(url: string | null): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (type !== "image/png" && type !== "image/jpeg") return null;
    // A declared size over the limit is refused before a byte is read. The
    // header can be missing or wrong, so the limit is enforced again while reading.
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > OG_IMAGE_MAX_BYTES) {
      await res.body?.cancel();
      return null;
    }
    const buf = await readCapped(res, OG_IMAGE_MAX_BYTES);
    return buf ? `data:${type};base64,${buf.toString("base64")}` : null;
  } catch {
    return null;
  }
}

/** `banner.imageUrl` must already be a data URI from `loadOgImage`, or null. */
export function OgBanner({ banner, children }: { banner: Banner; children: ReactNode }) {
  return (
    <div
      style={{
        width: OG_W,
        height: OG_H,
        display: "flex",
        position: "relative",
        color: OG.text,
        backgroundImage: gradientCss(banner.gradient),
      }}
    >
      {banner.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image
        <img
          src={banner.imageUrl}
          alt=""
          width={OG_W}
          height={OG_H}
          style={{ position: "absolute", top: 0, left: 0, width: OG_W, height: OG_H, objectFit: "cover" }}
        />
      )}
      {banner.imageUrl && (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: OG_W,
            height: OG_H / 2,
            display: "flex",
            backgroundImage: gradientOverPhotoCss(banner.gradient),
          }}
        />
      )}
      {children}
      <div
        style={{
          position: "absolute",
          right: 48,
          bottom: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        }}
      >
        {banner.credit && <div style={{ fontSize: 16, color: OG.faint, marginBottom: 8 }}>{clip(banner.credit, 48)}</div>}
        <div style={{ fontSize: 26, color: OG.muted, letterSpacing: 1 }}>hihodl.xyz</div>
      </div>
    </div>
  );
}

export function OgChip({ children, tone }: { children: ReactNode; tone?: "amber" }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 40,
        borderRadius: 20,
        paddingLeft: 16,
        paddingRight: 16,
        fontSize: 22,
        backgroundColor: tone === "amber" ? "rgba(255,183,3,0.22)" : OG.chip,
        color: tone === "amber" ? OG.amber : OG.text,
        marginRight: 10,
      }}
    >
      {children}
    </div>
  );
}

/** "Starts in 21 days", "Happening now", "Ended". */
export function countdownLabel(event: EventSummary, now: number): { text: string; now: boolean } {
  const c = eventCountdown(event.startsOn, event.endsOn, now);
  const text = c.phase === "upcoming" ? `Starts ${c.text}` : c.text.charAt(0).toUpperCase() + c.text.slice(1);
  return { text, now: c.phase === "now" };
}

/** Name, city, dates and countdown: the event page's small card, drawn for X. */
export function OgEventCard({
  event,
  now,
  header,
  footer,
  compact = false,
}: {
  event: EventSummary;
  now: number;
  header?: ReactNode;
  footer?: ReactNode;
  /** Smaller type, for a card that also carries a creator and their board. */
  compact?: boolean;
}) {
  const countdown = countdownLabel(event, now);
  return (
    <div
      style={{
        position: "absolute",
        left: 48,
        bottom: 40,
        maxWidth: 700,
        display: "flex",
        flexDirection: "column",
        padding: compact ? 28 : 32,
        borderRadius: 24,
        backgroundColor: OG.card,
        border: `1px solid ${OG.cardBorder}`,
      }}
    >
      {header}
      <div style={{ display: "flex" }}>
        <OgChip>{categoryLabel(event.category)}</OgChip>
        <OgChip tone={countdown.now ? "amber" : undefined}>{countdown.text}</OgChip>
      </div>
      <div style={{ marginTop: compact ? 14 : 18, fontSize: compact ? 44 : 64, lineHeight: 1.05, letterSpacing: -1.5 }}>
        {clip(event.name, 28)}
      </div>
      <div style={{ marginTop: compact ? 6 : 10, fontSize: compact ? 26 : 30, color: OG.muted }}>
        {`${clip(event.city, 28)} · ${eventDates(event.startsOn, event.endsOn)}`}
      </div>
      {footer}
    </div>
  );
}

export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
