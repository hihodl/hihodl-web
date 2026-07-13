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

export default function TravelerLegalPage() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#060B10] to-[#0B1520]">
        {/* ==== TOP BAR ==== */}
        <div className="flex w-full flex-col items-center justify-center bg-[#0a141e66] px-6 py-6 sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 mobile:px-2 mobile:py-2 mb-6 md:mb-8">
          <div className="flex w-full max-w-[1280px] items-center justify-between rounded-2xl bg-[#0a141e26] px-8 py-4 shadow-lg backdrop-blur-2xl border-b border-[rgba(255,255,255,0.12)] border-t-2 border-t-brand-600 mobile:hidden">
            <a
              href="/"
              className="font-['Inter'] text-[24px] font-[700] leading-[28px] text-[#eaf6ffff] -tracking-[0.02em] hover:text-brand-ffb703 transition"
            >
              HIHODL
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
              Traveler: how we calculate your days
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last reviewed: July 12, 2026 · Dataset version 2026.07
            </p>
          </div>

          {/* Prominent "not advice" callout */}
          <div className="rounded-2xl border border-[rgba(255,183,3,0.35)] bg-[rgba(255,183,3,0.06)] p-6">
            <p className="text-[#eaf6ffff] font-['Inter'] font-[600] leading-relaxed">
              Traveler is an informational tool that helps you estimate your visa
              allowance and tax-residency days. It is not tax, legal, or
              immigration advice, and HIHODL is not a tax advisor, law firm, or
              immigration adviser. Estimates can be incomplete or out of date.
              Always confirm your situation with official government sources and,
              where it matters, a qualified professional before you rely on it.
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                1. What Traveler is, and what it is not
              </h2>
              <p className="text-[#94a3b8ff]">
                Traveler helps travelers keep a running count of two things: how
                many days of a visa or visa-free allowance they have used in a
                country, and how many days they have spent in a country toward
                its tax-residency threshold. You enter the stays yourself.
                Traveler does the arithmetic and shows an estimate.
              </p>
              <p className="text-[#94a3b8ff]">
                Traveler does not file anything, does not talk to any government,
                does not grant or deny entry, and does not determine your legal
                tax residency. Immigration officers and tax authorities make
                those decisions on their own rules and records, which may differ
                from ours.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                2. Visa rules are relative to your passport
              </h2>
              <p className="text-[#94a3b8ff]">
                The same destination means different rules to different people. A
                Spanish citizen has free movement inside the Schengen Area; a US
                citizen gets a 90-day visa-free allowance; a citizen of many
                other countries needs a visa before travel. So Traveler asks for
                your passport (or two, for dual nationals) and resolves the rule
                for your nationality. For a dual national, Traveler shows the
                more favorable of the two passports.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                3. How we count visa days
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>
                  <span className="text-[#eaf6ffff] font-[600]">
                    Schengen 90/180.
                  </span>{" "}
                  For the Schengen Area we apply the standard rule: at most 90
                  days of stay in any rolling 180-day period, pooled across all
                  Schengen member states. The same 90/180 math applies whether
                  you enter visa-free (Annex II) or on a short-stay Type C visa
                  (Annex I).
                </li>
                <li>
                  <span className="text-[#eaf6ffff] font-[600]">
                    Other rolling windows.
                  </span>{" "}
                  A few countries use their own rolling window (for example 90
                  days in any 180, or 180 days in a year). Where we know of one,
                  we apply it; otherwise a visa-free allowance is treated as a
                  per-entry allowance.
                </li>
                <li>
                  <span className="text-[#eaf6ffff] font-[600]">
                    Counting convention.
                  </span>{" "}
                  We count both the day you arrive and every day you are present
                  as a day in-country, in UTC. This is the conservative
                  convention used by immigration authorities. An open (ongoing)
                  stay counts through today.
                </li>
                <li>
                  <span className="text-[#eaf6ffff] font-[600]">
                    Permits that lift the cap.
                  </span>{" "}
                  If you record a residence or long-stay permit, Traveler stops
                  counting a short-stay cap for you there, because you are no
                  longer a short-stay visitor. Inside Schengen, a residence
                  permit from one member is treated as lifting the short-stay
                  cap area-wide.
                </li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                4. How we count tax-residency days
              </h2>
              <p className="text-[#94a3b8ff]">
                Tax residency is separate from your visa. Many countries treat
                spending 183 days or more in a calendar year as a trigger for tax
                residency, so Traveler counts your days in each country during
                the current tax year against that threshold (some countries use a
                different number, which we apply where we know it). The day count
                is only one of several tests real tax authorities use. Ties to a
                country such as a home, family, or center of economic interest
                can make you a tax resident on far fewer days, and totalization or
                double-tax treaties can change the outcome. Treat the tax figure
                as a prompt to look into it, never as a determination.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                5. Where the data comes from
              </h2>
              <p className="text-[#94a3b8ff]">
                The passport-to-destination requirements are seeded from an open,
                publicly maintained dataset (the passport-index dataset,
                published under the MIT license) covering visa-free, visa-on-
                arrival, electronic authorization, e-visa, and visa-required
                statuses across roughly 200 passports and destinations. On top of
                that we maintain a small curated layer for area rules the raw
                dataset does not express, such as Schengen pooling, specific
                rolling windows, and tax thresholds. The dataset carries a version
                and a last-reviewed date, shown at the top of this page, and is
                refreshed periodically.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                6. Important limitations
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>
                  Rules change. A requirement can change between our reviews, and
                  your result may be based on outdated data.
                </li>
                <li>
                  The dataset covers the general case for an ordinary passport. It
                  does not capture every nuance: bilateral visa-waiver
                  agreements, specific visa sub-types, purpose-of-travel
                  conditions, prior overstays, entry bans, border-officer
                  discretion, minors, diplomatic or service passports, and
                  similar exceptions.
                </li>
                <li>
                  Traveler only knows the stays you enter. If your entries are
                  incomplete or inexact, the counts will be too.
                </li>
                <li>
                  Day-boundary and time-zone handling is done at day granularity
                  in UTC, which can differ by a day from how a specific authority
                  counts.
                </li>
                <li>
                  ETIAS, ESTA, ETA and similar pre-authorizations, and e-visa or
                  visa-on-arrival processes, have their own eligibility, cost, and
                  processing times that Traveler does not manage.
                </li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                7. Always verify with official sources
              </h2>
              <p className="text-[#94a3b8ff]">
                Before you travel or make a decision based on a Traveler estimate,
                verify the current requirement with an official source: the
                destination government&apos;s immigration or foreign-ministry
                website, the relevant consulate or embassy, or, for tax, the
                national tax authority. For anything with real consequences,
                consult a qualified immigration lawyer or tax adviser. If you find
                a figure in Traveler that looks wrong, please tell us so we can
                review it.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                8. No warranty and no liability
              </h2>
              <p className="text-[#94a3b8ff]">
                Traveler is provided on an &quot;as is&quot; and &quot;as
                available&quot; basis, without warranties of any kind, express or
                implied, including accuracy, completeness, or fitness for a
                particular purpose. To the fullest extent permitted by law, HIHODL
                and its affiliates are not liable for any loss, penalty, fine,
                denied entry, overstay, tax consequence, or other damage arising
                from your use of, or reliance on, Traveler estimates. You remain
                solely responsible for your own compliance with immigration and
                tax law. Your use of Traveler is also governed by our{" "}
                <a
                  href="/terms"
                  className="text-brand-ffb703 hover:underline"
                >
                  Terms of Service
                </a>{" "}
                (see the &quot;Informational Tools and Estimates&quot; section) and
                our{" "}
                <a
                  href="/privacy"
                  className="text-brand-ffb703 hover:underline"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">9. Contact</h2>
              <p className="text-[#94a3b8ff]">
                Questions about how Traveler calculates something, or a correction
                to report? Email{" "}
                <a
                  href="mailto:hello@hihodl.xyz"
                  className="text-brand-ffb703 hover:underline"
                >
                  hello@hihodl.xyz
                </a>
                .
              </p>
            </section>
          </div>
        </motion.section>

        {/* ==== FOOTER ==== */}
        <div className="flex w-full flex-col items-center px-4 sm:px-6 md:px-8 py-12 border-t-2 border-[rgba(255,255,255,0.08)] mt-8">
          <div className="flex w-full max-w-[1280px] flex-col items-center gap-6">
            <div className="flex gap-6">
              <a href="/privacy" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Privacy
              </a>
              <a href="/terms" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Terms
              </a>
              <a href="/legal/traveler" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Traveler
              </a>
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
