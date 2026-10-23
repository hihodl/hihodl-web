"use client";

import { useState, type ReactNode } from "react";
import { AmberCta, APP, BODY, H2, SOFT, SUBTLE } from "./ui";
import { Icon, type IconName } from "./Icon";
import { ActionPanel, MainCard } from "./MainCard";

/**
 * Tap around the account: the Main card on the left, where each of Add,
 * Pay, Move and Accounts shows what it does, and on the right what HOLD
 * does, in folds. Fintech first: money before Hi, custody last.
 *
 * Every line is something the app says about itself on release/ios-build-13
 * (src/i18n/resources/en) or a row of the live fiat_rail_catalog.
 */

const CAN_DO: { icon: IconName; text: string }[] = [
  { icon: "bank", text: "Get paid into your own USD, EUR and GBP accounts" },
  { icon: "addCircle", text: "Put reais in by Pix" },
  { icon: "download", text: "Send by Pix, SPEI and Bre-B in seconds" },
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

export function Tour() {
  const [action, setAction] = useState("pay");

  return (
    <section id="tour" className="scroll-mt-16 border-t border-black/[0.08] bg-[#F4F5F7] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[1120px]">
        <H2>
          Tap around your <em>account</em>
        </H2>
        <div className="mt-12 md:mt-16 md:grid md:grid-cols-[420px_1fr] md:items-start md:gap-16">
          <div className="md:sticky md:top-24">
            <MainCard photo={{ src: "/home/walk.jpg", pos: "45% 40%" }} action={action} onAction={setAction} />
            <div className="mt-3 rounded-[22px] bg-white">
              <ActionPanel action={action} />
            </div>
          </div>

          <div className="mt-10 md:mt-0">
            <p className={`text-[19px] leading-[1.5] ${BODY}`}>
              Get paid into your own USD, EUR and GBP accounts, and put reais in by Pix. Send by Pix, SPEI and Bre-B in seconds. Save, invest,
              and let Hi book the trip from your balance.
            </p>
            <div className="mt-6">
              <AmberCta wide />
            </div>
            <div className="mt-8 divide-y divide-black/10 border-t border-black/10">
              <Fold title="What you can do" icon="spark" open>
                <List items={CAN_DO} />
              </Fold>
              <Fold title="Hi, your money assistant" icon="spark">
                <p className={`pb-5 pl-9 text-[15px] leading-[1.5] ${BODY}`}>
                  Payments, hotels, events and friends in one chat. Ask in your own words, and Hi pays from your balance once
                  you confirm.
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
              className="mt-6 flex items-center gap-3 rounded-[18px] border border-black/10 bg-white px-4 py-3.5 transition-colors hover:bg-white/70"
            >
              <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${SOFT}`}>
                <Icon name="spark" size={18} className="text-[#0F0F1A]" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ background: APP.cyan }} />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-medium text-[#0F0F1A]">Questions before you start?</span>
                <span className={`block text-[13px] ${SUBTLE}`}>The answers are a scroll away</span>
              </span>
              <Icon name="arrow" size={18} className="text-black/40" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Fold({ title, icon, open, children }: { title: string; icon: IconName; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4 text-[17px] font-medium text-[#0F0F1A] [&::-webkit-details-marker]:hidden">
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
