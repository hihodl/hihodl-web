/**
 * BankVsHold — editorial comparison.
 *
 * Not a feature checklist (Ogvio does that). A side-by-side written like
 * a book: bank on the left in muted text, HOLD on the right in living
 * text. Reads top-down as a story, not a spec sheet.
 */
export function BankVsHold() {
  const rows: Array<{ topic: string; bank: string; hold: string }> = [
    {
      topic: "Receiving from abroad",
      bank: "3–5 business days. $25–40 wire fee. FX markup hidden in the rate.",
      hold: "Minutes. Stablecoins land 1:1 with the dollar. Zero fees on receive.",
    },
    {
      topic: "What the balance earns",
      bank: "Close to nothing, and only if you lock it for a year.",
      hold: "Move it to Savings and it earns from that day. Take it out whenever.",
    },
    {
      topic: "Moving across borders",
      bank: "Compliance forms. Limits. Calls.",
      hold: "A username. A tap. Done.",
    },
    {
      topic: "Cost to move it",
      bank: "1.5–3% spread, buried in the rate.",
      hold: "First $500/month free. 0.50% above the cap, all-in, shown before you tap.",
    },
    {
      topic: "Custody of your money",
      bank: "They hold it. They can freeze it.",
      hold: "You hold it. The key is on your phone. We can't touch it.",
    },
    {
      topic: "Who can see your income",
      bank: "Your bank, its partners, and anyone with the right paperwork.",
      hold: "Every payment lands at a new address. Nobody can add up what you earn.",
    },
    {
      topic: "When you travel",
      bank: "Card declined. App requires home wifi. Support closed.",
      hold: "Same balance. Same app. Same speed. Anywhere.",
    },
  ];

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #0E141F 0%, #161E2A 50%, #0E141F 100%)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            "radial-gradient(50% 50% at 80% 20%, rgba(255,183,3,0.08), transparent 70%), radial-gradient(50% 50% at 20% 80%, rgba(114,149,181,0.12), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="container-page section relative">
        <div className="max-w-2xl">
          <p className="text-tiny uppercase tracking-wider text-text-faint">
            Side by side
          </p>
          <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text leading-tight">
            What you leave behind
            <br />
            <span className="text-text-muted">when you switch.</span>
          </h2>
        </div>

        <div className="mt-16 md:mt-20 rounded-card border border-[color:var(--color-hairline)] overflow-hidden">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-[1fr_1.2fr_1.2fr] bg-white/[0.04]">
            <div className="px-8 py-6 border-r border-[color:var(--color-hairline)]" />
            <div className="px-8 py-6 border-r border-[color:var(--color-hairline)]">
              <p className="text-small uppercase tracking-[0.18em] text-text-muted font-medium">
                Your bank
              </p>
            </div>
            <div className="px-8 py-6">
              <p className="text-small uppercase tracking-[0.18em] text-amber font-medium">
                HOLD
              </p>
            </div>
          </div>

          {rows.map((r, i) => (
            <div
              key={r.topic}
              className={`grid grid-cols-1 md:grid-cols-[1fr_1.2fr_1.2fr] ${
                i !== 0 ? "border-t border-[color:var(--color-hairline)]" : ""
              }`}
            >
              <div className="px-8 py-7 md:py-10 md:border-r border-[color:var(--color-hairline)] bg-white/[0.025]">
                <p className="font-display text-h4 md:text-h3 font-light text-text leading-tight">
                  {r.topic}
                </p>
              </div>
              <div className="px-8 py-5 md:py-10 md:border-r border-[color:var(--color-hairline)]">
                <p className="text-lead md:text-h4 font-light text-text-muted leading-snug">
                  {r.bank}
                </p>
              </div>
              <div className="px-8 py-5 md:py-10 pb-7">
                <p className="text-lead md:text-h4 font-light text-text leading-snug">
                  {r.hold}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
