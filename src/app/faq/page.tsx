import type { Metadata } from "next";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "FAQ — HIHODL stablecoin wallet",
  description:
    "Frequently asked questions about HIHODL: custody model, pricing, supported chains, gasless swaps, KYC, virtual IBAN, HUSD, AI layer, and how HIHODL compares to Revolut, Wise and Coinbase.",
  alternates: { canonical: "/faq" },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is HIHODL?",
    a: "HIHODL is a non-custodial multichain stablecoin wallet for freelancers and remote workers. You earn in stablecoins, hold the keys, and spend or move your money anywhere — Solana, Polygon, Base or Ethereum.",
  },
  {
    q: "Is HIHODL custodial?",
    a: "No. HIHODL is fully self-custodial. Your private key is split via MPC: half on your device, half held by HIHODL. The key is reassembled only inside your device, only to sign your transactions. We cannot move your funds.",
  },
  {
    q: "How much does HIHODL cost?",
    a: "Free plan is $0/month with up to $500/month of gas-free swaps; 0.50% all-in network fee above the cap. Pro is $9.99/month with $2,000/month gas-free and 0.15% above the cap. Solana swaps are gasless on both plans. $2 minimum swap.",
  },
  {
    q: "What chains does HIHODL support?",
    a: "Solana, Polygon, Base and Ethereum. Solana swaps are always gasless. EVM chains use smart gas detection on Pro.",
  },
  {
    q: "How do gasless swaps work?",
    a: "On Solana, HIHODL pays the network fee on your behalf via a relayer. On EVM chains, HIHODL covers gas when your Main native balance (minus pockets and staked balance) is below the threshold. You never need to hold SOL, MATIC or ETH for gas.",
  },
  {
    q: "Does HIHODL require KYC?",
    a: "No KYC for basic wallet use. KYC is only required for the optional virtual USD account (IBAN/SWIFT) when receiving fiat from employers or clients.",
  },
  {
    q: "Can I receive my salary in HIHODL?",
    a: "Yes. Income Rails gives you a virtual USD account with IBAN and SWIFT details. Your employer or client wires USD; it lands in your wallet as stablecoins, ready to spend, swap or save.",
  },
  {
    q: "What is HUSD?",
    a: "HUSD is HIHODL's native stablecoin, designed for people who earn in one country and live in another. Launching in 2027. Newsletter subscribers and Pro users get priority access.",
  },
  {
    q: "Does HIHODL have an AI assistant?",
    a: "An AI conversational layer is coming soon. Users will be able to ask in plain language — \"send 200 USDC to Lucía,\" \"split my paycheck 60/30/10,\" \"move savings to the highest yield\" — and HIHODL will execute. The AI proposes, the user signs every transaction. Self-custody is preserved.",
  },
  {
    q: "How is HIHODL different from Revolut, Wise or Coinbase?",
    a: "Revolut and Wise are custodial fintechs — they hold your money and can freeze your account. Coinbase is a custodial exchange. HIHODL is non-custodial: you hold the keys, no country lockouts, no frozen accounts, and your money moves on stablecoin rails 24/7.",
  },
  {
    q: "Is HIHODL available worldwide?",
    a: "Yes. HIHODL is non-custodial and works in 80+ countries. Early traction is strongest in LATAM, SEA, Africa and Eastern Europe — anywhere the remote-income-to-local-spend gap is painful.",
  },
  {
    q: "Is HIHODL on Android?",
    a: "iOS is live on the App Store. Android is in active development and will launch on Google Play soon.",
  },
  {
    q: "What are pockets?",
    a: "Pockets let you split your single balance into labelled buckets — Travel, Rent, Savings — without juggling multiple wallets. Free plan includes 3 pockets; Pro includes unlimited.",
  },
  {
    q: "What is a stealth address?",
    a: "Each incoming payment is routed through a freshly derived address so the public ledger does not link all your income to a single wallet. You see one balance; the chain sees rotating addresses.",
  },
  {
    q: "Can I send money by username?",
    a: "Yes. Sending stablecoins to a HIHODL @username takes seconds — no addresses to copy, no chain to pick.",
  },
  {
    q: "Does HIHODL hold my funds?",
    a: "Never. Funds live on-chain, secured by your MPC key share. HIHODL has no admin key, no freeze function, no claim on your balance.",
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
                Everything about HIHODL,
                <br />
                <span className="text-text-muted">in plain English.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Custody, pricing, chains, gasless swaps, KYC, IBAN, HUSD, AI layer
                — the answers in one page.
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
