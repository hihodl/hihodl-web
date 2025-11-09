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
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">1. Acceptance of Terms</h2>
              <p className="text-[#94a3b8ff]">
                By accessing and using HIHODL&apos;s website (hihodl.xyz) and services, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
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
                HIHODL is a self-custodial wallet, which means:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>You are solely responsible for the security of your private keys and seed phrases</li>
                <li>We do not have access to, store, or control your private keys or funds</li>
                <li>You are responsible for all transactions initiated from your wallet</li>
                <li>We cannot recover your wallet or funds if you lose your private keys or seed phrase</li>
                <li>You must keep your recovery information secure and confidential</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">6. Acceptable Use</h2>
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
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">7. Referral Program</h2>
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
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">8. Intellectual Property</h2>
              <p className="text-[#94a3b8ff]">
                All content, features, and functionality of our services, including but not limited to text, graphics, logos, icons, images, and software, are the exclusive property of HIHODL and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">9. Disclaimers</h2>
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
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">10. Limitation of Liability</h2>
              <p className="text-[#94a3b8ff]">
                To the maximum extent permitted by law, HIHODL and its affiliates, officers, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other intangible losses, resulting from:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Your use or inability to use our services</li>
                <li>Any unauthorized access to or use of our servers or your personal information</li>
                <li>Any errors or omissions in our services</li>
                <li>Any loss of funds due to loss of private keys or seed phrases</li>
                <li>Any blockchain network issues or failures</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">11. Indemnification</h2>
              <p className="text-[#94a3b8ff]">
                You agree to indemnify, defend, and hold harmless HIHODL and its affiliates, officers, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising out of or relating to your use of our services, violation of these terms, or infringement of any rights of another.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">12. Termination</h2>
              <p className="text-[#94a3b8ff]">
                We may terminate or suspend your access to our services immediately, without prior notice or liability, for any reason, including if you breach these Terms of Service. Upon termination, your right to use our services will cease immediately.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">13. Governing Law</h2>
              <p className="text-[#94a3b8ff]">
                These Terms of Service shall be governed by and construed in accordance with applicable laws, without regard to its conflict of law provisions. Any disputes arising from these terms or your use of our services shall be resolved through appropriate legal channels.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">14. Changes to Terms</h2>
              <p className="text-[#94a3b8ff]">
                We reserve the right to modify or replace these Terms of Service at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. Your continued use of our services after any changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">15. Severability</h2>
              <p className="text-[#94a3b8ff]">
                If any provision of these Terms of Service is held to be invalid or unenforceable by a court, the remaining provisions will remain in effect. These Terms of Service constitute the entire agreement between you and HIHODL regarding our services.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">16. Contact Information</h2>
              <p className="text-[#94a3b8ff]">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-white/5 rounded-xl p-6 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl">
                <p className="text-[#eaf6ffff] font-[600] mb-2">HIHODL</p>
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

