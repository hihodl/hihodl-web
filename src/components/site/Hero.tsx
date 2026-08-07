"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { PaymentGlobe } from "./PaymentGlobe";
import { DownloadLink } from "./DownloadLink";

/**
 * Hero — duality scene.
 *
 * Animation runs ONCE on mount, then content stays static.
 * Re-triggering on scroll-up gets gimmicky — Linear / Stripe / Mercury
 * pattern: hero is a moment, not a loop.
 *
 * The phone PNG sits center-right. Two glass cards animate in beside it:
 *   - "Salary received"  (top-left of phone, moonlight blue — global)
 *   - "Card · €4.20"      (bottom-right of phone, amber — local)
 *
 * Until /public/hero-phone.png exists, the phone slot shows a gradient
 * placeholder that matches the dark cinematic mood.
 */
export function Hero() {
  const root = useRef<HTMLDivElement | null>(null);
  const phone = useRef<HTMLDivElement | null>(null);
  const cardSalary = useRef<HTMLDivElement | null>(null);
  const cardCard = useRef<HTMLDivElement | null>(null);
  const headline = useRef<HTMLHeadingElement | null>(null);
  const sub = useRef<HTMLParagraphElement | null>(null);
  const ctas = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // Pre-state
      gsap.set(phone.current, { opacity: 0, y: 24, scale: 0.98 });
      gsap.set([cardSalary.current, cardCard.current], { opacity: 0, y: 16, scale: 0.96 });
      gsap.set(sub.current, { opacity: 0, y: 12 });
      gsap.set(ctas.current, { opacity: 0, y: 12 });
      const lines = headline.current?.querySelectorAll<HTMLSpanElement>("[data-line]") ?? [];
      gsap.set(lines, { opacity: 0, y: 24, filter: "blur(6px)" });

      // 0.0 — phone fades in
      tl.to(phone.current, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: "power2.out" }, 0);

      // 0.4 — headline lines stagger
      tl.to(
        lines,
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, stagger: 0.08, ease: "power3.out" },
        0.4,
      );

      // 1.4 — salary card (moonlight)
      tl.to(
        cardSalary.current,
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" },
        1.4,
      );

      // 1.8 — subhead
      tl.to(sub.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 1.8);

      // 2.2 — ctas
      tl.to(ctas.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 2.2);

      // 2.6 — card swipe (amber)
      tl.to(
        cardCard.current,
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" },
        2.6,
      );
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #2C4566 0%, #4F7090 50%, #2C4566 100%)",
      }}
      aria-label="Earn globally, live locally"
    >
      {/* Premium signature gradient — same as HUSD section.
         Three "premium moments" through the page (hero / mid-CTA / HUSD)
         create a rhythm without diluting the blue. */}
      {/* Depth — radial highlights amplify the linear gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(70% 70% at 30% 30%, rgba(114,149,181,0.32), transparent 70%), radial-gradient(70% 70% at 80% 80%, rgba(44,69,102,0.40), transparent 70%)",
        }}
        aria-hidden
      />
      {/* Amber anchor — only behind the phone/globe stage to ground the warmth */}
      <div
        className="absolute top-[10%] right-0 w-[45%] h-[65%] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255, 183, 3, 0.16), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="container-page relative pt-12 md:pt-20 pb-20 md:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT — type & CTA */}
          <div className="lg:col-span-7">
            <h1
              ref={headline}
              className="font-display text-display-sm md:text-display text-text"
              style={{ fontWeight: 200 }}
            >
              <span data-line className="block">Earn globally,</span>
              <span data-line className="block">live locally.</span>
            </h1>

            <p
              ref={sub}
              className="mt-8 text-lead text-text-muted max-w-xl"
            >
              The stablecoin wallet for global earners.
              Receive your income privately. You control your money.
              Send to usernames, not long addresses — across every chain, without thinking about gas.
            </p>

            <div ref={ctas} className="mt-10 flex flex-wrap gap-3">
              <DownloadLink className="inline-flex items-center justify-center px-7 py-4 rounded-pill bg-amber text-text-on-amber font-medium text-body hover:bg-amber-glow transition-all duration-180 ease-out-soft hover:scale-[1.02]">
                Download
              </DownloadLink>
              <Link
                href="#how"
                className="inline-flex items-center justify-center px-7 py-4 rounded-pill border border-[color:var(--color-hairline-strong)] text-text font-medium text-body hover:bg-white/5 transition-colors duration-180"
              >
                See how it works
              </Link>
            </div>

            {/* Social proof line */}
            <div className="mt-8 flex items-center gap-3 text-small text-text-muted">
              <div className="flex -space-x-2">
                {[0,1,2,3].map((i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full border border-abyss"
                    style={{
                      background: [
                        "linear-gradient(135deg,#7295B5,#4F7090)",
                        "linear-gradient(135deg,#FFD234,#FFB703)",
                        "linear-gradient(135deg,#5B7CFF,#2A3866)",
                        "linear-gradient(135deg,#B87D00,#FFB703)",
                      ][i],
                    }}
                  />
                ))}
              </div>
              <span>
                <span className="font-mono text-text font-medium">50,000+</span>{" "}
                global earners already on HIHODL
              </span>
            </div>
          </div>

          {/* RIGHT — animated payment globe with floating glass cards */}
          <div className="lg:col-span-5">
            <div className="relative aspect-square w-full max-w-md mx-auto">
              <div ref={phone} className="absolute inset-0 flex items-center justify-center">
                <PaymentGlobe />
              </div>

              {/* Salary received — top-left, moonlight accent */}
              <div
                ref={cardSalary}
                className="absolute top-6 -left-2 md:-left-8 max-w-[230px] glass rounded-card p-3.5 md:p-4 shadow-lg z-10"
              >
                <div className="flex items-center gap-2 text-tiny uppercase tracking-wider text-moonlight">
                  <span className="w-1.5 h-1.5 rounded-full bg-moonlight" />
                  Salary received
                </div>
                <div className="mt-2 font-display text-h4 font-light text-text leading-tight">
                  +<span className="font-mono">3,200</span>{" "}
                  <span className="text-text-muted text-small">USDC</span>
                </div>
                <div className="mt-1 text-tiny text-text-faint">
                  from Acme · San Francisco
                </div>
              </div>

              {/* Gasless swap — bottom-right, amber accent */}
              <div
                ref={cardCard}
                className="absolute bottom-10 -right-2 md:-right-8 max-w-[220px] glass rounded-card p-3.5 md:p-4 shadow-lg z-10"
              >
                <div className="flex items-center gap-2 text-tiny uppercase tracking-wider text-amber">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber" />
                  Swap · zero gas
                </div>
                <div className="mt-2 font-display text-h4 font-light text-text leading-tight">
                  <span className="font-mono">30</span>{" "}
                  <span className="text-text-muted text-small">USDG</span>
                  <span className="text-text-faint mx-1">→</span>
                  <span className="font-mono">0.34</span>{" "}
                  <span className="text-text-muted text-small">SOL</span>
                </div>
                <div className="mt-1 text-tiny text-text-faint">
                  Network fee · <span className="text-success">Free</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
