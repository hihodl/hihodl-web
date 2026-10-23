"use client";

import { Wordmark } from "@/components/site/Wordmark";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics/mixpanel";
import { Icon, type IconName } from "./Icon";

/**
 * One question, asked once, the way Persona asks it: what should Hi take off
 * your plate first? The answer takes the visitor to the part of the page
 * that shows it and goes to Mixpanel, so the page learns which promise
 * people came for. It promises no gift, because there is none behind it.
 *
 * Opens after 8 seconds or 40% of the page, whichever comes first, and not
 * again once seen. Storage can throw (private mode); then it may ask again.
 */
const SEEN_KEY = "hold.hiFirst.seen";

const CHOICES: { id: string; label: string; target: string; icon: IconName }[] = [
  { id: "get_paid", label: "Getting paid from abroad", target: "how", icon: "download" },
  { id: "send_home", label: "Sending money home", target: "how", icon: "at" },
  { id: "save", label: "Saving without thinking", target: "inside", icon: "leaf" },
  { id: "split", label: "Splitting with friends", target: "people", icon: "split" },
  { id: "trip", label: "Booking my next trip", target: "changes", icon: "plane" },
  ];

function seen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode: it may ask again next visit */
  }
}

export function HiFirst() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (seen() || new URLSearchParams(window.location.search).has("nopopup")) return;
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      markSeen();
      setOpen(true);
      track("home_hi_first_shown");
    };
    const timer = window.setTimeout(show, 8000);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= 0.4) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const pick = (c: (typeof CHOICES)[number]) => {
    track("home_hi_first_picked", { choice: c.id });
    setOpen(false);
    window.requestAnimationFrame(() => document.getElementById(c.target)?.scrollIntoView({ behavior: "smooth" }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3 backdrop-blur-[6px] md:p-8" onClick={close}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hi-first-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[30px] bg-white p-3 shadow-2xl outline-none md:grid md:max-w-[900px] md:grid-cols-2 md:gap-4"
      >
        <div className="relative aspect-[1.9/1] overflow-hidden rounded-[22px] md:aspect-auto md:min-h-[520px]">
          <Image
            src="/home/figs.jpg"
            alt="A woman by the sea holding a bowl of figs and berries"
            fill
            quality={90}
            sizes="(min-width: 768px) 440px, 100vw"
            className="object-cover"
            style={{ objectPosition: "50% 60%" }}
          />
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0F0F1A] shadow md:right-5 md:top-5 md:bg-[#F4F5F7] md:shadow-none"
        >
          <Icon name="close" size={16} />
        </button>
        <div className="px-4 pb-5 pt-7 text-center md:flex md:flex-col md:justify-center md:px-6">
          <Wordmark className="mx-auto h-5 w-auto text-[#0E0E19]" />
          <h2 id="hi-first-title" className="mt-2 text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#0F0F1A]">
            What should Hi do first?
          </h2>
          <p className="mt-2 text-[15px] text-[#5F6975]">Pick one and we&rsquo;ll show you how.</p>
          <ul className="mt-6 space-y-2 text-left">
            {CHOICES.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pick(c)}
                  className="flex w-full items-center gap-3 rounded-full bg-[#F4F5F7] p-1.5 pr-5 text-[16px] font-semibold text-[#0F0F1A] transition-colors duration-180 hover:bg-[#ECEEF1]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                    <Icon name={c.icon} size={18} className="text-[#0F0F1A]" />
                  </span>
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
