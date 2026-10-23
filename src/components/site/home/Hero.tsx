"use client";

import { Wordmark } from "@/components/site/Wordmark";
import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AmberCta, APP, BODY, PHOTO_GLASS, SOFT, SUBTLE } from "./ui";
import { Icon, type IconName } from "./Icon";

/**
 * The hero is a product page, the way Persona sells its band: a big photo
 * gallery and a column that holds the product. On a phone the column rises
 * over the gallery as a white sheet, like the app's Accounts sheet; on a
 * laptop the gallery is a big rounded card and the column sits beside it,
 * the pair centred with the same margin on both sides.
 *
 * Fintech first: it opens on what HOLD does with money. Custody and keys
 * belong to the privacy section further down, never to the first lines.
 *
 * Every line is something the app says about itself on release/ios-build-13
 * (src/i18n/resources/en) or a row of the live fiat_rail_catalog. The old
 * site is not a source.
 */

const PHOTOS = [
  { src: "/home/crew.jpg", alt: "Three friends in linen on white steps against a blue wall", m: "50% 50%", d: "50% 50%" },
  { src: "/home/walk.jpg", alt: "A woman in a linen coat walking past a deep blue wall", m: "42% 50%", d: "40% 50%" },
  { src: "/home/lisbon.jpg", alt: "A woman with coffee on a balcony over Lisbon", m: "22% 50%", d: "40% 50%" },
  { src: "/home/towel.jpg", alt: "A woman lying in the sun on a striped towel with a coffee", m: "32% 50%", d: "40% 50%" },
  { src: "/home/tokyo.jpg", alt: "A woman arriving in a quiet Tokyo street at dusk", m: "55% 40%", d: "50% 40%" },
  { src: "/home/train.jpg", alt: "A man by a train window along the Italian coast", m: "60% 40%", d: "50% 45%" },
  { src: "/home/designer.jpg", alt: "A man leaning back from his desk in a sunny apartment", m: "52% 35%", d: "50% 35%" },
  { src: "/home/linen.jpg", alt: "A man in a linen shirt in front of a blue door", m: "45% 35%", d: "50% 35%" },
];

/**
 * The Main card, as the app draws it (dashboard, release/ios-build-13): a
 * photo, the balance, a flags pill that opens the balance per currency, and
 * four actions. The dropdown lists the balances the app holds (USD, EUR);
 * GBP is an account you receive into, so it lives under Accounts.
 * Figures are an example balance, not a customer.
 */
const VIEWS = {
  All: { label: "All", sub: null, amount: "$4,338.10", flag: null },
  USD: { label: "US dollar", sub: "USD", amount: "$2,340.10", flag: "🇺🇸" },
  EUR: { label: "Euro", sub: "≈ $1,998.00", amount: "€1,850.00", flag: "🇪🇺" },
} as const;
type View = keyof typeof VIEWS;

type Row = { flag?: string; icon?: IconName; title: string; sub: string };

/**
 * What each of the card's four buttons does, from the live fiat_rail_catalog
 * (23-oct-2026): USD, EUR and GBP are accounts in your name; MXN, BRL and
 * COP are instant payouts over SPEI, Pix and Bre-B. Receiving in MXN, BRL or
 * COP is switched off in the catalog, so it is never offered here.
 */
const ACTIONS: { id: string; label: string; icon: IconName; title: string; rows: Row[] }[] = [
  {
    id: "add",
    label: "Add",
    icon: "addCircle",
    title: "Add money",
    rows: [
      { icon: "bank", title: "Bank transfer", sub: "Into your own USD, EUR or GBP account" },
      { icon: "at", title: "From a friend", sub: "Anyone on HOLD can pay your @username" },
      { icon: "network", title: "From another wallet", sub: "Solana, Polygon, Base and Ethereum" },
    ],
  },
  {
    id: "pay",
    label: "Pay",
    icon: "send",
    title: "Send money",
    rows: [
      { flag: "🇲🇽", title: "Mexico", sub: "Pesos to any CLABE by SPEI, instantly" },
      { flag: "🇧🇷", title: "Brazil", sub: "Reais to any Pix key, instantly" },
      { flag: "🇨🇴", title: "Colombia", sub: "Pesos to any Bre-B key" },
      { flag: "🇪🇺", title: "Europe", sub: "Euros to any IBAN" },
      { flag: "🇬🇧", title: "United Kingdom", sub: "Pounds by Faster Payments" },
      { flag: "🇺🇸", title: "United States", sub: "Dollars to any US bank account" },
    ],
  },
  {
    id: "move",
    label: "Move",
    icon: "swap",
    title: "Move money",
    rows: [
      { icon: "leaf", title: "Into Savings", sub: "It earns while you sleep" },
      { icon: "swap", title: "Dollars and euros", sub: "Convert between them in a tap" },
      { icon: "wallet", title: "Pockets", sub: "Travel, rent, anything you name" },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: "wallet",
    title: "Your accounts",
    rows: [
      { flag: "🇺🇸", title: "US dollar account", sub: "Account and routing number in your name" },
      { flag: "🇪🇺", title: "Euro account", sub: "An IBAN in your name" },
      { flag: "🇬🇧", title: "British pound account", sub: "Sort code and account number in your name" },
    ],
  },
];

const CAN_DO: { icon: IconName; text: string }[] = [
  { icon: "bank", text: "Get paid into your own USD, EUR and GBP accounts" },
  { icon: "download", text: "Send to Mexico, Brazil and Colombia in seconds" },
  { icon: "at", text: "Pay anyone on HOLD by @username" },
  { icon: "split", text: "Split the trip in a group chat, settle in a tap" },
  { icon: "leaf", text: "Savings that earns while you sleep" },
  { icon: "chart", text: "Bitcoin, Solana and more, right from your balance" },
  { icon: "bed", text: "Nearly two million hotels, with money back" },
  { icon: "signal", text: "eSIM data, nothing to type and nothing to scan" },
];

const SAFE: { icon: IconName; text: string }[] = [
  { icon: "face", text: "Face ID for anything sensitive, your PIN as a fallback" },
  { icon: "lifebuoy", text: "Recovery set up in under a minute" },
  { icon: "phoneOff", text: "We never call about your money" },
];

export function Hero() {
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<View>("All");
  const [picker, setPicker] = useState(false);
  const [action, setAction] = useState("accounts");
  const track = useRef<HTMLDivElement | null>(null);

  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  // Every 3 seconds the next photo; after the last, back to the first.
  // The timer restarts whenever the photo changes, so a tap or a swipe
  // gets its full 3 seconds. Nothing moves for reduced motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => goTo((index + 1) % PHOTOS.length), 3000);
    return () => window.clearTimeout(t);
  }, [index]);

  const panel = ACTIONS.find((a) => a.id === action) ?? ACTIONS[3];

  return (
    <section className="bg-white md:mx-auto md:grid md:max-w-[1600px] md:grid-cols-[minmax(0,1fr)_400px] md:gap-10 md:px-8 md:pt-20 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_480px] xl:gap-14">
      {/* Gallery: tall on a phone, wide and big on a laptop */}
      <div className="relative aspect-[4/5] md:sticky md:top-20 md:aspect-[4/3] md:self-start md:overflow-hidden md:rounded-[32px] md:shadow-[0_20px_50px_rgba(15,15,26,0.12)]">
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
                sizes="(min-width: 768px) 66vw, 100vw"
                className="object-cover [object-position:var(--m)] md:[object-position:var(--d)]"
                style={{ "--m": p.m, "--d": p.d } as CSSProperties}
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent md:hidden" />
        <div className="absolute inset-x-0 bottom-10 flex justify-center gap-2 px-4 md:bottom-6">
          {PHOTOS.map((p, i) => (
            <button
              key={p.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Photo ${i + 1}`}
              className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full transition-all duration-180 md:h-11 md:w-11 ${
                i === index ? "ring-2 ring-white ring-offset-2 ring-offset-black/20" : "opacity-80 hover:opacity-100"
              }`}
            >
              <Image src={p.src} alt="" fill sizes="44px" className="object-cover" style={{ objectPosition: p.m }} />
            </button>
          ))}
        </div>
      </div>

      {/* The product column */}
      <div className="relative -mt-6 rounded-t-[28px] bg-white px-5 pb-8 pt-3 md:mt-0 md:rounded-none md:px-0 md:pb-16 md:pt-2">
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-black/15 md:hidden" aria-hidden />

        <p className={`text-[12px] font-bold uppercase tracking-[0.14em] ${SUBTLE}`}>
          <span className="text-[#0F0F1A]">Free to download</span> · iPhone and Android
        </p>
        <h1 className="mt-4 text-[#0E0E19]">
          <Wordmark className="h-8 w-auto md:h-9" />
        </h1>
        <p className={`mt-3 text-[18px] leading-[1.45] ${BODY}`}>
          Get paid into your own USD, EUR and GBP accounts. Send to Mexico, Brazil and Colombia in seconds.
          Save, invest, and let Hi book the trip from your balance.
        </p>

        {/* The Main card, the way the app draws it */}
        <div className="relative mt-7 rounded-[26px] shadow-[0_18px_40px_rgba(15,15,26,0.18)]">
          <div className="absolute inset-0 overflow-hidden rounded-[26px]">
            <Image src="/home/towel.jpg" alt="" fill sizes="480px" quality={85} className="object-cover" style={{ objectPosition: "55% 35%" }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/50" />
          </div>
          <div className="relative p-4 text-white">
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-3.5 py-1.5 text-[14px] font-extrabold ${PHOTO_GLASS}`}>Main</span>
              <button
                type="button"
                onClick={() => setPicker((o) => !o)}
                aria-expanded={picker}
                className={`flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[14px] font-extrabold ${PHOTO_GLASS}`}
              >
                <span className="flex -space-x-2 text-[20px] leading-none" aria-hidden>
                  {view === "All" ? (
                    <>
                      <Flag f="🇺🇸" />
                      <Flag f="🇪🇺" />
                    </>
                  ) : (
                    <Flag f={VIEWS[view].flag ?? ""} />
                  )}
                </span>
                {view === "All" ? "All" : view}
                <Icon name="chevron" size={14} className={`transition-transform ${picker ? "rotate-180" : ""}`} />
              </button>
            </div>

            {picker && (
              <div className={`absolute right-3 top-14 z-10 w-[min(300px,calc(100%-24px))] overflow-hidden rounded-[22px] p-1.5 ${PHOTO_GLASS} supports-[backdrop-filter]:bg-white/20`}>
                {(Object.keys(VIEWS) as View[]).map((k) => {
                  const v = VIEWS[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setView(k);
                        setPicker(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-[16px] px-2.5 py-2.5 text-left transition-colors ${view === k ? "bg-white/20" : "hover:bg-white/10"}`}
                    >
                      {v.flag ? (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[22px]">{v.flag}</span>
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[12px] font-black text-[#0F0F1A]">All</span>
                      )}
                      <span className="flex-1">
                        <span className="block text-[15px] font-extrabold">{v.label}</span>
                        {v.sub && <span className="block text-[12px] font-semibold text-white/75">{v.sub}</span>}
                      </span>
                      <span className="text-[15px] font-extrabold">{v.amount}</span>
                      {view === k && <Icon name="check" size={16} />}
                    </button>
                  );
                })}
              </div>
            )}

            <p className="mt-8 text-[44px] font-black leading-none tracking-[-0.02em] [text-shadow:0_2px_16px_rgba(0,0,0,0.25)]">
              {VIEWS[view].amount}
            </p>
            <p className="mt-2 text-[14px] font-bold text-white/90">Open your account ›</p>
            <div className="mt-6 grid grid-cols-4 gap-2">
              {ACTIONS.map((a) => (
                <button key={a.id} type="button" onClick={() => setAction(a.id)} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-[16px] transition-colors ${
                      action === a.id ? "bg-white text-[#0F0F1A]" : PHOTO_GLASS
                    }`}
                  >
                    <Icon name={a.icon} size={20} />
                  </span>
                  <span className="text-[12px] font-extrabold">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* What the picked button does, the way the app's sheet answers it */}
        <div className={`mt-3 rounded-[22px] p-4 ${SOFT}`}>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-[#5F6975]">{panel.title}</p>
          <ul className="mt-2 divide-y divide-black/[0.06]">
            {panel.rows.map((r) => (
              <li key={r.title} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[20px]">
                  {r.flag ?? (r.icon ? <Icon name={r.icon} size={17} className="text-[#0F0F1A]" /> : null)}
                </span>
                <span>
                  <span className="block text-[15px] font-bold text-[#0F0F1A]">{r.title}</span>
                  <span className={`block text-[13px] ${SUBTLE}`}>{r.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          <AmberCta wide />
        </div>

        <div className="mt-8 divide-y divide-black/10 border-t border-black/10">
          <Fold title="What you can do" icon="spark" open>
            <List items={CAN_DO} />
          </Fold>
          <Fold title="Hi, your money assistant" icon="spark">
            <p className={`pb-5 pl-9 text-[15px] leading-[1.5] ${BODY}`}>
              Payments, hotels, events and friends in one chat. Ask in your own words, and Hi pays from your balance
              once you confirm.
            </p>
          </Fold>
          <Fold title="The HOLD card" icon="card">
            <p className={`pb-5 pl-9 text-[15px] leading-[1.5] ${BODY}`}>
              A Visa card to spend your money anywhere is on its way. Join the waitlist in the app to be first.
            </p>
          </Fold>
          <Fold title="Keeping it safe" icon="face">
            <List items={SAFE} />
          </Fold>
        </div>

        <a
          href="#faq"
          className="mt-6 flex items-center gap-3 rounded-[18px] border border-black/10 px-4 py-3.5 transition-colors hover:bg-[#F4F5F7]"
        >
          <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${SOFT}`}>
            <Icon name="spark" size={18} className="text-[#0F0F1A]" />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ background: APP.cyan }} />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-[#0F0F1A]">Questions before you start?</span>
            <span className={`block text-[13px] ${SUBTLE}`}>The answers are a scroll away</span>
          </span>
          <Icon name="arrow" size={18} className="text-black/40" />
        </a>
      </div>
    </section>
  );
}

function Flag({ f }: { f: string }) {
  return <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/80 bg-white text-[18px]">{f}</span>;
}

function Fold({ title, icon, open, children }: { title: string; icon: IconName; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4 text-[17px] font-bold text-[#0F0F1A] [&::-webkit-details-marker]:hidden">
        <Icon name={icon} size={20} />
        <span className="flex-1">{title}</span>
        <Icon name="chevron" size={18} className="text-black/50 transition-transform duration-180 group-open:rotate-180" />
      </summary>
      {children}
    </details>
  );
}

function List({ items }: { items: { icon: IconName; text: string }[] }) {
  return (
    <ul className="space-y-3 pb-5 pl-9">
      {items.map((it) => (
        <li key={it.text} className={`flex items-start gap-3 text-[15px] leading-[1.4] ${BODY}`}>
          <Icon name={it.icon} size={17} className="mt-0.5 shrink-0 text-[#5F6975]" />
          {it.text}
        </li>
      ))}
    </ul>
  );
}
