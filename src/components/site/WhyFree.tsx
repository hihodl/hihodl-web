/**
 * WhyFree — kills the "what's the catch" objection.
 *
 * Three honest revenue sources, written in plain English. Editorial
 * three-column with mono numerals. No icons, no fluff. The trust
 * comes from the specificity.
 */
export function WhyFree() {
  return (
    <section
      id="why-free"
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #1F1A14 0%, #2A1F18 50%, #1F1A14 100%)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(255,183,3,0.10), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="container-page section relative">
        <div className="max-w-2xl">
          <p className="text-tiny uppercase tracking-wider text-amber">
            The honest version
          </p>
          <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text leading-tight">
            Why we can give you
            <br />
            <span className="text-text-muted">$500/month gas-free.</span>
          </h2>
          <p className="mt-8 text-lead text-text-muted">
            Free isn&rsquo;t a trick. It&rsquo;s a different business model. We make
            money on infrastructure, not on the people sitting on it.
          </p>
        </div>

        <ol className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--color-hairline)] border border-[color:var(--color-hairline)] rounded-card overflow-hidden">
          <Reason
            n="01"
            title="Pro subscriptions"
            body="Power users move more than $500/month and switch to Pro at $9.99. They subsidize the gas for everyone else. Fair trade — Pro gets unlimited."
          />
          <Reason
            n="02"
            title="Card interchange"
            body="When the HIHODL Card launches, every swipe pays us a small fee from the merchant — not from you. The same way Apple Pay and Revolut work, minus the bank in the middle."
          />
          <Reason
            n="03"
            title="HUSD treasury yield"
            body="HUSD, our coming stablecoin, holds reserves in short-term US Treasuries. The yield on those reserves funds the rails. No yield is taken from your balance."
          />
        </ol>

        <p className="mt-12 text-small text-text-faint max-w-2xl">
          What we don&rsquo;t do: sell your data, route your trades through hidden
          spreads, or lend out your stablecoins behind your back. Self-custody
          means we couldn&rsquo;t even if we wanted to.
        </p>
      </div>
    </section>
  );
}

function Reason({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="bg-night/60 px-8 py-10 md:py-12">
      <p className="font-mono text-small text-amber">{n}</p>
      <h3 className="mt-6 font-display text-h3 font-light text-text leading-tight">
        {title}
      </h3>
      <p className="mt-5 text-body text-text-muted leading-relaxed">{body}</p>
    </li>
  );
}
