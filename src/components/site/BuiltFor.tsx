/**
 * BuiltFor — six archetypes of the global earner.
 *
 * Editorial card grid. No illustrations (Ogvio went cartoony — we don't).
 * Each card is a name, a route, and a tools/payment line. Reads like a
 * Monocle profile, not a marketing persona.
 */
export function BuiltFor() {
  const people: Array<{
    name: string;
    role: string;
    route: string;
    tools: string;
    quote: string;
  }> = [
    {
      name: "Lucía",
      role: "Product designer",
      route: "Buenos Aires → Lisbon",
      tools: "Figma · Linear · paid in USDC",
      quote: "Receives client invoices. Pays rent in EUR.",
    },
    {
      name: "Akin",
      role: "Backend engineer",
      route: "Lagos · works for a US fintech",
      tools: "Cursor · Vercel · paid in USD ACH",
      quote: "Lands USD, holds in stablecoins, cashes out NGN when he chooses.",
    },
    {
      name: "Mai",
      role: "Micro-SaaS founder",
      route: "Ho Chi Minh City",
      tools: "Stripe · Polar · revenue in USD",
      quote: "Stripe pays out monthly. Stablecoins make a treasury possible at $4K MRR.",
    },
    {
      name: "Mateo",
      role: "Creative director",
      route: "Mexico City · clients in NYC and London",
      tools: "Wise · invoices in USD and GBP",
      quote: "Three currencies, one balance, no spread he can't see.",
    },
    {
      name: "Priya",
      role: "Vibecoder",
      route: "Bangalore · ships AI products on weekends",
      tools: "Claude · Replicate · revenue in USDC",
      quote: "Makes money in the same rails her stack runs on.",
    },
    {
      name: "Sasha",
      role: "Remote PM",
      route: "Tbilisi · employed by a Berlin scaleup",
      tools: "Deel · Notion · paid in EUR",
      quote: "Splits the paycheck across rent, savings, and a travel pocket.",
    },
  ];

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #0E141F 0%, #161E2A 100%)",
      }}
    >
      <div className="container-page section relative">
        <div className="max-w-2xl">
          <p className="text-tiny uppercase tracking-wider text-text-faint">
            Built for
          </p>
          <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text leading-tight">
            People who earn online
            <br />
            <span className="text-text-muted">and live offline.</span>
          </h2>
          <p className="mt-6 text-lead text-text-muted">
            If your income lives on the internet and your rent doesn&rsquo;t,
            HOLD was built around your week.
          </p>
        </div>

        <ul className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {people.map((p) => (
            <li
              key={p.name}
              className="rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-8 hover:bg-white/[0.05] transition-colors duration-320"
            >
              <div className="flex items-baseline justify-between">
                <p className="font-display text-h3 font-light text-text">
                  {p.name}
                </p>
                <span className="text-tiny uppercase tracking-wider text-amber">
                  {p.role}
                </span>
              </div>
              <p className="mt-3 font-mono text-small text-moonlight">{p.route}</p>
              <p className="mt-6 text-small text-text-faint">{p.tools}</p>
              <p className="mt-5 font-editorial text-body text-text-muted leading-snug">
                &ldquo;{p.quote}&rdquo;
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
