import { t } from "@/lib/app/i18n";
import type { BusinessSeller } from "@/lib/ad-space/types";

/**
 * A company selling on HOLD (business-treasury-contract.md): its name, its
 * logo and, when HOLD checked it, our own "Verified business" mark.
 *
 * The mark is ours and looks like ours: a hairline pill with words in it.
 * It is never X's gold check, which is X's statement about an X account; this
 * one is HOLD's statement about who sells here.
 *
 * No hooks, so the server-rendered sections and the client sheets share it.
 */

/** The company, when there is one with a name. */
export function businessOf(creator: { business?: BusinessSeller | null }): BusinessSeller | null {
  const b = creator.business;
  return b && typeof b.displayName === "string" && b.displayName.trim() ? b : null;
}

/** Who a visitor is talking to: the company's name, else the creator's @handle. */
export function sellerName(creator: { xHandle: string | null; business?: BusinessSeller | null }): string {
  return businessOf(creator)?.displayName ?? (creator.xHandle ? `@${creator.xHandle}` : t("enquiries.ask.seller"));
}

/** `https://solana.com/spaces` to `solana.com`. Null for anything that is not an https URL. */
export function websiteHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.host.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

export function VerifiedBusinessMark({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[12px] border border-sp-ink/25 bg-sp-ink/[0.06] px-2.5 text-tiny font-medium text-sp-ink ${className}`}
      title={t("enquiries.business.verifiedAbout", { name })}
    >
      {/* A building, not a check: it says what was verified. */}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2.5 14h11M4 14V3.5L9 2v12M9 6h3v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 5.5h1M6 8h1M6 10.5h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {t("enquiries.business.verified")}
    </span>
  );
}

/**
 * A company's logo, square with soft corners (a logo is not a face), on a
 * white plate so a dark logo still reads on the blue ground.
 */
export function BusinessLogo({ business, size }: { business: BusinessSeller; size: number }) {
  const radius = Math.round(size * 0.22);
  if (business.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- the company's logo, from our own bucket
      <img
        src={business.logoUrl}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 border border-[color:var(--color-hairline-strong)] bg-white object-contain"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center bg-brand-blue-deep font-medium text-sp-ink"
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {business.displayName.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
