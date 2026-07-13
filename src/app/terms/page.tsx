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

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last updated: July 12, 2026
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">1. Acceptance of Terms</h2>
              <p className="text-[#94a3b8ff]">
                These Terms of Service are a binding agreement between you and HIHODL TECHNOLOGIES OÜ, a company incorporated in Estonia (&quot;HIHODL&quot;, &quot;we&quot;, &quot;us&quot;). By accessing and using HIHODL&apos;s website (hihodl.xyz) and services, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">2. Description of Service</h2>
              <p className="text-[#94a3b8ff]">
                HIHODL provides a self-custodial, multichain cryptocurrency wallet service. Our services include, but are not limited to, wallet management, blockchain interactions, and related financial technology services. We reserve the right to modify, suspend, or discontinue any aspect of our services at any time.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">3. Eligibility</h2>
              <p className="text-[#94a3b8ff]">
                You must be at least 18 years old to use our services. By using HIHODL, you represent and warrant that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>You are of legal age to form a binding contract</li>
                <li>You are not prohibited from using our services under applicable laws</li>
                <li>You will comply with all applicable local, state, national, and international laws and regulations</li>
                <li>All information you provide is accurate, current, and complete</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">4. User Accounts and Registration</h2>
              <div className="flex flex-col gap-3 text-[#94a3b8ff]">
                <p>
                  When you register for our waitlist or create an account, you agree to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide accurate, current, and complete information</li>
                  <li>Maintain and promptly update your information to keep it accurate</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Accept responsibility for all activities that occur under your account</li>
                  <li>Notify us immediately of any unauthorized use of your account</li>
                </ul>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">5. Self-Custodial Wallet</h2>
              <p className="text-[#94a3b8ff]">
                HIHODL is non-custodial software: a multichain self-custody wallet that lets you generate, store, and use cryptographic keys on your own device and interact directly with public blockchain networks. HIHODL is a software provider, not a bank, custodian, or exchange. This means:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>You are the sole owner and controller of your wallet, and you are solely responsible for the security of your private keys, seed phrase (recovery phrase), and PIN</li>
                <li>We never take custody of, control, or have access to your private keys, recovery phrase, or digital assets — they are generated and held under your sole control on your device</li>
                <li>You are solely responsible for all transactions you authorize from your wallet and bear all risk of any resulting losses</li>
                <li>Because HIHODL is non-custodial, we cannot reset, recover, restore, freeze, or move your keys, recovery phrase, or funds if they are lost, stolen, or compromised</li>
                <li>You must keep your recovery information secure and confidential, and you are responsible for the acts of anyone to whom you grant access to your wallet or device</li>
              </ul>
              <p className="text-[#94a3b8ff]">
                Any optional time-lock, allowlist, spending-limit, or smart-wallet recovery features are tools you configure and control; they do not transfer custody of your keys or assets to us.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">6. Identity Verification (KYC) and Regulated Features</h2>
              <p className="text-[#94a3b8ff]">
                Core self-custody wallet functionality is available broadly, subject to applicable law. However, certain features require identity verification before they can be unlocked.
              </p>
              <div className="flex flex-col gap-3 text-[#94a3b8ff]">
                <div>
                  <h3 className="text-xl font-[600] text-[#eaf6ffff] mb-2">6.1 Verification is required for certain features</h3>
                  <p>
                    To access features such as on-ramps, off-ramps, fiat payment rails (for example SPEI in Mexico), USD and fiat accounts, and the payment card (collectively, &quot;Regulated Features&quot;), you must complete identity verification (&quot;KYC&quot;) in accordance with applicable anti-money-laundering, counter-terrorist-financing, and sanctions requirements.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-[600] text-[#eaf6ffff] mb-2">6.2 Verification is performed by Sumsub</h3>
                  <p>
                    Identity verification is performed by our verification partner, Sumsub (Sum and Substance Ltd.) and/or its affiliates (&quot;Sumsub&quot;). When you complete verification, your identity documents, selfie and liveness check, and biometric data are captured and processed by Sumsub. HIHODL does not store your identity documents, selfie, or biometric data on your device or on our servers — HIHODL receives only a verification status and the minimum data required for compliance. See our Privacy Policy for details, including the explicit consent required for biometric (special-category) data.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-[600] text-[#eaf6ffff] mb-2">6.3 Downstream providers</h3>
                  <p>
                    To enable Regulated Features, we and/or Sumsub may share your verification result and relevant compliance data (such as country of residence) with regulated third-party providers, including Bitso (on/off-ramp and local payment rails), MoonPay (card and ramp services), and a regulated card issuer. Some providers, including MoonPay, may run their own independent KYC and may require additional information directly from you. Your use of a provider&apos;s services is also governed by that provider&apos;s own terms and privacy policy.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-[600] text-[#eaf6ffff] mb-2">6.4 Country eligibility</h3>
                  <p>
                    Availability of Regulated Features depends on your country of residence and on provider coverage. During verification you may be asked to select your country from a list of supported regions; if your country is not listed, the relevant feature is not available to you, and Regulated Features may be unavailable in some jurisdictions. HIHODL is global-first with an initial focus on Latin America (for example, Mexico, Brazil, Argentina, and Colombia) and is expanding to additional regions over time. Supported jurisdictions may change.
                  </p>
                </div>
                <p>
                  We, our partners, or providers may decline, suspend, or revoke access to Regulated Features if verification is not completed, if documents do not satisfy applicable criteria, or where required by law or risk controls.
                </p>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">7. Electronic Communications and E-Signature</h2>
              <p className="text-[#94a3b8ff]">
                The Services are provided electronically. By using HIHODL you agree to transact with us, to sign agreements and consents (including KYC and biometric-processing consents collected via our verification partner), and to receive disclosures, notices, and other communications in electronic form. For full details, see our{" "}
                <a href="/e-sign" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">
                  Consent to Electronic Communications and Signatures
                </a>
                .
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">8. Acceptable Use</h2>
              <p className="text-[#94a3b8ff]">
                You agree not to use our services to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Violate any applicable laws or regulations</li>
                <li>Engage in any illegal or fraudulent activities</li>
                <li>Infringe upon the rights of others, including intellectual property rights</li>
                <li>Transmit any malicious code, viruses, or harmful software</li>
                <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
                <li>Interfere with or disrupt the integrity or performance of our services</li>
                <li>Use our services for money laundering, terrorist financing, or other criminal activities</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">9. Referral Program</h2>
              <p className="text-[#94a3b8ff]">
                If you participate in our referral program:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>You must comply with all applicable laws and regulations regarding referrals and marketing</li>
                <li>You may not use spam, fraudulent, or deceptive practices</li>
                <li>We reserve the right to modify, suspend, or terminate the referral program at any time</li>
                <li>We reserve the right to disqualify any referrals that violate these terms</li>
                <li>Referral rewards are subject to change and are not guaranteed</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">10. Intellectual Property</h2>
              <p className="text-[#94a3b8ff]">
                All content, features, and functionality of our services, including but not limited to text, graphics, logos, icons, images, and software, are the exclusive property of HIHODL and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">11. Disclaimers</h2>
              <p className="text-[#94a3b8ff]">
                Our services are provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. We do not warrant that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Our services will be uninterrupted, secure, or error-free</li>
                <li>Any defects or errors will be corrected</li>
                <li>Our services are free of viruses or other harmful components</li>
                <li>The results obtained from using our services will be accurate or reliable</li>
              </ul>
              <p className="text-[#94a3b8ff] mt-2">
                Cryptocurrency transactions are irreversible. You are solely responsible for verifying transaction details before confirming.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">12. Informational Tools and Estimates (Traveler)</h2>
              <p className="text-[#94a3b8ff]">
                Some features of the Services — including Traveler and any visa-day, Schengen 90/180, tax-residency, or similar calculators, counters, forecasts, and estimates (collectively, &quot;Informational Tools&quot;) — are provided for general informational and planning purposes only. Informational Tools are not tax, legal, accounting, or immigration advice; HIHODL is not a tax advisor, law firm, accountancy, or immigration adviser; and no advisory, professional, or fiduciary relationship is created by your use of them.
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li><span className="text-[#eaf6ffff] font-[600]">Estimates only.</span> Outputs are estimates generated from the information you enter and from third-party or public datasets that may be incomplete, outdated, or inapplicable to your specific circumstances.</li>
                <li><span className="text-[#eaf6ffff] font-[600]">No reliance.</span> You must not rely on Informational Tools as the sole basis for any travel, residence, immigration, or tax decision. Immigration officers and tax and other authorities apply their own rules and records, which may differ from ours and which govern.</li>
                <li><span className="text-[#eaf6ffff] font-[600]">Verify with official sources.</span> Before acting, confirm current requirements with the relevant government, consulate, embassy, or tax authority, and, for anything with real consequences, a qualified professional.</li>
                <li><span className="text-[#eaf6ffff] font-[600]">Your responsibility.</span> You are solely responsible for your own compliance with immigration, residence, and tax laws, and for the accuracy of the information you enter.</li>
              </ul>
              <p className="text-[#94a3b8ff]">
                The &quot;as is&quot; / no-warranty disclaimer in Section 11 and the limitation of liability in Section 13 apply in full to the Informational Tools. Further detail on how these estimates are produced, the data behind them, and their limits is available at{" "}
                <a href="/legal/traveler" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">
                  hihodl.xyz/legal/traveler
                </a>
                .
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">13. Limitation of Liability</h2>
              <p className="text-[#94a3b8ff]">
                To the maximum extent permitted by law, HIHODL and its affiliates, officers, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other intangible losses, resulting from:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Your use or inability to use our services</li>
                <li>Any unauthorized access to or use of our servers or your personal information</li>
                <li>Any errors or omissions in our services, including any estimate produced by an Informational Tool</li>
                <li>Any fine, penalty, denied entry, overstay, tax liability, or other consequence arising from your reliance on an Informational Tool</li>
                <li>Any loss of funds due to loss of private keys or seed phrases</li>
                <li>Any blockchain network issues or failures</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">14. Indemnification</h2>
              <p className="text-[#94a3b8ff]">
                You agree to indemnify, defend, and hold harmless HIHODL and its affiliates, officers, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising out of or relating to your use of our services, violation of these terms, or infringement of any rights of another.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">15. Termination</h2>
              <p className="text-[#94a3b8ff]">
                We may terminate or suspend your access to our services immediately, without prior notice or liability, for any reason, including if you breach these Terms of Service. Upon termination, your right to use our services will cease immediately.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">16. Governing Law</h2>
              <p className="text-[#94a3b8ff]">
                HIHODL is operated by HIHODL TECHNOLOGIES OÜ, a company incorporated in Estonia. Except where mandatory local consumer-protection law of your country of residence provides otherwise, these Terms of Service shall be governed by and construed in accordance with the laws of Estonia, without regard to its conflict of law provisions. Any disputes arising from these terms or your use of our services shall be resolved through appropriate legal channels.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">17. Changes to Terms</h2>
              <p className="text-[#94a3b8ff]">
                We reserve the right to modify or replace these Terms of Service at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. Your continued use of our services after any changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">18. Severability</h2>
              <p className="text-[#94a3b8ff]">
                If any provision of these Terms of Service is held to be invalid or unenforceable by a court, the remaining provisions will remain in effect. These Terms of Service constitute the entire agreement between you and HIHODL regarding our services.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">19. Contact Information</h2>
              <p className="text-[#94a3b8ff]">
                If you have any questions about these Terms of Service, please contact us at:
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
            <div className="flex gap-6">
              <a href="/privacy" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Privacy
              </a>
              <a href="/terms" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Terms
              </a>
              <a href="/e-sign" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                E-Sign Consent
              </a>
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

