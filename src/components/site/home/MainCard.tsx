"use client";

import Image from "next/image";
import { useState } from "react";
import { PHOTO_GLASS, SOFT, SUBTLE } from "./ui";
import { Icon, type IconName } from "./Icon";

/**
 * The Main card, the way the app draws it (dashboard, release/ios-build-13):
 * a photo, the balance, a flags pill that opens the balance per currency,
 * and Add, Pay, Move and Accounts. The dropdown lists the balances the app
 * holds (USD, EUR); GBP is an account you receive into, so it lives under
 * Accounts. Figures are an example balance, not a customer.
 */
export const VIEWS = {
  All: { label: "All", sub: null, amount: "$4,338.10", flag: null },
  USD: { label: "US dollar", sub: "USD", amount: "$2,340.10", flag: "🇺🇸" },
  EUR: { label: "Euro", sub: "≈ $1,998.00", amount: "€1,850.00", flag: "🇪🇺" },
} as const;
export type View = keyof typeof VIEWS;

type Row = { flag?: string; icon?: IconName; title: string; sub: string };

/**
 * What each of the four buttons does, from the live fiat_rail_catalog
 * (23-oct-2026): USD, EUR and GBP are accounts in your name; MXN, BRL and
 * COP are instant payouts over SPEI, Pix and Bre-B. Receiving in MXN, BRL or
 * COP is switched off in the catalog, so it is never offered here.
 */
export const ACTIONS: { id: string; label: string; icon: IconName; title: string; rows: Row[] }[] = [
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

function Flag({ f }: { f: string }) {
  return <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/80 bg-white text-[18px]">{f}</span>;
}

/**
 * The card face. Without `photo` it is transparent, for laying over a photo
 * drawn elsewhere (the hero's shrinking photo). With `fill` it stretches to
 * its parent's height, actions pinned to the bottom.
 */
export function MainCard({
  photo,
  action,
  onAction,
  fill = false,
  className = "",
}: {
  photo?: { src: string; pos: string };
  action?: string;
  onAction?: (id: string) => void;
  fill?: boolean;
  className?: string;
}) {
  const [view, setView] = useState<View>("All");
  const [picker, setPicker] = useState(false);

  return (
    <div className={`relative rounded-[28px] ${photo ? "shadow-[0_18px_40px_rgba(15,15,26,0.18)]" : ""} ${fill ? "h-full" : ""} ${className}`}>
      {photo && (
        <div className="absolute inset-0 overflow-hidden rounded-[28px]">
          <Image src={photo.src} alt="" fill sizes="480px" quality={85} className="object-cover" style={{ objectPosition: photo.pos }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/50" />
        </div>
      )}
      <div className={`relative p-4 text-white ${fill ? "flex h-full flex-col justify-between" : ""}`}>
        <div>
          <div className="flex items-center justify-between">
            <span className={`rounded-full px-3.5 py-1.5 text-[14px] font-semibold ${PHOTO_GLASS}`}>Main</span>
            <button
              type="button"
              onClick={() => setPicker((o) => !o)}
              aria-expanded={picker}
              aria-label="Balance by currency"
              className={`flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[14px] font-semibold ${PHOTO_GLASS}`}
            >
              <span className="flex -space-x-2 leading-none" aria-hidden>
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
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-[#0F0F1A]">All</span>
                    )}
                    <span className="flex-1">
                      <span className="block text-[15px] font-semibold">{v.label}</span>
                      {v.sub && <span className="block text-[12px] font-semibold text-white/75">{v.sub}</span>}
                    </span>
                    <span className="text-[15px] font-semibold">{v.amount}</span>
                    {view === k && <Icon name="check" size={16} />}
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-8 text-[44px] font-semibold leading-none tracking-[-0.02em] [text-shadow:0_2px_16px_rgba(0,0,0,0.25)]">
            {VIEWS[view].amount}
          </p>
          <p className="mt-2 text-[14px] font-medium text-white/90">Open your account ›</p>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2">
          {ACTIONS.map((a) => (
            <button key={a.id} type="button" onClick={() => onAction?.(a.id)} className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-[16px] transition-colors ${
                  action === a.id ? "bg-white text-[#0F0F1A]" : PHOTO_GLASS
                }`}
              >
                <Icon name={a.icon} size={20} />
              </span>
              <span className="text-[12px] font-semibold">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** What the picked button does, the way the app's sheet answers it. */
export function ActionPanel({ action }: { action: string }) {
  const panel = ACTIONS.find((a) => a.id === action) ?? ACTIONS[3];
  return (
    <div className={`rounded-[22px] p-4 ${SOFT}`}>
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#5F6975]">{panel.title}</p>
      <ul className="mt-2 divide-y divide-black/[0.06]">
        {panel.rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[20px]">
              {r.flag ?? (r.icon ? <Icon name={r.icon} size={17} className="text-[#0F0F1A]" /> : null)}
            </span>
            <span>
              <span className="block text-[15px] font-medium text-[#0F0F1A]">{r.title}</span>
              <span className={`block text-[13px] ${SUBTLE}`}>{r.sub}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
