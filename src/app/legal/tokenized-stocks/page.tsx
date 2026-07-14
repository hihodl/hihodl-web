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

export default function TokenizedStocksDisclosurePage() {
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
              Tokenized Stocks — Product Disclosure
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last updated: July 14, 2026
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <p className="text-[#94a3b8ff]">
                This disclosure explains how tokenized stocks work inside the HIHODL app. It applies to HIHODL TECHNOLOGIES OÜ, a company incorporated in Estonia (&quot;HIHODL&quot;, &quot;we&quot;, &quot;us&quot;). Read it together with our{" "}
                <a href="/terms" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Terms of Service</a>, the{" "}
                <a href="/legal/stocks-risk" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Investment Risk Disclosure</a>, and the{" "}
                <a href="/legal/restricted-jurisdictions" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Restricted Jurisdictions</a> list. Nothing here is investment, tax, or legal advice.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">1. What a tokenized stock is</h2>
              <p className="text-[#94a3b8ff]">
                A tokenized stock (for example AAPLx, TSLAx, or SPYx) is a blockchain token that tracks the price of an underlying share or fund. The tokens made available in HIHODL are issued by a third-party issuer, Backed Finance AG and its affiliates (&quot;Backed&quot;), under a base prospectus approved in the European Union / Liechtenstein. Each token is intended to be backed 1:1 by the corresponding underlying security held by the issuer or its custodians.
              </p>
              <p className="text-[#94a3b8ff]">
                A tokenized stock is a security (a transferable financial instrument), not a cryptocurrency. It is <span className="text-[#eaf6ffff] font-[600]">not</span> the underlying share itself. Holding the token does not make you a shareholder of the underlying company.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">2. HIHODL&apos;s role — a non-custodial, passive interface</h2>
              <p className="text-[#94a3b8ff]">
                HIHODL is self-custodial wallet software. In relation to tokenized stocks:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>HIHODL is <span className="text-[#eaf6ffff] font-[600]">not a broker-dealer, exchange, investment firm, financial adviser, or issuer</span>, and does not provide investment advice, portfolio management, or personal recommendations.</li>
                <li>HIHODL does not issue, mint, redeem, hold, or take custody of tokenized stocks. The tokens are generated and held under your sole control in your own wallet, on the Solana network.</li>
                <li>HIHODL does not match orders, operate an order book, act as counterparty to your trade, or hold client money or client assets.</li>
                <li>When you buy or sell a tokenized stock, <span className="text-[#eaf6ffff] font-[600]">you</span> initiate and authorize a peer-to-pool swap that executes against public, third-party on-chain liquidity (a decentralized exchange aggregator). HIHODL provides only the interface that helps you construct and broadcast that transaction from your own keys.</li>
              </ul>
              <p className="text-[#94a3b8ff]">
                Backed&apos;s own documentation states that its tokens are offered only through licensed entities and that distributors are responsible for complying with the regulatory requirements in the jurisdictions where they operate. HIHODL provides passive, non-custodial software and does not act as Backed&apos;s distributor or agent.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">3. No voting or shareholder rights</h2>
              <p className="text-[#94a3b8ff]">
                A tokenized stock does not confer voting rights, and it does not make you a registered shareholder of the underlying company. You do not acquire the governance, pre-emption, or other rights attached to directly holding the underlying share. Any economic events (such as price movements, corporate actions, or splits) are handled by the issuer under its own terms and may be reflected in the token differently from a directly held share.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">4. Issuer and counterparty risk</h2>
              <p className="text-[#94a3b8ff]">
                Your tokenized stock is a claim whose value depends on the issuer (Backed) and the custodians and counterparties it relies on. Backed is exposed to the credit risk of the institutions with which it holds cash, crypto, and securities, including the depositary institutions holding the underlying shares that collateralize the tokens.
              </p>
              <p className="text-[#94a3b8ff]">
                If the issuer, a custodian, or another counterparty fails to meet its obligations or becomes insolvent, access to the underlying securities may be delayed or impossible, and you may face a partial or total loss of your invested capital. Because the product is non-custodial, HIHODL cannot reverse a transaction, recover the underlying share, or compensate you for issuer or counterparty failure.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">5. How buying and selling works</h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>You spend a stablecoin you already hold (for example USDC on Solana) to receive the tokenized stock, or the reverse when selling.</li>
                <li>The transaction is a token swap executed on-chain against third-party liquidity. Prices are set by that market, not by HIHODL, and can differ from the last-traded price of the underlying share and from the price shown before you confirm.</li>
                <li>On-chain transactions are irreversible once broadcast. You are responsible for verifying the details before you confirm.</li>
                <li>Network fees, swap fees, and price slippage may apply and are shown, where available, before you confirm.</li>
                <li>Underlying stock markets have opening hours; on-chain token liquidity does not, so a token&apos;s price may move when the underlying market is closed.</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">6. Eligibility, identity verification, and restricted regions</h2>
              <p className="text-[#94a3b8ff]">
                Tokenized stocks are offered only to eligible users in supported regions. They are <span className="text-[#eaf6ffff] font-[600]">not</span> offered to U.S. Persons or to persons in the United States, Canada, the United Kingdom, or Australia, or in any other restricted jurisdiction. The underlying tokens have not been and will not be registered under the U.S. Securities Act of 1933 and are offered only outside the United States to non-U.S. Persons in reliance on Regulation S.
              </p>
              <p className="text-[#94a3b8ff]">
                Access to tokenized stocks in the app requires you to complete identity verification (KYC) and to be resident in a supported region. We apply both a location check and a verified-residence check. Your wallet, swaps, and other features are unaffected by these controls. See the full{" "}
                <a href="/legal/restricted-jurisdictions" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Restricted Jurisdictions</a> list.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">7. Taxes</h2>
              <p className="text-[#94a3b8ff]">
                You are solely responsible for determining and meeting any tax obligations arising from buying, holding, or selling tokenized stocks, including any obligation to report gains, income, or holdings to the relevant authorities. HIHODL does not provide tax advice.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">8. Risk warning</h2>
              <p className="text-[#94a3b8ff]">
                Investing carries risk. The value of a tokenized stock can go down as well as up, and you may get back less than you put in, including a total loss. Past performance is not a reliable indicator of future results. Do not invest more than you can afford to lose. Read the full{" "}
                <a href="/legal/stocks-risk" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Investment Risk Disclosure</a> before you trade.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">9. Contact</h2>
              <p className="text-[#94a3b8ff]">
                Questions about this disclosure:
              </p>
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
              <a href="/legal/stocks-risk" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">Risk Disclosure</a>
              <a href="/legal/restricted-jurisdictions" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">Restricted Jurisdictions</a>
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
