"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics/mixpanel";

/**
 * One question, asked once: what should Hi take off your plate first? The
 * answer takes the visitor to the chapter that shows it, and is sent to
 * Mixpanel, so the page learns which promise people came for.
 *
 * It is not a "gift". There is no gift behind it yet, and a popup that
 * promises one we do not give is the fastest way to lose the visitor.
 *
 * It opens after 8 seconds or 40% of the page, whichever is first, and never
 * again once seen. Storage can throw (private mode, blocked site data), in
 * which case it simply may show again: never a broken page.
 */
const SEEN_KEY = "hold.hiFirst.seen";

type Choice = { id: string; label: string; target: string; icon: ReactNode };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const CHOICES: Choice[] = [
  {
    id: "get_paid",
    label: "Getting paid from abroad",
    target: "money",
    icon: <path {...stroke} d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
  },
  {
    id: "save",
    label: "Saving without thinking",
    target: "savings",
    icon: <path {...stroke} d="M7 21h10M12 21v-9m0 0C12 7 9 4 4 4c0 5 3 8 8 8Zm0 0c0-4 2.5-6.5 8-6.5 0 4.5-3 6.5-8 6.5Z" />,
  },
  {
    id: "split",
    label: "Splitting bills with friends",
    target: "pay",
    icon: <path {...stroke} d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Zm4 5h6m-6 4h6" />,
  },
  {
    id: "trip",
    label: "Booking my next trip",
    target: "hi",
    icon: (
      <path
        {...stroke}
        d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z"
      />
    ),
  },
  {
    id: "group",
    label: "Planning with my friends",
    target: "together",
    icon: (
      <path
        {...stroke}
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
      />
    ),
  },
];

function alreadySeen(): boolean {
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
    /* private mode: it may ask again next visit, which is fine */
  }
}

export function HiFirst() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (alreadySeen() || new URLSearchParams(window.location.search).has("nopopup")) return;
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
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const pick = (choice: Choice) => {
    track("home_hi_first_picked", { choice: choice.id });
    setOpen(false);
    // After the scroll lock is released, or the jump is swallowed.
    window.requestAnimationFrame(() =>
      document.getElementById(choice.target)?.scrollIntoView({ behavior: "smooth" }),
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[6px] md:p-8"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hi-first-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] bg-white p-3 text-[#0A0F16] shadow-2xl outline-none md:grid md:max-w-[920px] md:grid-cols-2 md:gap-6 md:p-4"
      >
        <div className="relative aspect-[1.9/1] overflow-hidden rounded-[20px] md:aspect-auto md:min-h-[520px]">
          <Image
            src="/home/figs.jpg"
            alt="A woman by the sea holding a bowl of figs and berries"
            fill
            sizes="(min-width: 768px) 440px, 100vw"
            className="object-cover"
            style={{ objectPosition: "50% 62%" }}
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#0A0F16] transition-colors hover:bg-white md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
              <path {...stroke} strokeWidth={2} d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="relative px-4 pb-5 pt-7 text-center md:flex md:flex-col md:justify-center md:px-6 md:py-10">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-0 top-0 hidden h-10 w-10 items-center justify-center rounded-full text-[#0A0F16] transition-colors hover:bg-black/5 md:flex"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
              <path {...stroke} strokeWidth={2} d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <p className="text-tiny uppercase tracking-wider text-[#5B6B7A]">HOLD</p>
          <h2 id="hi-first-title" className="mt-3 font-display text-[30px] font-medium leading-[1.1] tracking-[-0.02em]">
            What should Hi do first?
          </h2>
          <p className="mt-2 text-small text-[#4A5866]">Pick one and we&rsquo;ll show you how.</p>
          <ul className="mt-6 space-y-2 text-left">
            {CHOICES.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pick(c)}
                  className="flex w-full items-center gap-3 rounded-pill bg-[#F2F4F7] p-1.5 pr-5 text-body text-[#0A0F16] transition-colors duration-180 hover:bg-[#E6EAF0]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                      {c.icon}
                    </svg>
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
