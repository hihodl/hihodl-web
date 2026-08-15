/**
 * IncomeRails — credibility strip showing the rails HOLD plugs into.
 *
 * Goes RIGHT AFTER the Hero so the first scroll proves we're real
 * infrastructure, not a logo on a deck. Editorial, monochrome, no logos
 * fighting each other. Each rail is a wordmark in mono — like a deck slide,
 * not a payment-processor footer.
 */
export function IncomeRails() {
  return (
    <section className="relative overflow-hidden bg-night">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(80% 40% at 50% 50%, rgba(114,149,181,0.10), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="container-page py-16 md:py-20 relative">
        <p className="text-tiny uppercase tracking-wider text-text-faint text-center">
          Plugs into the rails the world already uses
        </p>

        <ul className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-px bg-[color:var(--color-hairline)] border border-[color:var(--color-hairline)] rounded-card overflow-hidden">
          <Rail name="ACH" sub="US bank" />
          <Rail name="SEPA" sub="Eurozone" />
          <Rail name="SPEI" sub="Mexico" />
          <Rail name="PIX" sub="Brazil" />
          <Rail name="USDC" sub="On-chain" />
          <Rail name="USDT" sub="On-chain" />
        </ul>

        <p className="mt-8 text-small text-text-faint text-center max-w-xl mx-auto">
          One balance. Receive however your client pays. Land as stablecoins.
        </p>
      </div>
    </section>
  );
}

function Rail({ name, sub }: { name: string; sub: string }) {
  return (
    <li className="bg-night px-6 py-8 flex flex-col items-center justify-center gap-1 hover:bg-white/[0.02] transition-colors duration-320">
      <span className="font-mono text-h4 font-light text-text tracking-tight">
        {name}
      </span>
      <span className="text-tiny uppercase tracking-wider text-text-faint">
        {sub}
      </span>
    </li>
  );
}
