"use client";

/**
 * /legal/providers — the maintained list of who we work with.
 *
 * This page exists because the Terms used to name providers inline, and a legal
 * document does not notice when an integration changes. It named Bitso and
 * MoonPay accurately in the spring; by August neither was integrated and Bridge,
 * which was, appeared nowhere. A provider swap is finished when the page that
 * names the provider is updated, not when the code deploys.
 *
 * Rules for editing this page:
 *  - Only list a provider whose integration exists in the product. No roadmap,
 *    no "coming soon", no counterparty we have merely talked to.
 *  - Never state or imply a contractual status that is not executed. A provider
 *    can be integrated and still be mid-onboarding on their side; `pending`
 *    says the feature is off, it does not claim a signed agreement.
 *  - Registration and licence numbers go in ONLY where verified from the
 *    provider's own filing or agreement. An unverified number is worse than none.
 *  - Bump "Last updated" in the same commit. That date is the whole point.
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

type Provider = {
  name: string;
  entity?: string;
  what: string;
  data: string;
  /** Omit when the feature is live. Set when the feature is not yet enabled. */
  pending?: boolean;
};

const FINANCIAL: Provider[] = [
  {
    name: "Bridge",
    entity:
      "Bridge Building Inc., Delaware, United States (NMLS #2450917, money transmitter licences across all 50 US states and the District of Columbia). For residents of the European Economic Area: Bridge Building S.A., RCS Luxembourg B298785.",
    what:
      "Fiat accounts (USD, EUR and GBP), on-ramp and off-ramp, and conversion between fiat and stablecoins.",
    data:
      "Your verification result and the identifying and compliance data Bridge requires to open and operate an account in your name, plus the details of the payments you instruct.",
    pending: true,
  },
  {
    name: "Crossmint",
    what: "Card-based purchase of stablecoins, delivered to your own wallet address.",
    data:
      "The details you enter for the purchase. Crossmint runs its own checks and may ask you for information directly.",
    pending: true,
  },
];

const NON_FINANCIAL: Provider[] = [
  {
    name: "liteAPI (Nuitée)",
    what:
      "Hotel and accommodation inventory, and the booking payment, for in-app stays. liteAPI is the merchant of record for the booking; HOLD is not.",
    data:
      "The details needed to make and hold a booking, such as guest name and dates. No identity verification data.",
    pending: true,
  },
  {
    name: "eSIM Go",
    what: "Mobile data plans (eSIM) bought in the app.",
    data:
      "The technical details needed to issue and activate a data plan on your device. No identity verification data.",
    pending: true,
  },
];

const INFRASTRUCTURE: Provider[] = [
  {
    name: "Supabase",
    what: "Database and authentication for your HOLD account.",
    data: "Your account record and the app data described in the Privacy Policy.",
  },
  {
    name: "Render",
    what: "Hosting for our backend services.",
    data: "Processes data in transit as part of running the service.",
  },
  {
    name: "Sentry",
    what: "Crash and error reporting.",
    data: "Technical diagnostics such as error traces, device model and app version.",
  },
  {
    name: "Mixpanel",
    what: "Product analytics.",
    data: "Usage events, so we can see which parts of the app are used.",
  },
  {
    name: "Resend",
    what: "Transactional email delivery.",
    data: "Your email address and the content of the message being sent to you.",
  },
];

function ProviderTable({ rows }: { rows: Provider[] }) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((p) => (
        <div
          key={p.name}
          className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-white/5 p-6 backdrop-blur-xl"
        >
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <p className="text-[#eaf6ffff] font-[700] text-lg">{p.name}</p>
            {p.pending ? (
              <span className="rounded-full border border-[rgba(255,183,3,0.35)] bg-[rgba(255,183,3,0.08)] px-3 py-1 text-xs font-[600] text-brand-ffb703">
                Not yet enabled
              </span>
            ) : null}
          </div>
          {p.entity ? (
            <p className="text-[#94a3b8ff] text-sm mb-3">{p.entity}</p>
          ) : null}
          <p className="text-[#94a3b8ff] mb-2">
            <span className="text-[#eaf6ffff] font-[600]">What they do: </span>
            {p.what}
          </p>
          <p className="text-[#94a3b8ff]">
            <span className="text-[#eaf6ffff] font-[600]">
              What they receive:{" "}
            </span>
            {p.data}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function ProvidersLegalPage() {
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
              Service providers
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last updated: August 17, 2026
            </p>
          </div>

          <div className="rounded-2xl border border-[rgba(255,183,3,0.35)] bg-[rgba(255,183,3,0.06)] p-6">
            <p className="text-[#eaf6ffff] font-['Inter'] font-[600] leading-relaxed">
              HOLD is software. Every regulated financial activity in the app —
              opening a fiat account, executing a payment, converting between
              fiat and stablecoins — is performed by a licensed institution
              acting in its own name. This page lists those institutions and our
              other suppliers, and says what each one receives. We keep it
              current: when an integration changes, this page changes with it.
            </p>
            <p className="text-[#94a3b8ff] font-['Inter'] font-[400] leading-relaxed mt-4">
              Providers marked{" "}
              <span className="text-brand-ffb703 font-[600]">
                Not yet enabled
              </span>{" "}
              are built into the app, but the feature they power is not
              switched on in the public release yet. They are listed in advance
              so that nothing about where your data goes is a surprise on the
              day a feature ships.
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                1. Regulated financial institutions
              </h2>
              <p className="text-[#94a3b8ff]">
                These providers hold the licences under which regulated features
                operate. Each performs its own customer onboarding and screening
                under its own programme, and each decides for itself whether to
                accept a customer. HOLD does not hold client money and does not
                settle fiat at any point.
              </p>
              <ProviderTable rows={FINANCIAL} />
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                2. Identity verification
              </h2>
              <p className="text-[#94a3b8ff]">
                Identity verification, liveness and biometric checks, proof of
                address, and sanctions, PEP, watchlist and adverse-media
                screening are performed by{" "}
                <span className="text-[#eaf6ffff] font-[600]">
                  Sum and Substance Ltd. (&quot;Sumsub&quot;)
                </span>
                , company number 09688671, registered in England and Wales at
                30 St. Mary Axe, London EC3A 8BF.
              </p>
              <p className="text-[#94a3b8ff]">
                Sumsub acts as our data processor under a Data Processing
                Agreement and processes your data on our documented
                instructions. Your identity documents, selfie and biometric data
                are captured and held by Sumsub, not by HOLD; we receive the
                verification outcome and the minimum data required for
                compliance. Sumsub is registered with the UK Information
                Commissioner&apos;s Office and maintains ISO/IEC 27001, 27017
                and 27018, SOC 2 Type 2, and PCI DSS.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                3. Commercial suppliers
              </h2>
              <p className="text-[#94a3b8ff]">
                These power the non-financial things you can buy in the app.
                They perform no regulated financial activity and receive no
                identity verification data.
              </p>
              <ProviderTable rows={NON_FINANCIAL} />
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                4. Technical infrastructure
              </h2>
              <p className="text-[#94a3b8ff]">
                The services we use to run the product itself. They are
                processors acting on our instructions and are not given identity
                verification data.
              </p>
              <ProviderTable rows={INFRASTRUCTURE} />
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                5. Providers we do not use
              </h2>
              <p className="text-[#94a3b8ff]">
                Versions of our Terms of Service and Privacy Policy published
                before August 13, 2026 named{" "}
                <span className="text-[#eaf6ffff] font-[600]">Bitso</span> and{" "}
                <span className="text-[#eaf6ffff] font-[600]">MoonPay</span> as
                downstream regulated providers. That reflected an integration
                plan we did not proceed with. We have no contractual
                relationship with either and neither is integrated in the live
                product. They are named here so that anyone who read the earlier
                wording can see it was corrected rather than quietly removed.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                6. Blockchain networks
              </h2>
              <p className="text-[#94a3b8ff]">
                Transactions you authorise are broadcast to public blockchain
                networks — Solana, Polygon, Base and Ethereum. These are public,
                permissionless networks operated by no one in particular. Data
                written to them is public, permanent, and outside the control of
                HOLD or any provider on this page.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                7. Questions
              </h2>
              <p className="text-[#94a3b8ff]">
                For questions about this page or about how a specific provider
                handles your data, contact us at{" "}
                <a
                  href="mailto:privacy@hihodl.xyz"
                  className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition"
                >
                  privacy@hihodl.xyz
                </a>
                . See also our{" "}
                <a
                  href="/privacy"
                  className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition"
                >
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a
                  href="/terms"
                  className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition"
                >
                  Terms of Service
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
              <a href="/legal/providers" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Providers
              </a>
              <a href="/e-sign" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                E-Sign Consent
              </a>
            </div>
            <span className="font-['Inter'] text-[13px] font-[400] leading-[19px] text-[#94a3b8ff]">
              © 2026 HOLD. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}
