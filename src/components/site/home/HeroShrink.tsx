"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Wordmark } from "@/components/site/Wordmark";
import { AmberCta, BODY } from "./ui";
import { MainCard } from "./MainCard";

/**
 * The hero, the way Revolut opens: one full screen photo, and as you scroll
 * it shrinks into a card and becomes the account. The photo is never moved
 * or scaled; a clip-path closes around it, so the people stay where they
 * were and the card simply frames them. Then the Main card's face (balance,
 * currencies, Add, Pay, Move, Accounts) appears on the photo, and the copy
 * arrives beside it (below it on a phone).
 *
 * One number drives it all: --p, from 0 (full screen) to 1 (card), written
 * on scroll inside requestAnimationFrame. The card's final box is a set of
 * CSS variables per breakpoint, so the clip, the face and the copy all read
 * the same geometry. With reduced motion it starts, and stays, at the card.
 */

const GEOMETRY = `
.hold-shrink {
  --cw: min(340px, calc(100vw - 32px));
  --ch: min(430px, 54svh);
  --t: 80px;
  --l: calc((100% - var(--cw)) / 2);
}
@media (min-width: 768px) {
  .hold-shrink {
    --cw: 420px;
    --ch: min(560px, calc(100svh - 160px));
    --t: calc((100% - var(--ch)) / 2 + 28px);
    --l: calc(50% + 24px);
  }
}
.hold-shrink {
  --b: calc(100% - var(--t) - var(--ch));
  --r: calc(100% - var(--l) - var(--cw));
}
`;

export function HeroShrink() {
  const box = useRef<HTMLDivElement | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const travel = el.offsetHeight - window.innerHeight;
        const scrolled = -el.getBoundingClientRect().top;
        // The close happens over the first 70% of the section; the rest holds the card.
        const p = still ? 1 : Math.min(1, Math.max(0, scrolled / (travel * 0.7)));
        el.style.setProperty("--p", p.toFixed(4));
        setDone(p > 0.85);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const clip: CSSProperties = {
    clipPath:
      "inset(calc(var(--p) * var(--t)) calc(var(--p) * var(--r)) calc(var(--p) * var(--b)) calc(var(--p) * var(--l)) round calc(var(--p) * 28px))",
  };
  const cardBox: CSSProperties = { top: "var(--t)", left: "var(--l)", width: "var(--cw)", height: "var(--ch)" };

  return (
    <section ref={box} className="hold-shrink relative h-[260svh] bg-white" style={{ "--p": 0 } as CSSProperties}>
      <style>{GEOMETRY}</style>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* The photo, closing into the card */}
        <div className="absolute inset-0 will-change-[clip-path]" style={clip}>
          <Image
            src="/home/crew.jpg"
            alt="Three friends in linen on white steps against a blue wall"
            fill
            priority
            quality={90}
            sizes="100vw"
            className="object-cover [object-position:50%_50%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-black/20" />
        </div>

        {/* The opening headline, on the full photo; it leaves as the card closes */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-12 md:px-12 md:pb-16"
          style={{ opacity: "clamp(0, calc(1 - var(--p) * 3), 1)", transform: "translateY(calc(var(--p) * -60px))" }}
        >
          <h1 className="max-w-[900px] text-[50px] font-medium leading-[0.98] tracking-[-0.045em] text-white md:text-[104px]">
            Your money,
            <br />
            without borders.
          </h1>
        </div>

        {/* The account's face, on the card */}
        <div
          className="absolute"
          style={{ ...cardBox, opacity: "clamp(0, calc((var(--p) - 0.6) * 3), 1)", pointerEvents: done ? "auto" : "none" }}
        >
          <MainCard fill />
        </div>

        {/* The copy: beside the card on a laptop, under it on a phone */}
        <div
          className="absolute inset-x-0 px-5 text-center md:left-0 md:right-[calc(50%+56px)] md:top-1/2 md:-translate-y-1/2 md:px-0 md:pl-[max(32px,calc(50%-560px))] md:text-left"
          style={{
            top: "calc(var(--t) + var(--ch) + 20px)",
            opacity: "clamp(0, calc((var(--p) - 0.65) * 3), 1)",
            pointerEvents: done ? "auto" : "none",
          }}
        >
          <Wordmark className="mx-auto hidden h-9 w-auto text-[#0E0E19] md:mx-0 md:block" />
          <p className="mt-0 text-[24px] font-medium leading-[1.15] tracking-[-0.025em] text-[#0F0F1A] md:mt-6 md:text-[44px] md:leading-[1.04]">
            Get paid in dollars, euros and pounds. Send home in seconds.
          </p>
          <p className={`mx-auto mt-3 hidden max-w-[460px] text-[18px] leading-[1.5] md:mx-0 md:block ${BODY}`}>
            Your own USD, EUR and GBP accounts, reais in by Pix, money out to Pix, SPEI and Bre-B in seconds, Savings that
            earns while you sleep, and Hi to book the trip from your balance.
          </p>
          <div className="mt-4 md:mt-8">
            <AmberCta />
          </div>
        </div>
      </div>
    </section>
  );
}
