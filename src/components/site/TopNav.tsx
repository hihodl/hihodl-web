"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/#income", label: "Income" },
  { href: "/#swap",   label: "Swap" },
  { href: "/#ai",     label: "AI" },
  { href: "/#husd",   label: "HUSD" },
];

export function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-320 ease-out-soft ${
          scrolled
            ? "bg-abyss/35 backdrop-blur-2xl backdrop-saturate-150 border-b border-[color:var(--color-hairline)]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="container-page flex items-center h-18 gap-6">
          {/* Logo — amber wordmark forced to white via CSS for crisp brand contrast */}
          <Link href="/" className="flex items-center shrink-0" aria-label="HIHODL home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-amber.png"
              alt="HIHODL"
              className="h-6 md:h-7 w-auto"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-small text-text-muted hover:text-text rounded-tight transition-colors duration-180"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Download CTA */}
          <Link
            href="#download"
            className="hidden sm:inline-flex items-center px-5 py-2.5 rounded-pill bg-amber text-text-on-amber font-medium text-small hover:bg-amber-glow transition-all duration-180 ease-out-soft hover:scale-[1.02]"
          >
            Download
          </Link>

          {/* Mobile burger */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 -mr-2 text-text"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
              {open ? (
                <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <>
                  <path d="M3 7h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M3 15h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile sheet */}
      <div
        className={`fixed inset-x-0 top-18 z-40 md:hidden transition-all duration-320 ease-out-soft ${
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="bg-abyss/95 backdrop-blur-glass border-b border-[color:var(--color-hairline)]">
          <nav className="container-page py-6 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-3 text-h4 font-light text-text"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="#download"
              onClick={() => setOpen(false)}
              className="mt-4 inline-flex items-center justify-center px-5 py-3 rounded-pill bg-amber text-text-on-amber font-medium"
            >
              Download
            </Link>
          </nav>
        </div>
      </div>

      {/* Spacer to prevent content from sliding under fixed header */}
      <div className="h-18" aria-hidden />
    </>
  );
}
