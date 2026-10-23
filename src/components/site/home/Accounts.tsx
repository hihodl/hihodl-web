"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { AmberCta, PHOTO_GLASS } from "./ui";
import { Icon, type IconName } from "./Icon";
import { Flag, type FlagCode } from "./Flag";

/**
 * The account four ways, alive but never on its own: the section's ground
 * is the forward card's photo, large and blurred, and the segmented pill
 * under the cards picks which one comes forward (a tap on a card does the
 * same). The picked card grows, the others step back, and the ground fades
 * to its photo. On a laptop the cards stay in place, side by side, and only
 * their size changes; on a phone, where they do not fit, the forward one
 * moves to the centre.
 *
 * Main in euros, Main in dollars, Savings, and a pocket: the faces the app
 * really has. Every figure is an example.
 */
/**
 * Each card is the app's own account card (dashboard, release/ios-build-13):
 * the account's name in a pill top left, the currency pill top right, the
 * balance left aligned, a line under it, and the four square glass buttons
 * at the foot. No banner: it crowded the card and hid the person.
 */
const CARDS: {
  photo: string;
  pos: string;
  /**
   * How far down the card the sharp photo starts, as a share of its height.
   * Above it, the same photo blurred, which is where the balance sits.
   */
  drop?: number;
  alt: string;
  pill: string;
  name: string;
  flags: FlagCode[];
  code: string;
  amount: string;
  line: string;
}[] = [
  {
    // Faces sit high in these photos, where the card puts the balance, so
    // the photo drops into the card (see `drop`) and the face lands between
    // the balance and the buttons, the way the app shows a person.
    photo: "/home/lisbon.jpg",
    pos: "30% 0%",
    drop: 0.3,
    alt: "A woman with coffee on a balcony over the rooftops of Lisbon",
    pill: "Euro",
    name: "Main",
    flags: ["EU"],
    code: "EUR",
    amount: "1,850.00 €",
    line: "IBAN in your name ›",
  },
  {
    photo: "/home/linen.jpg",
    pos: "42% 0%",
    drop: 0.38,
    alt: "A man in a linen shirt in front of a blue door",
    pill: "Dollar",
    name: "Main",
    flags: ["US", "EU"],
    code: "All",
    amount: "4,338.10 $",
    line: "Open your account ›",
  },
  {
    photo: "/home/towel.jpg",
    pos: "11% 0%",
    drop: 0.32,
    alt: "A woman lying in the sun on a striped towel with a coffee",
    pill: "Savings",
    name: "Savings",
    flags: ["US"],
    code: "USD",
    amount: "1,500.00 $",
    line: "Earning while you sleep ›",
  },
  {
    // A pocket, named the way people name them in the app ("Travel, rent,
    // anything you name").
    photo: "/home/pocket-thailand.jpg",
    pos: "50% 45%",
    alt: "A longtail boat on a turquoise lake between limestone cliffs in Khao Sok, Thailand",
    pill: "Pockets",
    name: "Thailand",
    flags: ["US"],
    code: "USD",
    amount: "860.00 $",
    line: "Pocket · set aside from Main ›",
  },
];

const BUTTONS: { icon: IconName; label: string }[] = [
  { icon: "addCircle", label: "Add" },
  { icon: "send", label: "Pay" },
  { icon: "swap", label: "Move" },
  { icon: "wallet", label: "Accounts" },
];


export function Accounts() {
  const [active, setActive] = useState(0);



  return (
    <section
      id="accounts"
      className="relative scroll-mt-16 overflow-hidden px-4 py-20 md:px-8 md:py-28"
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
      <div className="relative mx-auto mt-12 h-[540px] max-w-[1120px] md:h-[520px]">
        {CARDS.map((c, i) => {
          const on = i === active;
          return (
            <button
              key={c.pill}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${c.name}, ${c.amount}`}
              className={`acc-card absolute outline-none focus-visible:ring-2 focus-visible:ring-white/70 left-1/2 top-1/2 aspect-[10/16] w-[min(300px,78vw)] overflow-hidden rounded-[28px] text-left shadow-[0_30px_60px_rgba(0,0,0,0.30)] transition-all duration-700 ease-out-soft md:w-[270px] ${
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
              {c.drop ? (
                <Image src={c.photo} alt="" fill quality={40} sizes="300px" className="scale-125 object-cover blur-[28px]" style={{ objectPosition: c.pos }} />
              ) : null}
              <div
                className="absolute inset-0"
                style={
                  c.drop
                    ? {
                        transform: `translateY(${c.drop * 100}%)`,
                        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 16%)",
                        maskImage: "linear-gradient(to bottom, transparent, black 16%)",
                      }
                    : undefined
                }
              >
                <Image src={c.photo} alt={c.alt} fill quality={90} sizes="(min-width: 768px) 380px, 80vw" className="object-cover" style={{ objectPosition: c.pos }} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/5 to-black/45" />
              <div className="absolute inset-0 flex flex-col p-3.5 text-white">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-black/35 px-3 py-1 text-[13px] font-semibold backdrop-blur-md">{c.name}</span>
                  <span className="flex items-center gap-1.5 rounded-full bg-black/35 py-0.5 pl-0.5 pr-2.5 text-[13px] font-semibold backdrop-blur-md">
                    <span className="flex -space-x-1.5">
                      {c.flags.map((f) => (
                        <Flag key={f} code={f} size={22} />
                      ))}
                    </span>
                    {c.code}
                    <Icon name="chevron" size={12} />
                  </span>
                </div>

                <p className="mt-[22%] text-[38px] font-semibold leading-none tracking-[-0.03em] [text-shadow:0_2px_18px_rgba(0,0,0,0.3)]">
                  {c.amount}
                </p>
                <p className="mt-2 truncate text-[13px] font-semibold text-white/90">{c.line}</p>

                <div className="mt-auto grid grid-cols-4 gap-1.5 px-1 pb-1">
                  {BUTTONS.map((btn) => (
                    <span key={btn.label} className="flex flex-col items-center gap-1">
                      <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/20 backdrop-blur-md">
                        <Icon name={btn.icon} size={18} />
                      </span>
                      <span className="text-[11px] font-semibold">{btn.label}</span>
                    </span>
                  ))}
                </div>

              </div>
            </button>
          );
        })}
      </div>

      <div className="relative mt-10 flex justify-center">
        {/* The segmented pill: the only way the cards change */}
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
      `}</style>
    </section>
  );
}
