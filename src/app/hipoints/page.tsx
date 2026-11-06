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
  PUBLIC_TIERS,
  bestLtvPct,
  blendedCashbackBps,
  bps,
  headlineCashbackBps,
  netApyPct,
  pct,
  usd,
} from "@/lib/rates.config";

/**
 * /hipoints — how HOLD pays you back.
 *
 * Was /rewards until 16-aug-2026. "Rewards" and "HiPoints" were two names for
 * one thing: the app has never had a screen called Rewards, and the nav, the
 * homepage and the ledger all say HiPoints. Keeping both meant a customer read
 * one word on the site and met a different one in the product. /rewards 301s
 * here. If card rewards and HiPoints ever become genuinely different currencies
 * this splits again — today they are not, so it does not.
 *
 * Structure mirrors what the market already trained people to read: a tier
 * comparison, then an asset table with the rate and the borrowing limit side by
 * side, then footnotes. Nobody needs to learn a new layout to compare us.
 *
 * Three rules this page enforces in code, not in review:
 *
 * 0. It promises only what the product pays TODAY. Since 6-nov-2026: HiPoints
 *    are earned on stays and invites (not flights, eSIMs, experiences, swaps or
 *    balances), the HOLD card does not exist yet and no cashback is paid. The
 *    plan table stays as a provisional plan and must never read as live. The
 *    savings headline points to the live rate in the app instead of a number
 *    measured once, because a rate quoted here goes stale on its own.
 * 1. EVERY rate is "up to". Yields float and bands step down, so a flat claim
 *    is false the moment the market moves.
 * 2. EVERY rate on this page is NET of our share. `netApyPct()` runs the market
 *    rate through the tier's fee before it is displayed. The savings share
 *    itself belongs to Savings and is stated on /savings, linked
 *    from the tables here. There is no aggregate fee page and there will not be
 *    one — see the rule at the top of rates.config.ts.
 *
 * Tier names, prices and cashback bands are not final. They render straight
 * from src/lib/rates.config.ts with a provisional marker, so signing them off
 * is one edit to one file.
 */

export const metadata: Metadata = {
  title: "HiPoints",
  description:
    "HiPoints: earned on stays and by inviting friends, worth $0.01 each off our part of a price, and spent at checkout. Plus the provisional plans for the HOLD card, which is not available yet, and what each asset can borrow against. Rates are variable and not guaranteed.",
  alternates: { canonical: "/hipoints" },
};

export default function HiPointsPage() {
  const measured = new Date(RATES_MEASURED_ON).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const bestLtv = bestLtvPct();
  const anyProvisional = PUBLIC_TIERS.some((t) => t.provisional);

  // The tier whose savings terms are best — the one the "up to" APY belongs to.
  const bestTier = PUBLIC_TIERS.reduce((a, b) =>
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
              <p className="text-tiny uppercase tracking-wider text-moonlight">HiPoints</p>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                What HOLD pays you back,
                <br />
                <span className="text-text-muted">and what it does not yet.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Today you earn HiPoints on stays and by inviting friends, and your savings earn
                a variable rate you can see live in the app. The HOLD card is not available yet,
                so no cashback is paid. Every rate below is net of our share, and where a row is
                not somewhere a HOLD balance can be supplied, it says so.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Headline
                label="Your dollars earn"
                value="Live rate"
                sub="Variable, net of our share. Today's rate is in the app, on Savings."
              />
              <Headline
                label="One HiPoint is"
                value={usd(HIPOINT_USD)}
                sub="Off our part of a price at checkout. Earned on stays and invites."
                marked={false}
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
              <p className="mt-6 text-body text-text leading-relaxed">
                The HOLD card is not available yet, and no cashback is paid today.
              </p>
              <p className="mt-4 text-body text-text-muted leading-relaxed">
                The table below is our plan for the card, not something you can sign up for.
                When it launches, cashback is planned to step down as you spend more in a
                month and stop at a monthly limit, which is why the top rate applies only to a
                first slice of spending, not to everything.
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
                    {PUBLIC_TIERS.map((t) => (
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
                    label="Planned card cashback"
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
                No cashback is paid today. The cashback rows describe the HOLD card, which is
                not available yet, and they start only when it launches.
              </Note>
              <Note>
                Planned cashback bands step down within a month. &ldquo;Typical rate&rdquo; is
                what someone spending $1,500 a month would blend to across all the bands and
                after the monthly limit, the honest average behind the top rate.
              </Note>
              <Note>
                Once the card launches, cash-like purchases will earn nothing: ATM
                withdrawals, money transfers, stored-value top-ups, gambling and tax payments.
              </Note>
              <Note>
                {RATE_DISCLAIMER} Planned cashback would be paid out of what the card networks
                pay us on a purchase. If a purchase would earn nothing, it is because we
                would be paid nothing on it.
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
                <Link href="/savings" className="text-amber hover:underline">
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
                Points are the rewards inside the product. You earn them on stays and by
                inviting friends, and you spend them at checkout. One point is{" "}
                {usd(HIPOINT_USD)} off our part of a price.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card
                title="Earn"
                body="On stays, credited after check-out and pending until then. And by inviting friends: 2,500 points for you and 1,000 for them when they book a $100 stay or keep $100 in Savings for 30 days, within 90 days. Up to 10 friends."
              />
              <Card
                title="Spend"
                body="At checkout on stays, flights, eSIMs and experiences, and on some fees, where the app offers it. Flights, eSIMs and experiences can be paid with points but do not earn them."
              />
              <Card
                title="Not money"
                body="Points are a discount, not money. They cannot be withdrawn, cashed out, sold or transferred."
              />
            </div>

            <ul className="mt-8 flex flex-col gap-2 max-w-3xl">
              <Note>
                Points expire 180 days after they are credited. The ones that expire soonest
                are used first, and you get a reminder before any expire.
              </Note>
              <Note>Points are not cashback and do not convert to cash.</Note>
              <Note>
                If a booking is cancelled, the points you spent on it usually come back with a
                fresh 180 days, and points it would have earned are not credited. The full
                rules, exceptions included, are in the{" "}
                <Link href="/legal/hipoints" className="text-amber hover:underline">
                  HiPoints Terms
                </Link>
                .
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
                  Not by charging your balance.
                </p>
                <p>
                  <span className="text-text">We keep a share of the interest
                  your balance earns.</span> Never a share of the balance itself.
                  The exact split, and what it is a share of, is set out on{" "}
                  <Link href="/savings" className="text-amber hover:underline">
                    the Smart Account page
                  </Link>
                  .
                </p>
                <p>
                  <span className="text-text">Once the card launches, card
                  networks will pay us when you spend.</span> Every card in the
                  world earns its issuer a small cut of a purchase, paid by the
                  merchant&rsquo;s bank rather than by you. Most issuers keep it.
                  Planned cashback is us handing part of it back, which is why
                  cash-like purchases will earn nothing: nobody pays us on those.
                  Until then there is no card and no cashback.
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

function Headline({
  label,
  value,
  sub,
  marked = true,
}: {
  label: string;
  value: string;
  sub: string;
  /** Points at the rate footnote. Off for a value that is not a rate. */
  marked?: boolean;
}) {
  return (
    <div className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03]">
      <p className="text-tiny uppercase tracking-wider text-text-faint">{label}</p>
      <p className="mt-5 font-display text-h2 font-light text-amber tabular-nums">
        {value}
        {marked && (
          <span className="text-text-faint text-h4" aria-hidden>
            *
          </span>
        )}
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
  render: (tier: (typeof PUBLIC_TIERS)[number]) => string;
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
      {PUBLIC_TIERS.map((t) => (
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
