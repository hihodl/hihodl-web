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
  --ch: min(430px, 50svh);
  --t: min(80px, 11svh);
  --l: calc((100% - var(--cw)) / 2);
}
@media (min-width: 768px) {
  .hold-shrink {
    --ch: min(max(560px, 62svh), calc(100svh - 160px));
    --cw: min(calc(var(--ch) * 0.78), calc(50vw - 64px));
    --t: calc((100% - var(--ch)) / 2 + 28px);
    --l: calc(50% + 24px);
  }
}
.hold-shrink {
  --b: calc(100% - var(--t) - var(--ch));
  --r: calc(100% - var(--l) - var(--cw));
}
/* The copy: under the card on a phone, centred beside it on a laptop */
.hold-shrink .hold-copy { top: calc(var(--t) + var(--ch) + 20px); }
@media (min-width: 768px) {
  .hold-shrink .hold-copy { top: 50%; transform: translateY(-50%); }
}
`;

export function HeroShrink() {
  const box = useRef<HTMLDivElement | null>(null);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(true);

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
        setOpen(p < 0.25);
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
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/30" />
        </div>

        {/* The opening copy, on the blue wall at the top of the photo; it leaves as the card closes */}
        <div
          className="absolute inset-x-0 top-0 mx-auto max-w-[1800px] px-5 pt-[clamp(72px,13svh,96px)] md:px-12 md:pt-[clamp(84px,15svh,132px)]"
          style={{ opacity: "clamp(0, calc(1 - var(--p) * 3), 1)", transform: "translateY(calc(var(--p) * -60px))" }}
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/90 md:text-[14px]">
            Dollars · Euros · Pounds · Pix
          </p>
          <h1 className="mt-4 max-w-[980px] text-[clamp(36px,min(12.5vw,8svh),52px)] font-medium leading-[0.96] tracking-[-0.045em] text-white md:text-[clamp(52px,min(8.5vw,13svh),112px)]">
            Your money,
            <br />
            without borders.
          </h1>
          <p className="mt-5 max-w-[520px] text-[17px] leading-[1.45] text-white/90 md:mt-7 md:text-[clamp(17px,min(1.6vw,3svh),21px)] [@media(max-height:560px)]:hidden">
            One account to get paid from anywhere, send home in seconds and save while you sleep. Hi books the trip from
            your balance. Free, in a tap.
          </p>
          <div className={`mt-7 flex flex-wrap gap-3 md:mt-[clamp(20px,4svh,36px)] [@media(max-height:560px)]:mt-5 ${open ? "" : "pointer-events-none"}`}>
            <AmberCta />
            <a
              href="#accounts"
              className="inline-flex h-14 items-center justify-center rounded-full border border-white/40 bg-white/10 px-8 text-[17px] font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              See your account
            </a>
          </div>
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
          className="hold-copy absolute inset-x-0 px-5 text-center md:left-0 md:right-[calc(50%+56px)] md:px-0 md:pl-[max(32px,calc(50%-560px))] md:text-left"
          style={{
            opacity: "clamp(0, calc((var(--p) - 0.65) * 3), 1)",
            pointerEvents: done ? "auto" : "none",
          }}
        >
          <Wordmark className="mx-auto hidden h-[clamp(22px,min(2.6vw,5svh),44px)] w-auto text-[#0E0E19] md:mx-0 md:block" />
          <p className="mt-0 text-[clamp(19px,min(6.2vw,3.6svh),24px)] font-medium leading-[1.15] tracking-[-0.025em] text-[#0F0F1A] md:mt-[clamp(12px,3svh,24px)] md:text-[clamp(26px,min(3.3vw,6.4svh),56px)] md:leading-[1.04]">
            Get paid in dollars, euros and pounds. Send home in seconds.
          </p>
          <p className={`mx-auto mt-3 hidden max-w-[min(460px,100%)] min-[1600px]:max-w-[540px] text-[clamp(16px,1.2vw,21px)] leading-[1.5] md:mx-0 md:block [@media(max-height:720px)]:!hidden ${BODY}`}>
            Your own USD, EUR and GBP accounts, reais in by Pix, money out to Pix, SPEI and Bre-B in seconds, Savings that
            earns while you sleep, and Hi to book the trip from your balance.
          </p>
          <div className="mt-[clamp(10px,2svh,16px)] md:mt-[clamp(16px,4svh,32px)]">
            <AmberCta />
          </div>
        </div>
      </div>
    </section>
  );
}
