"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { AmberCta, APP } from "./ui";
import { Icon, type IconName } from "./Icon";

/**
 * The hero is a product page, the way Persona sells its band: photos on top,
 * and a sheet that holds the product itself (the account, its two cards, the
 * one action, and what is inside). On a phone the sheet rises over the
 * gallery like the app's Accounts sheet; on a wide screen the gallery stays
 * on the left while the sheet scrolls beside it.
 *
 * Every line in the sheet is something the app says about itself on
 * release/ios-build-13 (src/i18n/resources/en). The old site is not a source.
 */

const PHOTOS = [
  { src: "/home/walk.jpg", alt: "A woman in a linen coat walking past a deep blue wall", pos: "40% 50%" },
  { src: "/home/crew.jpg", alt: "Three friends in linen on white steps against a blue wall", pos: "50% 50%" },
  { src: "/home/towel.jpg", alt: "A woman lying in the sun on a striped towel with a coffee", pos: "35% 50%" },
  { src: "/home/lisbon.jpg", alt: "A woman with coffee on a balcony over Lisbon", pos: "25% 50%" },
  { src: "/home/tokyo.jpg", alt: "A woman arriving in a quiet Tokyo street at dusk", pos: "55% 40%" },
  { src: "/home/train.jpg", alt: "A man by a train window along the Italian coast", pos: "60% 40%" },
  { src: "/home/designer.jpg", alt: "A man leaning back from his desk in a sunny apartment", pos: "52% 40%" },
  { src: "/home/linen.jpg", alt: "A man in a linen shirt in front of a blue door", pos: "45% 35%" },
];

const CURRENCIES = {
  USD: { amount: "$2,340.10", label: "Get paid in dollars" },
  EUR: { amount: "€2,152.40", label: "Live in euros" },
} as const;
type Currency = keyof typeof CURRENCIES;

const CAN_DO: { icon: IconName; text: string }[] = [
  { icon: "bank", text: "Get paid with your own USD and EUR account details" },
  { icon: "at", text: "Send to a @username, no address to copy" },
  { icon: "split", text: "Split the trip in a group chat, settle in a tap" },
  { icon: "leaf", text: "Savings that earns while you sleep" },
  { icon: "chart", text: "Bitcoin, Solana and more, right from your balance" },
  { icon: "bed", text: "Nearly two million hotels, with USDC back" },
  { icon: "signal", text: "eSIM data, nothing to type and nothing to scan" },
  { icon: "spark", text: "Hi, your money assistant, does it for you" },
];

const SAFE: { icon: IconName; text: string }[] = [
  { icon: "key", text: "Only you can take your money out" },
  { icon: "face", text: "Face ID for anything sensitive, your PIN as a fallback" },
  { icon: "lifebuoy", text: "Recovery codes, so a lost phone never locks you out" },
  { icon: "phoneOff", text: "We never call about your money" },
];

export function Hero() {
  const [index, setIndex] = useState(0);
  const [currency, setCurrency] = useState<Currency>("USD");
  const track = useRef<HTMLDivElement | null>(null);

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <section className="md:mx-auto md:grid md:max-w-[1240px] md:grid-cols-[1.1fr_1fr] md:gap-12 md:px-8 md:pt-24">
      {/* Gallery */}
      <div className="relative h-[60svh] md:sticky md:top-24 md:h-[calc(100svh-120px)] md:overflow-hidden md:rounded-[32px]">
        <div
          ref={track}
          onScroll={onScroll}
          className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PHOTOS.map((p, i) => (
            <div key={p.src} className="relative h-full w-full shrink-0 snap-center">
              <Image
                src={p.src}
                alt={p.alt}
                fill
                quality={90}
                priority={i === 0}
                sizes="(min-width: 768px) 55vw, 100vw"
                className="object-cover"
                style={{ objectPosition: p.pos }}
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/40 to-transparent md:hidden" />
        <div className="absolute inset-x-0 bottom-10 flex justify-center gap-2 px-4 md:bottom-6">
          {PHOTOS.map((p, i) => (
            <button
              key={p.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Photo ${i + 1}`}
              className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full transition-all duration-180 ${
                i === index ? "ring-2 ring-white ring-offset-2 ring-offset-black/30" : "opacity-75 hover:opacity-100"
              }`}
            >
              <Image src={p.src} alt="" fill sizes="36px" className="object-cover" style={{ objectPosition: p.pos }} />
            </button>
          ))}
        </div>
      </div>

      {/* The sheet */}
      <div
        className="relative -mt-6 rounded-t-[28px] px-5 pb-6 pt-3 md:mt-0 md:rounded-none md:px-0 md:pb-16 md:pt-4"
        style={{ background: APP.ground }}
      >
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-white/25 md:hidden" aria-hidden />

        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white">
          Stablecoin account <span className="text-[#9FB7C2]">· Self custodial</span>
        </p>
        <h1 className="mt-3 text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white md:text-[46px]">
          HOLD
        </h1>
        <p className="mt-3 text-[18px] leading-[1.45] text-white md:text-[20px]">
          Dollars and euros in one account, and Hi to move them. Get paid, send, split and save, then
          let Hi book the trip from your balance.
        </p>

        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[15px] font-semibold text-white">
          {["Your keys, your money", "iPhone and Android"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: APP.cyan }}>
                <Icon name="check" size={13} className="text-[#0F0F1A]" />
              </span>
              {t}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-[12px] font-bold uppercase tracking-[0.14em] text-[#9FB7C2]">Included with your account</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <AccountTile
            name="Main"
            amount={CURRENCIES[currency].amount}
            gradient={`linear-gradient(135deg, ${APP.cyan}, ${APP.cyanGlow})`}
            caption="Main account"
            sub={`+ ${currency} account details`}
          />
          <AccountTile
            name="Savings"
            amount={currency === "USD" ? "$1,500.00" : "€1,380.00"}
            gradient={`linear-gradient(135deg, ${APP.silver}, ${APP.silverDeep})`}
            caption="Savings"
            sub="Earns while you sleep"
          />
        </div>

        <div className="mt-4 rounded-[22px] border border-white/10 p-3">
          <p className="px-1 text-[15px] font-semibold text-white">
            Pick your currency <span className="font-normal text-[#9FB7C2]">(you can have both)</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Currency">
            {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => setCurrency(c)}
                className={`flex flex-col items-center rounded-[16px] px-3 py-3 transition-colors duration-180 ${
                  currency === c ? "bg-white text-[#0F0F1A]" : "bg-white/[0.06] text-white hover:bg-white/10"
                }`}
              >
                <span className="text-[20px] font-extrabold">{c === "USD" ? "$" : "€"}</span>
                <span className="mt-0.5 text-[15px] font-bold">{c}</span>
                <span className={`text-[13px] ${currency === c ? "text-[#0F0F1A]/70" : "text-[#9FB7C2]"}`}>
                  {CURRENCIES[c].label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <AmberCta wide />
        </div>

        <div className="mt-8 divide-y divide-white/10 border-t border-white/10">
          <Fold title="What you can do" icon="spark" open>
            <List items={CAN_DO} />
          </Fold>
          <Fold title="Keeping it safe" icon="key">
            <List items={SAFE} />
          </Fold>
          <Fold title="The HOLD card" icon="card">
            <p className="pb-5 pl-9 text-[15px] leading-[1.5] text-[#C8D0D9]">
              A Visa card to spend your dollars anywhere is on its way. Join the waitlist in the app to be first.
            </p>
          </Fold>
        </div>

        <a
          href="#faq"
          className="mt-6 flex items-center gap-3 rounded-[18px] border border-white/10 px-4 py-3.5 transition-colors hover:bg-white/[0.04]"
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Icon name="spark" size={18} className="text-white" />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0D1820]" style={{ background: APP.cyan }} />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-white">Questions before you start?</span>
            <span className="block text-[13px] text-[#9FB7C2]">The answers are a scroll away</span>
          </span>
          <Icon name="arrow" size={18} className="text-white/60" />
        </a>
      </div>
    </section>
  );
}

function AccountTile({
  name,
  amount,
  gradient,
  caption,
  sub,
}: {
  name: string;
  amount: string;
  gradient: string;
  caption: string;
  sub: string;
}) {
  return (
    <div className="rounded-[22px] bg-white/[0.06] p-3 text-center">
      <div className="flex aspect-[1.58/1] flex-col justify-between rounded-[14px] p-3 text-left" style={{ background: gradient }}>
        <span className="text-[12px] font-bold text-[#0F0F1A]/70">{name}</span>
        <span className="text-[18px] font-extrabold tracking-[-0.01em] text-[#0F0F1A]">{amount}</span>
      </div>
      <p className="mt-3 text-[15px] font-bold text-white">{caption}</p>
      <p className="text-[13px] text-[#9FB7C2]">{sub}</p>
    </div>
  );
}

function Fold({ title, icon, open, children }: { title: string; icon: IconName; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4 text-[17px] font-bold text-white [&::-webkit-details-marker]:hidden">
        <Icon name={icon} size={20} className="text-white" />
        <span className="flex-1">{title}</span>
        <Icon name="chevron" size={18} className="text-white/70 transition-transform duration-180 group-open:rotate-180" />
      </summary>
      {children}
    </details>
  );
}

function List({ items }: { items: { icon: IconName; text: string }[] }) {
  return (
    <ul className="space-y-3 pb-5 pl-9">
      {items.map((it) => (
        <li key={it.text} className="flex items-start gap-3 text-[15px] leading-[1.4] text-[#C8D0D9]">
          <Icon name={it.icon} size={17} className="mt-0.5 shrink-0 text-[#9FB7C2]" />
          {it.text}
        </li>
      ))}
    </ul>
  );
}
