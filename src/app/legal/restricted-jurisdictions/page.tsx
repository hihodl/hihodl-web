"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// Reg S hard prohibitions (mirrors Backed / xStocks public disclosures).
const REGS_PROHIBITED = [
  "United States (and U.S. Persons)",
  "Canada",
  "United Kingdom",
  "Australia",
];

// Sanctioned / OFAC regions excluded from all regulated features.
const SANCTIONED = [
  "Afghanistan",
  "Belarus",
  "Cuba",
  "Iran",
  "Iraq",
  "Lebanon",
  "Libya",
  "Myanmar",
  "Nicaragua",
  "North Korea",
  "Russia",
  "Somalia",
  "South Sudan",
  "Sudan",
  "Syria",
  "Venezuela",
  "Yemen",
  "Zimbabwe",
];

function CountryList({ items }: { items: string[] }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 ml-4 list-disc list-inside text-[#94a3b8ff]">
      {items.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ul>
  );
}

export default function RestrictedJurisdictionsPage() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#060B10] to-[#0B1520]">
        {/* ==== TOP BAR ==== */}
        <div className="flex w-full flex-col items-center justify-center bg-[#0a141e66] px-6 py-6 sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 mobile:px-2 mobile:py-2 mb-6 md:mb-8">
          <div className="flex w-full max-w-[1280px] items-center justify-between rounded-2xl bg-[#0a141e26] px-8 py-4 shadow-lg backdrop-blur-2xl border-b border-[rgba(255,255,255,0.12)] border-t-2 border-t-brand-600 mobile:hidden">
            <a href="/" className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em] hover:text-brand-ffb703 transition">
              HIHODL
            </a>
            <Button
              className="hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] hover:shadow-[0_0_28px_rgba(255,183,3,0.5)]:hover inline-flex items-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-ffb703 transition-all duration-300"
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
              Tokenized Stocks — Restricted Jurisdictions
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last updated: July 14, 2026
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <p className="text-[#94a3b8ff]">
                Tokenized stocks are offered only to eligible users in supported regions. This page lists the jurisdictions where HIHODL does <span className="text-[#eaf6ffff] font-[600]">not</span> offer, market, or make tokenized stocks available. These controls apply only to the tokenized-stocks feature. Your self-custodial wallet and its other functions are not restricted by country. See the{" "}
                <a href="/legal/tokenized-stocks" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Product Disclosure</a> for how the feature works.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">1. Regulation S — prohibited jurisdictions</h2>
              <p className="text-[#94a3b8ff]">
                The underlying tokens are offered outside the United States to non-U.S. Persons in reliance on Regulation S and have not been registered under the U.S. Securities Act of 1933. They are not offered, sold, marketed, or made available to residents or persons located in, or to nationals or citizens of, the following:
              </p>
              <CountryList items={REGS_PROHIBITED} />
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">2. Sanctioned and high-risk jurisdictions</h2>
              <p className="text-[#94a3b8ff]">
                In addition, tokenized stocks (like all of HIHODL&apos;s regulated features) are not available to persons resident in, or otherwise connected to, jurisdictions subject to comprehensive sanctions or heightened financial-crime controls, including:
              </p>
              <CountryList items={SANCTIONED} />
              <p className="text-[#94a3b8ff]">
                This list may be updated to reflect changes in applicable sanctions and regulatory requirements.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">3. How we apply these restrictions</h2>
              <p className="text-[#94a3b8ff]">
                We apply the restrictions using two independent checks: a location check based on the network location from which you access the service, and a verified-residence check based on the identity verification (KYC) you complete in the app. A user must clear both checks and be resident in a supported region to access tokenized stocks. Additional regions are only marketed and made available progressively, as our regulatory position in each market is confirmed.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">4. No circumvention</h2>
              <p className="text-[#94a3b8ff]">
                You must not use a VPN, proxy, false residence, or any other means to access tokenized stocks from a restricted jurisdiction or to misrepresent your location or residence. Doing so breaches our Terms of Service.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">5. Contact</h2>
              <div className="bg-white/5 rounded-xl p-6 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
                <p className="text-[#eaf6ffff] font-[600] mb-2">HIHODL TECHNOLOGIES OÜ</p>
                <p className="text-[#94a3b8ff]">Registered in Estonia</p>
                <p className="text-[#94a3b8ff]">Email: legal@hihodl.xyz</p>
                <p className="text-[#94a3b8ff]">Website: https://hihodl.xyz</p>
              </div>
            </section>
          </div>
        </motion.section>

        {/* ==== FOOTER ==== */}
        <div className="flex w-full flex-col items-center px-4 sm:px-6 md:px-8 py-12 border-t-2 border-[rgba(255,255,255,0.08)] mt-8">
          <div className="flex w-full max-w-[1280px] flex-col items-center gap-6">
            <div className="flex flex-wrap justify-center gap-6">
              <a href="/privacy" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">Privacy</a>
              <a href="/terms" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">Terms</a>
              <a href="/legal/tokenized-stocks" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">Stocks Disclosure</a>
              <a href="/legal/stocks-risk" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">Risk Disclosure</a>
            </div>
            <span className="font-['Inter'] text-[13px] font-[400] leading-[19px] text-[#94a3b8ff]">
              © 2025 HiHODL. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}
