import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BusinessLogo, VerifiedBusinessMark, businessOf } from "@/components/ad-space/business";
import { EnquiryThread } from "@/components/ad-space/EnquiryThread";
import { SpacesGround } from "@/components/ad-space/ground";
import { SlimHeader } from "@/components/ad-space/sections";
import { btnSmallSecondary, card, eyebrow, pill } from "@/components/ad-space/ui";
import { Wordmark } from "@/components/site/Wordmark";
import { STATUS_LABEL, usdFromUsdc } from "@/lib/ad-space/format";
import { getEnquiry, getPublicSpaceById } from "@/lib/ad-space/server";
import type { GuestEnquiry, Space } from "@/lib/ad-space/types";
import { t } from "@/lib/app/i18n";

/**
 * /e/<token>: a brand's question to a seller, for a brand with no HOLD
 * account (spot-enquiries-contract.md). Read and answered here; the seller's
 * replies are announced by email with a fresh link to this page.
 *
 * The token is the thread's only credential, so the page is built like the
 * offer page (/o/<token>) to leak it nowhere: never cached (`force-dynamic`,
 * `Cache-Control: no-store` from next.config.js), never indexed (`noindex`
 * here, `X-Robots-Tag` from next.config.js, `/e/` disallowed in robots.txt),
 * never sent on as a Referer, and never in the title or any analytics call.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your conversation",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  alternates: { canonical: null },
};

export default async function EnquiryPage({ params }: { params: { token: string } }) {
  const found = await getEnquiry(params.token, headers());
  if (found.kind === "missing") notFound();

  // The full space carries the seller's company and logo, the spot's price, and its address.
  const lookup = found.kind === "found" ? await getPublicSpaceById(found.enquiry.space.id) : null;
  const space = lookup?.kind === "found" ? lookup.space : null;

  return (
    <SpacesGround ground={space?.pageGround ?? null}>
      <SlimHeader />
      <main className="container-page max-w-3xl py-10 md:py-16">
        {found.kind === "found" ? (
          <Conversation token={params.token} enquiry={found.enquiry} space={space} />
        ) : (
          <div className="flex min-h-[50vh] flex-col justify-center">
            <p className={`${eyebrow} text-sp-amber`}>HOLD</p>
            <h1 className="mt-5 font-display text-h3 font-light text-sp-ink md:text-h2">{t("enquiries.thread.unreachableTitle")}</h1>
            <p className="mt-5 max-w-xl text-body text-sp-ink/85">{t("enquiries.thread.unreachableBody")}</p>
          </div>
        )}
      </main>
      <footer className="hairline">
        <div className="container-page flex flex-col gap-6 py-10">
          <p className="max-w-xl text-tiny text-sp-ink/80">{t("enquiries.thread.keep")}</p>
          <Wordmark className="h-5 w-auto self-start text-sp-ink/85" />
        </div>
      </footer>
    </SpacesGround>
  );
}

function Conversation({
  token,
  enquiry,
  space,
}: {
  token: string;
  enquiry: GuestEnquiry;
  space: Space | null;
}) {
  const business = space ? businessOf(space.creator) : null;
  // The company's name when it has one, else what the thread calls the seller (their @handle).
  const seller = business?.displayName ?? enquiry.business.name;
  const what = enquiry.position ? `${enquiry.position.label} · ${enquiry.space.title}` : enquiry.space.title;
  const spot = enquiry.position && space ? space.positions.find((p) => p.id === enquiry.position?.id) ?? null : null;
  const spaceHref = space ? `/s/${encodeURIComponent(space.creator.xHandle)}/${encodeURIComponent(space.slug)}` : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className={`${eyebrow} text-sp-amber`}>{t("enquiries.thread.eyebrow")}</p>
        <h1 className="break-words font-display text-h3 font-light text-sp-ink [overflow-wrap:anywhere] md:text-h2">
          {t("enquiries.thread.about", { what })}
        </h1>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {business && <BusinessLogo business={business} size={36} />}
          <span className="text-body text-sp-ink">{t("enquiries.thread.with", { seller })}</span>
          {business?.verified && <VerifiedBusinessMark name={business.displayName} />}
        </div>
      </div>

      {/* The spot card: what was asked about, as the page sells it now. */}
      <div className={`${card} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="min-w-0">
          <p className="break-words text-body text-sp-ink [overflow-wrap:anywhere]">
            {enquiry.position?.label ?? enquiry.space.title}
          </p>
          <p className="mt-1 text-small text-sp-ink/85">
            {[
              enquiry.position ? enquiry.space.title : null,
              spot?.sponsorPaysUsdc && spot.status === "open" ? `${usdFromUsdc(spot.sponsorPaysUsdc)} USDC` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {spot && <span className={pill[spot.status]}>{STATUS_LABEL[spot.status]}</span>}
          {spaceHref && (
            <Link href={spaceHref} className={btnSmallSecondary}>
              {t("enquiries.thread.seeSpace")}
            </Link>
          )}
        </div>
      </div>

      <EnquiryThread token={token} initial={enquiry} seller={seller} />
    </div>
  );
}
