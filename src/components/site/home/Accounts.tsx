"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { AmberCta, PHOTO_GLASS } from "./ui";
import { Icon, type IconName } from "./Icon";

/**
 * The account three ways, the way Revolut shows "Your salary, reimagined",
 * but alive: one card at a time comes forward. The section's ground is that
 * card's photo, large and blurred; a segmented pill with a filling timeline
 * says which one is on, and when the line fills, the next card grows, the
 * others step back and the ground fades to its photo. On a laptop the cards
 * stay in place, side by side, and only their size changes; on a
 * phone, where they do not fit, the forward one moves to the centre. A tap on the pill
 * jumps there; hovering pauses. With reduced motion nothing moves on its own.
 *
 * Main in euros, Main in dollars, Savings, and a pocket: the faces the app
 * really has. Every figure is an example.
 */
const CARDS: {
  photo: string;
  pos: string;
  alt: string;
  pill: string;
  label: string;
  amount: string;
  row: { icon: IconName; title: string; sub: string; amount: string };
}[] = [
  {
    photo: "/home/lisbon.jpg",
    pos: "30% 50%",
    alt: "A woman with coffee on a balcony over the rooftops of Lisbon",
    pill: "Euro",
    label: "Main · EUR",
    amount: "€1,850.00",
    row: { icon: "at", title: "@marta", sub: "Yesterday", amount: "−€45.00" },
  },
  {
    photo: "/home/walk.jpg",
    pos: "40% 50%",
    alt: "A woman in a linen coat walking past a deep blue wall",
    pill: "Dollar",
    label: "Main · USD",
    amount: "$2,340.10",
    row: { icon: "bank", title: "Client paid", sub: "Friday", amount: "+$1,800.00" },
  },
  {
    photo: "/home/towel.jpg",
    pos: "40% 45%",
    alt: "A woman lying in the sun on a striped towel with a coffee",
    pill: "Savings",
    label: "Savings",
    amount: "$1,500.00",
    row: { icon: "leaf", title: "From Main", sub: "Earning", amount: "+$500.00" },
  },
  {
    // A pocket, named the way people name them in the app ("Travel, rent,
    // anything you name"). Stand-in photo until the Thailand one is saved
    // as /home/pocket-thailand.jpg.
    photo: "/home/train.jpg",
    pos: "35% 50%",
    alt: "The sea and a coastal village seen from a train window",
    pill: "Pockets",
    label: "Pocket · Thailand",
    amount: "$860.00",
    row: { icon: "wallet", title: "From Main", sub: "Monday", amount: "+$200.00" },
  },
];

/** How long each card stays forward. */
const STEP_MS = 4500;

export function Accounts() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // The timeline is the clock: when the forward segment's line fills, the
  // next card comes forward. Pausing pauses the line, so they never drift.
  const next = () => setActive((i) => (i + 1) % CARDS.length);

  return (
    <section
      id="accounts"
      className="relative scroll-mt-16 overflow-hidden px-4 py-20 md:px-8 md:py-28"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* The ground: the forward card's photo, large and blurred */}
      <div className="absolute inset-0 bg-[#1B2D36]" aria-hidden>
        {CARDS.map((c, i) => (
          <div
            key={c.photo}
            className="absolute inset-0 transition-opacity duration-[1200ms] ease-out"
            style={{ opacity: i === active ? 1 : 0 }}
          >
            <Image src={c.photo} alt="" fill sizes="100vw" quality={40} className="scale-125 object-cover blur-[60px]" style={{ objectPosition: c.pos }} />
          </div>
        ))}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className="relative mx-auto max-w-[1120px] text-center">
        <h2 className="text-[36px] font-medium leading-[1.06] tracking-[-0.035em] text-white md:text-[56px]">
          Your pay, <em className="italic">reimagined</em>
        </h2>
        <p className="mx-auto mt-5 max-w-[640px] text-[18px] leading-[1.5] text-white/90 md:text-[20px]">
          Get paid into your own accounts, send in seconds, and let your Savings grow while you sleep. All from one app.
        </p>
        <div className="mt-8">
          <AmberCta>Open your account</AmberCta>
        </div>

      </div>

      {/* The cards: the forward one grows, the others step back */}
      <div className="relative mx-auto mt-12 h-[480px] max-w-[1120px] md:h-[500px]">
        {CARDS.map((c, i) => {
          const on = i === active;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${c.label}, ${c.amount}`}
              className={`acc-card absolute outline-none focus-visible:ring-2 focus-visible:ring-white/70 left-1/2 top-1/2 aspect-[3/4] w-[min(320px,80vw)] overflow-hidden rounded-[28px] text-left shadow-[0_30px_60px_rgba(0,0,0,0.30)] transition-all duration-700 ease-out-soft md:w-[290px] ${
                Math.abs(i - active) > 1 ? "max-md:opacity-0" : ""
              }`}
              style={
                {
                  "--om": i - active,
                  "--od": i - (CARDS.length - 1) / 2,
                  transform: `translate(calc(-50% + var(--o) * var(--step)), -50%) scale(${on ? 1.08 : 0.86})`,
                  opacity: on ? 1 : 0.8,
                  zIndex: on ? 3 : 2,
                } as CSSProperties
              }
            >
              <Image src={c.photo} alt={c.alt} fill quality={90} sizes="(min-width: 768px) 380px, 75vw" className="object-cover" style={{ objectPosition: c.pos }} />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/50" />
              <div className="absolute inset-x-0 top-[34%] flex flex-col items-center text-white">
                <p className="text-[14px] font-medium text-white/90">{c.label}</p>
                <p className="mt-1 text-[40px] font-semibold leading-none tracking-[-0.03em] [text-shadow:0_2px_16px_rgba(0,0,0,0.25)]">{c.amount}</p>
                <span className={`mt-4 rounded-full px-4 py-2 text-[14px] font-semibold ${PHOTO_GLASS}`}>Accounts</span>
              </div>
              <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[18px] bg-white px-3.5 py-3 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00C2FF] text-white">
                  <Icon name={c.row.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-[#0F0F1A]">{c.row.title}</span>
                  <span className="block truncate text-[13px] text-[#5F6975]">{c.row.sub}</span>
                </span>
                <span className="text-[15px] font-semibold text-[#0F0F1A]">{c.row.amount}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="relative mt-10 flex justify-center">
        {/* The segmented pill, each segment its own timeline */}
        <div role="tablist" aria-label="Accounts" className={`mx-auto inline-flex gap-1 rounded-full p-1 ${PHOTO_GLASS}`}>
          {CARDS.map((c, i) => {
            const on = i === active;
            return (
              <button
                key={c.pill}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(i)}
                className={`relative overflow-hidden rounded-full px-5 py-2 text-[15px] font-medium outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-white/70 ${
                  on ? "bg-white text-[#0F0F1A]" : "text-white hover:bg-white/10"
                }`}
              >
                {c.pill}
                {on && !still && (
                  <span
                    key={active}
                    onAnimationEnd={next}
                    className="absolute bottom-0 left-0 h-[3px] bg-[#00C2FF]"
                    style={{
                      animation: `hold-timeline ${STEP_MS}ms linear forwards`,
                      animationPlayState: paused ? "paused" : "running",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        #accounts { --step: 74vw; }
        #accounts .acc-card { --o: var(--om); }
        @media (min-width: 768px) {
          #accounts { --step: 300px; }
          #accounts .acc-card { --o: var(--od); }
        }
        @keyframes hold-timeline { from { width: 0% } to { width: 100% } }
      `}</style>
    </section>
  );
}
