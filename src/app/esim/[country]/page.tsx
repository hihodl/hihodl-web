import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { DownloadLink } from "@/components/site/DownloadLink";
import { Faq, GetTheApp, JsonLd, PRIMARY_CTA, PlanCard, SECONDARY_CTA, Step } from "@/components/esim/ui";
import {
  COUNTRY_CODES,
  NOT_ON_SALE,
  codeFromSlug,
  countryFlag,
  countryName,
  countrySlug,
  esimPath,
  usd,
} from "@/lib/esim/countries";
import { getEsimPrices, type EsimCountryPrice } from "@/lib/esim/prices";

/**
 * /esim/<country>: "eSIM for Japan from $X", for somebody who searched exactly
 * that the week before they fly.
 *
 * Built at deploy for every country the price API returns and refreshed every
 * hour (ISR). A country the build did not know renders on its first visit.
 *
 * ── Which countries have a page ──
 * The API is the list: a country it does not return is not on sale and gets a
 * 404, the same answer the app gives. When the API cannot be reached the page
 * still renders, without a price, for any real country except the ones the app
 * never sells (NOT_ON_SALE), so an outage never takes the pages down and never
 * builds one for a destination we refuse.
 *
 * Rules from /esim apply: the money leads, prices only from the API, no other
 * shop named or priced, and our take is not rendered here.
 */

type Params = { country: string };

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  const prices = await getEsimPrices();
  if (prices.kind !== "ok") return [];
  return [...prices.byCode.keys()].map((code) => ({ country: countrySlug(code) }));
}

type Resolved = { code: string; name: string; row: EsimCountryPrice | null };

/** The country behind the URL and its prices; null when there is no page. */
async function resolve(slug: string): Promise<Resolved | null> {
  const code = codeFromSlug(slug);
  if (!code) return null;
  const prices = await getEsimPrices();
  if (prices.kind === "ok") {
    const row = prices.byCode.get(code);
    return row ? { code, name: countryName(code), row } : null;
  }
  return NOT_ON_SALE.has(code) ? null : { code, name: countryName(code), row: null };
}

/** /esim/jp and /esim/JP land on /esim/japan. */
function redirectFromCode(slug: string): void {
  const cc = slug.toUpperCase();
  if (/^[A-Z]{2}$/.test(cc) && COUNTRY_CODES.includes(cc)) permanentRedirect(esimPath(cc));
}

function titleOf({ name, row }: Resolved): string {
  return row ? `eSIM for ${name}: data from ${usd(row.fromPrice)} | HOLD` : `eSIM for ${name}: mobile data | HOLD`;
}

function descriptionOf({ name, row }: Resolved): string {
  const from = row ? ` from ${usd(row.fromPrice)}` : "";
  return `Mobile data for ${name}${from}, paid from your HOLD balance in USDC or EURC. No card fees, no FX. Install in one tap before you fly.`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await resolve(params.country);
  if (!found) return { title: "eSIM", robots: { index: false, follow: false } };
  const path = esimPath(found.code);
  const title = titleOf(found);
  const description = descriptionOf(found);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, siteName: "HOLD", title, description, locale: "en_US" },
    twitter: { card: "summary", title, description },
  };
}

function productJsonLd({ code, name, row }: Resolved) {
  if (!row) return null;
  const highPrice = Math.max(row.fromPrice, ...row.plans.map((p) => p.price));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `eSIM for ${name}`,
    description: descriptionOf({ code, name, row }),
    brand: { "@type": "Brand", name: "HOLD" },
    url: `https://hihodl.xyz${esimPath(code)}`,
    category: "eSIM data plan",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: row.fromPrice.toFixed(2),
      highPrice: highPrice.toFixed(2),
      offerCount: Math.max(row.planCount, row.plans.length, 1),
      availability: "https://schema.org/InStock",
    },
  };
}

export default async function EsimCountryPage({ params }: { params: Params }) {
  const found = await resolve(params.country);
  if (!found) {
    redirectFromCode(params.country);
    notFound();
  }
  const { code, name, row } = found;
  const flag = countryFlag(code);
  const jsonLd = productJsonLd(found);

  return (
    <>
      <TopNav />
      {jsonLd && <JsonLd data={jsonLd} />}

      <main>
        {/* ─── Header ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-small text-text-faint">
                <Link href="/esim" className="hover:text-text underline underline-offset-4">
                  eSIM
                </Link>
                <span className="mx-2" aria-hidden>
                  /
                </span>
                {name}
              </p>
              <p className="mt-8 text-h2 leading-none" aria-hidden>
                {flag}
              </p>
              <h1 className="mt-6 font-display text-h3 sm:text-h2 md:text-h1 font-light text-text leading-tight break-words">
                eSIM for {name}
                {row && (
                  <>
                    <br />
                    <span className="text-text-muted">from {usd(row.fromPrice)}</span>
                  </>
                )}
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Pay from your HOLD balance, on any chain. No card fees, no FX. Install it in one tap before you fly.
              </p>
              {row?.typical10gb && (
                <p className="mt-4 text-body text-text-faint">
                  A month with 10 GB: {usd(row.typical10gb.price)}.
                </p>
              )}
              <div className="mt-10 flex flex-wrap gap-3">
                <DownloadLink className={PRIMARY_CTA}>Get HOLD</DownloadLink>
                <a href="#plans" className={SECONDARY_CTA}>
                  See plans
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Plans ─────────────────────────────────────────────── */}
        <section id="plans" className="relative overflow-hidden bg-abyss scroll-mt-20">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h3 md:text-h2 font-light text-text">Plans for {name}</h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                {row
                  ? `A few of today's ${row.planCount} plans, in US dollars. The app shows them all, and the price you see is the price you pay.`
                  : "Today's plans and prices are in the app."}
              </p>
            </div>
            {row && row.plans.length > 0 && (
              <ul className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {row.plans.map((p) => (
                  <PlanCard key={`${p.days}-${p.dataMb ?? "unl"}`} plan={p} />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ─── How it works ──────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <h2 className="font-display text-h3 md:text-h2 font-light text-text">How it works</h2>
            <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Step n={1} title={`Pick ${name}`} body="Open HOLD and choose how much data you want." />
              <Step n={2} title="Pay from your balance" body="One tap, in USDC or EURC. No card fees, no FX." />
              <Step n={3} title="Install and land online" body={`One tap installs it. It connects when you land in ${name}.`} />
            </ol>
          </div>
        </section>

        {/* ─── FAQ ───────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <h2 className="font-display text-h3 md:text-h2 font-light text-text">Questions</h2>
            <div className="mt-10 max-w-3xl space-y-3">
              <Faq
                q="Will my phone work?"
                a="Yes, if it supports eSIM and is not locked to a carrier. Most phones from the last few years do. A phone bought on contract may be locked."
              />
              <Faq
                q="When should I install it?"
                a={`Before you fly, on WiFi. Some plans start counting when you install them, most when your phone first connects in ${name}. The app tells you which before you pay.`}
              />
              <Faq
                q="How do I pay?"
                a="From your HOLD balance in USDC or EURC, on any chain we support, with no card fees and no FX. Card and Apple Pay work too."
              />
              <Faq
                q="What if it doesn't work?"
                a={`Trip guarantee: if the eSIM will not install, or never connects in ${name}, we replace it or refund it in full, HiPoints included.`}
              />
              <Faq
                q="Do I get a phone number?"
                a="No. It is data only, so no calls or texts, including bank codes by SMS. WhatsApp, maps and HOLD work as they do at home."
              />
            </div>
            <p className="mt-10 text-small text-text-faint max-w-2xl">
              Full terms in the{" "}
              <Link href="/legal/esim" className="text-text-muted hover:text-text underline">
                eSIM Terms of Sale
              </Link>
              . Other destinations on the{" "}
              <Link href="/esim" className="text-text-muted hover:text-text underline">
                eSIM page
              </Link>
              .
            </p>
          </div>
        </section>

        <GetTheApp
          title={`Your balance, on the trip to ${name}.`}
          body="Plans are bought in the app. Free to download, ready in a minute."
        />
      </main>

      <Footer />
    </>
  );
}
