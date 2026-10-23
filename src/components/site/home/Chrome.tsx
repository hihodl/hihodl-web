"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/site/Wordmark";
import { DownloadLink } from "@/components/site/DownloadLink";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";

/**
 * The page's own top bar and footer. Persona keeps both nearly empty: the
 * name, one action, and nothing that sends the visitor away before the
 * product has been seen.
 */
export function HomeNav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.45);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-320 ${
        solid ? "border-b border-black/[0.06] bg-white/90 text-[#0E0E19] backdrop-blur-xl" : "bg-transparent text-white md:bg-white md:text-[#0E0E19]"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 md:px-8">
        <Link href="/" aria-label="HOLD home">
          <Wordmark className="h-6 w-auto" />
        </Link>
        <DownloadLink className="inline-flex h-10 items-center rounded-full bg-[#FFB703] px-5 text-[15px] font-extrabold text-[#0F0F1A] transition-transform duration-180 hover:scale-[1.03]">
          Get HOLD
        </DownloadLink>
      </div>
    </header>
  );
}

const SOCIALS = [
  { href: "https://x.com/hiihold", label: "X" },
  { href: "https://instagram.com/hiihold", label: "Instagram" },
  { href: "https://www.tiktok.com/@hiihold", label: "TikTok" },
  { href: "https://t.me/hiihold", label: "Telegram" },
  { href: "https://www.linkedin.com/company/hiihold", label: "LinkedIn" },
];

export function HomeFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-white px-4 pb-12 pt-14 md:px-8">
      <div className="mx-auto max-w-[1240px] md:flex md:items-start md:justify-between">
        <div className="max-w-[360px]">
          <Wordmark className="h-7 w-auto text-[#0E0E19]" />
          <p className="mt-4 text-[16px] leading-[1.5] text-[#3F4A55]">
            Get paid in six currencies, send in seconds, and let Hi do the rest.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={APP_STORE_URL} className="rounded-full bg-[#0F0F1A] px-4 py-2 text-[14px] font-bold text-white">
              App Store
            </a>
            <a href={PLAY_STORE_URL} className="rounded-full bg-[#0F0F1A] px-4 py-2 text-[14px] font-bold text-white">
              Google Play
            </a>
          </div>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-10 md:mt-0">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#5F6975]">Follow</p>
            <ul className="mt-4 space-y-2.5">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-[15px] text-[#0F0F1A] hover:text-[#00A6DB]">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#5F6975]">Legal</p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/privacy" className="text-[15px] text-[#0F0F1A] hover:text-[#00A6DB]">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[15px] text-[#0F0F1A] hover:text-[#00A6DB]">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-[1240px] text-[13px] text-[#5F6975]">© 2026 HOLD. All rights reserved.</p>
    </footer>
  );
}
