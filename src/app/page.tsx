import Link from "next/link";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { Hero } from "@/components/site/Hero";
import { IncomeRails } from "@/components/site/IncomeRails";
import { OneDayJourney } from "@/components/site/OneDayJourney";
import { Products } from "@/components/site/Products";
import { Superpowers } from "@/components/site/Superpowers";
import { BankVsHold } from "@/components/site/BankVsHold";
import { BuiltFor } from "@/components/site/BuiltFor";
import { WhyFree } from "@/components/site/WhyFree";
import { NotifyMeForm } from "@/components/site/NotifyMeForm";
import { CtaLink } from "@/components/site/DownloadLink";
import { APP_STORE_URL, DOWNLOAD_ANCHOR, PLAY_STORE_URL } from "@/lib/appLinks";

export default function Home() {
  return (
    <>
      <TopNav />

      <main>
        {/* ─── 1. Hero ─────────────────────────────────────────── */}
        <Hero />

        {/* ─── 1.5 · Income rails — credibility strip ──────────── */}
        <div id="income" className="scroll-mt-20">
          <IncomeRails />
        </div>

        {/* ─── 2. Empathy hook (editorial serif moment) ────────── */}
        <section
          className="relative overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, #2A1F18 0%, #1F1A14 40%, #1F2535 100%)",
          }}
        >
          {/* Warm bronze spotlight, center */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(70% 60% at 50% 50%, rgba(255, 183, 3, 0.10), transparent 70%)",
            }}
            aria-hidden
          />
          <SectionHairline tone="amber" />
          <div className="container-page section text-center relative">
            <p className="font-editorial text-h3 md:text-h2 text-text max-w-3xl mx-auto leading-snug">
              Your pay lands in minutes.
              <br />
              It earns while you sleep.
              <br />
              <span className="text-text-muted">You spend it wherever you are.</span>
            </p>
            <p className="mt-10 text-small text-text-faint uppercase tracking-wider">
              One account for people who earn in one country and live in another.
            </p>
          </div>
        </section>

        {/* ─── 2.5 · The four products — what we actually offer ── */}
        <Products />

        {/* ─── 3. A day in the life — scroll-pin scene ─────────── */}
        <OneDayJourney />

        {/* ─── 3.5 · Mid-page CTA bridge ────────────────────────── */}
        <CtaStrip
          eyebrow="50,000+ global earners already on HOLD"
          title="Try it before reading another word."
          subtitle="On App Store and Google Play. Set up in 30 seconds."
          primary={{ label: "Download free", href: DOWNLOAD_ANCHOR }}
          secondary={{ label: "How it works", href: "#how" }}
          tone="blue"
        />

        {/* ─── 4. What makes the four products possible ────────── */}
        <Superpowers />

        {/* ─── 4.3 · Bank vs HOLD — the side-by-side ─────────── */}
        <BankVsHold />

        {/* ─── 4.6 · Built for — six archetypes ────────────────── */}
        <BuiltFor />

        {/* ─── 4. How it works in 30 seconds ───────────────────── */}
        <section id="how" className="bg-night relative overflow-hidden">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">How it works · 30 seconds</p>
              <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text">
                Faster than any
                <br />
                fintech app.
              </h2>
              <p className="mt-6 text-lead text-text-muted">
                No paperwork, no approval queues, no bank visit.
                Three steps to receive, hold and move your money.
              </p>
            </div>

            <ol className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
              <Step
                n={1}
                title="Sign in with Face ID"
                body="Nothing to write down. Your wallet is created on your phone, and an encrypted backup means you can sign in on a new device and pick up where you left off. Only you can sign a transaction."
                badge="10 seconds"
              />
              <Step
                n={2}
                title="Get paid your way"
                body="Receive via virtual USD account (IBAN/SWIFT) for employers and clients, or share your stablecoin address with crypto senders. Either way it lands as stablecoins."
                badge="Instant"
              />
              <Step
                n={3}
                title="Spend it, save it, or grow it"
                body="Send to a @username in seconds. Move part of the balance into Savings and it starts earning that day. Split the rest across pockets — Travel, Rent, whatever your month looks like."
                badge="Anywhere"
              />
            </ol>
          </div>
        </section>

        {/* ─── 4.9 · Why free — kills the "what's the catch" ───── */}
        <WhyFree />

        {/* ─── 5. Pricing — swap comparison ────────────────────── */}
        <section
          className="relative overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, #243246 0%, #2D3D52 50%, #243246 100%)",
          }}
        >
          {/* Premium light wash — feels like a card on a table */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(80% 60% at 50% 30%, rgba(255,183,3,0.12), transparent 70%), radial-gradient(60% 60% at 80% 100%, rgba(114,149,181,0.18), transparent 70%)",
            }}
            aria-hidden
          />
          <SectionHairline tone="blue" />
          <div className="container-page section text-center relative">
            <p className="text-tiny uppercase tracking-wider text-text-faint">Two plans. Zero surprises.</p>
            <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text max-w-3xl mx-auto">
              Start free.
              <br />
              <span className="text-text-muted">Go Pro when you move more.</span>
            </h2>
            <p className="mt-8 text-lead text-text-muted max-w-2xl mx-auto">
              No hidden spread. No tier games. Cancel anytime.
            </p>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto text-left">
              <PlanCard
                name="Free"
                price="$0"
                priceSub="forever"
                features={[
                  "Up to $500/mo of gas-free swaps",
                  "Above the cap: 0.50% all-in network fee",
                  "$2 minimum swap",
                  "3 pockets to organize your money",
                  "Virtual USD account & IBAN",
                  "Self-custody · biometric login",
                ]}
                cta={{ label: "Download free", href: DOWNLOAD_ANCHOR }}
              />
              <PlanCard
                name="Pro"
                price="$9.99"
                priceSub="per month"
                highlight
                features={[
                  "Always gasless. Network fee included.",
                  "Zero markup on swap volume — no cap",
                  "Unlimited pockets",
                  "Priority access to HUSD at launch",
                  "Virtual USD account & IBAN priority queue",
                  "Premium support",
                ]}
                cta={{ label: "Get Pro", href: DOWNLOAD_ANCHOR }}
              />
            </div>

            <p className="mt-10 text-small text-text-faint max-w-xl mx-auto">
              Invite 1 friend, get 1 month Pro free. Up to 3 months.
            </p>
          </div>
        </section>

        {/* ─── 5.7 · AI layer teaser (Cursor of stablecoins) ───── */}
        <section
          id="ai"
          className="relative overflow-hidden bg-night"
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                "radial-gradient(60% 60% at 30% 30%, rgba(91,124,255,0.18), transparent 70%), radial-gradient(60% 60% at 80% 90%, rgba(255,183,3,0.10), transparent 70%)",
            }}
            aria-hidden
          />
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">
                AI layer · coming soon
              </p>
              <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text leading-tight">
                Just say what you want done.
                <br />
                <span className="text-text-muted">Your money, in plain language.</span>
              </h2>
              <p className="mt-8 text-lead text-text-muted max-w-2xl">
                The four products above, without the menus. Ask for it —
                <em className="not-italic text-text"> &ldquo;send 200 to Lucía,&rdquo; &ldquo;split this paycheck 60/30/10,&rdquo;
                &ldquo;move my savings to whatever pays most&rdquo;</em> — and it happens.
                Nothing moves until you approve it.
              </p>
              <p id="security" className="mt-6 text-small text-text-faint max-w-2xl">
                Your key never leaves your phone. The assistant proposes; every payment is signed by you.
              </p>
            </div>
          </div>
        </section>

        {/* ─── 5.5 · Mid-page CTA after pricing ─────────────────── */}
        <CtaStrip
          eyebrow="The first $500 is on us. Every month."
          title="Stop thinking. Start moving."
          subtitle="No setup fees. No KYC for basic use. No bank required."
          primary={{ label: "Get HOLD free", href: DOWNLOAD_ANCHOR }}
          tone="amber"
        />

        {/* ─── 6. Social proof ─────────────────────────────────── */}
        <section
          className="relative overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, #161E2A 0%, #1B2638 100%)",
          }}
        >
          {/* Horizontal moonlight band */}
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[60%] pointer-events-none opacity-40"
            style={{
              background:
                "radial-gradient(80% 100% at 50% 50%, rgba(91,124,255,0.18), transparent 70%)",
            }}
            aria-hidden
          />
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <p className="text-tiny uppercase tracking-wider text-text-faint text-center">
              Loved by global earners in 80+ countries
            </p>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <Testimonial
                quote="Finally an app that doesn't make me feel like an engineer to receive my paycheck."
                name="Lucía R."
                role="Designer · Buenos Aires → Lisbon"
              />
              <Testimonial
                quote="My clients pay me in USD. I pay rent in pesos. HOLD is the bridge I'd been hacking together with three apps."
                name="Akin O."
                role="Developer · Lagos"
              />
              <Testimonial
                quote="I stopped using my bank for international payments. What I stopped losing on the exchange rate covers my phone bill."
                name="Maria S."
                role="Writer · Mexico City"
              />
            </div>
          </div>
        </section>

        {/* ─── 7. Newsletter + HUSD teaser (brand blue dominant) ─ */}
        <section
          id="husd"
          className="relative overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, #2C4566 0%, #4F7090 50%, #2C4566 100%)",
          }}
        >
          {/* Steel-blue gradient mirrors the HOLD logo background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(70% 80% at 30% 30%, rgba(114,149,181,0.30), transparent 70%), radial-gradient(70% 80% at 80% 80%, rgba(44,69,102,0.40), transparent 70%)",
            }}
            aria-hidden
          />
          <SectionHairline tone="blue" />
          <div className="container-page section relative">
            <div className="max-w-2xl mx-auto text-center">
              {/* 50K live counter */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-pill border border-[color:var(--color-hairline-strong)] bg-white/[0.04]">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-small text-text font-mono">
                  <span className="font-medium">50,127</span>
                  <span className="text-text-muted"> global earners on the list</span>
                </span>
              </div>

              <h2 className="mt-8 font-display text-h2 md:text-h1 font-light text-text">
                50,000 already joined.
                <br />
                <span className="text-text-muted">Be next.</span>
              </h2>
              <p className="mt-8 text-lead text-text-muted">
                We&rsquo;re building HUSD — the first stablecoin designed for people
                who earn in one country and live in another. Newsletter subscribers
                get early access and priority onboarding when we launch in 2027.
              </p>

              <NotifyMeForm />
            </div>
          </div>
        </section>

        {/* ─── 8. Download (warm climax) ───────────────────────── */}
        <section id="download" className="relative overflow-hidden bg-night">
          <div
            className="absolute inset-0 pointer-events-none opacity-50"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 100%, rgba(255,183,3,0.10), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="container-page section relative text-center">
            <p className="text-tiny uppercase tracking-wider text-amber">Available on App Store and Google Play</p>
            <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text">
              Stop choosing between
              <br />
              your bank and your wallet.
            </h2>
            <p className="mt-8 text-lead text-text-muted max-w-xl mx-auto">
              Get paid, earn on the balance, invest what&rsquo;s left and spend it —
              in one app. Set up in 30 seconds.
            </p>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <StoreButton
                store="apple"
                href={APP_STORE_URL}
                eyebrow="Download on the"
                label="App Store"
              />
              <StoreButton
                store="google"
                href={PLAY_STORE_URL}
                eyebrow="Get it on"
                label="Google Play"
              />
            </div>

            <p className="mt-10 text-tiny text-text-faint font-mono">
              Self-custodial. No KYC for basic use. Available worldwide.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────
 * Inline helpers — extracted to files later
 * ──────────────────────────────────────────────────────────── */

function PlanCard({
  name,
  price,
  priceSub,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  priceSub: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative rounded-card p-8 md:p-10 border flex flex-col ${
        highlight
          ? "border-amber/40 bg-gradient-to-b from-amber/[0.06] to-amber/[0.02]"
          : "border-[color:var(--color-hairline)] bg-white/[0.03]"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-8 inline-flex items-center px-3 py-1 rounded-pill bg-amber text-text-on-amber text-tiny font-medium uppercase tracking-wider">
          Most popular
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className={`font-display text-h3 font-light ${highlight ? "text-amber" : "text-text"}`}>{name}</h3>
        <div className="text-right">
          <div className="font-display text-h3 font-light text-text font-mono tabular-nums">{price}</div>
          <div className="text-tiny text-text-faint">{priceSub}</div>
        </div>
      </div>
      <ul className="mt-8 flex flex-col gap-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-body text-text-muted">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${highlight ? "bg-amber" : "bg-moonlight"}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <CtaLink
        href={cta.href}
        className={`mt-10 inline-flex items-center justify-center px-6 py-3.5 rounded-pill font-medium text-body transition-all duration-180 ease-out-soft hover:scale-[1.02] ${
          highlight
            ? "bg-amber text-text-on-amber hover:bg-amber-glow"
            : "border border-[color:var(--color-hairline-strong)] text-text hover:bg-white/5"
        }`}
      >
        {cta.label}
      </CtaLink>
    </div>
  );
}

function PriceCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-card p-6 border text-left ${
        highlight
          ? "border-amber/50 bg-amber/[0.04]"
          : "border-[color:var(--color-hairline)] bg-white/[0.02]"
      }`}
    >
      <p className={`text-tiny uppercase tracking-wider ${highlight ? "text-amber" : "text-text-faint"}`}>
        {label}
      </p>
      <p className="mt-3 text-h4 font-light text-text">{value}</p>
    </div>
  );
}

/**
 * Tonal divider between sections — a thin line with a soft glow at center.
 * Acts like a horizon between sections so each block reads as its own moment.
 */
function SectionHairline({ tone = "blue" }: { tone?: "blue" | "amber" | "moonlight" }) {
  const color =
    tone === "amber"
      ? "rgba(255,183,3,0.40)"
      : tone === "moonlight"
        ? "rgba(91,124,255,0.40)"
        : "rgba(114,149,181,0.40)";
  return (
    <div className="absolute inset-x-0 top-0 h-px pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
        }}
      />
    </div>
  );
}

function CtaStrip({
  eyebrow,
  title,
  subtitle,
  primary,
  secondary,
  tone = "blue",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  tone?: "blue" | "amber";
}) {
  // "blue" tone uses the premium signature gradient — same as Hero + HUSD
  const sectionBg =
    tone === "blue"
      ? "linear-gradient(180deg, #2C4566 0%, #4F7090 50%, #2C4566 100%)"
      : "linear-gradient(180deg, #2A1F18 0%, #1F1810 100%)";
  const glow =
    tone === "blue"
      ? "radial-gradient(70% 70% at 30% 30%, rgba(114,149,181,0.30), transparent 70%), radial-gradient(70% 70% at 80% 80%, rgba(44,69,102,0.35), transparent 70%)"
      : "radial-gradient(70% 80% at 50% 70%, rgba(255,183,3,0.20), transparent 70%), radial-gradient(50% 50% at 20% 0%, rgba(184,125,0,0.18), transparent 70%)";
  const eyebrowColor = tone === "blue" ? "text-brand-blue-glow" : "text-amber";
  const hairlineTone: "blue" | "amber" | "moonlight" = tone === "blue" ? "moonlight" : "amber";

  return (
    <section className="relative overflow-hidden" style={{ background: sectionBg }}>
      <SectionHairline tone={hairlineTone} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: glow }} aria-hidden />
      <div className="container-page py-20 md:py-28 relative text-center">
        <p className={`text-tiny uppercase tracking-wider ${eyebrowColor}`}>{eyebrow}</p>
        <h3 className="mt-5 font-display text-h2 md:text-h1 font-light text-text leading-tight max-w-3xl mx-auto">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-6 text-lead text-text-muted max-w-xl mx-auto">{subtitle}</p>
        )}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <CtaLink
            href={primary.href}
            className="inline-flex items-center justify-center px-7 py-4 rounded-pill bg-amber text-text-on-amber font-medium text-body hover:bg-amber-glow transition-all duration-180 ease-out-soft hover:scale-[1.02]"
          >
            {primary.label}
          </CtaLink>
          {secondary && (
            <Link
              href={secondary.href}
              className="inline-flex items-center justify-center px-7 py-4 rounded-pill border border-[color:var(--color-hairline-strong)] text-text font-medium text-body hover:bg-white/5 transition-colors duration-180"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function StoreButton({
  store,
  href,
  eyebrow,
  label,
}: {
  store: "apple" | "google";
  href: string;
  eyebrow: string;
  label: string;
}) {
  const Icon = store === "apple" ? AppleIcon : GoogleIcon;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-3 px-6 py-3.5 rounded-pill border bg-white text-[#0A0500] border-white transition-all duration-180 ease-out-soft hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,255,255,0.15)]"
    >
      <Icon className="w-6 h-6" />
      <span className="flex flex-col items-start leading-none">
        <span className="text-tiny opacity-70">{eyebrow}</span>
        <span className="text-body font-medium mt-0.5">{label}</span>
      </span>
    </a>
  );
}

function AppleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.523 12.025c-.041-3.07 2.508-4.546 2.625-4.616-1.43-2.092-3.652-2.378-4.435-2.398-1.886-.193-3.687 1.114-4.643 1.114-.974 0-2.439-1.094-4.014-1.063-2.062.03-3.967 1.197-5.022 3.034-2.144 3.71-.547 9.183 1.527 12.197 1.014 1.476 2.21 3.121 3.785 3.064 1.535-.062 2.108-.974 3.957-.974 1.836 0 2.371.974 3.967.94 1.642-.03 2.674-1.485 3.654-2.97.95-1.476 1.34-2.913 1.36-2.989-.03-.014-2.61-1-2.638-3.953m-2.97-7.247c.819-1.018 1.376-2.413 1.226-3.821-1.183.052-2.66.804-3.515 1.806-.755.892-1.42 2.343-1.246 3.7 1.328.103 2.687-.674 3.535-1.685" />
    </svg>
  );
}

function GoogleIcon({ className = "" }: { className?: string }) {
  // Google Play "play" triangle, single-color silhouette suitable for white pill
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.609 1.814 13.792 12 3.61 22.186a.998.998 0 0 1-.609-.92V2.734a1 1 0 0 1 .608-.92zm10.89 10.893 2.302 2.302-10.937 6.333 8.635-8.635zm3.794-4.31 2.85 1.65a1 1 0 0 1 0 1.736l-3.05 1.766L15.207 12l3.086-3.086zm-3.794-.69L5.864 1.36l10.937 6.334-2.302 2.302z" />
    </svg>
  );
}

function Step({
  n,
  title,
  body,
  badge,
}: {
  n: number;
  title: string;
  body: string;
  badge: string;
}) {
  return (
    <li className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03] hover:bg-white/[0.05] transition-colors duration-320">
      <div className="flex items-center justify-between">
        <span className="font-mono text-small text-moonlight">0{n}</span>
        <span className="text-tiny uppercase tracking-wider text-text-faint border border-[color:var(--color-hairline)] rounded-pill px-3 py-1">
          {badge}
        </span>
      </div>
      <h3 className="mt-8 font-display text-h3 font-light text-text leading-tight">{title}</h3>
      <p className="mt-4 text-body text-text-muted">{body}</p>
    </li>
  );
}

function Testimonial({ quote, name, role }: { quote: string; name: string; role: string }) {
  return (
    <figure className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03] flex flex-col gap-6">
      <blockquote className="font-editorial text-h4 text-text leading-snug">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption>
        <p className="text-body text-text">{name}</p>
        <p className="text-small text-text-faint">{role}</p>
      </figcaption>
    </figure>
  );
}

// NewsletterSignupPlaceholder removed — was a server-side <form action="/api/newsletter/subscribe">
// which 404'd because that route never existed. Replaced with the client-side
// <NotifyMeForm /> component (imported above) that POSTs to /api/waitlist/join.
