"use client";

import { useEffect, useState } from "react";

/**
 * The four mechanics, AFTER the four products.
 *
 * This section used to open the argument: no seed phrase, stealth addresses,
 * gasless swaps. That is a wallet pitch, and it asks a stranger to care about
 * plumbing before they know what the thing does with their money. Products
 * comes first now; this is the "how is that possible" answer, and every title
 * leads with what the reader gets rather than with the machinery.
 *
 * Layout:
 *   Row 1: 2 cards (Opening an account · Who can see your income)
 *   Row 2: 2 cards (Sending · Cost of moving money)
 *
 * Every card has a distinct micro-animation. No two feel the same.
 * Anti-slop discipline: motion is restrained, never loops continuously
 * loud — most are quiet ambients with a single hover-driven moment.
 */
export function Superpowers() {
  return (
    <section className="bg-abyss relative overflow-hidden">
      <div className="absolute inset-0 bg-moonlight-glow opacity-20 pointer-events-none" aria-hidden />

      <div className="container-page section relative">
        {/* Section header */}
        <div className="max-w-2xl">
          <p className="text-tiny uppercase tracking-wider text-text-faint">Under the hood</p>
          <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text">
            Four things that
            <br />
            make the rest possible.
          </h2>
          <p className="mt-6 text-lead text-text-muted">
            You can use everything above without reading a word of this. It is
            here because the difference between HOLD and a banking app is real,
            and you deserve to know where it comes from.
          </p>
        </div>

        {/* Cards grid */}
        <div className="mt-16 md:mt-24 grid grid-cols-1 md:grid-cols-2 gap-6">
          <SocialLoginCard />
          <PrivacyCard />
          <SmartPaymentsCard />
          <GaslessSwapCard />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Card shell
 * ───────────────────────────────────────────────────────────── */

function Card({
  eyebrow,
  title,
  body,
  proof,
  visual,
  accent = "moonlight",
  wide = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  proof: string;
  visual: React.ReactNode;
  accent?: "moonlight" | "amber";
  wide?: boolean;
}) {
  const accentClass = accent === "amber" ? "text-amber" : "text-moonlight";
  const dotClass = accent === "amber" ? "bg-amber" : "bg-moonlight";

  return (
    <article
      className={`group relative overflow-hidden rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] hover:bg-white/[0.05] transition-colors duration-320 ${
        wide ? "p-10 md:p-12" : "p-8 md:p-10"
      }`}
    >
      {/* Visual zone */}
      <div className={`relative ${wide ? "h-44 md:h-56" : "h-40 md:h-48"} mb-10 overflow-hidden rounded-tight`}>
        {visual}
      </div>

      {/* Eyebrow */}
      <div className={`flex items-center gap-2 text-tiny uppercase tracking-wider ${accentClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        {eyebrow}
      </div>

      {/* Title */}
      <h3 className="mt-4 font-display text-h3 font-light text-text leading-tight">{title}</h3>

      {/* Body */}
      <p className="mt-4 text-body text-text-muted">{body}</p>

      {/* Proof / small print */}
      <p className="mt-6 text-small text-text-faint">{proof}</p>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 1 · Social login
 * Visual: Face → fingerprint → key → wallet, soft pulse loop
 * ───────────────────────────────────────────────────────────── */

function SocialLoginCard() {
  return (
    <Card
      accent="moonlight"
      eyebrow="Opening an account"
      title="Thirty seconds. Nothing to write down."
      body="Sign in with Face ID or Google. The account is created on your own phone and the key stays there — every payment is signed on the device, by you. We never hold your money, and we could not move it if we wanted to."
      proof="Device biometrics plus an encrypted backup, so you can recover on a new device by signing in. How that backup works is spelled out in Section 5.1 of our Terms."
      visual={<SocialLoginVisual />}
    />
  );
}

function SocialLoginVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-moonlight-glow opacity-30" aria-hidden />
      <div className="relative flex items-center gap-3">
        <Pill icon={<FaceIcon />} label="Face ID" delay={0} />
        <Arrow />
        <Pill icon={<KeyIcon />} label="Your key" delay={0.6} />
        <Arrow />
        <Pill icon={<CheckIcon />} label="Wallet" delay={1.2} accent="moonlight" />
      </div>
    </div>
  );
}

function Pill({
  icon,
  label,
  delay,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  delay: number;
  accent?: "moonlight" | "amber";
}) {
  const ring = accent === "moonlight" ? "ring-1 ring-moonlight/40" : "";
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-pill bg-white/[0.05] border border-[color:var(--color-hairline)] ${ring}`}
      style={{ animation: `pulse-soft 2.4s ease-in-out infinite`, animationDelay: `${delay}s` }}
    >
      <span className="text-text-muted">{icon}</span>
      <span className="text-tiny text-text">{label}</span>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="text-text-faint">
      <path d="M1 5h13m0 0L10 1m4 4l-4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FaceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1" />
      <circle cx="5" cy="6" r="0.5" fill="currentColor" />
      <circle cx="9" cy="6" r="0.5" fill="currentColor" />
      <path d="M5 9c.7.6 1.4.9 2 .9s1.3-.3 2-.9" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="4.5" cy="7" r="2.5" stroke="currentColor" strokeWidth="1" />
      <path d="M7 7h6m-2 0v2m2-2v3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7l3.5 3.5L12 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 2 · Privacy
 * Visual: One token symbol → multiple addresses radiating, fading in/out
 * ───────────────────────────────────────────────────────────── */

function PrivacyCard() {
  return (
    <Card
      accent="moonlight"
      eyebrow="Who can see your income"
      title="Your salary is nobody else's business."
      body="Every payment you receive lands at a fresh address, so a client who paid you once cannot watch what you earn afterwards. Nobody can add it up — including us."
      proof="Stealth address rotation. Each receive is unlinkable on-chain. Reveal it selectively when you actually need to: taxes, audits, your own records."
      visual={<PrivacyVisual />}
    />
  );
}

function PrivacyVisual() {
  const addresses = ["0x4a2...8f3", "0x9b1...c47", "0xe27...112", "0x3d8...fb6", "0x7c4...2a9"];
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-moonlight-glow opacity-25" aria-hidden />
      {/* Center token */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-12 h-12 rounded-full bg-white/[0.08] border border-moonlight/30 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-moonlight" />
        </div>
      </div>
      {/* Floating addresses */}
      {addresses.map((addr, i) => {
        const positions = [
          { top: "12%", left: "15%" },
          { top: "20%", right: "18%" },
          { bottom: "18%", left: "12%" },
          { bottom: "25%", right: "14%" },
          { top: "50%", left: "8%" },
        ];
        return (
          <div
            key={addr}
            className="absolute font-mono text-tiny text-text-muted"
            style={{
              ...positions[i],
              animation: `addr-fade 5s ease-in-out infinite`,
              animationDelay: `${i * 0.7}s`,
            }}
          >
            {addr}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 3 · Smart payments
 * Visual: Chat bubble with 5s undo countdown, then ✓ Sent
 * ───────────────────────────────────────────────────────────── */

function SmartPaymentsCard() {
  return (
    <Card
      accent="amber"
      eyebrow="Sending money"
      title="Send anywhere. Undo for 5 seconds."
      body="Pay anyone, and never pick a network to do it — we work that part out. Sent it to the wrong person? You have five seconds to take it back."
      proof="Cross-chain routing handled for you · Gasless on Solana · 5-second Undo Send."
      visual={<SmartPaymentsVisual />}
    />
  );
}

function SmartPaymentsVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-amber-glow opacity-20" aria-hidden />
      <div className="relative w-full max-w-xs flex flex-col gap-2 px-6">
        {/* Outgoing payment bubble */}
        <div className="self-end max-w-[80%] rounded-card rounded-tr-sm bg-amber/[0.12] border border-amber/30 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-h4 font-light text-text">$50</span>
            <span className="text-small text-text-muted">to @sara</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber rounded-full"
                style={{ animation: "undo-shrink 5s linear infinite" }}
              />
            </div>
            <span className="text-tiny font-mono text-amber">
              5s
            </span>
            <button
              type="button"
              className="text-tiny text-text-muted underline underline-offset-2 cursor-default"
              tabIndex={-1}
            >
              Cancel
            </button>
          </div>
        </div>
        {/* Confirmation */}
        <div className="self-end text-tiny text-text-faint" style={{ animation: "sent-blink 5s linear infinite" }}>
          ✓ Sent · arrived in 3s
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 4 · Gasless swap
 * Visual: Counter showing $X of $1,000 free monthly cap
 * ───────────────────────────────────────────────────────────── */

function GaslessSwapCard() {
  const [used, setUsed] = useState(214);
  useEffect(() => {
    const id = setInterval(() => {
      setUsed((u) => {
        if (u >= 498) return 214;
        return u + 4;
      });
    }, 200);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, (used / 500) * 100);

  return (
    <Card
      accent="amber"
      eyebrow="The first $500 is on us"
      title="Moving your money costs you nothing."
      body="Every network charges a fee to move money across it. We pay it for you on the first $500 you move each month — you do not need to hold anything to cover it, and there is nothing to top up."
      proof="Powered by Jupiter. Above the cap: real network cost + 0.50%, shown as one combined Network fee. No hidden spread. Pro: always gasless."
      visual={
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          {/* Subtle warm wash, never blinding */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(60% 70% at 50% 100%, rgba(255,183,3,0.10), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="relative w-full">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-tiny uppercase tracking-wider text-text-faint">Free this month</span>
              <span className="font-mono text-tiny text-text-faint">resets in 12d</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-h2 font-light text-amber font-mono tabular-nums">
                ${used}
              </span>
              <span className="text-text-faint">of</span>
              <span className="font-mono text-text-muted">$500</span>
            </div>
            <div className="mt-4 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber rounded-full transition-all duration-180 ease-out-soft"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      }
    />
  );
}

// EarnCard + Ticker removed 2026-05-28: tokenized-stock copy (TSLA/AAPL/NVDA/META,
// "Buy Tesla on Sunday at 3am", "Powered by xStocks via Jupiter") taken down
// pre-Apple appeal so the public site mirrors the iOS binary's compliance posture.
// Re-introduce only after Earn ships as a distinct, regulator-aligned product.
