import type { Metadata } from "next";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "FAQ — payments, savings, investing and benefits",
  description:
    "Frequently asked questions about HOLD: getting paid, savings and interest, investing, HiPoints and stays, custody, pricing, KYC, virtual IBAN, HUSD, and how HOLD compares to Revolut, Wise and Coinbase.",
  alternates: { canonical: "/faq" },
};

/*
 * Ordered by what a stranger asks, not by what we find interesting: what is it,
 * then one question per product, then the money-is-safe questions, then price,
 * then the long tail.
 *
 * Every number here has to match src/lib/rates.config.ts and the plan cards on
 * the homepage. This list quoted Pro at "$2,000/month gas-free and 0.15% above
 * the cap" until 16-aug-2026 — a plan that has never existed in code, on the
 * same site as a plan card saying no cap and no markup. A FAQ that contradicts
 * the pricing section costs more trust than the FAQ ever earned.
 */
const FAQS: { q: string; a: string }[] = [
  {
    q: "What is HOLD?",
    a: "HOLD is one account for people who earn in one country and live in another. It does four things: payments (get paid and send money), savings (your balance earns interest), investing (one portfolio with your cost basis) and benefits (points, stays and eSIM data). The money is held in stablecoins and the keys stay on your phone, so it is your account in the literal sense — we cannot move or freeze it.",
  },
  {
    q: "How does Savings work?",
    a: "You move any part of your balance into Savings and it starts earning that day. The money is supplied to Aave, an on-chain lending market, on Base and Polygon — it is not lent to us and it does not sit on our books. Interest accrues to your Savings balance. We keep a share of the interest, never a cut of the balance itself, and the exact share is published on our Smart Account page.",
  },
  {
    q: "Is my money locked when it is earning?",
    a: "No. There is no lock-up, no notice period and no minimum. You can withdraw the whole balance whenever you want. Every withdrawal is signed on your own device, which is also why we cannot withdraw it for you.",
  },
  {
    q: "What can I invest in?",
    a: "Everything you hold that is not a dollar appears in one portfolio, with live prices, what you paid for it and your profit and loss per position. You can buy and rebalance from your balance without opening an exchange account or transferring anything out. Stablecoins are deliberately excluded — dollars are cash on the payments side, not a position.",
  },
  {
    q: "What are HiPoints and what can I spend them on?",
    a: "HiPoints are earned inside the app: referrals that activate, challenges, and fees you would otherwise have paid. They are spent on things that cost real money — a hotel booking made in the app, or your Pro subscription. A point is worth the same wherever you spend it; we do not vary the rate by product.",
  },
  {
    q: "Can I book travel with HOLD?",
    a: "Yes. Stays lets you search and book real hotel inventory inside the app and pay straight from your balance, and you earn HiPoints on the booking. See the Stays page for what we keep on a booking and how the price is set.",
  },
  {
    q: "Is HOLD custodial?",
    a: "No. HOLD is non-custodial. Your account is generated on your own device from a recovery phrase that stays on your device, and a transaction can only be signed there, by you. We cannot move, spend or freeze your funds. So that you are not locked out if you lose your phone, we also keep an encrypted backup of your recovery phrase that you can restore by signing in — Section 5.1 of our Terms explains exactly how that works, what it means, and how to have it deleted.",
  },
  {
    q: "How much does HOLD cost?",
    a: "Free is $0/month. On the first $500 of swap volume each month we cover the network fee for you, up to $0.10 per swap — if the network is congested and the real cost is higher, you pay only the excess. Above $500/month, 0.50% all-in. Pro is $9.99/month: the network fee is covered with no monthly cap and there is no swap markup. Both plans have a $2 minimum swap. Savings and Benefits are on both plans.",
  },
  {
    q: "What chains does HOLD support?",
    a: "Solana, Polygon, Base and Ethereum — but you never pick one. HOLD works out the route. Savings runs on Base and Polygon.",
  },
  {
    q: "Why does moving money cost nothing?",
    a: "Every network charges a fee to move money across it. On Solana we pay that fee for you through a relayer; on the other chains we cover it when your own native balance is too low to. In practice you never have to hold SOL, MATIC or ETH just to be able to move your own money, and there is nothing to top up.",
  },
  {
    q: "Does HOLD require KYC?",
    a: "No KYC to open the account, hold money, send, save or invest. It is only required for the optional virtual USD account (IBAN/SWIFT), because that is a regulated banking rail and the bank behind it has to know who you are.",
  },
  {
    q: "Can I receive my salary in HOLD?",
    a: "Yes. Income Rails gives you a virtual USD account with IBAN and SWIFT details in your name. Your employer or client wires USD the ordinary way; it lands in your balance in minutes, ready to spend, save or invest.",
  },
  {
    q: "What is HUSD?",
    a: "HUSD is HOLD's native stablecoin, designed for people who earn in one country and live in another. Launching in 2027. Newsletter subscribers and Pro users get priority access.",
  },
  {
    q: "Does HOLD have an AI assistant?",
    a: "An AI conversational layer is coming soon. Users will be able to ask in plain language — \"send 200 USDC to Lucía,\" \"split my paycheck 60/30/10,\" \"move savings to the highest yield\" — and HOLD will execute. The AI proposes, the user signs every transaction. Self-custody is preserved.",
  },
  {
    q: "How is HOLD different from Revolut, Wise or Coinbase?",
    a: "Revolut and Wise hold your money and can freeze your account; Coinbase is an exchange that does the same. In HOLD the money is yours in the literal sense — the key is on your phone, so there is no country lockout and no account to freeze. It also does more in one place: getting paid, earning interest, holding a portfolio and spending points all sit behind the same balance instead of four apps.",
  },
  {
    q: "Is HOLD available worldwide?",
    a: "Yes. HOLD is non-custodial and works in 80+ countries. Early traction is strongest in LATAM, SEA, Africa and Eastern Europe — anywhere the remote-income-to-local-spend gap is painful.",
  },
  {
    q: "Is HOLD on Android?",
    a: "Yes. HOLD is live on both the App Store and Google Play. Set up takes about 30 seconds on either platform.",
  },
  {
    q: "What are pockets?",
    a: "Pockets let you split one balance into labelled buckets — Travel, Rent, whatever your month looks like — without juggling several accounts. Free includes 3 pockets; Pro includes unlimited.",
  },
  {
    q: "Who can see what I earn?",
    a: "Nobody but you. On Pro, each payment you receive arrives at a freshly derived address, so a client who paid you once cannot go back and watch what you earned afterwards, and no one can add your income up into a single figure. You see one balance and one clean list. You can reveal it selectively when you actually need to — taxes, an audit, your own records. Automatic address rotation is a Pro feature; a Free account receives at a single address.",
  },
  {
    q: "Can I send money by username?",
    a: "Yes. Paying a HOLD @username takes seconds — no address to copy, no network to pick, and five seconds to cancel if you picked the wrong person.",
  },
  {
    q: "Does HOLD ever take custody of my funds?",
    a: "Never. Your funds live on-chain and move only when you sign from your device. HOLD has no admin key, no freeze function, and no claim on your balance.",
  },
];

export default function FaqPage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="bg-night relative overflow-hidden">
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">FAQ</p>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                Everything about HOLD,
                <br />
                <span className="text-text-muted">in plain English.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Getting paid, earning interest, investing, points and stays —
                plus custody, pricing and KYC. The answers in one page.
              </p>
            </div>

            <div className="mt-16 max-w-3xl flex flex-col gap-4">
              {FAQS.map(({ q, a }) => (
                <details
                  key={q}
                  className="group rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-6 open:bg-white/[0.05] transition-colors"
                >
                  <summary className="cursor-pointer list-none flex items-start justify-between gap-6">
                    <h2 className="font-display text-h4 font-light text-text leading-snug">
                      {q}
                    </h2>
                    <span
                      className="mt-1 shrink-0 text-text-faint group-open:rotate-45 transition-transform duration-180"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-body text-text-muted leading-relaxed">{a}</p>
                </details>
              ))}
            </div>

            <p className="mt-16 text-small text-text-faint max-w-2xl">
              Still have questions?{" "}
              <a className="text-amber hover:underline" href="mailto:hello@hihodl.xyz">
                hello@hihodl.xyz
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
