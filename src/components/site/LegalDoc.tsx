"use client";

/**
 * One product's terms, drawn the way /legal/esim is: the title and review date,
 * the box that says who is on the other side of the purchase, then numbered
 * sections. The product terms (flights, stays, HiPoints) share it
 * so they read as one set, and the footer links every one of them.
 *
 * Each page is linked from its own checkout in the app ("By paying you accept
 * the Flight Terms"), so it is read mid-purchase: the box answers "who am I
 * buying from" before any clause.
 */

import React from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";
import { Wordmark } from "@/components/site/Wordmark";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export type LegalSection = { title: string; body: React.ReactNode };

/** Every product's terms, in the footer of each. */
export const LEGAL_LINKS: Array<{ href: string; label: string }> = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/legal/flights", label: "Flights" },
  { href: "/legal/stays", label: "Stays" },
  { href: "/legal/esim", label: "eSIM" },
  { href: "/legal/hipoints", label: "HiPoints" },
  { href: "/legal/traveler", label: "Traveler" },
  { href: "/legal/providers", label: "Providers" },
];

/** A paragraph in the muted body colour. */
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[#94a3b8ff]">{children}</p>;
}

/** A bulleted list in the muted body colour. */
export function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 flex flex-col gap-2 text-[#94a3b8ff]">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** An inline link in the brand colour. */
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-brand-ffb703 hover:underline">
      {children}
    </a>
  );
}

export default function LegalDoc({
  title,
  reviewed,
  callout,
  sections,
}: {
  title: string;
  /** "October 15, 2026": when the text last changed. */
  reviewed: string;
  /** Who the buyer is dealing with, before any clause. */
  callout: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#060B10] to-[#0B1520]">
        {/* ==== TOP BAR ==== */}
        <div className="flex w-full flex-col items-center justify-center bg-[#0a141e66] px-6 py-6 sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 mobile:px-2 mobile:py-2 mb-6 md:mb-8">
          <div className="flex w-full max-w-[1280px] items-center justify-between rounded-2xl bg-[#0a141e26] px-8 py-4 shadow-lg backdrop-blur-2xl border-b border-[rgba(255,255,255,0.12)] border-t-2 border-t-brand-600 mobile:hidden">
            <a href="/" aria-label="HOLD home" className="text-[#eaf6ffff] hover:text-brand-ffb703 transition">
              <Wordmark className="h-5 w-auto" />
            </a>
            <Button
              className="hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] inline-flex items-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-ffb703 transition-all duration-300"
              onClick={() => (window.location.href = "/#waitlist")}
            >
              Join Beta
            </Button>
          </div>
        </div>

        {/* ==== CONTENT ==== */}
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex w-full max-w-[900px] flex-col gap-8 px-4 sm:px-6 md:px-8 py-16 md:py-24"
        >
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-['Inter'] font-[700] -tracking-[0.05em] leading-tight text-[#eaf6ffff]">
              {title}
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">Last reviewed: {reviewed}</p>
          </div>

          <div className="rounded-2xl border border-[rgba(255,183,3,0.35)] bg-[rgba(255,183,3,0.06)] p-6">
            <div className="text-[#eaf6ffff] font-['Inter'] font-[600] leading-relaxed flex flex-col gap-3">{callout}</div>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            {sections.map((s, i) => (
              <section key={s.title} className="flex flex-col gap-4">
                <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                  {i + 1}. {s.title}
                </h2>
                {s.body}
              </section>
            ))}
          </div>
        </motion.section>

        {/* ==== FOOTER ==== */}
        <div className="flex w-full flex-col items-center px-4 sm:px-6 md:px-8 py-12 border-t-2 border-[rgba(255,255,255,0.08)] mt-8">
          <div className="flex w-full max-w-[1280px] flex-col items-center gap-6">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
              {LEGAL_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                  {l.label}
                </a>
              ))}
            </div>
            <span className="font-['Inter'] text-[13px] font-[400] leading-[19px] text-[#94a3b8ff]">
              © 2026 HIHODL TECHNOLOGIES OÜ. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}
