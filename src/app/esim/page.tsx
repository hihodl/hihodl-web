import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { DownloadLink } from "@/components/site/DownloadLink";
import { DestinationSearch, type Destination } from "@/components/esim/DestinationSearch";
import { Fact, GetTheApp, PRIMARY_CTA, Step } from "@/components/esim/ui";
import { COUNTRY_CODES, NOT_ON_SALE, POPULAR, countryFlag, countryName, esimPath, usd } from "@/lib/esim/countries";
import { getEsimPrices, type EsimPrices } from "@/lib/esim/prices";
import { HOLD_KEEPS, bps } from "@/lib/rates.config";

/**
 * /esim: the hub. Find a destination, see what it costs, and why paying from
 * a HOLD balance is the point.
 *
 * WHY THIS IS ITS OWN PAGE AND NOT A SECTION OF /travel
 *
 * Search, and the disclosure rule at the top of rates.config.ts. Nobody types
 * "hold travel products"; they type "esim for japan" the week before they fly,
 * and each destination has its own page under this one (/esim/<country>). One
 * page per product is also what keeps every take published beside its own
 * product and never collected with another.
 *
 * RULES FOR ANYTHING ADDED HERE
 *
 * 1. The money leads. HOLD is a stablecoin account and travel sits on top of
 *    it: the first thing on the page is paying from your balance, the eSIM is
 *    second.
 * 2. Prices come from the backend (lib/esim/prices.ts), never typed in. When
 *    the API cannot be reached the page renders without a number.
 * 3. Never promise coverage. Coverage is the local operator's; /legal/esim is
 *    precise about this and this page must not be looser than it.
 * 4. Every limit that costs a buyer money is on this page, not only in the
 *    terms.
 * 5. Only `HOLD_KEEPS.esim` may be rendered here, and it may not be rendered
 *    anywhere else, country pages included.
 * 6. No other shop is named or priced, ever.
 */

export const revalidate = 3600;

/** What the buyer keeps of the spread. The page renders this, never our share. */
const userShareBps = 10_000 - HOLD_KEEPS.esim.marginShareBps;

function cheapestOf(prices: EsimPrices): number | null {
  if (prices.kind !== "ok") return null;
  return Math.min(...[...prices.byCode.values()].map((r) => r.fromPrice));
}

function destinationsOf(prices: EsimPrices): Destination[] {
  const codes =
    prices.kind === "ok" ? [...prices.byCode.keys()] : COUNTRY_CODES.filter((c) => !NOT_ON_SALE.has(c));
  return codes
    .map((code) => ({
      code,
      name: countryName(code),
      href: esimPath(code),
      flag: countryFlag(code),
      fromPrice: prices.kind === "ok" ? (prices.byCode.get(code)?.fromPrice ?? null) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export async function generateMetadata(): Promise<Metadata> {
  const prices = await getEsimPrices();
  const from = cheapestOf(prices);
  const count = prices.kind === "ok" ? prices.byCode.size : null;
  const title = from !== null ? `eSIM data plans from ${usd(from)}` : "eSIM data plans";
  const description = `Mobile data${count ? ` in ${count} countries` : ""}, paid from your HOLD balance in USDC or EURC. Any chain, no card fees, no FX. Install in one tap before you fly.`;
  return {
    title,
    description,
    alternates: { canonical: "/esim" },
    openGraph: { type: "website", url: "/esim", siteName: "HOLD", title, description, locale: "en_US" },
  };
}

export default async function EsimPage() {
  const prices = await getEsimPrices();
  const destinations = destinationsOf(prices);
  const from = cheapestOf(prices);

  return (
    <>
      <TopNav />

      <main>
        {/* ─── Header: the money first ───────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">eSIM</p>
              <h1 className="mt-6 font-display text-h2 md:text-h1 font-light text-text leading-tight">
                Your balance,
                <br />
                <span className="text-text-muted">on the trip.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Mobile data for {prices.kind === "ok" ? `${prices.byCode.size} countries` : "where you are going"},
                paid from your HOLD balance. Any chain, no card fees, no FX.
                {from !== null && <> Plans from {usd(from)}.</>}
              </p>
              <div className="mt-10">
                <DownloadLink className={PRIMARY_CTA}>Get HOLD</DownloadLink>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Find a destination ────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h3 md:text-h2 font-light text-text">Where are you going?</h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                {prices.kind === "ok"
                  ? "Prices from today's plans, in US dollars. The price you see in the app is the price you pay."
                  : "Today's plans and prices are in the app."}
              </p>
            </div>
            <div className="mt-10 max-w-4xl">
              <DestinationSearch destinations={destinations} popular={[...POPULAR]} />
            </div>
          </div>
        </section>

        {/* ─── Why HOLD ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h3 md:text-h2 font-light text-text">Why buy it with HOLD</h2>
            </div>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <Fact
                title="Pay from your balance"
                body="USDC or EURC from your HOLD account, on any chain we support. No card fees, no FX. Card and Apple Pay work too."
              />
              <Fact
                title="One tap install"
                body="The plan lands in the app. One tap and your phone sets it up. Your own SIM stays where it is."
              />
              <Fact
                title="Top up the same eSIM"
                body="Running low? Add data to the eSIM you already have. Nothing to reinstall."
              />
              <Fact
                title="Unused? Refunded in full"
                body="Plans changed before it started? We cancel it and refund every cent."
              />
              <Fact
                title="HiPoints on every plan"
                body="Every plan earns HiPoints. Spend them on the next one, up to the whole price."
              />
            </div>
          </div>
        </section>

        {/* ─── How it works ──────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <h2 className="font-display text-h3 md:text-h2 font-light text-text">How it works</h2>
            <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Step n={1} title="Pick a country" body="Open HOLD, choose where you are going and how much data you want." />
              <Step n={2} title="Pay from your balance" body="One tap, from your HOLD balance. The price you see is the price you pay." />
              <Step n={3} title="Install and land online" body="One tap installs it. It connects when you arrive." />
            </ol>
          </div>
        </section>

        {/* ─── Before you buy ────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h3 md:text-h2 font-light text-text">Before you buy</h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                The limits that cost money, here and not only in the terms.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Fact
                title="Data only"
                body="No phone number, so no calls or texts, including bank codes by SMS. WhatsApp, maps, email and HOLD work as they do at home."
              />
              <Fact
                title="Your phone has to take it"
                body="It needs eSIM support and must not be locked to a carrier. Most phones from the last few years qualify; one bought on contract often does not."
              />
              <Fact
                title="Coverage is the local network's"
                body="We show which country a plan covers. We cannot promise a signal, a speed or a network generation at a given address."
              />
              <Fact
                title="A few destinations are not on sale"
                body="Some countries have no plans in the app, the United Arab Emirates among them. If a country is not listed here, it is not on sale."
              />
            </div>
            <p className="mt-12 text-small text-text-faint max-w-2xl">
              The full terms of sale, including when a plan starts and what happens to an unused one, are in the{" "}
              <Link href="/legal/esim" className="text-text-muted hover:text-text underline">
                eSIM Terms of Sale
              </Link>
              .
            </p>

            {/* Every product page carries this section, and it names only the
                take that belongs to that product. See rates.config.ts. */}
            <div className="mt-20 max-w-2xl border-t border-white/10 pt-10">
              <h2 className="font-display text-h3 md:text-h2 font-light text-text">How we make money here</h2>
              <div className="mt-8 space-y-6 text-body text-text-muted">
                <p>
                  We buy data wholesale and sell it at our own price. That spread is all we make: no booking fee,
                  no card fee, no FX fee, nothing for a plan that sits unused.
                </p>
                <p className="text-text">
                  Then {bps(userShareBps)} of what we make on the sale comes back to you as HiPoints, credited when
                  the order completes. We keep the rest. So the cheaper the plan, the smaller the reward: it is a
                  share of a real margin.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Every destination, for people and crawlers ────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <h2 className="font-display text-h3 md:text-h2 font-light text-text">All destinations</h2>
            <ul className="mt-10 columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8">
              {destinations.map((d) => (
                <li key={d.code} className="break-inside-avoid">
                  <Link
                    href={d.href}
                    className="flex items-center gap-3 py-2 text-small text-text-muted hover:text-text transition-colors"
                  >
                    <span aria-hidden>{d.flag}</span>
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    {d.fromPrice !== null && <span className="text-text-faint">{usd(d.fromPrice)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <GetTheApp
          title="Get HOLD, then get online."
          body="Plans are bought in the app. Free to download, ready in a minute."
        />
      </main>

      <Footer />
    </>
  );
}
