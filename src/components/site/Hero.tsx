"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { HeroGlobe, paymentInSlot, useGlobeClock } from "./HeroGlobe";
import type { GlobePayment } from "./HeroGlobe";
import { DownloadLink } from "./DownloadLink";

/**
 * Hero — duality scene.
 *
 * The GSAP intro runs ONCE on mount, then the type stays put. Re-triggering on
 * scroll-up gets gimmicky — Linear / Stripe / Mercury pattern: a hero is a
 * moment, not a loop.
 *
 * The globe sits center-right with two glass cards beside it, top-left and
 * bottom-right. The cards are not static: each is a slot that turns over as
 * payments land on the globe, driven by the globe's own clock so a card and
 * its arc arrive together.
 *
 * The two animations own different properties and must stay that way. GSAP
 * animates the wrapper (the intro reveal, once); the card inside animates its
 * own opacity and lift, every cycle. Sharing an element would have the intro
 * and the cycle fighting over one opacity.
 */

/** Seconds the count-up takes. */
const ROLL = 0.9;

/**
 * The amount, counted up on arrival when the payment asks for it.
 *
 * Two things keep the roll from jittering the line it sits on: the digits are
 * already monospaced, and the span reserves the final width in `ch` up front,
 * so the currency beside it never slides while the number grows.
 *
 * Anything the regex does not recognise as a plain figure — "+4.2M", "+25.40" —
 * renders as authored. A count-up that has to invent a format is a count-up
 * that will one day print something the copy never said.
 */
function Amount({ payment, age }: { payment: GlobePayment; age: number }) {
  const plain = payment.roll ? /^([+-]?)([\d,]+)$/.exec(payment.amount) : null;
  if (!plain || age >= ROLL) {
    return <span className="font-mono">{payment.amount}</span>;
  }
  const target = Number(plain[2].replace(/,/g, ""));
  // Cubic, not exponential: an expo count-up is inside 5% of its target by the
  // time the card has finished fading in, so the remaining half second reads as
  // a number that has stalled rather than one still arriving.
  const eased = 1 - Math.pow(1 - age / ROLL, 3);
  return (
    <span
      className="font-mono inline-block"
      style={{ minWidth: `${payment.amount.length}ch` }}
    >
      {plain[1]}
      {Math.round(target * eased).toLocaleString("en-US")}
    </span>
  );
}

function PaymentCard({ slot, clock }: { slot: number; clock: number }) {
  const { payment, age, remaining } = paymentInSlot(slot, clock);

  // In on arrival, out just before the slot turns over. Both ends are derived
  // from the clock rather than held in state, so the card is correct on any
  // frame it happens to be mounted on — including the reduced-motion still.
  const arriving = Math.min(1, age / 0.45);
  const leaving = Math.min(1, remaining / 0.35);
  const eased = 1 - Math.pow(1 - arriving, 3);

  return (
    <div
      className="max-w-[250px] glass rounded-card p-3.5 md:p-4 shadow-lg"
      style={{
        opacity: Math.min(eased, leaving),
        transform: `translateY(${(10 * (1 - eased)).toFixed(2)}px)`,
      }}
    >
      {/*
        Amber on both cards, not one amber and one moonlight. Moonlight
        (#5B7CFF) on this hero's blue gradient is 1.43:1 — the kicker was
        effectively invisible. Amber clears 2.97:1 on the same ground.
      */}
      <div className="flex items-center gap-2 text-tiny uppercase tracking-wider text-amber">
        <span className="w-1.5 h-1.5 rounded-full bg-amber" />
        {payment.kicker}
      </div>
      <div className="mt-2 font-display text-h4 font-light text-text leading-tight">
        <Amount payment={payment} age={age} />{" "}
        <span className="text-text-muted text-small">{payment.currency}</span>
      </div>
      {/*
        text-text, not text-text-faint. The faint grey (#5A6068) is 1.22:1 on
        this hero's blue gradient — the corridor was unreadable. Hierarchy here
        comes from size and weight, which the h4 amount above already carries;
        it does not need the colour as well.
      */}
      <div className="mt-1 text-tiny text-text">{payment.note}</div>
    </div>
  );
}

export function Hero() {
  const root = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const phone = useRef<HTMLDivElement | null>(null);
  const cardTop = useRef<HTMLDivElement | null>(null);
  const cardBottom = useRef<HTMLDivElement | null>(null);
  const headline = useRef<HTMLHeadingElement | null>(null);
  const sub = useRef<HTMLParagraphElement | null>(null);
  const ctas = useRef<HTMLDivElement | null>(null);

  // One clock for the globe and both cards. Pauses itself off screen.
  const clock = useGlobeClock(stage);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // Pre-state
      gsap.set(phone.current, { opacity: 0, y: 24, scale: 0.98 });
      gsap.set([cardTop.current, cardBottom.current], { opacity: 0, y: 16, scale: 0.96 });
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

      // 1.4 — payment card slot A
      tl.to(
        cardTop.current,
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" },
        1.4,
      );

      // 1.8 — subhead
      tl.to(sub.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 1.8);

      // 2.2 — ctas
      tl.to(ctas.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 2.2);

      // 2.6 — payment card slot B
      tl.to(
        cardBottom.current,
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
              One account for people who earn in one country and live in another.
              Get paid in minutes, earn on the balance while it sits, and spend it
              wherever you are — with the keys in your pocket, not ours.
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
                global earners already on HOLD
              </span>
            </div>
          </div>

          {/* RIGHT — animated payment globe with floating glass cards */}
          <div className="lg:col-span-5">
            <div ref={stage} className="relative aspect-square w-full max-w-md mx-auto">
              <div ref={phone} className="absolute inset-0 flex items-center justify-center">
                {/*
                  Square window, and the globe's own bubbles stay off — in a
                  448px slot they would scale down to about half the size the
                  cards read at, and they would say the same thing twice.
                */}
                <HeroGlobe fit="globe" showBubbles={false} clock={clock} />
              </div>

              <div ref={cardTop} className="absolute top-6 -left-2 md:-left-8 z-10">
                <PaymentCard slot={0} clock={clock} />
              </div>

              <div ref={cardBottom} className="absolute bottom-10 -right-2 md:-right-8 z-10">
                <PaymentCard slot={1} clock={clock} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
