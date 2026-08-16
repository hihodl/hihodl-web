import Link from "next/link";

/**
 * The four products, in the order the app's own tab bar puts them.
 *
 * This section exists because the page used to argue for a *wallet* — gasless
 * swaps, stealth addresses, no seed phrase — and then never said what the thing
 * does with your money. Those are mechanics. They belong in the proof lines
 * here and in Superpowers below, not in the headline of a section.
 *
 * Every claim on this page is one the app can back today. Two deliberate
 * omissions: no APY anywhere in Savings (a rate on a homepage is a promise), and
 * no named securities anywhere in Invest.
 */

type Product = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  link?: { href: string; label: string };
  visual: React.ReactNode;
  accent: "amber" | "moonlight";
};

const PRODUCTS: Product[] = [
  {
    id: "payments",
    eyebrow: "Payments",
    title: "Get paid like a local. Anywhere.",
    body: "Account details your employer recognises, and an address for everyone else. However the money was sent, it lands in the same balance within minutes.",
    points: [
      "A USD account in your name — IBAN and SWIFT",
      "Send to a @username instead of a 42-character address",
      "Five seconds to cancel after you hit send",
    ],
    link: { href: "/smart-account", label: "How the account works" },
    accent: "amber",
    visual: <PaymentsVisual />,
  },
  {
    id: "savings",
    eyebrow: "Savings",
    title: "Money that works while it sits.",
    body: "Move any part of your balance into Savings and it starts earning that day, on-chain, through Aave. It never stops being yours — every withdrawal is signed on your device.",
    points: [
      "Earning on Base and Polygon",
      "No lock-up, no notice period, no minimum",
      "We take a share of the interest, never a cut of your balance",
    ],
    accent: "moonlight",
    visual: <SavingsVisual />,
  },
  {
    id: "invest",
    eyebrow: "Invest",
    title: "One portfolio, with what you paid for it.",
    body: "Everything you hold that isn't a dollar sits in one place, with live prices and the cost basis beside them. Rebalance from your balance — no exchange account, no transfer out.",
    points: [
      "Profit and loss per position, not just a total",
      "Buy and rebalance without leaving the app",
      "Dollars stay on the Payments side — cash is not a position",
    ],
    accent: "moonlight",
    visual: <InvestVisual />,
  },
  {
    id: "benefits",
    eyebrow: "Benefits",
    title: "Spending that gives something back.",
    body: "HiPoints for the things you already do in the app, and somewhere real to spend them. Book a stay or top up data and pay straight from your balance.",
    points: [
      "Points for referrals, challenges and fees you'd otherwise pay",
      "Stays — real hotel inventory, booked and paid in the app",
      "eSIM data for wherever you land next",
    ],
    link: { href: "/rewards", label: "See how HiPoints work" },
    accent: "amber",
    visual: <BenefitsVisual />,
  },
];

export function Products() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #161E2A 0%, #1B2638 50%, #141F2E 100%)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            "radial-gradient(50% 40% at 15% 10%, rgba(255,183,3,0.08), transparent 70%), radial-gradient(50% 40% at 85% 90%, rgba(114,149,181,0.14), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="container-page section relative">
        <div className="max-w-2xl">
          <p className="text-tiny uppercase tracking-wider text-text-faint">Everything in one account</p>
          <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text leading-tight">
            Four products.
            <br />
            <span className="text-text-muted">One balance behind them.</span>
          </h2>
          <p className="mt-6 text-lead text-text-muted">
            Most people running a life across borders end up with a bank, a
            broker, a rewards app and a wallet, and move money between all four.
            HOLD is the four of them sharing one balance.
          </p>
        </div>

        <div className="mt-16 md:mt-20 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {PRODUCTS.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: Product }) {
  const accentText = product.accent === "amber" ? "text-amber" : "text-moonlight";
  const accentDot = product.accent === "amber" ? "bg-amber" : "bg-moonlight";

  return (
    // scroll-mt clears the fixed header, so a jump from the nav lands on the
    // eyebrow rather than a third of the way down the card.
    <article
      id={product.id}
      className="scroll-mt-24 rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] hover:bg-white/[0.05] transition-colors duration-320 p-8 md:p-10 flex flex-col"
    >
      <div className="relative h-32 md:h-36 mb-9 overflow-hidden rounded-tight">{product.visual}</div>

      <div className={`flex items-center gap-2 text-tiny uppercase tracking-wider ${accentText}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${accentDot}`} />
        {product.eyebrow}
      </div>

      <h3 className="mt-4 font-display text-h3 font-light text-text leading-tight">{product.title}</h3>
      <p className="mt-4 text-body text-text-muted">{product.body}</p>

      <ul className="mt-7 flex flex-col gap-3">
        {product.points.map((point) => (
          <li key={point} className="flex items-start gap-3 text-small text-text-muted">
            <Tick className={`mt-0.5 shrink-0 ${accentText}`} />
            <span>{point}</span>
          </li>
        ))}
      </ul>

      {product.link && (
        <Link
          href={product.link.href}
          className="mt-8 inline-flex items-center gap-2 text-small text-text hover:text-amber transition-colors duration-180 self-start"
        >
          {product.link.label}
          <span aria-hidden>→</span>
        </Link>
      )}
    </article>
  );
}

function Tick({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className} aria-hidden>
      <path d="M2.5 7.2l3 3L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Visuals — static by design. The hero already carries the page's
 * motion budget; four looping animations in one grid is noise.
 * ───────────────────────────────────────────────────────────── */

function VisualFrame({ children, glow }: { children: React.ReactNode; glow: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-2">
      <div className="absolute inset-0 pointer-events-none" style={{ background: glow }} aria-hidden />
      <div className="relative w-full">{children}</div>
    </div>
  );
}

function PaymentsVisual() {
  return (
    <VisualFrame glow="radial-gradient(60% 80% at 50% 100%, rgba(255,183,3,0.10), transparent 70%)">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-tight border border-[color:var(--color-hairline)] bg-white/[0.04] px-4 py-3">
          <span className="text-small text-text">@sara</span>
          <span className="font-mono text-small text-text-muted">USD 240.00</span>
        </div>
        <div className="flex items-center justify-between rounded-tight border border-amber/25 bg-amber/[0.07] px-4 py-3">
          <span className="text-small text-text">Payroll · ACH</span>
          <span className="font-mono text-small text-amber">+3,200.00</span>
        </div>
      </div>
    </VisualFrame>
  );
}

function SavingsVisual() {
  return (
    <VisualFrame glow="radial-gradient(60% 80% at 50% 100%, rgba(91,124,255,0.14), transparent 70%)">
      <div className="rounded-tight border border-[color:var(--color-hairline)] bg-white/[0.04] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-tiny uppercase tracking-wider text-text-muted">Earning</span>
        </div>
        <p className="mt-3 font-mono text-h3 font-light text-text tabular-nums">$5,000.00</p>
        <p className="mt-1 text-tiny text-text-muted">Interest paid to your Savings balance</p>
      </div>
    </VisualFrame>
  );
}

function InvestVisual() {
  return (
    <VisualFrame glow="radial-gradient(60% 80% at 50% 100%, rgba(91,124,255,0.14), transparent 70%)">
      <div className="relative h-24">
        <svg viewBox="0 0 300 96" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
          <defs>
            <linearGradient id="hold-invest-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B7CFF" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#5B7CFF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 74 L34 66 L68 71 L102 52 L136 58 L170 38 L204 44 L238 26 L272 30 L300 14 L300 96 L0 96 Z"
            fill="url(#hold-invest-fill)"
          />
          <path
            d="M0 74 L34 66 L68 71 L102 52 L136 58 L170 38 L204 44 L238 26 L272 30 L300 14"
            fill="none"
            stroke="#5B7CFF"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute top-0 left-0">
          <p className="text-tiny uppercase tracking-wider text-text-muted">Portfolio</p>
          <p className="mt-1 font-mono text-h4 font-light text-text tabular-nums">$12,480</p>
        </div>
      </div>
    </VisualFrame>
  );
}

function BenefitsVisual() {
  return (
    <VisualFrame glow="radial-gradient(60% 80% at 50% 100%, rgba(255,183,3,0.10), transparent 70%)">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-pill border border-amber/30 bg-amber/[0.08] px-3.5 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber" />
          <span className="font-mono text-small text-amber tabular-nums">2,450</span>
          <span className="text-tiny text-text-muted">HiPoints</span>
        </span>
        <span className="rounded-pill border border-[color:var(--color-hairline)] bg-white/[0.04] px-3.5 py-2 text-tiny text-text-muted">
          Applied to a booking
        </span>
        <span className="rounded-pill border border-[color:var(--color-hairline)] bg-white/[0.04] px-3.5 py-2 text-tiny text-text-muted">
          Friend activated
        </span>
      </div>
    </VisualFrame>
  );
}
