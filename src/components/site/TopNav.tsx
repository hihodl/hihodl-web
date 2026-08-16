"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DownloadLink } from "@/components/site/DownloadLink";
import { Wordmark } from "@/components/site/Wordmark";

/**
 * The nav mirrors the app's own tab bar: Payments · Savings · Invest · Benefits.
 *
 * That is not a stylistic choice. Someone who reads the site and then installs
 * should find the same four words in the same order at the bottom of the app —
 * a nav that invents its own taxonomy makes the product feel smaller than it is
 * and makes the first session feel like a different product.
 *
 * The two entries with a second floor get a popup; Savings and Invest are one
 * page each and a menu holding a single link is a menu that wastes a click.
 * Everything one question further down — Founder Pass, security, FAQ — stays in
 * the footer. Five is the ceiling for a nav anybody actually reads.
 */
type NavItem = {
  label: string;
  href: string;
  /** Second level. Present only where there is genuinely more than one page. */
  menu?: { href: string; label: string; blurb: string }[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Payments",
    href: "/#payments",
    menu: [
      { href: "/#payments", label: "Send & receive", blurb: "A username, not an address" },
      { href: "/#income", label: "Income rails", blurb: "Your own USD account details" },
    ],
  },
  { label: "Savings", href: "/savings" },
  { label: "Invest", href: "/invest" },
  {
    label: "Benefits",
    href: "/#benefits",
    menu: [
      { href: "/hipoints", label: "HiPoints", blurb: "Earned on what you already spend" },
      { href: "/travel", label: "Stays", blurb: "Book hotels, pay from your balance" },
      { href: "/esim", label: "eSIM", blurb: "Data for the country you land in" },
    ],
  },
];

export function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  /** Label of the desktop popup currently open, or null. */
  const [menu, setMenu] = useState<string | null>(null);
  /** Label of the mobile accordion currently expanded, or null. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes whichever layer is open, and a click outside the nav closes
  // the popup. Without the outside-click the menu survives a click on the page
  // behind it, which reads as a stuck overlay rather than a menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(null);
      setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (navRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  /**
   * Hover opens immediately and closes on a delay. The delay is what makes the
   * diagonal from the trigger to the far corner of the panel survivable — close
   * on pointerleave and the menu vanishes under the cursor on the way down.
   */
  const hoverOpen = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenu(label);
  };
  const hoverClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenu(null), 140);
  };

  const closeAll = () => {
    setMenu(null);
    setOpen(false);
    setExpanded(null);
  };

  return (
    <>
      <header
        ref={navRef}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-320 ease-out-soft ${
          scrolled || menu
            ? "bg-abyss/35 backdrop-blur-2xl backdrop-saturate-150 border-b border-[color:var(--color-hairline)]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="container-page flex items-center h-18 gap-6">
          {/* Logo — vector wordmark, white via currentColor */}
          <Link href="/" className="flex items-center shrink-0 text-text" aria-label="HOLD home">
            <Wordmark className="h-6 md:h-7 w-auto" />
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Primary">
            {NAV_ITEMS.map((item) =>
              item.menu ? (
                <div
                  key={item.label}
                  className="relative"
                  onPointerEnter={() => hoverOpen(item.label)}
                  onPointerLeave={hoverClose}
                >
                  <button
                    type="button"
                    onClick={() => setMenu((m) => (m === item.label ? null : item.label))}
                    aria-expanded={menu === item.label}
                    aria-haspopup="true"
                    className={`flex items-center gap-1.5 px-3 py-2 text-small rounded-tight transition-colors duration-180 ${
                      menu === item.label ? "text-text" : "text-text-muted hover:text-text"
                    }`}
                  >
                    {item.label}
                    <Chevron open={menu === item.label} />
                  </button>

                  <div
                    className={`absolute left-0 top-full pt-3 transition-all duration-180 ease-out-soft ${
                      menu === item.label
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-y-1 pointer-events-none"
                    }`}
                  >
                    <div className="w-[19rem] rounded-card border border-[color:var(--color-hairline-strong)] bg-abyss/95 backdrop-blur-glass shadow-lg p-2">
                      {item.menu.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={closeAll}
                          className="block px-3.5 py-3 rounded-tight hover:bg-white/[0.06] transition-colors duration-180"
                        >
                          <span className="block text-small text-text">{sub.label}</span>
                          <span className="mt-0.5 block text-tiny text-text-muted">{sub.blurb}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => setMenu(null)}
                  className="px-3 py-2 text-small text-text-muted hover:text-text rounded-tight transition-colors duration-180"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Download CTA */}
          <DownloadLink className="hidden sm:inline-flex items-center px-5 py-2.5 rounded-pill bg-amber text-text-on-amber font-medium text-small hover:bg-amber-glow transition-all duration-180 ease-out-soft hover:scale-[1.02]">
            Download
          </DownloadLink>

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

      {/* Mobile sheet — the same two levels, as an accordion. A hover popup has
          no meaning on a touch screen, and a second full-screen panel loses the
          reader's place. */}
      <div
        className={`fixed inset-x-0 top-18 z-40 md:hidden transition-all duration-320 ease-out-soft ${
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="bg-abyss/95 backdrop-blur-glass border-b border-[color:var(--color-hairline)] max-h-[calc(100vh-4.5rem)] overflow-y-auto">
          <nav className="container-page py-6 flex flex-col gap-1">
            {NAV_ITEMS.map((item) =>
              item.menu ? (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => (e === item.label ? null : item.label))}
                    aria-expanded={expanded === item.label}
                    className="w-full flex items-center justify-between py-3 text-h4 font-light text-text"
                  >
                    {item.label}
                    <Chevron open={expanded === item.label} />
                  </button>
                  {expanded === item.label && (
                    <div className="pb-2 pl-4 flex flex-col border-l border-[color:var(--color-hairline)]">
                      {item.menu.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={closeAll}
                          className="py-2.5 text-body text-text-muted"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeAll}
                  className="py-3 text-h4 font-light text-text"
                >
                  {item.label}
                </Link>
              ),
            )}
            <DownloadLink
              onClick={closeAll}
              className="mt-4 inline-flex items-center justify-center px-5 py-3 rounded-pill bg-amber text-text-on-amber font-medium"
            >
              Download
            </DownloadLink>
          </nav>
        </div>
      </div>

      {/* Spacer to prevent content from sliding under fixed header */}
      <div className="h-18" aria-hidden />
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden
      className={`transition-transform duration-180 ease-out-soft ${open ? "rotate-180" : ""}`}
    >
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
