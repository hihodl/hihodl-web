import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import {
  ASSETS,
  HIPOINT_USD,
  PROVISIONAL_LABEL,
  RATES_MEASURED_ON,
  RATE_DISCLAIMER,
  TIERS,
  bestLtvPct,
  bestNetApyPct,
  blendedCashbackBps,
  bps,
  headlineCashbackBps,
  netApyPct,
  pct,
  usd,
} from "@/lib/rates.config";

/**
 * /rewards — how rewards work.
 *
 * Structure mirrors what the market already trained people to read: a tier
 * comparison, then an asset table with the rate and the borrowing limit side by
 * side, then footnotes. Nobody needs to learn a new layout to compare us.
 *
 * Two rules this page enforces in code, not in review:
 *
 * 1. EVERY headline is "up to". Yields float and bands step down, so a flat
 *    claim is false the moment the market moves. `bestNetApyPct()` and
 *    `headlineCashbackBps()` are always rendered behind "up to".
 * 2. EVERY rate on this page is NET of our share. `netApyPct()` runs the market
 *    rate through the tier's fee before it is displayed. The savings share
 *    itself belongs to Smart Account and is stated on /smart-account, linked
 *    from the tables here. There is no aggregate fee page and there will not be
 *    one — see the rule at the top of rates.config.ts.
 *
 * Tier names, prices and cashback bands are not final. They render straight
 * from src/lib/rates.config.ts with a provisional marker, so signing them off
 * is one edit to one file.
 */

export const metadata: Metadata = {
  title: "Rewards",
  description:
    "How HOLD rewards work: plan tiers, cashback bands and monthly limits, and what every asset earns and can borrow against. Rates are variable and not guaranteed.",
  alternates: { canonical: "/rewards" },
};

export default function RewardsPage() {
  const measured = new Date(RATES_MEASURED_ON).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const bestApy = bestNetApyPct();
  const bestLtv = bestLtvPct();
  const bestCashback = Math.max(...TIERS.map((t) => headlineCashbackBps(t.id)));
  const anyProvisional = TIERS.some((t) => t.provisional);

  // The tier whose savings terms are best — the one the "up to" APY belongs to.
  const bestTier = TIERS.reduce((a, b) =>
    a.savingsInterestShareBps <= b.savingsInterestShareBps ? a : b,
  );

  return (
    <>
      <TopNav />

      <main>
        {/* ─── Header ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">Rewards</p>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                Three ways your
                <br />
                <span className="text-text-muted">money pays you back.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                What your balance earns, what your card gives back, and what you can borrow
                without selling. Every rate below is what you receive.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Headline
                label="Your balance earns"
                value={`up to ${pct(bestApy)}`}
                sub={`Annual rate, net of everything. ${bestTier.name} plan.`}
              />
              <Headline
                label="Your card gives back"
                value={`up to ${bps(bestCashback)}`}
                sub="On the first slice of what you spend each month."
              />
              <Headline
                label="You can borrow"
                value={`up to ${bestLtv}%`}
                sub="Of what you hold, without selling any of it."
              />
            </div>

            <p className="mt-8 text-small text-text-faint">
              <span aria-hidden>* </span>
              {RATE_DISCLAIMER} Measured {measured}.
            </p>
          </div>
        </section>

        {/* ─── Tier comparison ───────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">Plans</h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Cashback steps down as you spend more in a month and stops at a monthly
                limit. That is how every honest banded programme works, and it is why the
                headline is a first slice rather than a flat rate on everything.
              </p>
              {anyProvisional && (
                <p className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-pill border border-amber/30 bg-amber/[0.05] text-small text-text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber shrink-0" aria-hidden />
                  {PROVISIONAL_LABEL} — names, prices and bands may still change.
                </p>
              )}
            </div>

            <div className="mt-12 overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr>
                    <th scope="col" className="pb-4 border-b border-[color:var(--color-hairline-strong)]" />
                    {TIERS.map((t) => (
                      <th
                        key={t.id}
                        scope="col"
                        className="pb-4 pl-6 text-right border-b border-[color:var(--color-hairline-strong)]"
                      >
                        <span className="block font-display text-h4 font-light text-text">
                          {t.name}
                        </span>
                        <span className="block mt-1 text-tiny text-text-faint font-normal">
                          {t.tagline}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow
                    label="Monthly fee"
                    render={(t) => (t.priceUsdMonthly === 0 ? "Free" : usd(t.priceUsdMonthly))}
                  />
                  <ComparisonRow
                    label="How you qualify"
                    plain
                    render={(t) => t.gate ?? "Open to anyone"}
                  />
                  <ComparisonRow
                    label="Cashback"
                    accent
                    render={(t) => `up to ${bps(headlineCashbackBps(t.id))}`}
                  />
                  <ComparisonRow
                    label="Top rate applies to"
                    render={(t) => `first ${usd(t.cashbackBands[0].uptoUsd ?? 0)}/mo`}
                  />
                  <ComparisonRow
                    label="Monthly cashback limit"
                    render={(t) => `${usd(t.cashbackMonthlyCapUsd)}/mo`}
                  />
                  <ComparisonRow
                    label="Typical rate at $1,500/mo"
                    render={(t) => `${bps(Math.round(blendedCashbackBps(t.id, 1500)))}`}
                  />
                  <ComparisonRow
                    label="US dollars and euros"
                    render={(t) => bps(t.fxUsdEurBps)}
                  />
                  <ComparisonRow
                    label="Every other currency"
                    render={(t) => bps(t.fxOtherBps)}
                  />
                  <ComparisonRow
                    label="You keep of savings interest"
                    accent
                    render={(t) => bps(10_000 - t.savingsInterestShareBps)}
                  />
                  <ComparisonRow label="Swap markup" render={(t) => bps(t.swapMarkupBps)} />
                  <ComparisonRow
                    label="Partner perks"
                    plain
                    render={(t) => (t.perkPack ? "Included" : "—")}
                  />
                </tbody>
              </table>
            </div>

            <ul className="mt-8 flex flex-col gap-2 max-w-3xl">
              <Note>
                Cashback bands step down within a month. &ldquo;Typical rate&rdquo; is what
                someone spending $1,500 a month actually blends to across all the bands and
                after the monthly limit — the honest average behind the headline.
              </Note>
              <Note>
                Cashback is paid in dollars into your savings, where it keeps earning. It is
                withdrawable money, not store credit.
              </Note>
              <Note>
                Cash-like purchases earn nothing: ATM withdrawals, money transfers,
                stored-value top-ups, gambling and tax payments.
              </Note>
              <Note>
                {RATE_DISCLAIMER} Cashback is paid out of what the card networks
                pay us on a purchase. We are not passing on a cost — if a
                purchase earns nothing, it is because we were paid nothing on it.
              </Note>
            </ul>
          </div>
        </section>

        {/* ─── Asset table ───────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="blue" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                What each currency earns
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Two numbers matter for anything you hold: what it earns while it sits there,
                and how much you can borrow against it without selling it. Here they are
                side by side, on the {bestTier.name} plan.
              </p>
            </div>

            <div className="mt-12 overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
              <table className="w-full min-w-[600px] border-collapse text-left">
                <thead>
                  <tr>
                    {["Currency", "Where", "You earn", "You can borrow"].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`pb-4 text-tiny uppercase tracking-wider text-text-faint font-normal border-b border-[color:var(--color-hairline-strong)] ${
                          i === 0 ? "" : "text-right pl-6"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ASSETS.map((asset) => {
                    const net = netApyPct(asset.grossApyPct, bestTier.id);
                    return (
                      <tr key={`${asset.symbol}-${asset.venue}`}>
                        <td className="py-4 pr-6 border-b border-[color:var(--color-hairline)]">
                          <span className="text-body text-text">{asset.label}</span>
                          {asset.note && (
                            <span className="block mt-1 text-small text-text-faint">
                              {asset.note}
                            </span>
                          )}
                        </td>
                        <td className="py-4 pl-6 text-right align-top border-b border-[color:var(--color-hairline)]">
                          <span className="text-small text-text-muted">{asset.venue}</span>
                        </td>
                        <td className="py-4 pl-6 text-right align-top border-b border-[color:var(--color-hairline)]">
                          <span className="font-mono tabular-nums text-body text-amber">
                            up to {pct(net)}
                          </span>
                          <span className="text-text-faint" aria-hidden>
                            *
                          </span>
                        </td>
                        <td className="py-4 pl-6 text-right align-top border-b border-[color:var(--color-hairline)]">
                          <span className="font-mono tabular-nums text-body text-text">
                            {asset.maxLtvPct === 0 ? "—" : `${asset.maxLtvPct}%`}
                          </span>
                          <span className="text-text-faint" aria-hidden>
                            *
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="mt-8 flex flex-col gap-2 max-w-3xl">
              <Note>
                {RATE_DISCLAIMER} Rates are set by third-party lending markets, not by us,
                and they move every block. Measured {measured}.
              </Note>
              <Note>
                &ldquo;You earn&rdquo; is the net rate on the {bestTier.name} plan, after our
                share of the interest. We keep a share of what your balance earns
                and never a share of the balance itself — the split for each plan
                is in the table above, and{" "}
                <Link href="/smart-account" className="text-amber hover:underline">
                  how that works
                </Link>{" "}
                is explained in full.
              </Note>
              <Note>
                &ldquo;You can borrow&rdquo; is the maximum the lending market allows against
                that asset. We lend below it, and a loan can be closed out by the market if
                the value of what backs it falls far enough.
              </Note>
              <Note>
                A dash means the market does not accept that currency as backing for a loan.
                It still earns.
              </Note>
            </ul>
          </div>
        </section>

        {/* ─── HiPoints ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">HiPoints</h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Points are the currency inside the product. You earn them by moving and
                holding money, and you spend them on your plan, on our fees, and on partner
                perks. One point is {usd(HIPOINT_USD)}.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card
                title="Earn"
                body="On swaps and on money you put to work. Deposits are the ticket to earn, not the thing rewarded."
              />
              <Card
                title="Spend"
                body="Pay your plan with points, or cover a fee. Points never expire quietly — you get a reminder before they do."
              />
              <Card
                title="Perks"
                body="Redeem against partner perks. The list grows as agreements are signed; we name a partner once the deal is done."
              />
            </div>

            <ul className="mt-8 flex flex-col gap-2 max-w-3xl">
              <Note>Points expire 12 months after they are earned.</Note>
              <Note>
                Points are not cashback and do not convert to cash. Cashback is paid in
                dollars, separately.
              </Note>
            </ul>

            {/* Every product page carries this section, and it names only the
                take that belongs to that product. See rates.config.ts. */}
            <div className="mt-20 max-w-2xl border-t border-white/10 pt-10">
              <h2 className="font-display text-h2 font-light text-text">
                How we make money here
              </h2>
              <div className="mt-8 space-y-6 text-body text-text-muted">
                <p>
                  Three ways, and none of them is a charge on your balance.
                </p>
                <p>
                  <span className="text-text">You may pay for a plan.</span> The
                  price of each one is in the table above, and the free plan stays
                  free. That is the only thing on this page you ever pay us
                  directly.
                </p>
                <p>
                  <span className="text-text">Card networks pay us when you
                  spend.</span> Every card in the world earns its issuer a small
                  cut of a purchase, paid by the merchant&rsquo;s bank rather than by
                  you. Most issuers keep it. Cashback is us handing part of it
                  back, which is why cash-like purchases earn nothing — nobody
                  pays us on those.
                </p>
                <p>
                  <span className="text-text">We keep a share of the interest
                  your balance earns.</span> Never a share of the balance itself.
                  The exact split, and what it is a share of, is set out on{" "}
                  <Link href="/smart-account" className="text-amber hover:underline">
                    the Smart Account page
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

function Headline({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03]">
      <p className="text-tiny uppercase tracking-wider text-text-faint">{label}</p>
      <p className="mt-5 font-display text-h2 font-light text-amber tabular-nums">
        {value}
        <span className="text-text-faint text-h4" aria-hidden>
          *
        </span>
      </p>
      <p className="mt-4 text-small text-text-muted">{sub}</p>
    </div>
  );
}

function ComparisonRow({
  label,
  render,
  accent,
  plain,
}: {
  label: string;
  render: (tier: (typeof TIERS)[number]) => string;
  accent?: boolean;
  plain?: boolean;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="py-4 pr-6 text-left font-normal text-small text-text-muted align-top border-b border-[color:var(--color-hairline)]"
      >
        {label}
      </th>
      {TIERS.map((t) => (
        <td
          key={t.id}
          className="py-4 pl-6 text-right align-top border-b border-[color:var(--color-hairline)]"
        >
          <span
            className={
              plain
                ? "text-small text-text-muted"
                : `font-mono tabular-nums text-body ${accent ? "text-amber" : "text-text"}`
            }
          >
            {render(t)}
          </span>
        </td>
      ))}
    </tr>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03]">
      <h3 className="font-display text-h4 font-light text-text">{title}</h3>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-small text-text-faint leading-relaxed">
      <span aria-hidden>* </span>
      {children}
    </li>
  );
}
