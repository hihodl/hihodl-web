import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ProfileFooter } from "@/components/ad-space/creator";
import { SpacesGround } from "@/components/ad-space/ground";
import { ReportHeader, ReportItems, ReportSellers, ReportSummary } from "@/components/ad-space/report";
import { SlimHeader } from "@/components/ad-space/sections";
import { eyebrow } from "@/components/ad-space/ui";
import { getSponsorReport } from "@/lib/ad-space/server";
import { t } from "@/lib/app/i18n";
import { applyRequestLocale } from "@/lib/app/i18n/server";

/**
 * /r/<token> — a sponsor's report after the event
 * (a-sponsor-gets-its-report-contract.md): what they bought, the proof the
 * seller posted, the QR scans per day on their spots, where each delivery
 * stands and the invoice. Printable: "Download PDF" is the browser's print
 * dialog, and the print styles below turn the navy ground white.
 *
 * The token opens this page and nothing else (it cannot pay, confirm, dispute
 * or edit), and the report is made to be forwarded. It is still a bearer
 * link: never cached (`force-dynamic`, `Cache-Control: no-store` from
 * next.config.js), never indexed (`noindex` here, `X-Robots-Tag`, `/r/`
 * disallowed in robots.txt), never sent on as a Referer, and kept out of the
 * title and every analytics call. The link card names the event only.
 */

export const dynamic = "force-dynamic";

type Params = { token: string };

const load = cache((token: string) => getSponsorReport(token, headers()));

const NOINDEX: Metadata["robots"] = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await applyRequestLocale();
  const found = await load(params.token);
  const base: Metadata = { robots: NOINDEX, referrer: "no-referrer", alternates: { canonical: null } };
  if (found.kind !== "found") return { ...base, title: t("publicPages.report.eyebrow") };
  const event = found.report.event.name;
  const title = t("publicPages.report.metaTitle", { event });
  const description = t("publicPages.report.metaDescription", { event });
  return {
    ...base,
    title,
    description,
    openGraph: { type: "website", siteName: "HOLD", title, description },
    twitter: { card: "summary", site: "@hiihodl", title, description },
  };
}

/**
 * Print: the ground goes white and the ink dark (the light ground's own
 * values), the header, footer and buttons go, and an item never splits
 * across two pages.
 */
const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  html, body { background: #fff !important; }
  [data-sp-ground] { background: #fff !important; }
  [data-sp-ground] > .fixed { display: none !important; }
  [data-sp-report] {
    --sp-ink: 10 20 30;
    --sp-amber-ink: 138 90 0;
    --sp-ok-ink: 21 128 61;
    --sp-cool-ink: 58 86 212;
    color: rgb(10 20 30);
  }
  [data-sp-report] a { text-decoration: none; }
  [data-sp-report-chrome] { display: none !important; }
}
`;

export default async function ReportPage({ params }: { params: Params }) {
  await applyRequestLocale();
  const found = await load(params.token);
  if (found.kind === "missing") notFound();

  return (
    <SpacesGround>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div data-sp-report-chrome>
        <SlimHeader />
      </div>
      <main data-sp-report className="container-page flex max-w-4xl flex-col gap-10 py-10 md:gap-12 md:py-14">
        {found.kind === "found" ? (
          <>
            <ReportHeader report={found.report} now={Date.now()} />
            <ReportSummary report={found.report} />
            <ReportSellers sellers={found.report.sellers} />
            <ReportItems report={found.report} />
            <p className="text-tiny text-sp-ink/75">{t("publicPages.report.footer")}</p>
            <p className="hidden text-tiny text-sp-ink/75 print:block">HOLD · hihodl.xyz</p>
          </>
        ) : (
          <div className="flex min-h-[50vh] flex-col justify-center">
            <p className={`${eyebrow} text-sp-amber`}>HOLD</p>
            <h1 className="mt-5 font-display text-h3 font-light text-sp-ink md:text-h2">{t("publicPages.report.unreachableTitle")}</h1>
            <p className="mt-5 max-w-xl text-body text-sp-ink/85">{t("publicPages.report.unreachableBody")}</p>
          </div>
        )}
      </main>
      <div data-sp-report-chrome className="mt-auto">
        <ProfileFooter />
      </div>
    </SpacesGround>
  );
}
