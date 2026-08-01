import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import {
  ASSETS,
  FX_CORRIDORS,
  HIHODL_KEEPS,
  PROVISIONAL_LABEL,
  RATES_MEASURED_ON,
  RATE_DISCLAIMER,
  TIERS,
  bps,
  usd,
} from "@/lib/rates.config";

/**
 * /fees — the fee schedule.
 *
 * THE ONLY PAGE IN THE PRODUCT THAT STATES WHAT HIHODL KEEPS.
 *
 * Every other surface states what the user receives, net. This one states both
 * sides, because a company that publishes only the net number is asking to be
 * taken on trust, and the whole pitch is that we do not need to be.
 *
 * Deliberately plain. No gradients, no CTA, no persuasion — tables and
 * footnotes. If a number here needs a sentence of framing to look acceptable,
 * the number is the problem, not the framing.
 *
 * Every figure comes from src/lib/rates.config.ts. Nothing is typed inline.
 */

export const metadata: Metadata = {
  title: "Fee schedule",
  description:
    "Every fee HIHODL charges and every share HIHODL keeps, on one page: our cut of savings interest, FX by corridor, the ATM fee and the swap fee.",
  alternates: { canonical: "/fees" },
};

export default function FeesPage() {
  const measured = new Date(RATES_MEASURED_ON).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <TopNav />

      <main className="bg-abyss">
        <div className="container-page section">
          {/* ── Header ─────────────────────────────────────────── */}
          <header className="max-w-3xl">
            <p className="text-tiny uppercase tracking-wider text-text-faint">Fee schedule</p>
            <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
              What you pay,
              <br />
              <span className="text-text-muted">and what we keep.</span>
            </h1>
            <p className="mt-8 text-lead text-text-muted">
              This is the complete list. If a fee is not on this page, we do not charge it.
            </p>
            <p className="mt-6 text-small text-text-faint">
              Rates last measured {measured}. {RATE_DISCLAIMER}
            </p>
          </header>

          {/* ── 1. Plans ───────────────────────────────────────── */}
          <Section title="Plans">
            <Table
              head={["Plan", "Monthly", "How you qualify"]}
              rows={TIERS.map((t) => [
                <span key="n" className="text-text">
                  {t.name}
                  {t.provisional && <Star />}
                </span>,
                <Num key="p">{t.priceUsdMonthly === 0 ? "Free" : usd(t.priceUsdMonthly)}</Num>,
                <span key="g" className="text-text-muted">
                  {t.gate ?? "Open to anyone"}
                </span>,
              ])}
            />
            <Footnotes
              items={[
                `${PROVISIONAL_LABEL} — plan names, prices and terms are not signed off and may still change.`,
              ]}
            />
          </Section>

          {/* ── 2. Spending ────────────────────────────────────── */}
          <Section title="Spending and currency conversion">
            <Table
              head={["Currency", ...TIERS.map((t) => t.name)]}
              rows={FX_CORRIDORS.map((c) => [
                <span key="c" className="text-text">
                  {c.label}
                </span>,
                ...TIERS.map((t) => (
                  <Num key={t.id}>{bps(c.userPaysBps[t.id])}</Num>
                )),
              ])}
            />
            <Footnotes
              items={[
                "0% means no markup: you get the wholesale rate the card network settles at, not a rate we set.",
                ...FX_CORRIDORS.filter((c) => c.note).map((c) => `${c.label} — ${c.note}`),
              ]}
            />
          </Section>

          <Section title="Cash withdrawal">
            <Table
              head={["What", "Fee"]}
              rows={[
                [
                  <span key="a" className="text-text">
                    ATM withdrawal
                    {HIHODL_KEEPS.atmFeeProvisional && <Star />}
                  </span>,
                  <Num key="f">{bps(HIHODL_KEEPS.atmFeeBps)}</Num>,
                ],
              ]}
            />
            <Footnotes
              items={[
                "Charged on the withdrawn amount, plus whatever the ATM operator charges you directly.",
                "ATM withdrawals earn no cashback.",
                HIHODL_KEEPS.atmFeeProvisional
                  ? `${PROVISIONAL_LABEL} — the card programme is not signed, so this rate is not yet in force.`
                  : "",
              ].filter(Boolean)}
            />
          </Section>

          <Section title="Swapping between currencies">
            <Table
              head={["Plan", "Markup", "Gasless premium"]}
              rows={TIERS.map((t) => [
                <span key="n" className="text-text">
                  {t.name}
                </span>,
                <Num key="m">{bps(t.swapMarkupBps)}</Num>,
                <Num key="g">
                  {t.id === "free" ? "—" : bps(HIHODL_KEEPS.swapGaslessPremiumProBps)}
                </Num>,
              ])}
            />
            <Footnotes
              items={[
                "The markup is all-in: the network fee is inside it, not added on top.",
                "The gasless premium applies only when we cover the network fee for you on a paid plan.",
                "Minimum swap: $2.",
              ]}
            />
          </Section>

          {/* ── 3. What we keep ────────────────────────────────── */}
          <section className="mt-24">
            <h2 className="font-display text-h2 font-light text-text">What we keep</h2>
            <p className="mt-6 text-body text-text-muted max-w-2xl leading-relaxed">
              The fees above are what leaves your account. This section is the other
              direction: where our revenue comes from when you are not being charged a fee.
              It is here because you should not have to reverse-engineer it from an APY.
            </p>

            <div className="mt-12">
              <h3 className="text-small uppercase tracking-wider text-text-faint">
                Our share of what your savings earn
              </h3>
              <Table
                className="mt-6"
                head={["Plan", "We keep", "You keep"]}
                rows={TIERS.map((t) => [
                  <span key="n" className="text-text">
                    {t.name}
                  </span>,
                  <Num key="w">{bps(t.savingsInterestShareBps)}</Num>,
                  <Num key="y" accent>
                    {bps(10_000 - t.savingsInterestShareBps)}
                  </Num>,
                ])}
              />
              <Footnotes
                items={[
                  "A share of the INTEREST your balance earns. Never a share of the balance itself.",
                  `Charged only when you withdraw, and only on the gain. Withdraw at a loss and there is nothing to charge. Currently live at ${bps(HIHODL_KEEPS.savingsInterestShareBps)} flat across plans; the per-plan split above is provisional.`,
                  "A Founder Pass sets this to 0% for life on the first $25,000.",
                ]}
              />
            </div>

            <div className="mt-16">
              <h3 className="text-small uppercase tracking-wider text-text-faint">
                Our share of what your credit collateral earns
              </h3>
              <Table
                className="mt-6"
                head={["What", "We keep", "You keep"]}
                rows={[
                  [
                    <span key="n" className="text-text">
                      Interest on collateral backing an open loan
                    </span>,
                    <Num key="w">{bps(HIHODL_KEEPS.collateralYieldShareBps)}</Num>,
                    <Num key="y" accent>
                      {bps(10_000 - HIHODL_KEEPS.collateralYieldShareBps)}
                    </Num>,
                  ],
                ]}
              />
              <Footnotes
                items={[
                  "We keep nothing here today. Collateral locked against a loan keeps earning, and all of it is yours.",
                  "If that ever changes it changes on this page first, and it will never be applied retroactively to an open loan.",
                ]}
              />
            </div>

            <div className="mt-16">
              <h3 className="text-small uppercase tracking-wider text-text-faint">
                Everywhere else
              </h3>
              <Table
                className="mt-6"
                head={["Source", "Our share", "What it means"]}
                rows={[
                  [
                    <span key="a" className="text-text">
                      Currency conversion margin
                    </span>,
                    <Num key="b">{bps(HIHODL_KEEPS.fxMarginBps)}</Num>,
                    <span key="c" className="text-text-muted">
                      Only on the Free plan, and only outside US dollars and euros. Paid
                      plans are at the wholesale rate everywhere, so we keep nothing.
                    </span>,
                  ],
                  [
                    <span key="a" className="text-text">
                      Swap markup
                    </span>,
                    <Num key="b">{bps(HIHODL_KEEPS.swapMarkupFreeBps)}</Num>,
                    <span key="c" className="text-text-muted">
                      Free plan. Zero on paid plans, apart from the gasless premium above.
                    </span>,
                  ],
                  [
                    <span key="a" className="text-text">
                      Card interchange
                    </span>,
                    <span key="b" className="text-text-muted font-mono text-small">
                      Varies
                    </span>,
                    <span key="c" className="text-text-muted">
                      A share of the fee the merchant&rsquo;s bank pays on a card purchase.
                      Set by the card networks, not by us, and it costs you nothing.
                    </span>,
                  ],
                  [
                    <span key="a" className="text-text">
                      Partner commission
                    </span>,
                    <Num key="b">up to {bps(HIHODL_KEEPS.partnerCommissionBps)}</Num>,
                    <span key="c" className="text-text-muted">
                      Paid to us by a partner out of their own margin when you book through
                      them. It never changes the price you pay. See{" "}
                      <Link href="/travel" className="text-amber hover:underline">
                        travel rewards
                      </Link>
                      .
                    </span>,
                  ],
                ]}
              />
            </div>
          </section>

          {/* ── 4. Yield sources ───────────────────────────────── */}
          <Section
            title="Where the yield comes from"
            note="These are third-party lending markets. We route to them; we do not set their rates."
          >
            <Table
              head={["Asset", "Market", "Gross rate", "Max borrowing"]}
              rows={ASSETS.map((a) => [
                <span key="s" className="text-text">
                  {a.symbol}
                </span>,
                <span key="v" className="text-text-muted">
                  {a.venue}
                </span>,
                <Num key="r">
                  {a.grossApyPct}%<Star />
                </Num>,
                <Num key="l">{a.maxLtvPct === 0 ? "Not accepted" : `${a.maxLtvPct}%`}</Num>,
              ])}
            />
            <Footnotes
              items={[
                `${RATE_DISCLAIMER} Gross rate is what the lending market pays before our share above; measured ${measured}.`,
                "Max borrowing is the most that market will lend against the asset. It is their limit, not ours — we lend below it.",
                "An asset marked as not accepted can still earn. It just cannot back a loan.",
              ]}
            />
          </Section>

          <p className="mt-24 text-small text-text-faint max-w-2xl">
            Something on this page unclear or contradicted by what you were charged?{" "}
            <a className="text-amber hover:underline" href="mailto:hello@hihodl.xyz">
              hello@hihodl.xyz
            </a>
            . A fee we cannot explain is a fee we refund.
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-20">
      <h2 className="font-display text-h3 font-light text-text">{title}</h2>
      {note && <p className="mt-4 text-small text-text-faint max-w-2xl">{note}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Table({
  head,
  rows,
  className = "",
}: {
  head: React.ReactNode[];
  rows: React.ReactNode[][];
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0 ${className}`}>
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className={`pb-4 text-tiny uppercase tracking-wider text-text-faint font-normal border-b border-[color:var(--color-hairline-strong)] ${
                  i === 0 ? "" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`py-4 text-body align-top border-b border-[color:var(--color-hairline)] ${
                    j === 0 ? "pr-6" : "text-right pl-6"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Num({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span className={`font-mono tabular-nums ${accent ? "text-amber" : "text-text"}`}>
      {children}
    </span>
  );
}

/** The asterisk that ties a rate to its footnote. */
function Star() {
  return (
    <span className="text-text-faint" aria-hidden>
      *
    </span>
  );
}

function Footnotes({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-2 max-w-2xl">
      {items.map((item) => (
        <li key={item} className="text-small text-text-faint leading-relaxed">
          <span aria-hidden>* </span>
          {item}
        </li>
      ))}
    </ul>
  );
}
