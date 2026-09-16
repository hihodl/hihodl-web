"use client";

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

export default function StocksRiskDisclosurePage() {
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
              Tokenized Stocks — Investment Risk Disclosure
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last updated: July 14, 2026
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <div className="bg-white/5 rounded-xl p-6 border border-[rgba(255,255,255,0.10)] backdrop-blur-xl border-t-2 border-t-brand-ffb703">
                <p className="text-[#eaf6ffff] font-[600]">
                  Investing carries risk. The value of a tokenized stock can go down as well as up, and you may get back less than you invested, including a total loss. Do not invest more than you can afford to lose. This disclosure is not investment advice.
                </p>
              </div>
              <p className="text-[#94a3b8ff]">
                This disclosure summarizes the main risks of buying, holding, and selling tokenized stocks in the HOLD app. Read it together with the{" "}
                <a href="/legal/tokenized-stocks" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Product Disclosure</a> and our{" "}
                <a href="/terms" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Terms of Service</a>. It is not exhaustive.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">1. Market risk</h2>
              <p className="text-[#94a3b8ff]">
                Prices move. The value of a tokenized stock follows the price of the underlying share or fund, which can fall sharply and without warning due to company performance, economic conditions, interest rates, or broader market sentiment. You may lose some or all of your capital. Past performance is not a reliable indicator of future results.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">2. Issuer and counterparty risk</h2>
              <p className="text-[#94a3b8ff]">
                A tokenized stock is a claim against a third-party issuer (Backed Finance) and depends on the custodians and counterparties holding the underlying securities. If the issuer, a custodian, or another counterparty defaults or becomes insolvent, access to the underlying shares may be delayed or impossible, and you may face a partial or total loss. HOLD does not guarantee the issuer&apos;s obligations and cannot compensate you for their failure.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">3. No shareholder rights</h2>
              <p className="text-[#94a3b8ff]">
                Holding a tokenized stock does not make you a shareholder of the underlying company. You have no voting rights and none of the other legal rights of directly holding the share. Corporate actions may be handled by the issuer differently from a directly held share.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">4. Liquidity and pricing risk</h2>
              <p className="text-[#94a3b8ff]">
                Tokenized stocks trade against on-chain liquidity, which can be thin. You may not be able to sell quickly, or at all, at a price close to the underlying share. The price you receive can differ from the last-traded price of the underlying and from the price shown before you confirm (slippage). On-chain liquidity trades around the clock, so a token&apos;s price can move while the underlying stock market is closed.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">5. Technology, custody, and irreversibility risk</h2>
              <p className="text-[#94a3b8ff]">
                Tokenized stocks are settled on the Solana blockchain and held non-custodially in your own wallet. You are solely responsible for the security of your keys and recovery phrase. On-chain transactions are irreversible once broadcast: HOLD cannot cancel, reverse, or refund a trade, and cannot recover funds lost to a mistaken transaction, a lost recovery phrase, a smart-contract flaw, an oracle failure, or network congestion or outage.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">6. Currency risk</h2>
              <p className="text-[#94a3b8ff]">
                Tokenized stocks are priced and traded in a stablecoin (for example USDC). If the value shown to you is converted into your local currency, exchange-rate movements and any de-pegging of the stablecoin can affect what you actually receive.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">7. Regulatory risk</h2>
              <p className="text-[#94a3b8ff]">
                Tokenized securities are a developing area, and the legal and regulatory treatment varies by country and can change. Future regulation, or a change in a provider&apos;s regulatory status, could restrict, suspend, or end the availability of tokenized stocks, or affect your ability to hold or sell them. Availability is limited to eligible users in supported regions and excludes restricted jurisdictions.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">8. No advice; your responsibility</h2>
              <p className="text-[#94a3b8ff]">
                HOLD is not a broker, adviser, or issuer, and provides no investment, tax, or legal advice and no personal recommendation. Any information in the app (including prices, charts, and company names) is for general information only. You are solely responsible for your own investment decisions and for any tax arising from them. Consider taking independent professional advice before you invest.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">9. Contact</h2>
              <div className="bg-white/5 rounded-xl p-6 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
                <p className="text-[#eaf6ffff] font-[600] mb-2">HIHODL TECHNOLOGIES OÜ</p>
                <p className="text-[#94a3b8ff]">Registered in Estonia — the entity behind HOLD</p>
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
              <a href="/legal/restricted-jurisdictions" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">Restricted Jurisdictions</a>
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
